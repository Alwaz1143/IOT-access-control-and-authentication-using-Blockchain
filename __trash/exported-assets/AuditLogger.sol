// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AuditLogger
 * @dev Immutable audit trail logging for IoT access control events
 * Provides comprehensive logging, compliance reporting, and forensic analysis capabilities
 */
contract AuditLogger {
    
    address public admin;
    uint256 public totalLogs;
    
    enum EventType {
        DeviceRegistration,
        DeviceDecommission,
        AccessRequest,
        AccessGrant,
        AccessDenial,
        AccessRevocation,
        PolicyCreation,
        PolicyUpdate,
        PolicyDeletion,
        DelegationCreated,
        DelegationRevoked,
        SecurityIncident,
        SystemEvent,
        ComplianceEvent
    }
    
    enum SeverityLevel {
        Info,       // Regular operations
        Warning,    // Potential issues
        Error,      // Access denials, failures
        Critical    // Security incidents, breaches
    }
    
    struct AuditLog {
        uint256 logId;
        EventType eventType;
        SeverityLevel severity;
        address actor;          // Who performed the action
        string subject;         // User/device identifier
        string resource;        // Resource being accessed
        string action;          // Action being performed
        string details;         // Additional details in JSON format
        uint256 timestamp;
        string ipAddress;       // Source IP (for web requests)
        string userAgent;       // User agent string
        bytes32 transactionHash; // Related blockchain transaction
        bool isCompliant;       // Compliance flag
    }
    
    struct ComplianceReport {
        string reportId;
        string regulationType;  // GDPR, HIPAA, SOX, etc.
        uint256 periodStart;
        uint256 periodEnd;
        uint256 totalEvents;
        uint256 complianceViolations;
        string[] violations;
        uint256 generatedAt;
        address generatedBy;
    }
    
    struct SecurityIncident {
        uint256 incidentId;
        string incidentType;    // "unauthorized_access", "policy_violation", etc.
        SeverityLevel severity;
        address[] involvedActors;
        string[] affectedResources;
        string description;
        uint256 detectedAt;
        uint256 resolvedAt;
        bool isResolved;
        string resolution;
    }
    
    // Mappings
    mapping(uint256 => AuditLog) public auditLogs;
    mapping(address => uint256[]) public userLogs;
    mapping(string => uint256[]) public resourceLogs;
    mapping(EventType => uint256[]) public eventTypeLogs;
    mapping(string => ComplianceReport) public complianceReports;
    mapping(uint256 => SecurityIncident) public securityIncidents;
    
    // Counters
    uint256 public totalSecurityIncidents;
    mapping(EventType => uint256) public eventCounts;
    mapping(SeverityLevel => uint256) public severityCounts;
    
    // Events
    event LogCreated(
        uint256 indexed logId,
        EventType indexed eventType,
        SeverityLevel indexed severity,
        address actor,
        uint256 timestamp
    );
    
    event SecurityIncidentDetected(
        uint256 indexed incidentId,
        string incidentType,
        SeverityLevel severity,
        uint256 timestamp
    );
    
    event ComplianceReportGenerated(
        string indexed reportId,
        string regulationType,
        uint256 totalEvents,
        uint256 violations,
        uint256 timestamp
    );
    
    event AuditTrailExported(
        address indexed requester,
        uint256 fromTimestamp,
        uint256 toTimestamp,
        uint256 totalLogs,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "AuditLogger: Only admin can perform this action");
        _;
    }
    
    modifier onlyAuthorizedLogger() {
        // In practice, this would check if the caller is an authorized contract
        // For demonstration, allowing any contract to log
        _;
    }
    
    constructor() {
        admin = msg.sender;
        totalLogs = 0;
        totalSecurityIncidents = 0;
    }
    
    /**
     * @dev Log device registration event
     */
    function logDeviceRegistration(
        address actor,
        string memory deviceId,
        string memory deviceType,
        string memory details
    ) external onlyAuthorizedLogger {
        _createAuditLog(
            EventType.DeviceRegistration,
            SeverityLevel.Info,
            actor,
            deviceId,
            "device_registry",
            "register",
            details,
            "",
            "",
            bytes32(0),
            true
        );
    }
    
    /**
     * @dev Log access request event
     */
    function logAccessRequest(
        address actor,
        string memory deviceId,
        string memory resource,
        string memory action,
        string memory details
    ) external onlyAuthorizedLogger {
        _createAuditLog(
            EventType.AccessRequest,
            SeverityLevel.Info,
            actor,
            deviceId,
            resource,
            action,
            details,
            "",
            "",
            bytes32(0),
            true
        );
    }
    
    /**
     * @dev Log access grant event
     */
    function logAccessGrant(
        string memory grantId,
        address grantee,
        string memory deviceId,
        string memory resource,
        string memory action,
        uint256 grantTimestamp
    ) external onlyAuthorizedLogger {
        string memory details = string(abi.encodePacked(
            '{"grantId":"', grantId, '",',
            '"grantTimestamp":', _uint2str(grantTimestamp), '}'
        ));
        
        _createAuditLog(
            EventType.AccessGrant,
            SeverityLevel.Info,
            grantee,
            deviceId,
            resource,
            action,
            details,
            "",
            "",
            bytes32(0),
            true
        );
    }
    
    /**
     * @dev Log access denial event
     */
    function logAccessDenial(
        uint256 requestId,
        address requester,
        string memory deviceId,
        string memory reason,
        uint256 denialTimestamp
    ) external onlyAuthorizedLogger {
        string memory details = string(abi.encodePacked(
            '{"requestId":', _uint2str(requestId), ',',
            '"reason":"', reason, '",',
            '"denialTimestamp":', _uint2str(denialTimestamp), '}'
        ));
        
        _createAuditLog(
            EventType.AccessDenial,
            SeverityLevel.Warning,
            requester,
            deviceId,
            "access_control",
            "deny",
            details,
            "",
            "",
            bytes32(0),
            true
        );
    }
    
    /**
     * @dev Log access revocation event
     */
    function logAccessRevocation(
        string memory grantId,
        address revokedBy,
        string memory reason,
        uint256 revocationTimestamp
    ) external onlyAuthorizedLogger {
        string memory details = string(abi.encodePacked(
            '{"grantId":"', grantId, '",',
            '"reason":"', reason, '",',
            '"revocationTimestamp":', _uint2str(revocationTimestamp), '}'
        ));
        
        _createAuditLog(
            EventType.AccessRevocation,
            SeverityLevel.Warning,
            revokedBy,
            grantId,
            "access_control",
            "revoke",
            details,
            "",
            "",
            bytes32(0),
            true
        );
    }
    
    /**
     * @dev Log security incident
     */
    function logSecurityIncident(
        string memory incidentType,
        SeverityLevel severity,
        address[] memory involvedActors,
        string[] memory affectedResources,
        string memory description
    ) external onlyAuthorizedLogger returns (uint256) {
        uint256 incidentId = totalSecurityIncidents;
        totalSecurityIncidents++;
        
        SecurityIncident storage incident = securityIncidents[incidentId];
        incident.incidentId = incidentId;
        incident.incidentType = incidentType;
        incident.severity = severity;
        incident.involvedActors = involvedActors;
        incident.affectedResources = affectedResources;
        incident.description = description;
        incident.detectedAt = block.timestamp;
        incident.resolvedAt = 0;
        incident.isResolved = false;
        incident.resolution = "";
        
        // Create audit log for the security incident
        string memory details = string(abi.encodePacked(
            '{"incidentId":', _uint2str(incidentId), ',',
            '"incidentType":"', incidentType, '",',
            '"description":"', description, '"}'
        ));
        
        _createAuditLog(
            EventType.SecurityIncident,
            severity,
            msg.sender,
            "system",
            "security",
            "incident_detected",
            details,
            "",
            "",
            bytes32(0),
            false // Mark as non-compliant initially
        );
        
        emit SecurityIncidentDetected(incidentId, incidentType, severity, block.timestamp);
        
        return incidentId;
    }
    
    /**
     * @dev Resolve security incident
     */
    function resolveSecurityIncident(
        uint256 incidentId,
        string memory resolution
    ) external onlyAdmin {
        require(incidentId < totalSecurityIncidents, "AuditLogger: Invalid incident ID");
        require(!securityIncidents[incidentId].isResolved, "AuditLogger: Incident already resolved");
        
        securityIncidents[incidentId].resolvedAt = block.timestamp;
        securityIncidents[incidentId].isResolved = true;
        securityIncidents[incidentId].resolution = resolution;
        
        // Log resolution
        string memory details = string(abi.encodePacked(
            '{"incidentId":', _uint2str(incidentId), ',',
            '"resolution":"', resolution, '"}'
        ));
        
        _createAuditLog(
            EventType.SecurityIncident,
            SeverityLevel.Info,
            msg.sender,
            "system",
            "security",
            "incident_resolved",
            details,
            "",
            "",
            bytes32(0),
            true
        );
    }
    
    /**
     * @dev Create comprehensive audit log entry
     */
    function _createAuditLog(
        EventType eventType,
        SeverityLevel severity,
        address actor,
        string memory subject,
        string memory resource,
        string memory action,
        string memory details,
        string memory ipAddress,
        string memory userAgent,
        bytes32 transactionHash,
        bool isCompliant
    ) internal {
        uint256 logId = totalLogs;
        totalLogs++;
        
        AuditLog storage log = auditLogs[logId];
        log.logId = logId;
        log.eventType = eventType;
        log.severity = severity;
        log.actor = actor;
        log.subject = subject;
        log.resource = resource;
        log.action = action;
        log.details = details;
        log.timestamp = block.timestamp;
        log.ipAddress = ipAddress;
        log.userAgent = userAgent;
        log.transactionHash = transactionHash;
        log.isCompliant = isCompliant;
        
        // Update indexes
        userLogs[actor].push(logId);
        resourceLogs[resource].push(logId);
        eventTypeLogs[eventType].push(logId);
        
        // Update counters
        eventCounts[eventType]++;
        severityCounts[severity]++;
        
        emit LogCreated(logId, eventType, severity, actor, block.timestamp);
    }
    
    /**
     * @dev Generate compliance report
     */
    function generateComplianceReport(
        string memory reportId,
        string memory regulationType,
        uint256 periodStart,
        uint256 periodEnd
    ) external onlyAdmin returns (string memory) {
        require(periodStart < periodEnd, "AuditLogger: Invalid period");
        require(periodEnd <= block.timestamp, "AuditLogger: Future end time");
        
        uint256 totalEvents = 0;
        uint256 violations = 0;
        string[] memory violationList = new string[](100); // Max 100 violations
        uint256 violationCount = 0;
        
        // Analyze logs in the specified period
        for (uint256 i = 0; i < totalLogs; i++) {
            AuditLog storage log = auditLogs[i];
            
            if (log.timestamp >= periodStart && log.timestamp <= periodEnd) {
                totalEvents++;
                
                if (!log.isCompliant) {
                    violations++;
                    if (violationCount < 100) {
                        violationList[violationCount] = string(abi.encodePacked(
                            "LogID:", _uint2str(i), ",Type:", _eventTypeToString(log.eventType)
                        ));
                        violationCount++;
                    }
                }
            }
        }
        
        // Resize violations array to actual count
        string[] memory finalViolations = new string[](violationCount);
        for (uint256 i = 0; i < violationCount; i++) {
            finalViolations[i] = violationList[i];
        }
        
        ComplianceReport storage report = complianceReports[reportId];
        report.reportId = reportId;
        report.regulationType = regulationType;
        report.periodStart = periodStart;
        report.periodEnd = periodEnd;
        report.totalEvents = totalEvents;
        report.complianceViolations = violations;
        report.violations = finalViolations;
        report.generatedAt = block.timestamp;
        report.generatedBy = msg.sender;
        
        emit ComplianceReportGenerated(reportId, regulationType, totalEvents, violations, block.timestamp);
        
        return reportId;
    }
    
    /**
     * @dev Get audit logs for specific time period
     */
    function getLogsByTimePeriod(
        uint256 startTime,
        uint256 endTime,
        uint256 offset,
        uint256 limit
    ) external view returns (
        uint256[] memory logIds,
        EventType[] memory eventTypes,
        SeverityLevel[] memory severities,
        address[] memory actors,
        uint256[] memory timestamps
    ) {
        require(startTime <= endTime, "AuditLogger: Invalid time range");
        require(limit > 0 && limit <= 100, "AuditLogger: Invalid limit");
        
        uint256[] memory tempLogIds = new uint256[](limit);
        EventType[] memory tempEventTypes = new EventType[](limit);
        SeverityLevel[] memory tempSeverities = new SeverityLevel[](limit);
        address[] memory tempActors = new address[](limit);
        uint256[] memory tempTimestamps = new uint256[](limit);
        
        uint256 count = 0;
        uint256 currentOffset = 0;
        
        for (uint256 i = 0; i < totalLogs && count < limit; i++) {
            AuditLog storage log = auditLogs[i];
            
            if (log.timestamp >= startTime && log.timestamp <= endTime) {
                if (currentOffset >= offset) {
                    tempLogIds[count] = log.logId;
                    tempEventTypes[count] = log.eventType;
                    tempSeverities[count] = log.severity;
                    tempActors[count] = log.actor;
                    tempTimestamps[count] = log.timestamp;
                    count++;
                }
                currentOffset++;
            }
        }
        
        // Resize arrays to actual count
        logIds = new uint256[](count);
        eventTypes = new EventType[](count);
        severities = new SeverityLevel[](count);
        actors = new address[](count);
        timestamps = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            logIds[i] = tempLogIds[i];
            eventTypes[i] = tempEventTypes[i];
            severities[i] = tempSeverities[i];
            actors[i] = tempActors[i];
            timestamps[i] = tempTimestamps[i];
        }
    }
    
    /**
     * @dev Get logs for specific user
     */
    function getUserLogs(address user, uint256 limit) external view returns (uint256[] memory) {
        uint256[] memory userLogIds = userLogs[user];
        
        if (userLogIds.length <= limit) {
            return userLogIds;
        }
        
        // Return most recent logs
        uint256[] memory result = new uint256[](limit);
        uint256 startIndex = userLogIds.length - limit;
        
        for (uint256 i = 0; i < limit; i++) {
            result[i] = userLogIds[startIndex + i];
        }
        
        return result;
    }
    
    /**
     * @dev Get audit statistics
     */
    function getAuditStatistics() external view returns (
        uint256 totalLogsCount,
        uint256 totalIncidents,
        uint256 infoCount,
        uint256 warningCount,
        uint256 errorCount,
        uint256 criticalCount
    ) {
        return (
            totalLogs,
            totalSecurityIncidents,
            severityCounts[SeverityLevel.Info],
            severityCounts[SeverityLevel.Warning],
            severityCounts[SeverityLevel.Error],
            severityCounts[SeverityLevel.Critical]
        );
    }
    
    /**
     * @dev Export audit trail for external analysis
     */
    function exportAuditTrail(
        uint256 fromTimestamp,
        uint256 toTimestamp
    ) external onlyAdmin {
        require(fromTimestamp < toTimestamp, "AuditLogger: Invalid time range");
        
        uint256 exportedLogs = 0;
        
        for (uint256 i = 0; i < totalLogs; i++) {
            if (auditLogs[i].timestamp >= fromTimestamp && auditLogs[i].timestamp <= toTimestamp) {
                exportedLogs++;
            }
        }
        
        emit AuditTrailExported(msg.sender, fromTimestamp, toTimestamp, exportedLogs, block.timestamp);
    }
    
    /**
     * @dev Internal utility to convert uint to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
    
    /**
     * @dev Convert EventType enum to string
     */
    function _eventTypeToString(EventType eventType) internal pure returns (string memory) {
        if (eventType == EventType.DeviceRegistration) return "DeviceRegistration";
        if (eventType == EventType.AccessRequest) return "AccessRequest";
        if (eventType == EventType.AccessGrant) return "AccessGrant";
        if (eventType == EventType.AccessDenial) return "AccessDenial";
        if (eventType == EventType.SecurityIncident) return "SecurityIncident";
        return "Unknown";
    }
    
    /**
     * @dev Get log details
     */
    function getLogDetails(uint256 logId) external view returns (
        EventType eventType,
        SeverityLevel severity,
        address actor,
        string memory subject,
        string memory resource,
        string memory action,
        string memory details,
        uint256 timestamp,
        bool isCompliant
    ) {
        require(logId < totalLogs, "AuditLogger: Invalid log ID");
        
        AuditLog storage log = auditLogs[logId];
        return (
            log.eventType,
            log.severity,
            log.actor,
            log.subject,
            log.resource,
            log.action,
            log.details,
            log.timestamp,
            log.isCompliant
        );
    }
}