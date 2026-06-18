const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/ai/rekomendasi - minta rekomendasi AI
router.post('/rekomendasi', auth, async (req, res) => {
  const userId = req.user.id;

  try {
    // Ambil tugas pending user
    const [tasks] = await db.query(
      `SELECT judul, mata_kuliah, prioritas, deadline 
       FROM tasks WHERE user_id = ? AND status = 'pending' 
       ORDER BY deadline ASC LIMIT 10`,
      [userId]
    );

    if (tasks.length === 0) {
      return res.json({
        rekomendasi: 'Kamu tidak punya tugas yang aktif saat ini. Waktu yang tepat untuk istirahat atau belajar materi baru! 🎉'
      });
    }

    // Format tugas untuk prompt
    const taskList = tasks.map((t, i) => {
      const deadline = new Date(t.deadline).toLocaleString('id-ID');
      return `${i + 1}. "${t.judul}" (${t.mata_kuliah}) - Prioritas: ${t.prioritas} - Deadline: ${deadline}`;
    }).join('\n');

    // Panggil Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Kamu adalah asisten akademik. Berikut daftar tugas mahasiswa yang belum selesai:\n\n${taskList}\n\nBerikan rekomendasi singkat (maks 2 kalimat) tentang tugas mana yang harus dikerjakan PALING DAHULU hari ini berdasarkan deadline dan prioritas. Gunakan bahasa Indonesia yang ramah dan motivatif.`
        }]
      })
    });

    const data = await response.json();
    const rekomendasi = data.content?.[0]?.text || 'Fokus pada tugas dengan deadline terdekat terlebih dahulu!';

    res.json({ rekomendasi });
  } catch (err) {
    console.error('AI rekomendasi error:', err);
    // Fallback jika AI error
    res.json({
      rekomendasi: 'Kerjakan tugas dengan deadline paling dekat dan prioritas tinggi terlebih dahulu. Semangat! 💪'
    });
  }
});

module.exports = router;
