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

// Additional logger functions used in routes
logger.accessRequest = (data) => {
  logger.info(`Access Request: ${data.deviceId} -> ${data.userId} (${data.action})`, data);
};

logger.accessGrant = (data) => {
  logger.info(`Access Grant: ${data.deviceId} -> ${data.userId}`, data);
};

logger.accessDenial = (data) => {
  logger.warn(`Access Denial: ${data.deviceId} -> ${data.userId}`, data);
};

logger.accessRevocation = (data) => {
  logger.warn(`Access Revocation: ${data.deviceId} -> ${data.userId}`, data);
};

logger.auditLogRetrieval = (data) => {
  logger.info(`Audit Log Retrieval: ${data.requesterId}`, data);
};

logger.complianceReportGeneration = (data) => {
  logger.info(`Compliance Report Generated: ${data.reportType}`, data);
};

logger.securityIncidentReport = (data) => {
  logger.warn(`Security Incident Reported: ${data.incidentType}`, data);
};

logger.incidentStatusUpdate = (data) => {
  logger.info(`Incident Status Updated: ${data.incidentId} -> ${data.status}`, data);
};

logger.dashboardAccess = (data) => {
  logger.info(`Dashboard Accessed: ${data.userId}`, data);
};

logger.alertAcknowledgment = (data) => {
  logger.info(`Alert Acknowledged: ${data.alertId} by ${data.acknowledgedBy}`, data);
};

logger.alertResolution = (data) => {
  logger.info(`Alert Resolved: ${data.alertId} by ${data.resolvedBy}`, data);
};

module.exports = logger; 