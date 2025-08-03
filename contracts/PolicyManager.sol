// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PolicyManager
 * @dev Advanced policy management with ABAC, time-based, and location-based policies
 * Implements dynamic policy evaluation inspired by DUPH-BAAC research
 */
contract PolicyManager {
    
    address public admin;
    uint256 public totalPolicies;
    
    enum PolicyType { RBAC, ABAC, TimeBased, LocationBased, Composite }
    enum PolicyEffect { Allow, Deny }
    enum ComparisonOperator { Equal, NotEqual, GreaterThan, LessThan, Contains, StartsWith }
    
    struct AttributeCondition {
        string attributeName;
        string expectedValue;
        ComparisonOperator operator;
    }
    
    struct TimeConstraint {
        uint256 startTime;     // Unix timestamp
        uint256 endTime;       // Unix timestamp
        uint8[] allowedDays;   // 0=Sunday, 1=Monday, etc.
        uint16 startHour;      // 0-2359 (HHMM format)
        uint16 endHour;        // 0-2359 (HHMM format)
        bool isRecurring;
    }
    
    struct LocationConstraint {
        string[] allowedLocations;
        string[] deniedLocations;
        uint256 radiusMeters;  // For geo-fencing
        string coordinates;    // Latitude,Longitude
    }
    
    struct Policy {
        string policyId;
        string name;
        string description;
        PolicyType policyType;
        PolicyEffect effect;
        address creator;
        uint256 createdAt;
        uint256 priority;      // Higher number = higher priority
        bool isActive;
        
        // Subject conditions (who)
        string[] requiredRoles;
        AttributeCondition[] subjectConditions;
        
        // Resource conditions (what)
        string[] resourceTypes;
        string[] resourceIds;
        AttributeCondition[] resourceConditions;
        
        // Action conditions (how)
        string[] allowedActions;
        
        // Environmental conditions (when/where)
        TimeConstraint timeConstraint;
        LocationConstraint locationConstraint;
        
        // Additional conditions
        uint256 maxUsageCount;
        uint256 currentUsageCount;
        mapping(address => uint256) userUsageCount;
    }
    
    struct PolicySet {
        string setId;
        string name;
        string[] policyIds;
        bool requireAll;  // true = all policies must match, false = any policy matches
        bool isActive;
    }
    
    // Mappings
    mapping(string => Policy) public policies;
    mapping(string => bool) public policyExists;
    mapping(string => PolicySet) public policySets;
    mapping(address => string[]) public userPolicies;
    mapping(string => string[]) public resourcePolicies;
    mapping(string => string) public hiddenPolicies; // Policy ID => Encrypted policy content
    
    // Events
    event PolicyCreated(
        string indexed policyId,
        string name,
        PolicyType policyType,
        address indexed creator,
        uint256 timestamp
    );
    
    event PolicyUpdated(
        string indexed policyId,
        address indexed updater,
        uint256 timestamp
    );
    
    event PolicyEvaluated(
        string indexed policyId,
        address indexed subject,
        string resource,
        string action,
        bool result,
        uint256 timestamp
    );
    
    event PolicySetCreated(
        string indexed setId,
        string name,
        address indexed creator,
        uint256 timestamp
    );
    
    event PolicyHidden(
        string indexed policyId,
        string encryptedContent,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "PolicyManager: Only admin can perform this action");
        _;
    }
    
    modifier policyExists_(string memory policyId) {
        require(policyExists[policyId], "PolicyManager: Policy does not exist");
        _;
    }
    
    modifier onlyPolicyCreator(string memory policyId) {
        require(policies[policyId].creator == msg.sender || msg.sender == admin, 
                "PolicyManager: Only policy creator or admin can modify");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        totalPolicies = 0;
    }
    
    /**
     * @dev Create a new ABAC policy
     */
    function createABACPolicy(
        string memory policyId,
        string memory name,
        string memory description,
        PolicyEffect effect,
        uint256 priority,
        string[] memory requiredRoles,
        string[] memory subjectAttrNames,
        string[] memory subjectAttrValues,
        uint8[] memory subjectAttrOperators,
        string[] memory resourceTypes,
        string[] memory allowedActions
    ) external returns (bool) {
        require(!policyExists[policyId], "PolicyManager: Policy already exists");
        require(bytes(policyId).length > 0, "PolicyManager: Policy ID cannot be empty");
        require(subjectAttrNames.length == subjectAttrValues.length && 
                subjectAttrValues.length == subjectAttrOperators.length, 
                "PolicyManager: Subject attributes mismatch");
        
        Policy storage policy = policies[policyId];
        policy.policyId = policyId;
        policy.name = name;
        policy.description = description;
        policy.policyType = PolicyType.ABAC;
        policy.effect = effect;
        policy.creator = msg.sender;
        policy.createdAt = block.timestamp;
        policy.priority = priority;
        policy.isActive = true;
        policy.requiredRoles = requiredRoles;
        policy.resourceTypes = resourceTypes;
        policy.allowedActions = allowedActions;
        policy.maxUsageCount = 0; // Unlimited by default
        policy.currentUsageCount = 0;
        
        // Set subject conditions
        for (uint256 i = 0; i < subjectAttrNames.length; i++) {
            policy.subjectConditions.push(AttributeCondition({
                attributeName: subjectAttrNames[i],
                expectedValue: subjectAttrValues[i],
                operator: ComparisonOperator(subjectAttrOperators[i])
            }));
        }
        
        policyExists[policyId] = true;
        totalPolicies++;
        
        emit PolicyCreated(policyId, name, PolicyType.ABAC, msg.sender, block.timestamp);
        return true;
    }
    
    /**
     * @dev Create time-based policy
     */
    function createTimeBasedPolicy(
        string memory policyId,
        string memory name,
        PolicyEffect effect,
        uint256 startTime,
        uint256 endTime,
        uint8[] memory allowedDays,
        uint16 startHour,
        uint16 endHour,
        bool isRecurring,
        string[] memory allowedActions
    ) external returns (bool) {
        require(!policyExists[policyId], "PolicyManager: Policy already exists");
        require(startTime < endTime || isRecurring, "PolicyManager: Invalid time range");
        
        Policy storage policy = policies[policyId];
        policy.policyId = policyId;
        policy.name = name;
        policy.policyType = PolicyType.TimeBased;
        policy.effect = effect;
        policy.creator = msg.sender;
        policy.createdAt = block.timestamp;
        policy.priority = 100; // Default priority
        policy.isActive = true;
        policy.allowedActions = allowedActions;
        
        policy.timeConstraint = TimeConstraint({
            startTime: startTime,
            endTime: endTime,
            allowedDays: allowedDays,
            startHour: startHour,
            endHour: endHour,
            isRecurring: isRecurring
        });
        
        policyExists[policyId] = true;
        totalPolicies++;
        
        emit PolicyCreated(policyId, name, PolicyType.TimeBased, msg.sender, block.timestamp);
        return true;
    }
    
    /**
     * @dev Create location-based policy
     */
    function createLocationBasedPolicy(
        string memory policyId,
        string memory name,
        PolicyEffect effect,
        string[] memory allowedLocations,
        string[] memory deniedLocations,
        uint256 radiusMeters,
        string memory coordinates,
        string[] memory allowedActions
    ) external returns (bool) {
        require(!policyExists[policyId], "PolicyManager: Policy already exists");
        
        Policy storage policy = policies[policyId];
        policy.policyId = policyId;
        policy.name = name;
        policy.policyType = PolicyType.LocationBased;
        policy.effect = effect;
        policy.creator = msg.sender;
        policy.createdAt = block.timestamp;
        policy.priority = 100;
        policy.isActive = true;
        policy.allowedActions = allowedActions;
        
        policy.locationConstraint = LocationConstraint({
            allowedLocations: allowedLocations,
            deniedLocations: deniedLocations,
            radiusMeters: radiusMeters,
            coordinates: coordinates
        });
        
        policyExists[policyId] = true;
        totalPolicies++;
        
        emit PolicyCreated(policyId, name, PolicyType.LocationBased, msg.sender, block.timestamp);
        return true;
    }
    
    /**
     * @dev Hide policy content for privacy (DUPH-BAAC inspired)
     */
    function hidePolicyContent(
        string memory policyId,
        string memory encryptedContent
    ) external policyExists_(policyId) onlyPolicyCreator(policyId) {
        hiddenPolicies[policyId] = encryptedContent;
        emit PolicyHidden(policyId, encryptedContent, block.timestamp);
    }
    
    /**
     * @dev Evaluate policy against access request
     */
    function evaluatePolicy(
        address subject,
        string memory resourceId,
        string memory resource,
        string memory action,
        string[] memory subjectAttributes
    ) external returns (bool) {
        // Get all applicable policies for the resource and action
        string[] memory applicablePolicies = _getApplicablePolicies(resource, action);
        
        bool hasAllowPolicy = false;
        bool hasDenyPolicy = false;
        uint256 highestAllowPriority = 0;
        uint256 highestDenyPriority = 0;
        
        for (uint256 i = 0; i < applicablePolicies.length; i++) {
            string memory policyId = applicablePolicies[i];
            Policy storage policy = policies[policyId];
            
            if (!policy.isActive) continue;
            
            bool policyMatches = _evaluateSinglePolicy(policyId, subject, resourceId, action, subjectAttributes);
            
            emit PolicyEvaluated(policyId, subject, resource, action, policyMatches, block.timestamp);
            
            if (policyMatches) {
                if (policy.effect == PolicyEffect.Allow && policy.priority >= highestAllowPriority) {
                    hasAllowPolicy = true;
                    highestAllowPriority = policy.priority;
                } else if (policy.effect == PolicyEffect.Deny && policy.priority >= highestDenyPriority) {
                    hasDenyPolicy = true;
                    highestDenyPriority = policy.priority;
                }
                
                // Update usage count
                policy.currentUsageCount++;
                policy.userUsageCount[subject]++;
            }
        }
        
        // Deny takes precedence if same or higher priority
        if (hasDenyPolicy && highestDenyPriority >= highestAllowPriority) {
            return false;
        }
        
        return hasAllowPolicy;
    }
    
    /**
     * @dev Evaluate single policy
     */
    function _evaluateSinglePolicy(
        string memory policyId,
        address subject,
        string memory resourceId,
        string memory action,
        string[] memory subjectAttributes
    ) internal view returns (bool) {
        Policy storage policy = policies[policyId];
        
        // Check if usage count exceeded
        if (policy.maxUsageCount > 0 && policy.currentUsageCount >= policy.maxUsageCount) {
            return false;
        }
        
        // Check action
        if (!_isActionAllowed(policy.allowedActions, action)) {
            return false;
        }
        
        // Check subject conditions
        if (!_evaluateSubjectConditions(policy, subject, subjectAttributes)) {
            return false;
        }
        
        // Check time constraints
        if (!_evaluateTimeConstraints(policy.timeConstraint)) {
            return false;
        }
        
        // Check location constraints (simplified - would need oracle in real implementation)
        if (!_evaluateLocationConstraints(policy.locationConstraint, "")) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Check if action is allowed by policy
     */
    function _isActionAllowed(string[] memory allowedActions, string memory action) internal pure returns (bool) {
        if (allowedActions.length == 0) return true; // No restrictions
        
        for (uint256 i = 0; i < allowedActions.length; i++) {
            if (keccak256(bytes(allowedActions[i])) == keccak256(bytes(action))) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Evaluate subject conditions
     */
    function _evaluateSubjectConditions(
        Policy storage policy,
        address subject,
        string[] memory subjectAttributes
    ) internal view returns (bool) {
        // Check required roles (simplified - would integrate with role management)
        if (policy.requiredRoles.length > 0) {
            // This would check against a role management system
            // For now, assume roles are passed as attributes
        }
        
        // Check attribute conditions
        for (uint256 i = 0; i < policy.subjectConditions.length; i++) {
            AttributeCondition memory condition = policy.subjectConditions[i];
            
            bool conditionMet = false;
            for (uint256 j = 0; j < subjectAttributes.length; j += 2) {
                if (j + 1 < subjectAttributes.length &&
                    keccak256(bytes(subjectAttributes[j])) == keccak256(bytes(condition.attributeName))) {
                    
                    conditionMet = _evaluateAttributeCondition(
                        condition,
                        subjectAttributes[j + 1]
                    );
                    break;
                }
            }
            
            if (!conditionMet) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Evaluate attribute condition
     */
    function _evaluateAttributeCondition(
        AttributeCondition memory condition,
        string memory actualValue
    ) internal pure returns (bool) {
        if (condition.operator == ComparisonOperator.Equal) {
            return keccak256(bytes(actualValue)) == keccak256(bytes(condition.expectedValue));
        } else if (condition.operator == ComparisonOperator.NotEqual) {
            return keccak256(bytes(actualValue)) != keccak256(bytes(condition.expectedValue));
        } else if (condition.operator == ComparisonOperator.Contains) {
            // Simplified contains check
            return bytes(actualValue).length >= bytes(condition.expectedValue).length;
        }
        
        // For GreaterThan, LessThan, StartsWith - would need more complex string/number parsing
        return true;
    }
    
    /**
     * @dev Evaluate time constraints
     */
    function _evaluateTimeConstraints(TimeConstraint memory constraint) internal view returns (bool) {
        if (constraint.startTime == 0 && constraint.endTime == 0) {
            return true; // No time constraints
        }
        
        uint256 currentTime = block.timestamp;
        
        // Check absolute time range
        if (!constraint.isRecurring) {
            return currentTime >= constraint.startTime && currentTime <= constraint.endTime;
        }
        
        // Check recurring constraints
        uint256 dayOfWeek = ((currentTime / 86400) + 4) % 7; // Thursday = 0 epoch
        bool dayAllowed = false;
        
        for (uint256 i = 0; i < constraint.allowedDays.length; i++) {
            if (constraint.allowedDays[i] == dayOfWeek) {
                dayAllowed = true;
                break;
            }
        }
        
        if (!dayAllowed) {
            return false;
        }
        
        // Check hour range (simplified)
        uint256 currentHour = (currentTime % 86400) / 3600;
        uint16 currentHourMinute = uint16(currentHour * 100); // Simplified HHMM
        
        return currentHourMinute >= constraint.startHour && currentHourMinute <= constraint.endHour;
    }
    
    /**
     * @dev Evaluate location constraints (placeholder)
     */
    function _evaluateLocationConstraints(
        LocationConstraint memory constraint,
        string memory currentLocation
    ) internal pure returns (bool) {
        if (constraint.allowedLocations.length == 0 && constraint.deniedLocations.length == 0) {
            return true; // No location constraints
        }
        
        // Simplified location check - in real implementation would use oracle
        return true;
    }
    
    /**
     * @dev Get applicable policies for resource and action
     */
    function _getApplicablePolicies(
        string memory resource,
        string memory action
    ) internal view returns (string[] memory) {
        // This is a simplified implementation
        // In practice, would use more efficient indexing
        string[] memory applicable = new string[](totalPolicies);
        uint256 count = 0;
        
        // Would iterate through indexed policies
        // For demonstration, returning empty array
        
        // Resize array to actual count
        string[] memory result = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = applicable[i];
        }
        
        return result;
    }
    
    /**
     * @dev Check time constraints for external calls
     */
    function checkTimeConstraints(
        address user,
        string memory action,
        uint256 timestamp
    ) external view returns (bool) {
        // This would check user-specific time policies
        // Simplified implementation
        return true;
    }
    
    /**
     * @dev Update policy status
     */
    function updatePolicyStatus(
        string memory policyId,
        bool isActive
    ) external policyExists_(policyId) onlyPolicyCreator(policyId) {
        policies[policyId].isActive = isActive;
        emit PolicyUpdated(policyId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Set policy usage limit
     */
    function setPolicyUsageLimit(
        string memory policyId,
        uint256 maxUsageCount
    ) external policyExists_(policyId) onlyPolicyCreator(policyId) {
        policies[policyId].maxUsageCount = maxUsageCount;
        emit PolicyUpdated(policyId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Get policy information
     */
    function getPolicyInfo(string memory policyId) external view policyExists_(policyId) returns (
        string memory name,
        PolicyType policyType,
        PolicyEffect effect,
        address creator,
        uint256 createdAt,
        uint256 priority,
        bool isActive
    ) {
        Policy storage policy = policies[policyId];
        return (
            policy.name,
            policy.policyType,
            policy.effect,
            policy.creator,
            policy.createdAt,
            policy.priority,
            policy.isActive
        );
    }
    
    /**
     * @dev Get policy usage statistics
     */
    function getPolicyUsage(string memory policyId) external view policyExists_(policyId) returns (
        uint256 currentUsageCount,
        uint256 maxUsageCount
    ) {
        Policy storage policy = policies[policyId];
        return (policy.currentUsageCount, policy.maxUsageCount);
    }
    
    /**
     * @dev Get total policies count
     */
    function getTotalPolicies() external view returns (uint256) {
        return totalPolicies;
    }
}