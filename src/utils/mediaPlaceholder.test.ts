import assert from 'assert';

import { describe, it } from 'vitest';

import { replacePlaceholders } from '@/utils/mediaPlaceholder';

const urls: Record<string, string> = {
  image1: 'https://example.com/1.png',
  image2: 'https://example.com/2.png',
  video1: 'https://example.com/1.mp4',
};
const urlOf = (label: string) => urls[label];

describe('replacePlaceholders', () => {
  it('should separate a URL from the text next to it by spaces', () => {
    assert.strictEqual(
      replacePlaceholders('test[image1]abc', urlOf),
      'test https://example.com/1.png abc',
    );
  });

  it('should not add spaces where there are already', () => {
    assert.strictEqual(
      replacePlaceholders('a [image1]\nb', urlOf),
      'a https://example.com/1.png\nb',
    );
    assert.strictEqual(replacePlaceholders('[video1]', urlOf), 'https://example.com/1.mp4');
  });

  it('should put a single space between adjacent placeholders', () => {
    assert.strictEqual(
      replacePlaceholders('[image1][image2]', urlOf),
      'https://example.com/1.png https://example.com/2.png',
    );
  });

  it('should keep unknown placeholders as they are', () => {
    assert.strictEqual(replacePlaceholders('x[image9]y', urlOf), 'x[image9]y');
    assert.strictEqual(
      replacePlaceholders('[image3]', () => undefined),
      '[image3]',
    );
  });
});
