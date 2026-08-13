const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { query } = require('../db');
const { authenticate, logActivity } = require('../middleware');
const { validateRegister, validateLogin } = require('../utils/validation');

router.post('/register', async (req, res, next) => {
  try {
    const errors = validateRegister(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { full_name, school_name, email, phone, password } = req.body;

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar.'
      });
    }

    const client = await query('BEGIN');

    try {
      const schoolResult = await query(
        'INSERT INTO schools (name, email, phone) VALUES ($1, $2, $3) RETURNING id',
        [school_name, email.toLowerCase(), phone]
      );

      const schoolId = schoolResult.rows[0].id;

      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await query(
        'INSERT INTO users (school_id, full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, school_id, full_name, email, phone, role',
        [schoolId, full_name, email.toLowerCase(), phone, passwordHash, 'admin']
      );

      await query(
        'INSERT INTO school_settings (school_id) VALUES ($1)',
        [schoolId]
      );

      await query('COMMIT');

      const user = userResult.rows[0];

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
      );

      res.status(201).json({
        success: true,
        message: 'Registrasi berhasil.',
        data: {
          token,
          user
        }
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { email, password, remember_me } = req.body;

    const result = await query(
      'SELECT id, school_id, full_name, email, phone, password_hash, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda dinonaktifkan. Hubungi administrator.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: remember_me ? '30d' : '12h' }
    );

    delete user.password_hash;

    await logActivity(
      { user },
      'login',
      'user',
      user.id
    );

    res.json({
      success: true,
      message: 'Login berhasil.',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await logActivity(req, 'logout', 'user', req.user.id);

    res.json({
      success: true,
      message: 'Logout berhasil.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
