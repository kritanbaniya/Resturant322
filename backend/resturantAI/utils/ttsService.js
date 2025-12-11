/**
 * text-to-speech service using eleven labs api
 * converts text responses to audio for voice chat
 */

// node-fetch v3 is ESM-only, use dynamic import
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * generate audio from text using eleven labs tts api
 * @param {string} text - text to convert to speech
 * @param {string} voiceId - eleven labs voice id (default: '21m00Tcm4TlvDq8ikWAM')
 * @returns {promise<object>} - { audioBase64: string, mimeType: string }
 */
async function textToSpeech(text, voiceId = null) {
  // support both naming conventions for api key
  const apiKey = process.env.ELEVEN_LABS_API_KEY || process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.warn('[tts] ELEVEN_LABS_API_KEY or ELEVENLABS_API_KEY not set, skipping audio generation');
    return null;
  }

  // use voice id from env or default
  const actualVoiceId = voiceId || process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  if (!text || !text.trim()) {
    console.warn('[tts] empty text provided, skipping audio generation');
    return null;
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[tts] eleven labs api error: ${response.status} - ${errorText}`);
      return null;
    }

    // convert audio buffer to base64 (node-fetch v3 supports .buffer() method)
    const audioBuffer = await response.buffer();
    const audioBase64 = audioBuffer.toString('base64');
    
    console.log(`[tts] audio generated successfully (${audioBuffer.length} bytes)`);
    
    return {
      audioBase64: audioBase64,
      mimeType: 'audio/mpeg'
    };
  } catch (error) {
    console.error('[tts] error generating audio:', error.message);
    return null;
  }
}

module.exports = {
  textToSpeech
};
