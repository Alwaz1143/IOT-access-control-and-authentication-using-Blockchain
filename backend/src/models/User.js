const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'operator'],
    default: 'user'
  },
  permissions: [{
    type: String,
    enum: [
      'read:own_devices',
      'write:own_devices',
      'read:all_devices',
      'write:all_devices',
      'delete:devices',
      'read:policies',
      'write:policies',
      'delete:policies',
      'read:audit',
      'write:audit',
      'manage:users',
      'read:all',
      'write:all',
      'delete:all'
    ]
  }],
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    avatar: String,
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    lastPasswordChange: {
      type: Date,
      default: Date.now
    },
    passwordHistory: [{
      password: String,
      changedAt: Date
    }],
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: Date,
    apiKeys: [{
      key: String,
      name: String,
      permissions: [String],
      createdAt: Date,
      lastUsed: Date,
      isActive: {
        type: Boolean,
        default: true
      }
    }]
  },
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    dashboard: {
      defaultView: {
        type: String,
        default: 'overview'
      },
      refreshInterval: {
        type: Number,
        default: 30
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    userAgent: String,
    success: Boolean
  }],
  devices: [{
    deviceId: String,
    permissions: [String],
    addedAt: Date
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ lastLogin: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// Virtual for account age
userSchema.virtual('accountAge').get(function() {
  const now = new Date();
  const ageInDays = (now - this.createdAt) / (1000 * 60 * 60 * 24);
  return Math.floor(ageInDays);
});

// Virtual for account status
userSchema.virtual('accountStatus').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isLocked()) return 'locked';
  if (!this.isVerified) return 'unverified';
  return 'active';
});

// Instance methods
userSchema.methods.isLocked = function() {
  return this.security.lockedUntil && this.security.lockedUntil > new Date();
};

userSchema.methods.checkPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changePassword = async function(newPassword) {
  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  
  // Add to password history (keep last 5)
  this.security.passwordHistory.push({
    password: this.password,
    changedAt: this.security.lastPasswordChange
  });
  
  if (this.security.passwordHistory.length > 5) {
    this.security.passwordHistory.shift();
  }
  
  // Update password
  this.password = hashedPassword;
  this.security.lastPasswordChange = new Date();
  this.security.failedLoginAttempts = 0;
  this.security.lockedUntil = null;
  
  return this.save();
};

userSchema.methods.recordLoginAttempt = function(success, ipAddress, userAgent) {
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    success
  });
  
  if (this.loginHistory.length > 100) {
    this.loginHistory.shift();
  }
  
  if (success) {
    this.lastLogin = new Date();
    this.security.failedLoginAttempts = 0;
    this.security.lockedUntil = null;
  } else {
    this.security.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.security.failedLoginAttempts >= 5) {
      this.security.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }
  
  return this.save();
};

userSchema.methods.generateApiKey = function(name, permissions = []) {
  const crypto = require('crypto');
  const apiKey = crypto.randomBytes(32).toString('hex');
  
  this.security.apiKeys.push({
    key: apiKey,
    name,
    permissions,
    createdAt: new Date(),
    lastUsed: new Date(),
    isActive: true
  });
  
  return this.save().then(() => apiKey);
};

userSchema.methods.revokeApiKey = function(keyId) {
  const apiKey = this.security.apiKeys.id(keyId);
  if (apiKey) {
    apiKey.isActive = false;
    return this.save();
  }
  return Promise.reject(new Error('API key not found'));
};

userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || 
         this.permissions.includes('read:all') || 
         this.permissions.includes('write:all');
};

userSchema.methods.addDevice = function(deviceId, permissions = []) {
  const existingDevice = this.devices.find(d => d.deviceId === deviceId);
  if (existingDevice) {
    existingDevice.permissions = permissions;
    existingDevice.addedAt = new Date();
  } else {
    this.devices.push({
      deviceId,
      permissions,
      addedAt: new Date()
    });
  }
  return this.save();
};

userSchema.methods.removeDevice = function(deviceId) {
  this.devices = this.devices.filter(d => d.deviceId !== deviceId);
  return this.save();
};

// Static methods
userSchema.statics.findByRole = function(role) {
  return this.find({ role });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};

userSchema.statics.findLockedUsers = function() {
  return this.find({
    'security.lockedUntil': { $gt: new Date() }
  });
};

userSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if it's modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(this.email)) {
    return next(new Error('Invalid email format'));
  }
  
  // Validate Ethereum address format
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(this.address)) {
    return next(new Error('Invalid Ethereum address format'));
  }
  
  next();
});

// Pre-remove middleware
userSchema.pre('remove', function(next) {
  // Clean up related data (e.g., device permissions, audit logs)
  // This would be implemented based on your specific requirements
  next();
});

module.exports = mongoose.model('User', userSchema); 