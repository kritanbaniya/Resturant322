/**
 * question classifier
 * determines if a question is about the restaurant or should go to llm
 */

/**
 * check if message is about the restaurant or menu
 * @param {string} text - the message text to classify
 * @returns {boolean} - true if restaurant-related, false otherwise
 */
export function isRestaurantQuestion(text) {
  const lower = text.toLowerCase();

  // exclude general knowledge questions and personal questions that should go to LLM
  // these patterns take precedence - if matched, it's NOT a restaurant question
  const generalKnowledgePatterns = [
    /^tell me a story$/i,
    /^tell me a (story|joke|tale)/i,
    /tell me (a|the) (story|joke|tale)/i,
    /^recommend a (movie|film|book|show|tv show)/i,
    /recommend (a|me) (movie|film|book|show)/i,
    /^explain (the|a) /i,
    /explain (the|a) (moon|python|programming|science|history|computer)/i,
    /^what is (python|programming|science|history|chemistry|physics)/i,
    /^how does (the|a) (moon|earth|computer|internet|phone)/i,
    /^what (is|are) (python|programming|science|history|chemistry|physics)/i
  ];

  // exclude personal/identity questions
  const personalQuestionPatterns = [
    /^what'?s? my name$/i,
    /^what is my name$/i,
    /^who am i$/i,
    /^what am i$/i
  ];

  // exclude memory-based questions that need conversation history
  // these should ALWAYS go to LLM with history, even if they contain restaurant keywords
  const memoryQuestionPatterns = [
    /what (did|do|does) (i|you|we) (ask|asked|say|said|tell|told|mention|mentioned|discuss|discussed)/i,
    /what (was|were) (i|you|we) (talking|discussing|saying|asking) (about|earlier|before)/i,
    /(earlier|before|previously|just now|a moment ago)/i,
    /what (did|do) (i|you) (ask|say|tell|mention) (about|earlier|before)/i,
    /(remind|remember|recall|recap) (me|us) (what|about)/i,
    /what (was|were) (that|this|it) (i|you|we) (asked|said|talked|discussed)/i,
    /(what|which) (food|dish|item|thing) (did|do) (i|you) (ask|mention|say|tell)/i,
    /(what|which) (food|dish|item|thing) (was|were) (i|you|we) (talking|discussing)/i
  ];

  // if it matches a general knowledge, personal, or memory pattern, it's NOT a restaurant question
  if (generalKnowledgePatterns.some((pattern) => pattern.test(text)) ||
      personalQuestionPatterns.some((pattern) => pattern.test(text)) ||
      memoryQuestionPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  const restaurantKeywords = [
    // basic restaurant terms
    'restaurant',
    'resturant',
    'restraunt',
    'menu',
    'dish',
    'dishes',
    'food',
    'serve',
    'serv',
    'sell',
    'sel',
    'cook',
    'cooking',
    'kitchen',
    
    // menu items
    'momo',
    'momoz',
    'mommos',
    'chow mein',
    'chowmein',
    'fried rice',
    'friedrice',
    'dal bhat',
    'dalbhat',
    'dhal bhat',
    'himalayan curry',
    'curry',
    'thukpa',
    'samosa',
    'samosas',
    'masala fries',
    'fries',
    
    // pricing
    'price',
    'prices',
    'cost',
    'costs',
    'how much',
    'cheap',
    'cheapest',
    'expensive',
    'priciest',
    'discount',
    'discounts',
    'fee',
    'fees',
    
    // hours and operations
    'hours',
    'hour',
    'open',
    'opening',
    'close',
    'closing',
    'breakfast',
    'lunch',
    'dinner',
    
    // location
    'address',
    'adrres',
    'adres',
    'where are you',
    'where is this',
    'where is the',
    'where is',
    'location',
    'locate',
    'zip',
    'zipcode',
    'postal code',
    'street',
    'city',
    'borough',
    'brooklyn',
    'queens',
    'manhattan',
    
    // dietary and ingredients
    'halal',
    'vegan',
    'vegetarian',
    'gluten',
    'dairy',
    'nut',
    'nuts',
    'allergy',
    'allergies',
    'allergen',
    'ingredient',
    'ingredients',
    'spice',
    'spices',
    'recipe',
    'recipes',
    'sauce',
    'sauces',
    'secret',
    'msg',
    'monosodium',
    'monosodium glutamate',
    'glutamate',
    'oil',
    'oils',
    'fry',
    'fried',
    'supplier',
    'suppliers',
    'source',
    'sourcing',
    'certification',
    'certified',
    'nutrition',
    'nutritional',
    'calorie',
    'calories',
    'protein',
    'carbs',
    'carbohydrates',
    
    // staff and ownership
    'chef',
    'chefs',
    'cook',
    'cooks',
    'owner',
    'owners',
    'ownership',
    'staff',
    'employee',
    'employees',
    'team',
    'workers',
    'payroll',
    'budget',
    
    // policies and services
    'reservation',
    'reservations',
    'book',
    'booking',
    'catering',
    'cater',
    'delivery',
    'deliver',
    'pickup',
    'pick up',
    'takeout',
    'take out',
    'order online',
    'online order',
    'refund',
    'refunds',
    'return',
    'returns',
    'policy',
    'policies',
    'cancellation',
    'cancel',
    
    // restaurant details
    'tables',
    'table',
    'seating',
    'seats',
    'capacity',
    'size',
    'big',
    'large',
    'small',
    'founded',
    'opened',
    'established',
    'history',
    'story',
    'best',
    'recommend',
    'recommendation',
    'popular',
    'favorite',
    'favourite'
  ];

  // direct keyword match
  if (restaurantKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  // context-aware: check for possessive pronouns + restaurant context
  const possessivePatterns = [
    // "your [restaurant term]" or "you [restaurant term]"
    /\b(your|you|ur)\s+(food|menu|dish|dishes|restaurant|kitchen|chef|chefs|owner|staff|ingredient|ingredients|spice|spices|recipe|recipes|sauce|sauces|oil|oils|supplier|suppliers|secret|best|recommendation|recommend|popular|favorite|favourite)\b/i,
    // "you use/cook/make [restaurant term]" or "[restaurant term] you use"
    /\b(your|you|ur)\s+(use|uses|using|fry|fries|fried|cook|cooks|cooking|make|makes|making|sell|sells|selling|serve|serves|serving|have|has|had)\b/i,
    // "what [restaurant term] do you use" - catches "what spices do you use"
    /\b(what|which)\s+(spice|spices|ingredient|ingredients|oil|oils|recipe|recipes|sauce|sauces|supplier|suppliers|secret|msg|monosodium)\s+(do|does|did)\s+(you|your|ur|they|the restaurant|the kitchen|the chef|the chefs|the staff)\s+(use|uses|using|make|makes|making|cook|cooks|cooking|have|has|had)\b/i,
    // "what do you use [restaurant term]" - catches "what do you use for cooking"
    /\b(what|which)\s+(do|does|did)\s+(you|your|ur|they|the restaurant|the kitchen|the chef|the chefs|the staff)\s+(use|uses|using|make|makes|making|cook|cooks|cooking|fry|fries|fried)\s+(for|in|with|to)\s+(food|dish|dishes|cooking|frying|making)\b/i,
    // "who supplies/supply/supplied [restaurant term]" - explicit pattern for supplier questions
    /\bwho\s+(supplies|supply|supplied)\s+(your|you|ur|the restaurant|the kitchen|the restaurant's|your restaurant's)\s+(meat|ingredients|food|supplies|produce|vegetables|fruits|seafood|chicken|beef|pork)\b/i,
    // general "what/which/how/who/when/where do you [action]" with restaurant context
    /\b(what|which|how|who|when|where)\s+(do|does|did|is|are|was|were)\s+(you|your|ur|the restaurant|the kitchen|the chef|the chefs|the staff)\s+(use|uses|using|make|makes|making|cook|cooks|cooking|sell|sells|selling|serve|serves|serving|have|has|had)\b/i
  ];

  if (possessivePatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return false;
}
