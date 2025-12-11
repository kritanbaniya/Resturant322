const chatBtn = document.getElementById('chat-button');
const chatBox = document.getElementById('chat-box');
const sendBtn = document.getElementById('chat-send');
const voiceBtn = document.getElementById('voice-button');
const input = document.getElementById('chat-input');
const messages = document.getElementById('chat-messages');

// conversation history stored in localStorage
const HISTORY_KEY = 'restaurant_chat_history';
const MAX_HISTORY_LENGTH = 10; // keep last 10 messages

// load conversation history from localStorage
function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const history = JSON.parse(stored);
      console.log('[history] loaded from localStorage:', history.length, 'messages');
      return Array.isArray(history) ? history : [];
    }
  } catch (err) {
    console.error('[history] error loading from localStorage:', err);
  }
  return [];
}

// save conversation history to localStorage
function saveHistory(history) {
  try {
    // keep only last MAX_HISTORY_LENGTH messages
    const trimmed = history.slice(-MAX_HISTORY_LENGTH);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    console.log('[history] saved to localStorage:', trimmed.length, 'messages');
  } catch (err) {
    console.error('[history] error saving to localStorage:', err);
  }
}

// add message to history
function addToHistory(role, content, source = null) {
  const history = loadHistory();
  const message = { role, content };
  if (source) {
    message.source = source;
  }
  history.push(message);
  saveHistory(history);
  return history;
}

// clear conversation history
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  console.log('[history] cleared');
}

// voice recognition setup
let recognition = null;
let isListening = false;
let hasReceivedResult = false; // track if we got any results
let pendingTranscript = ''; // store interim results

// check if browser supports web speech api
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  // try continuous mode - it might work better for toggle
  recognition.continuous = true; // changed to true to keep listening until stopped
  recognition.interimResults = true; // enable interim results to see if audio is being captured
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1; // only get one alternative
  
  console.log('[voice] web speech api initialized');
  console.log('[voice] recognition settings:', {
    continuous: recognition.continuous,
    interimResults: recognition.interimResults,
    lang: recognition.lang,
    maxAlternatives: recognition.maxAlternatives
  });
  
  // check microphone permissions
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'microphone' }).then((result) => {
      console.log('[voice] microphone permission status:', result.state);
      if (result.state === 'denied') {
        console.warn('[voice] microphone permission is denied');
        addMessage('microphone permission denied. please enable it in browser settings.', 'system');
      }
    }).catch((err) => {
      console.log('[voice] could not check microphone permission:', err);
    });
  }

  recognition.onstart = () => {
    const timestamp = new Date().toISOString();
    console.log('[voice] ====== recognition started ======');
    console.log('[voice] timestamp:', timestamp);
    console.log('[voice] recognition service is now active');
    console.log('[voice] readyState:', recognition.readyState);
    console.log('[voice] serviceURI:', recognition.serviceURI || 'default');
    console.log('[voice] =================================');
    addMessage('listening... speak now', 'system');
  };

  recognition.onresult = (event) => {
    const timestamp = new Date().toISOString();
    hasReceivedResult = true; // mark that we got at least one result
    console.log('[voice] ====== onresult event fired ======');
    console.log('[voice] timestamp:', timestamp);
    console.log('[voice] results length:', event.results.length);
    console.log('[voice] resultIndex:', event.resultIndex);
    
    // in continuous mode, we get results as they come in
    // we need to process the result at resultIndex
    const resultIndex = event.resultIndex !== undefined ? event.resultIndex : event.results.length - 1;
    const currentResult = event.results[resultIndex];
    
    console.log(`[voice] processing result at index ${resultIndex}`);
    console.log(`[voice] current result length:`, currentResult ? currentResult.length : 0);
    console.log(`[voice] current result isFinal:`, currentResult ? currentResult.isFinal : 'N/A');
    
    // log all results for debugging
    for (let i = 0; i < event.results.length; i++) {
      console.log(`[voice] result ${i}:`, {
        length: event.results[i].length,
        isFinal: event.results[i].isFinal
      });
      for (let j = 0; j < event.results[i].length; j++) {
        console.log(`[voice]   transcript ${j}:`, event.results[i][j].transcript);
        console.log(`[voice]   confidence ${j}:`, event.results[i][j].confidence);
      }
    }
    
    if (currentResult && currentResult.length > 0) {
      // get the latest transcript from current result
      const lastResultItem = currentResult[currentResult.length - 1];
      const latestTranscript = lastResultItem.transcript;
      const latestConfidence = lastResultItem.confidence;
      const isFinal = currentResult.isFinal;
      
      console.log('[voice] extracted transcript:', latestTranscript);
      console.log('[voice] isFinal:', isFinal);
      
      // store interim results
      if (!isFinal && latestTranscript.trim()) {
        pendingTranscript = latestTranscript;
        console.log('[voice] interim result stored:', pendingTranscript);
      }
      
      // process if we have a transcript
      if (latestTranscript.trim()) {
        console.log('[voice] ====== transcription received ======');
        console.log('[voice] timestamp:', timestamp);
        console.log('[voice] transcript:', latestTranscript);
        console.log('[voice] confidence:', latestConfidence);
        console.log('[voice] isFinal:', isFinal);
        console.log('[voice] ====================================');
        
        // in continuous mode, we process final results when they come in
        // but we don't send immediately - wait for user to stop
        if (isFinal) {
          // store final result
          pendingTranscript = latestTranscript;
          console.log('[voice] final result received and stored:', pendingTranscript);
          // don't send yet - wait for user to click stop
        } else {
          console.log('[voice] interim result received, waiting for final result...');
        }
      } else {
        console.warn('[voice] onresult fired but transcript is empty');
      }
    } else {
      console.warn('[voice] onresult fired but current result is empty');
      console.log('[voice] event.results:', event.results);
    }
  };

  recognition.onerror = (event) => {
    const timestamp = new Date().toISOString();
    console.error('[voice] ====== speech recognition error ======');
    console.error('[voice] timestamp:', timestamp);
    console.error('[voice] error code:', event.error);
    console.error('[voice] error message:', event.message || 'no message');
    console.error('[voice] ======================================');
    
    // reset flags on error
    hasReceivedResult = false;
    pendingTranscript = '';
    
    // provide user-friendly error messages (only for certain errors)
    switch(event.error) {
      case 'no-speech':
        // no-speech happens when browser times out waiting for speech
        // this is normal if user didn't speak or microphone isn't working
        console.log('[voice] no speech detected after timeout');
        // don't update state here - onend will handle it
        // don't show message - onend will show a helpful message
        break;
      case 'audio-capture':
        isListening = false;
        updateVoiceButton();
        addMessage('microphone not accessible. please check your microphone and permissions.', 'system');
        break;
      case 'not-allowed':
        isListening = false;
        updateVoiceButton();
        addMessage('microphone permission denied. please allow microphone access in browser settings.', 'system');
        break;
      case 'network':
        isListening = false;
        updateVoiceButton();
        addMessage('network error. please check your internet connection.', 'system');
        break;
      case 'aborted':
        console.log('[voice] recognition was aborted (likely by user)');
        // don't update state - onend will handle it
        return; // don't show error message for user-initiated abort
      default:
        console.error('[voice] unexpected error:', event.error);
        isListening = false;
        updateVoiceButton();
        addMessage(`voice recognition error: ${event.error}. please try again.`, 'system');
    }
  };

  recognition.onend = () => {
    const timestamp = new Date().toISOString();
    console.log('[voice] ====== recognition ended ======');
    console.log('[voice] timestamp:', timestamp);
    console.log('[voice] isListening state before update:', isListening);
    console.log('[voice] hasReceivedResult:', hasReceivedResult);
    console.log('[voice] pendingTranscript:', pendingTranscript);
    console.log('[voice] ==============================');
    
    // process any pending transcript when recognition ends
    if (pendingTranscript.trim()) {
      console.log('[voice] processing pending transcript:', pendingTranscript);
      addMessage(pendingTranscript, 'you (voice)');
      sendVoiceMessage(pendingTranscript);
      pendingTranscript = '';
    } else if (!hasReceivedResult) {
      console.log('[voice] recognition ended without any results');
      // show helpful message only once (avoid duplicates)
      const lastMessage = messages.lastElementChild;
      const shouldShowMessage = !lastMessage || 
        (!lastMessage.textContent.includes('no speech detected') &&
         !lastMessage.textContent.includes('microphone'));
      
      if (shouldShowMessage) {
        addMessage('no speech detected. make sure your microphone is working, speak clearly, and try clicking the mic button again.', 'system');
      }
    }
    
    // reset flags
    hasReceivedResult = false;
    pendingTranscript = '';
    
    // update state
    if (isListening) {
      isListening = false;
      updateVoiceButton();
      console.log('[voice] recognition ended, updated button state');
    } else {
      console.log('[voice] recognition ended but was already stopped');
    }
  };
} else {
  console.warn('web speech api not supported in this browser');
  voiceBtn.style.display = 'none';
}

// toggle chat box
chatBtn.onclick = () => {
  chatBox.style.display =
    chatBox.style.display === 'none' ? 'flex' : 'none';
};

// add message to chat
function addMessage(text, sender) {
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `<span class="sender">${sender}:</span> <span class="content">${text}</span>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// update voice button appearance and disable/enable chat input
function updateVoiceButton() {
  if (isListening) {
    voiceBtn.style.backgroundColor = '#ff4444';
    voiceBtn.textContent = 'stop';
    voiceBtn.title = 'Click to stop listening';
    // disable chat input when mic is recording
    input.disabled = true;
    input.placeholder = 'mic is recording...';
    sendBtn.disabled = true;
  } else {
    voiceBtn.style.backgroundColor = '#28a745';
    voiceBtn.textContent = 'mic';
    voiceBtn.title = 'Click to start listening';
    // enable chat input when mic is not recording
    input.disabled = false;
    input.placeholder = 'Ask something...';
    sendBtn.disabled = false;
  }
}

// toggle voice recognition on/off
voiceBtn.addEventListener('click', (e) => {
  e.preventDefault();
  toggleVoiceRecognition();
});

// toggle voice recognition on/off
function toggleVoiceRecognition() {
  if (!recognition) {
    console.log('[voice] toggle clicked but recognition not available');
    addMessage('voice recognition not supported in this browser.', 'system');
    return;
  }

  if (isListening) {
    // currently listening, stop it
    stopVoiceRecognition();
  } else {
    // not listening, start it
    startVoiceRecognition();
  }
}

// start voice recognition
function startVoiceRecognition() {
  const timestamp = new Date().toISOString();
  
  if (!recognition) {
    console.log('[voice] start requested but recognition not available');
    return;
  }

  if (isListening) {
    console.log('[voice] start requested but already listening - ignoring');
    return;
  }

  // reset flags for new recognition session
  hasReceivedResult = false;
  pendingTranscript = '';

  try {
    console.log('[voice] ====== mic toggled on ======');
    console.log('[voice] timestamp:', timestamp);
    console.log('[voice] recognition state before start:', recognition.readyState || 'unknown');
    console.log('[voice] starting speech recognition...');
    console.log('[voice] speak now - click stop when finished');
    
    recognition.start();
    isListening = true;
    updateVoiceButton();
    
    console.log('[voice] recognition.start() called successfully');
    console.log('[voice] ===========================');
  } catch (err) {
    console.error('[voice] ====== error starting recognition ======');
    console.error('[voice] timestamp:', timestamp);
    console.error('[voice] error:', err);
    console.error('[voice] error name:', err.name);
    console.error('[voice] error message:', err.message);
    console.error('[voice] =========================================');
    isListening = false;
    updateVoiceButton();
  }
}

// stop voice recognition
function stopVoiceRecognition() {
  const timestamp = new Date().toISOString();
  
  if (!recognition) {
    console.log('[voice] stop requested but recognition not available');
    return;
  }
  
  if (!isListening) {
    console.log('[voice] stop requested but not currently listening');
    return;
  }

  try {
    console.log('[voice] ====== mic toggled off ======');
    console.log('[voice] timestamp:', timestamp);
    console.log('[voice] recognition state before stop:', recognition.readyState || 'unknown');
    console.log('[voice] hasReceivedResult before stop:', hasReceivedResult);
    console.log('[voice] pendingTranscript before stop:', pendingTranscript);
    console.log('[voice] stopping speech recognition...');
    
    // don't immediately update button state - let onend handle it
    // this gives the recognition service time to finalize results
    recognition.stop();
    
    console.log('[voice] recognition.stop() called successfully');
    console.log('[voice] waiting for recognition to end and process results...');
    console.log('[voice] ============================');
    
    // note: isListening and updateVoiceButton will be handled in onend
    // this ensures we don't lose any pending results
  } catch (err) {
    console.error('[voice] ====== error stopping recognition ======');
    console.error('[voice] timestamp:', timestamp);
    console.error('[voice] error:', err);
    console.error('[voice] error name:', err.name);
    console.error('[voice] error message:', err.message);
    console.error('[voice] ==========================================');
    isListening = false;
    updateVoiceButton();
  }
}

// send voice message to backend
async function sendVoiceMessage(transcript) {
  try {
    // get current history (don't add user message yet - backend will do it)
    const history = loadHistory();
    
    const res = await fetch('http://localhost:3000/voice', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ 
        message: transcript,
        history: history // send current history (without this message)
      })
    });

    const data = await res.json();

    if (data.source === 'error') {
      addMessage(data.answer, 'error');
      return;
    }

    // update history with response
    if (data.history) {
      saveHistory(data.history);
    } else {
      // fallback: manually add assistant response
      addToHistory('assistant', data.answer, data.source);
    }

    // display bot response in chat
    const senderLabel = data.source === 'kb' ? 'kb (voice)' : 'ai (voice)';
    addMessage(data.answer, senderLabel);

    // play audio if available
    if (data.audioBase64) {
      playAudio(data.audioBase64, data.audioMimeType || 'audio/mpeg');
    }
  } catch (err) {
    console.error('error sending voice message:', err);
    addMessage('error processing voice request.', 'error');
  }
}

// play audio from base64
function playAudio(base64Audio, mimeType) {
  try {
    // convert base64 to blob
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const audioUrl = URL.createObjectURL(blob);

    // create and play audio element
    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.error('error playing audio:', err);
    });

    // cleanup url after playback
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });
  } catch (err) {
    console.error('error playing audio:', err);
  }
}

// regular text chat
sendBtn.onclick = async () => {
  // safety check: don't allow sending if mic is recording
  if (isListening) {
    return;
  }

  const msg = input.value.trim();
  if (!msg) return;

  addMessage(msg, 'you');
  input.value = '';

  try {
    // get current history (don't add user message yet - backend will do it)
    const history = loadHistory();
    
    const res = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ 
        message: msg,
        history: history // send current history (without this message)
      })
    });

    const data = await res.json();
    
    // update history with response
    if (data.history) {
      saveHistory(data.history);
    } else {
      // fallback: manually add assistant response
      addToHistory('assistant', data.answer, data.source);
    }
    
    const senderLabel = data.source === 'kb' ? 'kb' : 'ai';
    addMessage(data.answer, senderLabel);
  } catch (err) {
    console.error('error sending message:', err);
    addMessage('error processing request.', 'error');
  }
};

// allow enter key to send message
input.addEventListener('keypress', (e) => {
  // safety check: don't allow sending if mic is recording
  if (isListening) {
    e.preventDefault();
    return;
  }
  
  if (e.key === 'Enter') {
    sendBtn.click();
  }
});
