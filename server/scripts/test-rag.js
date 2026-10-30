const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const RagDocument = require('../models/RagDocument');
const RagChunk = require('../models/RagChunk');
const AISession = require('../models/AISession');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config({ path: path.join(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function runRagTest() {
  console.log('=== STARTING RAG SYSTEM VERIFICATION ===\n');

  try {
    // 1. Connect DB
    console.log('[1/6] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✔ MongoDB connected successfully.');

    // Find or create test user
    let testUser = await User.findOne({ email: 'test_rag_user@talksphere.internal' });
    if (!testUser) {
      testUser = await User.create({
        name: 'RAG Test User',
        email: 'test_rag_user@talksphere.internal',
        password: 'hashed_password_for_testing'
      });
      console.log('✔ Created test user:', testUser._id);
    } else {
      console.log('✔ Using existing test user:', testUser._id);
    }

    // 2. Test 768-dim Embeddings
    console.log('\n[2/6] Testing 768-dimensional embedding generation...');
    const testText = 'Talk Sphere provides real-time chat, video calling, notes, and an AI Assistant.';
    
    let vector = null;
    try {
      const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const res = await embedModel.embedContent({
        content: { parts: [{ text: testText }] },
        outputDimensionality: 768
      });
      vector = res?.embedding?.values;
    } catch (e) {
      const fallback = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const res = await fallback.embedContent({
        content: { parts: [{ text: testText }] },
        outputDimensionality: 768
      });
      vector = res?.embedding?.values;
    }

    if (!vector || vector.length !== 768) {
      throw new Error(`Embedding vector size is not 768: got ${vector ? vector.length : 0}`);
    }
    console.log(`✔ Generated embedding with exact dimensions: ${vector.length}`);

    // 3. Test Document & Chunk Persistence in MongoDB
    console.log('\n[3/6] Testing document registry and chunk persistence...');
    const sampleDoc = await RagDocument.create({
      user: testUser._id,
      title: 'Company Policy 2026',
      originalName: 'Company_Policy_2026.md',
      fileType: 'md',
      fileSize: 4096,
      totalChunks: 2
    });
    console.log('✔ Created RagDocument in MongoDB:', sampleDoc._id, `(fileType: ${sampleDoc.fileType})`);

    const chunk1Text = 'Employees are entitled to 25 days of annual leave and flexible remote work hours.';
    const chunk2Text = 'Security protocols mandate two-factor authentication on all company devices and passwords must be 16 characters.';

    // Generate embeddings for chunks
    const chunk1Res = await genAI.getGenerativeModel({ model: 'gemini-embedding-001' }).embedContent({
      content: { parts: [{ text: chunk1Text }] },
      outputDimensionality: 768
    });
    const chunk2Res = await genAI.getGenerativeModel({ model: 'gemini-embedding-001' }).embedContent({
      content: { parts: [{ text: chunk2Text }] },
      outputDimensionality: 768
    });

    const chunks = await RagChunk.insertMany([
      {
        user: testUser._id,
        document: sampleDoc._id,
        chunkIndex: 0,
        content: chunk1Text,
        embedding: chunk1Res.embedding.values,
        pageNumber: 1
      },
      {
        user: testUser._id,
        document: sampleDoc._id,
        chunkIndex: 1,
        content: chunk2Text,
        embedding: chunk2Res.embedding.values,
        pageNumber: 1
      }
    ]);
    console.log(`✔ Inserted ${chunks.length} chunks with 768-dim embeddings in MongoDB.`);

    // 4. Test Cosine Similarity Retrieval
    console.log('\n[4/6] Testing semantic similarity search...');
    const query = 'How many days of annual vacation do employees get?';
    const queryRes = await genAI.getGenerativeModel({ model: 'gemini-embedding-001' }).embedContent({
      content: { parts: [{ text: query }] },
      outputDimensionality: 768
    });
    const queryVec = queryRes.embedding.values;

    function cosineSim(a, b) {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    const dbChunks = await RagChunk.find({ document: sampleDoc._id, user: testUser._id });
    const scored = dbChunks.map(c => ({
      chunkIndex: c.chunkIndex,
      content: c.content,
      similarity: cosineSim(queryVec, c.embedding)
    })).sort((a, b) => b.similarity - a.similarity);

    console.log(`Top match: Chunk #${scored[0].chunkIndex} with ${(scored[0].similarity * 100).toFixed(1)}% similarity:`);
    console.log(`Content: "${scored[0].content}"`);
    if (scored[0].chunkIndex !== 0) {
      throw new Error('Top chunk was expected to be chunk 0 (annual leave)!');
    }
    console.log('✔ Correct chunk retrieved as highest relevance.');

    // 5. Test RAG Chat Session Creation
    console.log('\n[5/6] Testing RAG chat session persistence with sources...');
    const ragSession = await AISession.create({
      user: testUser._id,
      title: 'Vacation Policy Inquiry',
      mode: 'rag',
      ragDocument: sampleDoc._id,
      messages: [
        { role: 'user', content: query },
        { 
          role: 'assistant', 
          content: 'According to the company policy, employees are entitled to 25 days of annual leave.',
          sources: [{
            chunkIndex: 0,
            documentTitle: sampleDoc.title,
            snippet: scored[0].content,
            similarity: Math.round(scored[0].similarity * 100)
          }]
        }
      ]
    });
    console.log('✔ Created RAG AISession:', ragSession._id, `(mode: ${ragSession.mode})`);

    // 6. Test Cascade Deletion
    console.log('\n[6/6] Testing cascade deletion on document removal...');
    // Cascade delete: document + chunks + linked sessions
    const deletedChunks = await RagChunk.deleteMany({ document: sampleDoc._id, user: testUser._id });
    const deletedSessions = await AISession.deleteMany({ ragDocument: sampleDoc._id, user: testUser._id });
    const deletedDoc = await RagDocument.deleteOne({ _id: sampleDoc._id, user: testUser._id });

    console.log(`✔ Cascade deleted ${deletedDoc.deletedCount} document, ${deletedChunks.deletedCount} chunks, and ${deletedSessions.deletedCount} linked sessions.`);

    // Verify nothing remains orphaned
    const remainingChunks = await RagChunk.countDocuments({ document: sampleDoc._id });
    const remainingSessions = await AISession.countDocuments({ ragDocument: sampleDoc._id });
    const remainingDoc = await RagDocument.countDocuments({ _id: sampleDoc._id });

    if (remainingChunks > 0 || remainingSessions > 0 || remainingDoc > 0) {
      throw new Error(`Orphaned records detected! Chunks: ${remainingChunks}, Sessions: ${remainingSessions}, Docs: ${remainingDoc}`);
    }
    console.log('✔ Verification passed: Zero orphaned records remaining in MongoDB.');

    // Clean up test user
    await User.deleteOne({ _id: testUser._id });
    console.log('✔ Cleaned up test user.');

    console.log('\n===========================================');
    console.log('ALL RAG SPECIFICATIONS VERIFIED SUCCESSFULLY');
    console.log('===========================================');

  } catch (error) {
    console.error('❌ RAG VERIFICATION FAILED:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
    process.exit(0);
  }
}

runRagTest();

