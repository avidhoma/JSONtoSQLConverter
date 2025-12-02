// backend/routes/db.js
// Handles test connection, store schema, insert rows.
// store credentials securely (not in logs), restrict who can call these endpoints with auth.

const express = require('express');
const router = express.Router();
const { testConnection, createSchemaAndInsert, insertRows } = require('../config/db');

// POST /api/test-connection
router.post('/test-connection', async (req, res) => {
  try {
    const conn = req.body;
    const ok = await testConnection(conn);
    res.json({ ok, message: ok ? 'Connection successful' : 'Failed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/store-schema
router.post('/store-schema', async (req, res) => {
  try {
    const { connection, schema } = req.body;
    const result = await createSchemaAndInsert(connection, schema);
    res.json({ message: 'Schema created and sample data inserted', result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/insert-rows
router.post('/insert-rows', async (req, res) => {
  try {
    const { operations, connection } = req.body;
    const result = await insertRows(connection, operations);
    res.json({ message: 'Insert completed', result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
