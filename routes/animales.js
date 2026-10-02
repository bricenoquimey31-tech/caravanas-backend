const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requiereAuth);

/** Alta de un animal nuevo en el establecimiento del usuario logueado. */
router.post('/', async (req, res) => {
    const { especie, sexo, fechaNacimiento, raza, peso, observaciones } = req.body;
    if (!especie) return res.status(400).json({ ok: false, error: 'La especie es obligatoria' });
    const id = crypto.randomUUID();
    try {
        await pool.query(
            `INSERT INTO animales (id, establecimiento_id, especie, sexo, fecha_nacimiento, raza, peso, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.establecimientoId, especie, sexo || null, fechaNacimiento || null, raza || null, peso || null, observaciones || null]
        );
        const [rows] = await pool.query('SELECT * FROM animales WHERE id = ?', [id]);
        res.json({ ok: true, animal: rows[0] });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/** Actualiza campos del animal (usado para cambiar estado u otros datos). Verifica dueño. */
router.patch('/:id', async (req, res) => {
    const [own] = await pool.query('SELECT establecimiento_id FROM animales WHERE id = ?', [req.params.id]);
    if (!own[0]) return res.status(404).json({ ok: false, error: 'Animal no encontrado' });
    if (own[0].establecimiento_id !== req.establecimientoId) return res.status(403).json({ ok: false, error: 'No autorizado' });

    const campos = ['sexo', 'fechaNacimiento', 'raza', 'peso', 'estado', 'observaciones'];
    const columnas = { sexo: 'sexo', fechaNacimiento: 'fecha_nacimiento', raza: 'raza', peso: 'peso', estado: 'estado', observaciones: 'observaciones' };
    const sets = [];
    const valores = [];
    campos.forEach(c => {
        if (req.body[c] !== undefined) { sets.push(`${columnas[c]} = ?`); valores.push(req.body[c]); }
    });
    if (!sets.length) return res.status(400).json({ ok: false, error: 'Nada para actualizar' });
    sets.push('actualizado_en = CURRENT_TIMESTAMP');
    valores.push(req.params.id);

    await pool.query(`UPDATE animales SET ${sets.join(', ')} WHERE id = ?`, valores);
    const [rows] = await pool.query('SELECT * FROM animales WHERE id = ?', [req.params.id]);
    res.json({ ok: true, animal: rows[0] });
});

/** Búsqueda de animales del establecimiento del usuario logueado (punto 10). */
router.get('/', async (req, res) => {
    const { especie, raza, estado, texto } = req.query;
    const condiciones = ['establecimiento_id = ?'];
    const valores = [req.establecimientoId];

    if (especie) { condiciones.push('especie = ?'); valores.push(especie); }
    if (raza) { condiciones.push('raza LIKE ?'); valores.push(`%${raza}%`); }
    if (estado) { condiciones.push('estado = ?'); valores.push(estado); }
    if (texto) { condiciones.push('(id LIKE ? OR raza LIKE ?)'); valores.push(`%${texto}%`, `%${texto}%`); }

    const [rows] = await pool.query(
        `SELECT * FROM animales WHERE ${condiciones.join(' AND ')} ORDER BY fecha_registro DESC`,
        valores
    );
    res.json({ ok: true, animales: rows });
});

router.get('/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM animales WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Animal no encontrado' });
    res.json({ ok: true, animal: rows[0] });
});

/** Ficha completa: animal + caravana asociada + historial sanitario (flujo NFC -> ficha). */
router.get('/:id/ficha', async (req, res) => {
    const [animalRows] = await pool.query('SELECT * FROM animales WHERE id = ?', [req.params.id]);
    if (!animalRows[0]) return res.status(404).json({ ok: false, error: 'Animal no encontrado' });

    const [caravanaRows] = await pool.query('SELECT * FROM caravanas WHERE animal_id = ?', [req.params.id]);
    const [historialRows] = await pool.query(
        'SELECT * FROM registros_sanitarios WHERE animal_id = ? ORDER BY fecha DESC',
        [req.params.id]
    );

    res.json({ ok: true, animal: animalRows[0], caravana: caravanaRows[0] || null, historial: historialRows });
});

module.exports = router;
