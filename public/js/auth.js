document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const rememberMe = document.getElementById('rememberMe').checked;
      const errorMessage = document.getElementById('errorMessage');
      const loginButton = document.getElementById('loginButton');

      errorMessage.style.display = 'none';
      loginButton.disabled = true;
      loginButton.textContent = 'Memproses...';

      try {
        const response = await api.post('/auth/login', {
          email,
          password,
          remember_me: rememberMe
        });

        setAuth(response.data.token, response.data.user);

        const role = response.data.user.role;
        if (role === 'admin') {
          window.location.href = '/admin/dashboard';
        } else if (role === 'guru') {
          window.location.href = '/guru/dashboard';
        } else if (role === 'siswa') {
          window.location.href = '/siswa/dashboard';
        }
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const fullName = document.getElementById('fullName').value;
      const schoolName = document.getElementById('schoolName').value;
      const email = document.getElementById('email').value;
      const phone = document.getElementById('phone').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorMessage = document.getElementById('errorMessage');
      const registerButton = document.getElementById('registerButton');

      errorMessage.style.display = 'none';

      if (password !== confirmPassword) {
        errorMessage.textContent = 'Konfirmasi password tidak cocok.';
        errorMessage.style.display = 'block';
        return;
      }

      registerButton.disabled = true;
      registerButton.textContent = 'Memproses...';

      try {
        const response = await api.post('/auth/register', {
          full_name: fullName,
          school_name: schoolName,
          email,
          phone,
          password,
          confirm_password: confirmPassword
        });

        setAuth(response.data.token, response.data.user);

        window.location.href = '/admin/dashboard';
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        registerButton.disabled = false;
        registerButton.textContent = 'Daftar Sekarang';
      }
    });
  }

  const forgotPasswordLink = document.getElementById('forgotPassword');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', function(e) {
      e.preventDefault();
      showToast('Silakan hubungi administrator untuk reset password.', 'info');
    });
  }
});
