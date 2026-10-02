const jwt = require('jsonwebtoken');

/** Protege rutas que requieren estar logueado. El token viaja en el header Authorization: Bearer <token> */
function requiereAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ ok: false, error: 'Falta token de autenticación' });

    const token = header.replace('Bearer ', '');
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.usuarioId = payload.usuarioId;
        req.establecimientoId = payload.establecimientoId;
        next();
    } catch (e) {
        return res.status(401).json({ ok: false, error: 'Token inválido o vencido' });
    }
}

module.exports = { requiereAuth };
