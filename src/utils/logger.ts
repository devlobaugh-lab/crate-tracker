// Logger utility for conditional development logging
// Only logs info/debug messages in development mode, keeps warn/error always available

//const isDevelopment = import.meta.env.MODE === 'development';
const isDevelopment = false;

const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};

export default logger;
