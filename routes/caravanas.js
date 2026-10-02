const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requiereAuth);

/** Genera un código corto y lo asocia a un animal del establecimiento logueado. */
router.post('/', async (req, res) => {
    const { animalId } = req.body;
    if (!animalId) return res.status(400).json({ ok: false, error: 'Falta animalId' });

    const [own] = await pool.query('SELECT establecimiento_id FROM animales WHERE id = ?', [animalId]);
    if (!own[0]) return res.status(404).json({ ok: false, error: 'Animal no encontrado' });
    if (own[0].establecimiento_id !== req.establecimientoId) return res.status(403).json({ ok: false, error: 'No autorizado' });

    const [yaTiene] = await pool.query('SELECT id FROM caravanas WHERE animal_id = ?', [animalId]);
    if (yaTiene[0]) return res.json({ ok: false, error: 'Ese animal ya tiene una caravana asociada' });

    let identificador;
    let libre = false;
    while (!libre) {
        identificador = crypto.randomBytes(4).toString('hex').toUpperCase();
        const [existe] = await pool.query('SELECT id FROM caravanas WHERE identificador_nfc = ?', [identificador]);
        libre = !existe[0];
    }

    const id = crypto.randomUUID();
    await pool.query(
        'INSERT INTO caravanas (id, identificador_nfc, animal_id) VALUES (?, ?, ?)',
        [id, identificador, animalId]
    );
    res.json({ ok: true, caravana: { id, identificador_nfc: identificador, animal_id: animalId } });
});

/** Flujo NFC -> Caravana -> Animal (puntos 1 y 5 del análisis). Solo dentro del propio establecimiento. */
router.get('/nfc/:identificador', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM caravanas WHERE identificador_nfc = ?', [req.params.identificador]);
    const caravana = rows[0];

    if (!caravana) {
        return res.json({ ok: true, encontrada: false, mensaje: 'Esta caravana todavía no está asociada a ningún animal' });
    }
    if (!caravana.animal_id) {
        return res.json({ ok: true, encontrada: true, caravanaLibre: true, animal: null });
    }

    const [animalRows] = await pool.query('SELECT * FROM animales WHERE id = ?', [caravana.animal_id]);
    const animal = animalRows[0];
    if (!animal || animal.establecimiento_id !== req.establecimientoId) {
        return res.json({ ok: true, encontrada: false, mensaje: 'Esta caravana no pertenece a tu establecimiento' });
    }
    res.json({ ok: true, encontrada: true, caravanaLibre: false, caravana, animal });
});

module.exports = router;
