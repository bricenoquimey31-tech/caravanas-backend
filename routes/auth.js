const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

/** Registro: crea el usuario y su único establecimiento, y devuelve token. */
router.post('/register', async (req, res) => {
    const { nombreCompleto, email, contrasena, nombreEstablecimiento, ubicacion } = req.body;
    if (!nombreCompleto || !email || !contrasena || !nombreEstablecimiento) {
        return res.status(400).json({ ok: false, error: 'Faltan datos obligatorios' });
    }
    try {
        const [existente] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existente[0]) return res.json({ ok: false, error: 'Ese email ya está registrado' });

        const usuarioId = crypto.randomUUID();
        const establecimientoId = crypto.randomUUID();
        const hash = await bcrypt.hash(contrasena, 10);

        await pool.query(
            'INSERT INTO usuarios (id, nombre_completo, email, contrasena_hash) VALUES (?, ?, ?, ?)',
            [usuarioId, nombreCompleto, email, hash]
        );
        await pool.query(
            'INSERT INTO establecimientos (id, usuario_id, nombre_establecimiento, ubicacion) VALUES (?, ?, ?, ?)',
            [establecimientoId, usuarioId, nombreEstablecimiento, ubicacion || null]
        );

        const token = jwt.sign({ usuarioId, establecimientoId }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({
            ok: true, token,
            usuario: { id: usuarioId, nombre_completo: nombreCompleto, email },
            establecimiento: { id: establecimientoId, nombre_establecimiento: nombreEstablecimiento, ubicacion }
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/**
 * Login remoto (opcional, útil si el usuario cambia de celular).
 * El login "de todos los días" en la app ocurre offline contra Room;
 * este endpoint sirve para validar credenciales contra el servidor
 * cuando hace falta (ej: nuevo dispositivo).
 */
router.post('/login', async (req, res) => {
    const { email, contrasena } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        const usuario = rows[0];
        if (!usuario) return res.json({ ok: false, error: 'Usuario no encontrado' });

        const coincide = await bcrypt.compare(contrasena, usuario.contrasena_hash);
        if (!coincide) return res.json({ ok: false, error: 'Contraseña incorrecta' });

        const [estRows] = await pool.query('SELECT * FROM establecimientos WHERE usuario_id = ?', [usuario.id]);
        const establecimiento = estRows[0] || null;

        const token = jwt.sign(
            { usuarioId: usuario.id, establecimientoId: establecimiento?.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ ok: true, token, usuario, establecimiento });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

module.exports = router;
