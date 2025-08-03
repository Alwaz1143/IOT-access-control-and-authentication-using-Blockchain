const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { getContract, sendTransaction, callMethod } = require('../config/blockchain');
const Policy = require('../models/Policy');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Policy:
 *       type: object
 *       required:
 *         - policyId
 *         - name
 *         - policyType
 *         - effect
 *       properties:
 *         policyId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         policyType:
 *           type: string
 *           enum: [RBAC, ABAC, TimeBased, LocationBased, Composite]
 *         effect:
 *           type: string
 *           enum: [Allow, Deny]
 *         priority:
 *           type: number
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /api/policies:
 *   post:
 *     summary: Create a new access policy
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - policyId
 *               - name
 *               - policyType
 *               - effect
 *             properties:
 *               policyId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               policyType:
 *                 type: string
 *                 enum: [RBAC, ABAC, TimeBased, LocationBased, Composite]
 *               effect:
 *                 type: string
 *                 enum: [Allow, Deny]
 *               priority:
 *                 type: number
 *               rules:
 *                 type: array
 *     responses:
 *       201:
 *         description: Policy created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/', [
  auth,
  body('policyId').notEmpty().withMessage('Policy ID is required'),
  body('name').notEmpty().withMessage('Policy name is required'),
  body('policyType').isIn(['RBAC', 'ABAC', 'TimeBased', 'LocationBased', 'Composite']).withMessage('Invalid policy type'),
  body('effect').isIn(['Allow', 'Deny']).withMessage('Invalid effect'),
  body('priority').optional().isInt({ min: 1, max: 1000 }).withMessage('Priority must be between 1 and 1000'),
  body('rules').optional().isArray().withMessage('Rules must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      policyId,
      name,
      description = '',
      policyType,
      effect,
      priority = 100,
      rules = []
    } = req.body;

    // Check if policy already exists
    const existingPolicy = await Policy.findOne({ policyId });
    if (existingPolicy) {
      return res.status(400).json({ error: 'Policy already exists' });
    }

    // Create policy on blockchain based on type
    const policyManager = getContract('policyManager');
    let blockchainResult;

    if (policyType === 'ABAC') {
      const { requiredRoles = [], subjectAttrNames = [], subjectAttrValues = [], subjectAttrOperators = [], resourceTypes = [], allowedActions = [] } = rules[0] || {};
      
      blockchainResult = await sendTransaction(
        policyManager,
        'createABACPolicy',
        [
          policyId,
          name,
          description,
          effect === 'Allow' ? 0 : 1, // 0 = Allow, 1 = Deny
          priority,
          requiredRoles,
          subjectAttrNames,
          subjectAttrValues,
          subjectAttrOperators,
          resourceTypes,
          allowedActions
        ]
      );
    } else if (policyType === 'TimeBased') {
      const { startTime, endTime, allowedDays = [], startHour, endHour, isRecurring = false, allowedActions = [] } = rules[0] || {};
      
      blockchainResult = await sendTransaction(
        policyManager,
        'createTimeBasedPolicy',
        [
          policyId,
          name,
          effect === 'Allow' ? 0 : 1,
          startTime || Math.floor(Date.now() / 1000),
          endTime || Math.floor(Date.now() / 1000) + 86400,
          allowedDays,
          startHour || 0,
          endHour || 2359,
          isRecurring,
          allowedActions
        ]
      );
    } else if (policyType === 'LocationBased') {
      const { allowedLocations = [], deniedLocations = [], radiusMeters = 0, coordinates = '', allowedActions = [] } = rules[0] || {};
      
      blockchainResult = await sendTransaction(
        policyManager,
        'createLocationBasedPolicy',
        [
          policyId,
          name,
          effect === 'Allow' ? 0 : 1,
          allowedLocations,
          deniedLocations,
          radiusMeters,
          coordinates,
          allowedActions
        ]
      );
    }

    // Store policy in database
    const policy = new Policy({
      policyId,
      name,
      description,
      policyType,
      effect,
      priority,
      rules,
      creator: req.user.address,
      blockchainTxHash: blockchainResult.transactionHash,
      isActive: true
    });

    await policy.save();

    // Publish policy creation event
    // publishMessage('iot/policies/created', { // This line was removed as per the new_code, as publishMessage is no longer imported.
    //   policyId,
    //   name,
    //   policyType,
    //   effect,
    //   creator: req.user.address,
    //   timestamp: new Date().toISOString()
    // });

    logger.policyEvaluation(policyId, req.user.address, 'policy_creation', 'success');

    res.status(201).json({
      message: 'Policy created successfully',
      policy: {
        policyId,
        name,
        policyType,
        effect,
        priority,
        isActive: true,
        blockchainTxHash: blockchainResult.transactionHash
      }
    });

  } catch (error) {
    logger.error('Policy creation failed:', error);
    res.status(500).json({ error: 'Policy creation failed' });
  }
});

/**
 * @swagger
 * /api/policies:
 *   get:
 *     summary: Get all policies
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by policy type
 *       - in: query
 *         name: effect
 *         schema:
 *           type: string
 *         description: Filter by policy effect
 *     responses:
 *       200:
 *         description: List of policies
 */
router.get('/', auth, async (req, res) => {
  try {
    const { type, effect, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (type) filter.policyType = type;
    if (effect) filter.effect = effect;

    const policies = await Policy.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ priority: -1, createdAt: -1 })
      .exec();

    const count = await Policy.countDocuments(filter);

    res.json({
      policies,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalPolicies: count
    });

  } catch (error) {
    logger.error('Failed to fetch policies:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

/**
 * @swagger
 * /api/policies/{policyId}:
 *   get:
 *     summary: Get policy by ID
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Policy details
 *       404:
 *         description: Policy not found
 */
router.get('/:policyId', auth, async (req, res) => {
  try {
    const { policyId } = req.params;

    const policy = await Policy.findOne({ policyId });
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Get policy info from blockchain
    const policyManager = getContract('policyManager');
    const blockchainInfo = await callMethod(policyManager, 'getPolicyInfo', [policyId]);

    res.json({
      ...policy.toObject(),
      blockchainInfo: {
        policyType: blockchainInfo.policyType,
        effect: blockchainInfo.effect,
        creator: blockchainInfo.creator,
        createdAt: blockchainInfo.createdAt,
        priority: blockchainInfo.priority,
        isActive: blockchainInfo.isActive
      }
    });

  } catch (error) {
    logger.error('Failed to fetch policy:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

/**
 * @swagger
 * /api/policies/{policyId}/evaluate:
 *   post:
 *     summary: Evaluate a policy
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: policyId
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
 *               - subject
 *               - resource
 *               - action
 *             properties:
 *               subject:
 *                 type: string
 *               resource:
 *                 type: string
 *               action:
 *                 type: string
 *               attributes:
 *                 type: object
 *     responses:
 *       200:
 *         description: Policy evaluation result
 */
router.post('/:policyId/evaluate', [
  auth,
  body('subject').notEmpty().withMessage('Subject is required'),
  body('resource').notEmpty().withMessage('Resource is required'),
  body('action').notEmpty().withMessage('Action is required'),
  body('attributes').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { policyId } = req.params;
    const { subject, resource, action, attributes = {} } = req.body;

    // Evaluate policy on blockchain
    const policyManager = getContract('policyManager');
    const attributeKeys = Object.keys(attributes);
    const attributeValues = Object.values(attributes);

    const result = await callMethod(
      policyManager,
      'evaluatePolicy',
      [subject, resource, resource, action, attributeKeys]
    );

    logger.policyEvaluation(policyId, subject, resource, action, result);

    res.json({
      policyId,
      subject,
      resource,
      action,
      result,
      evaluatedAt: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Policy evaluation failed:', error);
    res.status(500).json({ error: 'Policy evaluation failed' });
  }
});

/**
 * @swagger
 * /api/policies/{policyId}/status:
 *   put:
 *     summary: Update policy status
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: policyId
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
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Policy status updated
 */
router.put('/:policyId/status', [
  auth,
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { policyId } = req.params;
    const { isActive } = req.body;

    // Update status on blockchain
    const policyManager = getContract('policyManager');
    await sendTransaction(
      policyManager,
      'updatePolicyStatus',
      [policyId, isActive]
    );

    // Update in database
    await Policy.findOneAndUpdate(
      { policyId },
      { isActive, updatedAt: new Date() }
    );

    logger.policyEvaluation(policyId, req.user.address, 'status_update', isActive ? 'activated' : 'deactivated');

    res.json({ message: 'Policy status updated successfully', isActive });

  } catch (error) {
    logger.error('Failed to update policy status:', error);
    res.status(500).json({ error: 'Failed to update policy status' });
  }
});

/**
 * @swagger
 * /api/policies/{policyId}/usage:
 *   get:
 *     summary: Get policy usage statistics
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: policyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Policy usage statistics
 */
router.get('/:policyId/usage', auth, async (req, res) => {
  try {
    const { policyId } = req.params;

    // Get usage from blockchain
    const policyManager = getContract('policyManager');
    const usage = await callMethod(policyManager, 'getPolicyUsage', [policyId]);

    res.json({
      policyId,
      currentUsage: usage.currentUsageCount,
      maxUsage: usage.maxUsageCount,
      usagePercentage: usage.maxUsageCount > 0 ? 
        (usage.currentUsageCount / usage.maxUsageCount) * 100 : 0
    });

  } catch (error) {
    logger.error('Failed to fetch policy usage:', error);
    res.status(500).json({ error: 'Failed to fetch policy usage' });
  }
});

/**
 * @swagger
 * /api/policies/stats:
 *   get:
 *     summary: Get policy statistics
 *     tags: [Policies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Policy statistics
 */
router.get('/stats/overview', auth, async (req, res) => {
  try {
    // Get total policies count from blockchain
    const policyManager = getContract('policyManager');
    const totalPolicies = await callMethod(policyManager, 'getTotalPolicies');

    // Get statistics from database
    const stats = await Policy.aggregate([
      {
        $group: {
          _id: '$policyType',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    const effectStats = await Policy.aggregate([
      {
        $group: {
          _id: '$effect',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalPolicies,
      byType: stats,
      byEffect: effectStats,
      recentPolicies: await Policy.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('policyId name policyType effect createdAt')
    });

  } catch (error) {
    logger.error('Failed to fetch policy statistics:', error);
    res.status(500).json({ error: 'Failed to fetch policy statistics' });
  }
});

module.exports = router; 