const isDev = import.meta.env.DEV;

const clientLogger = {
  info: (moduleName, message, data = null) => {
    if (isDev) {
      console.log(
        `%c[INFO]%c [%c${moduleName}%c]: ${message}`,
        'color: #00F0FF; font-weight: bold;',
        'color: inherit;',
        'color: #ff0055; font-weight: bold;',
        'color: inherit;',
        data || ''
      );
    }
  },

  warn: (moduleName, message, data = null) => {
    if (isDev) {
      console.warn(
        `%c[WARN]%c [%c${moduleName}%c]: ${message}`,
        'color: #FFB800; font-weight: bold;',
        'color: inherit;',
        'color: #ff0055; font-weight: bold;',
        'color: inherit;',
        data || ''
      );
    }
  },

  error: (moduleName, message, error = null) => {
    console.error(
      `%c[ERROR]%c [%c${moduleName}%c]: %c${message}`,
      'color: #FF0055; font-weight: bold;',
      'color: inherit;',
      'color: #702CF9; font-weight: bold;',
      'color: inherit;',
      'font-weight: bold;'
    );
    if (error) {
      if (error.response?.data) {
        console.error('%c[API Response Error Details]:', 'color: #FF0055; font-weight: bold;', error.response.data);
      } else if (error.stack) {
        console.error('%c[Stack Trace]:', 'color: #888;', error.stack);
      } else {
        console.error('%c[Error Object]:', 'color: #888;', error);
      }
    }
  }
};

export default clientLogger;
