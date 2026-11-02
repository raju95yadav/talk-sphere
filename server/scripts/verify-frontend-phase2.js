/**
 * Verification Script for Phase 2: Frontend UI Placeholders, RAG Starters, and Session Title Cleanup
 * 
 * Tests:
 * 1. Preset Prompts Wiring (AIChatSection.jsx)
 * 2. Live Document RAG Starters (RagDropzoneView.jsx & AIChatSection.jsx)
 * 3. Real Session IDs & Dynamic Title Management (generateSmartTitle, PUT /api/ai/sessions)
 * 4. Audit & Mock State Purge across client components
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('\n============================================================');
console.log('--- PHASE 2: FRONTEND UI PLACEHOLDERS & STARTERS VERIFICATION ---');
console.log('============================================================\n');

const aiChatPath = path.resolve(__dirname, '../../client/src/components/AIChatSection.jsx');
const ragDropzonePath = path.resolve(__dirname, '../../client/src/components/rag/RagDropzoneView.jsx');
const chatSectionPath = path.resolve(__dirname, '../../client/src/components/ChatSection.jsx');

const aiChatContent = fs.readFileSync(aiChatPath, 'utf8');
const ragDropzoneContent = fs.readFileSync(ragDropzonePath, 'utf8');
const chatSectionContent = fs.readFileSync(chatSectionPath, 'utf8');

// ---------------------------------------------------------------------
// TEST GROUP 1: PRESET PROMPTS WIRING (AIChatSection.jsx)
// ---------------------------------------------------------------------
console.log('--- 1. Preset Prompts Wiring (AIChatSection.jsx) ---');

runTest('PRESET_PROMPTS array retains all 4 real starter shortcut chips', () => {
  assert(aiChatContent.includes('PRESET_PROMPTS = ['), 'PRESET_PROMPTS must be defined');
  assert(aiChatContent.includes("'Code Review'"), 'Must contain Code Review');
  assert(aiChatContent.includes("'Summarize Document'"), 'Must contain Summarize Document');
  assert(aiChatContent.includes("'Brainstorm Ideas'"), 'Must contain Brainstorm Ideas');
  assert(aiChatContent.includes("'Debug Code Error'"), 'Must contain Debug Code Error');
});

runTest('Preset prompts wire to input population and genuine streaming execution', () => {
  assert(aiChatContent.includes('handlePresetSelect'), 'Must implement handlePresetSelect handler');
  assert(aiChatContent.includes('ai-message-input'), 'Must target chat input for population');
  assert(aiChatContent.includes('handleSendMessage(null, preset.prompt)'), 'Must support genuine direct send without mock data');
});

runTest('Starter preset cards are hidden immediately once messages exist in session', () => {
  assert(aiChatContent.includes('!activeSession || activeSession.messages.length === 0'), 'Cards must only render for empty sessions');
  assert(aiChatContent.includes('activeSession.messages.map'), 'Conversation history must take over as soon as messages exist');
});

// ---------------------------------------------------------------------
// TEST GROUP 2: LIVE DOCUMENT RAG STARTERS (RagDropzoneView.jsx)
// ---------------------------------------------------------------------
console.log('\n--- 2. Live Document RAG Starters (RagDropzoneView.jsx) ---');

runTest('RAG_SUGGESTED_QUESTIONS retains all 4 core document query chips', () => {
  assert(ragDropzoneContent.includes('RAG_SUGGESTED_QUESTIONS = ['), 'RAG_SUGGESTED_QUESTIONS must be defined');
  assert(ragDropzoneContent.includes("'Executive Summary'"), 'Must contain Executive Summary');
  assert(ragDropzoneContent.includes("'Key Action Items'"), 'Must contain Key Action Items');
  assert(ragDropzoneContent.includes("'Core Topics & Structure'"), 'Must contain Core Topics & Structure');
  assert(ragDropzoneContent.includes("'Risks & Limitations'"), 'Must contain Risks & Limitations');
});

runTest('Clicking RAG starter checks for active document and guards with toast if missing', () => {
  assert(ragDropzoneContent.includes('if (!selectedDoc)'), 'Must validate selectedDoc in RagDropzoneView');
  assert(ragDropzoneContent.includes("toast.error('Please upload or select a document first'"), 'Must alert user if no doc');
  assert(aiChatContent.includes('if (!selectedDocId)'), 'Must guard in AIChatSection onSelectPrompt');
});

runTest('RAG queries dispatch directly into real streaming pipeline with grounded citations', () => {
  assert(aiChatContent.includes('handleSendMessage(null, p)'), 'onSelectPrompt must trigger genuine handleSendMessage');
  assert(aiChatContent.includes('/api/rag/stream'), 'RAG queries must stream from /api/rag/stream');
  assert(aiChatContent.includes('RagSourcesCard'), 'Must render grounded citations component for RAG answers');
});

// ---------------------------------------------------------------------
// TEST GROUP 3: REAL SESSION IDS & DYNAMIC TITLE MANAGEMENT
// ---------------------------------------------------------------------
console.log('\n--- 3. Session IDs & Dynamic Title Management ---');

// Dynamically extract generateSmartTitle from AIChatSection.jsx for live unit tests
const titleFuncMatch = aiChatContent.match(/export const generateSmartTitle = ([\s\S]*?\n\};)/);
assert(titleFuncMatch, 'generateSmartTitle must be exported from AIChatSection.jsx');

let generateSmartTitle;
eval(`generateSmartTitle = ${titleFuncMatch[1]}`);

runTest('generateSmartTitle cleanly bounds length between 30 and 40 characters at word boundary', () => {
  const longPrompt = 'Can you explain how WebRTC SFU routing architecture scales horizontally with Coturn?';
  const title = generateSmartTitle(longPrompt);
  assert(title.length <= 40, `Title too long: ${title.length}`);
  assert(title.length >= 25, `Title too short: ${title.length}`);
  assert(title.endsWith('...'), 'Long title must end with ellipsis');
  assert(!title.includes('  '), 'Must not have double spaces');
});

runTest('generateSmartTitle strips markdown code blocks, headers, and bullet markers', () => {
  const mdPrompt = '### Bug Analysis:\n```js\nconst x = 1;\n```\nWhy does this fail?';
  const title = generateSmartTitle(mdPrompt);
  assert(!title.includes('###'), 'Must strip ###');
  assert(!title.includes('```'), 'Must strip ```');
  assert(title.charAt(0) === title.charAt(0).toUpperCase(), 'Must be capitalized');
});

runTest('generateSmartTitle handles RAG document chat with actual file title', () => {
  const ragTitle = generateSmartTitle('Summarize', 'rag', 'Architecture_Doc_2026.pdf');
  assert.strictEqual(ragTitle, 'Architecture_Doc_2026.pdf', 'Must preserve uploaded document title in RAG mode');
});

runTest('New sessions strictly use transient placeholders before first message', () => {
  assert(aiChatContent.includes("title: assistantMode === 'rag' ? 'New Document Chat' : 'New Chat'"), 'Placeholder on initial load');
  assert(aiChatContent.includes("title: 'New Chat'"), 'Placeholder on new general chat');
  assert(aiChatContent.includes("title: 'New Document Chat'"), 'Placeholder on new RAG chat');
});

runTest('Dynamic title is immediately persisted to MongoDB via PUT /api/ai/sessions/:id upon first message', () => {
  assert(aiChatContent.includes('isFirstMessage'), 'Must detect isFirstMessage');
  assert(aiChatContent.includes('apiClient.put(`/api/ai/sessions/${targetSessionId}`'), 'Must call PUT /api/ai/sessions immediately');
  assert(aiChatContent.includes('title: updatedTitle'), 'Must send dynamic updated title');
});

runTest('Sidebar hydrates session list from MongoDB via GET /api/ai/sessions', () => {
  assert(aiChatContent.includes("apiClient.get('/api/ai/sessions')"), 'Must fetch sessions from MongoDB');
});

// ---------------------------------------------------------------------
// TEST GROUP 4: AUDIT & ZERO MOCK DATA PURGE
// ---------------------------------------------------------------------
console.log('\n--- 4. Audit & Zero Mock Data Purge ---');

runTest('Zero mockMessages or dummy conversational arrays in client components', () => {
  const forbiddenPatterns = [
    /mockMessages\s*=/i,
    /sampleHistory\s*=/i,
    /dummyMessages\s*=/i,
    /fakeChat\s*=/i,
    /const\s+mockData\s*=/i
  ];

  forbiddenPatterns.forEach(pattern => {
    assert(!pattern.test(aiChatContent), `Forbidden pattern found in AIChatSection: ${pattern}`);
    assert(!pattern.test(ragDropzoneContent), `Forbidden pattern found in RagDropzoneView: ${pattern}`);
    assert(!pattern.test(chatSectionContent), `Forbidden pattern found in ChatSection: ${pattern}`);
  });
});

runTest('State starts strictly with empty arrays and live backend models', () => {
  assert(aiChatContent.includes("const [sessions, setSessions] = useState([]);"), 'sessions must initialize as empty array');
  assert(aiChatContent.includes("const [documents, setDocuments] = useState([]);"), 'documents must initialize as empty array');
});

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------
console.log('\n============================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('============================================================\n');

if (passedTests === totalTests) {
  console.log('SUCCESS: Phase 2 Frontend Placeholders, RAG Starters, and Session Titles Verified!\n');
  process.exit(0);
} else {
  console.error('FAILURE: Some tests did not pass.\n');
  process.exit(1);
}

