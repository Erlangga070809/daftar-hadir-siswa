document.addEventListener('DOMContentLoaded', function() {
  if (!protectPage('siswa')) return;

  setupDashboard();

  loadSiswaDashboard();

  const addPermissionButton = document.getElementById('addPermissionButton');
  if (addPermissionButton) {
    addPermissionButton.addEventListener('click', showAddPermissionModal);
  }
});

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
    schedules: 'Jadwal Saya',
    attendance: 'Absensi Saya',
    history: 'Riwayat Kehadiran',
    permissions: 'Pengajuan Izin',
    profile: 'Profile'
  };

  const topbarTitle = document.getElementById('topbarTitle');
  if (topbarTitle) {
    topbarTitle.textContent = pageTitles[page] || 'Dashboard';
  }

  if (page === 'schedules') loadSchedules();
  if (page === 'attendance') loadAttendance();
  if (page === 'history') loadHistory();
  if (page === 'permissions') loadPermissions();
  if (page === 'profile') loadProfile();
}

async function loadSiswaDashboard() {
  try {
    const response = await api.get('/siswa/dashboard');
    const data = response.data;

    const statusContainer = document.getElementById('dashboardStatus');
    const attendanceToday = data.attendance_today;
    
    let statusClass = 'empty';
    let statusText = 'Belum Diabsen';
    let statusDescription = 'Anda belum diabsen hari ini';

    if (attendanceToday.length > 0) {
      const latest = attendanceToday[0];
      statusClass = latest.status;
      statusText = statusLabel(latest.status);
      statusDescription = `${latest.subject_name || 'Mata pelajaran'} - ${latest.teacher_name || 'Guru'}`;
    }

    statusContainer.innerHTML = `
      <div class="status-card ${statusClass}">
        <div>
          <p class="status-label">Status Kehadiran Hari Ini</p>
          <p class="status-value">${statusText}</p>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(statusDescription)}</p>
        </div>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
    `;

    const statsContainer = document.getElementById('dashboardStats');
    const stats = data.stats;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <p class="stat-value text-success">${stats.present}</p>
        <p class="stat-label">Hadir</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-warning">${stats.permission}</p>
        <p class="stat-label">Izin</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-info">${stats.sick}</p>
        <p class="stat-label">Sakit</p>
      </div>
      <div class="stat-card">
        <p class="stat-value text-danger">${stats.absent}</p>
        <p class="stat-label">Alpa</p>
      </div>
    `;

    const contentContainer = document.getElementById('dashboardContent');

    contentContainer.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Informasi Siswa</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <p style="font-size: 14px;"><strong>Nama:</strong> ${escapeHtml(data.student.name)}</p>
          <p style="font-size: 14px;"><strong>NIS:</strong> ${escapeHtml(data.student.nis || '-')}</p>
          <p style="font-size: 14px;"><strong>Kelas:</strong> ${escapeHtml(data.student.class_name || '-')}</p>
          <p style="font-size: 14px;"><strong>Nomor Absen:</strong> ${data.student.student_number || '-'}</p>
          <p style="font-size: 14px;"><strong>Persentase Kehadiran:</strong> <span class="text-success" style="font-weight: 700;">${stats.percentage}%</span></p>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Jadwal Hari Ini</h3>
        </div>
        ${data.schedule_today.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${data.schedule_today.map(schedule => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <div>
                  <p style="font-weight: 600; font-size: 14px;">${escapeHtml(schedule.subject_name)}</p>
                  <p style="font-size: 13px; color: var(--text-muted);">${escapeHtml(schedule.teacher_name)} - ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}</p>
                </div>
                <span style="font-size: 13px; color: var(--text-muted);">${escapeHtml(schedule.room || '-')}</span>
              </div>
            `).join('')}
          </div>
        ` : renderEmptyState('Tidak ada jadwal hari ini')}
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Riwayat Terbaru</h3>
        </div>
        ${data.recent_attendance.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${data.recent_attendance.map(att => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <div>
                  <p style="font-weight: 600; font-size: 14px;">${escapeHtml(att.subject_name || 'Mata pelajaran')}</p>
                  <p style="font-size: 13px; color: var(--text-muted);">${formatDate(att.date)}</p>
                </div>
                ${renderBadge(att.status)}
              </div>
            `).join('')}
          </div>
        ` : renderEmptyState('Belum ada riwayat absensi')}
      </div>
    `;
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadSchedules() {
  try {
    const response = await api.get('/siswa/schedules');
    const data = response.data;
    const container = document.getElementById('schedulesTable');

    const rows = data.schedules.map((schedule, index) => [
      String(index + 1),
      escapeHtml(schedule.day),
      formatTime(schedule.start_time),
      formatTime(schedule.end_time),
      escapeHtml(schedule.subject_name),
      escapeHtml(schedule.teacher_name),
      escapeHtml(schedule.room || '-')
    ]);

    container.innerHTML = renderTable(
      ['No', 'Hari', 'Mulai', 'Selesai', 'Mapel', 'Guru', 'Ruangan'],
      rows,
      'Belum ada jadwal'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadAttendance() {
  try {
    const response = await api.get('/siswa/attendance-recap');
    const data = response.data;
    const recapContainer = document.getElementById('attendanceRecap');
    const tableContainer = document.getElementById('attendanceTable');

    recapContainer.innerHTML = `
      <div class="card-header">
        <h3 class="card-title">Rekap Kehadiran</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">
        <div style="text-align: center;">
          <p style="font-size: 24px; font-weight: 700;">${data.stats.total}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Total</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: var(--success);">${data.stats.present}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Hadir</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: var(--warning);">${data.stats.permission}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Izin</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: var(--info);">${data.stats.sick}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Sakit</p>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: var(--danger);">${data.stats.absent}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Alpa</p>
        </div>
      </div>
      <p style="text-align: center; margin-top: 16px; font-size: 16px;">
        Persentase Kehadiran: <strong class="text-success">${data.stats.percentage}%</strong>
      </p>
    `;

    const rows = data.attendance_records.map(record => [
      formatDate(record.date),
      escapeHtml(record.subject_name || '-'),
      renderBadge(record.status),
      escapeHtml(record.note || '-')
    ]);

    tableContainer.innerHTML = renderTable(
      ['Tanggal', 'Mapel', 'Status', 'Catatan'],
      rows,
      'Belum ada data absensi'
    );
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadHistory(page = 1) {
  try {
    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;

    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    params.append('page', page);

    const response = await api.get(`/siswa/attendance?${params.toString()}`);
    const data = response.data;
    const container = document.getElementById('historyTable');

    const rows = data.attendance.map(att => [
      formatDate(att.date),
      escapeHtml(att.subject_name || '-'),
      escapeHtml(att.teacher_name || '-'),
      renderBadge(att.status),
      escapeHtml(att.note || '-')
    ]);

    container.innerHTML = renderTable(
      ['Tanggal', 'Mapel', 'Guru', 'Status', 'Catatan'],
      rows,
      'Belum ada riwayat kehadiran'
    ) + renderPagination(data.page, data.total_pages, loadHistory);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadPermissions() {
  try {
    const response = await api.get('/siswa/permission-requests');
    const data = response.data;
    const container = document.getElementById('permissionsTable');

    const rows = data.permission_requests.map(req => [
      formatDate(req.date),
      escapeHtml(req.type === 'permission' ? 'Izin' : 'Sakit'),
      escapeHtml(req.reason),
      renderBadge(req.status),
      formatDate(req.created_at)
    ]);

    container.innerHTML = renderTable(
      ['Tanggal', 'Jenis', 'Alasan', 'Status', 'Diajukan'],
      rows,
      'Belum ada pengajuan izin'
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

function showAddPermissionModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label class="form-label">Tanggal</label>
      <input type="date" id="permissionDate" class="form-input" value="${getTodayDate()}">
    </div>
    <div class="form-group">
      <label class="form-label">Jenis Izin</label>
      <select id="permissionType" class="form-input">
        <option value="permission">Izin</option>
        <option value="sick">Sakit</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Alasan</label>
      <textarea id="permissionReason" class="form-input" placeholder="Jelaskan alasan izin Anda"></textarea>
    </div>
  `;

  openModal('Ajukan Izin', content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Kirim',
      class: 'btn-primary',
      onClick: async function() {
        const data = {
          date: document.getElementById('permissionDate').value,
          type: document.getElementById('permissionType').value,
          reason: document.getElementById('permissionReason').value
        };

        try {
          await api.post('/siswa/permission-requests', data);
          showToast('Pengajuan izin berhasil dikirim.');
          closeModal();
          loadPermissions();
        } catch (error) {
          showToast(error.message, 'error');
        }
      }
    }
  ]);
}

window.navigateTo = navigateTo;
