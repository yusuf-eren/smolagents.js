import winston from 'winston';

export enum LogLevel {
  OFF = -1,
  ERROR = 0,
  INFO = 1,
  DEBUG = 2,
}

export const logger = winston.createLogger({
  levels: {
    off: LogLevel.OFF,
    error: LogLevel.ERROR,
    info: LogLevel.INFO,
    debug: LogLevel.DEBUG,
  },
  level: 'info',
  format: winston.format.combine(
    winston.format(info => {
      if (info.level === 'off') return false;
      return info;
    })(),
    winston.format.printf(info => {
      return typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
    })
  ),
  transports: [new winston.transports.Console()],
});

logger.error('This is an error'); // ✅ will show
logger.info('This is info'); // ✅ will show
logger.debug('This is debug'); // ❌ won't show, level is too low
logger.log('off', 'This should NOT appear'); // ❌ OFF means -1, always filtered
