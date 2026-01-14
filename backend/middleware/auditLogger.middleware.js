const AuditLog = require('../models/AuditLog');

const auditLogger = (action, resourceType) => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      try {
        if (!req.user || req.user.role !== 'admin') return;

        await AuditLog.create({
          adminId: req.user._id,
          adminEmail: req.user.email,
          action,
          resourceType,
          resourceId: req.params.id || null,
          oldValue: req.oldValue || null,
          newValue: req.newValue || null,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (error) {
        console.error('Audit Log Error:', error.message);
      }
    });

    next();
  };
};

module.exports = auditLogger;
