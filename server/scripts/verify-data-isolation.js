/**
 * Phase 1 Data Isolation Verification Suite
 * Verifies that synthetic datasets, generator scripts, and load test tokens
 * remain strictly isolated from production bundles, API routes, and database instances.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const jwt = require('../node_modules/jsonwebtoken');

let totalTests = 0;
let passedTests = 0;

function assert(condition, name, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name} - ${details}`);
  }
}

async function runVerification() {
  console.log('========================================================================');
  console.log('🔒 TALKSPHERE DATA ISOLATION & SYNTHETIC DATA PROTECTION VERIFICATION');
  console.log('========================================================================\n');

  // Check 1: Codebase Boundary & Absence of Mock Imports in Client / Server
  console.log('--- 1. Codebase Boundary & Bundler Exclusions ---');
  function scanForImports(dir) {
    let leaks = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) {
        if (!['node_modules', '.git', 'dist'].includes(f.name)) {
          leaks = leaks.concat(scanForImports(full));
        }
      } else if (f.isFile() && (f.name.endsWith('.js') || f.name.endsWith('.jsx'))) {
        const c = fs.readFileSync(full, 'utf8');
        if (c.includes('mockUsers.json') || c.includes('testMessages.json') || c.includes('load-tests/datasets')) {
          leaks.push(full);
        }
      }
    });
    return leaks;
  }

  const clientLeaks = scanForImports(path.resolve(__dirname, '../../client/src'));
  const serverLeaks = scanForImports(path.resolve(__dirname, '..')).filter(f => !f.includes('verify-data-isolation.js'));

  assert(clientLeaks.length === 0, 'No client source file imports load-tests datasets', clientLeaks.join(', '));
  assert(serverLeaks.length === 0, 'No server runtime source file imports load-tests datasets', serverLeaks.join(', '));

  // Check Vite build config
  const viteConfig = fs.readFileSync(path.resolve(__dirname, '../../client/vite.config.js'), 'utf8');
  assert(viteConfig.includes('mockUsers') && viteConfig.includes('external'), 'client/vite.config.js explicitly excludes mock datasets from build rollupOptions');

  // Check 2: Production Guardrail on Dataset Generator & Runner
  console.log('\n--- 2. Runtime Environment Guardrails ---');
  let genProdFailed = false;
  try {
    cp.execSync('node load-tests/scripts/generateDatasets.js', {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe'
    });
  } catch (err) {
    genProdFailed = true;
    const output = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
    assert(output.includes('FATAL') && output.includes('production environment'), 'generateDatasets.js aborts immediately with FATAL error when NODE_ENV=production');
  }
  assert(genProdFailed, 'generateDatasets.js strictly refuses execution under NODE_ENV=production');

  let runnerProdFailed = false;
  try {
    cp.execSync('node load-tests/runner.js', {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe'
    });
  } catch (err) {
    runnerProdFailed = true;
    const output = (err.stderr?.toString() || '') + (err.stdout?.toString() || '');
    assert(output.includes('FATAL') && output.includes('production environment'), 'runner.js aborts immediately with FATAL error when NODE_ENV=production');
  }
  assert(runnerProdFailed, 'runner.js strictly refuses execution under NODE_ENV=production');

  // Check 3: Synthetic JWT Rejection on Protected Production Endpoints
  console.log('\n--- 3. Synthetic JWT & Token Rejection in Production ---');
  const { protect, LOAD_TEST_JWT_SECRET } = require('../middleware/authMiddleware');
  assert(typeof LOAD_TEST_JWT_SECRET === 'string' && LOAD_TEST_JWT_SECRET.length > 20, 'Dedicated LOAD_TEST_JWT_SECRET defined');

  // Create a synthetic token
  const syntheticToken = jwt.sign(
    { id: '66f000000000000000000001', username: 'mock_test_user', isSyntheticLoadTest: true },
    LOAD_TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Test protect middleware rejection in production mode
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'super-secure-production-key-9988';

  let middlewareRejected = false;
  let responseStatusCode = null;
  let responseMessage = null;

  const mockReq = {
    headers: { authorization: `Bearer ${syntheticToken}` }
  };
  const mockRes = {
    status: function (code) {
      responseStatusCode = code;
      return this;
    },
    json: function (payload) {
      responseMessage = payload.message;
      middlewareRejected = true;
    }
  };
  const mockNext = () => {};

  await protect(mockReq, mockRes, mockNext);

  assert(middlewareRejected, 'Production authMiddleware rejects synthetic load-test token');
  assert(responseStatusCode === 401, 'Production authMiddleware returns HTTP 401 Unauthorized');
  assert(responseMessage.includes('strictly forbidden in production'), 'Rejection error explicitly cites synthetic credential prohibition');

  process.env.NODE_ENV = originalEnv;

  // Check 4: Packaging, Dockerignore & Local Datasets Integrity
  console.log('\n--- 4. Packaging, Dockerignore & Dataset Integrity ---');
  const rootDockerignore = fs.readFileSync(path.resolve(__dirname, '../../.dockerignore'), 'utf8');
  assert(rootDockerignore.includes('load-tests'), 'Root .dockerignore excludes load-tests directory');

  const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
  assert(gitignore.includes('load-tests/reports/benchmark_results.json'), '.gitignore excludes raw load test result dumps');

  const datasetsDir = path.resolve(__dirname, '../../load-tests/datasets');
  const mockUsers = require(path.join(datasetsDir, 'mockUsers.json'));
  const testMessages = require(path.join(datasetsDir, 'testMessages.json'));
  const testPdfExists = fs.existsSync(path.join(datasetsDir, 'testDoc.pdf'));

  assert(mockUsers.length === 2000, 'mockUsers.json intact with 2,000 synthetic test profiles');
  assert(testMessages.length > 5, 'testMessages.json intact with varied message templates');
  assert(testPdfExists, 'testDoc.pdf intact for local RAG benchmarking');

  // Check 5: Client Production Build Artifact Scan
  console.log('\n--- 5. Client Production Dist Bundle Scan ---');
  const distDir = path.resolve(__dirname, '../../client/dist');
  let distClean = true;
  if (fs.existsSync(distDir)) {
    function scanDist(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) scanDist(full);
        else if (f.isFile() && f.name.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('talksphere-isolated-load-test-secret') || content.includes('talksphere.internal')) {
            distClean = false;
          }
        }
      });
    }
    scanDist(distDir);
  }
  assert(distClean, 'Client production bundle (dist/) contains zero synthetic credentials or test domains');

  console.log('\n========================================================================');
  console.log(`📊 Data Isolation Verification Results: ${passedTests}/${totalTests} Tests Passed`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
