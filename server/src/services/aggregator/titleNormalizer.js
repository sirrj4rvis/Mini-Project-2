/**
 * Normalizes product titles specifically for optimal fuzzy matching.
 * Strips out noise words, special characters, and unifies spacing to prevent false negatives.
 */
function normalizeForMatching(title) {
  if (!title) return '';
  
  let normalized = title.toLowerCase();
  
  // Remove common ecommerce noise words that skew similarity scoring
  const noiseWords = ['buy', 'online', 'india', 'cheap', 'best', 'deal', 'offer', 'original', 'authentic', 'new', 'latest', 'refurbished', 'renewed'];
  const noisePattern = new RegExp(`\\b(${noiseWords.join('|')})\\b`, 'g');
  normalized = normalized.replace(noisePattern, '');

  // Remove brackets and their contents (often contains colors, RAM variants, or promotional text)
  normalized = normalized.replace(/\(.*?\)/g, '');
  normalized = normalized.replace(/\[.*?\]/g, '');

  // Replace special characters and punctuation with spaces
  normalized = normalized.replace(/[^a-z0-9\s-]/g, ' ');

  // Standardize spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extracts high-value tokens from a normalized title.
 * Used to give extreme weight to model numbers during matching.
 */
function extractKeyTokens(normalizedTitle) {
  const tokens = normalizedTitle.split(' ').filter(Boolean);
  
  // Tokens containing both letters and numbers (like G102, iPhone13, M1) 
  // are usually high-signal exact model identifiers.
  const alphaNumericTokens = tokens.filter(t => /[0-9]/.test(t) && /[a-z]/.test(t));
  
  return {
    baseTokens: tokens,
    highSignalTokens: alphaNumericTokens
  };
}

module.exports = { normalizeForMatching, extractKeyTokens };
