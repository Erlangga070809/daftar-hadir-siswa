const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^[0-9+\-\s]{8,20}$/;
  return phoneRegex.test(phone);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return `${fieldName} wajib diisi`;
  }
  return null;
};

const validateRegister = (data) => {
  const errors = [];

  const fullNameError = validateRequired(data.full_name, 'Nama lengkap');
  if (fullNameError) errors.push(fullNameError);

  const schoolNameError = validateRequired(data.school_name, 'Nama sekolah');
  if (schoolNameError) errors.push(schoolNameError);

  const emailError = validateRequired(data.email, 'Email');
  if (emailError) {
    errors.push(emailError);
  } else if (!validateEmail(data.email)) {
    errors.push('Format email tidak valid');
  }

  const phoneError = validateRequired(data.phone, 'Nomor HP');
  if (phoneError) {
    errors.push(phoneError);
  } else if (!validatePhone(data.phone)) {
    errors.push('Format nomor HP tidak valid');
  }

  if (!validatePassword(data.password)) {
    errors.push('Password minimal 6 karakter');
  }

  if (data.password !== data.confirm_password) {
    errors.push('Konfirmasi password tidak cocok');
  }

  return errors;
};

const validateLogin = (data) => {
  const errors = [];

  const emailError = validateRequired(data.email, 'Email');
  if (emailError) {
    errors.push(emailError);
  } else if (!validateEmail(data.email)) {
    errors.push('Format email tidak valid');
  }

  const passwordError = validateRequired(data.password, 'Password');
  if (passwordError) errors.push(passwordError);

  return errors;
};

const validateTeacher = (data) => {
  const errors = [];

  const fullNameError = validateRequired(data.full_name, 'Nama lengkap');
  if (fullNameError) errors.push(fullNameError);

  const emailError = validateRequired(data.email, 'Email');
  if (emailError) {
    errors.push(emailError);
  } else if (!validateEmail(data.email)) {
    errors.push('Format email tidak valid');
  }

  if (!validatePassword(data.password)) {
    errors.push('Password minimal 6 karakter');
  }

  return errors;
};

const validateStudent = (data) => {
  const errors = [];

  const fullNameError = validateRequired(data.full_name, 'Nama lengkap');
  if (fullNameError) errors.push(fullNameError);

  const nisError = validateRequired(data.nis, 'NIS');
  if (nisError) errors.push(nisError);

  const classError = validateRequired(data.class_id, 'Kelas');
  if (classError) errors.push(classError);

  if (!validatePassword(data.password)) {
    errors.push('Password minimal 6 karakter');
  }

  return errors;
};

const validateClass = (data) => {
  const errors = [];

  const nameError = validateRequired(data.name, 'Nama kelas');
  if (nameError) errors.push(nameError);

  return errors;
};

const validateSubject = (data) => {
  const errors = [];

  const nameError = validateRequired(data.name, 'Nama mata pelajaran');
  if (nameError) errors.push(nameError);

  return errors;
};

const validateSchedule = (data) => {
  const errors = [];

  const dayError = validateRequired(data.day, 'Hari');
  if (dayError) errors.push(dayError);

  const startTimeError = validateRequired(data.start_time, 'Jam mulai');
  if (startTimeError) errors.push(startTimeError);

  const endTimeError = validateRequired(data.end_time, 'Jam selesai');
  if (endTimeError) errors.push(endTimeError);

  const classError = validateRequired(data.class_id, 'Kelas');
  if (classError) errors.push(classError);

  const teacherError = validateRequired(data.teacher_id, 'Guru');
  if (teacherError) errors.push(teacherError);

  const subjectError = validateRequired(data.subject_id, 'Mata pelajaran');
  if (subjectError) errors.push(subjectError);

  return errors;
};

const validateAttendance = (data) => {
  const errors = [];

  const classError = validateRequired(data.class_id, 'Kelas');
  if (classError) errors.push(classError);

  const subjectError = validateRequired(data.subject_id, 'Mata pelajaran');
  if (subjectError) errors.push(subjectError);

  const dateError = validateRequired(data.date, 'Tanggal');
  if (dateError) errors.push(dateError);

  if (!data.students || !Array.isArray(data.students) || data.students.length === 0) {
    errors.push('Data siswa wajib diisi');
  }

  return errors;
};

const validatePermissionRequest = (data) => {
  const errors = [];

  const dateError = validateRequired(data.date, 'Tanggal');
  if (dateError) errors.push(dateError);

  const typeError = validateRequired(data.type, 'Jenis izin');
  if (typeError) errors.push(typeError);

  const reasonError = validateRequired(data.reason, 'Alasan');
  if (reasonError) errors.push(reasonError);

  return errors;
};

module.exports = {
  validateEmail,
  validatePhone,
  validatePassword,
  validateRequired,
  validateRegister,
  validateLogin,
  validateTeacher,
  validateStudent,
  validateClass,
  validateSubject,
  validateSchedule,
  validateAttendance,
  validatePermissionRequest
};
