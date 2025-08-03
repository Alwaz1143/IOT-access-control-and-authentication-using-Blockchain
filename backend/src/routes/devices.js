const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { getContract, sendTransaction, callMethod } = require('../config/blockchain');
const { publishMessage } = require('../config/mqtt');
const Device = require('../models/Device');
const { auth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Device:
 *       type: object
 *       required:
 *         - deviceId
 *         - deviceType
 *         - location
 *       properties:
 *         deviceId:
 *           type: string
 *           description: Unique device identifier
 *         deviceType:
 *           type: string
 *           description: Type of IoT device
 *         location:
 *           type: string
 *           description: Physical location of the device
 *         firmwareVersion:
 *           type: string
 *           description: Current firmware version
 *         publicKey:
 *           type: string
 *           description: Device's public key for authentication
 *         attributes:
 *           type: object
 *           description: Device-specific attributes
 *         capabilities:
 *           type: array
 *           items:
 *             type: string
 *           description: Device capabilities
 */

/**
 * @swagger
 * /api/devices/register:
 *   post:
 *     summary: Register a new IoT device
 *     tags: [Devices]
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
 *               - deviceType
 *               - location
 *             properties:
 *               deviceId:
 *                 type: string
 *               deviceType:
 *                 type: string
 *               location:
 *                 type: string
 *               firmwareVersion:
 *                 type: string
 *               publicKey:
 *                 type: string
 *               attributes:
 *                 type: object
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Device registered successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post('/register', [
  auth,
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('deviceType').notEmpty().withMessage('Device type is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('firmwareVersion').optional(),
  body('publicKey').optional(),
  body('attributes').optional().isObject(),
  body('capabilities').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      deviceId,
      deviceType,
      location,
      firmwareVersion = '1.0.0',
      publicKey = '',
      attributes = {},
      capabilities = []
    } = req.body;

    // Check if device already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ error: 'Device already registered' });
    }

    // Register device on blockchain
    const deviceRegistry = getContract('deviceRegistry');
    const attributeKeys = Object.keys(attributes);
    const attributeValues = Object.values(attributes);

    const result = await sendTransaction(
      deviceRegistry,
      'registerDevice',
      [
        deviceId,
        deviceType,
        location,
        firmwareVersion,
        publicKey,
        attributeKeys,
        attributeValues,
        capabilities
      ]
    );

    // Store device in database
    const device = new Device({
      deviceId,
      deviceType,
      location,
      firmwareVersion,
      publicKey,
      attributes,
      capabilities,
      owner: req.user.address,
      blockchainTxHash: result.transactionHash,
      status: 'active'
    });

    await device.save();

    // Publish device registration event
    publishMessage('iot/devices/register', {
      deviceId,
      deviceType,
      location,
      timestamp: new Date().toISOString()
    });

    logger.deviceEvent(deviceId, 'registered', { deviceType, location });

    res.status(201).json({
      message: 'Device registered successfully',
      device: {
        deviceId,
        deviceType,
        location,
        status: 'active',
        blockchainTxHash: result.transactionHash
      }
    });

  } catch (error) {
    logger.error('Device registration failed:', error);
    res.status(500).json({ error: 'Device registration failed' });
  }
});

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Get all devices
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by device status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by device type
 *     responses:
 *       200:
 *         description: List of devices
 *       401:
 *         description: Unauthorized
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.deviceType = type;

    const devices = await Device.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Device.countDocuments(filter);

    res.json({
      devices,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalDevices: count
    });

  } catch (error) {
    logger.error('Failed to fetch devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * @swagger
 * /api/devices/{deviceId}:
 *   get:
 *     summary: Get device by ID
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Device details
 *       404:
 *         description: Device not found
 */
router.get('/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get device from database
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Get device info from blockchain
    const deviceRegistry = getContract('deviceRegistry');
    const blockchainInfo = await callMethod(deviceRegistry, 'getDeviceInfo', [deviceId]);

    res.json({
      ...device.toObject(),
      blockchainInfo: {
        owner: blockchainInfo.owner,
        status: blockchainInfo.status,
        registeredAt: blockchainInfo.registeredAt,
        lastActive: blockchainInfo.lastActive
      }
    });

  } catch (error) {
    logger.error('Failed to fetch device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

/**
 * @swagger
 * /api/devices/{deviceId}/status:
 *   put:
 *     summary: Update device status
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, maintenance, compromised]
 *     responses:
 *       200:
 *         description: Device status updated
 *       404:
 *         description: Device not found
 */
router.put('/:deviceId/status', [
  auth,
  body('status').isIn(['active', 'inactive', 'maintenance', 'compromised']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const { status } = req.body;

    // Update status on blockchain
    const deviceRegistry = getContract('deviceRegistry');
    const statusMap = {
      'active': 1,
      'inactive': 0,
      'maintenance': 2,
      'compromised': 3
    };

    await sendTransaction(
      deviceRegistry,
      'updateDeviceStatus',
      [deviceId, statusMap[status]]
    );

    // Update in database
    await Device.findOneAndUpdate(
      { deviceId },
      { status, updatedAt: new Date() }
    );

    // Publish status update
    publishMessage(`iot/devices/${deviceId}/status`, {
      deviceId,
      status,
      timestamp: new Date().toISOString()
    });

    logger.deviceEvent(deviceId, 'status_updated', { status });

    res.json({ message: 'Device status updated successfully', status });

  } catch (error) {
    logger.error('Failed to update device status:', error);
    res.status(500).json({ error: 'Failed to update device status' });
  }
});

/**
 * @swagger
 * /api/devices/{deviceId}/attributes:
 *   put:
 *     summary: Update device attributes
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attributes:
 *                 type: object
 *     responses:
 *       200:
 *         description: Device attributes updated
 */
router.put('/:deviceId/attributes', [
  auth,
  body('attributes').isObject().withMessage('Attributes must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const { attributes } = req.body;

    // Update attributes on blockchain
    const deviceRegistry = getContract('deviceRegistry');
    
    for (const [key, value] of Object.entries(attributes)) {
      await sendTransaction(
        deviceRegistry,
        'updateDeviceAttribute',
        [deviceId, key, value]
      );
    }

    // Update in database
    await Device.findOneAndUpdate(
      { deviceId },
      { 
        $set: { attributes },
        $currentDate: { updatedAt: true }
      }
    );

    logger.deviceEvent(deviceId, 'attributes_updated', { attributes });

    res.json({ message: 'Device attributes updated successfully' });

  } catch (error) {
    logger.error('Failed to update device attributes:', error);
    res.status(500).json({ error: 'Failed to update device attributes' });
  }
});

/**
 * @swagger
 * /api/devices/{deviceId}/permissions:
 *   post:
 *     summary: Add authorized user to device
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userAddress
 *             properties:
 *               userAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: User added to device
 */
router.post('/:deviceId/permissions', [
  auth,
  body('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const { userAddress } = req.body;

    // Add user to device on blockchain
    const deviceRegistry = getContract('deviceRegistry');
    await sendTransaction(
      deviceRegistry,
      'addAuthorizedUser',
      [deviceId, userAddress]
    );

    logger.deviceEvent(deviceId, 'user_authorized', { userAddress });

    res.json({ message: 'User added to device successfully' });

  } catch (error) {
    logger.error('Failed to add user to device:', error);
    res.status(500).json({ error: 'Failed to add user to device' });
  }
});

module.exports = router; 