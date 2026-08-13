function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function openModal(title, content, actions = []) {
  const container = document.getElementById('modalContainer');
  if (!container) return null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const header = document.createElement('div');
  header.className = 'modal-header';
  
  const titleEl = document.createElement('h3');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  closeBtn.setAttribute('aria-label', 'Tutup modal');
  closeBtn.addEventListener('click', closeModal);
  
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  
  const body = document.createElement('div');
  body.className = 'modal-body';
  
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else {
    body.appendChild(content);
  }
  
  modal.appendChild(header);
  modal.appendChild(body);

  if (actions.length > 0) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'modal-actions';
    
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `btn ${action.class || 'btn-outline'}`;
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      actionsContainer.appendChild(btn);
    });
    
    modal.appendChild(actionsContainer);
  }
  
  overlay.appendChild(modal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  container.appendChild(overlay);

  function closeModal() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }

  return { closeModal };
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }
}

function confirmDialog(title, message, onConfirm) {
  const content = document.createElement('div');
  content.innerHTML = `<p style="color: var(--text-muted);">${escapeHtml(message)}</p>`;
  
  return openModal(title, content, [
    {
      label: 'Batal',
      class: 'btn-outline',
      onClick: closeModal
    },
    {
      label: 'Ya, Lanjutkan',
      class: 'btn-danger',
      onClick: () => {
        closeModal();
        onConfirm();
      }
    }
  ]);
}

function renderEmptyState(title, description = '') {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <h4 class="empty-state-title">${escapeHtml(title)}</h4>
      ${description ? `<p class="empty-state-description">${escapeHtml(description)}</p>` : ''}
    </div>
  `;
}

function renderPagination(currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) return '';

  let html = '<div class="pagination">';
  
  html += `<button class="pagination-button" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Sebelumnya</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `<button class="pagination-button ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += '<span style="padding: 0 4px;">...</span>';
    }
  }
  
  html += `<button class="pagination-button" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Selanjutnya</button>`;
  
  html += '</div>';

  setTimeout(() => {
    document.querySelectorAll('.pagination-button').forEach(btn => {
      btn.addEventListener('click', function() {
        if (!this.disabled) {
          onPageChange(parseInt(this.dataset.page));
        }
      });
    });
  }, 0);

  return html;
}

function renderBadge(status) {
  return `<span class="badge ${statusBadgeClass(status)}">${statusLabel(status)}</span>`;
}

function renderTable(headers, rows, emptyMessage = 'Belum ada data') {
  if (!rows || rows.length === 0) {
    return `<div class="table-container">${renderEmptyState(emptyMessage)}</div>`;
  }

  let html = '<div class="table-container"><table class="table"><thead><tr>';
  
  headers.forEach(header => {
    html += `<th>${header}</th>`;
  });
  
  html += '</tr></thead><tbody>';
  
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      html += `<td>${cell}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  
  return html;
}

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarClose = document.getElementById('sidebarClose');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.add('active');
      this.setAttribute('aria-expanded', 'true');
    });
  }

  if (sidebarClose) {
    sidebarClose.addEventListener('click', function() {
      sidebar.classList.remove('active');
      if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
    });
  }

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      this.classList.add('active');

      const page = this.dataset.page;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      
      const targetPage = document.getElementById(`${page}Page`);
      if (targetPage) {
        targetPage.classList.add('active');
        
        const pageTitles = {
          dashboard: 'Dashboard',
          teachers: 'Guru',
          students: 'Siswa',
          classes: 'Kelas',
          subjects: 'Mata Pelajaran',
          schedules: 'Jadwal',
          attendance: 'Absensi',
          permissions: 'Pengajuan Izin',
          reports: 'Laporan',
          history: 'Riwayat Absensi',
          settings: 'Pengaturan',
          profile: 'Profile'
        };
        
        const topbarTitle = document.getElementById('topbarTitle');
        if (topbarTitle) {
          topbarTitle.textContent = pageTitles[page] || 'Dashboard';
        }

        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active');
        }
      }
    });
  });
}

function setupLogout() {
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', async function() {
      try {
        await api.post('/auth/logout', {});
      } catch (error) {
        
      } finally {
        clearAuth();
        window.location.href = '/login';
      }
    });
  }
}

function setupUserInfo() {
  const user = getUser();
  if (user) {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) {
      userName.textContent = user.full_name;
    }
    
    if (userAvatar) {
      userAvatar.textContent = user.full_name.charAt(0).toUpperCase();
    }
  }
}

function setupDashboard() {
  setupSidebar();
  setupLogout();
  setupUserInfo();
}
