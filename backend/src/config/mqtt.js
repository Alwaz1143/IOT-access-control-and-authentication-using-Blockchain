const mqtt = require('mqtt');
const logger = require('../utils/logger');

let mqttClient = null;
let isConnected = false;

const setupMQTT = async () => {
  try {
    const mqttConfig = {
      host: process.env.MQTT_HOST || 'localhost',
      port: process.env.MQTT_PORT || 1883,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: `iot_access_control_${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      keepalive: 60,
    };

    const url = `mqtt://${mqttConfig.host}:${mqttConfig.port}`;
    
    mqttClient = mqtt.connect(url, mqttConfig);

    mqttClient.on('connect', () => {
      isConnected = true;
      logger.info('MQTT client connected successfully');
      
      // Subscribe to device topics
      subscribeToDeviceTopics();
    });

    mqttClient.on('message', (topic, message) => {
      handleMQTTMessage(topic, message);
    });

    mqttClient.on('error', (error) => {
      logger.error('MQTT connection error:', error);
      isConnected = false;
    });

    mqttClient.on('close', () => {
      logger.warn('MQTT connection closed');
      isConnected = false;
    });

    mqttClient.on('reconnect', () => {
      logger.info('MQTT reconnecting...');
    });

    return mqttClient;

  } catch (error) {
    logger.error('MQTT setup failed:', error);
    logger.warn('Continuing without MQTT functionality');
    // Don't throw error, allow the app to start without MQTT
    return null;
  }
};

const subscribeToDeviceTopics = () => {
  const topics = [
    'iot/devices/+/status',
    'iot/devices/+/data',
    'iot/devices/+/access',
    'iot/devices/+/alerts',
    'iot/policies/+/updates',
    'iot/audit/+/events'
  ];

  topics.forEach(topic => {
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to ${topic}:`, err);
      } else {
        logger.info(`Subscribed to ${topic}`);
      }
    });
  });
};

const handleMQTTMessage = (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    logger.info(`MQTT message received on ${topic}:`, payload);

    // Route messages based on topic
    if (topic.includes('/status')) {
      handleDeviceStatus(topic, payload);
    } else if (topic.includes('/data')) {
      handleDeviceData(topic, payload);
    } else if (topic.includes('/access')) {
      handleAccessRequest(topic, payload);
    } else if (topic.includes('/alerts')) {
      handleDeviceAlert(topic, payload);
    } else if (topic.includes('/policies/')) {
      handlePolicyUpdate(topic, payload);
    } else if (topic.includes('/audit/')) {
      handleAuditEvent(topic, payload);
    }

  } catch (error) {
    logger.error('Error handling MQTT message:', error);
  }
};

const handleDeviceStatus = (topic, payload) => {
  const deviceId = topic.split('/')[2];
  // Emit to Socket.IO for real-time updates
  if (global.io) {
    global.io.to(`device-${deviceId}`).emit('device-status-update', {
      deviceId,
      status: payload.status,
      timestamp: new Date().toISOString()
    });
  }
};

const handleDeviceData = (topic, payload) => {
  const deviceId = topic.split('/')[2];
  // Store device data and emit to monitoring room
  if (global.io) {
    global.io.to('monitoring').emit('device-data', {
      deviceId,
      data: payload.data,
      timestamp: new Date().toISOString()
    });
  }
};

const handleAccessRequest = (topic, payload) => {
  const deviceId = topic.split('/')[2];
  // Process access request through blockchain
  logger.info(`Processing access request for device ${deviceId}:`, payload);
};

const handleDeviceAlert = (topic, payload) => {
  const deviceId = topic.split('/')[2];
  // Handle security alerts
  logger.warn(`Security alert for device ${deviceId}:`, payload);
  
  if (global.io) {
    global.io.to('monitoring').emit('security-alert', {
      deviceId,
      alert: payload,
      timestamp: new Date().toISOString()
    });
  }
};

const handlePolicyUpdate = (topic, payload) => {
  // Handle policy updates
  logger.info('Policy update received:', payload);
};

const handleAuditEvent = (topic, payload) => {
  // Handle audit events
  logger.info('Audit event received:', payload);
};

const publishMessage = (topic, message) => {
  if (!mqttClient || !isConnected) {
    logger.warn(`MQTT not available, skipping message to ${topic}`);
    return;
  }

  const payload = JSON.stringify(message);
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      logger.error(`Failed to publish to ${topic}:`, err);
    } else {
      logger.info(`Message published to ${topic}`);
    }
  });
};

const getMQTTClient = () => {
  if (!mqttClient) {
    logger.warn('MQTT client not initialized');
    return null;
  }
  return mqttClient;
};

const disconnectMQTT = () => {
  if (mqttClient) {
    mqttClient.end();
    mqttClient = null;
    isConnected = false;
    logger.info('MQTT client disconnected');
  }
};

module.exports = {
  setupMQTT,
  getMQTTClient,
  publishMessage,
  disconnectMQTT
}; 