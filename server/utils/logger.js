const formatTime = () => new Date().toISOString();

const isProduction = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';
const instanceId = process.env.INSTANCE_ID || `instance-${process.pid}`;

/**
 * Production-ready Observability Logger
 * Formats single-line structured JSON in production for Datadog / CloudWatch / ELK.
 * Uses formatted colored output in local development.
 */
const logger = {
  info: (moduleName, message, extra = null) => {
    if (isProduction) {
      console.log(JSON.stringify({
        timestamp: formatTime(),
        level: 'info',
        service: 'talksphere-backend',
        instance: instanceId,
        pid: process.pid,
        module: moduleName,
        message,
        ...(extra && typeof extra === 'object' ? { context: extra } : extra ? { extra } : {})
      }));
    } else {
      console.log(`\x1b[36m[INFO]\x1b[0m [${formatTime()}] [\x1b[33m${moduleName}\x1b[0m]: ${message}`, extra ? extra : '');
    }
  },

  warn: (moduleName, message, extra = null) => {
    if (isProduction) {
      console.warn(JSON.stringify({
        timestamp: formatTime(),
        level: 'warn',
        service: 'talksphere-backend',
        instance: instanceId,
        pid: process.pid,
        module: moduleName,
        message,
        ...(extra && typeof extra === 'object' ? { context: extra } : extra ? { extra } : {})
      }));
    } else {
      console.warn(`\x1b[33m[WARN]\x1b[0m [${formatTime()}] [\x1b[33m${moduleName}\x1b[0m]: ${message}`, extra ? extra : '');
    }
  },

  error: (moduleName, message, error = null, req = null) => {
    if (isProduction) {
      console.error(JSON.stringify({
        timestamp: formatTime(),
        level: 'error',
        service: 'talksphere-backend',
        instance: instanceId,
        pid: process.pid,
        module: moduleName,
        message,
        route: req ? `${req.method} ${req.originalUrl || req.url}` : undefined,
        requestId: req?.requestId || undefined,
        error: error ? (error.stack || error.message || error) : undefined
      }));
    } else {
      const routeInfo = req ? ` [${req.method} ${req.originalUrl || req.url}]` : '';
      console.error(
        `\x1b[31m[ERROR]\x1b[0m [${formatTime()}] [\x1b[35m${moduleName}\x1b[0m]${routeInfo}: \x1b[1m${message}\x1b[0m`
      );
      if (error) {
        if (error.stack) {
          console.error(`\x1b[90mStack Trace:\n${error.stack}\x1b[0m`);
        } else {
          console.error(`\x1b[90mDetails:\x1b[0m`, error);
        }
      }
    }
  },

  // Stream adapter for morgan / HTTP middleware integration
  stream: {
    write: (message) => {
      logger.info('HTTP_STREAM', message.trim());
    }
  }
};

module.exports = logger;
