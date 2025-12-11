/**
 * vector search service
 * uses transformer.js for local embeddings (no api calls)
 * loads knowledge base from mongodb
 */

const { embedText } = require('./embeddings.js');
const KnowledgeBaseEntry = require('../../models/KnowledgeBase');

// cache for kb entries and embeddings
let kbEntries = null;
let kbEmbeddings = null;

/**
 * create searchable chunks from knowledge base
 * @param {object} kb - knowledge base object
 * @returns {array} - array of { text: string, metadata: object }
 */
function createKbChunks(kb) {
  const chunks = [];

  // restaurant info
  if (kb.restaurant) {
    const r = kb.restaurant;
    if (r.name) {
      chunks.push({
        text: `restaurant name: ${r.name}`,
        metadata: { type: 'restaurant', field: 'name', path: 'restaurant.name' }
      });
    }
    if (r.description) {
      chunks.push({
        text: `restaurant description: ${r.description}`,
        metadata: { type: 'restaurant', field: 'description', path: 'restaurant.description' }
      });
    }
    if (r.tagline) {
      chunks.push({
        text: `restaurant tagline: ${r.tagline}`,
        metadata: { type: 'restaurant', field: 'tagline', path: 'restaurant.tagline' }
      });
    }
  }

  // locations
  if (kb.locations && Array.isArray(kb.locations)) {
    kb.locations.forEach((loc, idx) => {
      if (loc.name) {
        chunks.push({
          text: `location name: ${loc.name}`,
          metadata: { type: 'location', field: 'name', path: `locations[${idx}].name`, location: loc }
        });
      }
      if (loc.address) {
        chunks.push({
          text: `location address: ${loc.address}`,
          metadata: { type: 'location', field: 'address', path: `locations[${idx}].address`, location: loc }
        });
      }
      if (loc.phone) {
        chunks.push({
          text: `location phone: ${loc.phone}`,
          metadata: { type: 'location', field: 'phone', path: `locations[${idx}].phone`, location: loc }
        });
      }
      if (loc.hours) {
        const hoursText = Object.entries(loc.hours).map(([day, time]) => `${day}: ${time}`).join(', ');
        chunks.push({
          text: `location hours: ${hoursText}`,
          metadata: { type: 'location', field: 'hours', path: `locations[${idx}].hours`, location: loc }
        });
      }
    });
  }

  // menu items
  if (kb.menu && kb.menu.categories) {
    Object.entries(kb.menu.categories).forEach(([category, items]) => {
      if (Array.isArray(items)) {
        items.forEach((item, idx) => {
          if (typeof item === 'string') {
            chunks.push({
              text: `menu item: ${item} category: ${category}`,
              metadata: {
                type: 'menu_item',
                field: 'name',
                path: `menu.categories.${category}[${idx}]`,
                category: category,
                item: { name: item }
              }
            });
          } else if (item && item.name) {
            let text = `menu item: ${item.name}`;
            if (item.description) text += ` description: ${item.description}`;
            if (item.approx_price) text += ` price: ${item.approx_price}`;
            if (item.best_seller) text += ` best seller`;
            if (item.spicy) text += ` spicy`;
            if (item.vegetarian) text += ` vegetarian`;
            
            chunks.push({
              text: text,
              metadata: {
                type: 'menu_item',
                field: 'full',
                path: `menu.categories.${category}[${idx}]`,
                category: category,
                item: item
              }
            });
          }
        });
      }
    });

    // signature dishes
    if (kb.menu.signature_dishes && Array.isArray(kb.menu.signature_dishes)) {
      const signatureList = kb.menu.signature_dishes.join(', ');
      chunks.push({
        text: `signature dishes best selling popular items: ${signatureList}`,
        metadata: {
          type: 'menu',
          field: 'signature_dishes',
          path: 'menu.signature_dishes',
          signatureDishes: kb.menu.signature_dishes
        }
      });
    }

    // menu overview
    if (kb.menu.categories) {
      const categories = Object.keys(kb.menu.categories);
      const categoryList = categories.join(', ');
      let overview = `menu items dishes food: We serve ${categoryList}.`;
      if (kb.menu.notes) overview += ` ${kb.menu.notes}`;
      if (kb.menu.signature_dishes) {
        overview += ` Our signature dishes include ${kb.menu.signature_dishes.join(', ')}.`;
      }
      
      chunks.push({
        text: overview,
        metadata: {
          type: 'menu',
          field: 'overview',
          path: 'menu',
          categories: categories
        }
      });
    }
  }

  // dining policies
  if (kb.dining_policies) {
    const dp = kb.dining_policies;
    if (dp.style) {
      chunks.push({
        text: `dining style: ${dp.style}`,
        metadata: { type: 'policy', field: 'style', path: 'dining_policies.style' }
      });
    }
    if (dp.reservations) {
      chunks.push({
        text: `reservations: ${dp.reservations}`,
        metadata: { type: 'policy', field: 'reservations', path: 'dining_policies.reservations' }
      });
    }
    if (dp.takeout !== undefined) {
      chunks.push({
        text: `takeout: ${dp.takeout ? 'yes' : 'no'}`,
        metadata: { type: 'policy', field: 'takeout', path: 'dining_policies.takeout' }
      });
    }
    if (dp.delivery !== undefined) {
      chunks.push({
        text: `delivery: ${dp.delivery ? 'yes' : 'no'}`,
        metadata: { type: 'policy', field: 'delivery', path: 'dining_policies.delivery' }
      });
    }
  }

  // allergy info
  if (kb.allergy_info) {
    if (kb.allergy_info.common_allergens && Array.isArray(kb.allergy_info.common_allergens)) {
      const allergens = kb.allergy_info.common_allergens.join(', ');
      chunks.push({
        text: `allergens: ${allergens}`,
        metadata: { type: 'allergy', field: 'allergens', path: 'allergy_info.common_allergens' }
      });
    }
  }

  // faq
  if (kb.faq && Array.isArray(kb.faq)) {
    kb.faq.forEach((faq, idx) => {
      if (faq.question && faq.answer) {
        chunks.push({
          text: `faq question: ${faq.question} answer: ${faq.answer}`,
          metadata: {
            type: 'faq',
            field: 'qa',
            path: `faq[${idx}]`,
            question: faq.question,
            faq: faq
          }
        });
      }
    });
  }

  return chunks;
}

/**
 * calculate cosine similarity between two vectors
 * @param {array} vecA - first vector
 * @param {array} vecB - second vector
 * @returns {number} - cosine similarity score (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * initialize kb from mongodb (call once at startup)
 * loads all knowledge base entries with their embeddings
 */
async function initializeKb() {
  try {
    console.log('[vectorSearch] loading knowledge base from mongodb...');
    kbEntries = await KnowledgeBaseEntry.find({ embedding: { $exists: true, $ne: null } });
    console.log(`[vectorSearch] loaded ${kbEntries.length} kb entries from mongodb`);

    kbEmbeddings = [];
    for (let i = 0; i < kbEntries.length; i++) {
      const entry = kbEntries[i];
      if (entry.embedding && Array.isArray(entry.embedding) && entry.embedding.length > 0) {
        kbEmbeddings.push(entry.embedding);
      } else {
        // generate embedding if missing
        console.log(`[vectorSearch] generating missing embedding for entry ${i}...`);
        try {
          const embedding = await embedText(entry.questionText);
          entry.embedding = embedding;
          await entry.save();
          kbEmbeddings.push(embedding);
        } catch (error) {
          console.error(`[vectorSearch] failed to generate embedding:`, error.message);
          kbEmbeddings.push(new Array(384).fill(0));
        }
      }
    }
    console.log('[vectorSearch] kb initialization complete');
  } catch (error) {
    console.error('[vectorSearch] failed to initialize kb from mongodb:', error.message);
    kbEntries = [];
    kbEmbeddings = [];
  }
}

/**
 * search kb using vector similarity
 * @param {string} query - user query
 * @param {number} topK - number of top results to return (default: 3)
 * @param {number} minScore - minimum similarity score threshold (default: 0.3)
 * @returns {promise<array>} - array of { text, metadata, score, kbEntryId, answerText } sorted by score, filtered by threshold
 */
async function searchKb(query, topK = 3, minScore = 0.3) {
  if (!kbEntries || !kbEmbeddings || kbEntries.length === 0) {
    console.warn('[vectorSearch] kb not initialized, returning empty results');
    return [];
  }

  try {
    // get query embedding using transformer.js
    const queryEmbedding = await embedText(query);
    
    // calculate similarities
    const results = [];
    for (let i = 0; i < kbEntries.length; i++) {
      const entry = kbEntries[i];
      const similarity = cosineSimilarity(queryEmbedding, kbEmbeddings[i]);
      results.push({
        text: entry.questionText,
        answerText: entry.answerText,
        metadata: entry.metadata || {},
        score: similarity,
        kbEntryId: entry._id.toString()
      });
    }

    // sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // filter by minimum score threshold and return top K
    const filtered = results.filter(r => r.score >= minScore);
    return filtered.slice(0, topK);
  } catch (error) {
    console.error('[vectorSearch] search error:', error.message);
    return [];
  }
}

/**
 * format kb chunk into answer text
 * @param {object} chunk - chunk from searchKb result (now includes answerText directly)
 * @returns {string} - formatted answer
 */
function formatKbAnswer(chunk) {
  // use answerText directly from mongodb entry
  if (chunk.answerText) {
    return chunk.answerText;
  }
  
  // fallback to text if answerText not available
  return chunk.text || '';
}

module.exports = { initializeKb, searchKb, formatKbAnswer, createKbChunks };
