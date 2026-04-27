import Fuse from 'fuse.js';

/**
 * Normalizes text by removing accents and converting to lowercase.
 */
export const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

/**
 * Performs a fuzzy search on a list of items.
 * @param items The list of items to search.
 * @param searchTerm The term to search for.
 * @param keys The keys in the items to search against.
 * @returns The filtered list of items.
 */
export const fuzzySearch = <T>(
  items: T[],
  searchTerm: string,
  keys: string[]
): T[] => {
  if (!searchTerm) return items;

  // Normalize search term
  const normalizedSearch = normalizeText(searchTerm);

  // If the items have a lot of text, we might want to normalize them too,
  // but Fuse.js handles most things. However, for "sem acento", 
  // we can provide a custom getFn to Fuse.js.

  const options = {
    keys,
    threshold: 0.3, // Lower is stricter, higher is more fuzzy (0.0 to 1.0)
    ignoreLocation: true,
    getFn: (obj: any, key: string | string[]) => {
      const value = Fuse.config.getFn(obj, key);
      if (typeof value === 'string') {
        return normalizeText(value);
      }
      return value;
    }
  };

  const fuse = new Fuse(items, options);
  const results = fuse.search(normalizedSearch);

  return results.map(result => result.item);
};
