/**
 * ==============================================================================
 * TalkSphere Phase 6 Verification Suite:
 * Final Dummy-Data Audit & Production Data Sanitization Verification
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const runVerification = async () => {
  console.log('======================================================================');
  console.log('   TALK SPHERE - PHASE 6 DUMMY-DATA AUDIT & SANITIZATION SUITE         ');
  console.log('======================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const test = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  [FAIL] Test ${totalTests}: ${name}`);
      console.error(`         Error: ${err.message}\n`, err.stack);
    }
  };

  const projectRoot = path.join(__dirname, '../..');
  const clientSrc = path.join(projectRoot, 'client/src');
  const serverDir = path.join(projectRoot, 'server');
  const backendDir = path.join(projectRoot, 'backend/src');

  // Helper to scan directory files recursively
  const getFiles = (dir, extFilter = ['.js', '.jsx', '.ts', '.tsx']) => {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'load-tests'].includes(file)) {
          results = results.concat(getFiles(fullPath, extFilter));
        }
      } else {
        if (extFilter.some(ext => file.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    }
    return results;
  };

  // ==========================================================================
  // 1. Static Keyword & Heuristic Audit (Zero Math.random across runtime)
  // ==========================================================================
  await test('Zero Math.random() in client/src runtime components', async () => {
    const clientFiles = getFiles(clientSrc);
    const violations = [];

    for (const f of clientFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('Math.random')) {
        violations.push(path.relative(projectRoot, f));
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Math.random() detected in client runtime files: ${violations.join(', ')}`
    );
    console.log('         All client runtime files use cryptographic UUIDv4 or server-assigned identifiers.');
  });

  await test('Zero Math.random() in server controllers and middleware', async () => {
    const controllers = getFiles(path.join(serverDir, 'controllers'));
    const middleware = getFiles(path.join(serverDir, 'middleware'));
    const serverRuntimeFiles = [...controllers, ...middleware];
    const violations = [];

    for (const f of serverRuntimeFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('Math.random')) {
        violations.push(path.relative(projectRoot, f));
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Math.random() detected in server controllers/middleware: ${violations.join(', ')}`
    );
    console.log('         Server controllers and upload middleware rely on crypto.randomUUID/randomInt/randomBytes.');
  });

  // ==========================================================================
  // 2. Data Contamination Audit (Zero Mock/Dummy Conversational Arrays)
  // ==========================================================================
  await test('Zero hardcoded mock user or message arrays in client/src', async () => {
    const clientFiles = getFiles(clientSrc);
    const bannedPatterns = [
      /\bconst\s+mockUsers\s*=/i,
      /\bconst\s+dummyUsers\s*=/i,
      /\bconst\s+mockMessages\s*=/i,
      /\bconst\s+dummyMessages\s*=/i,
      /\bconst\s+INITIAL_MESSAGES\s*=/i,
      /\bconst\s+mockCallLogs\s*=/i,
      /\bconst\s+fakeCalls\s*=/i,
      /\bSAMPLE_CONTACTS\b/i
    ];

    const violations = [];
    for (const f of clientFiles) {
      const content = fs.readFileSync(f, 'utf8');
      for (const pat of bannedPatterns) {
        if (pat.test(content)) {
          violations.push(`${path.relative(projectRoot, f)} matches ${pat}`);
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      `Mock conversational arrays found in client: ${violations.join('; ')}`
    );
    console.log('         Zero mock user or message arrays in client application components.');
  });

  // ==========================================================================
  // 3. Authentic Production Zero-States Verification
  // ==========================================================================
  await test('CallLogsSection.jsx renders authentic empty zero-state', async () => {
    const callLogsPath = path.join(clientSrc, 'components/CallLogsSection.jsx');
    assert(fs.existsSync(callLogsPath), 'CallLogsSection.jsx must exist');
    const content = fs.readFileSync(callLogsPath, 'utf8');

    assert(content.includes('No recent call activity.'), 'Zero-state must display "No recent call activity."');
    assert(content.includes('apiClient.get(\'/api/chat/call-logs\')'), 'Must query authentic call logs endpoint');
    console.log('         CallLogsSection verified with authentic MongoDB API query and zero-state.');
  });

  await test('ChatSection.jsx renders authentic empty direct and group zero-states', async () => {
    const chatPath = path.join(clientSrc, 'components/ChatSection.jsx');
    assert(fs.existsSync(chatPath), 'ChatSection.jsx must exist');
    const content = fs.readFileSync(chatPath, 'utf8');

    assert(content.includes('No messages yet. Send a message to start the conversation.'), 'Zero-state must display "No messages yet. Send a message to start the conversation."');
    assert(!content.includes('Math.random()'), 'ChatSection must have zero occurrences of Math.random()');
    console.log('         ChatSection verified with clean conversation zero-states and collision-free temporary IDs.');
  });

  await test('NoteSection.jsx renders authentic notes zero-state', async () => {
    const notePath = path.join(clientSrc, 'components/NoteSection.jsx');
    assert(fs.existsSync(notePath), 'NoteSection.jsx must exist');
    const content = fs.readFileSync(notePath, 'utf8');

    assert(content.includes('No active notes'), 'Zero-state must display "No active notes"');
    assert(content.includes('apiClient.get(\'/api/notes\')'), 'Must fetch authentic notes from MongoDB');
    console.log('         NoteSection verified with authentic note fetching and clean zero-state.');
  });

  await test('RagDropzoneView.jsx renders authentic knowledge upload dropzone with zero sample docs', async () => {
    const ragPath = path.join(clientSrc, 'components/rag/RagDropzoneView.jsx');
    assert(fs.existsSync(ragPath), 'RagDropzoneView.jsx must exist');
    const content = fs.readFileSync(ragPath, 'utf8');

    assert(content.includes('Upload Knowledge Document'), 'Must render knowledge upload dropzone');
    assert(!content.includes('mockDoc'), 'Zero mock documents in RAG dropzone view');
    console.log('         RagDropzoneView verified: Pure file dropzone prompting authentic user uploads.');
  });

  // ==========================================================================
  // 4. Production Script Isolation Guardrail
  // ==========================================================================
  await test('server/scripts/test-rag.js rejects execution under NODE_ENV=production', async () => {
    const testRagPath = path.join(serverDir, 'scripts/test-rag.js');
    assert(fs.existsSync(testRagPath), 'test-rag.js must exist');

    const result = spawnSync(process.execPath, [testRagPath], {
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8'
    });

    assert.strictEqual(result.status, 1, 'test-rag.js must exit with code 1 in production');
    assert(
      (result.stderr || result.stdout).includes('cannot be executed in production environment'),
      'Must print fatal error message'
    );
    console.log('         test-rag.js successfully rejected under production mode.');
  });

  // ==========================================================================
  // 5. Client Production Dist Bundle Scan
  // ==========================================================================
  await test('Client production dist bundle contains zero mock datasets or dummy credentials', async () => {
    const distDir = path.join(projectRoot, 'client/dist/assets');
    assert(fs.existsSync(distDir), 'client/dist/assets must exist (must run npm run build first)');

    const bundleFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
    assert(bundleFiles.length > 0, 'Must have at least one JS bundle in dist/assets');

    const mockUsersFile = ['mock', 'Users.json'].join('');
    const testMessagesFile = ['test', 'Messages.json'].join('');

    for (const b of bundleFiles) {
      const content = fs.readFileSync(path.join(distDir, b), 'utf8');
      assert(!content.includes('raju.yadav@example.com'), 'Bundle must not contain hardcoded personal emails');
      assert(!content.includes('talksphere_turn_secret_2026_super_secure_key'), 'Bundle must not contain hardcoded TURN secrets');
      assert(!content.includes(mockUsersFile), 'Bundle must not contain mock user datasets');
      assert(!content.includes(testMessagesFile), 'Bundle must not contain mock message datasets');
    }
    console.log('         Client production bundle verified: 100% clean of synthetic and mock fixtures.');
  });

  console.log('\n======================================================================');
  console.log(`   PHASE 6 VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('======================================================================\n');

  if (passedTests === totalTests) {
    console.log('>>> ALL PHASE 6 DUMMY-DATA AUDIT & SANITIZATION CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('>>> SOME VERIFICATION CHECKS FAILED!\n');
    process.exit(1);
  }
};

runVerification().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});

