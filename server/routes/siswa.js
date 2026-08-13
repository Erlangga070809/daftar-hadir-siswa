const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize, logActivity } = require('../middleware');
const { validatePermissionRequest } = require('../utils/validation');

router.use(authenticate, authorize('siswa'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    const studentResult = await query(
      `SELECT s.id, s.nis, s.nisn, s.gender, s.birth_date, s.address, s.student_number,
        c.name as class_name, c.id as class_id
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.user_id = $1 AND s.school_id = $2`,
      [userId, schoolId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      });
    }

    const student = studentResult.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const currentDay = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

    const attendanceToday = await query(
      `SELECT a.id, a.date, a.status, a.note,
        sub.name as subject_name,
        u.full_name as teacher_name
      FROM attendance a
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE a.student_id = $1 AND a.date = $2
      ORDER BY a.created_at DESC`,
      [student.id, today]
    );

    const attendanceStats = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'permission' THEN 1 ELSE 0 END) as permission,
        SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) as sick,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance 
      WHERE student_id = $1`,
      [student.id]
    );

    const scheduleToday = await query(
      `SELECT sc.id, sc.day, sc.start_time, sc.end_time, sc.room,
        sub.name as subject_name,
        u.full_name as teacher_name
      FROM schedules sc
      JOIN subjects sub ON sc.subject_id = sub.id
      JOIN teachers t ON sc.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE sc.class_id = $1 AND sc.day = $2
      ORDER BY sc.start_time`,
      [student.class_id, currentDay]
    );

    const recentAttendance = await query(
      `SELECT a.id, a.date, a.status, a.note,
        sub.name as subject_name
      FROM attendance a
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      WHERE a.student_id = $1
      ORDER BY a.date DESC
      LIMIT 10`,
      [student.id]
    );

    const stats = attendanceStats.rows[0];
    const totalAttendance = parseInt(stats.total) || 0;
    const presentCount = parseInt(stats.present) || 0;
    const attendancePercentage = totalAttendance > 0 
      ? Math.round((presentCount / totalAttendance) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: req.user.full_name,
          nis: student.nis,
          nisn: student.nisn,
          gender: student.gender,
          class_name: student.class_name,
          student_number: student.student_number
        },
        attendance_today: attendanceToday.rows,
        stats: {
          total: totalAttendance,
          present: presentCount,
          permission: parseInt(stats.permission) || 0,
          sick: parseInt(stats.sick) || 0,
          absent: parseInt(stats.absent) || 0,
          percentage: attendancePercentage
        },
        schedule_today: scheduleToday.rows,
        recent_attendance: recentAttendance.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/schedules', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    const studentResult = await query(
      'SELECT id, class_id FROM students WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      });
    }

    const student = studentResult.rows[0];

    const result = await query(
      `SELECT sc.id, sc.day, sc.start_time, sc.end_time, sc.room,
        sub.name as subject_name,
        u.full_name as teacher_name
      FROM schedules sc
      JOIN subjects sub ON sc.subject_id = sub.id
      JOIN teachers t ON sc.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE sc.class_id = $1
      ORDER BY sc.day, sc.start_time`,
      [student.class_id]
    );

    res.json({
      success: true,
      data: {
        schedules: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/attendance', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;
    const { start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const studentResult = await query(
      'SELECT id FROM students WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      });
    }

    const studentId = studentResult.rows[0].id;

    let conditions = `WHERE a.student_id = $1`;
    const params = [studentId];
    let paramIndex = 2;

    if (start_date) {
      conditions += ` AND a.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      conditions += ` AND a.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const result = await query(
      `SELECT a.id, a.date, a.status, a.note,
        sub.name as subject_name,
        u.full_name as teacher_name
      FROM attendance a
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      ${conditions}
      ORDER BY a.date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count FROM attendance a ${conditions}`,
      params
    );

    res.json({
      success: true,
      data: {
        attendance: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        total_pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/attendance-recap', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    const studentResult = await query(
      'SELECT id FROM students WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      });
    }

    const studentId = studentResult.rows[0].id;

    let conditions = `WHERE a.student_id = $1`;
    const params = [studentId];
    let paramIndex = 2;

    if (start_date) {
      conditions += ` AND a.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      conditions += ` AND a.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        a.date,
        a.status,
        a.note,
        sub.name as subject_name
      FROM attendance a
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      ${conditions}
      ORDER BY a.date`,
      params
    );

    const statsResult = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'permission' THEN 1 ELSE 0 END) as permission,
        SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) as sick,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance 
      WHERE student_id = $1`,
      [studentId]
    );

    const stats = statsResult.rows[0];
    const totalAttendance = parseInt(stats.total) || 0;
    const presentCount = parseInt(stats.present) || 0;

    res.json({
      success: true,
      data: {
        attendance_records: result.rows,
        stats: {
          total: totalAttendance,
          present: presentCount,
          permission: parseInt(stats.permission) || 0,
          sick: parseInt(stats.sick) || 0,
          absent: parseInt(stats.absent) || 0,
          percentage: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/permission-requests', async (req, res, next) => {
  try {
    const errors = validatePermissionRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { date, type, reason, attachment_url } = req.body;
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    const studentResult = await query(
      'SELECT id, class_id FROM students WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      });
    }

    const student = studentResult.rows[0];

    const result = await query(
      `INSERT INTO permission_requests (school_id, student_id, class_id, date, type, reason, attachment_url) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, school_id, student_id, date, type, reason, status`,
      [schoolId, student.id, student.class_id, date, type, reason, attachment_url || null]
    );

    await logActivity(req, 'create_permission_request', 'permission_request', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Pengajuan izin berhasil dikirim.',
      data: {
        permission_request: result.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/permission-requests', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    const studentResult = await query(
      'SELECT id FROM students WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan.'
      });
    }

    const studentId = studentResult.rows[0].id;

    const result = await query(
      `SELECT pr.id, pr.date, pr.type, pr.reason, pr.status, pr.created_at
      FROM permission_requests pr
      WHERE pr.student_id = $1
      ORDER BY pr.created_at DESC`,
      [studentId]
    );

    res.json({
      success: true,
      data: {
        permission_requests: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
