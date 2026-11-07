/**
 * Replaces each item of next with an equal item of prev, if any.
 *
 * <For> tells items apart by reference and creates the DOM of the items it does not know.
 * Reusing the items keeps the DOM of the unchanged ones when a new array comes.
 * An item of prev is used only once, so that the items in the result stay distinct.
 */
const reuseUnchangedItems = <T>(prev: readonly T[], next: T[]): T[] => {
  if (prev.length === 0) return next;

  const unused = new Map<string, T[]>();
  prev.forEach((item) => {
    const key = JSON.stringify(item);
    const items = unused.get(key);
    if (items != null) {
      items.push(item);
    } else {
      unused.set(key, [item]);
    }
  });

  return next.map((item) => unused.get(JSON.stringify(item))?.shift() ?? item);
};

export default reuseUnchangedItems;
