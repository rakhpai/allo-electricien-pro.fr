import config from '../config/index.js';

/**
 * Simple logger utility with different log levels
 */
class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    this.currentLevel = this.levels[config.app.logLevel] || this.levels.info;
  }

  _log(level, message, data = null) {
    if (this.levels[level] > this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.log(prefix, message);
    }
  }

  error(message, data = null) {
    this._log('error', message, data);
  }

  warn(message, data = null) {
    this._log('warn', message, data);
  }

  info(message, data = null) {
    this._log('info', message, data);
  }

  debug(message, data = null) {
    this._log('debug', message, data);
  }
}

export const logger = new Logger();
export default logger;
