const chatBtn = document.getElementById('chat-button');
const chatBox = document.getElementById('chat-box');
const sendBtn = document.getElementById('chat-send');
const input = document.getElementById('chat-input');
const messages = document.getElementById('chat-messages');

chatBtn.onclick = () => {
  chatBox.style.display =
    chatBox.style.display === 'none' ? 'flex' : 'none';
};

function addMessage(text, sender) {
  const div = document.createElement('div');
  div.innerText = `${sender}: ${text}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

sendBtn.onclick = async () => {
  const msg = input.value.trim();
  if (!msg) return;

  addMessage(msg, 'you');
  input.value = '';

  const res = await fetch('http://localhost:3000/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ message: msg })
  });

  const data = await res.json();
  addMessage(data.answer, data.source === 'kb' ? 'kb' : 'ai');
};
