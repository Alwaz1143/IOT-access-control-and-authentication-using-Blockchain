const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { getAuditLogger, sendTransaction } = require('../config/blockchain');
const logger = require('../utils/logger');
const Device = require('../models/Device');
const User = require('../models/User');

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         eventType:
 *           type: string
 *           enum: [device_registration, access_request, access_grant, access_denial, access_revocation, security_incident, policy_change]
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         deviceId:
 *           type: string
 *         userId:
 *           type: string
 *         action:
 *           type: string
 *         details:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *         transactionHash:
 *           type: string
 *     ComplianceReport:
 *       type: object
 *       properties:
 *         reportId:
 *           type: string
 *         reportType:
 *           type: string
 *           enum: [access_audit, security_incident, policy_compliance, device_activity]
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         summary:
 *           type: object
 *         details:
 *           type: array
 *           items:
 *             type: object
 *         generatedAt:
 *           type: string
 *           format: date-time
 *     SecurityIncident:
 *       type: object
 *       properties:
 *         incidentId:
 *           type: string
 *         incidentType:
 *           type: string
 *           enum: [unauthorized_access, policy_violation, device_compromise, data_breach]
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         deviceId:
 *           type: string
 *         userId:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [open, investigating, resolved, closed]
 *         timestamp:
 *           type: string
 *           format: date-time
 *         resolution:
 *           type: string
 */

/**
 * @swagger
 * /api/audit/logs:
 *   get:
 *     summary: Get audit logs with filtering
 *     tags: [Audit & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *           enum: [device_registration, access_request, access_grant, access_denial, access_revocation, security_incident, policy_change]
 *         description: Filter by event type
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *         description: Filter by device ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/logs', auth, requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const {
      eventType,
      severity,
      deviceId,
      userId,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    // Get audit logs from blockchain
    const auditLogger = await getAuditLogger();
    const logs = await auditLogger.methods.getAuditLogs(
      parseInt(limit),
      parseInt(offset)
    ).call();

    // Apply filters
    let filteredLogs = logs;

    if (eventType) {
      filteredLogs = filteredLogs.filter(log => log.eventType === eventType);
    }

    if (severity) {
      filteredLogs = filteredLogs.filter(log => log.severity === severity);
    }

    if (deviceId) {
      filteredLogs = filteredLogs.filter(log => log.deviceId === deviceId);
    }

    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === userId);
    }

    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startTimestamp);
    }

    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endTimestamp);
    }

    // Log the audit log retrieval
    logger.auditLogRetrieval({
      requesterId: req.user.id,
      filters: { eventType, severity, deviceId, userId, startDate, endDate },
      resultCount: filteredLogs.length
    });

    res.json({
      success: true,
      data: {
        logs: filteredLogs,
        total: filteredLogs.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        filters: { eventType, severity, deviceId, userId, startDate, endDate }
      }
    });

  } catch (error) {
    logger.error('Audit logs retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/audit/logs/{deviceId}:
 *   get:
 *     summary: Get audit logs for a specific device
 *     tags: [Audit & Compliance]
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
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
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
 *         description: Device audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Device not found
 *       500:
 *         description: Internal server error
 */
router.get('/logs/:deviceId', auth, requireRole(['admin', 'auditor', 'device_owner']), async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { eventType, limit = 50, offset = 0 } = req.query;

    // Check if device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check device ownership (unless admin or auditor)
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('auditor')) {
      if (device.ownerId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to view device audit logs'
        });
      }
    }

    // Get device audit logs from blockchain
    const auditLogger = await getAuditLogger();
    const logs = await auditLogger.methods.getDeviceAuditLogs(
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
    logger.error('Device audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve device audit logs',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/audit/reports/generate:
 *   post:
 *     summary: Generate compliance report
 *     tags: [Audit & Compliance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportType
 *               - startDate
 *               - endDate
 *             properties:
 *               reportType:
 *                 type: string
 *                 enum: [access_audit, security_incident, policy_compliance, device_activity]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               deviceId:
 *                 type: string
 *               userId:
 *                 type: string
 *               includeDetails:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Compliance report generated successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/reports/generate', auth, requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const {
      reportType,
      startDate,
      endDate,
      deviceId,
      userId,
      includeDetails = true
    } = req.body;

    // Validate required fields
    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Report type, start date, and end date are required'
      });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Generate report on blockchain
    const auditLogger = await getAuditLogger();
    const tx = await sendTransaction(
      auditLogger.methods.generateComplianceReport(
        reportType,
        Math.floor(start.getTime() / 1000),
        Math.floor(end.getTime() / 1000),
        deviceId || '',
        userId || '',
        includeDetails
      )
    );

    // Get the generated report
    const report = await auditLogger.methods.getComplianceReport(tx.transactionHash).call();

    // Log the report generation
    logger.complianceReportGeneration({
      reportType,
      startDate,
      endDate,
      deviceId,
      userId,
      requesterId: req.user.id,
      transactionHash: tx.transactionHash
    });

    res.json({
      success: true,
      message: 'Compliance report generated successfully',
      data: {
        reportId: tx.transactionHash,
        report,
        generatedAt: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Compliance report generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate compliance report',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/audit/reports/{reportId}:
 *   get:
 *     summary: Get compliance report by ID
 *     tags: [Audit & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID (transaction hash)
 *     responses:
 *       200:
 *         description: Compliance report retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Report not found
 *       500:
 *         description: Internal server error
 */
router.get('/reports/:reportId', auth, requireRole(['admin', 'auditor']), async (req, res) => {
  try {
    const { reportId } = req.params;

    // Get report from blockchain
    const auditLogger = await getAuditLogger();
    const report = await auditLogger.methods.getComplianceReport(reportId).call();

    if (!report || !report.reportId) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: {
        report
      }
    });

  } catch (error) {
    logger.error('Compliance report retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve compliance report',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/audit/incidents:
 *   get:
 *     summary: Get security incidents
 *     tags: [Audit & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, investigating, resolved, closed]
 *         description: Filter by incident status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
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
 *         description: Security incidents retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.get('/incidents', auth, requireRole(['admin', 'security_analyst']), async (req, res) => {
  try {
    const {
      status,
      severity,
      deviceId,
      limit = 50,
      offset = 0
    } = req.query;

    // Get security incidents from blockchain
    const auditLogger = await getAuditLogger();
    const incidents = await auditLogger.methods.getSecurityIncidents(
      parseInt(limit),
      parseInt(offset)
    ).call();

    // Apply filters
    let filteredIncidents = incidents;

    if (status) {
      filteredIncidents = filteredIncidents.filter(incident => incident.status === status);
    }

    if (severity) {
      filteredIncidents = filteredIncidents.filter(incident => incident.severity === severity);
    }

    if (deviceId) {
      filteredIncidents = filteredIncidents.filter(incident => incident.deviceId === deviceId);
    }

    res.json({
      success: true,
      data: {
        incidents: filteredIncidents,
        total: filteredIncidents.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logger.error('Security incidents retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security incidents',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/audit/incidents:
 *   post:
 *     summary: Report a security incident
 *     tags: [Audit & Compliance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - incidentType
 *               - severity
 *               - description
 *             properties:
 *               incidentType:
 *                 type: string
 *                 enum: [unauthorized_access, policy_violation, device_compromise, data_breach]
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               deviceId:
 *                 type: string
 *               userId:
 *                 type: string
 *               description:
 *                 type: string
 *               evidence:
 *                 type: object
 *     responses:
 *       200:
 *         description: Security incident reported successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Internal server error
 */
router.post('/incidents', auth, requireRole(['admin', 'security_analyst', 'device_owner']), async (req, res) => {
  try {
    const {
      incidentType,
      severity,
      deviceId,
      userId,
      description,
      evidence
    } = req.body;

    // Validate required fields
    if (!incidentType || !severity || !description) {
      return res.status(400).json({
        success: false,
        message: 'Incident type, severity, and description are required'
      });
    }

    // Check if device exists (if provided)
    let deviceBlockchainId = '';
    if (deviceId) {
      const device = await Device.findById(deviceId);
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }
      deviceBlockchainId = device.blockchainId;
    }

    // Check if user exists (if provided)
    let userBlockchainId = '';
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      userBlockchainId = user.blockchainId;
    }

    // Report incident to blockchain
    const auditLogger = await getAuditLogger();
    const tx = await sendTransaction(
      auditLogger.methods.reportSecurityIncident(
        incidentType,
        severity,
        deviceBlockchainId,
        userBlockchainId,
        description,
        JSON.stringify(evidence || {})
      )
    );

    // Log the incident report
    logger.securityIncidentReport({
      incidentType,
      severity,
      deviceId,
      userId,
      description,
      reporterId: req.user.id,
      transactionHash: tx.transactionHash
    });

    res.json({
      success: true,
      message: 'Security incident reported successfully',
      data: {
        incidentId: tx.transactionHash,
        incidentType,
        severity,
        deviceId,
        userId,
        description,
        timestamp: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Security incident report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report security incident',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/audit/incidents/{incidentId}/update:
 *   put:
 *     summary: Update security incident status
 *     tags: [Audit & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: incidentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Incident ID
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
 *                 enum: [open, investigating, resolved, closed]
 *               resolution:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Incident status updated successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Incident not found
 *       500:
 *         description: Internal server error
 */
router.put('/incidents/:incidentId/update', auth, requireRole(['admin', 'security_analyst']), async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { status, resolution, notes } = req.body;

    // Validate required fields
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Update incident status on blockchain
    const auditLogger = await getAuditLogger();
    const tx = await sendTransaction(
      auditLogger.methods.updateIncidentStatus(
        incidentId,
        status,
        resolution || '',
        notes || ''
      )
    );

    // Log the incident update
    logger.incidentStatusUpdate({
      incidentId,
      status,
      resolution,
      notes,
      updaterId: req.user.id,
      transactionHash: tx.transactionHash
    });

    res.json({
      success: true,
      message: 'Incident status updated successfully',
      data: {
        incidentId,
        status,
        resolution,
        notes,
        updatedAt: new Date().toISOString(),
        transactionHash: tx.transactionHash
      }
    });

  } catch (error) {
    logger.error('Incident status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update incident status',
      error: error.message
    });
  }
});

module.exports = router; 