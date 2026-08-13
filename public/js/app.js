document.addEventListener('DOMContentLoaded', function() {
  const user = getUser();
  
  if (user) {
    const role = getRole();
    
    if (role === 'admin') {
      window.location.href = '/admin/dashboard';
    } else if (role === 'guru') {
      window.location.href = '/guru/dashboard';
    } else if (role === 'siswa') {
      window.location.href = '/siswa/dashboard';
    }
  }
});
