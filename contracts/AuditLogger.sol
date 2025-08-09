// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AuditLogger {
  address public admin;
  uint256 public totalLogs;
  
  struct AuditLog {
    uint256 logId;
    string eventType;
    address actor;
    string subject;
    string resource;
    string action;
    uint256 timestamp;
  }
  
  mapping(uint256 => AuditLog) public auditLogs;
  
  event LogCreated(uint256 indexed logId, string eventType, address actor, uint256 timestamp);
  
  constructor() {
    admin = msg.sender;
  }
  
  modifier onlyAdmin() {
    require(msg.sender == admin, "Only admin can perform this action");
    _;
  }
  
  function logEvent(string memory eventType, string memory subject, string memory resource, string memory action) public {
    totalLogs++;
    
    auditLogs[totalLogs] = AuditLog({
      logId: totalLogs,
      eventType: eventType,
      actor: msg.sender,
      subject: subject,
      resource: resource,
      action: action,
      timestamp: block.timestamp
    });
    
    emit LogCreated(totalLogs, eventType, msg.sender, block.timestamp);
  }
}