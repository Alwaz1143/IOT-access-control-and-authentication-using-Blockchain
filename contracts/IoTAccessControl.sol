// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeviceRegistry.sol";
import "./PolicyManager.sol";
import "./AuditLogger.sol";

/**
 * @title IoTAccessControl
 * @dev Advanced IoT Access Control System with Blockchain Integration
 * Inspired by OACS and DUPH-BAAC research papers
 * Features: ABAC, time-based policies, delegation, audit trails
 */
contract IoTAccessControl {
    
    // State Variables
    DeviceRegistry public deviceRegistry;
    PolicyManager public policyManager;
    AuditLogger public auditLogger;
    
    address public admin;
    uint256 public totalAccessRequests;
    uint256 public totalAccessGrants;
    uint256 public totalAccessDenials;
    
    // Structs
    struct AccessRequest {
        address requester;
        string deviceId;
        string resource;
        string action;
        uint256 timestamp;
        uint256 expirationTime;
        bool isActive;
        mapping(string => string) attributes;
        string[] attributeKeys;
    }
    
    struct AccessGrant {
        string grantId;
        address grantee;
        string deviceId;
        string resource;
        string action;
        uint256 grantedAt;
        uint256 validUntil;
        bool isRevoked;
        address grantedBy;
        string conditions;
    }
    
    struct DelegationChain {
        address delegator;
        address delegatee;
        string[] permissions;
        uint256 validUntil;
        uint256 maxDelegationDepth;
        bool isActive;
    }
    
    // Mappings
    mapping(uint256 => AccessRequest) public accessRequests;
    mapping(string => AccessGrant) public accessGrants;
    mapping(address => DelegationChain[]) public delegationChains;
    mapping(string => bool) public revokedGrants;
    mapping(address => uint256) public userAccessCount;
    mapping(string => uint256) public deviceAccessCount;
    
    // Events
    event AccessRequested(
        uint256 indexed requestId,
        address indexed requester,
        string deviceId,
        string resource,
        string action,
        uint256 timestamp
    );
    
    event AccessGranted(
        string indexed grantId,
        address indexed grantee,
        string deviceId,
        string resource,
        string action,
        uint256 validUntil
    );
    
    event AccessDenied(
        uint256 indexed requestId,
        address indexed requester,
        string deviceId,
        string reason,
        uint256 timestamp
    );
    
    event AccessRevoked(
        string indexed grantId,
        address indexed revokedBy,
        string reason,
        uint256 timestamp
    );
    
    event DelegationCreated(
        address indexed delegator,
        address indexed delegatee,
        string[] permissions,
        uint256 validUntil
    );
    
    event UnauthorizedAccessAttempt(
        address indexed attacker,
        string deviceId,
        string resource,
        string reason,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "IoTAccessControl: Only admin can perform this action");
        _;
    }
    
    modifier onlyAuthorizedDevice(string memory deviceId) {
        require(deviceRegistry.isDeviceRegistered(deviceId), "IoTAccessControl: Device not registered");
        require(deviceRegistry.isDeviceActive(deviceId), "IoTAccessControl: Device not active");
        _;
    }
    
    modifier validTimeframe(uint256 validUntil) {
        require(validUntil > block.timestamp, "IoTAccessControl: Invalid timeframe");
        _;
    }
    
    modifier onlyValidGrant(string memory grantId) {
        require(bytes(accessGrants[grantId].grantId).length > 0, "IoTAccessControl: Grant does not exist");
        require(!accessGrants[grantId].isRevoked, "IoTAccessControl: Grant is revoked");
        require(accessGrants[grantId].validUntil > block.timestamp, "IoTAccessControl: Grant expired");
        _;
    }
    
    // Constructor
    constructor(
        address _deviceRegistry,
        address _policyManager,
        address _auditLogger
    ) {
        admin = msg.sender;
        deviceRegistry = DeviceRegistry(_deviceRegistry);
        policyManager = PolicyManager(_policyManager);
        auditLogger = AuditLogger(_auditLogger);
        totalAccessRequests = 0;
        totalAccessGrants = 0;
        totalAccessDenials = 0;
    }
    
    /**
     * @dev Request access to a specific resource on a device
     * @param deviceId The target device identifier
     * @param resource The resource being accessed
     * @param action The action to be performed
     * @param attributes Key-value pairs of request attributes
     * @param attributeKeys Array of attribute keys
     * @param validityDuration Duration for which access is requested (in seconds)
     */
    function requestAccess(
        string memory deviceId,
        string memory resource,
        string memory action,
        string[] memory attributeKeys,
        string[] memory attributeValues,
        uint256 validityDuration
    ) external onlyAuthorizedDevice(deviceId) returns (uint256) {
        require(attributeKeys.length == attributeValues.length, "IoTAccessControl: Attributes mismatch");
        require(validityDuration > 0 && validityDuration <= 86400, "IoTAccessControl: Invalid validity duration"); // Max 24 hours
        
        uint256 requestId = totalAccessRequests;
        totalAccessRequests++;
        
        AccessRequest storage request = accessRequests[requestId];
        request.requester = msg.sender;
        request.deviceId = deviceId;
        request.resource = resource;  
        request.action = action;
        request.timestamp = block.timestamp;
        request.expirationTime = block.timestamp + validityDuration;
        request.isActive = true;
        request.attributeKeys = attributeKeys;
        
        // Store attributes
        for (uint256 i = 0; i < attributeKeys.length; i++) {
            request.attributes[attributeKeys[i]] = attributeValues[i];
        }
        
        emit AccessRequested(requestId, msg.sender, deviceId, resource, action, block.timestamp);
        
        // Immediately evaluate the access request
        _evaluateAccessRequest(requestId);
        
        return requestId;
    }
    
    /**
     * @dev Internal function to evaluate access requests using ABAC policies
     */
    function _evaluateAccessRequest(uint256 requestId) internal {
        AccessRequest storage request = accessRequests[requestId];
        
        // Check if user has valid delegation
        bool hasDelegation = _checkDelegationChain(request.requester, request.action);
        
        // Get policy evaluation result
        bool policyResult = policyManager.evaluatePolicy(
            request.requester,
            request.deviceId,
            request.resource,
            request.action,
            request.attributeKeys
        );
        
        // Check device-specific permissions
        bool devicePermission = deviceRegistry.hasDevicePermission(
            request.requester,
            request.deviceId,
            request.action
        );
        
        // Check time-based constraints
        bool timeConstraint = _checkTimeConstraints(request.requester, request.action);
        
        if (policyResult && (devicePermission || hasDelegation) && timeConstraint) {
            _grantAccess(requestId);
        } else {
            _denyAccess(requestId, "Policy evaluation failed or insufficient permissions");
        }
    }
    
    /**
     * @dev Grant access based on successful policy evaluation
     */
    function _grantAccess(uint256 requestId) internal {
        AccessRequest storage request = accessRequests[requestId];
        string memory grantId = _generateGrantId(requestId);
        
        AccessGrant storage grant = accessGrants[grantId];
        grant.grantId = grantId;
        grant.grantee = request.requester;
        grant.deviceId = request.deviceId;
        grant.resource = request.resource;
        grant.action = request.action;
        grant.grantedAt = block.timestamp;
        grant.validUntil = request.expirationTime;
        grant.isRevoked = false;
        grant.grantedBy = address(this);
        grant.conditions = "Standard ABAC policy evaluation";
        
        totalAccessGrants++;
        userAccessCount[request.requester]++;
        deviceAccessCount[request.deviceId]++;
        
        // Log to audit trail
        auditLogger.logAccessGrant(
            grantId,
            request.requester,
            request.deviceId,
            request.resource,
            request.action,
            block.timestamp
        );
        
        emit AccessGranted(grantId, request.requester, request.deviceId, request.resource, request.action, request.expirationTime);
    }
    
    /**
     * @dev Deny access request
     */
    function _denyAccess(uint256 requestId, string memory reason) internal {
        AccessRequest storage request = accessRequests[requestId];
        request.isActive = false;
        
        totalAccessDenials++;
        
        // Log to audit trail
        auditLogger.logAccessDenial(
            requestId,
            request.requester,
            request.deviceId,
            reason,
            block.timestamp
        );
        
        emit AccessDenied(requestId, request.requester, request.deviceId, reason, block.timestamp);
        emit UnauthorizedAccessAttempt(request.requester, request.deviceId, request.resource, reason, block.timestamp);
    }
    
    /**
     * @dev Revoke an existing access grant
     */
    function revokeAccess(
        string memory grantId,
        string memory reason
    ) external onlyValidGrant(grantId) {
        AccessGrant storage grant = accessGrants[grantId];
        
        // Only admin or grant owner can revoke
        require(
            msg.sender == admin || msg.sender == grant.grantee || msg.sender == grant.grantedBy,
            "IoTAccessControl: Unauthorized revocation attempt"
        );
        
        grant.isRevoked = true;
        revokedGrants[grantId] = true;
        
        // Log to audit trail
        auditLogger.logAccessRevocation(grantId, msg.sender, reason, block.timestamp);
        
        emit AccessRevoked(grantId, msg.sender, reason, block.timestamp);
    }
    
    /**
     * @dev Create delegation chain for access permissions
     */
    function createDelegation(
        address delegatee,
        string[] memory permissions,
        uint256 validityDuration,
        uint256 maxDepth
    ) external validTimeframe(block.timestamp + validityDuration) {
        require(delegatee != msg.sender, "IoTAccessControl: Cannot delegate to self");
        require(permissions.length > 0, "IoTAccessControl: No permissions specified");
        require(maxDepth > 0 && maxDepth <= 5, "IoTAccessControl: Invalid delegation depth");
        
        DelegationChain memory delegation = DelegationChain({
            delegator: msg.sender,
            delegatee: delegatee,
            permissions: permissions,
            validUntil: block.timestamp + validityDuration,
            maxDelegationDepth: maxDepth,
            isActive: true
        });
        
        delegationChains[delegatee].push(delegation);
        
        emit DelegationCreated(msg.sender, delegatee, permissions, block.timestamp + validityDuration);
    }
    
    /**
     * @dev Check if user has valid delegation for specific action
     */
    function _checkDelegationChain(address user, string memory action) internal view returns (bool) {
        DelegationChain[] memory delegations = delegationChains[user];
        
        for (uint256 i = 0; i < delegations.length; i++) {
            if (delegations[i].isActive && delegations[i].validUntil > block.timestamp) {
                for (uint256 j = 0; j < delegations[i].permissions.length; j++) {
                    if (keccak256(bytes(delegations[i].permissions[j])) == keccak256(bytes(action))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    /**
     * @dev Check time-based access constraints
     */
    function _checkTimeConstraints(address user, string memory action) internal view returns (bool) {
        // This would integrate with PolicyManager for time-based policies
        return policyManager.checkTimeConstraints(user, action, block.timestamp);
    }
    
    /**
     * @dev Generate unique grant ID
     */
    function _generateGrantId(uint256 requestId) internal view returns (string memory) {
        return string(abi.encodePacked("grant_", 
            Strings.toString(requestId), 
            "_", 
            Strings.toString(block.timestamp)
        ));
    }
    
    /**
     * @dev Check if access grant is valid and active
     */
    function isAccessGrantValid(string memory grantId) external view returns (bool) {
        AccessGrant memory grant = accessGrants[grantId];
        return bytes(grant.grantId).length > 0 && 
               !grant.isRevoked && 
               grant.validUntil > block.timestamp;
    }
    
    /**
     * @dev Get access statistics
     */
    function getAccessStats() external view returns (
        uint256 totalRequests,
        uint256 totalGrants,  
        uint256 totalDenials,
        uint256 successRate
    ) {
        totalRequests = totalAccessRequests;
        totalGrants = totalAccessGrants;
        totalDenials = totalAccessDenials;
        
        if (totalRequests > 0) {
            successRate = (totalGrants * 100) / totalRequests;
        } else {
            successRate = 0;
        }
    }
    
    /**
     * @dev Get user access history
     */
    function getUserAccessHistory(address user) external view returns (
        uint256 accessCount,
        string[] memory recentGrants
    ) {
        accessCount = userAccessCount[user];
        
        // This would be implemented with events or separate storage
        // For brevity, returning empty array
        recentGrants = new string[](0);
    }
    
    /**
     * @dev Emergency function to pause all access grants
     */
    function emergencyPause() external onlyAdmin {
        // Implementation would set a global pause state
        // and emit an emergency event
    }
    
    /**
     * @dev Update contract addresses (for upgradability)
     */
    function updateContractAddresses(
        address _deviceRegistry,
        address _policyManager,
        address _auditLogger
    ) external onlyAdmin {
        deviceRegistry = DeviceRegistry(_deviceRegistry);
        policyManager = PolicyManager(_policyManager);
        auditLogger = AuditLogger(_auditLogger);
    }
}

// Import for string utilities
library Strings {
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}