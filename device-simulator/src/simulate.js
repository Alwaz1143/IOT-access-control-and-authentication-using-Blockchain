const IoTDeviceSimulator = require('./index');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

// Configuration for the simulation
const SIMULATION_CONFIG = {
  // Number of devices to simulate for each type
  deviceCounts: {
    smart_lock: 5,
    security_camera: 8,
    access_card_reader: 12,
    environmental_sensor: 6,
    smart_door: 4
  },
  
  // Locations for devices
  locations: [
    'Main Entrance',
    'Security Office',
    'Server Room',
    'Conference Room A',
    'Conference Room B',
    'Break Room',
    'Parking Garage',
    'Loading Dock',
    'Executive Office',
    'IT Department',
    'HR Office',
    'Finance Department',
    'Marketing Office',
    'Engineering Lab',
    'Data Center',
    'Network Room',
    'Storage Room',
    'Kitchen',
    'Reception Area',
    'Meeting Room 1',
    'Meeting Room 2',
    'Training Room',
    'Library',
    'Gym',
    'Cafeteria'
  ],
  
  // Simulation duration (in minutes, 0 for infinite)
  duration: 0,
  
  // Enable/disable features
  features: {
    mqtt: true,
    apiCalls: true,
    randomEvents: true,
    heartbeat: true
  }
};

class IoTSimulationManager {
  constructor() {
    this.devices = [];
    this.isRunning = false;
    this.startTime = null;
    this.stats = {
      totalDevices: 0,
      activeDevices: 0,
      totalEvents: 0,
      totalDataPoints: 0,
      errors: 0
    };
  }

  async start() {
    console.log('🚀 Starting IoT Device Simulation...');
    console.log('=' .repeat(50));
    
    this.startTime = Date.now();
    this.isRunning = true;
    
    // Create and start devices
    await this.createDevices();
    
    // Start monitoring
    this.startMonitoring();
    
    // Set up graceful shutdown
    this.setupGracefulShutdown();
    
    console.log('✅ IoT Simulation started successfully!');
    console.log(`📊 Total devices: ${this.stats.totalDevices}`);
    console.log('Press Ctrl+C to stop the simulation');
  }

  async createDevices() {
    const deviceTypes = Object.keys(SIMULATION_CONFIG.deviceCounts);
    
    for (const deviceType of deviceTypes) {
      const count = SIMULATION_CONFIG.deviceCounts[deviceType];
      
      for (let i = 0; i < count; i++) {
        const deviceId = this.generateDeviceId(deviceType, i + 1);
        const location = this.getRandomLocation();
        
        const device = new IoTDeviceSimulator(deviceId, deviceType, location);
        
        try {
          await device.start();
          this.devices.push(device);
          this.stats.totalDevices++;
          this.stats.activeDevices++;
          
          console.log(`✅ Started ${deviceType} device: ${deviceId} at ${location}`);
          
          // Add small delay between device starts
          await this.sleep(100);
          
        } catch (error) {
          console.error(`❌ Failed to start device ${deviceId}:`, error.message);
          this.stats.errors++;
        }
      }
    }
  }

  generateDeviceId(deviceType, index) {
    const prefix = {
      smart_lock: 'LOCK',
      security_camera: 'CAM',
      access_card_reader: 'CARD',
      environmental_sensor: 'SENSOR',
      smart_door: 'DOOR'
    }[deviceType];
    
    return `${prefix}-${String(index).padStart(3, '0')}-${faker.string.alphanumeric(6).toUpperCase()}`;
  }

  getRandomLocation() {
    return faker.helpers.arrayElement(SIMULATION_CONFIG.locations);
  }

  startMonitoring() {
    // Update stats every 30 seconds
    setInterval(() => {
      this.updateStats();
      this.displayStats();
    }, 30000);
    
    // Check device health every minute
    setInterval(() => {
      this.checkDeviceHealth();
    }, 60000);
  }

  updateStats() {
    this.stats.activeDevices = this.devices.filter(d => d.isRunning).length;
    
    // Count total events and data points
    this.stats.totalEvents = this.devices.reduce((sum, device) => {
      return sum + (device.securityEvents?.length || 0) + (device.accessAttempts?.length || 0);
    }, 0);
    
    this.stats.totalDataPoints = this.devices.length * 2; // Rough estimate
  }

  displayStats() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    
    console.log('\n📊 Simulation Statistics:');
    console.log('=' .repeat(40));
    console.log(`⏱️  Uptime: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`📱 Total Devices: ${this.stats.totalDevices}`);
    console.log(`🟢 Active Devices: ${this.stats.activeDevices}`);
    console.log(`📈 Total Events: ${this.stats.totalEvents}`);
    console.log(`📊 Data Points: ${this.stats.totalDataPoints}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    
    // Device type breakdown
    const deviceBreakdown = {};
    this.devices.forEach(device => {
      deviceBreakdown[device.deviceType] = (deviceBreakdown[device.deviceType] || 0) + 1;
    });
    
    console.log('\n📋 Device Breakdown:');
    Object.entries(deviceBreakdown).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} devices`);
    });
    
    console.log('=' .repeat(40));
  }

  checkDeviceHealth() {
    const offlineDevices = this.devices.filter(device => !device.isRunning);
    
    if (offlineDevices.length > 0) {
      console.log(`⚠️  Found ${offlineDevices.length} offline devices`);
      
      // Try to restart offline devices
      offlineDevices.forEach(async (device) => {
        try {
          console.log(`🔄 Attempting to restart device ${device.deviceId}`);
          await device.start();
        } catch (error) {
          console.error(`❌ Failed to restart device ${device.deviceId}:`, error.message);
        }
      });
    }
  }

  setupGracefulShutdown() {
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down IoT simulation...');
      await this.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down...');
      await this.stop();
      process.exit(0);
    });
  }

  async stop() {
    console.log('🛑 Stopping all devices...');
    
    const stopPromises = this.devices.map(async (device) => {
      try {
        device.stop();
      } catch (error) {
        console.error(`Error stopping device ${device.deviceId}:`, error.message);
      }
    });
    
    await Promise.all(stopPromises);
    
    this.isRunning = false;
    this.displayFinalStats();
    
    console.log('✅ IoT simulation stopped successfully');
  }

  displayFinalStats() {
    const totalUptime = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(totalUptime / 3600);
    const minutes = Math.floor((totalUptime % 3600) / 60);
    
    console.log('\n📊 Final Statistics:');
    console.log('=' .repeat(40));
    console.log(`⏱️  Total Uptime: ${hours}h ${minutes}m`);
    console.log(`📱 Devices Simulated: ${this.stats.totalDevices}`);
    console.log(`📈 Total Events Generated: ${this.stats.totalEvents}`);
    console.log(`📊 Data Points Sent: ${this.stats.totalDataPoints}`);
    console.log(`❌ Total Errors: ${this.stats.errors}`);
    console.log('=' .repeat(40));
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the simulation
async function main() {
  const simulation = new IoTSimulationManager();
  
  try {
    await simulation.start();
  } catch (error) {
    console.error('❌ Failed to start simulation:', error);
    process.exit(1);
  }
}

// Run the simulation
if (require.main === module) {
  main();
}

module.exports = IoTSimulationManager; 