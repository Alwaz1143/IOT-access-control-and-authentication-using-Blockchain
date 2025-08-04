const mqtt = require('mqtt');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

// Device types and their characteristics
const DEVICE_TYPES = {
  'smart_lock': {
    capabilities: ['lock', 'unlock', 'status_check'],
    dataInterval: 30, // seconds
    mqttTopics: ['iot/devices/{deviceId}/status', 'iot/devices/{deviceId}/access'],
    attributes: ['location', 'battery_level', 'lock_status', 'last_access']
  },
  'security_camera': {
    capabilities: ['record', 'motion_detection', 'face_recognition'],
    dataInterval: 10, // seconds
    mqttTopics: ['iot/devices/{deviceId}/motion', 'iot/devices/{deviceId}/faces'],
    attributes: ['location', 'recording_status', 'motion_detected', 'faces_detected']
  },
  'access_card_reader': {
    capabilities: ['read_card', 'validate_access', 'log_entry'],
    dataInterval: 5, // seconds
    mqttTopics: ['iot/devices/{deviceId}/card_read', 'iot/devices/{deviceId}/access_attempt'],
    attributes: ['location', 'card_read_count', 'access_granted', 'last_card_id']
  },
  'environmental_sensor': {
    capabilities: ['temperature', 'humidity', 'air_quality'],
    dataInterval: 60, // seconds
    mqttTopics: ['iot/devices/{deviceId}/environmental'],
    attributes: ['location', 'temperature', 'humidity', 'air_quality', 'battery_level']
  },
  'smart_door': {
    capabilities: ['open', 'close', 'status_check', 'motion_detection'],
    dataInterval: 15, // seconds
    mqttTopics: ['iot/devices/{deviceId}/door_status', 'iot/devices/{deviceId}/motion'],
    attributes: ['location', 'door_status', 'motion_detected', 'last_opened', 'battery_level']
  }
};

class IoTDeviceSimulator {
  constructor(deviceId, deviceType, location) {
    this.deviceId = deviceId;
    this.deviceType = deviceType;
    this.location = location;
    this.config = DEVICE_TYPES[deviceType];
    this.isRunning = false;
    this.mqttClient = null;
    this.apiBaseUrl = process.env.API_URL || 'http://localhost:8000';
    this.mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
    
    // Device state
    this.state = this.initializeState();
    this.lastHeartbeat = Date.now();
    this.accessAttempts = [];
    this.securityEvents = [];
    
    console.log(`🚀 Initialized ${deviceType} device: ${deviceId} at ${location}`);
  }

  initializeState() {
    const baseState = {
      deviceId: this.deviceId,
      deviceType: this.deviceType,
      location: this.location,
      status: 'online',
      batteryLevel: faker.number.int({ min: 20, max: 100 }),
      lastUpdate: new Date().toISOString(),
      firmwareVersion: '1.2.3'
    };

    // Add device-specific state
    switch (this.deviceType) {
      case 'smart_lock':
        return {
          ...baseState,
          lockStatus: 'locked',
          lastAccess: null,
          accessCount: 0
        };
      
      case 'security_camera':
        return {
          ...baseState,
          recordingStatus: 'standby',
          motionDetected: false,
          facesDetected: [],
          recordingQuality: '1080p'
        };
      
      case 'access_card_reader':
        return {
          ...baseState,
          cardReadCount: 0,
          lastCardId: null,
          accessGranted: 0,
          accessDenied: 0
        };
      
      case 'environmental_sensor':
        return {
          ...baseState,
          temperature: faker.number.float({ min: 18, max: 25, precision: 0.1 }),
          humidity: faker.number.float({ min: 40, max: 70, precision: 0.1 }),
          airQuality: faker.number.int({ min: 0, max: 500 })
        };
      
      case 'smart_door':
        return {
          ...baseState,
          doorStatus: 'closed',
          motionDetected: false,
          lastOpened: null,
          openCount: 0
        };
      
      default:
        return baseState;
    }
  }

  async start() {
    try {
      // Connect to MQTT broker
      await this.connectMQTT();
      
      // Register device with backend
      await this.registerDevice();
      
      // Start device simulation
      this.isRunning = true;
      
      // Schedule regular data updates
      cron.schedule(`*/${this.config.dataInterval} * * * * *`, () => {
        this.sendDeviceData();
      });
      
      // Schedule heartbeat
      cron.schedule('*/30 * * * * *', () => {
        this.sendHeartbeat();
      });
      
      // Schedule random events
      cron.schedule('*/2 * * * *', () => {
        this.generateRandomEvent();
      });
      
      console.log(`✅ ${this.deviceType} device ${this.deviceId} started successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to start device ${this.deviceId}:`, error.message);
    }
  }

  async connectMQTT() {
    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(this.mqttUrl, {
        clientId: `iot_device_${this.deviceId}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
      });

      this.mqttClient.on('connect', () => {
        console.log(`📡 MQTT connected for device ${this.deviceId}`);
        
        // Subscribe to device-specific topics
        this.config.mqttTopics.forEach(topic => {
          const deviceTopic = topic.replace('{deviceId}', this.deviceId);
          this.mqttClient.subscribe(deviceTopic);
        });
        
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        console.error(`MQTT error for device ${this.deviceId}:`, error);
        reject(error);
      });

      this.mqttClient.on('message', (topic, message) => {
        this.handleMQTTMessage(topic, message);
      });
    });
  }

  async registerDevice() {
    try {
      const deviceData = {
        deviceId: this.deviceId,
        deviceType: this.deviceType,
        location: this.location,
        firmwareVersion: this.state.firmwareVersion,
        capabilities: this.config.capabilities,
        attributes: this.state
      };

      const response = await axios.post(`${this.apiBaseUrl}/api/devices/register`, deviceData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEVICE_API_KEY || 'demo-device-key'}`
        }
      });

      console.log(`📝 Device ${this.deviceId} registered successfully`);
      return response.data;
    } catch (error) {
      console.warn(`⚠️ Device registration failed for ${this.deviceId}:`, error.message);
      // Continue without registration for demo purposes
    }
  }

  sendDeviceData() {
    if (!this.isRunning) return;

    // Update device state based on type
    this.updateDeviceState();
    
    // Publish to MQTT
    const topic = `iot/devices/${this.deviceId}/data`;
    const payload = {
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
      data: this.state,
      type: 'device_data'
    };

    this.publishMQTT(topic, payload);
    
    // Send to backend API
    this.sendToBackend('/api/devices/data', payload);
  }

  updateDeviceState() {
    this.state.lastUpdate = new Date().toISOString();
    
    // Simulate battery drain
    if (Math.random() < 0.1) {
      this.state.batteryLevel = Math.max(0, this.state.batteryLevel - 1);
    }
    
    // Device-specific state updates
    switch (this.deviceType) {
      case 'smart_lock':
        // Simulate occasional access attempts
        if (Math.random() < 0.3) {
          this.simulateAccessAttempt();
        }
        break;
      
      case 'security_camera':
        // Simulate motion detection
        if (Math.random() < 0.2) {
          this.state.motionDetected = true;
          this.state.facesDetected = [faker.person.firstName(), faker.person.firstName()];
        } else {
          this.state.motionDetected = false;
          this.state.facesDetected = [];
        }
        break;
      
      case 'access_card_reader':
        // Simulate card reads
        if (Math.random() < 0.4) {
          this.simulateCardRead();
        }
        break;
      
      case 'environmental_sensor':
        // Simulate environmental changes
        this.state.temperature += (Math.random() - 0.5) * 2;
        this.state.humidity += (Math.random() - 0.5) * 5;
        this.state.airQuality += (Math.random() - 0.5) * 20;
        
        // Keep values in reasonable ranges
        this.state.temperature = Math.max(15, Math.min(30, this.state.temperature));
        this.state.humidity = Math.max(30, Math.min(80, this.state.humidity));
        this.state.airQuality = Math.max(0, Math.min(500, this.state.airQuality));
        break;
      
      case 'smart_door':
        // Simulate door events
        if (Math.random() < 0.1) {
          this.state.doorStatus = this.state.doorStatus === 'closed' ? 'open' : 'closed';
          if (this.state.doorStatus === 'open') {
            this.state.lastOpened = new Date().toISOString();
            this.state.openCount++;
          }
        }
        break;
    }
  }

  simulateAccessAttempt() {
    const accessAttempt = {
      timestamp: new Date().toISOString(),
      userId: faker.string.alphanumeric(10),
      method: faker.helpers.arrayElement(['card', 'pin', 'biometric']),
      granted: Math.random() > 0.2, // 80% success rate
      location: this.location
    };

    this.accessAttempts.push(accessAttempt);
    
    // Publish access event
    const topic = `iot/devices/${this.deviceId}/access`;
    this.publishMQTT(topic, {
      deviceId: this.deviceId,
      event: 'access_attempt',
      data: accessAttempt
    });

    // Update state
    if (accessAttempt.granted) {
      this.state.accessCount++;
      this.state.lastAccess = accessAttempt.timestamp;
    }
  }

  simulateCardRead() {
    const cardId = faker.string.alphanumeric(16);
    const granted = Math.random() > 0.15; // 85% success rate
    
    this.state.cardReadCount++;
    this.state.lastCardId = cardId;
    
    if (granted) {
      this.state.accessGranted++;
    } else {
      this.state.accessDenied++;
    }
    
    // Publish card read event
    const topic = `iot/devices/${this.deviceId}/card_read`;
    this.publishMQTT(topic, {
      deviceId: this.deviceId,
      event: 'card_read',
      data: {
        cardId,
        granted,
        timestamp: new Date().toISOString()
      }
    });
  }

  generateRandomEvent() {
    if (!this.isRunning) return;

    const events = [
      'security_alert',
      'maintenance_required',
      'battery_low',
      'connection_lost',
      'firmware_update'
    ];

    const event = faker.helpers.arrayElement(events);
    
    const eventData = {
      deviceId: this.deviceId,
      eventType: event,
      timestamp: new Date().toISOString(),
      severity: faker.helpers.arrayElement(['low', 'medium', 'high']),
      description: this.getEventDescription(event)
    };

    this.securityEvents.push(eventData);
    
    // Publish security event
    const topic = `iot/devices/${this.deviceId}/alerts`;
    this.publishMQTT(topic, eventData);
    
    // Send to backend
    this.sendToBackend('/api/audit/incidents', eventData);
  }

  getEventDescription(event) {
    const descriptions = {
      'security_alert': 'Unauthorized access attempt detected',
      'maintenance_required': 'Device requires scheduled maintenance',
      'battery_low': 'Battery level below 20%',
      'connection_lost': 'Network connection temporarily lost',
      'firmware_update': 'Firmware update available'
    };
    return descriptions[event] || 'Unknown event';
  }

  sendHeartbeat() {
    if (!this.isRunning) return;

    const heartbeat = {
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
      status: this.state.status,
      batteryLevel: this.state.batteryLevel,
      uptime: Date.now() - this.lastHeartbeat
    };

    const topic = `iot/devices/${this.deviceId}/heartbeat`;
    this.publishMQTT(topic, heartbeat);
    
    this.lastHeartbeat = Date.now();
  }

  publishMQTT(topic, payload) {
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
    }
  }

  async sendToBackend(endpoint, data) {
    try {
      await axios.post(`${this.apiBaseUrl}${endpoint}`, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEVICE_API_KEY || 'demo-device-key'}`
        }
      });
    } catch (error) {
      // Silently fail for demo purposes
      console.debug(`Backend API call failed: ${endpoint}`);
    }
  }

  handleMQTTMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`📨 MQTT message received on ${topic}:`, payload);
      
      // Handle different message types
      if (payload.type === 'command') {
        this.handleCommand(payload);
      }
    } catch (error) {
      console.error(`Error handling MQTT message:`, error);
    }
  }

  handleCommand(command) {
    console.log(`🔧 Executing command for device ${this.deviceId}:`, command);
    
    switch (command.action) {
      case 'lock':
        if (this.deviceType === 'smart_lock') {
          this.state.lockStatus = 'locked';
        }
        break;
      
      case 'unlock':
        if (this.deviceType === 'smart_lock') {
          this.state.lockStatus = 'unlocked';
        }
        break;
      
      case 'restart':
        console.log(`🔄 Restarting device ${this.deviceId}`);
        break;
      
      case 'update_firmware':
        console.log(`📦 Firmware update for device ${this.deviceId}`);
        break;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.mqttClient) {
      this.mqttClient.end();
    }
    console.log(`🛑 Device ${this.deviceId} stopped`);
  }
}

module.exports = IoTDeviceSimulator; 