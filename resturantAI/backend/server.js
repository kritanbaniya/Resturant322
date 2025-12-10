// load environment first (must be line 1)
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import chatRoute from './routes/chat.js';

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// session config
app.use(
  session({
    secret: "restaurant_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 30 } // 30 minutes
  })
);

// routes
app.use("/chat", chatRoute);

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("server running on port " + PORT);
  console.log("using model:", process.env.OLLAMA_MODEL);
});
