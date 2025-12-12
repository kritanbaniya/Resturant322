# Restaurant AI Eats

A restaurant management system with an AI-powered chatbot featuring knowledge base integration, voice interaction, and full restaurant operations. The backend was initially developed in Python and later converted to JavaScript.

## Features

- AI chatbot with knowledge base integration
- Voice interaction (speech-to-text and text-to-speech)
- Response ratings system
- Conversation history
- Customer Features: Order food, write complaints, view menu, track orders
- User management, orders, menu, delivery tracking
- Chef and manager dashboards

## How the Chatbot Works

### Knowledge Base Integration

The chatbot uses vector search to find relevant information from the knowledge base:

1. User query is converted to a vector embedding
2. System searches knowledge base entries using cosine similarity
3. Top matching entries (above 0.3 threshold) are retrieved
4. These facts are added to the LLM prompt
5. LLM generates a response using the knowledge base facts

The knowledge base contains restaurant information (menu, hours, policies, FAQs) stored in MongoDB with vector embeddings for fast semantic search.

### Response Ratings

- Users can rate KB-based responses with 1-5 stars
- Ratings are stored and linked to the knowledge base entry
- 1-star ratings automatically flag entries for manager review
- Helps improve response quality over time

### Conversational History

- Conversation history is stored in browser local storage
- Last 10 messages are kept for context
- History persists across browser sessions
- Sent with each request to maintain conversation context

### Voice Interaction

**Web Speech API (Input)**
- Browser's speech recognition converts speech to text
- Click microphone button to start/stop recording
- Works in Chrome and Edge browsers

**Eleven Labs (Output)**
- Backend converts text responses to speech using Eleven Labs API
- Audio is generated server-side and sent to frontend
- Frontend plays the audio automatically after voice queries

## Customer Features

### Ordering Food

- Browse menu with categories and dish details
- Add items to cart with quantities
- View cart and proceed to checkout
- Place orders and track order status
- View order history

### Writing Complaints

- Submit complaints about orders, service, or food quality
- Track complaint status
- View complaint history
- Managers can review and respond to complaints

## Role-Based Features

### Manager Features
- Approve/reject registrations, resolve complaints, manage employees (hire/fire/promote/bonus). Review flagged AI responses and update knowledge base.

### Chef Features
- View order queue, manage order preparation (start/complete/hold). Create and manage personal dishes with statistics.

### Delivery Person Features
- Submit bids on available orders, manage assigned deliveries with status updates. Track delivery history and performance metrics.

## Installation

### Prerequisites
- Node.js
- MongoDB
- Ollama Cloud API key
- Eleven Labs API key (optional, for voice)

### Setup

1. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create `.env` file:
   ```bash
   MONGODB_URI=mongodb://localhost:27017/restaurant_db
   OLLAMA_API_KEY=your_ollama_api_key
   ELEVEN_LABS_API_KEY=your_eleven_labs_api_key
   PORT=5000
   ```

3. Start backend:
   ```bash
   npm start
   ```

4. Open frontend:
   - Open `Front_End_of_AI_Eats/index.html` in a browser
   - Or serve with a local web server

## Usage

- **Text Chat**: Type questions and get AI responses
- **Voice Chat**: Click mic button, speak, get text + audio response
- **Rate Responses**: Click stars to rate KB-based answers
- **History**: Automatically maintained in browser storage
- **Order Food**: Browse menu, add to cart, checkout and place orders
- **Complaints**: Submit complaints about orders or service, track status
