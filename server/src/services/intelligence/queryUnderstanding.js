const TypoCorrectionEngine = require('./typoCorrectionEngine');
const CategoryIntentDetector = require('./categoryIntentDetector');

/**
 * Natural Language Query Understanding Pipeline.
 * Transforms a raw, unstructured user query into a structured context object
 * that the downstream aggregators and rankers can understand.
 */
class QueryUnderstanding {
  /**
   * Processes a raw search query string into an intelligent intent context.
   * @param {string} rawQuery 
   */
  static analyze(rawQuery) {
    // 1. Correct spelling and map synonyms
    const correctedQuery = TypoCorrectionEngine.process(rawQuery);
    
    // 2. Extract semantic intent (budget, gaming, category, etc.)
    const intent = CategoryIntentDetector.detect(correctedQuery);

    // 3. Generate a "Clean Search Query" to pass to the APIs
    // Strips out intent modifiers so APIs don't get confused (e.g. searching "cheap laptop" on Amazon often fails compared to just "laptop")
    const stopWords = ['cheap', 'budget', 'premium', 'best', 'top', 'buy', 'online'];
    const searchTokens = correctedQuery.split(/\s+/).filter(token => !stopWords.includes(token));
    const cleanSearchQuery = searchTokens.join(' ');

    return {
      originalQuery: rawQuery,
      correctedQuery: correctedQuery,
      cleanSearchQuery: cleanSearchQuery, // <-- Pass THIS to the Scrapers
      intent: intent
    };
  }
}

module.exports = QueryUnderstanding;
