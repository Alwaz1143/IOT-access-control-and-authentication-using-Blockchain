const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;
let isConnected = false;

const connectRedis = async () => {
  if (isConnected && redisClient) {
    logger.info('Redis already connected');
    return redisClient;
  }

  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };

    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('Redis is ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
      isConnected = false;
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    await redisClient.ping();
    return redisClient;

  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis disconnected');
  }
};

module.exports = { connectRedis, getRedisClient, disconnectRedis }; 