export const placeholderRegex = /\[((?:image|video)\d+)\]/g;
export const placeholderOf = (label: string) => `[${label}]`;

// replaces placeholders with URLs. a URL needs spaces around it, or the text next to it is
// read as a part of the URL
export const replacePlaceholders = (
  text: string,
  urlOf: (label: string) => string | undefined,
): string => {
  // split with a capturing group: even indices are text, odd indices are labels
  const parts = text.split(new RegExp(placeholderRegex.source));
  let result = '';
  let afterUrl = false;
  parts.forEach((part, i) => {
    const url = i % 2 === 1 ? urlOf(part) : undefined;
    const piece = i % 2 === 1 ? (url ?? placeholderOf(part)) : part;
    if (piece === '') return;
    const needsSpace =
      (url != null && result !== '' && !/\s$/.test(result)) || (afterUrl && !/^\s/.test(piece));
    result += `${needsSpace ? ' ' : ''}${piece}`;
    afterUrl = url != null;
  });
  return result;
};
