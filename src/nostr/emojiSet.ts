import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import * as Kind from 'nostr-tools/kinds';
import { type Event as NostrEvent } from 'nostr-tools/pure';

import { type CustomEmojiConfig } from '@/core/useConfig';
import { pickLatestEvent } from '@/nostr/event/comparator';
import Tags from '@/nostr/event/Tags';
import { replaceableEventIdentifier } from '@/nostr/identifier';
import usePool from '@/nostr/usePool';

const MaxWait = 8000;

// A reference to an emoji set (kind:30030) held by an emoji list (kind:10030) as an "a" tag.
export type EmojiSetRef = {
  pubkey: string;
  identifier: string;
};

export const emojiSetCoordinate = ({ pubkey, identifier }: EmojiSetRef): string =>
  replaceableEventIdentifier({ kind: Kind.Emojisets, pubkey, identifier });

export const parseEmojiSetCoordinate = (coordinate: string): EmojiSetRef | null => {
  const [kind, pubkey, ...rest] = coordinate.split(':');
  if (kind !== String(Kind.Emojisets)) return null;
  if (!/^[0-9a-f]{64}$/.test(pubkey ?? '')) return null;
  // an identifier can contain ":"
  return { pubkey, identifier: rest.join(':') };
};

export const emojiSetRefs = (emojiListEvent: NostrEvent): EmojiSetRef[] => {
  const refs = new Tags(emojiListEvent.tags)
    .findTagsByName('a')
    .map(([, coordinate]) => (coordinate != null ? parseEmojiSetCoordinate(coordinate) : null))
    .filter((ref): ref is EmojiSetRef => ref != null);
  return uniqBy(refs, emojiSetCoordinate);
};

export const customEmojis = (event: NostrEvent): CustomEmojiConfig[] =>
  new Tags(event.tags).emojiTags().map(([, shortcode, url]) => ({ shortcode, url }));

const latestEventOfEachEmojiSet = (events: NostrEvent[]): NostrEvent[] => {
  const eventsByCoordinate = new Map<string, NostrEvent[]>();

  events.forEach((event) => {
    const identifier = new Tags(event.tags).findFirstTagByName('d')?.[1];
    if (identifier == null) return;
    const coordinate = emojiSetCoordinate({ pubkey: event.pubkey, identifier });
    eventsByCoordinate.set(coordinate, [...(eventsByCoordinate.get(coordinate) ?? []), event]);
  });

  return [...eventsByCoordinate.values()]
    .map((sameCoordinateEvents) => pickLatestEvent(sameCoordinateEvents))
    .filter((event): event is NostrEvent => event != null);
};

export const fetchEmojiList = async ({
  pubkey,
  relayUrls,
}: {
  pubkey: string;
  relayUrls: string[];
}): Promise<NostrEvent | null> => {
  const pool = usePool();
  const events = await pool().querySync(
    relayUrls,
    { kinds: [Kind.UserEmojiList], authors: [pubkey] },
    { maxWait: MaxWait },
  );
  return pickLatestEvent(events) ?? null;
};

export const fetchEmojiSets = async ({
  refs,
  relayUrls,
}: {
  refs: EmojiSetRef[];
  relayUrls: string[];
}): Promise<NostrEvent[]> => {
  if (refs.length === 0) return [];

  const pool = usePool();
  const events = await pool().querySync(
    relayUrls,
    {
      kinds: [Kind.Emojisets],
      authors: uniq(refs.map(({ pubkey }) => pubkey)),
      '#d': uniq(refs.map(({ identifier }) => identifier)),
    },
    { maxWait: MaxWait },
  );

  // the filter above matches other author's sets which share an identifier, so drop them here
  const requested = new Set(refs.map(emojiSetCoordinate));
  return latestEventOfEachEmojiSet(events).filter((event) => {
    const identifier = new Tags(event.tags).findFirstTagByName('d')?.[1] ?? '';
    return requested.has(emojiSetCoordinate({ pubkey: event.pubkey, identifier }));
  });
};

export type FetchEmojiListEmojisResult = {
  emojis: CustomEmojiConfig[];
  emojiSetCount: number;
};

/**
 * Collects every custom emoji of the user's emoji list (kind:10030): the emojis written in the
 * list itself and the emojis of all the emoji sets (kind:30030) which the list refers to.
 */
export const fetchEmojiListEmojis = async ({
  pubkey,
  relayUrls,
}: {
  pubkey: string;
  relayUrls: string[];
}): Promise<FetchEmojiListEmojisResult> => {
  const emojiList = await fetchEmojiList({ pubkey, relayUrls });
  if (emojiList == null) return { emojis: [], emojiSetCount: 0 };

  const emojiSets = await fetchEmojiSets({ refs: emojiSetRefs(emojiList), relayUrls });

  const emojis = [emojiList, ...emojiSets].flatMap(customEmojis);

  return {
    emojis: uniqBy(emojis, ({ shortcode }) => shortcode),
    emojiSetCount: emojiSets.length,
  };
};
