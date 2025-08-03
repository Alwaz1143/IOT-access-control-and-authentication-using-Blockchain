const DeviceRegistry = artifacts.require("DeviceRegistry");
const PolicyManager = artifacts.require("PolicyManager");
const AuditLogger = artifacts.require("AuditLogger");
const IoTAccessControl = artifacts.require("IoTAccessControl");

module.exports = async function(deployer, network, accounts) {
  console.log("Deploying IoT Access Control System contracts...");
  
  // Deploy core contracts first
  await deployer.deploy(DeviceRegistry);
  const deviceRegistry = await DeviceRegistry.deployed();
  console.log("DeviceRegistry deployed at:", deviceRegistry.address);
  
  await deployer.deploy(PolicyManager);
  const policyManager = await PolicyManager.deployed();
  console.log("PolicyManager deployed at:", policyManager.address);
  
  await deployer.deploy(AuditLogger);
  const auditLogger = await AuditLogger.deployed();
  console.log("AuditLogger deployed at:", auditLogger.address);
  
  // Deploy main access control contract with dependencies
  await deployer.deploy(
    IoTAccessControl,
    deviceRegistry.address,
    policyManager.address,
    auditLogger.address
  );
  const iotAccessControl = await IoTAccessControl.deployed();
  console.log("IoTAccessControl deployed at:", iotAccessControl.address);
  
  console.log("All contracts deployed successfully!");
  console.log("Contract addresses:");
  console.log("- DeviceRegistry:", deviceRegistry.address);
  console.log("- PolicyManager:", policyManager.address);
  console.log("- AuditLogger:", auditLogger.address);
  console.log("- IoTAccessControl:", iotAccessControl.address);
}; 