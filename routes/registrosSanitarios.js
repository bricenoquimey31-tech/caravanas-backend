const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requiereAuth);

/** Agrega una vacuna o tratamiento al historial de un animal (verifica dueño). */
router.post('/animal/:animalId', async (req, res) => {
    const { tipoRegistro, descripcion, fecha, observaciones } = req.body;
    if (!tipoRegistro || !descripcion || !fecha) {
        return res.status(400).json({ ok: false, error: 'Faltan datos obligatorios' });
    }
    const [own] = await pool.query('SELECT establecimiento_id FROM animales WHERE id = ?', [req.params.animalId]);
    if (!own[0]) return res.status(404).json({ ok: false, error: 'Animal no encontrado' });
    if (own[0].establecimiento_id !== req.establecimientoId) return res.status(403).json({ ok: false, error: 'No autorizado' });

    const id = crypto.randomUUID();
    await pool.query(
        'INSERT INTO registros_sanitarios (id, animal_id, tipo_registro, descripcion, fecha, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
        [id, req.params.animalId, tipoRegistro, descripcion, fecha, observaciones || null]
    );
    const [rows] = await pool.query('SELECT * FROM registros_sanitarios WHERE animal_id = ? ORDER BY fecha DESC', [req.params.animalId]);
    res.json({ ok: true, registros: rows });
});

router.get('/animal/:animalId', async (req, res) => {
    const [rows] = await pool.query(
        'SELECT * FROM registros_sanitarios WHERE animal_id = ? ORDER BY fecha DESC',
        [req.params.animalId]
    );
    res.json({ ok: true, registros: rows });
});

module.exports = router;
