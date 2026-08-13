async function loadAttendanceForm(container, options = {}) {
  try {
    const [classesResponse, subjectsResponse] = await Promise.all([
      api.get('/guru/classes'),
      api.get('/admin/subjects')
    ]);

    const classes = classesResponse.data.classes;
    const subjects = subjectsResponse.data.subjects;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Form Absensi</h3>
        </div>
        <div class="form-group">
          <label class="form-label">Kelas</label>
          <select id="attendanceClass" class="form-input">
            <option value="">Pilih Kelas</option>
            ${classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Mata Pelajaran</label>
          <select id="attendanceSubject" class="form-input">
            <option value="">Pilih Mata Pelajaran</option>
            ${subjects.filter(s => s.is_active).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input type="date" id="attendanceDate" class="form-input" value="${getTodayDate()}">
        </div>
        <button class="btn btn-primary" id="loadStudentsButton">Tampilkan Siswa</button>
        <div id="studentAttendanceList" style="margin-top: 24px;"></div>
      </div>
    `;

    document.getElementById('loadStudentsButton').addEventListener('click', async function() {
      const classId = document.getElementById('attendanceClass').value;
      const subjectId = document.getElementById('attendanceSubject').value;
      const date = document.getElementById('attendanceDate').value;
      
      if (!classId || !subjectId || !date) {
        showToast('Silakan pilih kelas, mata pelajaran, dan tanggal.', 'warning');
        return;
      }

      const listContainer = document.getElementById('studentAttendanceList');
      listContainer.innerHTML = '<div class="skeleton-card" style="min-height: 200px;"></div>';

      try {
        const response = await api.get(`/attendance/students?class_id=${classId}`);
        const students = response.data.students;

        if (students.length === 0) {
          listContainer.innerHTML = renderEmptyState('Belum ada siswa di kelas ini');
          return;
        }

        let html = `
          <div class="card-header">
            <h4 class="card-title">Daftar Siswa (${students.length})</h4>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-outline btn-sm" id="markAllPresent">Tandai Semua Hadir</button>
              <div class="search-box">
                <input type="text" id="studentSearchInput" class="form-input" placeholder="Cari siswa...">
              </div>
            </div>
          </div>
          <div id="studentAttendanceRows">
        `;

        students.forEach((student, index) => {
          html += `
            <div class="attendance-row" data-student-id="${student.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border);">
              <div>
                <span style="font-weight: 600;">${escapeHtml(student.full_name)}</span>
                <span style="color: var(--text-muted); font-size: 13px; margin-left: 8px;">${escapeHtml(student.nis)}</span>
              </div>
              <div class="attendance-status-buttons">
                <button class="attendance-status-btn present active" data-status="present" data-index="${index}">Hadir</button>
                <button class="attendance-status-btn permission" data-status="permission" data-index="${index}">Izin</button>
                <button class="attendance-status-btn sick" data-status="sick" data-index="${index}">Sakit</button>
                <button class="attendance-status-btn absent" data-status="absent" data-index="${index}">Alpa</button>
              </div>
            </div>
          `;
        });

        html += '</div>';
        html += `
          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">Catatan (opsional)</label>
            <textarea id="attendanceNote" class="form-input" placeholder="Catatan tambahan..."></textarea>
          </div>
          <button class="btn btn-primary btn-block" id="saveAttendanceButton">Simpan Absensi</button>
        `;

        listContainer.innerHTML = html;

        const attendanceData = {};

        students.forEach(student => {
          attendanceData[student.id] = 'present';
        });

        listContainer.querySelectorAll('.attendance-status-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const studentRow = this.closest('.attendance-row');
            const studentId = studentRow.dataset.studentId;
            const status = this.dataset.status;
            
            studentRow.querySelectorAll('.attendance-status-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            attendanceData[studentId] = status;
          });
        });

        document.getElementById('markAllPresent').addEventListener('click', function() {
          listContainer.querySelectorAll('.attendance-status-btn.present').forEach(btn => {
            btn.click();
          });
        });

        document.getElementById('studentSearchInput').addEventListener('input', function() {
          const search = this.value.toLowerCase();
          listContainer.querySelectorAll('.attendance-row').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(search) ? 'flex' : 'none';
          });
        });

        document.getElementById('saveAttendanceButton').addEventListener('click', async function() {
          const note = document.getElementById('attendanceNote').value;
          
          const attendancePayload = {
            class_id: classId,
            subject_id: subjectId,
            date: date,
            students: Object.keys(attendanceData).map(studentId => ({
              student_id: studentId,
              status: attendanceData[studentId]
            })),
            note: note || null
          };

          this.disabled = true;
          this.textContent = 'Menyimpan...';

          try {
            await api.post('/attendance', attendancePayload);
            showToast('Absensi berhasil disimpan.');
            
            setTimeout(() => {
              if (typeof loadGuruDashboard === 'function') {
                loadGuruDashboard();
              }
              if (typeof navigateTo === 'function') {
                navigateTo('history');
              }
            }, 500);
          } catch (error) {
            showToast(error.message, 'error');
            this.disabled = false;
            this.textContent = 'Simpan Absensi';
          }
        });
      } catch (error) {
        listContainer.innerHTML = renderEmptyState('Gagal memuat data siswa', error.message);
      }
    });
  } catch (error) {
    container.innerHTML = renderEmptyState('Gagal memuat form absensi', error.message);
  }
}
