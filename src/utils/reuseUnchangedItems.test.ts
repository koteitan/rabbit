import assert from 'assert';

import { describe, it } from 'vitest';

import parseTextNote from '@/nostr/parseTextNote';
import reuseUnchangedItems from '@/utils/reuseUnchangedItems';

describe('reuseUnchangedItems', () => {
  it('should reuse an equal item of prev', () => {
    const prev = [{ id: 1 }, { id: 2 }];
    const actual = reuseUnchangedItems(prev, [{ id: 3 }, { id: 2 }]);
    assert.deepStrictEqual(actual, [{ id: 3 }, { id: 2 }]);
    assert.strictEqual(actual[1], prev[1]);
  });

  it('should keep the items distinct when the same item appears twice', () => {
    const prev = [{ id: 1 }];
    const actual = reuseUnchangedItems(prev, [{ id: 1 }, { id: 1 }]);
    assert.deepStrictEqual(actual, [{ id: 1 }, { id: 1 }]);
    assert.strictEqual(actual[0], prev[0]);
    assert.notStrictEqual(actual[1], prev[0]);
  });

  it('should return next as it is when prev is empty', () => {
    const next = [{ id: 1 }];
    assert.strictEqual(reuseUnchangedItems([], next), next);
  });

  it('should keep the URL node when the text around it is edited', () => {
    const prev = parseTextNote('abc https://x.com/a/status/1 def');
    const actual = reuseUnchangedItems(prev, parseTextNote('abcd https://x.com/a/status/1 def'));
    assert.strictEqual(actual[1].type, 'URL');
    assert.strictEqual(actual[1], prev[1]);
    assert.notStrictEqual(actual[0], prev[0]);
  });
});
