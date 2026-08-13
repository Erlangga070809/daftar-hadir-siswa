const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize, logActivity } = require('../middleware');
const { validateTeacher, validateClass, validateSubject, validateSchedule } = require('../utils/validation');

router.use(authenticate, authorize('admin'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;

    const teachersCount = await query(
      'SELECT COUNT(*) as count FROM teachers WHERE school_id = $1',
      [schoolId]
    );

    const studentsCount = await query(
      'SELECT COUNT(*) as count FROM students WHERE school_id = $1',
      [schoolId]
    );

    const classesCount = await query(
      'SELECT COUNT(*) as count FROM classes WHERE school_id = $1',
      [schoolId]
    );

    const subjectsCount = await query(
      'SELECT COUNT(*) as count FROM subjects WHERE school_id = $1',
      [schoolId]
    );

    const today = new Date().toISOString().split('T')[0];

    const attendanceToday = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'permission' THEN 1 ELSE 0 END) as permission,
        SUM(CASE WHEN status = 'sick' THEN 1 ELSE 0 END) as sick,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance WHERE school_id = $1 AND date = $2`,
      [schoolId, today]
    );

    const recentAttendance = await query(
      `SELECT a.id, a.date, a.status, a.note,
        s.full_name as student_name, s.nis,
        c.name as class_name,
        sub.name as subject_name,
        t.nip as teacher_nip,
        u.full_name as teacher_name
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      LEFT JOIN teachers t ON a.teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE a.school_id = $1
      ORDER BY a.created_at DESC
      LIMIT 10`,
      [schoolId]
    );

    const recentTeachers = await query(
      `SELECT t.id, t.nip, u.full_name, u.email, u.is_active
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.school_id = $1
      ORDER BY t.created_at DESC
      LIMIT 5`,
      [schoolId]
    );

    const recentStudents = await query(
      `SELECT s.id, s.nis, s.nisn, u.full_name, c.name as class_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = $1
      ORDER BY s.created_at DESC
      LIMIT 5`,
      [schoolId]
    );

    const classes = await query(
      `SELECT c.id, c.name, c.grade, COUNT(s.id) as student_count,
        u.full_name as homeroom_teacher
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE c.school_id = $1
      GROUP BY c.id, c.name, c.grade, u.full_name
      ORDER BY c.name`,
      [schoolId]
    );

    const attendanceStats = attendanceToday.rows[0];
    const totalAttendance = parseInt(attendanceStats.total) || 0;
    const presentCount = parseInt(attendanceStats.present) || 0;
    const attendancePercentage = totalAttendance > 0 
      ? Math.round((presentCount / totalAttendance) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        stats: {
          total_teachers: parseInt(teachersCount.rows[0].count),
          total_students: parseInt(studentsCount.rows[0].count),
          total_classes: parseInt(classesCount.rows[0].count),
          total_subjects: parseInt(subjectsCount.rows[0].count),
          attendance_today: {
            total: totalAttendance,
            present: presentCount,
            permission: parseInt(attendanceStats.permission) || 0,
            sick: parseInt(attendanceStats.sick) || 0,
            absent: parseInt(attendanceStats.absent) || 0,
            percentage: attendancePercentage
          }
        },
        recent_attendance: recentAttendance.rows,
        recent_teachers: recentTeachers.rows,
        recent_students: recentStudents.rows,
        classes: classes.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/teachers', async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const schoolId = req.user.school_id;

    const whereClause = search
      ? `AND (u.full_name ILIKE $2 OR u.email ILIKE $2 OR t.nip ILIKE $2)`
      : '';
    
    const params = search
      ? [schoolId, `%${search}%`, limit, offset]
      : [schoolId, limit, offset];

    const result = await query(
      `SELECT t.id, t.nip, u.full_name, u.email, u.phone, u.is_active
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.school_id = $1 ${whereClause}
      ORDER BY u.full_name
      LIMIT $${search ? '3' : '2'} OFFSET $${search ? '4' : '3'}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as count
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.school_id = $1 ${whereClause}`,
      search ? [schoolId, `%${search}%`] : [schoolId]
    );

    res.json({
      success: true,
      data: {
        teachers: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        total_pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/teachers', async (req, res, next) => {
  try {
    const errors = validateTeacher(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { full_name, nip, email, phone, password } = req.body;
    const schoolId = req.user.school_id;

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
      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await query(
        'INSERT INTO users (school_id, full_name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [schoolId, full_name, email.toLowerCase(), phone || null, passwordHash, 'guru']
      );

      const teacherResult = await query(
        'INSERT INTO teachers (user_id, school_id, nip) VALUES ($1, $2, $3) RETURNING id, user_id, school_id, nip',
        [userResult.rows[0].id, schoolId, nip || null]
      );

      await query('COMMIT');

      await logActivity(req, 'create_teacher', 'teacher', teacherResult.rows[0].id);

      res.status(201).json({
        success: true,
        message: 'Guru berhasil ditambahkan.',
        data: {
          teacher: teacherResult.rows[0]
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

router.put('/teachers/:id', async (req, res, next) => {
  try {
    const teacherId = req.params.id;
    const schoolId = req.user.school_id;
    const { full_name, nip, email, phone, is_active } = req.body;

    const teacherCheck = await query(
      `SELECT t.id, t.user_id FROM teachers t 
      WHERE t.id = $1 AND t.school_id = $2`,
      [teacherId, schoolId]
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guru tidak ditemukan.'
      });
    }

    const userId = teacherCheck.rows[0].user_id;

    await query(
      `UPDATE users SET full_name = $1, email = $2, phone = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5`,
      [full_name, email.toLowerCase(), phone || null, is_active !== undefined ? is_active : true, userId]
    );

    await query(
      `UPDATE teachers SET nip = $1, updated_at = NOW() WHERE id = $2`,
      [nip || null, teacherId]
    );

    await logActivity(req, 'update_teacher', 'teacher', teacherId);

    res.json({
      success: true,
      message: 'Data guru berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/teachers/:id/reset-password', async (req, res, next) => {
  try {
    const teacherId = req.params.id;
    const schoolId = req.user.school_id;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter.'
      });
    }

    const teacherCheck = await query(
      `SELECT t.user_id FROM teachers t 
      WHERE t.id = $1 AND t.school_id = $2`,
      [teacherId, schoolId]
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guru tidak ditemukan.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, teacherCheck.rows[0].user_id]
    );

    await logActivity(req, 'reset_teacher_password', 'teacher', teacherId);

    res.json({
      success: true,
      message: 'Password guru berhasil direset.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/teachers/:id', async (req, res, next) => {
  try {
    const teacherId = req.params.id;
    const schoolId = req.user.school_id;

    const teacherCheck = await query(
      `SELECT t.user_id FROM teachers t 
      WHERE t.id = $1 AND t.school_id = $2`,
      [teacherId, schoolId]
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guru tidak ditemukan.'
      });
    }

    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [teacherCheck.rows[0].user_id]
    );

    await logActivity(req, 'deactivate_teacher', 'teacher', teacherId);

    res.json({
      success: true,
      message: 'Guru berhasil dinonaktifkan.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/students', async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 10, class_id } = req.query;
    const offset = (page - 1) * limit;
    const schoolId = req.user.school_id;

    let conditions = `WHERE s.school_id = $1`;
    const params = [schoolId];
    let paramIndex = 2;

    if (search) {
      conditions += ` AND (u.full_name ILIKE $${paramIndex} OR s.nis ILIKE $${paramIndex} OR s.nisn ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (class_id) {
      conditions += ` AND s.class_id = $${paramIndex}`;
      params.push(class_id);
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

router.get('/classes', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;

    const result = await query(
      `SELECT c.id, c.name, c.grade, c.homeroom_teacher_id,
        u.full_name as homeroom_teacher,
        COUNT(s.id) as student_count
      FROM classes c
      LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN students s ON s.class_id = c.id
      WHERE c.school_id = $1
      GROUP BY c.id, c.name, c.grade, c.homeroom_teacher_id, u.full_name
      ORDER BY c.name`,
      [schoolId]
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

router.post('/classes', async (req, res, next) => {
  try {
    const errors = validateClass(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { name, grade, homeroom_teacher_id } = req.body;
    const schoolId = req.user.school_id;

    const result = await query(
      'INSERT INTO classes (school_id, name, grade, homeroom_teacher_id) VALUES ($1, $2, $3, $4) RETURNING id, school_id, name, grade',
      [schoolId, name, grade || null, homeroom_teacher_id || null]
    );

    await logActivity(req, 'create_class', 'class', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Kelas berhasil ditambahkan.',
      data: {
        class: result.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:id', async (req, res, next) => {
  try {
    const classId = req.params.id;
    const schoolId = req.user.school_id;
    const { name, grade, homeroom_teacher_id } = req.body;

    const classCheck = await query(
      'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan.'
      });
    }

    await query(
      'UPDATE classes SET name = $1, grade = $2, homeroom_teacher_id = $3, updated_at = NOW() WHERE id = $4',
      [name, grade || null, homeroom_teacher_id || null, classId]
    );

    await logActivity(req, 'update_class', 'class', classId);

    res.json({
      success: true,
      message: 'Kelas berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/classes/:id', async (req, res, next) => {
  try {
    const classId = req.params.id;
    const schoolId = req.user.school_id;

    const classCheck = await query(
      'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
      [classId, schoolId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kelas tidak ditemukan.'
      });
    }

    await query('DELETE FROM classes WHERE id = $1', [classId]);

    await logActivity(req, 'delete_class', 'class', classId);

    res.json({
      success: true,
      message: 'Kelas berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/subjects', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;

    const result = await query(
      'SELECT id, name, code, is_active FROM subjects WHERE school_id = $1 ORDER BY name',
      [schoolId]
    );

    res.json({
      success: true,
      data: {
        subjects: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/subjects', async (req, res, next) => {
  try {
    const errors = validateSubject(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { name, code } = req.body;
    const schoolId = req.user.school_id;

    const result = await query(
      'INSERT INTO subjects (school_id, name, code) VALUES ($1, $2, $3) RETURNING id, school_id, name, code',
      [schoolId, name, code || null]
    );

    await logActivity(req, 'create_subject', 'subject', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Mata pelajaran berhasil ditambahkan.',
      data: {
        subject: result.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/subjects/:id', async (req, res, next) => {
  try {
    const subjectId = req.params.id;
    const schoolId = req.user.school_id;
    const { name, code, is_active } = req.body;

    const subjectCheck = await query(
      'SELECT id FROM subjects WHERE id = $1 AND school_id = $2',
      [subjectId, schoolId]
    );

    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mata pelajaran tidak ditemukan.'
      });
    }

    await query(
      'UPDATE subjects SET name = $1, code = $2, is_active = $3, updated_at = NOW() WHERE id = $4',
      [name, code || null, is_active !== undefined ? is_active : true, subjectId]
    );

    await logActivity(req, 'update_subject', 'subject', subjectId);

    res.json({
      success: true,
      message: 'Mata pelajaran berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/subjects/:id', async (req, res, next) => {
  try {
    const subjectId = req.params.id;
    const schoolId = req.user.school_id;

    const subjectCheck = await query(
      'SELECT id FROM subjects WHERE id = $1 AND school_id = $2',
      [subjectId, schoolId]
    );

    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mata pelajaran tidak ditemukan.'
      });
    }

    await query('DELETE FROM subjects WHERE id = $1', [subjectId]);

    await logActivity(req, 'delete_subject', 'subject', subjectId);

    res.json({
      success: true,
      message: 'Mata pelajaran berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/schedules', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;

    const result = await query(
      `SELECT sc.id, sc.day, sc.start_time, sc.end_time, sc.room,
        c.name as class_name,
        sub.name as subject_name,
        u.full_name as teacher_name
      FROM schedules sc
      JOIN classes c ON sc.class_id = c.id
      JOIN subjects sub ON sc.subject_id = sub.id
      JOIN teachers t ON sc.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE sc.school_id = $1
      ORDER BY sc.day, sc.start_time`,
      [schoolId]
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

router.post('/schedules', async (req, res, next) => {
  try {
    const errors = validateSchedule(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { day, start_time, end_time, class_id, teacher_id, subject_id, room } = req.body;
    const schoolId = req.user.school_id;

    const result = await query(
      `INSERT INTO schedules (school_id, day, start_time, end_time, class_id, teacher_id, subject_id, room) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, school_id, day, start_time, end_time, class_id, teacher_id, subject_id, room`,
      [schoolId, day, start_time, end_time, class_id, teacher_id, subject_id, room || null]
    );

    await logActivity(req, 'create_schedule', 'schedule', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Jadwal berhasil ditambahkan.',
      data: {
        schedule: result.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/schedules/:id', async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const schoolId = req.user.school_id;
    const { day, start_time, end_time, class_id, teacher_id, subject_id, room } = req.body;

    const scheduleCheck = await query(
      'SELECT id FROM schedules WHERE id = $1 AND school_id = $2',
      [scheduleId, schoolId]
    );

    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Jadwal tidak ditemukan.'
      });
    }

    await query(
      `UPDATE schedules SET day = $1, start_time = $2, end_time = $3, 
      class_id = $4, teacher_id = $5, subject_id = $6, room = $7, updated_at = NOW() 
      WHERE id = $8`,
      [day, start_time, end_time, class_id, teacher_id, subject_id, room || null, scheduleId]
    );

    await logActivity(req, 'update_schedule', 'schedule', scheduleId);

    res.json({
      success: true,
      message: 'Jadwal berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/schedules/:id', async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const schoolId = req.user.school_id;

    const scheduleCheck = await query(
      'SELECT id FROM schedules WHERE id = $1 AND school_id = $2',
      [scheduleId, schoolId]
    );

    if (scheduleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Jadwal tidak ditemukan.'
      });
    }

    await query('DELETE FROM schedules WHERE id = $1', [scheduleId]);

    await logActivity(req, 'delete_schedule', 'schedule', scheduleId);

    res.json({
      success: true,
      message: 'Jadwal berhasil dihapus.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;