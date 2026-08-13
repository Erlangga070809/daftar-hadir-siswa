const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate, authorize, logActivity } = require('../middleware');
const { validateAttendance } = require('../utils/validation');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const schoolId = req.user.school_id;
    const { date, class_id, subject_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

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
        s.full_name as student_name, s.nis,
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
      ORDER BY a.date DESC, a.created_at DESC
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

router.post('/', authorize('admin', 'guru'), async (req, res, next) => {
  try {
    const errors = validateAttendance(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0]
      });
    }

    const { class_id, subject_id, schedule_id, date, students, note } = req.body;
    const schoolId = req.user.school_id;

    let teacherId = null;
    if (req.user.role === 'guru') {
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Data guru tidak ditemukan.'
        });
      }

      teacherId = teacherResult.rows[0].id;
    }

    const client = await query('BEGIN');

    try {
      const insertedAttendance = [];

      for (const student of students) {
        const studentCheck = await query(
          'SELECT id FROM students WHERE id = $1 AND school_id = $2 AND class_id = $3',
          [student.student_id, schoolId, class_id]
        );

        if (studentCheck.rows.length === 0) {
          await query('ROLLBACK');
          return res.status(404).json({
            success: false,
            message: `Siswa dengan ID ${student.student_id} tidak ditemukan di kelas ini.`
          });
        }

        const existingAttendance = await query(
          `SELECT id FROM attendance 
          WHERE student_id = $1 AND subject_id = $2 AND date = $3`,
          [student.student_id, subject_id, date]
        );

        if (existingAttendance.rows.length > 0) {
          await query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: `Absensi untuk siswa ini pada tanggal ${date} dan mata pelajaran ini sudah ada.`
          });
        }

        const result = await query(
          `INSERT INTO attendance (school_id, student_id, class_id, subject_id, schedule_id, teacher_id, date, status, note) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
          RETURNING id, school_id, student_id, class_id, subject_id, date, status`,
          [schoolId, student.student_id, class_id, subject_id, schedule_id || null, teacherId, date, student.status, student.note || note || null]
        );

        insertedAttendance.push(result.rows[0]);
      }

      await query('COMMIT');

      await logActivity(req, 'create_attendance', 'attendance', null, {
        class_id,
        subject_id,
        date,
        count: insertedAttendance.length
      });

      res.status(201).json({
        success: true,
        message: `Absensi berhasil disimpan untuk ${insertedAttendance.length} siswa.`,
        data: {
          attendance: insertedAttendance
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

router.put('/:id', authorize('admin', 'guru'), async (req, res, next) => {
  try {
    const attendanceId = req.params.id;
    const schoolId = req.user.school_id;
    const { status, note } = req.body;

    const attendanceCheck = await query(
      'SELECT id FROM attendance WHERE id = $1 AND school_id = $2',
      [attendanceId, schoolId]
    );

    if (attendanceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data absensi tidak ditemukan.'
      });
    }

    if (req.user.role === 'guru') {
      const teacherResult = await query(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, schoolId]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Data guru tidak ditemukan.'
        });
      }

      const ownershipCheck = await query(
        'SELECT id FROM attendance WHERE id = $1 AND teacher_id = $2',
        [attendanceId, teacherResult.rows[0].id]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses untuk mengubah absensi ini.'
        });
      }
    }

    await query(
      'UPDATE attendance SET status = $1, note = $2, updated_at = NOW() WHERE id = $3',
      [status, note || null, attendanceId]
    );

    await logActivity(req, 'update_attendance', 'attendance', attendanceId);

    res.json({
      success: true,
      message: 'Absensi berhasil diperbarui.'
    });
  } catch (error) {
    next(error);
  }
});

router.get('/students', authorize('admin', 'guru'), async (req, res, next) => {
  try {
    const { class_id } = req.query;
    const schoolId = req.user.school_id;

    if (!class_id) {
      return res.status(400).json({
        success: false,
        message: 'Kelas wajib dipilih.'
      });
    }

    const result = await query(
      `SELECT s.id, s.nis, s.nisn, s.student_number,
        u.full_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.school_id = $1 AND s.class_id = $2 AND u.is_active = true
      ORDER BY s.student_number, u.full_name`,
      [schoolId, class_id]
    );

    res.json({
      success: true,
      data: {
        students: result.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
