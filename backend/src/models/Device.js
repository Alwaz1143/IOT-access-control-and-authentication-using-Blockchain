const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceType: {
    type: String,
    required: true,
    enum: [
      'temperature_sensor',
      'humidity_sensor',
      'pressure_sensor',
      'motion_sensor',
      'door_lock',
      'camera',
      'thermostat',
      'light_switch',
      'smart_plug',
      'security_panel',
      'gateway',
      'controller',
      'other'
    ]
  },
  location: {
    type: String,
    required: true
  },
  firmwareVersion: {
    type: String,
    default: '1.0.0'
  },
  publicKey: {
    type: String,
    default: ''
  },
  attributes: {
    type: Map,
    of: String,
    default: new Map()
  },
  capabilities: [{
    type: String,
    enum: [
      'temperature',
      'humidity',
      'pressure',
      'motion',
      'light',
      'lock',
      'camera',
      'thermostat',
      'switch',
      'sensor',
      'gateway',
      'controller'
    ]
  }],
  owner: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'compromised', 'decommissioned'],
    default: 'active'
  },
  blockchainTxHash: {
    type: String,
    required: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastDataUpdate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    manufacturer: String,
    model: String,
    serialNumber: String,
    installationDate: Date,
    warrantyExpiry: Date,
    maintenanceSchedule: Date
  },
  security: {
    certificateExpiry: Date,
    lastSecurityScan: Date,
    vulnerabilities: [{
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical']
      },
      description: String,
      discoveredAt: Date,
      resolvedAt: Date
    }],
    encryptionKey: String,
    authenticationMethod: {
      type: String,
      enum: ['certificate', 'api_key', 'oauth', 'biometric'],
      default: 'certificate'
    }
  },
  network: {
    ipAddress: String,
    macAddress: String,
    protocol: {
      type: String,
      enum: ['mqtt', 'coap', 'http', 'https'],
      default: 'mqtt'
    },
    port: Number,
    topic: String
  },
  performance: {
    uptime: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: Number,
      default: 0
    },
    errorRate: {
      type: Number,
      default: 0
    },
    dataThroughput: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
deviceSchema.index({ deviceType: 1, status: 1 });
deviceSchema.index({ owner: 1, status: 1 });
deviceSchema.index({ 'attributes.location': 1 });
deviceSchema.index({ lastSeen: -1 });
deviceSchema.index({ createdAt: -1 });

// Virtual for device health status
deviceSchema.virtual('healthStatus').get(function() {
  const now = new Date();
  const lastSeenDiff = now - this.lastSeen;
  const hoursSinceLastSeen = lastSeenDiff / (1000 * 60 * 60);
  
  if (this.status === 'compromised') return 'compromised';
  if (this.status === 'maintenance') return 'maintenance';
  if (this.status === 'decommissioned') return 'decommissioned';
  if (hoursSinceLastSeen > 24) return 'offline';
  if (hoursSinceLastSeen > 1) return 'warning';
  return 'healthy';
});

// Virtual for device age
deviceSchema.virtual('age').get(function() {
  const now = new Date();
  const ageInDays = (now - this.createdAt) / (1000 * 60 * 60 * 24);
  return Math.floor(ageInDays);
});

// Instance methods
deviceSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

deviceSchema.methods.updatePerformance = function(metrics) {
  this.performance = { ...this.performance, ...metrics };
  return this.save();
};

deviceSchema.methods.addVulnerability = function(vulnerability) {
  this.security.vulnerabilities.push(vulnerability);
  return this.save();
};

deviceSchema.methods.resolveVulnerability = function(vulnerabilityId) {
  const vulnerability = this.security.vulnerabilities.id(vulnerabilityId);
  if (vulnerability) {
    vulnerability.resolvedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Vulnerability not found'));
};

// Static methods
deviceSchema.statics.findByType = function(deviceType) {
  return this.find({ deviceType });
};

deviceSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

deviceSchema.statics.findByOwner = function(owner) {
  return this.find({ owner });
};

deviceSchema.statics.findOfflineDevices = function() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  return this.find({
    lastSeen: { $lt: cutoff },
    status: { $in: ['active', 'inactive'] }
  });
};

deviceSchema.statics.getDeviceStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

deviceSchema.statics.getDeviceTypeStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$deviceType',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Pre-save middleware
deviceSchema.pre('save', function(next) {
  // Update lastSeen if status is being set to active
  if (this.isModified('status') && this.status === 'active') {
    this.lastSeen = new Date();
  }
  
  // Validate device ID format
  if (!/^[a-zA-Z0-9_-]+$/.test(this.deviceId)) {
    return next(new Error('Device ID can only contain letters, numbers, hyphens, and underscores'));
  }
  
  next();
});

// Pre-remove middleware
deviceSchema.pre('remove', function(next) {
  // Clean up related data (e.g., policies, audit logs)
  // This would be implemented based on your specific requirements
  next();
});

module.exports = mongoose.model('Device', deviceSchema); 