// testaiMemory.js
// focused test suite for memory-related issues
import fs from "fs";
import fetch from "node-fetch";

const OUTPUT_FILE = "TestResult_Memory.txt";

// ---------------------------------------------------------------------------
// memory test prompts - focused on problematic scenarios
// ---------------------------------------------------------------------------

const memoryTests = [
  // test 1: name recall (first attempt)
  "hi",
  "my name is john",
  "what's my name",
  
  // test 2: name recall (second attempt after other conversation)
  "ok now what food do you sell",
  "what's my name",
  
  // test 3: memory question about food
  "what food do you sell",
  "what food did i ask about earlier",
  
  // test 4: memory question about specific dish
  "what are momos",
  "what did i ask about earlier",
  
  // test 5: story hallucination test
  "tell me a story",
  
  // test 6: name recall with different name
  "hi",
  "my name is sarah",
  "what's my name",
  
  // test 7: memory question with multiple turns
  "what is your address?",
  "what time do you open?",
  "what did i ask about first?",
  
  // test 8: name recall after long conversation
  "hi",
  "my name is michael",
  "what food do you sell",
  "what are your most popular items",
  "do you have desserts",
  "what's my name",
  
  // test 9: memory question about name
  "hi",
  "my name is emily",
  "what did i tell you my name was?",
  
  // test 10: story test (should not mention restaurant)
  "tell me a story about a cat",
];

// ---------------------------------------------------------------------------
// write header
// ---------------------------------------------------------------------------

fs.writeFileSync(OUTPUT_FILE, "=== Memory Test Results ===\n");
fs.writeFileSync(OUTPUT_FILE, "Testing: Name recall, memory questions, story hallucinations\n\n", { flag: 'a' });

// ---------------------------------------------------------------------------
// function to run a single test
// ---------------------------------------------------------------------------

async function runTest(prompt, testNumber) {
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

    let output = `\n--- Test ${testNumber} ---\n`;
    output += `Q: ${prompt}\n`;
    output += `A: ${data.answer}\n`;
    output += `KBHit: ${data.kbHit ? 'true' : 'false'}\n`;
    
    if (data.kbHit && data.kbItem) {
      output += `KBItem: ${data.kbItem}\n`;
    }
    
    output += `ResponseTime: ${totalTime}ms\n`;
    
    if (data.llmResponseTime) {
      output += `LLMResponseTime: ${data.llmResponseTime}ms\n`;
    }
    
    // add validation status
    if (data.answer.toLowerCase().includes('[name') || 
        data.answer.toLowerCase().includes('not recorded') ||
        data.answer.toLowerCase().includes('not provided') ||
        data.answer.toLowerCase().includes('not available')) {
      output += `⚠️ VALIDATION ISSUE: Name placeholder or "not found" response detected\n`;
    }
    
    if (prompt.toLowerCase().includes('tell me a story') && 
        data.answer.toLowerCase().includes('himalayan house')) {
      output += `⚠️ VALIDATION ISSUE: Story mentions restaurant (should be caught)\n`;
    }

    fs.appendFileSync(OUTPUT_FILE, output);

    console.log(`✔ Test ${testNumber}: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}" (${data.kbHit ? 'KB' : 'LLM'}, ${totalTime}ms)`);
  } catch (err) {
    const errorOutput = `\n--- Test ${testNumber} ---\nQ: ${prompt}\nA: [ERROR: ${err.message}]\nKBHit: false\nResponseTime: N/A\n\n`;
    fs.appendFileSync(OUTPUT_FILE, errorOutput);

    console.log(`✘ Error on test ${testNumber}: "${prompt}"`);
  }
}

// ---------------------------------------------------------------------------
// run all memory tests sequentially
// ---------------------------------------------------------------------------

async function runAll() {
  console.log("starting memory tests...\n");
  console.log(`total tests: ${memoryTests.length}\n`);

  for (let i = 0; i < memoryTests.length; i++) {
    await runTest(memoryTests[i], i + 1);
    // small delay between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log("\nall memory tests complete! results saved to TestResult_Memory.txt\n");
  console.log("check the output file for validation issue markers (⚠️)\n");
}

runAll();
