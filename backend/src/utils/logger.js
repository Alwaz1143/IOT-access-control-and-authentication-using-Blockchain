const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define different log formats
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: logFormat,
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Add custom methods for IoT-specific logging
logger.deviceEvent = (deviceId, event, data) => {
  logger.info(`Device Event [${deviceId}]: ${event}`, { deviceId, event, data });
};

logger.accessRequest = (deviceId, userId, action, result) => {
  logger.info(`Access Request [${deviceId}]: User ${userId} ${action} - ${result}`, {
    deviceId, userId, action, result
  });
};

logger.securityAlert = (deviceId, alertType, details) => {
  logger.warn(`Security Alert [${deviceId}]: ${alertType}`, {
    deviceId, alertType, details, severity: 'high'
  });
};

logger.blockchainTransaction = (contractName, method, txHash, status) => {
  logger.info(`Blockchain Transaction [${contractName}.${method}]: ${status}`, {
    contractName, method, txHash, status
  });
};

logger.policyEvaluation = (policyId, subject, resource, action, result) => {
  logger.info(`Policy Evaluation [${policyId}]: ${subject} -> ${resource} (${action}) = ${result}`, {
    policyId, subject, resource, action, result
  });
};

logger.auditLog = (eventType, actor, subject, details) => {
  logger.info(`Audit Log [${eventType}]: ${actor} -> ${subject}`, {
    eventType, actor, subject, details
  });
};

module.exports = logger; 