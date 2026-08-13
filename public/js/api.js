const API_BASE = '/api';

const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          throw new Error(data.message || 'Sesi berakhir. Silakan login kembali.');
        }
        throw new Error(data.message || 'Terjadi kesalahan.');
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError') {
        throw new Error('Tidak dapat terhubung ke server.');
      }
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
};

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function isAuthenticated() {
  return !!getToken();
}

function getRole() {
  const user = getUser();
  return user ? user.role : null;
}

function redirectBasedOnRole() {
  const role = getRole();
  
  if (!role) {
    window.location.href = '/login';
    return;
  }

  const dashboardMap = {
    admin: '/admin/dashboard',
    guru: '/guru/dashboard',
    siswa: '/siswa/dashboard'
  };

  const target = dashboardMap[role];
  if (target && window.location.pathname !== target) {
    window.location.href = target;
  }
}

function protectPage(allowedRole) {
  if (!isAuthenticated()) {
    window.location.href = '/login';
    return false;
  }

  const role = getRole();
  if (role !== allowedRole) {
    redirectBasedOnRole();
    return false;
  }

  return true;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatDateShort(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(timeString) {
  if (!timeString) return '-';
  return timeString.substring(0, 5);
}

function formatDateTime(dateTimeString) {
  if (!dateTimeString) return '-';
  const date = new Date(dateTimeString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusLabel(status) {
  const labels = {
    present: 'Hadir',
    permission: 'Izin',
    sick: 'Sakit',
    absent: 'Alpa',
    pending: 'Pending',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    active: 'Aktif',
    inactive: 'Nonaktif'
  };
  return labels[status] || status;
}

function statusBadgeClass(status) {
  const classes = {
    present: 'badge-present',
    permission: 'badge-permission',
    sick: 'badge-sick',
    absent: 'badge-absent',
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    active: 'badge-active',
    inactive: 'badge-inactive'
  };
  return classes[status] || '';
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentDayIndonesian() {
  const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
  return days[new Date().getDay()];
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function downloadCSV(data, filename) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
    }
