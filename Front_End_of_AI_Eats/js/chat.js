// api configuration - using integrated backend
const AI_API_URL = "http://localhost:5000/chat";
const FLASK_API_URL = "http://127.0.0.1:5000";

// conversation history stored in localStorage
const HISTORY_KEY = 'restaurant_chat_history';
const MAX_HISTORY_LENGTH = 10;

// processing state
let isProcessing = false;
let currentAudio = null;

// voice recognition setup
let recognition = null;
let isListening = false;
let hasReceivedResult = false;
let pendingTranscript = '';

function updateAuthStatus() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const username = localStorage.getItem("username");
  const authLink = document.getElementById("auth-link");
  const notLoggedInBanner = document.getElementById("not-logged-in-banner");
  const ratingsLink = document.getElementById("ratings-link");
  const cartLink = document.getElementById("cart-link");
  
  if (isLoggedIn === "true" && username) {
    authLink.textContent = `[USER] ${username}`;
    authLink.href = "profile.html";
    notLoggedInBanner.style.display = "none";
    ratingsLink.style.display = "block";
  } else {
    authLink.textContent = "Login/Register";
    authLink.href = "login.html";
    notLoggedInBanner.style.display = "block";
    ratingsLink.style.display = "none";
    
    // UC-05 A1: Allow visitors to register
    if (cartLink) {
      cartLink.onclick = function(e) {
        e.preventDefault();
        const response = confirm("Register now to place orders, track deliveries, and enjoy VIP benefits!\n\nGo to registration?");
        if (response) window.location.href = "register.html";
      };
    }
  }

  updateCartCount();
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalItems;
}

// load conversation history from localStorage
function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const history = JSON.parse(stored);
      return Array.isArray(history) ? history : [];
    }
  } catch (err) {
    console.error('[history] error loading:', err);
  }
  return [];
}

// save conversation history to localStorage
function saveHistory(history) {
  try {
    const trimmed = history.slice(-MAX_HISTORY_LENGTH);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('[history] error saving:', err);
  }
}

// initialize voice recognition if supported
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;
  
  recognition.onstart = () => {
    console.log('[voice] recognition started');
    addMessage('listening... speak now', 'system');
  };

  recognition.onresult = (event) => {
    hasReceivedResult = true;
    const resultIndex = event.resultIndex !== undefined ? event.resultIndex : event.results.length - 1;
    const currentResult = event.results[resultIndex];
    
    if (currentResult && currentResult.length > 0) {
      const lastResultItem = currentResult[currentResult.length - 1];
      const latestTranscript = lastResultItem.transcript;
      const isFinal = currentResult.isFinal;
      
      if (!isFinal && latestTranscript.trim()) {
        pendingTranscript = latestTranscript;
      }
      
      if (isFinal && latestTranscript.trim()) {
        pendingTranscript = latestTranscript;
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('[voice] error:', event.error);
    switch(event.error) {
      case 'no-speech':
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
      default:
        isListening = false;
        updateVoiceButton();
        addMessage(`voice recognition error: ${event.error}. please try again.`, 'system');
    }
  };

  recognition.onend = () => {
    if (pendingTranscript.trim()) {
      addMessage(pendingTranscript, 'user');
      sendVoiceMessage(pendingTranscript);
      pendingTranscript = '';
    } else if (!hasReceivedResult) {
      addMessage('no speech detected. make sure your microphone is working, speak clearly, and try clicking the mic button again.', 'system');
    }
    
    hasReceivedResult = false;
    pendingTranscript = '';
    
    if (isListening) {
      isListening = false;
      updateVoiceButton();
    }
  };

  // show voice button
  const voiceBtn = document.getElementById('voice-btn');
  if (voiceBtn) voiceBtn.style.display = 'block';
}

// add message to chat box
function addMessage(text, sender, options = {}) {
  const chatBox = document.getElementById("chat-box");
  const messageDiv = document.createElement("div");
  let className = 'message';
  let senderLabel = 'AI';
  
  if (sender === 'user') {
    className += ' user';
    senderLabel = 'You';
  } else if (sender === 'system') {
    className += ' system';
    senderLabel = 'System';
  } else if (sender === 'error') {
    className += ' error';
    senderLabel = 'Error';
  } else {
    className += ' assistant';
    senderLabel = sender === 'kb' ? 'KB' : 'AI';
  }
  
  messageDiv.className = className;
  messageDiv.innerHTML = `<span class="sender">${senderLabel}:</span> <span class="content">${escapeHtml(text)}</span>`;
  
  // add review UI only for reviewable KB responses (score > 0.3)
  if (options.reviewable && options.answerId) {
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "review-section";
    reviewDiv.style.marginTop = "10px";
    reviewDiv.style.padding = "10px";
    reviewDiv.style.borderTop = "1px solid #ddd";
    reviewDiv.innerHTML = `
      <div style="margin-bottom: 8px; font-size: 0.9em; color: #666;">Was this response helpful?</div>
      <div class="star-rating" data-answer-id="${options.answerId}" data-kb-entry-id="${options.kbEntryId || ''}">
        ${[1, 2, 3, 4, 5].map(star => 
          `<span class="star" data-rating="${star}" style="font-size: 24px; cursor: pointer; color: #ddd; margin-right: 5px;">★</span>`
        ).join('')}
      </div>
      <div class="rating-feedback" style="margin-top: 8px; font-size: 0.85em; color: #666; display: none;"></div>
    `;
    messageDiv.appendChild(reviewDiv);
    
    // add star rating event listeners
    const stars = reviewDiv.querySelectorAll('.star');
    stars.forEach(star => {
      star.addEventListener('mouseenter', function() {
        const rating = parseInt(this.dataset.rating);
        highlightStars(stars, rating);
      });
      star.addEventListener('mouseleave', function() {
        const currentRating = reviewDiv.dataset.currentRating || 0;
        highlightStars(stars, currentRating);
      });
      star.addEventListener('click', function() {
        const rating = parseInt(this.dataset.rating);
        submitReview(options.answerId, rating, options.kbEntryId, reviewDiv);
      });
    });
  }
  
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// highlight stars up to rating
function highlightStars(stars, rating) {
  stars.forEach((star, index) => {
    if (index < rating) {
      star.style.color = '#ffc107';
    } else {
      star.style.color = '#ddd';
    }
  });
}

// submit review
async function submitReview(answerId, rating, kbEntryId, reviewDiv) {
  if (!answerId) return;
  
  const feedbackDiv = reviewDiv.querySelector('.rating-feedback');
  const stars = reviewDiv.querySelectorAll('.star');
  
  // disable stars
  stars.forEach(star => {
    star.style.pointerEvents = 'none';
  });
  
  feedbackDiv.style.display = 'block';
  feedbackDiv.textContent = 'Submitting review...';
  
  try {
    const endpoint = kbEntryId ? '/api/chat/review-kb' : '/api/chat/rate';
    const res = await fetch(`http://localhost:5000${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        answer_id: answerId,
        rating: rating
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      reviewDiv.dataset.currentRating = rating;
      highlightStars(stars, rating);
      feedbackDiv.textContent = rating === 1 
        ? 'Thank you for your feedback. This response has been flagged for review.'
        : `Thank you! You rated this ${rating} star${rating > 1 ? 's' : ''}.`;
      feedbackDiv.style.color = '#28a745';
    } else {
      feedbackDiv.textContent = data.error || 'Failed to submit review.';
      feedbackDiv.style.color = '#dc3545';
    }
  } catch (err) {
    console.error('error submitting review:', err);
    feedbackDiv.textContent = 'Error submitting review. Please try again.';
    feedbackDiv.style.color = '#dc3545';
  }
}

// update voice button appearance
function updateVoiceButton() {
  const voiceBtn = document.getElementById('voice-btn');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  
  if (!voiceBtn) return;
  
  if (isListening) {
    voiceBtn.style.backgroundColor = '#ff4444';
    voiceBtn.textContent = '⏹ Stop';
    voiceBtn.title = 'Click to stop listening';
    input.disabled = true;
    input.placeholder = 'mic is recording...';
    sendBtn.disabled = true;
  } else {
    voiceBtn.style.backgroundColor = '#28a745';
    voiceBtn.textContent = '🎤 Mic';
    voiceBtn.title = 'Click to start voice input';
    if (!isProcessing) {
      input.disabled = false;
      input.placeholder = 'Ask me anything about our menu or delivery...';
      sendBtn.disabled = false;
    }
  }
}

// toggle voice recognition
function toggleVoiceRecognition() {
  if (isProcessing) {
    console.log('[voice] toggle blocked - bot is processing');
    return;
  }

  if (!recognition) {
    addMessage('voice recognition not supported in this browser.', 'system');
    return;
  }

  if (isListening) {
    stopVoiceRecognition();
  } else {
    startVoiceRecognition();
  }
}

function startVoiceRecognition() {
  if (!recognition || isListening) return;

  hasReceivedResult = false;
  pendingTranscript = '';

  try {
    recognition.start();
    isListening = true;
    updateVoiceButton();
  } catch (err) {
    console.error('[voice] error starting:', err);
    isListening = false;
    updateVoiceButton();
  }
}

function stopVoiceRecognition() {
  if (!recognition || !isListening) return;

  try {
    recognition.stop();
  } catch (err) {
    console.error('[voice] error stopping:', err);
    isListening = false;
    updateVoiceButton();
  }
}

// send voice message to backend
async function sendVoiceMessage(transcript) {
  if (isProcessing) return;

  isProcessing = true;
  updateInputState();

  try {
    const history = loadHistory();
    
    // use /voice endpoint which always generates audio
    const res = await fetch(`${AI_API_URL.replace('/chat', '/voice')}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ 
        message: transcript,
        history: history
      })
    });

    const data = await res.json();

    if (data.source === 'error') {
      addMessage(data.answer, 'error');
      isProcessing = false;
      updateInputState();
      return;
    }

    if (data.history) {
      saveHistory(data.history);
    } else {
      const history = loadHistory();
      history.push({ role: 'assistant', content: data.answer, source: data.source });
      saveHistory(history);
    }

    const senderLabel = data.source === 'kb' ? 'kb' : 'ai';
    addMessage(data.answer, senderLabel, {
      reviewable: data.reviewable || false,
      answerId: data.answer_id || data.chat_id,
      kbEntryId: data.kbEntryId
    });

    if (data.audioBase64) {
      await playAudio(data.audioBase64, data.audioMimeType || 'audio/mpeg');
    } else {
      isProcessing = false;
      updateInputState();
    }
  } catch (err) {
    console.error('error sending voice message:', err);
    addMessage('error processing voice request. please check if the ai service is running.', 'error');
    isProcessing = false;
    updateInputState();
  }
}

// play audio from base64
function playAudio(base64Audio, mimeType) {
  return new Promise((resolve, reject) => {
    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      currentAudio = audio;

      audio.play().catch(err => {
        console.error('error playing audio:', err);
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        reject(err);
      });

      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        isProcessing = false;
        updateInputState();
        resolve();
      });

      audio.addEventListener('error', (err) => {
        console.error('error during audio playback:', err);
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        isProcessing = false;
        updateInputState();
        reject(err);
      });
    } catch (err) {
      console.error('error playing audio:', err);
      currentAudio = null;
      isProcessing = false;
      updateInputState();
      reject(err);
    }
  });
}

// update input state based on processing status
function updateInputState() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const voiceBtn = document.getElementById('voice-btn');

  if (isProcessing) {
    input.disabled = true;
    input.placeholder = 'bot is responding...';
    sendBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = true;
  } else {
    if (!isListening) {
      input.disabled = false;
      input.placeholder = 'Ask me anything about our menu or delivery...';
      sendBtn.disabled = false;
      if (voiceBtn) voiceBtn.disabled = false;
    }
  }
}

/* UC-05 Step 3: Send message to AI (works for visitors and logged-in users) */
async function sendMessage() {
  if (isListening || isProcessing) return;

  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  
  if (!message) return;

  addMessage(message, 'user');
  input.value = '';

  isProcessing = true;
  updateInputState();

  try {
    const history = loadHistory();
    
    const res = await fetch(`${AI_API_URL}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ 
        message: message,
        history: history
      })
    });

    const data = await res.json();
    
    if (data.source === 'error') {
      addMessage(data.answer || 'error processing request.', 'error');
      isProcessing = false;
      updateInputState();
      return;
    }
    
    if (data.history) {
      saveHistory(data.history);
    } else {
      const history = loadHistory();
      history.push({ role: 'assistant', content: data.answer, source: data.source });
      saveHistory(history);
    }
    
    const senderLabel = data.source === 'kb' ? 'kb' : 'ai';
    addMessage(data.answer, senderLabel, {
      reviewable: data.reviewable || false,
      answerId: data.answer_id || data.chat_id,
      kbEntryId: data.kbEntryId
    });

    isProcessing = false;
    updateInputState();
  } catch (err) {
    console.error('error sending message:', err);
    addMessage('error processing request. please check if the ai service is running.', 'error');
    isProcessing = false;
    updateInputState();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// event listeners
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("send-btn").addEventListener("click", sendMessage);
  const voiceBtn = document.getElementById("voice-btn");
  if (voiceBtn) {
    voiceBtn.addEventListener("click", toggleVoiceRecognition);
  }
  
  document.getElementById("chat-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter" && !isListening && !isProcessing) {
      sendMessage();
    }
  });

  updateAuthStatus();
});
