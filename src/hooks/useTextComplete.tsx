import { createEffect, createSignal, onCleanup } from 'solid-js';

import { useQueryClient } from '@tanstack/solid-query';
import { Textcomplete } from '@textcomplete/core';
import { TextareaEditor } from '@textcomplete/textarea';
import uniq from 'lodash/uniq';
import { npubEncode } from 'nostr-tools/nip19';
import { type Event as NostrEvent } from 'nostr-tools/pure';

import { relaysForSearching } from '@/core/relayUrls';
import useConfig, { type CustomEmojiConfig } from '@/core/useConfig';
import { safeParseProfile } from '@/nostr/event/Profile';
import useFollowings from '@/nostr/useFollowings';
import { profileQueryOptions, queryKeyUseProfile } from '@/nostr/useProfile';
import usePubkey from '@/nostr/usePubkey';
import { rankUsers, searchProfiles, type UserCandidate } from '@/nostr/userSearch';
import { thumbnailUrl } from '@/utils/url';

const MentionLimit = 20;
// waits for the user to stop typing before asking the search relays
const SearchDebounceMs = 400;

// `@` after a word, a slash or a dot is a part of an email address or a URL
const mentionRegex = /(?<![\w/.])[@＠]([^\s@＠]*)$/;

export type UseTextCompleteProps = {
  // users listed first in the mention candidates, such as the users replied to
  firstPubkeys?: string[];
};

const useTextComplete = (propsProvider: () => UseTextCompleteProps = () => ({})) => {
  const { searchEmojis } = useConfig();
  const queryClient = useQueryClient();
  const pubkey = usePubkey();
  const { followingPubkeys } = useFollowings(() => {
    const p = pubkey();
    return p != null ? { pubkey: p } : null;
  });

  const [elementRef, setElementRef] = createSignal<HTMLTextAreaElement | undefined>();
  // the textarea completed now, read outside the reactive scope
  let textarea: HTMLTextAreaElement | undefined;

  const npubs = new Map<string, string>();
  const npubOf = (pk: string) => {
    let npub = npubs.get(pk);
    if (npub == null) {
      npub = npubEncode(pk);
      npubs.set(pk, npub);
    }
    return npub;
  };

  const cachedProfileEvent = (pk: string) =>
    queryClient.getQueryData<NostrEvent | null>(queryKeyUseProfile({ pubkey: pk }));

  const candidateOf = (pk: string): UserCandidate => {
    const event = cachedProfileEvent(pk);
    return {
      pubkey: pk,
      npub: npubOf(pk),
      profile: event != null ? safeParseProfile(event.content) : null,
    };
  };

  // asks for the profiles not in the cache yet, only once for each user
  const requested = new Set<string>();
  const requestProfiles = (pubkeys: string[]) => {
    pubkeys.forEach((pk) => {
      if (requested.has(pk) || cachedProfileEvent(pk) !== undefined) return;
      requested.add(pk);
      queryClient
        .prefetchQuery(profileQueryOptions(queryClient, { pubkey: pk }))
        .catch((err) => console.error(err));
    });
  };

  const candidatePubkeys = (): string[] => {
    const p = pubkey();
    return uniq([
      ...(propsProvider().firstPubkeys ?? []),
      ...followingPubkeys(),
      ...(p != null ? [p] : []),
    ]);
  };

  const currentMentionTerm = (): string | undefined =>
    textarea?.value.slice(0, textarea.selectionEnd).match(mentionRegex)?.[1];

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(searchTimer));

  // lists the known users at once, then adds the users found on the search relays
  const searchMentions = (term: string, callback: (results: UserCandidate[]) => void) => {
    const pubkeys = candidatePubkeys();
    requestProfiles(pubkeys);
    const local = rankUsers(pubkeys.map(candidateOf), term).slice(0, MentionLimit);
    callback(local);

    clearTimeout(searchTimer);
    if (term.trim().length < 2 || term.startsWith('npub1')) return;
    searchTimer = setTimeout(() => {
      searchProfiles(term, relaysForSearching)
        .then((events) => {
          // the user may have typed more or chosen one while searching
          if (currentMentionTerm() !== term) return;
          events.forEach((event) => {
            const queryKey = queryKeyUseProfile({ pubkey: event.pubkey });
            if (queryClient.getQueryData(queryKey) == null) {
              queryClient.setQueryData(queryKey, event);
            }
          });
          const shown = new Set(local.map((candidate) => candidate.pubkey));
          const found = events
            .filter((event) => !shown.has(event.pubkey))
            .map((event) => candidateOf(event.pubkey));
          if (found.length > 0) callback([...local, ...found]);
        })
        .catch((err) => console.error(err));
    }, SearchDebounceMs);
  };

  createEffect(() => {
    const el = elementRef();
    textarea = el;
    if (el == null) return;

    const editor = new TextareaEditor(el);
    const textcomplete = new Textcomplete(
      editor,
      [
        {
          id: 'customEmoji',
          match: /\B:([\w-]+)$/,
          search: (term, callback) => {
            callback(searchEmojis(term));
          },
          template: (config: CustomEmojiConfig) => {
            const e = (
              <div class="flex gap-1 border-b border-border px-2 py-1">
                <img class="h-6 max-w-12" src={config.url} alt={config.shortcode} />
                <div>{config.shortcode}</div>
              </div>
            ) as HTMLElement;
            return e.outerHTML;
          },
          replace: (result: CustomEmojiConfig) => `:${result.shortcode}: `,
        },
        {
          id: 'mention',
          match: mentionRegex,
          search: searchMentions,
          template: (user: UserCandidate) => {
            const { npub, profile } = user;
            const displayName = profile?.display_name || profile?.name || `${npub.slice(0, 12)}…`;
            const e = (
              <div class="flex items-center gap-1 border-b border-border px-2 py-1">
                {profile?.picture != null ? (
                  <img
                    class="size-6 shrink-0 rounded-sm object-cover"
                    src={thumbnailUrl(profile.picture, 'icon')}
                    alt=""
                    referrerpolicy="no-referrer"
                  />
                ) : (
                  <div class="size-6 shrink-0" />
                )}
                <span class="truncate font-bold">{displayName}</span>
                {profile?.display_name && profile.name ? (
                  <span class="truncate text-fg-secondary">@{profile.name}</span>
                ) : null}
              </div>
            ) as HTMLElement;
            return e.outerHTML;
          },
          replace: (user: UserCandidate) => `nostr:${user.npub} `,
        },
      ],
      {
        dropdown: {
          className: 'bg-bg shadow rounded max-h-[50vh] max-w-[90vw] overflow-y-auto',
          maxCount: MentionLimit,
          item: {
            className: 'cursor-pointer',
            activeClassName: 'bg-bg-tertiary cursor-pointer',
          },
        },
      },
    );

    onCleanup(() => {
      textcomplete.destroy();
    });
  });

  return { elementRef: setElementRef };
};

export default useTextComplete;
