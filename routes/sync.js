const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

/**
 * Endpoint único de sincronización offline-first.
 *
 * El celular manda TODO lo que tiene pendiente (creado o modificado sin
 * conexión) en un solo request, en el orden en que las tablas dependen
 * entre sí (usuarios -> establecimientos -> animales -> caravanas ->
 * registros_sanitarios). Cada registro se procesa con "upsert" (INSERT
 * ... ON DUPLICATE KEY UPDATE) usando el mismo UUID generado en el
 * celular, así no hace falta remapear ids.
 *
 * Si un registro puntual viola una restricción real de negocio (por
 * ejemplo, un identificador_nfc que ya existe con OTRO id, es decir, un
 * duplicado real), no se aborta toda la sincronización: ese id se reporta
 * en "errores" y el resto sigue subiendo. Así el usuario no pierde todo
 * el trabajo del día por un solo conflicto.
 */
router.post('/', async (req, res) => {
    const { usuarios = [], establecimientos = [], animales = [], caravanas = [], registrosSanitarios = [] } = req.body;

    const idsConfirmados = [];
    const errores = [];
    const conn = await pool.getConnection();

    try {
        for (const u of usuarios) {
            try {
                await conn.query(
                    `INSERT INTO usuarios (id, nombre_completo, email, contrasena_hash, fecha_registro)
                     VALUES (?, ?, ?, ?, FROM_UNIXTIME(?/1000))
                     ON DUPLICATE KEY UPDATE nombre_completo = VALUES(nombre_completo)`,
                    [u.id, u.nombreCompleto, u.email, u.contrasenaHash, u.fechaRegistro]
                );
                idsConfirmados.push(u.id);
            } catch (e) {
                errores.push({ id: u.id, motivo: mensajeError(e) });
            }
        }

        for (const e0 of establecimientos) {
            try {
                await conn.query(
                    `INSERT INTO establecimientos (id, usuario_id, nombre_establecimiento, ubicacion)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE nombre_establecimiento = VALUES(nombre_establecimiento), ubicacion = VALUES(ubicacion)`,
                    [e0.id, e0.usuarioId, e0.nombreEstablecimiento, e0.ubicacion]
                );
                idsConfirmados.push(e0.id);
            } catch (e) {
                errores.push({ id: e0.id, motivo: mensajeError(e) });
            }
        }

        for (const a of animales) {
            try {
                await conn.query(
                    `INSERT INTO animales
                        (id, establecimiento_id, especie, sexo, fecha_nacimiento, raza, peso, estado, observaciones, fecha_registro, actualizado_en)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?/1000), FROM_UNIXTIME(?/1000))
                     ON DUPLICATE KEY UPDATE
                        especie = VALUES(especie), sexo = VALUES(sexo), fecha_nacimiento = VALUES(fecha_nacimiento),
                        raza = VALUES(raza), peso = VALUES(peso), estado = VALUES(estado),
                        observaciones = VALUES(observaciones), actualizado_en = VALUES(actualizado_en)`,
                    [a.id, a.establecimientoId, a.especie, a.sexo, a.fechaNacimiento, a.raza, a.peso, a.estado, a.observaciones, a.fechaRegistro, a.actualizadoEn]
                );
                idsConfirmados.push(a.id);
            } catch (e) {
                errores.push({ id: a.id, motivo: mensajeError(e) });
            }
        }

        for (const c of caravanas) {
            try {
                await conn.query(
                    `INSERT INTO caravanas (id, identificador_nfc, animal_id, fecha_registro, activa)
                     VALUES (?, ?, ?, FROM_UNIXTIME(?/1000), ?)
                     ON DUPLICATE KEY UPDATE animal_id = VALUES(animal_id), activa = VALUES(activa)`,
                    [c.id, c.identificadorNfc, c.animalId, c.fechaRegistro, c.activa]
                );
                idsConfirmados.push(c.id);
            } catch (e) {
                // Ej: identificador_nfc duplicado con un id distinto -> conflicto real, se informa y se sigue.
                errores.push({ id: c.id, motivo: mensajeError(e) });
            }
        }

        for (const r of registrosSanitarios) {
            try {
                await conn.query(
                    `INSERT INTO registros_sanitarios (id, animal_id, tipo_registro, descripcion, fecha, observaciones)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), observaciones = VALUES(observaciones)`,
                    [r.id, r.animalId, r.tipoRegistro, r.descripcion, r.fecha, r.observaciones]
                );
                idsConfirmados.push(r.id);
            } catch (e) {
                errores.push({ id: r.id, motivo: mensajeError(e) });
            }
        }

        res.json({ ok: true, idsConfirmados, errores });
    } catch (e) {
        res.status(500).json({ ok: false, idsConfirmados: [], errores: [{ id: '-', motivo: e.message }] });
    } finally {
        conn.release();
    }
});

function mensajeError(e) {
    if (e.code === 'ER_DUP_ENTRY') return 'Ese identificador ya existe asociado a otro registro';
    return e.message;
}

module.exports = router;
