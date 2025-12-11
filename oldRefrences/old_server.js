
// load environment first (must be line 1)
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import chatRoute from './routes/chat.js';
import voiceRoute from './routes/voice.js';

const app = express();

// middleware
// cors configuration - allow credentials for session cookies
// IMPORTANT: CORS must be configured BEFORE session middleware
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // allow localhost and 127.0.0.1 on any port for development
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
      return callback(null, true);
    }
    // allow all origins for development (fallback)
    callback(null, true);
  },
  credentials: true, // important: allow cookies/session
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'] // explicitly expose Set-Cookie header
}));
app.use(express.json());

// session config
// IMPORTANT: for cross-origin (127.0.0.1 vs localhost), browsers treat them as different origins
// try sameSite: 'none' with secure: false for development (may not work in all browsers)
// best solution: use same origin for frontend and backend (both localhost or both 127.0.0.1)
app.use(
  session({
    secret: "restaurant_secret_key",
    resave: true, // ensure session is saved even if not modified
    saveUninitialized: true, // save uninitialized sessions (creates cookie on first request)
    name: 'restaurant.session', // custom session name for easier debugging
    cookie: { 
      maxAge: 1000 * 60 * 30, // 30 minutes
      sameSite: 'none', // allow cross-origin cookies
      secure: false, // for development only - set to true in production with HTTPS
      httpOnly: true, // prevent client-side access
      path: '/' // ensure cookie is sent for all paths
    }
  })
);

// request debugging middleware - note: conversation history is now stored in localStorage on frontend
app.use((req, res, next) => {
  console.log('[request] ====== request received ======');
  console.log('[request] method:', req.method);
  console.log('[request] path:', req.path);
  console.log('[request] origin:', req.headers.origin);
  console.log('[request] referer:', req.headers.referer);
  
  // log if history is being sent in request body (for chat/voice routes)
  if (req.method === 'POST' && (req.path === '/chat' || req.path === '/voice')) {
    const bodyHistory = req.body?.history;
    if (Array.isArray(bodyHistory)) {
      console.log('[request] conversation history from localStorage:', bodyHistory.length, 'messages');
    } else {
      console.log('[request] no conversation history in request (new conversation)');
    }
  }
  
  console.log('[request] =================================');
  next();
});

// routes
app.use("/chat", chatRoute);
app.use("/voice", voiceRoute);

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("server running on port " + PORT);
  console.log("using model:", process.env.OLLAMA_MODEL);
});
