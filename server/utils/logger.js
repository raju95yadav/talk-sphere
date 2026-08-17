const formatTime = () => new Date().toISOString();

const logger = {
  info: (moduleName, message, extra = '') => {
    console.log(`\x1b[36m[INFO]\x1b[0m [${formatTime()}] [\x1b[33m${moduleName}\x1b[0m]: ${message}`, extra ? extra : '');
  },

  warn: (moduleName, message, extra = '') => {
    console.warn(`\x1b[33m[WARN]\x1b[0m [${formatTime()}] [\x1b[33m${moduleName}\x1b[0m]: ${message}`, extra ? extra : '');
  },

  error: (moduleName, message, error = null, req = null) => {
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
};

module.exports = logger;
