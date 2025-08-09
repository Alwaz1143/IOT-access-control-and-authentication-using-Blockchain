// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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
  }
  
  mapping(string => Device) public devices;
  mapping(string => bool) public registeredDevices;
  
  event DeviceRegistered(string indexed deviceId, address indexed owner, string deviceType, uint256 timestamp);
  
  constructor() {
    admin = msg.sender;
  }
  
  modifier onlyAdmin() {
    require(msg.sender == admin, "Only admin can perform this action");
    _;
  }
  
  function registerDevice(string memory deviceId, string memory deviceType, string memory location) public {
    require(!registeredDevices[deviceId], "Device already registered");
    
    devices[deviceId] = Device({
      deviceId: deviceId,
      owner: msg.sender,
      deviceType: deviceType,
      location: location,
      status: DeviceStatus.Active,
      registeredAt: block.timestamp
    });
    
    registeredDevices[deviceId] = true;
    totalDevices++;
    
    emit DeviceRegistered(deviceId, msg.sender, deviceType, block.timestamp);
  }
}