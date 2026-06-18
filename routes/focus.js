const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/focus - simpan sesi fokus yang selesai
router.post('/', auth, async (req, res) => {
  const { task_id, tipe, durasi_menit, selesai } = req.body;
  const userId = req.user.id;

  if (!durasi_menit) {
    return res.status(400).json({ message: 'Durasi wajib diisi.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO focus_sessions (user_id, task_id, tipe, durasi_menit, selesai) VALUES (?, ?, ?, ?, ?)',
      [userId, task_id || null, tipe || 'pomodoro', durasi_menit, selesai ? 1 : 0]
    );
    res.status(201).json({ message: 'Sesi fokus disimpan.', id: result.insertId });
  } catch (err) {
    console.error('Save focus error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/focus/stats - statistik untuk halaman statistik
router.get('/stats', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    // Total jam belajar minggu ini
    const [[weekStats]] = await db.query(`
      SELECT 
        COALESCE(SUM(durasi_menit), 0) as total_menit_minggu
      FROM focus_sessions 
      WHERE user_id = ? 
        AND tipe = 'pomodoro' 
        AND selesai = 1
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [userId]);

    // Total tugas selesai bulan ini vs bulan lalu (untuk %)
    const [[thisMonth]] = await db.query(`
      SELECT COUNT(*) as total FROM tasks 
      WHERE user_id = ? AND status = 'completed' 
        AND MONTH(updated_at) = MONTH(NOW()) AND YEAR(updated_at) = YEAR(NOW())
    `, [userId]);

    const [[lastMonth]] = await db.query(`
      SELECT COUNT(*) as total FROM tasks 
      WHERE user_id = ? AND status = 'completed'
        AND MONTH(updated_at) = MONTH(NOW() - INTERVAL 1 MONTH) 
        AND YEAR(updated_at) = YEAR(NOW() - INTERVAL 1 MONTH)
    `, [userId]);

    const totalSelesai = thisMonth.total;
    const pct = lastMonth.total > 0
      ? Math.round(((thisMonth.total - lastMonth.total) / lastMonth.total) * 100)
      : (thisMonth.total > 0 ? 100 : 0);

    // Rata-rata fokus (% sesi pomodoro yang selesai)
    const [[focusStats]] = await db.query(`
      SELECT 
        COUNT(*) as total_sesi,
        SUM(selesai) as sesi_selesai
      FROM focus_sessions
      WHERE user_id = ? AND tipe = 'pomodoro'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [userId]);

    const avgFokus = focusStats.total_sesi > 0
      ? Math.round((focusStats.sesi_selesai / focusStats.total_sesi) * 100)
      : 0;

    let kategoriFokus = 'Kurang';
    if (avgFokus >= 85) kategoriFokus = 'Sangat Baik';
    else if (avgFokus >= 70) kategoriFokus = 'Baik';
    else if (avgFokus >= 50) kategoriFokus = 'Cukup';

    // Grafik 7 hari terakhir
    const [chartData] = await db.query(`
      SELECT 
        DATE(created_at) as tanggal,
        ROUND(SUM(durasi_menit) / 60, 1) as jam
      FROM focus_sessions
      WHERE user_id = ? AND tipe = 'pomodoro' AND selesai = 1
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY tanggal ASC
    `, [userId]);

    // Buat array 7 hari (isi 0 jika tidak ada data)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = chartData.find(r => r.tanggal && r.tanggal.toISOString().split('T')[0] === dateStr);
      days.push({ tanggal: dateStr, jam: found ? parseFloat(found.jam) : 0 });
    }

    res.json({
      total_tugas_selesai: totalSelesai,
      persen_kenaikan: pct,
      total_jam_minggu: Math.round(weekStats.total_menit_minggu / 60 * 10) / 10,
      rata_rata_fokus: avgFokus,
      kategori_fokus: kategoriFokus,
      chart_7_hari: days
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
