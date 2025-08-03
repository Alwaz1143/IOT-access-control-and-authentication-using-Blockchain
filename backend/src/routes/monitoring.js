const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const Device = require('../models/Device');
const User = require('../models/User');
const { getRedisClient } = require('../config/redis');
const { getIoTAccessControl } = require('../config/blockchain');

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemMetrics:
 *       type: object
 *       properties:
 *         totalDevices:
 *           type: number
 *         activeDevices:
 *           type: number
 *         totalUsers:
 *           type: number
 *         activeUsers:
 *           type: number
 *         totalPolicies:
 *           type: number
 *         activePolicies:
 *           type: number
 *         totalAccessRequests:
 *           type: number
 *         pendingAccessRequests:
 *           type: number
 *         securityIncidents:
 *           type: number
 *         openIncidents:
 *           type: number
 *         systemUptime:
 *           type: number
 *         averageResponseTime:
 *           type: number
 *         blockchainTransactions:
 *           type: number
 *         lastBlockNumber:
 *           type: number
 *     DeviceMetrics:
 *       type: object
 *       properties:
 *         deviceId:
 *           type: string
 *         status:
 *           type: string
 *         uptime:
 *           type: number
 *         lastSeen:
 *           type: string
 *           format: date-time
 *         accessRequests:
 *           type: number
 *         successfulAccess:
 *           type: number
 *         failedAccess:
 *           type: number
 *         securityIncidents:
 *           type: number
 *         performance:
 *           type: object
 *           properties:
 *             cpuUsage:
 *               type: number
 *             memoryUsage:
 *               type: number
 *             networkLatency:
 *               type: number
 *     Alert:
 *       type: object
 *       properties:
 *         alertId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [security, performance, system, access]
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         deviceId:
 *           type: string
 *         userId:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [active, acknowledged, resolved]
 *         metadata:
 *           type: object
 */

/**
 * @swagger
 * /api/monitoring/dashboard:
 *   get:
 *     summary: Get system dashboard metrics
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard', auth, requireRole(['admin', 'monitor']), async (req, res) => {
  try {
    // Get system metrics from database
    const totalDevices = await Device.countDocuments();
    const activeDevices = await Device.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });

    // Get Redis client for real-time metrics
    const redis = getRedisClient();
    
    // Get real-time metrics from Redis
    const [
      totalAccessRequests,
      pendingAccessRequests,
      securityIncidents,
      openIncidents,
      systemUptime,
      averageResponseTime,
      blockchainTransactions,
      lastBlockNumber
    ] = await Promise.all([
      redis.get('metrics:total_access_requests') || 0,
      redis.get('metrics:pending_access_requests') || 0,
      redis.get('metrics:security_incidents') || 0,
      redis.get('metrics:open_incidents') || 0,
      redis.get('metrics:system_uptime') || 0,
      redis.get('metrics:average_response_time') || 0,
      redis.get('metrics:blockchain_transactions') || 0,
      redis.get('metrics:last_block_number') || 0
    ]);

    // Get blockchain metrics
    const iotAccessControl = await getIoTAccessControl();
    const totalPolicies = await iotAccessControl.methods.getTotalPolicies().call();
    const activePolicies = await iotAccessControl.methods.getActivePolicies().call();

    const metrics = {
      totalDevices: parseInt(totalDevices),
      activeDevices: parseInt(activeDevices),
      totalUsers: parseInt(totalUsers),
      activeUsers: parseInt(activeUsers),
      totalPolicies: parseInt(totalPolicies),
      activePolicies: parseInt(activePolicies),
      totalAccessRequests: parseInt(totalAccessRequests),
      pendingAccessRequests: parseInt(pendingAccessRequests),
      securityIncidents: parseInt(securityIncidents),
      openIncidents: parseInt(openIncidents),
      systemUptime: parseInt(systemUptime),
      averageResponseTime: parseFloat(averageResponseTime),
      blockchainTransactions: parseInt(blockchainTransactions),
      lastBlockNumber: parseInt(lastBlockNumber)
    };

    // Log dashboard access
    logger.dashboardAccess({
      userId: req.user.id,
      metrics
    });

    res.json({
      success: true,
      data: {
        metrics,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard metrics',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/devices/{deviceId}/metrics:
 *   get:
 *     summary: Get device-specific metrics
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time period for metrics
 *     responses:
 *       200:
 *         description: Device metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Device not found
 *       500:
 *         description: Internal server error
 */
router.get('/devices/:deviceId/metrics', auth, requireRole(['admin', 'monitor', 'device_owner']), async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = '24h' } = req.query;

    // Check if device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check device ownership (unless admin or monitor)
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('monitor')) {
      if (device.ownerId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to view device metrics'
        });
      }
    }

    // Get Redis client
    const redis = getRedisClient();

    // Get device-specific metrics from Redis
    const [
      uptime,
      lastSeen,
      accessRequests,
      successfulAccess,
      failedAccess,
      securityIncidents,
      cpuUsage,
      memoryUsage,
      networkLatency
    ] = await Promise.all([
      redis.get(`device:${deviceId}:uptime`) || 0,
      redis.get(`device:${deviceId}:last_seen`) || null,
      redis.get(`device:${deviceId}:access_requests:${period}`) || 0,
      redis.get(`device:${deviceId}:successful_access:${period}`) || 0,
      redis.get(`device:${deviceId}:failed_access:${period}`) || 0,
      redis.get(`device:${deviceId}:security_incidents:${period}`) || 0,
      redis.get(`device:${deviceId}:cpu_usage`) || 0,
      redis.get(`device:${deviceId}:memory_usage`) || 0,
      redis.get(`device:${deviceId}:network_latency`) || 0
    ]);

    const metrics = {
      deviceId,
      status: device.status,
      uptime: parseInt(uptime),
      lastSeen: lastSeen ? new Date(parseInt(lastSeen)).toISOString() : null,
      accessRequests: parseInt(accessRequests),
      successfulAccess: parseInt(successfulAccess),
      failedAccess: parseInt(failedAccess),
      securityIncidents: parseInt(securityIncidents),
      performance: {
        cpuUsage: parseFloat(cpuUsage),
        memoryUsage: parseFloat(memoryUsage),
        networkLatency: parseFloat(networkLatency)
      }
    };

    res.json({
      success: true,
      data: {
        metrics,
        period,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Device metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve device metrics',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/alerts:
 *   get:
 *     summary: Get system alerts
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [security, performance, system, access]
 *         description: Filter by alert type
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, acknowledged, resolved]
 *         description: Filter by alert status
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *         description: Filter by device ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/alerts', auth, requireRole(['admin', 'monitor']), async (req, res) => {
  try {
    const {
      type,
      severity,
      status,
      deviceId,
      limit = 50,
      offset = 0
    } = req.query;

    // Get Redis client
    const redis = getRedisClient();

    // Get alerts from Redis
    const alertKeys = await redis.keys('alert:*');
    const alerts = [];

    for (const key of alertKeys.slice(parseInt(offset), parseInt(offset) + parseInt(limit))) {
      const alertData = await redis.hgetall(key);
      if (alertData) {
        alerts.push({
          alertId: key.split(':')[1],
          ...alertData,
          timestamp: new Date(parseInt(alertData.timestamp)).toISOString()
        });
      }
    }

    // Apply filters
    let filteredAlerts = alerts;

    if (type) {
      filteredAlerts = filteredAlerts.filter(alert => alert.type === type);
    }

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    if (status) {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }

    if (deviceId) {
      filteredAlerts = filteredAlerts.filter(alert => alert.deviceId === deviceId);
    }

    res.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        total: filteredAlerts.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logger.error('Alerts retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/alerts/{alertId}/acknowledge:
 *   put:
 *     summary: Acknowledge an alert
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Internal server error
 */
router.put('/alerts/:alertId/acknowledge', auth, requireRole(['admin', 'monitor']), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    // Get Redis client
    const redis = getRedisClient();

    // Check if alert exists
    const alertExists = await redis.exists(`alert:${alertId}`);
    if (!alertExists) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Update alert status
    await redis.hset(`alert:${alertId}`, {
      status: 'acknowledged',
      acknowledgedBy: req.user.id,
      acknowledgedAt: Date.now(),
      notes: notes || ''
    });

    // Log the alert acknowledgment
    logger.alertAcknowledgment({
      alertId,
      acknowledgedBy: req.user.id,
      notes
    });

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alertId,
        status: 'acknowledged',
        acknowledgedBy: req.user.id,
        acknowledgedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Alert acknowledgment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/alerts/{alertId}/resolve:
 *   put:
 *     summary: Resolve an alert
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolution:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Alert not found
 *       500:
 *         description: Internal server error
 */
router.put('/alerts/:alertId/resolve', auth, requireRole(['admin', 'monitor']), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution, notes } = req.body;

    // Validate required fields
    if (!resolution) {
      return res.status(400).json({
        success: false,
        message: 'Resolution is required'
      });
    }

    // Get Redis client
    const redis = getRedisClient();

    // Check if alert exists
    const alertExists = await redis.exists(`alert:${alertId}`);
    if (!alertExists) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Update alert status
    await redis.hset(`alert:${alertId}`, {
      status: 'resolved',
      resolvedBy: req.user.id,
      resolvedAt: Date.now(),
      resolution,
      notes: notes || ''
    });

    // Log the alert resolution
    logger.alertResolution({
      alertId,
      resolvedBy: req.user.id,
      resolution,
      notes
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      data: {
        alertId,
        status: 'resolved',
        resolvedBy: req.user.id,
        resolvedAt: new Date().toISOString(),
        resolution
      }
    });

  } catch (error) {
    logger.error('Alert resolution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/performance:
 *   get:
 *     summary: Get system performance metrics
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time period for metrics
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/performance', auth, requireRole(['admin', 'monitor']), async (req, res) => {
  try {
    const { period = '24h' } = req.query;

    // Get Redis client
    const redis = getRedisClient();

    // Get performance metrics from Redis
    const [
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkThroughput,
      apiResponseTime,
      databaseConnections,
      activeSessions,
      errorRate
    ] = await Promise.all([
      redis.get(`performance:cpu_usage:${period}`) || 0,
      redis.get(`performance:memory_usage:${period}`) || 0,
      redis.get(`performance:disk_usage:${period}`) || 0,
      redis.get(`performance:network_throughput:${period}`) || 0,
      redis.get(`performance:api_response_time:${period}`) || 0,
      redis.get(`performance:database_connections:${period}`) || 0,
      redis.get(`performance:active_sessions:${period}`) || 0,
      redis.get(`performance:error_rate:${period}`) || 0
    ]);

    const performance = {
      cpuUsage: parseFloat(cpuUsage),
      memoryUsage: parseFloat(memoryUsage),
      diskUsage: parseFloat(diskUsage),
      networkThroughput: parseFloat(networkThroughput),
      apiResponseTime: parseFloat(apiResponseTime),
      databaseConnections: parseInt(databaseConnections),
      activeSessions: parseInt(activeSessions),
      errorRate: parseFloat(errorRate)
    };

    res.json({
      success: true,
      data: {
        performance,
        period,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Performance metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/monitoring/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Monitoring & Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/health', auth, requireRole(['admin', 'monitor']), async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await Device.countDocuments().then(() => 'healthy').catch(() => 'unhealthy');

    // Check Redis connection
    const redis = getRedisClient();
    const redisStatus = await redis.ping().then(() => 'healthy').catch(() => 'unhealthy');

    // Check blockchain connection
    let blockchainStatus = 'unhealthy';
    try {
      const iotAccessControl = await getIoTAccessControl();
      await iotAccessControl.methods.getTotalPolicies().call();
      blockchainStatus = 'healthy';
    } catch (error) {
      blockchainStatus = 'unhealthy';
    }

    const health = {
      database: dbStatus,
      redis: redisStatus,
      blockchain: blockchainStatus,
      overall: dbStatus === 'healthy' && redisStatus === 'healthy' && blockchainStatus === 'healthy' ? 'healthy' : 'degraded'
    };

    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check system health',
      error: error.message
    });
  }
});

module.exports = router; 