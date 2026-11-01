const logger = require('../utils/logger');

/**
 * Circuit Breaker States
 */
const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation - traffic passes through
  OPEN: 'OPEN',           // Circuit tripped - fast fallback without hitting upstream
  HALF_OPEN: 'HALF-OPEN'  // Trial mode - testing upstream recovery
};

class CircuitBreaker {
  /**
   * @param {string} name - Service identifier (e.g. 'Gemini', 'Groq')
   * @param {object} options
   * @param {number} options.failureThreshold - Failures before opening circuit (default: 3)
   * @param {number} options.resetTimeoutMs - Cooldown before HALF-OPEN (default: 30000ms)
   * @param {number} options.timeoutMs - Execution timeout (default: 8000ms)
   * @param {function|string} options.fallback - Fallback handler or message
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;

    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.timeoutMs = options.timeoutMs || 8000;
    this.fallback = options.fallback || 'AI assistance is temporarily paused due to upstream service latency. Please try again shortly.';
  }

  /**
   * Transitions the circuit to a new state and logs the change
   */
  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[CIRCUIT_BREAKER] State changed for ${this.name}: ${oldState} -> ${newState}`);
    logger.warn('CIRCUIT_BREAKER_STATE_CHANGE', `[CIRCUIT_BREAKER:${this.name}] State changed: ${oldState} -> ${newState}`);

    if (newState === CircuitState.OPEN) {
      this.lastFailureTime = Date.now();
    } else if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
      this.lastFailureTime = null;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
  }

  /**
   * Checks if cooldown period has elapsed to allow trial in HALF-OPEN state
   */
  checkState() {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - (this.lastFailureTime || 0);
      if (elapsed > this.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
  }

  /**
   * Wraps an asynchronous action with timeout enforcement and circuit tracking
   *
   * @param {Function} action - Async function returning a promise
   * @param {Function} [customFallback] - Optional custom fallback override
   * @returns {Promise<any>}
   */
  async execute(action, customFallback = null) {
    this.checkState();

    // Fast-fail if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      logger.warn('CIRCUIT_BREAKER_FAST_FAIL', `[${this.name}] Request fast-failed because circuit is OPEN.`);
      if (typeof customFallback === 'function') {
        return customFallback(new Error(`Circuit breaker is OPEN for ${this.name}`));
      }
      return typeof this.fallback === 'function' ? this.fallback() : this.fallback;
    }

    let timer = null;
    try {
      // Race execution against configured timeout [B-16]
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const timeoutErr = new Error(`${this.name} request timed out after ${this.timeoutMs}ms`);
          timeoutErr.name = 'TimeoutError';
          timeoutErr.code = 'ETIMEDOUT';
          reject(timeoutErr);
        }, this.timeoutMs);
      });

      const result = await Promise.race([action(), timeoutPromise]);

      if (timer) clearTimeout(timer);
      this.onSuccess();
      return result;
    } catch (err) {
      if (timer) clearTimeout(timer);
      this.onFailure(err);

      // Return fallback response on failure
      if (typeof customFallback === 'function') {
        return customFallback(err);
      }
      return typeof this.fallback === 'function' ? this.fallback(err) : this.fallback;
    }
  }

  onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // If 2 consecutive successes in HALF-OPEN, close circuit
      if (this.successCount >= 2) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  onFailure(err) {
    this.failureCount++;
    logger.warn('CIRCUIT_BREAKER_FAILURE', `[${this.name}] Execution error (${this.failureCount}/${this.failureThreshold}): ${err.message}`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediate failure in HALF-OPEN pushes back to OPEN
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }
}

// Pre-configured Circuit Breakers for external AI services
const geminiBreaker = new CircuitBreaker('Gemini-AI', {
  timeoutMs: 8000, // 8,000 ms timeout for LLM text generation [B-16]
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  fallback: 'AI assistance is temporarily paused due to upstream service latency. Please try again shortly.'
});

const groqBreaker = new CircuitBreaker('Groq-Llama', {
  timeoutMs: 8000, // 8,000 ms timeout for Groq completions [B-16]
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  fallback: 'Groq acceleration is temporarily unavailable. Seamlessly routing to Gemini fallback.'
});

const ragEmbeddingBreaker = new CircuitBreaker('RAG-Embedding', {
  timeoutMs: 15000, // 15,000 ms timeout for embedding generation [B-16]
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  fallback: null
});

module.exports = {
  CircuitBreaker,
  CircuitState,
  geminiBreaker,
  groqBreaker,
  ragEmbeddingBreaker
};

