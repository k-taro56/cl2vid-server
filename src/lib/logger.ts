/**
 * Logger utility with debug mode support
 */

const DEBUG = process.env.DEBUG === 'true';

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(message, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(message, ...args);
  },

  debug: (message: string, ...args: any[]) => {
    if (DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(message, ...args);
  },
};
