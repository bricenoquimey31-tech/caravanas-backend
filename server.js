require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const animalesRoutes = require('./routes/animales');
const caravanasRoutes = require('./routes/caravanas');
const registrosRoutes = require('./routes/registrosSanitarios');
const establecimientosRoutes = require('./routes/establecimientos');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/animales', animalesRoutes);
app.use('/api/caravanas', caravanasRoutes);
app.use('/api/registros-sanitarios', registrosRoutes);
app.use('/api/establecimientos', establecimientosRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Caravanas Smart API escuchando en el puerto ${PORT}`));
