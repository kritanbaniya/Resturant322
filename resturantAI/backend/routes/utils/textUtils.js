/**
 * text utilities
 * functions for text processing and cleaning
 */

/**
 * remove all emojis and unicode symbols from text
 * @param {string} text - text to clean
 * @returns {string} - cleaned text without emojis
 */
export function removeEmojis(text) {
  if (!text) return text;
  
  // remove emojis using regex pattern that matches most unicode emoji ranges
  // this covers: emoticons, miscellaneous symbols, dingbats, supplemental symbols, etc.
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // misc symbols and pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // transport and map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // variation selectors
    .replace(/[\u{200D}]/gu, '') // zero width joiner
    .replace(/[\u{200B}-\u{200D}]/gu, '') // zero width spaces
    .replace(/[\u{FEFF}]/gu, '') // zero width no-break space
    .replace(/[\u{2060}]/gu, '') // word joiner
    .trim();
}
