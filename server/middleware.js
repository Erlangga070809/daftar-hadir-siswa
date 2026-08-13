const jwt = require('jsonwebtoken');
const { query } = require('./db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication diperlukan.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query(
      'SELECT id, school_id, full_name, email, phone, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan.'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda dinonaktifkan. Hubungi administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau sudah kadaluarsa.'
      });
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication diperlukan.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke resource ini.'
      });
    }

    next();
  };
};

const validateSchoolAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'Akses sekolah tidak valid.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

const logActivity = async (req, action, entityType = null, entityId = null, metadata = null) => {
  try {
    await query(
      'INSERT INTO activity_logs (school_id, user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        req.user ? req.user.school_id : null,
        req.user ? req.user.id : null,
        action,
        entityType,
        entityId,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

module.exports = {
  authenticate,
  authorize,
  validateSchoolAccess,
  logActivity
};
