// comprehensive normalization and typo correction
// goal: fix common chat typos and restaurant-specific misspellings without breaking general questions

export function normalizeMessage(text) {
    if (!text) return '';
  
    // basic cleanup
    let out = text.trim();
  
    // collapse multiple spaces
    out = out.replace(/\s+/g, ' ');
  
    // work in lowercase for replacements
    const lower = out.toLowerCase();
    let fixed = lower;
  
    // ============================================
    // phrase patterns first (before individual word replacements)
    // ============================================
    // handle full phrase patterns before replacing individual words like "u" → "you"
    // this ensures "wut food u hav" is caught before "u" becomes "you"
    
    // specific restaurant question patterns with typos - MUST be before individual word replacements
    // use flexible spacing patterns to catch variations
    fixed = fixed.replace(/wut\s+food\s+(u|you)\s+hav(\s|$)/g, 'what food do you have ');
    fixed = fixed.replace(/wut\s+food\s+(u|you)\s+have(\s|$)/g, 'what food do you have ');
    fixed = fixed.replace(/wat\s+food\s+(u|you)\s+hav(\s|$)/g, 'what food do you have ');
    fixed = fixed.replace(/wat\s+food\s+(u|you)\s+have(\s|$)/g, 'what food do you have ');
    fixed = fixed.replace(/what\s+food\s+(u|you)\s+hav(\s|$)/g, 'what food do you have ');
    
    // also handle without spaces (though less common)
    fixed = fixed.replace(/wutfood\s*(u|you)\s*hav(\s|$)/g, 'what food do you have ');
    fixed = fixed.replace(/watfood\s*(u|you)\s*hav(\s|$)/g, 'what food do you have ');
    
    // trim any extra spaces we might have added
    fixed = fixed.trim();
    
    // common restaurant question patterns - also before individual replacements
    fixed = fixed.replace(/\bdo u\b/g, 'do you');
    fixed = fixed.replace(/\bcan u\b/g, 'can you');
    fixed = fixed.replace(/\bwill u\b/g, 'will you');
    fixed = fixed.replace(/\bis ur\b/g, 'is your');
    fixed = fixed.replace(/\bare ur\b/g, 'are your');
    fixed = fixed.replace(/\bwhats ur\b/g, 'what is your');
    fixed = fixed.replace(/\bwhats ur\b/g, 'what\'s your');
    fixed = fixed.replace(/\bwhats your\b/g, 'what is your');
    fixed = fixed.replace(/\bwhats your\b/g, 'what\'s your');
    fixed = fixed.replace(/\bwhere r u\b/g, 'where are you');
    fixed = fixed.replace(/\bwhere r u located\b/g, 'where are you located');
  
    // ============================================
    // restaurant-specific typos (individual words)
    // ============================================
    
    // restaurant variations
    fixed = fixed.replace(/\bresturant\b/g, 'restaurant');
    fixed = fixed.replace(/\brestraunt\b/g, 'restaurant');
    fixed = fixed.replace(/\brestaraunt\b/g, 'restaurant');
    fixed = fixed.replace(/\brestaraunt\b/g, 'restaurant');
    fixed = fixed.replace(/\bresturant\b/g, 'restaurant');
    
    // address variations
    fixed = fixed.replace(/\badrres\b/g, 'address');
    fixed = fixed.replace(/\badres\b/g, 'address');
    fixed = fixed.replace(/\baddres\b/g, 'address');
    fixed = fixed.replace(/\badress\b/g, 'address');
    fixed = fixed.replace(/\baddr\b/g, 'address');
    
    // location words
    fixed = fixed.replace(/\bwher\b/g, 'where');
    fixed = fixed.replace(/\bwere\b/g, 'where'); // when used as "where"
    fixed = fixed.replace(/\blocaton\b/g, 'location');
    fixed = fixed.replace(/\blocatoin\b/g, 'location');
    fixed = fixed.replace(/\blocaiton\b/g, 'location');
    
    // menu and food words
    fixed = fixed.replace(/\bmenue\b/g, 'menu');
    fixed = fixed.replace(/\bmeny\b/g, 'menu');
    fixed = fixed.replace(/\bdishe\b/g, 'dish');
    fixed = fixed.replace(/\bdishes\b/g, 'dishes');
    fixed = fixed.replace(/\bfod\b/g, 'food');
    fixed = fixed.replace(/\bfoode\b/g, 'food');
    
    // serve/sell variations
    fixed = fixed.replace(/\bserv\b/g, 'serve');
    fixed = fixed.replace(/\bserveing\b/g, 'serving');
    fixed = fixed.replace(/\bsel\b/g, 'sell');
    fixed = fixed.replace(/\bselling\b/g, 'selling');
    fixed = fixed.replace(/\bselleing\b/g, 'selling');
    
    // menu item names
    fixed = fixed.replace(/\bmomoz\b/g, 'momos');
    fixed = fixed.replace(/\bmommos\b/g, 'momos');
    fixed = fixed.replace(/\bmommo\b/g, 'momo');
    fixed = fixed.replace(/\bchowmein\b/g, 'chow mein');
    fixed = fixed.replace(/\bchowmein\b/g, 'chow mein');
    fixed = fixed.replace(/\bchow mein\b/g, 'chow mein');
    fixed = fixed.replace(/\bfriedrice\b/g, 'fried rice');
    fixed = fixed.replace(/\bfrd rice\b/g, 'fried rice');
    fixed = fixed.replace(/\bdalbhat\b/g, 'dal bhat');
    fixed = fixed.replace(/\bdhal bhat\b/g, 'dal bhat');
    fixed = fixed.replace(/\bdal bhaat\b/g, 'dal bhat');
    fixed = fixed.replace(/\bcurry\b/g, 'curry');
    fixed = fixed.replace(/\bcurri\b/g, 'curry');
    fixed = fixed.replace(/\bsamosa\b/g, 'samosa');
    fixed = fixed.replace(/\bsamosas\b/g, 'samosas');
    fixed = fixed.replace(/\bsamsoa\b/g, 'samosa');
    
    // price and cost
    fixed = fixed.replace(/\bprce\b/g, 'price');
    fixed = fixed.replace(/\bpric\b/g, 'price');
    fixed = fixed.replace(/\bprices\b/g, 'prices');
    fixed = fixed.replace(/\bcost\b/g, 'cost');
    fixed = fixed.replace(/\bcosts\b/g, 'costs');
    fixed = fixed.replace(/\bcheep\b/g, 'cheap');
    fixed = fixed.replace(/\bcheapest\b/g, 'cheapest');
    fixed = fixed.replace(/\bexpensiv\b/g, 'expensive');
    
    // hours and time
    fixed = fixed.replace(/\bhour\b/g, 'hour');
    fixed = fixed.replace(/\bhours\b/g, 'hours');
    fixed = fixed.replace(/\bopn\b/g, 'open');
    fixed = fixed.replace(/\bopening\b/g, 'opening');
    fixed = fixed.replace(/\bclos\b/g, 'close');
    fixed = fixed.replace(/\bclosing\b/g, 'closing');
    fixed = fixed.replace(/\bclsed\b/g, 'closed');
    
    // dietary terms
    fixed = fixed.replace(/\bvegan\b/g, 'vegan');
    fixed = fixed.replace(/\bvegann\b/g, 'vegan');
    fixed = fixed.replace(/\bvegetarian\b/g, 'vegetarian');
    fixed = fixed.replace(/\bvegeterian\b/g, 'vegetarian');
    fixed = fixed.replace(/\bgluten\b/g, 'gluten');
    fixed = fixed.replace(/\bglutenfree\b/g, 'gluten free');
    fixed = fixed.replace(/\bgluten-free\b/g, 'gluten free');
    fixed = fixed.replace(/\bdairy\b/g, 'dairy');
    fixed = fixed.replace(/\bdairyfree\b/g, 'dairy free');
    fixed = fixed.replace(/\bdairy-free\b/g, 'dairy free');
    fixed = fixed.replace(/\bhalal\b/g, 'halal');
    fixed = fixed.replace(/\bhallal\b/g, 'halal');
    fixed = fixed.replace(/\ballergy\b/g, 'allergy');
    fixed = fixed.replace(/\ballergies\b/g, 'allergies');
    fixed = fixed.replace(/\ballergen\b/g, 'allergen');
    
    // ingredients and cooking
    fixed = fixed.replace(/\bingredient\b/g, 'ingredient');
    fixed = fixed.replace(/\bingredients\b/g, 'ingredients');
    fixed = fixed.replace(/\bingrediant\b/g, 'ingredient');
    fixed = fixed.replace(/\bingrediants\b/g, 'ingredients');
    fixed = fixed.replace(/\bspice\b/g, 'spice');
    fixed = fixed.replace(/\bspices\b/g, 'spices');
    fixed = fixed.replace(/\bspicy\b/g, 'spicy');
    fixed = fixed.replace(/\bspicey\b/g, 'spicy');
    fixed = fixed.replace(/\brecipe\b/g, 'recipe');
    fixed = fixed.replace(/\brecipes\b/g, 'recipes');
    fixed = fixed.replace(/\breceipe\b/g, 'recipe');
    fixed = fixed.replace(/\bsauce\b/g, 'sauce');
    fixed = fixed.replace(/\bsauces\b/g, 'sauces');
    fixed = fixed.replace(/\boil\b/g, 'oil');
    fixed = fixed.replace(/\boils\b/g, 'oils');
    
    // msg handling - in restaurant context, "msg" means monosodium glutamate
    // only replace if it's in a restaurant-related context
    if (/\b(do|does|use|uses|using|have|has|contain|contains|add|adds|put|puts)\s+(you|your|ur|they|the|this|that)\s+.*\bmsg\b/i.test(text) ||
        /\bmsg\b.*\b(food|dish|dishes|ingredient|ingredients|restaurant|menu|kitchen|cook|cooking|use|uses|using)\b/i.test(text)) {
      fixed = fixed.replace(/\bmsg\b/g, 'monosodium glutamate');
    }
    
    // staff and ownership
    fixed = fixed.replace(/\bchef\b/g, 'chef');
    fixed = fixed.replace(/\bchefs\b/g, 'chefs');
    fixed = fixed.replace(/\bcheff\b/g, 'chef');
    fixed = fixed.replace(/\bowner\b/g, 'owner');
    fixed = fixed.replace(/\bowners\b/g, 'owners');
    fixed = fixed.replace(/\bownr\b/g, 'owner');
    fixed = fixed.replace(/\bstaff\b/g, 'staff');
    fixed = fixed.replace(/\bstafff\b/g, 'staff');
    fixed = fixed.replace(/\bemployee\b/g, 'employee');
    fixed = fixed.replace(/\bemployees\b/g, 'employees');
    fixed = fixed.replace(/\bemploye\b/g, 'employee');
    
    // services
    fixed = fixed.replace(/\breservation\b/g, 'reservation');
    fixed = fixed.replace(/\breservations\b/g, 'reservations');
    fixed = fixed.replace(/\breservaton\b/g, 'reservation');
    fixed = fixed.replace(/\bcatering\b/g, 'catering');
    fixed = fixed.replace(/\bcater\b/g, 'cater');
    fixed = fixed.replace(/\bdelivery\b/g, 'delivery');
    fixed = fixed.replace(/\bdeliver\b/g, 'deliver');
    fixed = fixed.replace(/\bdelivry\b/g, 'delivery');
    fixed = fixed.replace(/\bpickup\b/g, 'pickup');
    fixed = fixed.replace(/\bpick up\b/g, 'pickup');
    fixed = fixed.replace(/\btakeout\b/g, 'takeout');
    fixed = fixed.replace(/\btake out\b/g, 'takeout');
    fixed = fixed.replace(/\brefund\b/g, 'refund');
    fixed = fixed.replace(/\brefunds\b/g, 'refunds');
    fixed = fixed.replace(/\brefunded\b/g, 'refunded');
    
    // ============================================
    // common chat typos and slang
    // ============================================
    
    // question words
    fixed = fixed.replace(/\bwut\b/g, 'what');
    fixed = fixed.replace(/\bwat\b/g, 'what');
    fixed = fixed.replace(/\bwhut\b/g, 'what');
    fixed = fixed.replace(/\bwht\b/g, 'what');
    fixed = fixed.replace(/\bwhos\b/g, 'who is');
    fixed = fixed.replace(/\bwhos\b/g, 'who\'s');
    fixed = fixed.replace(/\bwats\b/g, 'what is');
    fixed = fixed.replace(/\bwats\b/g, 'what\'s');
    fixed = fixed.replace(/\bwheres\b/g, 'where is');
    fixed = fixed.replace(/\bwheres\b/g, 'where\'s');
    fixed = fixed.replace(/\bhowz\b/g, 'how is');
    fixed = fixed.replace(/\bhowz\b/g, 'how\'s');
    
    // pronouns and common words
    fixed = fixed.replace(/\bu\b/g, 'you');
    fixed = fixed.replace(/\bur\b/g, 'your');
    fixed = fixed.replace(/\byur\b/g, 'your');
    fixed = fixed.replace(/\byoure\b/g, 'you are');
    fixed = fixed.replace(/\byoure\b/g, 'you\'re');
    fixed = fixed.replace(/\byouve\b/g, 'you have');
    fixed = fixed.replace(/\byouve\b/g, 'you\'ve');
    fixed = fixed.replace(/\bhav\b/g, 'have');
    fixed = fixed.replace(/\bhavent\b/g, 'have not');
    fixed = fixed.replace(/\bhavent\b/g, 'haven\'t');
    fixed = fixed.replace(/\bthru\b/g, 'through');
    fixed = fixed.replace(/\bthx\b/g, 'thanks');
    fixed = fixed.replace(/\bthnx\b/g, 'thanks');
    fixed = fixed.replace(/\bthanx\b/g, 'thanks');
    fixed = fixed.replace(/\bpls\b/g, 'please');
    fixed = fixed.replace(/\bplz\b/g, 'please');
    fixed = fixed.replace(/\bplez\b/g, 'please');
    fixed = fixed.replace(/\br\b/g, 'are'); // only when standalone
    fixed = fixed.replace(/\bim\b/g, 'i am');
    fixed = fixed.replace(/\bim\b/g, 'i\'m');
    fixed = fixed.replace(/\bive\b/g, 'i have');
    fixed = fixed.replace(/\bive\b/g, 'i\'ve');
    fixed = fixed.replace(/\bid\b/g, 'i would');
    fixed = fixed.replace(/\bid\b/g, 'i\'d');
    
    // common misspellings
    fixed = fixed.replace(/\brecieve\b/g, 'receive');
    fixed = fixed.replace(/\brecieved\b/g, 'received');
    fixed = fixed.replace(/\bseperate\b/g, 'separate');
    fixed = fixed.replace(/\bdefinately\b/g, 'definitely');
    fixed = fixed.replace(/\bdefinetly\b/g, 'definitely');
    fixed = fixed.replace(/\boccured\b/g, 'occurred');
    fixed = fixed.replace(/\boccurence\b/g, 'occurrence');
    fixed = fixed.replace(/\bteh\b/g, 'the');
    fixed = fixed.replace(/\btaht\b/g, 'that');
    fixed = fixed.replace(/\bthta\b/g, 'that');
    fixed = fixed.replace(/\bhte\b/g, 'the');
    fixed = fixed.replace(/\btehm\b/g, 'them');
    fixed = fixed.replace(/\bthier\b/g, 'their');
    fixed = fixed.replace(/\bthier\b/g, 'they\'re');
    fixed = fixed.replace(/\bther\b/g, 'there');
    fixed = fixed.replace(/\bther\b/g, 'they\'re');
    
    // numbers and quantities
    fixed = fixed.replace(/\bmuch\b/g, 'much');
    fixed = fixed.replace(/\bmany\b/g, 'many');
    fixed = fixed.replace(/\bhow many\b/g, 'how many');
    fixed = fixed.replace(/\bhow much\b/g, 'how much');
    
    // ============================================
    // restaurant-specific phrases
    // ============================================
    
    // common restaurant question patterns
    fixed = fixed.replace(/\bdo u\b/g, 'do you');
    fixed = fixed.replace(/\bcan u\b/g, 'can you');
    fixed = fixed.replace(/\bwill u\b/g, 'will you');
    fixed = fixed.replace(/\bis ur\b/g, 'is your');
    fixed = fixed.replace(/\bare ur\b/g, 'are your');
    fixed = fixed.replace(/\bwhats ur\b/g, 'what is your');
    fixed = fixed.replace(/\bwhats ur\b/g, 'what\'s your');
    fixed = fixed.replace(/\bwhats your\b/g, 'what is your');
    fixed = fixed.replace(/\bwhats your\b/g, 'what\'s your');
    fixed = fixed.replace(/\bwhere r u\b/g, 'where are you');
    fixed = fixed.replace(/\bwhere r u located\b/g, 'where are you located');
    
    // specific restaurant question patterns with typos
    // handle "wut/wat food u/you hav/have" variations - do this BEFORE individual word replacements
    // use more flexible patterns that don't rely on word boundaries for the whole phrase
    fixed = fixed.replace(/wut\s+food\s+(u|you)\s+hav\b/g, 'what food do you have');
    fixed = fixed.replace(/wut\s+food\s+(u|you)\s+have\b/g, 'what food do you have');
    fixed = fixed.replace(/wat\s+food\s+(u|you)\s+hav\b/g, 'what food do you have');
    fixed = fixed.replace(/wat\s+food\s+(u|you)\s+have\b/g, 'what food do you have');
    fixed = fixed.replace(/what\s+food\s+(u|you)\s+hav\b/g, 'what food do you have');
    
    // also handle without spaces (though less common)
    fixed = fixed.replace(/wutfood\s*(u|you)\s*hav/g, 'what food do you have');
    fixed = fixed.replace(/watfood\s*(u|you)\s*hav/g, 'what food do you have');
  
    return fixed;
  }
  