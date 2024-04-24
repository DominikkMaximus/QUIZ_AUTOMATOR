/**
 * VectorDB class for storing and retrieving vectors based on cosine similarity
 */
class VectorDB {
    /**
     * Create a new VectorDB
     * @param {Array} database - Initial database
     */
    constructor(database = []) {
      this.database = database || [];
    }
  
    /**
     * Calculate the dot product of two vectors
     * @param {Array<number>} a - First vector
     * @param {Array<number>} b - Second vector
     * @returns {number} Dot product
     */
    dotProduct(a, b) {
      return a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
    }
  
    /**
     * Calculate the magnitude of a vector
     * @param {Array<number>} a - Vector
     * @returns {number} Magnitude
     */
    magnitude(a) {
      return Math.sqrt(a.map((x) => x * x).reduce((m, n) => m + n));
    }
  
    /**
     * Calculate the cosine similarity between two vectors
     * @param {Array<number>} a - First vector
     * @param {Array<number>} b - Second vector
     * @returns {number} Cosine similarity
     */
    cosineSimilarity(a, b) {
      return this.dotProduct(a, b) / (this.magnitude(a) * this.magnitude(b));
    }
  
    /**
     * Store a vector and associated data in the database
     * @param {Array<number>} vector - Vector
     * @param {*} data - Associated data
     */
    store(vector, data) {
      this.database.push({ vector, data });
    }
  
    /**
     * Retrieve the topN items from the database that are most similar to the query vector
     * @param {Array<number>} queryVector - Query vector
     * @param {number} topN - Number of top items to retrieve
     * @returns {Array} TopN items
     */
    retrieve(queryVector, topN = 10) {
      let similarities = this.database.map((item) => ({
        similarity: this.cosineSimilarity(queryVector, item.vector),
        data: item.data,
      }));
  
      // Sort by similarity in descending order and take the topN items
      similarities.sort((a, b) => b.similarity - a.similarity);
      similarities = similarities.slice(0, topN);
  
      return similarities;
    }
  }
  
  module.exports = { VectorDB };
  