/**
 * semantic search service
 * uses tf-idf and cosine similarity for kb queries
 */

import natural from 'natural';
const { TfIdf } = natural;

/**
 * create searchable index from knowledge base
 * @param {object} kb - knowledge base object
 * @returns {object} - indexed kb with searchable documents
 */
export function createKbIndex(kb) {
  const documents = [];
  const metadata = [];

  // index restaurant info
  if (kb.restaurant) {
    const r = kb.restaurant;
    if (r.name) {
      documents.push(`restaurant name: ${r.name}`);
      metadata.push({ type: 'restaurant', field: 'name', path: 'restaurant.name', value: r.name });
    }
    if (r.description) {
      documents.push(`restaurant description: ${r.description}`);
      metadata.push({ type: 'restaurant', field: 'description', path: 'restaurant.description', value: r.description });
    }
    if (r.tagline) {
      documents.push(`restaurant tagline: ${r.tagline}`);
      metadata.push({ type: 'restaurant', field: 'tagline', path: 'restaurant.tagline', value: r.tagline });
    }
    if (r.established) {
      documents.push(`restaurant established: ${r.established}`);
      metadata.push({ type: 'restaurant', field: 'established', path: 'restaurant.established', value: r.established });
    }
  }

  // index locations
  if (kb.locations && Array.isArray(kb.locations)) {
    kb.locations.forEach((loc, idx) => {
      if (loc.name) {
        documents.push(`location name: ${loc.name}`);
        metadata.push({ type: 'location', field: 'name', path: `locations[${idx}].name`, value: loc.name, location: loc });
      }
      if (loc.address) {
        documents.push(`location address: ${loc.address}`);
        metadata.push({ type: 'location', field: 'address', path: `locations[${idx}].address`, value: loc.address, location: loc });
      }
      if (loc.neighborhood) {
        documents.push(`location neighborhood: ${loc.neighborhood}`);
        metadata.push({ type: 'location', field: 'neighborhood', path: `locations[${idx}].neighborhood`, value: loc.neighborhood, location: loc });
      }
      if (loc.phone) {
        documents.push(`location phone: ${loc.phone}`);
        metadata.push({ type: 'location', field: 'phone', path: `locations[${idx}].phone`, value: loc.phone, location: loc });
      }
      if (loc.hours) {
        const hoursText = Object.entries(loc.hours).map(([day, time]) => `${day}: ${time}`).join(', ');
        documents.push(`location hours: ${hoursText}`);
        metadata.push({ type: 'location', field: 'hours', path: `locations[${idx}].hours`, value: hoursText, location: loc });
      }
    });
  }

  // index dining policies
  if (kb.dining_policies) {
    const dp = kb.dining_policies;
    if (dp.style) {
      documents.push(`dining style: ${dp.style}`);
      metadata.push({ type: 'policy', field: 'style', path: 'dining_policies.style', value: dp.style });
    }
    if (dp.dress_code) {
      documents.push(`dress code: ${dp.dress_code}`);
      metadata.push({ type: 'policy', field: 'dress_code', path: 'dining_policies.dress_code', value: dp.dress_code });
    }
    if (dp.reservations) {
      documents.push(`reservations: ${dp.reservations}`);
      metadata.push({ type: 'policy', field: 'reservations', path: 'dining_policies.reservations', value: dp.reservations });
    }
    if (dp.takeout !== undefined) {
      documents.push(`takeout: ${dp.takeout ? 'yes' : 'no'}`);
      metadata.push({ type: 'policy', field: 'takeout', path: 'dining_policies.takeout', value: dp.takeout });
    }
    if (dp.delivery !== undefined) {
      documents.push(`delivery: ${dp.delivery ? 'yes' : 'no'}`);
      metadata.push({ type: 'policy', field: 'delivery', path: 'dining_policies.delivery', value: dp.delivery });
    }
    if (dp.large_parties) {
      if (dp.large_parties.group_accommodations) {
        documents.push(`large parties: ${dp.large_parties.group_accommodations}`);
        metadata.push({ type: 'policy', field: 'large_parties', path: 'dining_policies.large_parties.group_accommodations', value: dp.large_parties.group_accommodations });
      }
      if (dp.large_parties.recommended_notice) {
        documents.push(`large party notice: ${dp.large_parties.recommended_notice}`);
        metadata.push({ type: 'policy', field: 'large_parties_notice', path: 'dining_policies.large_parties.recommended_notice', value: dp.large_parties.recommended_notice });
      }
    }
  }

  // index cuisine info
  if (kb.cuisine) {
    if (kb.cuisine.type) {
      documents.push(`cuisine type: ${kb.cuisine.type}`);
      metadata.push({ type: 'cuisine', field: 'type', path: 'cuisine.type', value: kb.cuisine.type });
    }
    if (kb.cuisine.special_features && Array.isArray(kb.cuisine.special_features)) {
      const features = kb.cuisine.special_features.join(', ');
      documents.push(`cuisine features: ${features}`);
      metadata.push({ type: 'cuisine', field: 'special_features', path: 'cuisine.special_features', value: features });
    }
  }

  // index menu items
  if (kb.menu && kb.menu.categories) {
    Object.entries(kb.menu.categories).forEach(([category, items]) => {
      if (Array.isArray(items)) {
        items.forEach((item, idx) => {
          if (typeof item === 'string') {
            // simple string item (like sides)
            documents.push(`menu item: ${item} category: ${category}`);
            metadata.push({ 
              type: 'menu_item', 
              field: 'name', 
              path: `menu.categories.${category}[${idx}]`, 
              value: item,
              category: category,
              item: { name: item }
            });
          } else if (item && item.name) {
            // object with name and description
            const itemText = `menu item: ${item.name}`;
            let fullText = itemText;
            
            if (item.description) {
              fullText += ` description: ${item.description}`;
            }
            if (item.approx_price) {
              fullText += ` price: ${item.approx_price}`;
            }
            
            documents.push(fullText);
            metadata.push({ 
              type: 'menu_item', 
              field: 'full', 
              path: `menu.categories.${category}[${idx}]`, 
              value: item.name,
              category: category,
              item: item
            });
          }
        });
      }
    });

    // index signature dishes (with synonyms for better matching)
    if (kb.menu.signature_dishes && Array.isArray(kb.menu.signature_dishes)) {
      kb.menu.signature_dishes.forEach((dish) => {
        // add multiple variations for better semantic matching
        documents.push(`signature dish: ${dish}`);
        documents.push(`best selling dish: ${dish}`);
        documents.push(`popular dish: ${dish}`);
        documents.push(`recommended dish: ${dish}`);
        documents.push(`favorite dish: ${dish}`);
        metadata.push({ 
          type: 'menu_item', 
          field: 'signature', 
          path: 'menu.signature_dishes', 
          value: dish 
        });
        metadata.push({ 
          type: 'menu_item', 
          field: 'signature', 
          path: 'menu.signature_dishes', 
          value: dish 
        });
        metadata.push({ 
          type: 'menu_item', 
          field: 'signature', 
          path: 'menu.signature_dishes', 
          value: dish 
        });
        metadata.push({ 
          type: 'menu_item', 
          field: 'signature', 
          path: 'menu.signature_dishes', 
          value: dish 
        });
        metadata.push({ 
          type: 'menu_item', 
          field: 'signature', 
          path: 'menu.signature_dishes', 
          value: dish 
        });
      });
      
      // also add a general answer about signature dishes
      const signatureList = kb.menu.signature_dishes.join(', ');
      documents.push(`signature dishes best selling popular items: ${signatureList}`);
      metadata.push({ 
        type: 'menu', 
        field: 'signature_dishes_summary', 
        path: 'menu.signature_dishes', 
        value: `Our signature dishes include: ${signatureList}.`,
        signatureDishes: kb.menu.signature_dishes
      });
    }

    // index menu overview - comprehensive summary for "what's in the menu" queries
    if (kb.menu && kb.menu.categories) {
      const categories = Object.keys(kb.menu.categories);
      const categoryList = categories.join(', ');
      
      // create a comprehensive menu overview
      let menuOverview = `menu items dishes food: We serve ${categoryList}. `;
      if (kb.menu.notes) {
        menuOverview += kb.menu.notes + ' ';
      }
      
      // add signature dishes to overview
      if (kb.menu.signature_dishes && Array.isArray(kb.menu.signature_dishes)) {
        menuOverview += `Our signature dishes include ${kb.menu.signature_dishes.join(', ')}. `;
      }
      
      // add cuisine type
      if (kb.cuisine && kb.cuisine.type) {
        menuOverview += `We specialize in ${kb.cuisine.type} cuisine. `;
      }
      
      // index multiple variations for better matching
      documents.push(menuOverview.trim());
      documents.push(`what's in the menu what do you serve: ${menuOverview.trim()}`);
      documents.push(`menu food dishes items: ${menuOverview.trim()}`);
      documents.push(`what food do you have: ${menuOverview.trim()}`);
      
      const overviewAnswer = `We serve ${categoryList}. ${kb.menu.notes || ''} Our signature dishes include ${kb.menu.signature_dishes?.join(', ') || 'various Italian favorites'}.`;
      
      metadata.push({ 
        type: 'menu', 
        field: 'overview', 
        path: 'menu', 
        value: overviewAnswer.trim(),
        categories: categories
      });
      metadata.push({ 
        type: 'menu', 
        field: 'overview', 
        path: 'menu', 
        value: overviewAnswer.trim(),
        categories: categories
      });
      metadata.push({ 
        type: 'menu', 
        field: 'overview', 
        path: 'menu', 
        value: overviewAnswer.trim(),
        categories: categories
      });
      metadata.push({ 
        type: 'menu', 
        field: 'overview', 
        path: 'menu', 
        value: overviewAnswer.trim(),
        categories: categories
      });
    }

    // index menu notes
    if (kb.menu.notes) {
      documents.push(`menu notes: ${kb.menu.notes}`);
      metadata.push({ type: 'menu', field: 'notes', path: 'menu.notes', value: kb.menu.notes });
    }
    if (kb.menu.price_range) {
      documents.push(`menu price range: ${kb.menu.price_range}`);
      metadata.push({ type: 'menu', field: 'price_range', path: 'menu.price_range', value: kb.menu.price_range });
    }
  }

  // index allergy info
  if (kb.allergy_info) {
    if (kb.allergy_info.common_allergens && Array.isArray(kb.allergy_info.common_allergens)) {
      const allergens = kb.allergy_info.common_allergens.join(', ');
      documents.push(`allergens: ${allergens}`);
      metadata.push({ type: 'allergy', field: 'allergens', path: 'allergy_info.common_allergens', value: allergens });
    }
    if (kb.allergy_info.notes && Array.isArray(kb.allergy_info.notes)) {
      kb.allergy_info.notes.forEach((note, idx) => {
        documents.push(`allergy note: ${note}`);
        metadata.push({ type: 'allergy', field: 'note', path: `allergy_info.notes[${idx}]`, value: note });
      });
    }
  }

  // index reservations
  if (kb.reservations) {
    const r = kb.reservations;
    if (r.accepted !== undefined) {
      documents.push(`reservations accepted: ${r.accepted ? 'yes' : 'no'}`);
      metadata.push({ type: 'reservation', field: 'accepted', path: 'reservations.accepted', value: r.accepted });
    }
    if (r.recommended !== undefined) {
      documents.push(`reservations recommended: ${r.recommended ? 'yes' : 'no'}`);
      metadata.push({ type: 'reservation', field: 'recommended', path: 'reservations.recommended', value: r.recommended });
    }
    if (r.methods && Array.isArray(r.methods)) {
      const methods = r.methods.join(', ');
      documents.push(`reservation methods: ${methods}`);
      metadata.push({ type: 'reservation', field: 'methods', path: 'reservations.methods', value: methods });
    }
    if (r.large_groups) {
      if (r.large_groups.supports_private_events !== undefined) {
        documents.push(`private events: ${r.large_groups.supports_private_events ? 'yes' : 'no'}`);
        metadata.push({ type: 'reservation', field: 'private_events', path: 'reservations.large_groups.supports_private_events', value: r.large_groups.supports_private_events });
      }
      if (r.large_groups.event_types && Array.isArray(r.large_groups.event_types)) {
        const events = r.large_groups.event_types.join(', ');
        documents.push(`event types: ${events}`);
        metadata.push({ type: 'reservation', field: 'event_types', path: 'reservations.large_groups.event_types', value: events });
      }
    }
  }

  // index ordering info
  if (kb.ordering) {
    if (kb.ordering.takeout !== undefined) {
      documents.push(`takeout available: ${kb.ordering.takeout ? 'yes' : 'no'}`);
      metadata.push({ type: 'ordering', field: 'takeout', path: 'ordering.takeout', value: kb.ordering.takeout });
    }
    if (kb.ordering.delivery !== undefined) {
      documents.push(`delivery available: ${kb.ordering.delivery ? 'yes' : 'no'}`);
      metadata.push({ type: 'ordering', field: 'delivery', path: 'ordering.delivery', value: kb.ordering.delivery });
    }
    if (kb.ordering.platforms && Array.isArray(kb.ordering.platforms)) {
      const platforms = kb.ordering.platforms.join(', ');
      documents.push(`ordering platforms: ${platforms}`);
      metadata.push({ type: 'ordering', field: 'platforms', path: 'ordering.platforms', value: platforms });
    }
  }

  // index faq
  if (kb.faq && Array.isArray(kb.faq)) {
    kb.faq.forEach((faq, idx) => {
      if (faq.question && faq.answer) {
        documents.push(`faq question: ${faq.question} answer: ${faq.answer}`);
        metadata.push({ 
          type: 'faq', 
          field: 'qa', 
          path: `faq[${idx}]`, 
          value: faq.answer,
          question: faq.question,
          faq: faq
        });
      }
    });
  }

  // index synonyms (for better matching)
  if (kb.synonyms) {
    Object.entries(kb.synonyms).forEach(([key, synonyms]) => {
      if (Array.isArray(synonyms)) {
        const synText = synonyms.join(', ');
        documents.push(`${key} synonyms: ${synText}`);
        metadata.push({ type: 'synonym', field: key, path: `synonyms.${key}`, value: synText });
      }
    });
  }

  return { documents, metadata };
}

/**
 * search knowledge base using semantic similarity
 * @param {string} query - user query
 * @param {object} kb - knowledge base object
 * @param {number} threshold - minimum similarity score (0-1, default 0.1)
 * @param {number} maxResults - maximum number of results (default 5)
 * @returns {array} - array of { score, metadata, answer } sorted by score
 */
export function searchKb(query, kb, threshold = 0.1, maxResults = 5) {
  if (!query || !kb) return [];

  const { documents, metadata } = createKbIndex(kb);
  
  if (documents.length === 0) return [];

  // create tf-idf index
  const tfidf = new TfIdf();
  documents.forEach(doc => tfidf.addDocument(doc));

  // calculate similarity scores
  const results = [];
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  
  documents.forEach((doc, docIndex) => {
    let score = 0;
    let matchedTerms = 0;

    queryTerms.forEach(term => {
      const termScore = tfidf.tfidf(term, docIndex);
      if (termScore > 0) {
        score += termScore;
        matchedTerms++;
      }
    });

    // normalize score by query length and document length
    if (matchedTerms > 0) {
      const normalizedScore = score / (queryTerms.length * Math.log(documents.length + 1));
      
      if (normalizedScore >= threshold) {
        const meta = metadata[docIndex];
        let answer = '';

        // generate answer based on metadata type
        if (meta.type === 'menu_item' && meta.item) {
          const item = meta.item;
          answer = item.name;
          if (item.description) {
            answer += `: ${item.description}`;
          }
          if (item.approx_price) {
            answer += ` Price: ${item.approx_price}`;
          }
        } else if (meta.type === 'menu' && meta.field === 'overview' && meta.value) {
          // handle menu overview
          answer = meta.value;
        } else if (meta.type === 'menu' && meta.field === 'signature_dishes_summary' && meta.signatureDishes) {
          // handle signature dishes summary
          answer = meta.value || `Our signature dishes include: ${meta.signatureDishes.join(', ')}.`;
        } else if (meta.type === 'menu_item' && meta.field === 'signature' && meta.value) {
          // handle individual signature dish
          answer = meta.value;
          // try to find full item details
          if (kb.menu && kb.menu.categories) {
            for (const category of Object.values(kb.menu.categories)) {
              if (Array.isArray(category)) {
                const found = category.find(item => 
                  item && typeof item === 'object' && item.name === meta.value
                );
                if (found) {
                  answer = found.name;
                  if (found.description) answer += `: ${found.description}`;
                  if (found.approx_price) answer += ` Price: ${found.approx_price}`;
                  break;
                }
              }
            }
          }
        } else if (meta.type === 'location' && meta.location) {
          const loc = meta.location;
          if (meta.field === 'address') {
            answer = loc.address;
            if (loc.name) answer = `${loc.name}: ${loc.address}`;
          } else if (meta.field === 'hours') {
            const hoursText = Object.entries(loc.hours || {}).map(([day, time]) => `${day}: ${time}`).join(', ');
            answer = hoursText;
          } else if (meta.field === 'phone') {
            answer = loc.phone;
          } else {
            answer = meta.value || '';
          }
        } else if (meta.type === 'faq' && meta.faq) {
          answer = meta.faq.answer;
        } else {
          answer = meta.value || '';
        }

        results.push({
          score: normalizedScore,
          metadata: meta,
          answer: answer.trim()
        });
      }
    }
  });

  // sort by score descending and return top results
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

/**
 * find best kb answer for a query
 * @param {string} query - user query
 * @param {object} kb - knowledge base object
 * @param {number} minScore - minimum score threshold (default 0.5)
 * @returns {object|null} - { answer, kbItem, score } or null if no good match
 */
export function getBestKbAnswer(query, kb, minScore = 0.5) {
  const results = searchKb(query, kb, 0.05, 10);
  
  if (results.length === 0) return null;

  const best = results[0];
  
  // only return if score meets minimum threshold
  if (best.score < minScore) return null;

  // construct kbItem path
  let kbItem = best.metadata.path || 'unknown';
  
  return {
    answer: best.answer,
    kbItem: kbItem,
    score: best.score,
    metadata: best.metadata
  };
}
