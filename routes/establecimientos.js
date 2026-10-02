const express = require('express');
const pool = require('../db');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requiereAuth);

router.get('/mio', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM establecimientos WHERE usuario_id = ?', [req.usuarioId]);
    res.json({ ok: true, establecimiento: rows[0] || null });
});

module.exports = router;
