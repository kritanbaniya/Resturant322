/**
 * embeddings service
 * uses transformer.js for local embeddings (no api calls)
 */

import { pipeline } from '@xenova/transformers';

// lazy-loaded model
let embedder = null;

/**
 * get or load the embedding model
 * @returns {promise<object>} - embedding pipeline
 */
export async function getEmbedder() {
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
export async function embedText(text) {
  const emb = await (await getEmbedder())(text, {
    pooling: 'mean',
    normalize: true
  });

  // emb is a Tensor → convert to JS array
  return Array.from(emb.data);
}
