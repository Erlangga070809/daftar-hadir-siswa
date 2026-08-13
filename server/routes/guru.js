const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize, logActivity } = require('../middleware');
const { validateStudent } = require('../utils/validation');

router.use(authenticate, authorize('guru'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    const teacherResult = await query(
      'SELECT id, nip FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan.'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    const teacherClasses = await query(
      `SELECT DISTINCT tc.class_id, c.name as class_name
      FROM teacher_classes tc
      JOIN classes c ON tc.class_id = c.id
      WHERE tc.teacher_id = $1`,
      [teacherId]
    );

    const classIds = teacherClasses.rows.map(c => c.class_id);

    let studentsCount = 0;
    if (classIds.length > 0) {
      const countResult = await query(
        'SELECT COUNT(*) as count FROM students WHERE class_id = ANY($1) AND school_id = $2',
        [classIds, schoolId]
      );
      studentsCount = parseInt(countResult.rows[0].count);
    }

    const today = new Date().toISOString().split('T')[0];
    const currentDay = new Date().toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();

    const scheduleToday = await query(
      `SELECT sc.id, sc.day, sc.start_time, sc.end_time, sc.room,
        c.name as class_name,
        sub.name as subject_name
      FROM schedules sc
      JOIN classes c ON sc.class_id = c.id
      JOIN subjects sub ON sc.subject_id = sub.id
      WHERE sc.teacher_id = $1 AND sc.day = $2
      ORDER BY sc.start_time`,
      [teacherId, currentDay]
    );

    let attendanceToday = null;
    if (classIds.length > 0) {
      const attendanceResult = await query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'permission' THEN 1 ELSE 0 END) as permission,
          SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) as sick,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
        FROM attendance 
        WHERE school_id = $1 AND date = $2 AND teacher_id = $3`,
        [schoolId, today, teacherId]
      );
      attendanceToday = attendanceResult.rows[0];
    }

    const recentActivities = await query(
      `SELECT al.action, al.created_at, u.full_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.school_id = $1 AND al.user_id = $2
      ORDER BY al.created_at DESC
      LIMIT 5`,
      [schoolId, userId]
    );

    res.json({
      success: true,
      data: {
        teacher: {
          id: teacherId,
          nip: teacherResult.rows[0].nip,
          name: req.user.full_name
        },
        stats: {
          total_students: studentsCount,
          total_classes: teacherClasses.rows.length,
          schedule_today: scheduleToday.rows,
          attendance_today: attendanceToday ? {
            total: parseInt(attendanceToday.total) || 0,
            present: parseInt(attendanceToday.present) || 0,
            permission: parseInt(attendanceToday.permission) || 0,
            sick: parseInt(attendanceToday.sick) || 0,
            absent: parseInt(attendanceToday.absent) || 0
          } : {
            total: 0,
            present: 0,
            permission: 0,
            sick: 0,
            absent: 0
          }
        },
        classes: teacherClasses.rows,
        recent_activities: recentActivities.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/students', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;
    const { search = '', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan.'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    const teacherClasses = await query(
      `SELECT DISTINCT class_id FROM teacher_classes WHERE teacher_id = $1`,
      [teacherId]
    );

    const classIds = teacherClasses.rows.map(c => c.class_id);

    if (classIds.length === 0) {
      return res.json({
        success: true,
        data: {
          students: [],
          total: 0,
          page: 1,
          total_pages: 0
        }
      });
    }

    let conditions = `WHERE s.school_id = $1 AND s.class_id = ANY($2)`;
    const params = [schoolId, classIds];
    let paramIndex = 3;

    if (search) {
      conditions += ` AND (u.full_name ILIKE $${paramIndex} OR s.nis ILIKE $${paramIndex} OR s.nisn ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT s.id, s.nis, s.nisn, s.gender, s.student_number,
        u.full_name, u.email, u.phone, u.is_active,
        c.name as class_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      ${conditions}
      ORDER BY u.full_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count
      FROM students s
      JOIN users u ON s.user_id = u.id
      ${conditions}`,
      params
    );

    res.json({
      success: true,
      data: {
        students: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        total_pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/students', async (req, res, next) => {
  try {
    const errors = validateStudent(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { full_name, nis, nisn, gender, birth_date, address, phone, email, class_id, student_number, password } = req.body;
    const schoolId = req.user.school_id;

    const classCheck = await query(
      'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
      [class_id, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan.'
      });
    }

    if (email) {
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
    }

    const client = await query('BEGIN');

    try {
      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await query(
        'INSERT INTO users (school_id, full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [schoolId, full_name, email ? email.toLowerCase() : null, phone || null, passwordHash, 'siswa']
      );

      const studentResult = await query(
        `INSERT INTO students (user_id, school_id, nis, nisn, gender, birth_date, address, class_id, student_number) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING id, user_id, school_id, nis, nisn, class_id`,
        [userResult.rows[0].id, schoolId, nis, nisn || null, gender || null, birth_date || null, address || null, class_id, student_number || null]
      );

      await query('COMMIT');

      await logActivity(req, 'create_student', 'student', studentResult.rows[0].id);

      res.status(201).json({
        success: true,
        message: 'Siswa berhasil ditambahkan.',
        data: {
          student: studentResult.rows[0]
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

router.put('/students/:id', async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const schoolId = req.user.school_id;
    const { full_name, nis, nisn, gender, birth_date, address, phone, email, class_id, student_number, is_active } = req.body;

    const studentCheck = await query(
      `SELECT s.user_id FROM students s 
      WHERE s.id = $1 AND s.school_id = $2`,
      [studentId, schoolId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan.'
      });
    }

    const userId = studentCheck.rows[0].user_id;

    await query(
      `UPDATE users SET full_name = $1, email = $2, phone = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5`,
      [full_name, email ? email.toLowerCase() : null, phone || null, is_active !== undefined ? is_active : true, userId]
    );

    await query(
      `UPDATE students SET nis = $1, nisn = $2, gender = $3, birth_date = $4, address = $5, 
      class_id = $6, student_number = $7, updated_at = NOW() WHERE id = $8`,
      [nis, nisn || null, gender || null, birth_date || null, address || null, class_id, student_number || null, studentId]
    );

    await logActivity(req, 'update_student', 'student', studentId);

    res.json({
      success: true,
      message: 'Data siswa berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/students/:id/reset-password', async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const schoolId = req.user.school_id;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter.'
      });
    }

    const studentCheck = await query(
      `SELECT s.user_id FROM students s 
      WHERE s.id = $1 AND s.school_id = $2`,
      [studentId, schoolId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, studentCheck.rows[0].user_id]
    );

    await logActivity(req, 'reset_student_password', 'student', studentId);

    res.json({
      success: true,
      message: 'Password siswa berhasil direset.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/students/:id', async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const schoolId = req.user.school_id;

    const studentCheck = await query(
      `SELECT s.user_id FROM students s 
      WHERE s.id = $1 AND s.school_id = $2`,
      [studentId, schoolId]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan.'
      });
    }

    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [studentCheck.rows[0].user_id]
    );

    await logActivity(req, 'deactivate_student', 'student', studentId);

    res.json({
      success: true,
      message: 'Siswa berhasil dinonaktifkan.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/classes', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;

    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan.'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await query(
      `SELECT DISTINCT c.id, c.name, c.grade,
        u.full_name as homeroom_teacher,
        COUNT(s.id) as student_count
      FROM teacher_classes tc
      JOIN classes c ON tc.class_id = c.id
      LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN students s ON s.class_id = c.id
      WHERE tc.teacher_id = $1
      GROUP BY c.id, c.name, c.grade, u.full_name
      ORDER BY c.name`,
      [teacherId]
    );

    res.json({
      success: true,
      data: {
        classes: result.rows
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

    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan.'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await query(
      `SELECT sc.id, sc.day, sc.start_time, sc.end_time, sc.room,
        c.name as class_name,
        sub.name as subject_name
      FROM schedules sc
      JOIN classes c ON sc.class_id = c.id
      JOIN subjects sub ON sc.subject_id = sub.id
      WHERE sc.teacher_id = $1
      ORDER BY sc.day, sc.start_time`,
      [teacherId]
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

router.get('/attendance-history', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const userId = req.user.id;
    const { date, class_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan.'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    let conditions = `WHERE a.school_id = $1 AND a.teacher_id = $2`;
    const params = [schoolId, teacherId];
    let paramIndex = 3;

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

    if (status) {
      conditions += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await query(
      `SELECT a.id, a.date, a.status, a.note,
        s.full_name as student_name, s.nis,
        c.name as class_name,
        sub.name as subject_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      ${conditions}
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count
      FROM attendance a
      ${conditions}`,
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
    const { class_id, start_date, end_date } = req.query;

    const teacherResult = await query(
      'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
      [userId, schoolId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan.'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    let conditions = `WHERE a.school_id = $1 AND a.teacher_id = $2`;
    const params = [schoolId, teacherId];
    let paramIndex = 3;

    if (class_id) {
      conditions += ` AND a.class_id = $${paramIndex}`;
      params.push(class_id);
      paramIndex++;
    }

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

module.exports = router;
