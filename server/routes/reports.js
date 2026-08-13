const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware');

router.use(authenticate);

router.get('/attendance', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const { start_date, end_date, class_id, student_id, teacher_id, subject_id, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let conditions = `WHERE a.school_id = $1`;
    const params = [schoolId];
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

    if (class_id) {
      conditions += ` AND a.class_id = $${paramIndex}`;
      params.push(class_id);
      paramIndex++;
    }

    if (student_id) {
      conditions += ` AND a.student_id = $${paramIndex}`;
      params.push(student_id);
      paramIndex++;
    }

    if (teacher_id) {
      conditions += ` AND a.teacher_id = $${paramIndex}`;
      params.push(teacher_id);
      paramIndex++;
    }

    if (subject_id) {
      conditions += ` AND a.subject_id = $${paramIndex}`;
      params.push(subject_id);
      paramIndex++;
    }

    if (status) {
      conditions += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (req.user.role === 'guru') {
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, schoolId]
      );

      if (teacherResult.rows.length > 0) {
        conditions += ` AND a.teacher_id = $${paramIndex}`;
        params.push(teacherResult.rows[0].id);
        paramIndex++;
      }
    }

    if (req.user.role === 'siswa') {
      const studentResult = await query(
        'SELECT id FROM students WHERE user_id = $1 AND school_id = $2',
        [req.user.id, schoolId]
      );

      if (studentResult.rows.length > 0) {
        conditions += ` AND a.student_id = $${paramIndex}`;
        params.push(studentResult.rows[0].id);
        paramIndex++;
      }
    }

    const result = await query(
      `SELECT a.id, a.date, a.status, a.note,
        s.full_name as student_name, s.nis, s.nisn,
        c.name as class_name,
        sub.name as subject_name,
        u.full_name as teacher_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      ${conditions}
      ORDER BY a.date DESC, s.full_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count FROM attendance a ${conditions}`,
      params
    );

    const statsResult = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'permission' THEN 1 ELSE 0 END) as permission,
        SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) as sick,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance a ${conditions}`,
      params
    );

    const stats = statsResult.rows[0];
    const totalAttendance = parseInt(stats.total) || 0;
    const presentCount = parseInt(stats.present) || 0;

    res.json({
      success: true,
      data: {
        attendance: result.rows,
        stats: {
          total: totalAttendance,
          present: presentCount,
          permission: parseInt(stats.permission) || 0,
          sick: parseInt(stats.sick) || 0,
          absent: parseInt(stats.absent) || 0,
          percentage: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0
        },
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        total_pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/recap', authorize('admin', 'guru'), async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const { start_date, end_date, class_id, subject_id } = req.query;

    let conditions = `WHERE a.school_id = $1`;
    const params = [schoolId];
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

    if (class_id) {
      conditions += ` AND a.class_id = $${paramIndex}`;
      params.push(class_id);
      paramIndex++;
    }

    if (subject_id) {
      conditions += ` AND a.subject_id = $${paramIndex}`;
      params.push(subject_id);
      paramIndex++;
    }

    if (req.user.role === 'guru') {
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, schoolId]
      );

      if (teacherResult.rows.length > 0) {
        conditions += ` AND a.teacher_id = $${paramIndex}`;
        params.push(teacherResult.rows[0].id);
        paramIndex++;
      }
    }

    const result = await query(
      `SELECT 
        s.id as student_id,
        s.full_name as student_name,
        s.nis,
        c.name as class_name,
        COUNT(a.id) as total_attendance,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'permission' THEN 1 ELSE 0 END) as permission_count,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        CASE WHEN COUNT(a.id) > 0 THEN 
          ROUND((SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::numeric / COUNT(a.id)) * 100, 2)
        ELSE 0 END as attendance_percentage
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      ${conditions}
      GROUP BY s.id, s.full_name, s.nis, c.name
      ORDER BY s.full_name`,
      params
    );

    res.json({
      success: true,
      data: {
        recap: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/daily', authorize('admin', 'guru'), async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const { date, class_id } = req.query;

    let conditions = `WHERE a.school_id = $1`;
    const params = [schoolId];
    let paramIndex = 2;

    if (date) {
      conditions += ` AND a.date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (class_id) {
      conditions += ` AND a.class_id = $${paramIndex}`;
      params.push(class_id);
      paramIndex++;
    }

    if (req.user.role === 'guru') {
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, schoolId]
      );

      if (teacherResult.rows.length > 0) {
        conditions += ` AND a.teacher_id = $${paramIndex}`;
        params.push(teacherResult.rows[0].id);
        paramIndex++;
      }
    }

    const result = await query(
      `SELECT 
        a.date,
        COUNT(*) as total,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'permission' THEN 1 ELSE 0 END) as permission,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance a
      ${conditions}
      GROUP BY a.date
      ORDER BY a.date`,
      params
    );

    res.json({
      success: true,
      data: {
        daily_recap: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
