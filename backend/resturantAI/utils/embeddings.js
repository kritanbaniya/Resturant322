/**
 * embeddings service
 * uses transformer.js for local embeddings (no api calls)
 */

const { pipeline } = require('@xenova/transformers');

// lazy-loaded model
let embedder = null;

/**
 * get or load the embedding model
 * @returns {promise<object>} - embedding pipeline
 */
async function getEmbedder() {
  if (!embedder) {
    console.log('[embeddings] loading sentence-transformer model...');
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
    console.log('[embeddings] model ready');
  }
  return embedder;
}

/**
 * embed text into a vector
 * @param {string} text - text to embed
 * @returns {promise<array>} - embedding vector (384 dimensions)
 */
async function embedText(text) {
  if (!text || !text.trim()) {
    return new Array(384).fill(0);
  }
  
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  
  // convert tensor to array
  return Array.from(output.data);
}

module.exports = { getEmbedder, embedText };
