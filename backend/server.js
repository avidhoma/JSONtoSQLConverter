// backend/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const dbRoutes = require('./routes/db');
const aadRoutes = require('./routes/aad');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));

// Serve frontend static if you place frontend build in /frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api', dbRoutes);
app.use('/auth/aad', aadRoutes);

// Fallback to serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
