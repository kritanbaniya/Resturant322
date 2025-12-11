/**
 * migration script to import knowledge.json into mongodb
 * creates knowledge base entries with embeddings for vector search
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const KnowledgeBaseEntry = require('../models/KnowledgeBase');
const { embedText } = require('../resturantAI/utils/embeddings');
const { createKbChunks } = require('../resturantAI/utils/vectorSearch');

async function migrateKnowledgeBase() {
  try {
    // connect to mongodb
    console.log('[migrate] connecting to mongodb...');
    await mongoose.connect(config.MONGO_URI);
    console.log('[migrate] connected to mongodb');

    // load knowledge.json
    const kbPath = path.join(__dirname, '../resturantAI/kb/knowledge.json');
    if (!fs.existsSync(kbPath)) {
      throw new Error(`knowledge.json not found at ${kbPath}`);
    }

    const kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    console.log('[migrate] loaded knowledge.json');

    // clear existing entries (optional - comment out if you want to keep existing)
    const existingCount = await KnowledgeBaseEntry.countDocuments();
    if (existingCount > 0) {
      console.log(`[migrate] found ${existingCount} existing entries. clearing...`);
      await KnowledgeBaseEntry.deleteMany({});
      console.log('[migrate] cleared existing entries');
    }

    // create chunks from knowledge base
    console.log('[migrate] creating chunks from knowledge base...');
    const chunks = createKbChunks(kb);
    console.log(`[migrate] created ${chunks.length} chunks`);

    // create entries with embeddings
    console.log('[migrate] generating embeddings and saving to mongodb...');
    let saved = 0;
    let failed = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i];
        
        // generate embedding
        const embedding = await embedText(chunk.text);
        
        // extract keywords from metadata
        const keywords = [];
        if (chunk.metadata.type) keywords.push(chunk.metadata.type);
        if (chunk.metadata.category) keywords.push(chunk.metadata.category);
        if (chunk.metadata.field) keywords.push(chunk.metadata.field);
        
        // create question text from chunk
        const questionText = chunk.text;
        
        // create answer text from formatted answer
        let answerText = chunk.text;
        if (chunk.metadata.type === 'menu_item' && chunk.metadata.item) {
          const item = chunk.metadata.item;
          answerText = item.name;
          if (item.description) answerText += `: ${item.description}`;
          if (item.approx_price) answerText += ` Price: ${item.approx_price}`;
        } else if (chunk.metadata.type === 'faq' && chunk.metadata.faq) {
          answerText = chunk.metadata.faq.answer;
        } else if (chunk.metadata.type === 'location' && chunk.metadata.location) {
          const loc = chunk.metadata.location;
          if (chunk.metadata.field === 'address') {
            answerText = loc.address;
          } else if (chunk.metadata.field === 'hours') {
            const hoursText = Object.entries(loc.hours || {}).map(([day, time]) => `${day}: ${time}`).join(', ');
            answerText = hoursText;
          } else if (chunk.metadata.field === 'phone') {
            answerText = loc.phone;
          }
        } else {
          // remove prefix from text
          answerText = chunk.text.replace(/^(restaurant|location|menu|faq|policy|allergy)\s+\w+:\s*/, '');
        }

        // create knowledge base entry
        const entry = new KnowledgeBaseEntry({
          questionText: questionText,
          answerText: answerText,
          keywords: keywords,
          embedding: embedding,
          metadata: chunk.metadata,
          flagged: false,
          reviewCount: 0,
          averageRating: null
        });

        await entry.save();
        saved++;

        if ((i + 1) % 10 === 0) {
          console.log(`[migrate] processed ${i + 1}/${chunks.length} chunks (saved: ${saved}, failed: ${failed})`);
        }
      } catch (error) {
        console.error(`[migrate] failed to save chunk ${i}:`, error.message);
        failed++;
      }
    }

    console.log(`[migrate] migration complete! saved: ${saved}, failed: ${failed}`);
    console.log(`[migrate] total entries in database: ${await KnowledgeBaseEntry.countDocuments()}`);

    await mongoose.disconnect();
    console.log('[migrate] disconnected from mongodb');
    process.exit(0);
  } catch (error) {
    console.error('[migrate] migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// run migration
migrateKnowledgeBase();
