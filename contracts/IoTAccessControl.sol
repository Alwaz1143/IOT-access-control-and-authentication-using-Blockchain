// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract IoTAccessControl {
  address public admin;
  uint256 public totalAccessRequests;
  
  struct AccessRequest {
    uint256 requestId;
    address requester;
    string deviceId;
    string resource;
    string action;
    uint256 timestamp;
    bool isApproved;
  }
  
  mapping(uint256 => AccessRequest) public accessRequests;
  
  event AccessRequested(uint256 indexed requestId, address indexed requester, string deviceId, string resource, string action, uint256 timestamp);
  
  constructor() {
    admin = msg.sender;
  }
  
  modifier onlyAdmin() {
    require(msg.sender == admin, "Only admin can perform this action");
    _;
  }
  
  function requestAccess(string memory deviceId, string memory resource, string memory action) public {
    totalAccessRequests++;
    
    accessRequests[totalAccessRequests] = AccessRequest({
      requestId: totalAccessRequests,
      requester: msg.sender,
      deviceId: deviceId,
      resource: resource,
      action: action,
      timestamp: block.timestamp,
      isApproved: false
    });
    
    emit AccessRequested(totalAccessRequests, msg.sender, deviceId, resource, action, block.timestamp);
  }
}