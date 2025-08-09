// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PolicyManager {
  address public admin;
  uint256 public totalPolicies;
  
  struct Policy {
    string policyId;
    string name;
    string description;
    address creator;
    uint256 createdAt;
    bool isActive;
  }
  
  mapping(string => Policy) public policies;
  mapping(string => bool) public policyExists;
  
  event PolicyCreated(string indexed policyId, string name, address indexed creator, uint256 timestamp);
  
  constructor() {
    admin = msg.sender;
  }
  
  modifier onlyAdmin() {
    require(msg.sender == admin, "Only admin can perform this action");
    _;
  }
  
  function createPolicy(string memory policyId, string memory name, string memory description) public {
    require(!policyExists[policyId], "Policy already exists");
    
    policies[policyId] = Policy({
      policyId: policyId,
      name: name,
      description: description,
      creator: msg.sender,
      createdAt: block.timestamp,
      isActive: true
    });
    
    policyExists[policyId] = true;
    totalPolicies++;
    
    emit PolicyCreated(policyId, name, msg.sender, block.timestamp);
  }
}