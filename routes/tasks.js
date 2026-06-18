const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/tasks - ambil semua tugas user (bisa filter status)
router.get('/', auth, async (req, res) => {
  const { status } = req.query; // 'pending', 'completed', atau kosong = semua
  const userId = req.user.id;

  try {
    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    let params = [userId];

    if (status === 'pending' || status === 'completed') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY deadline ASC';
    const [tasks] = await db.query(query, params);
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/tasks/dashboard - data ringkasan untuk dashboard
router.get('/dashboard', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    // Hitung tugas aktif
    const [[{ total_pending }]] = await db.query(
      'SELECT COUNT(*) as total_pending FROM tasks WHERE user_id = ? AND status = "pending"',
      [userId]
    );

    // Hitung semua tugas
    const [[{ total_all }]] = await db.query(
      'SELECT COUNT(*) as total_all FROM tasks WHERE user_id = ?',
      [userId]
    );

    // Hitung selesai
    const [[{ total_done }]] = await db.query(
      'SELECT COUNT(*) as total_done FROM tasks WHERE user_id = ? AND status = "completed"',
      [userId]
    );

    // Deadline terdekat
    const [nearest] = await db.query(
      'SELECT * FROM tasks WHERE user_id = ? AND status = "pending" AND deadline >= NOW() ORDER BY deadline ASC LIMIT 1',
      [userId]
    );

    // 5 tugas mendatang
    const [upcoming] = await db.query(
      'SELECT * FROM tasks WHERE user_id = ? AND status = "pending" ORDER BY deadline ASC LIMIT 5',
      [userId]
    );

    // Progress (% tugas selesai)
    const progress = total_all > 0 ? Math.round((total_done / total_all) * 100) : 0;

    res.json({
      total_pending,
      total_done,
      total_all,
      progress,
      nearest_deadline: nearest[0] || null,
      upcoming_tasks: upcoming
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/tasks - buat tugas baru
router.post('/', auth, async (req, res) => {
  const { judul, mata_kuliah, prioritas, deadline, deskripsi } = req.body;
  const userId = req.user.id;

  if (!judul || !mata_kuliah || !deadline) {
    return res.status(400).json({ message: 'Judul, mata kuliah, dan deadline wajib diisi.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO tasks (user_id, judul, mata_kuliah, prioritas, deadline, deskripsi) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, judul, mata_kuliah, prioritas || 'medium', deadline, deskripsi || '']
    );

    const [[newTask]] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json(newTask);
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// PATCH /api/tasks/:id/status - toggle status pending/completed
router.patch('/:id/status', auth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  if (!['pending', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid.' });
  }

  try {
    const [check] = await db.query('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
    }

    await db.query('UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?', [status, id, userId]);
    res.json({ message: 'Status tugas diperbarui.' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [check] = await db.query('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
    }

    await db.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ message: 'Tugas berhasil dihapus.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
