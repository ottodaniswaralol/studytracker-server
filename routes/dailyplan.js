const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/daily-plans?tanggal=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  const userId = req.user.id;
  const tanggal = req.query.tanggal || new Date().toISOString().split('T')[0];

  try {
    const [plans] = await db.query(
      'SELECT * FROM daily_plans WHERE user_id = ? AND tanggal = ? ORDER BY created_at ASC',
      [userId, tanggal]
    );
    res.json(plans);
  } catch (err) {
    console.error('Get daily plans error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/daily-plans - tambah aktivitas
router.post('/', auth, async (req, res) => {
  const { aktivitas, tanggal } = req.body;
  const userId = req.user.id;
  const tgl = tanggal || new Date().toISOString().split('T')[0];

  if (!aktivitas) {
    return res.status(400).json({ message: 'Aktivitas wajib diisi.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO daily_plans (user_id, aktivitas, tanggal) VALUES (?, ?, ?)',
      [userId, aktivitas, tgl]
    );
    const [[plan]] = await db.query('SELECT * FROM daily_plans WHERE id = ?', [result.insertId]);
    res.status(201).json(plan);
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// PATCH /api/daily-plans/:id - toggle is_done
router.patch('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { is_done } = req.body;
  const userId = req.user.id;

  try {
    const [check] = await db.query('SELECT id FROM daily_plans WHERE id = ? AND user_id = ?', [id, userId]);
    if (check.length === 0) return res.status(404).json({ message: 'Aktivitas tidak ditemukan.' });

    await db.query('UPDATE daily_plans SET is_done = ? WHERE id = ?', [is_done ? 1 : 0, id]);
    res.json({ message: 'Status aktivitas diperbarui.' });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/daily-plans/:id
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [check] = await db.query('SELECT id FROM daily_plans WHERE id = ? AND user_id = ?', [id, userId]);
    if (check.length === 0) return res.status(404).json({ message: 'Aktivitas tidak ditemukan.' });

    await db.query('DELETE FROM daily_plans WHERE id = ? AND user_id = ?', [id, userId]);
    res.json({ message: 'Aktivitas berhasil dihapus.' });
  } catch (err) {
    console.error('Delete plan error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
