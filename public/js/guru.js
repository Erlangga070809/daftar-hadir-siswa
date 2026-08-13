document.addEventListener('DOMContentLoaded', function() {
  if (!protectPage('guru')) return;

  setupDashboard();

  loadGuruDashboard();

  const startAttendanceButton = document.getElementById('startAttendanceButton');
  if (startAttendanceButton) {
    startAttendanceButton.addEventListener('click', function() {
      navigateTo('attendance');
    });
  }

  const addStudentButton = document.getElementById('addStudentButton');
  if (addStudentButton) {
    addStudentButton.addEventListener('click', showAddStudentModal);
  }

  const addStudentButton2 = document.getElementById('addStudentButton2');
  if (addStudentButton2) {
    addStudentButton2.addEventListener('click', showAddStudentModal);
  }

  const studentSearch = document.getElementById('studentSearch');
  if (studentSearch) {
    studentSearch.addEventListener('input', debounce(loadStudents, 300));
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

  loadClassesForFilter();
});

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function navigateTo(page) {
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const targetLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
  if (targetLink) {
    targetLink.classList.add('active');
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = document.getElementById(`${page}Page`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  const pageTitles = {
    dashboard: 'Dashboard',
    students: 'Siswa',
    classes: 'Kelas Saya',
    schedules: 'Jadwal',
    attendance: 'Absensi',
    history: 'Riwayat Absensi',
    reports: 'Laporan',
    profile: 'Profile'
  };

  const topbarTitle = document.getElementById('topbarTitle');
  if (topbarTitle) {
    topbarTitle.textContent = pageTitles[page] || 'Dashboard';
  }
}

async function loadGuruDashboard() {
  try {
    const response = await api.get('/guru/dashboard');
    const data = response.data;

    const statsContainer = document.getElementById('dashboardStats');
    const stats = data.stats;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-primary-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle></svg>
          </div>
        </div>
        <p class="stat-value">${stats.total_students}</p>
        <p class="stat-label">Total Siswa</p>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-success-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
        </div>
        <p class="stat-value">${stats.total_classes}</p>
        <p class="stat-label">Total Kelas</p>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon bg-warning-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
        </div>
        <p class="stat-value">${stats.schedule_today.length}</p>
        <p class="stat-label">Jadwal Hari Ini</p>
      </div>
    `;

    const contentContainer = document.getElementById('dashboardContent');
    const attendanceToday = stats.attendance_today;

    contentContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Kehadiran Hari Ini</h3>
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
          <h3 class="card-title">Jadwal Hari Ini</h3>
        </div>
        ${stats.schedule_today.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${stats.schedule_today.map(schedule => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <div>
                  <p style="font-weight: 600; font-size: 14px;">${escapeHtml(schedule.subject_name)}</p>
                  <p style="font-size: 13px; color: var(--text-muted);">${escapeHtml(schedule.class_name)} - ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}</p>
                </div>
                <span style="font-size: 13px; color: var(--text-muted);">${escapeHtml(schedule.room || '-')}</span>
              </div>
            `).join('')}
          </div>
        ` : renderEmptyState('Tidak ada jadwal hari ini')}
      </div>
    `;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadStudents(page = 1) {
  try {
    const search = document.getElementById('studentSearch').value;
    const response = await api.get(`/guru/students?search=${encodeURIComponent(search)}&page=${page}`);
    const data = response.data;
    const container = document.getElementById('studentsTable');

    const rows = data.students.map((student, index) => [
      String((page - 1) * 10 + index + 1),
      escapeHtml(student.full_name),
      escapeHtml(student.nis || '-'),
      escapeHtml(student.nisn || '-'),
      escapeHtml(student.class_name || '-'),
      renderBadge(student.is_active ? 'active' : 'inactive'),
      `<div style="display: flex; gap: 4px;">
        <button class="btn btn-outline btn-sm" onclick="editStudent('${student.id}')">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="resetStudentPassword('${student.id}')">Reset</button>
        <button class="btn btn-danger btn-sm" onclick="deactivateStudent('${student.id}')">Nonaktifkan</button>
      </div>`
    ]);

    container.innerHTML = renderTable(
      ['No', 'Nama', 'NIS', 'NISN', 'Kelas', 'Status', 'Aksi'],
      rows,
      'Belum ada siswa'
    ) + renderPagination(data.page, data.total_pages, loadStudents);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadClasses() {
  try {
    const response = await api.get('/guru/classes');
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
        <p style="color: var(--text-muted); font-size: 14px;">Siswa: ${cls.student_count}</p>
      </div>
    `).join('');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSchedules() {
  try {
    const response = await api.get('/guru/schedules');
    const data = response.data;
    const container = document.getElementById('schedulesTable');

    const rows = data.schedules.map((schedule, index) => [
      String(index + 1),
      escapeHtml(schedule.day),
      formatTime(schedule.start_time),
      formatTime(schedule.end_time),
      escapeHtml(schedule.class_name),
      escapeHtml(schedule.subject_name),
      escapeHtml(schedule.room || '-')
    ]);

    container.innerHTML = renderTable(
      ['No', 'Hari', 'Mulai', 'Selesai', 'Kelas', 'Mapel', 'Ruangan'],
      rows,
      'Belum ada jadwal'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadHistory(page = 1) {
  try {
    const date = document.getElementById('historyDateFilter').value;
    const classId = document.getElementById('historyClassFilter').value;
    const status = document.getElementById('historyStatusFilter').value;

    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (classId) params.append('class_id', classId);
    if (status) params.append('status', status);
    params.append('page', page);

    const response = await api.get(`/guru/attendance-history?${params.toString()}`);
    const data = response.data;
    const container = document.getElementById('historyTable');

    const rows = data.attendance.map(att => [
      formatDate(att.date),
      escapeHtml(att.student_name),
      escapeHtml(att.class_name || '-'),
      escapeHtml(att.subject_name || '-'),
      renderBadge(att.status)
    ]);

    container.innerHTML = renderTable(
      ['Tanggal', 'Siswa', 'Kelas', 'Mapel', 'Status'],
      rows,
      'Belum ada riwayat absensi'
    ) + renderPagination(data.page, data.total_pages, loadHistory);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadReport() {
  try {
    const classId = document.getElementById('reportClassFilter').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    const params = new URLSearchParams();
    if (classId) params.append('class_id', classId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const response = await api.get(`/guru/attendance-recap?${params.toString()}`);
    const data = response.data;
    const container = document.getElementById('reportTable');

    const rows = data.recap.map(recap => [
      escapeHtml(recap.student_name),
      escapeHtml(recap.nis || '-'),
      escapeHtml(recap.class_name || '-'),
      String(recap.total_attendance),
      String(recap.present_count),
      String(recap.permission_count),
      String(recap.sick_count),
      String(recap.absent_count),
      `${recap.attendance_percentage}%`
    ]);

    container.innerHTML = renderTable(
      ['Nama', 'NIS', 'Kelas', 'Total', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Persentase'],
      rows,
      'Belum ada data rekap'
    );
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

function showAddStudentModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Nama Lengkap</label>
      <input type="text" id="studentFullName" class="form-input" placeholder="Nama lengkap siswa">
    </div>
    <div class="form-group">
      <label class="form-label">NIS</label>
      <input type="text" id="studentNIS" class="form-input" placeholder="Nomor Induk Siswa">
    </div>
    <div class="form-group">
      <label class="form-label">NISN</label>
      <input type="text" id="studentNISN" class="form-input" placeholder="Nomor Induk Siswa Nasional">
    </div>
    <div class="form-group">
      <label class="form-label">Jenis Kelamin</label>
      <select id="studentGender" class="form-input">
        <option value="">Pilih Jenis Kelamin</option>
        <option value="L">Laki-laki</option>
        <option value="P">Perempuan</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Tanggal Lahir</label>
      <input type="date" id="studentBirthDate" class="form-input">
    </div>
    <div class="form-group">
      <label class="form-label">Alamat</label>
      <textarea id="studentAddress" class="form-input" placeholder="Alamat lengkap"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Nomor HP</label>
      <input type="tel" id="studentPhone" class="form-input" placeholder="08xxxxxxxxxx">
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" id="studentEmail" class="form-input" placeholder="email@siswa.sch.id">
    </div>
    <div class="form-group">
      <label class="form-label">Kelas</label>
      <select id="studentClass" class="form-input">
        <option value="">Pilih Kelas</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Nomor Absen</label>
      <input type="number" id="studentNumber" class="form-input" placeholder="Nomor absen">
    </div>
    <div class="form-group">
      <label class="form-label">Password Awal</label>
      <input type="password" id="studentPassword" class="form-input" placeholder="Minimal 6 karakter">
    </div>
  `;

  openModal('Tambah Siswa', content, [
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
          full_name: document.getElementById('studentFullName').value,
          nis: document.getElementById('studentNIS').value,
          nisn: document.getElementById('studentNISN').value,
          gender: document.getElementById('studentGender').value,
          birth_date: document.getElementById('studentBirthDate').value,
          address: document.getElementById('studentAddress').value,
          phone: document.getElementById('studentPhone').value,
          email: document.getElementById('studentEmail').value,
          class_id: document.getElementById('studentClass').value,
          student_number: document.getElementById('studentNumber').value,
          password: document.getElementById('studentPassword').value
        };

        try {
          await api.post('/guru/students', data);
          showToast('Siswa berhasil ditambahkan.');
          closeModal();
          loadStudents();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);

  loadStudentClassOptions();
}

async function loadStudentClassOptions() {
  try {
    const response = await api.get('/guru/classes');
    const select = document.getElementById('studentClass');
    
    response.data.classes.forEach(cls => {
      select.innerHTML += `<option value="${cls.id}">${escapeHtml(cls.name)}</option>`;
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadClassesForFilter() {
  try {
    const response = await api.get('/guru/classes');
    const selects = ['historyClassFilter', 'reportClassFilter'];
    
    selects.forEach(selectId => {
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

function editStudent(id) {
  showToast('Fitur edit siswa akan segera hadir.', 'info');
}

function resetStudentPassword(id) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Password Baru</label>
      <input type="password" id="newPassword" class="form-input" placeholder="Minimal 6 karakter">
    </div>
  `;

  openModal('Reset Password Siswa', content, [
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
          await api.put(`/guru/students/${id}/reset-password`, { password });
          showToast('Password berhasil direset.');
          closeModal();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);
}

function deactivateStudent(id) {
  confirmDialog('Nonaktifkan Siswa', 'Apakah Anda yakin ingin menonaktifkan siswa ini?', async function() {
    try {
      await api.delete(`/guru/students/${id}`);
      showToast('Siswa berhasil dinonaktifkan.');
      loadStudents();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

function exportReport() {
  showToast('Export CSV akan segera hadir.', 'info');
}

window.loadGuruDashboard = loadGuruDashboard;
window.navigateTo = navigateTo;
