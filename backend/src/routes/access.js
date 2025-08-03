const express = require('express');
const router = express.Router();
const { auth, requireRole, requireDeviceOwnership } = require('../middleware/auth');
const { getIoTAccessControl, getAuditLogger, sendTransaction } = require('../config/blockchain');
const logger = require('../utils/logger');
const Device = require('../models/Device');
const Policy = require('../models/Policy');
const User = require('../models/User');

/**
 * @swagger
 * components:
 *   schemas:
 *     AccessRequest:
 *       type: object
 *       required:
 *         - deviceId
 *         - userId
 *         - action
 *       properties:
 *         deviceId:
 *           type: string
 *           description: Device ID requesting access
 *         userId:
 *           type: string
 *           description: User ID requesting access
 *         action:
 *           type: string
 *           enum: [read, write, execute, admin]
 *           description: Type of access requested
 *         attributes:
 *           type: object
 *           description: Additional attributes for ABAC evaluation
 *         location:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *             radius:
 *               type: number
 *           description: Location-based access constraints
 *         timeConstraints:
 *           type: object
 *           properties:
 *             startTime:
 *               type: string
 *               format: date-time
 *             endTime:
 *               type: string
 *               format: date-time
 *             daysOfWeek:
 *               type: array
 *               items:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 6
 *           description: Time-based access constraints
 *     AccessResponse:
 *       type: object
 *       properties:
 *         requestId:
 *           type: string
 *         granted:
 *           type: boolean
 *         reason:
 *           type: string
 *         policyId:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         transactionHash:
 *           type: string
 *         delegationChain:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               delegator:
 *                 type: string
 *               delegate:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 */

/**
 * @swagger
 * /api/access/request:
 *   post:
 *     summary: Request access to a device
 *     tags: [Access Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AccessRequest'
 *     responses:
 *       200:
 *         description: Access request processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessResponse'
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Device or user not found
 *       500:
 *         description: Internal server error
 */
router.post('/request', auth, async (req, res) => {
  try {
    const { deviceId, userId, action, attributes, location, timeConstraints } = req.body;
    const requesterId = req.user.id;

    // Validate required fields
    if (!deviceId || !userId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, user ID, and action are required'
      });
    }

    // Check if device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if requester has permission to request access for this user
    if (requesterId !== userId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to request access for this user'
      });
    }

    // Prepare access request data for blockchain
    const accessRequestData = {
      deviceId: device.blockchainId,
      userId: user.blockchainId,
      action,
      attributes: attributes || {},
      location: location || {},
      timeConstraints: timeConstraints || {},
      timestamp: Math.floor(Date.now() / 1000)
    };

    // Submit access request to blockchain
    const iotAccessControl = await getIoTAccessControl();
    const tx = await sendTransaction(
      iotAccessControl.methods.requestAccess(
        accessRequestData.deviceId,
        accessRequestData.userId,
        accessRequestData.action,
        JSON.stringify(accessRequestData.attributes),
        JSON.stringify(accessRequestData.location),
        JSON.stringify(accessRequestData.timeConstraints)
      )
    );

    // Log the access request
    logger.accessRequest({
      deviceId,
      userId,
      action,
      requesterId,
      transactionHash: tx.transactionHash,
      attributes,
      location,
      timeConstraints
    });

    res.json({
      success: true,
      message: 'Access request submitted successfully',
      data: {
        requestId: tx.transactionHash,
        deviceId,
        userId,
        action,
        timestamp: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Access request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process access request',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/access/grant:
 *   post:
 *     summary: Grant access to a user for a device
 *     tags: [Access Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - userId
 *               - permissions
 *             properties:
 *               deviceId:
 *                 type: string
 *               userId:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [read, write, execute, admin]
 *               policyId:
 *                 type: string
 *               expiryTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Access granted successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Device or user not found
 *       500:
 *         description: Internal server error
 */
router.post('/grant', auth, requireRole(['admin', 'device_owner']), async (req, res) => {
  try {
    const { deviceId, userId, permissions, policyId, expiryTime } = req.body;
    const granterId = req.user.id;

    // Validate required fields
    if (!deviceId || !userId || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, user ID, and permissions array are required'
      });
    }

    // Check if device exists and granter has ownership
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check device ownership (unless admin)
    if (!req.user.roles.includes('admin') && device.ownerId.toString() !== granterId) {
      return res.status(403).json({
        success: false,
        message: 'Only device owners or admins can grant access'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare grant data for blockchain
    const grantData = {
      deviceId: device.blockchainId,
      userId: user.blockchainId,
      permissions,
      policyId: policyId || '',
      expiryTime: expiryTime ? Math.floor(new Date(expiryTime).getTime() / 1000) : 0
    };

    // Submit grant to blockchain
    const iotAccessControl = await getIoTAccessControl();
    const tx = await sendTransaction(
      iotAccessControl.methods.grantAccess(
        grantData.deviceId,
        grantData.userId,
        grantData.permissions,
        grantData.policyId,
        grantData.expiryTime
      )
    );

    // Log the access grant
    logger.accessGrant({
      deviceId,
      userId,
      granterId,
      permissions,
      policyId,
      expiryTime,
      transactionHash: tx.transactionHash
    });

    res.json({
      success: true,
      message: 'Access granted successfully',
      data: {
        deviceId,
        userId,
        permissions,
        policyId,
        expiryTime,
        timestamp: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Access grant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant access',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/access/deny:
 *   post:
 *     summary: Deny access to a user for a device
 *     tags: [Access Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - userId
 *               - reason
 *             properties:
 *               deviceId:
 *                 type: string
 *               userId:
 *                 type: string
 *               reason:
 *                 type: string
 *               policyId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access denied successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Device or user not found
 *       500:
 *         description: Internal server error
 */
router.post('/deny', auth, requireRole(['admin', 'device_owner']), async (req, res) => {
  try {
    const { deviceId, userId, reason, policyId } = req.body;
    const denierId = req.user.id;

    // Validate required fields
    if (!deviceId || !userId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, user ID, and reason are required'
      });
    }

    // Check if device exists and denier has ownership
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check device ownership (unless admin)
    if (!req.user.roles.includes('admin') && device.ownerId.toString() !== denierId) {
      return res.status(403).json({
        success: false,
        message: 'Only device owners or admins can deny access'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare deny data for blockchain
    const denyData = {
      deviceId: device.blockchainId,
      userId: user.blockchainId,
      reason,
      policyId: policyId || ''
    };

    // Submit deny to blockchain
    const iotAccessControl = await getIoTAccessControl();
    const tx = await sendTransaction(
      iotAccessControl.methods.denyAccess(
        denyData.deviceId,
        denyData.userId,
        denyData.reason,
        denyData.policyId
      )
    );

    // Log the access denial
    logger.accessDenial({
      deviceId,
      userId,
      denierId,
      reason,
      policyId,
      transactionHash: tx.transactionHash
    });

    res.json({
      success: true,
      message: 'Access denied successfully',
      data: {
        deviceId,
        userId,
        reason,
        policyId,
        timestamp: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Access deny error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deny access',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/access/revoke:
 *   post:
 *     summary: Revoke access from a user for a device
 *     tags: [Access Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - userId
 *               - reason
 *             properties:
 *               deviceId:
 *                 type: string
 *               userId:
 *                 type: string
 *               reason:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Access revoked successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Device or user not found
 *       500:
 *         description: Internal server error
 */
router.post('/revoke', auth, requireRole(['admin', 'device_owner']), async (req, res) => {
  try {
    const { deviceId, userId, reason, permissions } = req.body;
    const revokerId = req.user.id;

    // Validate required fields
    if (!deviceId || !userId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, user ID, and reason are required'
      });
    }

    // Check if device exists and revoker has ownership
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check device ownership (unless admin)
    if (!req.user.roles.includes('admin') && device.ownerId.toString() !== revokerId) {
      return res.status(403).json({
        success: false,
        message: 'Only device owners or admins can revoke access'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prepare revoke data for blockchain
    const revokeData = {
      deviceId: device.blockchainId,
      userId: user.blockchainId,
      reason,
      permissions: permissions || []
    };

    // Submit revoke to blockchain
    const iotAccessControl = await getIoTAccessControl();
    const tx = await sendTransaction(
      iotAccessControl.methods.revokeAccess(
        revokeData.deviceId,
        revokeData.userId,
        revokeData.reason,
        revokeData.permissions
      )
    );

    // Log the access revocation
    logger.accessRevocation({
      deviceId,
      userId,
      revokerId,
      reason,
      permissions,
      transactionHash: tx.transactionHash
    });

    res.json({
      success: true,
      message: 'Access revoked successfully',
      data: {
        deviceId,
        userId,
        reason,
        permissions,
        timestamp: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Access revoke error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke access',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/access/check:
 *   post:
 *     summary: Check if a user has access to a device
 *     tags: [Access Control]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - userId
 *               - action
 *             properties:
 *               deviceId:
 *                 type: string
 *               userId:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [read, write, execute, admin]
 *               attributes:
 *                 type: object
 *               location:
 *                 type: object
 *     responses:
 *       200:
 *         description: Access check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 hasAccess:
 *                   type: boolean
 *                 reason:
 *                   type: string
 *                 policyId:
 *                   type: string
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Device or user not found
 *       500:
 *         description: Internal server error
 */
router.post('/check', auth, async (req, res) => {
  try {
    const { deviceId, userId, action, attributes, location } = req.body;

    // Validate required fields
    if (!deviceId || !userId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, user ID, and action are required'
      });
    }

    // Check if device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check access on blockchain
    const iotAccessControl = await getIoTAccessControl();
    const hasAccess = await iotAccessControl.methods.checkAccess(
      device.blockchainId,
      user.blockchainId,
      action,
      JSON.stringify(attributes || {}),
      JSON.stringify(location || {})
    ).call();

    // Get user permissions for this device
    const permissions = await iotAccessControl.methods.getUserPermissions(
      device.blockchainId,
      user.blockchainId
    ).call();

    // Get applicable policies
    const policyId = await iotAccessControl.methods.getApplicablePolicy(
      device.blockchainId,
      user.blockchainId,
      action
    ).call();

    res.json({
      success: true,
      hasAccess,
      reason: hasAccess ? 'Access granted' : 'Access denied',
      policyId: policyId || null,
      permissions: permissions || [],
      deviceId,
      userId,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check access',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/access/history/{deviceId}:
 *   get:
 *     summary: Get access history for a device
 *     tags: [Access Control]
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
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [request, grant, deny, revoke]
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: Access history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Device not found
 *       500:
 *         description: Internal server error
 */
router.get('/history/:deviceId', auth, requireDeviceOwnership, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50, offset = 0, eventType } = req.query;

    // Check if device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Get audit logs from blockchain
    const auditLogger = await getAuditLogger();
    const logs = await auditLogger.methods.getDeviceAccessLogs(
      device.blockchainId,
      parseInt(limit),
      parseInt(offset)
    ).call();

    // Filter by event type if specified
    let filteredLogs = logs;
    if (eventType) {
      filteredLogs = logs.filter(log => log.eventType === eventType);
    }

    res.json({
      success: true,
      data: {
        deviceId,
        logs: filteredLogs,
        total: filteredLogs.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logger.error('Access history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve access history',
      error: error.message
    });
  }
});

module.exports = router; 