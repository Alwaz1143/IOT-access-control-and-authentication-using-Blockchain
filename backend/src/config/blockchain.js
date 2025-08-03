const { Web3 } = require('web3');
const { ethers } = require('ethers');
const logger = require('../utils/logger');

let web3 = null;
let provider = null;
let contracts = {};

const setupWeb3 = async () => {
  try {
    const networkUrl = process.env.BLOCKCHAIN_URL || 'http://localhost:8545';
    
    // Setup Web3
    provider = new Web3.providers.HttpProvider(networkUrl);
    web3 = new Web3(provider);
    
    // Test connection
    const accounts = await web3.eth.getAccounts();
    const networkId = await web3.eth.net.getId();
    
    logger.info(`Web3 connected to network ID: ${networkId}`);
    logger.info(`Available accounts: ${accounts.length}`);
    
    // Setup contract addresses (these would be loaded from deployment)
    const contractAddresses = {
      deviceRegistry: process.env.DEVICE_REGISTRY_ADDRESS,
      policyManager: process.env.POLICY_MANAGER_ADDRESS,
      auditLogger: process.env.AUDIT_LOGGER_ADDRESS,
      iotAccessControl: process.env.IOT_ACCESS_CONTROL_ADDRESS
    };
    
    // Load contract ABIs (with fallback for missing contracts)
    const contractABIs = {};
    const contractNames = ['deviceRegistry', 'policyManager', 'auditLogger', 'iotAccessControl'];
    
    for (const contractName of contractNames) {
      try {
        const contractPath = `../../contracts/build/contracts/${contractName.charAt(0).toUpperCase() + contractName.slice(1)}.json`;
        const contractData = require(contractPath);
        contractABIs[contractName] = contractData.abi;
        logger.info(`${contractName} ABI loaded successfully`);
      } catch (error) {
        logger.warn(`${contractName} ABI not found, using mock contract`);
        // Create a mock contract for development
        contractABIs[contractName] = [
          {
            "inputs": [],
            "name": "mockMethod",
            "outputs": [{"type": "string"}],
            "stateMutability": "view",
            "type": "function"
          }
        ];
      }
    }
    
    // Initialize contract instances
    Object.keys(contractAddresses).forEach(contractName => {
      if (contractAddresses[contractName]) {
        contracts[contractName] = new web3.eth.Contract(
          contractABIs[contractName],
          contractAddresses[contractName]
        );
        logger.info(`${contractName} contract initialized at ${contractAddresses[contractName]}`);
      } else {
        logger.warn(`${contractName} contract address not provided, using mock contract`);
        // Create a mock contract instance
        contracts[contractName] = {
          methods: {
            registerDevice: () => ({
              estimateGas: () => Promise.resolve(21000),
              send: () => Promise.resolve({ transactionHash: 'mock-tx-hash' }),
              call: () => Promise.resolve('success')
            }),
            createPolicy: () => ({
              estimateGas: () => Promise.resolve(21000),
              send: () => Promise.resolve({ transactionHash: 'mock-tx-hash' }),
              call: () => Promise.resolve('success')
            }),
            logEvent: () => ({
              estimateGas: () => Promise.resolve(21000),
              send: () => Promise.resolve({ transactionHash: 'mock-tx-hash' }),
              call: () => Promise.resolve('success')
            }),
            checkAccess: () => ({
              estimateGas: () => Promise.resolve(21000),
              send: () => Promise.resolve({ transactionHash: 'mock-tx-hash' }),
              call: () => Promise.resolve(true)
            })
          }
        };
      }
    });
    
    // Setup ethers provider for advanced features
    const ethersProvider = new ethers.JsonRpcProvider(networkUrl);
    
    return {
      web3,
      provider: ethersProvider,
      contracts,
      accounts
    };
    
  } catch (error) {
    logger.error('Web3 setup failed:', error);
    // Don't throw error, allow the app to start without blockchain
    logger.warn('Continuing without blockchain functionality');
    return {
      web3: null,
      provider: null,
      contracts: {},
      accounts: []
    };
  }
};

const getWeb3 = () => {
  if (!web3) {
    throw new Error('Web3 not initialized. Call setupWeb3() first.');
  }
  return web3;
};

const getContracts = () => {
  return contracts;
};

const getContract = (contractName) => {
  if (!contracts[contractName]) {
    throw new Error(`Contract ${contractName} not found. Check if it's deployed.`);
  }
  return contracts[contractName];
};

const getAccounts = async () => {
  if (!web3) {
    throw new Error('Web3 not initialized');
  }
  return await web3.eth.getAccounts();
};

const getDefaultAccount = async () => {
  const accounts = await getAccounts();
  return accounts[0];
};

// Helper function to send transactions
const sendTransaction = async (contract, method, params = [], options = {}) => {
  try {
    const account = await getDefaultAccount();
    const gasEstimate = await contract.methods[method](...params).estimateGas({ from: account });
    
    const transaction = {
      from: account,
      gas: Math.floor(gasEstimate * 1.2), // Add 20% buffer
      ...options
    };
    
    const result = await contract.methods[method](...params).send(transaction);
    logger.info(`Transaction successful: ${result.transactionHash}`);
    return result;
    
  } catch (error) {
    logger.error(`Transaction failed for method ${method}:`, error);
    throw error;
  }
};

// Helper function to call view methods
const callMethod = async (contract, method, params = []) => {
  try {
    const result = await contract.methods[method](...params).call();
    return result;
  } catch (error) {
    logger.error(`Call failed for method ${method}:`, error);
    throw error;
  }
};

module.exports = {
  setupWeb3,
  getWeb3,
  getContracts,
  getContract,
  getAccounts,
  getDefaultAccount,
  sendTransaction,
  callMethod
}; 