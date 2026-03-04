require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/targets', require('./routes/targets'));
app.use('/api/foods', require('./routes/foods'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/presets', require('./routes/presets'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'KetoTap' }));

// Serve frontend in production
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`KetoTap API running on port ${PORT}`);
});
