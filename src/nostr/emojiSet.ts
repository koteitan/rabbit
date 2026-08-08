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

/**
 * An emoji set to choose emojis from. `title` is null for the emojis which the emoji list
 * (kind:10030) holds by itself instead of referring to an emoji set.
 */
export type EmojiSetContent = {
  id: string;
  title: string | null;
  emojis: CustomEmojiConfig[];
};

export const emojiSetTitle = (emojiSetEvent: NostrEvent): string => {
  const tags = new Tags(emojiSetEvent.tags);
  const title = tags.findFirstTagByName('title')?.[1];
  if (title != null && title.length > 0) return title;
  return tags.findFirstTagByName('d')?.[1] ?? '';
};

export const toEmojiSetContent = (emojiSetEvent: NostrEvent): EmojiSetContent => {
  const identifier = new Tags(emojiSetEvent.tags).findFirstTagByName('d')?.[1] ?? '';
  return {
    id: emojiSetCoordinate({ pubkey: emojiSetEvent.pubkey, identifier }),
    title: emojiSetTitle(emojiSetEvent),
    emojis: customEmojis(emojiSetEvent),
  };
};

/**
 * Collects the custom emojis of the user's emoji list (kind:10030) grouped by their emoji set
 * (kind:30030), so that the user can choose which of them to add.
 * Empty sets are dropped, and the emojis of the list itself come last with a null title.
 */
export const fetchEmojiSetsOfList = async ({
  pubkey,
  relayUrls,
}: {
  pubkey: string;
  relayUrls: string[];
}): Promise<EmojiSetContent[]> => {
  const emojiList = await fetchEmojiList({ pubkey, relayUrls });
  if (emojiList == null) return [];

  const emojiSets = await fetchEmojiSets({ refs: emojiSetRefs(emojiList), relayUrls });

  const ownEmojis = customEmojis(emojiList);
  const ownContent: EmojiSetContent[] =
    ownEmojis.length > 0 ? [{ id: '', title: null, emojis: ownEmojis }] : [];

  return [...emojiSets.map(toEmojiSetContent), ...ownContent].filter(
    ({ emojis }) => emojis.length > 0,
  );
};
