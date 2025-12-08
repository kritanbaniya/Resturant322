// simple, conservative normalization and typo correction
// goal: gently fix common chat typos without breaking general questions

export function normalizeMessage(text) {
    if (!text) return '';
  
    // basic cleanup
    let out = text.trim();
  
    // collapse multiple spaces
    out = out.replace(/\s+/g, ' ');
  
    // work in lowercase for replacements, but keep final string natural
    const lower = out.toLowerCase();
  
    // common restaurant-related typos and chat slang
    let fixed = lower;
  
    // words that are very likely typos in this context
    fixed = fixed.replace(/\bresturant\b/g, 'restaurant');
    fixed = fixed.replace(/\brestraunt\b/g, 'restaurant');
    fixed = fixed.replace(/\bwher\b/g, 'where');
    fixed = fixed.replace(/\bwut\b/g, 'what');
    fixed = fixed.replace(/\bwat\b/g, 'what');
    fixed = fixed.replace(/\badrres\b/g, 'address');
    fixed = fixed.replace(/\badres\b/g, 'address');
    fixed = fixed.replace(/\bserv\b/g, 'serve');
    fixed = fixed.replace(/\bsel\b/g, 'sell');
    fixed = fixed.replace(/\bmomoz\b/g, 'momos');
    fixed = fixed.replace(/\bchowmein\b/g, 'chow mein');
  
    // lightly normalize chat shorthand where it is very safe
    fixed = fixed.replace(/\bu\b/g, 'you');
    fixed = fixed.replace(/\bur\b/g, 'your');
  
    return fixed;
  }
  