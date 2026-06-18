const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, nama_lengkap: user.nama_lengkap },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        nama_lengkap: user.nama_lengkap,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nama_lengkap, email, password } = req.body;

  if (!nama_lengkap || !email || !password) {
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password minimal 8 karakter.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email sudah terdaftar.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (nama_lengkap, email, password_hash) VALUES (?, ?, ?)',
      [nama_lengkap, email, hash]
    );

    res.status(201).json({ message: 'Registrasi berhasil. Silakan login.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/auth/check-email  (untuk lupa password - validasi email ada)
router.post('/check-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email wajib diisi.' });
  }

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Email tidak ditemukan di database.' });
    }

    res.json({ valid: true, message: 'Email valid. Silakan reset password.' });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, new_password } = req.body;

  if (!email || !new_password) {
    return res.status(400).json({ message: 'Email dan password baru wajib diisi.' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ message: 'Password minimal 8 karakter.' });
  }

  try {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Email tidak ditemukan.' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, email]);

    res.json({ message: 'Password berhasil direset. Silakan login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
