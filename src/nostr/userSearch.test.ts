import assert from 'assert';

import { describe, it } from 'vitest';

import { rankUsers, type UserCandidate } from '@/nostr/userSearch';

const user = (pubkey: string, display_name?: string, name?: string): UserCandidate => ({
  pubkey,
  npub: `npub1${pubkey}`,
  profile: { display_name, name },
});

const pubkeysOf = (candidates: UserCandidate[]) => candidates.map(({ pubkey }) => pubkey);

describe('rankUsers', () => {
  it('should return all candidates in the given order for an empty query', () => {
    const candidates = [user('a', 'Alice'), user('b', 'Bob')];
    assert.deepStrictEqual(pubkeysOf(rankUsers(candidates, '')), ['a', 'b']);
  });

  it('should put prefix matches before partial matches', () => {
    const candidates = [user('a', 'Mako'), user('b', 'Kota'), user('c', undefined, 'koteitan')];
    assert.deepStrictEqual(pubkeysOf(rankUsers(candidates, 'ko')), ['b', 'c', 'a']);
  });

  it('should ignore case and full-width letters', () => {
    const candidates = [user('a', 'ＫＯＴＥ'), user('b', 'Bob')];
    assert.deepStrictEqual(pubkeysOf(rankUsers(candidates, 'kote')), ['a']);
  });

  it('should match npub after names', () => {
    const candidates = [user('xyz'), user('b', 'npub1xyzzy')];
    assert.deepStrictEqual(pubkeysOf(rankUsers(candidates, 'npub1xyz')), ['b', 'xyz']);
  });

  it('should match a profile without names only by npub', () => {
    const candidates: UserCandidate[] = [{ pubkey: 'abc', npub: 'npub1abc', profile: null }];
    assert.deepStrictEqual(pubkeysOf(rankUsers(candidates, 'a')), []);
    assert.deepStrictEqual(pubkeysOf(rankUsers(candidates, 'npub1a')), ['abc']);
  });
});
