import assert from 'assert';

import { describe, it } from 'vitest';

import {
  convertToEmojiConfig,
  convertToSimpleEmojiPack,
  simpleEmojiPackSchema,
} from '@/utils/emojipack';

describe('convertToSimpleEmojiPack', () => {
  it('should convert emoji configs into a simple emoji pack', () => {
    const actual = convertToSimpleEmojiPack([
      { shortcode: 'smiley', url: 'https://example.com/smiley.png' },
      { shortcode: 'cat', url: 'https://example.com/cat.png' },
    ]);
    assert.deepStrictEqual(actual, {
      cat: 'https://example.com/cat.png',
      smiley: 'https://example.com/smiley.png',
    });
  });

  it('should sort emojis by shortcode', () => {
    const actual = convertToSimpleEmojiPack([
      { shortcode: 'cherry', url: 'https://example.com/cherry.png' },
      { shortcode: 'apple', url: 'https://example.com/apple.png' },
      { shortcode: 'banana', url: 'https://example.com/banana.png' },
    ]);
    assert.deepStrictEqual(Object.keys(actual), ['apple', 'banana', 'cherry']);
  });

  it('should return an empty object for no emojis', () => {
    assert.deepStrictEqual(convertToSimpleEmojiPack([]), {});
  });

  it('should produce a pack which the import accepts', () => {
    const emojis = [
      { shortcode: 'smiley', url: 'https://example.com/smiley.png' },
      { shortcode: 'party-parrot', url: 'https://example.com/parrot.gif' },
      { shortcode: 'thumbs_up', url: 'https://example.com/thumbs_up.png' },
    ];
    const exported = JSON.stringify(convertToSimpleEmojiPack(emojis));
    const imported = convertToEmojiConfig(simpleEmojiPackSchema.parse(JSON.parse(exported)));

    assert.deepStrictEqual(
      Array.from(imported).sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
      Array.from(emojis).sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
    );
  });
});
