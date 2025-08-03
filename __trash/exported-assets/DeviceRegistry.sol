// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DeviceRegistry
 * @dev Enhanced device registration and management with attributes
 * Supports device lifecycle, attributes, and hierarchical device management
 */
contract DeviceRegistry {
    
    address public admin;
    uint256 public totalDevices;
    
    enum DeviceStatus { Inactive, Active, Maintenance, Compromised, Decommissioned }
    
    struct Device {
        string deviceId;
        address owner;
        string deviceType;
        string location;
        DeviceStatus status;
        uint256 registeredAt;
        uint256 lastActive;
        string firmwareVersion;
        string publicKey;
        mapping(string => string) attributes;
        string[] attributeKeys;
        string[] capabilities;
        address[] authorizedUsers;
    }
    
    struct DeviceGroup {
        string groupId;
        string groupName;
        address groupAdmin;
        string[] deviceIds;
        mapping(string => string) groupPolicies;
        bool isActive;
    }
    
    // Mappings
    mapping(string => Device) public devices;
    mapping(string => bool) public registeredDevices;
    mapping(address => string[]) public userDevices;
    mapping(string => DeviceGroup) public deviceGroups;
    mapping(string => string) public deviceToGroup;
    
    // Events
    event DeviceRegistered(
        string indexed deviceId,
        address indexed owner,
        string deviceType,
        uint256 timestamp
    );
    
    event DeviceStatusChanged(
        string indexed deviceId,
        DeviceStatus oldStatus,
        DeviceStatus newStatus,
        uint256 timestamp
    );
    
    event DeviceAttributeUpdated(
        string indexed deviceId,
        string attribute,
        string value,
        uint256 timestamp
    );
    
    event DeviceGroupCreated(
        string indexed groupId,
        string groupName,
        address indexed groupAdmin,
        uint256 timestamp
    );
    
    event DeviceAddedToGroup(
        string indexed deviceId,
        string indexed groupId,
        uint256 timestamp
    );
    
    event UnauthorizedDeviceAccess(
        string indexed deviceId,
        address indexed attacker,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "DeviceRegistry: Only admin can perform this action");
        _;
    }
    
    modifier onlyDeviceOwner(string memory deviceId) {
        require(devices[deviceId].owner == msg.sender, "DeviceRegistry: Only device owner can perform this action");
        _;
    }
    
    modifier deviceExists(string memory deviceId) {
        require(registeredDevices[deviceId], "DeviceRegistry: Device does not exist");
        _;
    }
    
    modifier deviceActive(string memory deviceId) {
        require(devices[deviceId].status == DeviceStatus.Active, "DeviceRegistry: Device is not active");
        _;
    }
    
    constructor() {
        admin = msg.sender;
        totalDevices = 0;
    }
    
    /**
     * @dev Register a new IoT device with comprehensive metadata
     */
    function registerDevice(
        string memory deviceId,
        string memory deviceType,
        string memory location,
        string memory firmwareVersion,
        string memory publicKey,
        string[] memory attributeKeys,
        string[] memory attributeValues,
        string[] memory capabilities
    ) external returns (bool) {
        require(!registeredDevices[deviceId], "DeviceRegistry: Device already registered");
        require(bytes(deviceId).length > 0, "DeviceRegistry: Device ID cannot be empty");
        require(attributeKeys.length == attributeValues.length, "DeviceRegistry: Attributes mismatch");
        
        Device storage device = devices[deviceId];
        device.deviceId = deviceId;
        device.owner = msg.sender;
        device.deviceType = deviceType;
        device.location = location;
        device.status = DeviceStatus.Active;
        device.registeredAt = block.timestamp;
        device.lastActive = block.timestamp;
        device.firmwareVersion = firmwareVersion;
        device.publicKey = publicKey;
        device.attributeKeys = attributeKeys;
        device.capabilities = capabilities;
        
        // Store attributes
        for (uint256 i = 0; i < attributeKeys.length; i++) {
            device.attributes[attributeKeys[i]] = attributeValues[i];
        }
        
        // Add initial owner as authorized user
        device.authorizedUsers.push(msg.sender);
        
        registeredDevices[deviceId] = true;
        userDevices[msg.sender].push(deviceId);
        totalDevices++;
        
        emit DeviceRegistered(deviceId, msg.sender, deviceType, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Update device status
     */
    function updateDeviceStatus(
        string memory deviceId,
        DeviceStatus newStatus
    ) external deviceExists(deviceId) onlyDeviceOwner(deviceId) {
        DeviceStatus oldStatus = devices[deviceId].status;
        devices[deviceId].status = newStatus;
        
        emit DeviceStatusChanged(deviceId, oldStatus, newStatus, block.timestamp);
    }
    
    /**
     * @dev Update device attributes dynamically
     */
    function updateDeviceAttribute(
        string memory deviceId,
        string memory attributeKey,
        string memory attributeValue
    ) external deviceExists(deviceId) onlyDeviceOwner(deviceId) {
        devices[deviceId].attributes[attributeKey] = attributeValue;
        
        // Add to attribute keys if new
        bool keyExists = false;
        for (uint256 i = 0; i < devices[deviceId].attributeKeys.length; i++) {
            if (keccak256(bytes(devices[deviceId].attributeKeys[i])) == keccak256(bytes(attributeKey))) {
                keyExists = true;
                break;
            }
        }
        
        if (!keyExists) {
            devices[deviceId].attributeKeys.push(attributeKey);
        }
        
        emit DeviceAttributeUpdated(deviceId, attributeKey, attributeValue, block.timestamp);
    }
    
    /**
     * @dev Add authorized user to device
     */
    function addAuthorizedUser(
        string memory deviceId,
        address user
    ) external deviceExists(deviceId) onlyDeviceOwner(deviceId) {
        devices[deviceId].authorizedUsers.push(user);
    }
    
    /**
     * @dev Remove authorized user from device
     */
    function removeAuthorizedUser(
        string memory deviceId,
        address user
    ) external deviceExists(deviceId) onlyDeviceOwner(deviceId) {
        address[] storage authorizedUsers = devices[deviceId].authorizedUsers;
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            if (authorizedUsers[i] == user) {
                authorizedUsers[i] = authorizedUsers[authorizedUsers.length - 1];
                authorizedUsers.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Create device group for policy management
     */
    function createDeviceGroup(
        string memory groupId,
        string memory groupName,
        string[] memory deviceIds
    ) external {
        require(!deviceGroups[groupId].isActive, "DeviceRegistry: Group already exists");
        require(bytes(groupId).length > 0, "DeviceRegistry: Group ID cannot be empty");
        
        DeviceGroup storage group = deviceGroups[groupId];
        group.groupId = groupId;
        group.groupName = groupName;
        group.groupAdmin = msg.sender;
        group.deviceIds = deviceIds;
        group.isActive = true;
        
        // Add devices to group mapping
        for (uint256 i = 0; i < deviceIds.length; i++) {
            require(registeredDevices[deviceIds[i]], "DeviceRegistry: Device not registered");
            deviceToGroup[deviceIds[i]] = groupId;
            emit DeviceAddedToGroup(deviceIds[i], groupId, block.timestamp);
        }
        
        emit DeviceGroupCreated(groupId, groupName, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Add device to existing group
     */
    function addDeviceToGroup(
        string memory deviceId,
        string memory groupId
    ) external deviceExists(deviceId) {
        require(deviceGroups[groupId].isActive, "DeviceRegistry: Group does not exist");
        require(
            msg.sender == deviceGroups[groupId].groupAdmin || msg.sender == devices[deviceId].owner,
            "DeviceRegistry: Unauthorized group modification"
        );
        
        deviceGroups[groupId].deviceIds.push(deviceId);
        deviceToGroup[deviceId] = groupId;
        
        emit DeviceAddedToGroup(deviceId, groupId, block.timestamp);
    }
    
    /**
     * @dev Update device's last active timestamp
     */
    function updateLastActive(string memory deviceId) external deviceExists(deviceId) {
        // Only device owner or the device itself can update
        require(
            msg.sender == devices[deviceId].owner || _isAuthorizedUser(deviceId, msg.sender),
            "DeviceRegistry: Unauthorized access"
        );
        
        devices[deviceId].lastActive = block.timestamp;
    }
    
    /**
     * @dev Check if device is registered
     */
    function isDeviceRegistered(string memory deviceId) external view returns (bool) {
        return registeredDevices[deviceId];
    }
    
    /**
     * @dev Check if device is active
     */
    function isDeviceActive(string memory deviceId) external view returns (bool) {
        return registeredDevices[deviceId] && devices[deviceId].status == DeviceStatus.Active;
    }
    
    /**
     * @dev Check if user has permission for device
     */
    function hasDevicePermission(
        address user,
        string memory deviceId,
        string memory action
    ) external view returns (bool) {
        if (!registeredDevices[deviceId]) {
            return false;
        }
        
        // Device owner has all permissions
        if (devices[deviceId].owner == user) {
            return true;
        }
        
        // Check if user is authorized
        return _isAuthorizedUser(deviceId, user);
    }
    
    /**
     * @dev Get device information
     */
    function getDeviceInfo(string memory deviceId) external view deviceExists(deviceId) returns (
        address owner,
        string memory deviceType,
        string memory location,
        DeviceStatus status,
        uint256 registeredAt,
        uint256 lastActive,
        string memory firmwareVersion
    ) {
        Device storage device = devices[deviceId];
        return (
            device.owner,
            device.deviceType,
            device.location,
            device.status,
            device.registeredAt,
            device.lastActive,
            device.firmwareVersion
        );
    }
    
    /**
     * @dev Get device attributes
     */
    function getDeviceAttributes(string memory deviceId) external view deviceExists(deviceId) returns (
        string[] memory attributeKeys,
        string[] memory attributeValues
    ) {
        Device storage device = devices[deviceId];
        attributeKeys = device.attributeKeys;
        attributeValues = new string[](attributeKeys.length);
        
        for (uint256 i = 0; i < attributeKeys.length; i++) {
            attributeValues[i] = device.attributes[attributeKeys[i]];
        }
    }
    
    /**
     * @dev Get device capabilities
     */
    function getDeviceCapabilities(string memory deviceId) external view deviceExists(deviceId) returns (string[] memory) {
        return devices[deviceId].capabilities;
    }
    
    /**
     * @dev Get devices owned by user
     */
    function getUserDevices(address user) external view returns (string[] memory) {
        return userDevices[user];
    }
    
    /**
     * @dev Get devices in a group
     */
    function getGroupDevices(string memory groupId) external view returns (string[] memory) {
        require(deviceGroups[groupId].isActive, "DeviceRegistry: Group does not exist");
        return deviceGroups[groupId].deviceIds;
    }
    
    /**
     * @dev Internal function to check if user is authorized for device
     */
    function _isAuthorizedUser(string memory deviceId, address user) internal view returns (bool) {
        address[] memory authorizedUsers = devices[deviceId].authorizedUsers;
        for (uint256 i = 0; i < authorizedUsers.length; i++) {
            if (authorizedUsers[i] == user) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Decommission device (admin only)
     */
    function decommissionDevice(string memory deviceId) external onlyAdmin deviceExists(deviceId) {
        devices[deviceId].status = DeviceStatus.Decommissioned;
        emit DeviceStatusChanged(deviceId, DeviceStatus.Active, DeviceStatus.Decommissioned, block.timestamp);
    }
    
    /**
     * @dev Get total device count
     */
    function getTotalDevices() external view returns (uint256) {
        return totalDevices;
    }
    
    /**
     * @dev Get device count by status
     */
    function getDeviceCountByStatus(DeviceStatus status) external view returns (uint256) {
        // This would require iterating through all devices or maintaining separate counters
        // For demonstration purposes, returning 0
        return 0;
    }
}