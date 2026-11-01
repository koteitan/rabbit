import * as Kind from 'nostr-tools/kinds';
import { type Event as NostrEvent } from 'nostr-tools/pure';

import { type Profile } from '@/nostr/event/Profile';
import usePool from '@/nostr/usePool';

const MaxWait = 3000;
const SearchLimit = 20;

export type UserCandidate = {
  pubkey: string;
  npub: string;
  profile: Profile | null;
};

const normalize = (s: string) => s.normalize('NFKC').toLowerCase();

const namesOf = (profile: Profile | null): string[] =>
  [profile?.display_name, profile?.name]
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
    .map(normalize);

// smaller is better; undefined means not matched
const scoreOf = ({ npub, profile }: UserCandidate, query: string): number | undefined => {
  const names = namesOf(profile);
  if (names.some((name) => name.startsWith(query))) return 0;
  if (names.some((name) => name.includes(query))) return 1;
  if (npub.startsWith(query)) return 2;
  return undefined;
};

/**
 * Picks the candidates matching the query by name or npub.
 * Prefix matches come first, and the given order is kept otherwise.
 */
export const rankUsers = (candidates: UserCandidate[], query: string): UserCandidate[] => {
  const q = normalize(query);
  if (q.length === 0) return candidates;
  return candidates
    .flatMap((candidate, index) => {
      const score = scoreOf(candidate, q);
      return score != null ? [{ candidate, index, score }] : [];
    })
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ candidate }) => candidate);
};

/**
 * Searches profiles (kind:0) on the relays supporting NIP-50.
 * Returns the latest profile of each user.
 */
export const searchProfiles = async (term: string, relayUrls: string[]): Promise<NostrEvent[]> => {
  const pool = usePool();
  const events = await pool().querySync(
    relayUrls,
    { kinds: [Kind.Metadata], search: term, limit: SearchLimit },
    { maxWait: MaxWait },
  );
  const latest = new Map<string, NostrEvent>();
  events.forEach((event) => {
    const current = latest.get(event.pubkey);
    if (current == null || current.created_at < event.created_at) {
      latest.set(event.pubkey, event);
    }
  });
  return [...latest.values()];
};
