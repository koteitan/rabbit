import assert from 'assert';

import { type Event as NostrEvent } from 'nostr-tools/pure';
import { describe, it } from 'vitest';

import {
  customEmojis,
  emojiSetRefs,
  emojiSetTitle,
  parseEmojiSetCoordinate,
  toEmojiSetContent,
} from '@/nostr/emojiSet';

const pubkeyA = 'fbcc9e7d6182a9d24ab622123f640d700298c43ccc30dc73aaf2a26d485543b8';
const pubkeyB = '6e62e578bdf608e250e93c25dc0cbadbda8db17e6fc3a28cdce8a2f56db7d106';

const event = (tags: string[][]): NostrEvent =>
  ({
    id: '005c079e4c7c103168e0cb359270ac96a6a46e5ff4ce8f4643e0831f6d1c2450',
    kind: 10030,
    pubkey: pubkeyA,
    created_at: 1700000000,
    content: '',
    sig: '',
    tags,
  }) as NostrEvent;

describe('parseEmojiSetCoordinate', () => {
  it('should parse a coordinate of an emoji set', () => {
    assert.deepStrictEqual(parseEmojiSetCoordinate(`30030:${pubkeyA}:foo`), {
      pubkey: pubkeyA,
      identifier: 'foo',
    });
  });

  it('should keep colons in an identifier', () => {
    assert.deepStrictEqual(parseEmojiSetCoordinate(`30030:${pubkeyA}:foo:bar`), {
      pubkey: pubkeyA,
      identifier: 'foo:bar',
    });
  });

  it('should allow an empty identifier', () => {
    assert.deepStrictEqual(parseEmojiSetCoordinate(`30030:${pubkeyA}:`), {
      pubkey: pubkeyA,
      identifier: '',
    });
  });

  it('should return null for other kinds', () => {
    assert.strictEqual(parseEmojiSetCoordinate(`30000:${pubkeyA}:foo`), null);
  });

  it('should return null for an invalid pubkey', () => {
    assert.strictEqual(parseEmojiSetCoordinate('30030:invalid:foo'), null);
    assert.strictEqual(parseEmojiSetCoordinate('30030'), null);
  });
});

describe('emojiSetRefs', () => {
  it('should return the emoji sets which the emoji list refers to', () => {
    const actual = emojiSetRefs(
      event([
        ['emoji', 'foo', 'https://example.com/emoji_foo.png'],
        ['a', `30030:${pubkeyA}:animals`],
        ['a', `30030:${pubkeyB}:foods`],
      ]),
    );
    assert.deepStrictEqual(actual, [
      { pubkey: pubkeyA, identifier: 'animals' },
      { pubkey: pubkeyB, identifier: 'foods' },
    ]);
  });

  it('should ignore invalid and duplicated references', () => {
    const actual = emojiSetRefs(
      event([
        ['a', `30030:${pubkeyA}:animals`],
        ['a', `30030:${pubkeyA}:animals`],
        ['a', `30000:${pubkeyA}:followset`],
        ['a'],
      ]),
    );
    assert.deepStrictEqual(actual, [{ pubkey: pubkeyA, identifier: 'animals' }]);
  });
});

describe('customEmojis', () => {
  it('should convert emoji tags into custom emoji configs', () => {
    const actual = customEmojis(
      event([
        ['emoji', 'foo', 'https://example.com/emoji_foo.png'],
        ['emoji', 'invalid shortcode', 'https://example.com/emoji_bar.png'],
        ['emoji', 'baz', 'not a url'],
        ['a', `30030:${pubkeyA}:animals`],
      ]),
    );
    assert.deepStrictEqual(actual, [
      { shortcode: 'foo', url: 'https://example.com/emoji_foo.png' },
    ]);
  });
});

describe('emojiSetTitle', () => {
  it('should use the title tag', () => {
    const actual = emojiSetTitle(
      event([
        ['d', 'animals'],
        ['title', 'Cute Animals'],
      ]),
    );
    assert.strictEqual(actual, 'Cute Animals');
  });

  it('should fall back to the identifier when the title is missing or empty', () => {
    assert.strictEqual(emojiSetTitle(event([['d', 'animals']])), 'animals');
    assert.strictEqual(
      emojiSetTitle(
        event([
          ['d', 'animals'],
          ['title', ''],
        ]),
      ),
      'animals',
    );
  });

  it('should return an empty string when both are missing', () => {
    assert.strictEqual(emojiSetTitle(event([])), '');
  });
});

describe('toEmojiSetContent', () => {
  it('should build a content keyed by its coordinate', () => {
    const actual = toEmojiSetContent(
      event([
        ['d', 'animals'],
        ['title', 'Cute Animals'],
        ['emoji', 'cat', 'https://example.com/cat.png'],
        ['emoji', 'dog', 'https://example.com/dog.png'],
      ]),
    );
    assert.deepStrictEqual(actual, {
      id: `30030:${pubkeyA}:animals`,
      title: 'Cute Animals',
      emojis: [
        { shortcode: 'cat', url: 'https://example.com/cat.png' },
        { shortcode: 'dog', url: 'https://example.com/dog.png' },
      ],
    });
  });
});
