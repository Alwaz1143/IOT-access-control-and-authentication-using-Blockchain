const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  policyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  policyType: {
    type: String,
    required: true,
    enum: ['RBAC', 'ABAC', 'TimeBased', 'LocationBased', 'Composite']
  },
  effect: {
    type: String,
    required: true,
    enum: ['Allow', 'Deny']
  },
  priority: {
    type: Number,
    default: 100,
    min: 1,
    max: 1000
  },
  rules: [{
    // Subject conditions
    subject: {
      roles: [String],
      attributes: {
        type: Map,
        of: String
      },
      groups: [String]
    },
    // Resource conditions
    resource: {
      types: [String],
      ids: [String],
      attributes: {
        type: Map,
        of: String
      }
    },
    // Action conditions
    action: {
      type: String,
      required: true
    },
    // Environmental conditions
    environment: {
      timeConstraints: {
        startTime: Date,
        endTime: Date,
        allowedDays: [Number], // 0=Sunday, 1=Monday, etc.
        allowedHours: {
          start: Number, // 0-23
          end: Number    // 0-23
        },
        isRecurring: {
          type: Boolean,
          default: false
        }
      },
      locationConstraints: {
        allowedLocations: [String],
        deniedLocations: [String],
        radiusMeters: Number,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      deviceConstraints: {
        deviceTypes: [String],
        deviceStatus: [String],
        firmwareVersions: [String]
      }
    },
    // Additional conditions
    conditions: {
      maxUsageCount: Number,
      currentUsageCount: {
        type: Number,
        default: 0
      },
      ipWhitelist: [String],
      ipBlacklist: [String],
      userAgents: [String],
      customConditions: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    }
  }],
  creator: {
    type: String,
    required: true,
    index: true
  },
  blockchainTxHash: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  metadata: {
    version: {
      type: String,
      default: '1.0'
    },
    tags: [String],
    category: String,
    compliance: [String], // GDPR, HIPAA, SOX, etc.
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  statistics: {
    totalEvaluations: {
      type: Number,
      default: 0
    },
    successfulEvaluations: {
      type: Number,
      default: 0
    },
    failedEvaluations: {
      type: Number,
      default: 0
    },
    lastEvaluated: Date,
    averageEvaluationTime: {
      type: Number,
      default: 0
    }
  },
  audit: {
    createdBy: String,
    modifiedBy: String,
    approvedBy: String,
    approvalDate: Date,
    reviewDate: Date,
    nextReviewDate: Date,
    changeHistory: [{
      timestamp: Date,
      changedBy: String,
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      reason: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
policySchema.index({ policyType: 1, isActive: 1 });
policySchema.index({ effect: 1, isActive: 1 });
policySchema.index({ creator: 1, createdAt: -1 });
policySchema.index({ 'metadata.category': 1 });
policySchema.index({ 'metadata.riskLevel': 1 });
policySchema.index({ 'statistics.lastEvaluated': -1 });

// Virtual for success rate
policySchema.virtual('successRate').get(function() {
  if (this.statistics.totalEvaluations === 0) return 0;
  return (this.statistics.successfulEvaluations / this.statistics.totalEvaluations) * 100;
});

// Virtual for policy age
policySchema.virtual('age').get(function() {
  const now = new Date();
  const ageInDays = (now - this.createdAt) / (1000 * 60 * 60 * 24);
  return Math.floor(ageInDays);
});

// Virtual for policy status
policySchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isHidden) return 'hidden';
  if (this.metadata.riskLevel === 'critical') return 'critical';
  return 'active';
});

// Instance methods
policySchema.methods.evaluate = function(subject, resource, action, context = {}) {
  const startTime = Date.now();
  
  try {
    // Check if policy is active
    if (!this.isActive) {
      return { allowed: false, reason: 'Policy is inactive' };
    }

    // Check if policy is hidden and user doesn't have permission
    if (this.isHidden && !context.canViewHidden) {
      return { allowed: false, reason: 'Policy is hidden' };
    }

    // Evaluate each rule
    for (const rule of this.rules) {
      const ruleResult = this.evaluateRule(rule, subject, resource, action, context);
      if (ruleResult.matched) {
        // Update statistics
        this.statistics.totalEvaluations++;
        this.statistics.lastEvaluated = new Date();
        
        if (ruleResult.allowed) {
          this.statistics.successfulEvaluations++;
        } else {
          this.statistics.failedEvaluations++;
        }
        
        this.statistics.averageEvaluationTime = 
          (this.statistics.averageEvaluationTime * (this.statistics.totalEvaluations - 1) + (Date.now() - startTime)) / 
          this.statistics.totalEvaluations;
        
        this.save();
        
        return {
          allowed: ruleResult.allowed,
          reason: ruleResult.reason,
          policyId: this.policyId,
          policyType: this.policyType,
          effect: this.effect,
          evaluationTime: Date.now() - startTime
        };
      }
    }

    // No rules matched
    this.statistics.totalEvaluations++;
    this.statistics.failedEvaluations++;
    this.statistics.lastEvaluated = new Date();
    this.save();

    return { allowed: false, reason: 'No matching rules' };

  } catch (error) {
    this.statistics.totalEvaluations++;
    this.statistics.failedEvaluations++;
    this.save();
    
    return { allowed: false, reason: 'Evaluation error', error: error.message };
  }
};

policySchema.methods.evaluateRule = function(rule, subject, resource, action, context) {
  // Check action
  if (rule.action !== action) {
    return { matched: false };
  }

  // Check subject conditions
  if (rule.subject.roles && rule.subject.roles.length > 0) {
    if (!subject.roles || !subject.roles.some(role => rule.subject.roles.includes(role))) {
      return { matched: false };
    }
  }

  // Check resource conditions
  if (rule.resource.types && rule.resource.types.length > 0) {
    if (!rule.resource.types.includes(resource.type)) {
      return { matched: false };
    }
  }

  // Check time constraints
  if (rule.environment.timeConstraints) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const timeConstraints = rule.environment.timeConstraints;

    if (timeConstraints.startTime && now < timeConstraints.startTime) {
      return { matched: true, allowed: false, reason: 'Before allowed time' };
    }

    if (timeConstraints.endTime && now > timeConstraints.endTime) {
      return { matched: true, allowed: false, reason: 'After allowed time' };
    }

    if (timeConstraints.allowedDays && timeConstraints.allowedDays.length > 0) {
      if (!timeConstraints.allowedDays.includes(currentDay)) {
        return { matched: true, allowed: false, reason: 'Not allowed on this day' };
      }
    }

    if (timeConstraints.allowedHours) {
      if (currentHour < timeConstraints.allowedHours.start || currentHour > timeConstraints.allowedHours.end) {
        return { matched: true, allowed: false, reason: 'Outside allowed hours' };
      }
    }
  }

  // Check location constraints
  if (rule.environment.locationConstraints && context.location) {
    const locationConstraints = rule.environment.locationConstraints;
    
    if (locationConstraints.deniedLocations && locationConstraints.deniedLocations.includes(context.location)) {
      return { matched: true, allowed: false, reason: 'Location denied' };
    }

    if (locationConstraints.allowedLocations && locationConstraints.allowedLocations.length > 0) {
      if (!locationConstraints.allowedLocations.includes(context.location)) {
        return { matched: true, allowed: false, reason: 'Location not allowed' };
      }
    }
  }

  // Check usage limits
  if (rule.conditions.maxUsageCount && rule.conditions.currentUsageCount >= rule.conditions.maxUsageCount) {
    return { matched: true, allowed: false, reason: 'Usage limit exceeded' };
  }

  // Check IP restrictions
  if (context.ipAddress) {
    if (rule.conditions.ipBlacklist && rule.conditions.ipBlacklist.includes(context.ipAddress)) {
      return { matched: true, allowed: false, reason: 'IP address blacklisted' };
    }

    if (rule.conditions.ipWhitelist && rule.conditions.ipWhitelist.length > 0) {
      if (!rule.conditions.ipWhitelist.includes(context.ipAddress)) {
        return { matched: true, allowed: false, reason: 'IP address not whitelisted' };
      }
    }
  }

  // Rule matched - determine if allowed based on policy effect
  const allowed = this.effect === 'Allow';
  return { 
    matched: true, 
    allowed,
    reason: allowed ? 'Access granted' : 'Access denied'
  };
};

policySchema.methods.updateUsage = function() {
  if (this.rules.length > 0 && this.rules[0].conditions.maxUsageCount) {
    this.rules[0].conditions.currentUsageCount++;
    return this.save();
  }
  return Promise.resolve();
};

policySchema.methods.addChangeRecord = function(field, oldValue, newValue, changedBy, reason) {
  this.audit.changeHistory.push({
    timestamp: new Date(),
    changedBy,
    field,
    oldValue,
    newValue,
    reason
  });

  // Keep only last 50 changes
  if (this.audit.changeHistory.length > 50) {
    this.audit.changeHistory.shift();
  }

  return this.save();
};

// Static methods
policySchema.statics.findByType = function(policyType) {
  return this.find({ policyType, isActive: true });
};

policySchema.statics.findByEffect = function(effect) {
  return this.find({ effect, isActive: true });
};

policySchema.statics.findByCreator = function(creator) {
  return this.find({ creator });
};

policySchema.statics.findActivePolicies = function() {
  return this.find({ isActive: true });
};

policySchema.statics.getPolicyStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$policyType',
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        avgSuccessRate: {
          $avg: {
            $cond: [
              { $eq: ['$statistics.totalEvaluations', 0] },
              0,
              { $multiply: [{ $divide: ['$statistics.successfulEvaluations', '$statistics.totalEvaluations'] }, 100] }
            ]
          }
        }
      }
    }
  ]);
};

// Pre-save middleware
policySchema.pre('save', function(next) {
  // Validate policy ID format
  if (!/^[a-zA-Z0-9_-]+$/.test(this.policyId)) {
    return next(new Error('Policy ID can only contain letters, numbers, hyphens, and underscores'));
  }

  // Ensure at least one rule exists
  if (this.rules.length === 0) {
    return next(new Error('Policy must have at least one rule'));
  }

  next();
});

module.exports = mongoose.model('Policy', policySchema); 