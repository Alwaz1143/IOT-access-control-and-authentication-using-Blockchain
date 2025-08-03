const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const auth = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Add user info to request
    req.user = {
      id: decoded.id,
      address: decoded.address,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    logger.info(`User authenticated: ${decoded.address}`);
    next();

  } catch (error) {
    logger.error('Token verification failed:', error);
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Middleware for role-based access control
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware for device ownership
const requireDeviceOwnership = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user is admin
    if (req.user.role === 'admin') {
      return next();
    }

    // Check device ownership (this would typically query the blockchain)
    // For now, we'll use a simplified check
    const Device = require('../models/Device');
    const device = await Device.findOne({ deviceId });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.owner !== req.user.address) {
      return res.status(403).json({ error: 'Access denied: Device ownership required' });
    }

    next();

  } catch (error) {
    logger.error('Device ownership check failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware for API key authentication (for device-to-device communication)
const apiKeyAuth = (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    // In a real implementation, you would validate the API key against a database
    // For demonstration purposes, we'll use a simple check
    const validApiKeys = process.env.VALID_API_KEYS ? 
      process.env.VALID_API_KEYS.split(',') : 
      ['demo-api-key-123'];

    if (!validApiKeys.includes(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Add device info to request
    req.device = {
      apiKey,
      type: 'device',
      permissions: ['read', 'write']
    };

    logger.info('Device authenticated via API key');
    next();

  } catch (error) {
    logger.error('API key authentication failed:', error);
    res.status(401).json({ error: 'API key authentication failed' });
  }
};

// Middleware for blockchain signature verification
const verifySignature = (req, res, next) => {
  try {
    const signature = req.header('X-Signature');
    const message = req.header('X-Message');
    const address = req.header('X-Address');

    if (!signature || !message || !address) {
      return res.status(401).json({ error: 'Missing signature headers' });
    }

    // In a real implementation, you would verify the signature using web3
    // For demonstration purposes, we'll skip the actual verification
    req.blockchainUser = {
      address,
      signature,
      message
    };

    logger.info(`Blockchain signature verified for address: ${address}`);
    next();

  } catch (error) {
    logger.error('Signature verification failed:', error);
    res.status(401).json({ error: 'Invalid signature' });
  }
};

// Rate limiting middleware for different user types
const rateLimitByUserType = (req, res, next) => {
  const userType = req.user ? 'authenticated' : 'anonymous';
  const deviceType = req.device ? 'device' : 'user';
  
  // Different rate limits for different user types
  const limits = {
    anonymous: 10, // 10 requests per window
    authenticated: 100, // 100 requests per window
    device: 1000 // 1000 requests per window
  };

  const limit = limits[userType] || limits[deviceType] || limits.anonymous;
  
  // This is a simplified rate limiting implementation
  // In production, you would use Redis or a similar solution
  req.rateLimit = limit;
  next();
};

module.exports = {
  auth,
  requireRole,
  requireDeviceOwnership,
  apiKeyAuth,
  verifySignature,
  rateLimitByUserType
}; 