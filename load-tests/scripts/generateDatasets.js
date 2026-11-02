/**
 * Dataset Generator for TalkSphere Load Testing [Phase 7]
 * Pre-seeds 2,000 synthetic virtual users with valid JWT tokens,
 * varied realistic chat messages, and a multi-page PDF document for RAG benchmarks.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('../../server/node_modules/jsonwebtoken');

const envConfig = require('../config/env.json');
const JWT_SECRET = envConfig.auth.jwtSecret || 'rajuyadav';

const DATASETS_DIR = path.resolve(__dirname, '../datasets');
if (!fs.existsSync(DATASETS_DIR)) {
  fs.mkdirSync(DATASETS_DIR, { recursive: true });
}

// 1. Generate 2,000 Mock Users with Pre-Signed JWT Tokens
console.log('Generating 2,000 mock users with pre-signed JWT tokens...');
const firstNames = ['Alex', 'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Lucas', 'Mia', 'Raju', 'Priya', 'David', 'Chloe', 'Daniel', 'Aria'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Yadav', 'Patel', 'Chen', 'Kim'];

const mockUsers = [];
for (let i = 1; i <= 2000; i++) {
  // Pad hex to 24 chars for valid Mongo ObjectId
  const hexId = '66f' + i.toString(16).padStart(21, '0');
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  const name = `${fn} ${ln} #${i}`;
  const username = `user_${i}`;
  const email = `user_${i}@talksphere.internal`;

  const token = jwt.sign(
    { id: hexId, username, email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  mockUsers.push({
    id: hexId,
    _id: hexId,
    name,
    username,
    email,
    token
  });
}

const mockUsersPath = path.join(DATASETS_DIR, 'mockUsers.json');
fs.writeFileSync(mockUsersPath, JSON.stringify(mockUsers, null, 2));
console.log(`✅ Saved ${mockUsers.length} mock users to ${mockUsersPath}`);

// 2. Generate Varied Test Messages
console.log('Generating varied test messages dataset...');
const testMessages = [
  { type: 'short', content: 'Hey, how are you doing today?' },
  { type: 'greeting', content: 'Good morning team! 👋 Ready for the sprint demo?' },
  { type: 'emoji', content: '🚀 TalkSphere v2.0 is live! Great work everyone! 🎉✨🔥' },
  { type: 'unicode', content: 'Testing internationalized Unicode: こんにちは, 你好, Здравствуйте, مرحبا, नमस्ते!' },
  { type: 'code_snippet', content: "```javascript\nconst { io } = require('socket.io-client');\nconst socket = io('http://localhost:5000');\nsocket.emit('send_message', { content: 'Ping' });\n```" },
  { type: 'markdown', content: '### Architecture Update\n- **Redis Adapter**: Horizontal scaling enabled\n- **Cursor Pagination**: O(1) indexed reads\n- **SFU WebRTC**: $O(N)$ streaming' },
  { type: 'long', content: 'This is a long technical inquiry regarding the distributed memory caching topology and event loop responsiveness under 2,000+ concurrent active WebSocket sessions. Can we verify that the Redis Pub/Sub adapter handles broadcast bursts without queue backpressure or unhandled promise rejections?' },
  { type: 'rag_query', content: 'What are the main security guidelines for API rate limiting and token revocation?' }
];

const testMessagesPath = path.join(DATASETS_DIR, 'testMessages.json');
fs.writeFileSync(testMessagesPath, JSON.stringify(testMessages, null, 2));
console.log(`✅ Saved ${testMessages.length} test message templates to ${testMessagesPath}`);

// 3. Generate Multi-Page Test PDF Document for RAG Ingestion Benchmark
console.log('Generating multi-page test PDF document for RAG benchmarks...');

/**
 * Minimal valid multi-page PDF binary builder without external heavyweight CLI
 */
function createMinimalPdfBuffer(pagesText) {
  let objectCount = 2; // 1 is Catalog, 2 is Pages
  const pageObjectIds = [];
  const textObjectIds = [];
  const objects = [];

  pagesText.forEach((text, idx) => {
    objectCount++;
    const pageId = objectCount;
    pageObjectIds.push(pageId);

    objectCount++;
    const contentId = objectCount;
    textObjectIds.push(contentId);

    // Escape parenthesis in text
    const cleanText = text.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    // Form simple PDF text stream
    const streamContent = `BT\n/F1 12 Tf\n50 750 Td\n(${cleanText}) Tj\nET`;
    const streamLength = Buffer.byteLength(streamContent);

    objects[contentId] = `${contentId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
    objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n`;
  });

  // Pages container object
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>\nendobj\n`;
  // Catalog object
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

  let pdfOutput = '%PDF-1.4\n';
  const xrefOffsets = [0];

  for (let i = 1; i <= objectCount; i++) {
    xrefOffsets[i] = Buffer.byteLength(pdfOutput);
    pdfOutput += objects[i];
  }

  const xrefStart = Buffer.byteLength(pdfOutput);
  pdfOutput += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;

  for (let i = 1; i <= objectCount; i++) {
    pdfOutput += String(xrefOffsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  pdfOutput += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdfOutput, 'binary');
}

const pagesText = [
  'TalkSphere Scalability & Architecture Specification - Page 1: Real-Time Engine, Redis PubSub and Horizontal Socket Clustering.',
  'TalkSphere Scalability & Architecture Specification - Page 2: High Concurrency Cursor-Based Database Pagination and Mongoose Connection Pooling.',
  'TalkSphere Scalability & Architecture Specification - Page 3: Distributed BullMQ Background Queue, PDF Parsing and Mongo Vector Grounding.',
  'TalkSphere Scalability & Architecture Specification - Page 4: WebRTC Signaling, Ephemeral HMAC-SHA1 TURN Relay and LiveKit Media Routing.'
];

const testPdfBuffer = createMinimalPdfBuffer(pagesText);
const testPdfPath = path.join(DATASETS_DIR, 'testDoc.pdf');
fs.writeFileSync(testPdfPath, testPdfBuffer);
console.log(`✅ Saved valid 4-page test PDF (${testPdfBuffer.length} bytes) to ${testPdfPath}`);

console.log('\nAll datasets pre-seeded successfully!');
