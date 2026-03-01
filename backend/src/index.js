require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`KetoTap API running on port ${PORT}`);
});
