const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    adminEmail: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    resourceType: {
      type: String,
      required: true
    },
    resourceId: {
      type: String
    },
    oldValue: {
      type: Object
    },
    newValue: {
      type: Object
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
