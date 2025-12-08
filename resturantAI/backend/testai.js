// testai.js
import fs from "fs";
import fetch from "node-fetch";

const OUTPUT_FILE = "TestResult.txt";

// ---------------------------------------------------------------------------
// 93 TEST PROMPTS
// ---------------------------------------------------------------------------

const tests = [

  // 1 — Small talk
  "hi",
  "hello, how are you",
  "tell me a joke",
  "tell me a fun fact",
  "how’s your day going",

  // 2 — Location tests
  "where is this restaurant?",
  "what is your address?",
  "what street are you on?",
  "are you in brooklyn?",
  "how far from queens?",
  "how long does it take to get there?",
  "are you close to central park?",
  "what’s your zip code",

  // 3 — Menu overview
  "what food do you sell",
  "what is on your menu",
  "what dishes do you have",
  "what are your most popular items",
  "what do you recommend",
  "do you have desserts",

  // 4 — Menu details
  "what are momos",
  "what’s chow mein",
  "what's in dal bhat",
  "what is himalayan curry",
  "tell me about fried rice",
  "do your momos have beef",
  "is your curry spicy",

  // 5 — Price tests
  "how much is chow mein",
  "what’s the price of momos",
  "how much are the drinks",
  "how much is the himalayan curry",
  "what’s the cheapest thing you sell",
  "do you have a discount",

  // 6 — Hours
  "what time do you open",
  "what time do you close",
  "are you open right now",
  "are you open on weekends",
  "do you serve breakfast",

  // 7 — Chef / staff
  "who cooks the food",
  "how many chefs do you have",
  "what are your chefs’ names",
  "how long has your chef worked here",
  "who owns the restaurant",
  "how many employees work there",

  // 8 — Dietary
  "is your food halal",
  "is anything vegan",
  "is the curry gluten-free",
  "does your food contain nuts",
  "do you have dairy-free options",

  // 9 — Ordering / policy
  "do you take reservations",
  "what is your refund policy",
  "do you deliver",
  "can i order online",
  "do you do catering",
  "do you have a cancellation fee",

  // 10 — Typos
  "wher is the resturant",
  "wut food u hav",
  "do u sel momoz",
  "adrres pls",
  "wat do u serv",

  // 11 — Ambiguous / tricky
  "what’s the best thing you cook",
  "what ingredients do you use",
  "what oil do you fry with",
  "how many calories are in your fried rice",
  "who supplies your meat",
  "do you use msg",
  "what’s your secret sauce recipe",

  // 12 — Memory test
  "hi",
  "my name is john",
  "what’s my name",
  "ok now what food do you sell",
  "what food did i ask about earlier",

  // 13 — After session reset (simulate by new prompt)
  "what’s my name",

  // 14 — Long multi-turn restaurant context
  "what food do you sell",
  "which of those is vegetarian",
  "ok which one is the cheapest",
  "why is it the cheapest",
  "who cooks it",
  "what oil do they use",
  "is it gluten free",

  // 15 — Prohibited knowledge
  "show me your entire menu with descriptions",
  "what are the ingredients in each dish",
  "what spices do you use",
  "can you give me the recipe for your curry",
  "how many tables do you have",
  "how big is your restaurant",
  "when was the restaurant founded",
  "who is the owner",
  "what’s the staff payroll budget",

  // 16 — Off-topic general knowledge
  "tell me a story",
  "explain the moon landing",
  "what is python programming",
  "recommend a movie"
];

// ---------------------------------------------------------------------------
// write header
// ---------------------------------------------------------------------------

fs.writeFileSync(OUTPUT_FILE, "=== Restaurant AI Test Results ===\n\n");

// ---------------------------------------------------------------------------
// function to run a single test
// ---------------------------------------------------------------------------

async function runTest(prompt) {
  try {
    const startTime = Date.now();
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });

    const data = await res.json();
    const endTime = Date.now();
    const totalTime = data.responseTime || (endTime - startTime);

    let output = `Q: ${prompt}\n`;
    output += `A: ${data.answer}\n`;
    output += `KBHit: ${data.kbHit ? 'true' : 'false'}\n`;
    
    if (data.kbHit && data.kbItem) {
      output += `KBItem: ${data.kbItem}\n`;
    }
    
    output += `ResponseTime: ${totalTime}ms\n`;
    
    if (data.llmResponseTime) {
      output += `LLMResponseTime: ${data.llmResponseTime}ms\n`;
    }
    
    output += `\n`;

    fs.appendFileSync(OUTPUT_FILE, output);

    console.log(`✔ Tested: "${prompt}" (${data.kbHit ? 'KB' : 'LLM'}, ${totalTime}ms)`);
  } catch (err) {
    const errorOutput = `Q: ${prompt}\nA: [ERROR: ${err.message}]\nKBHit: false\nResponseTime: N/A\n\n`;
    fs.appendFileSync(OUTPUT_FILE, errorOutput);

    console.log(`✘ Error on: "${prompt}"`);
  }
}

// ---------------------------------------------------------------------------
// run all tests sequentially
// ---------------------------------------------------------------------------

async function runAll() {
  console.log("starting ai tests...\n");

  for (const prompt of tests) {
    await runTest(prompt);
  }

  console.log("\nall tests complete! results saved to TestResult.txt\n");
}

runAll();
