document.addEventListener('DOMContentLoaded', function() {
  if (!protectPage('admin')) return;

  setupDashboard();

  loadAdminDashboard();

  const addTeacherButton = document.getElementById('addTeacherButton');
  if (addTeacherButton) {
    addTeacherButton.addEventListener('click', showAddTeacherModal);
  }

  const addClassButton = document.getElementById('addClassButton');
  if (addClassButton) {
    addClassButton.addEventListener('click', showAddClassModal);
  }

  const addSubjectButton = document.getElementById('addSubjectButton');
  if (addSubjectButton) {
    addSubjectButton.addEventListener('click', showAddSubjectModal);
  }

  const addScheduleButton = document.getElementById('addScheduleButton');
  if (addScheduleButton) {
    addScheduleButton.addEventListener('click', showAddScheduleModal);
  }

  const teacherSearch = document.getElementById('teacherSearch');
  if (teacherSearch) {
    teacherSearch.addEventListener('input', debounce(loadTeachers, 300));
  }

  const studentSearch = document.getElementById('studentSearch');
  if (studentSearch) {
    studentSearch.addEventListener('input', debounce(loadStudents, 300));
  }

  const studentClassFilter = document.getElementById('studentClassFilter');
  if (studentClassFilter) {
    studentClassFilter.addEventListener('change', loadStudents);
  }

  const attendanceDateFilter = document.getElementById('attendanceDateFilter');
  if (attendanceDateFilter) {
    attendanceDateFilter.addEventListener('change', loadAttendance);
  }

  const attendanceClassFilter = document.getElementById('attendanceClassFilter');
  if (attendanceClassFilter) {
    attendanceClassFilter.addEventListener('change', loadAttendance);
  }

  const attendanceStatusFilter = document.getElementById('attendanceStatusFilter');
  if (attendanceStatusFilter) {
    attendanceStatusFilter.addEventListener('change', loadAttendance);
  }

  const printReportButton = document.getElementById('printReportButton');
  if (printReportButton) {
    printReportButton.addEventListener('click', function() {
      window.print();
    });
  }

  const exportReportButton = document.getElementById('exportReportButton');
  if (exportReportButton) {
    exportReportButton.addEventListener('click', exportReport);
  }

  loadClassesForFilters();
  loadTeachersForFilter();
});

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function loadAdminDashboard() {
  try {
    const response = await api.get('/admin/dashboard');
    const data = response.data;

    const statsContainer = document.getElementById('dashboardStats');
    const stats = data.stats;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-primary-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          </div>
        </div>
        <p class="stat-value">${stats.total_teachers}</p>
        <p class="stat-label">Total Guru</p>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-success-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
          </div>
        </div>
        <p class="stat-value">${stats.total_students}</p>
        <p class="stat-label">Total Siswa</p>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-warning-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
        </div>
        <p class="stat-value">${stats.total_classes}</p>
        <p class="stat-label">Total Kelas</p>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-info-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
        </div>
        <p class="stat-value">${stats.total_subjects}</p>
        <p class="stat-label">Mata Pelajaran</p>
      </div>
    `;

    const contentContainer = document.getElementById('dashboardContent');
    const attendanceToday = stats.attendance_today;

    contentContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Kehadiran Hari Ini</h3>
          <span class="badge badge-present">${attendanceToday.percentage}%</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
          <div style="text-align: center;">
            <p style="font-size: 24px; font-weight: 700; color: var(--success);">${attendanceToday.present}</p>
            <p style="font-size: 13px; color: var(--text-muted);">Hadir</p>
          </div>
          <div style="text-align: center;">
            <p style="font-size: 24px; font-weight: 700; color: var(--warning);">${attendanceToday.permission}</p>
            <p style="font-size: 13px; color: var(--text-muted);">Izin</p>
          </div>
          <div style="text-align: center;">
            <p style="font-size: 24px; font-weight: 700; color: var(--info);">${attendanceToday.sick}</p>
            <p style="font-size: 13px; color: var(--text-muted);">Sakit</p>
          </div>
          <div style="text-align: center;">
            <p style="font-size: 24px; font-weight: 700; color: var(--danger);">${attendanceToday.absent}</p>
            <p style="font-size: 13px; color: var(--text-muted);">Alpa</p>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Aktivitas Terbaru</h3>
        </div>
        ${data.recent_attendance.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${data.recent_attendance.map(att => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <div>
                  <p style="font-weight: 600; font-size: 14px;">${escapeHtml(att.student_name)}</p>
                  <p style="font-size: 13px; color: var(--text-muted);">${escapeHtml(att.class_name)} - ${escapeHtml(att.subject_name)}</p>
                </div>
                ${renderBadge(att.status)}
              </div>
            `).join('')}
          </div>
        ` : renderEmptyState('Belum ada aktivitas')}
      </div>
    `;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadTeachers(page = 1) {
  try {
    const search = document.getElementById('teacherSearch').value;
    const response = await api.get(`/admin/teachers?search=${encodeURIComponent(search)}&page=${page}`);
    const data = response.data;
    const container = document.getElementById('teachersTable');

    const rows = data.teachers.map((teacher, index) => [
      String((page - 1) * 10 + index + 1),
      escapeHtml(teacher.full_name),
      escapeHtml(teacher.nip || '-'),
      escapeHtml(teacher.email),
      escapeHtml(teacher.phone || '-'),
      renderBadge(teacher.is_active ? 'active' : 'inactive'),
      `<div style="display: flex; gap: 4px;">
        <button class="btn btn-outline btn-sm" onclick="editTeacher('${teacher.id}')">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="resetTeacherPassword('${teacher.id}')">Reset</button>
        <button class="btn btn-danger btn-sm" onclick="deactivateTeacher('${teacher.id}')">Nonaktifkan</button>
      </div>`
    ]);

    container.innerHTML = renderTable(
      ['No', 'Nama', 'NIP', 'Email', 'HP', 'Status', 'Aksi'],
      rows,
      'Belum ada guru'
    ) + renderPagination(data.page, data.total_pages, loadTeachers);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadStudents(page = 1) {
  try {
    const search = document.getElementById('studentSearch').value;
    const classId = document.getElementById('studentClassFilter').value;
    const response = await api.get(`/admin/students?search=${encodeURIComponent(search)}&class_id=${classId}&page=${page}`);
    const data = response.data;
    const container = document.getElementById('studentsTable');

    const rows = data.students.map((student, index) => [
      String((page - 1) * 10 + index + 1),
      escapeHtml(student.full_name),
      escapeHtml(student.nis || '-'),
      escapeHtml(student.nisn || '-'),
      escapeHtml(student.class_name || '-'),
      renderBadge(student.is_active ? 'active' : 'inactive'),
      '-'
    ]);

    container.innerHTML = renderTable(
      ['No', 'Nama', 'NIS', 'NISN', 'Kelas', 'Status', 'Kehadiran'],
      rows,
      'Belum ada siswa'
    ) + renderPagination(data.page, data.total_pages, loadStudents);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadClasses() {
  try {
    const response = await api.get('/admin/classes');
    const data = response.data;
    const container = document.getElementById('classesGrid');

    if (data.classes.length === 0) {
      container.innerHTML = renderEmptyState('Belum ada kelas');
      return;
    }

    container.innerHTML = data.classes.map(cls => `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(cls.name)}</h3>
        </div>
        <p style="color: var(--text-muted); font-size: 14px;">Grade: ${escapeHtml(cls.grade || '-')}</p>
        <p style="color: var(--text-muted); font-size: 14px;">Wali Kelas: ${escapeHtml(cls.homeroom_teacher || '-')}</p>
        <p style="color: var(--text-muted); font-size: 14px;">Siswa: ${cls.student_count}</p>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn btn-outline btn-sm" onclick="editClass('${cls.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClass('${cls.id}')">Hapus</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSubjects() {
  try {
    const response = await api.get('/admin/subjects');
    const data = response.data;
    const container = document.getElementById('subjectsTable');

    const rows = data.subjects.map((subject, index) => [
      String(index + 1),
      escapeHtml(subject.name),
      escapeHtml(subject.code || '-'),
      renderBadge(subject.is_active ? 'active' : 'inactive'),
      `<div style="display: flex; gap: 4px;">
        <button class="btn btn-outline btn-sm" onclick="editSubject('${subject.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSubject('${subject.id}')">Hapus</button>
      </div>`
    ]);

    container.innerHTML = renderTable(
      ['No', 'Nama', 'Kode', 'Status', 'Aksi'],
      rows,
      'Belum ada mata pelajaran'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSchedules() {
  try {
    const response = await api.get('/admin/schedules');
    const data = response.data;
    const container = document.getElementById('schedulesTable');

    const rows = data.schedules.map((schedule, index) => [
      String(index + 1),
      escapeHtml(schedule.day),
      formatTime(schedule.start_time),
      formatTime(schedule.end_time),
      escapeHtml(schedule.class_name),
      escapeHtml(schedule.teacher_name),
      escapeHtml(schedule.subject_name),
      escapeHtml(schedule.room || '-'),
      `<div style="display: flex; gap: 4px;">
        <button class="btn btn-outline btn-sm" onclick="editSchedule('${schedule.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${schedule.id}')">Hapus</button>
      </div>`
    ]);

    container.innerHTML = renderTable(
      ['No', 'Hari', 'Mulai', 'Selesai', 'Kelas', 'Guru', 'Mapel', 'Ruangan', 'Aksi'],
      rows,
      'Belum ada jadwal'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadAttendance(page = 1) {
  try {
    const date = document.getElementById('attendanceDateFilter').value;
    const classId = document.getElementById('attendanceClassFilter').value;
    const status = document.getElementById('attendanceStatusFilter').value;
    
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (classId) params.append('class_id', classId);
    if (status) params.append('status', status);
    params.append('page', page);

    const response = await api.get(`/attendance?${params.toString()}`);
    const data = response.data;
    const container = document.getElementById('attendanceTable');

    const rows = data.attendance.map(att => [
      formatDate(att.date),
      escapeHtml(att.student_name),
      escapeHtml(att.class_name || '-'),
      escapeHtml(att.subject_name || '-'),
      escapeHtml(att.teacher_name || '-'),
      renderBadge(att.status)
    ]);

    container.innerHTML = renderTable(
      ['Tanggal', 'Siswa', 'Kelas', 'Mapel', 'Guru', 'Status'],
      rows,
      'Belum ada absensi'
    ) + renderPagination(data.page, data.total_pages, loadAttendance);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadPermissions() {
  try {
    const response = await api.get('/admin/permission-requests');
    const container = document.getElementById('permissionsTable');

    if (!response.data || !response.data.permission_requests) {
      container.innerHTML = renderEmptyState('Belum ada pengajuan izin');
      return;
    }

    const rows = response.data.permission_requests.map(req => [
      formatDate(req.date),
      escapeHtml(req.student_name || '-'),
      escapeHtml(req.class_name || '-'),
      escapeHtml(req.type),
      escapeHtml(req.reason),
      renderBadge(req.status)
    ]);

    container.innerHTML = renderTable(
      ['Tanggal', 'Siswa', 'Kelas', 'Jenis', 'Alasan', 'Status'],
      rows,
      'Belum ada pengajuan izin'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadReport() {
  try {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    const classId = document.getElementById('reportClassFilter').value;

    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (classId) params.append('class_id', classId);

    const response = await api.get(`/reports/attendance?${params.toString()}`);
    const data = response.data;
    const statsContainer = document.getElementById('reportStats');
    const tableContainer = document.getElementById('reportTable');

    const stats = data.stats;
    statsContainer.innerHTML = `
      <div class="stat-card">
        <p class="stat-value">${stats.total}</p>
        <p class="stat-label">Total Absensi</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-success">${stats.present}</p>
        <p class="stat-label">Hadir</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-warning">${stats.permission}</p>
        <p class="stat-label">Izin</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-danger">${stats.absent}</p>
        <p class="stat-label">Alpa</p>
      </div>
    `;

    const rows = data.attendance.map(att => [
      formatDate(att.date),
      escapeHtml(att.student_name),
      escapeHtml(att.class_name || '-'),
      escapeHtml(att.subject_name || '-'),
      renderBadge(att.status)
    ]);

    tableContainer.innerHTML = renderTable(
      ['Tanggal', 'Siswa', 'Kelas', 'Mapel', 'Status'],
      rows,
      'Belum ada data laporan'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSettings() {
  try {
    const response = await api.get('/admin/settings');
    const settings = response.data.settings;
    const container = document.getElementById('settingsForm');

    container.innerHTML = `
      <h3 class="card-title">Informasi Sekolah</h3>
      <div class="form-group">
        <label class="form-label">Nama Sekolah</label>
        <input type="text" id="settingSchoolName" class="form-input" value="${escapeHtml(settings.name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Alamat</label>
        <textarea id="settingAddress" class="form-input">${escapeHtml(settings.address || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Telepon</label>
        <input type="text" id="settingPhone" class="form-input" value="${escapeHtml(settings.phone || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="settingEmail" class="form-input" value="${escapeHtml(settings.email || '')}">
      </div>
      <button class="btn btn-primary" id="saveSettingsButton">Simpan Pengaturan</button>
    `;

    document.getElementById('saveSettingsButton').addEventListener('click', async function() {
      const data = {
        name: document.getElementById('settingSchoolName').value,
        address: document.getElementById('settingAddress').value,
        phone: document.getElementById('settingPhone').value,
        email: document.getElementById('settingEmail').value
      };

      try {
        await api.put('/admin/settings', data);
        showToast('Pengaturan berhasil disimpan.');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadProfile() {
  try {
    const response = await api.get('/auth/me');
    const user = response.data.user;
    const container = document.getElementById('profileContent');

    container.innerHTML = `
      <h3 class="card-title">Informasi Akun</h3>
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input type="text" id="profileName" class="form-input" value="${escapeHtml(user.full_name)}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="profileEmail" class="form-input" value="${escapeHtml(user.email)}">
      </div>
      <div class="form-group">
        <label class="form-label">Nomor HP</label>
        <input type="text" id="profilePhone" class="form-input" value="${escapeHtml(user.phone || '')}">
      </div>
      <button class="btn btn-primary" id="saveProfileButton">Simpan Profile</button>
    `;

    document.getElementById('saveProfileButton').addEventListener('click', async function() {
      const data = {
        full_name: document.getElementById('profileName').value,
        email: document.getElementById('profileEmail').value,
        phone: document.getElementById('profilePhone').value
      };

      try {
        await api.put('/auth/me', data);
        showToast('Profile berhasil diperbarui.');
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function showAddTeacherModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Nama Lengkap</label>
      <input type="text" id="teacherFullName" class="form-input" placeholder="Nama lengkap guru">
    </div>
    <div class="form-group">
      <label class="form-label">NIP</label>
      <input type="text" id="teacherNIP" class="form-input" placeholder="Nomor Induk Pegawai">
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" id="teacherEmail" class="form-input" placeholder="email@sekolah.sch.id">
    </div>
    <div class="form-group">
      <label class="form-label">Nomor HP</label>
      <input type="tel" id="teacherPhone" class="form-input" placeholder="08xxxxxxxxxx">
    </div>
    <div class="form-group">
      <label class="form-label">Password Awal</label>
      <input type="password" id="teacherPassword" class="form-input" placeholder="Minimal 6 karakter">
    </div>
  `;

  openModal('Tambah Guru', content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Simpan',
      class: 'btn-primary',
      onClick: async function() {
        const data = {
          full_name: document.getElementById('teacherFullName').value,
          nip: document.getElementById('teacherNIP').value,
          email: document.getElementById('teacherEmail').value,
          phone: document.getElementById('teacherPhone').value,
          password: document.getElementById('teacherPassword').value
        };

        try {
          await api.post('/admin/teachers', data);
          showToast('Guru berhasil ditambahkan.');
          closeModal();
          loadTeachers();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);
}

function showAddClassModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Nama Kelas</label>
      <input type="text" id="className" class="form-input" placeholder="Contoh: X-A">
    </div>
    <div class="form-group">
      <label class="form-label">Grade</label>
      <input type="text" id="classGrade" class="form-input" placeholder="Contoh: X">
    </div>
  `;

  openModal('Tambah Kelas', content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Simpan',
      class: 'btn-primary',
      onClick: async function() {
        const data = {
          name: document.getElementById('className').value,
          grade: document.getElementById('classGrade').value
        };

        try {
          await api.post('/admin/classes', data);
          showToast('Kelas berhasil ditambahkan.');
          closeModal();
          loadClasses();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);
}

function showAddSubjectModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Nama Mata Pelajaran</label>
      <input type="text" id="subjectName" class="form-input" placeholder="Contoh: Matematika">
    </div>
    <div class="form-group">
      <label class="form-label">Kode</label>
      <input type="text" id="subjectCode" class="form-input" placeholder="Contoh: MTK">
    </div>
  `;

  openModal('Tambah Mata Pelajaran', content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Simpan',
      class: 'btn-primary',
      onClick: async function() {
        const data = {
          name: document.getElementById('subjectName').value,
          code: document.getElementById('subjectCode').value
        };

        try {
          await api.post('/admin/subjects', data);
          showToast('Mata pelajaran berhasil ditambahkan.');
          closeModal();
          loadSubjects();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);
}

function showAddScheduleModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Hari</label>
      <select id="scheduleDay" class="form-input">
        <option value="senin">Senin</option>
        <option value="selasa">Selasa</option>
        <option value="rabu">Rabu</option>
        <option value="kamis">Kamis</option>
        <option value="jumat">Jumat</option>
        <option value="sabtu">Sabtu</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Jam Mulai</label>
      <input type="time" id="scheduleStart" class="form-input">
    </div>
    <div class="form-group">
      <label class="form-label">Jam Selesai</label>
      <input type="time" id="scheduleEnd" class="form-input">
    </div>
    <div class="form-group">
      <label class="form-label">Kelas</label>
      <select id="scheduleClass" class="form-input">
        <option value="">Pilih Kelas</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Guru</label>
      <select id="scheduleTeacher" class="form-input">
        <option value="">Pilih Guru</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Mata Pelajaran</label>
      <select id="scheduleSubject" class="form-input">
        <option value="">Pilih Mata Pelajaran</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Ruangan</label>
      <input type="text" id="scheduleRoom" class="form-input" placeholder="Contoh: A1">
    </div>
  `;

  openModal('Tambah Jadwal', content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Simpan',
      class: 'btn-primary',
      onClick: async function() {
        const data = {
          day: document.getElementById('scheduleDay').value,
          start_time: document.getElementById('scheduleStart').value,
          end_time: document.getElementById('scheduleEnd').value,
          class_id: document.getElementById('scheduleClass').value,
          teacher_id: document.getElementById('scheduleTeacher').value,
          subject_id: document.getElementById('scheduleSubject').value,
          room: document.getElementById('scheduleRoom').value
        };

        try {
          await api.post('/admin/schedules', data);
          showToast('Jadwal berhasil ditambahkan.');
          closeModal();
          loadSchedules();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);

  loadScheduleOptions();
}

async function loadScheduleOptions() {
  try {
    const [classesRes, teachersRes, subjectsRes] = await Promise.all([
      api.get('/admin/classes'),
      api.get('/admin/teachers'),
      api.get('/admin/subjects')
    ]);

    const classSelect = document.getElementById('scheduleClass');
    classesRes.data.classes.forEach(cls => {
      classSelect.innerHTML += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
    });

    const teacherSelect = document.getElementById('scheduleTeacher');
    teachersRes.data.teachers.forEach(teacher => {
      teacherSelect.innerHTML += `<option value="${teacher.id}">${escapeHtml(teacher.full_name)}</option>`;
    });

    const subjectSelect = document.getElementById('scheduleSubject');
    subjectsRes.data.subjects.forEach(subject => {
      subjectSelect.innerHTML += `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`;
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadClassesForFilters() {
  try {
    const response = await api.get('/admin/classes');
    const classSelects = ['studentClassFilter', 'attendanceClassFilter', 'reportClassFilter'];
    
    classSelects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        response.data.classes.forEach(cls => {
          select.innerHTML += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
        });
      }
    });
  } catch (error) {
    
  }
}

async function loadTeachersForFilter() {
  try {
    const response = await api.get('/admin/teachers');
    const select = document.getElementById('reportTeacherFilter');
    if (select) {
      response.data.teachers.forEach(teacher => {
        select.innerHTML += `<option value="${teacher.id}">${escapeHtml(teacher.full_name)}</option>`;
      });
    }
  } catch (error) {
    
  }
}

function editTeacher(id) {
  showToast('Fitur edit guru akan segera hadir.', 'info');
}

function resetTeacherPassword(id) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Password Baru</label>
      <input type="password" id="newPassword" class="form-input" placeholder="Minimal 6 karakter">
    </div>
  `;

  openModal('Reset Password Guru', content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Reset',
      class: 'btn-primary',
      onClick: async function() {
        const password = document.getElementById('newPassword').value;
        
        try {
          await api.put(`/admin/teachers/${id}/reset-password`, { password });
          showToast('Password berhasil direset.');
          closeModal();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);
}

function deactivateTeacher(id) {
  confirmDialog('Nonaktifkan Guru', 'Apakah Anda yakin ingin menonaktifkan guru ini?', async function() {
    try {
      await api.delete(`/admin/teachers/${id}`);
      showToast('Guru berhasil dinonaktifkan.');
      loadTeachers();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function editClass(id) {
  showToast('Fitur edit kelas akan segera hadir.', 'info');
}

function deleteClass(id) {
  confirmDialog('Hapus Kelas', 'Apakah Anda yakin ingin menghapus kelas ini?', async function() {
    try {
      await api.delete(`/admin/classes/${id}`);
      showToast('Kelas berhasil dihapus.');
      loadClasses();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function editSubject(id) {
  showToast('Fitur edit mata pelajaran akan segera hadir.', 'info');
}

function deleteSubject(id) {
  confirmDialog('Hapus Mata Pelajaran', 'Apakah Anda yakin ingin menghapus mata pelajaran ini?', async function() {
    try {
      await api.delete(`/admin/subjects/${id}`);
      showToast('Mata pelajaran berhasil dihapus.');
      loadSubjects();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function editSchedule(id) {
  showToast('Fitur edit jadwal akan segera hadir.', 'info');
}

function deleteSchedule(id) {
  confirmDialog('Hapus Jadwal', 'Apakah Anda yakin ingin menghapus jadwal ini?', async function() {
    try {
      await api.delete(`/admin/schedules/${id}`);
      showToast('Jadwal berhasil dihapus.');
      loadSchedules();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function exportReport() {
  showToast('Export CSV akan segera hadir.', 'info');
}