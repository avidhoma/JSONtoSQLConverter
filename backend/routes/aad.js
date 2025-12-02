// backend/routes/aad.js
// Implements Authorization Code Flow, Device Code Flow and helper endpoints.
// Requires environment variables (see .env.example)

const express = require('express');
const fetch = require('node-fetch');
const qs = require('querystring');

const router = express.Router();

const {
  AAD_CLIENT_ID, AAD_CLIENT_SECRET, AAD_TENANT_ID, AAD_REDIRECT_URI
} = process.env;

const authority = `https://login.microsoftonline.com/${AAD_TENANT_ID}/oauth2/v2.0`;

// 1) Authorization Code Flow: redirect user to Microsoft login
router.get('/start', (req, res) => {
  const scope = encodeURIComponent('openid profile offline_access User.Read');
  const state = Date.now();
  const url = `${authority}/authorize?client_id=${AAD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(AAD_REDIRECT_URI)}&response_mode=query&scope=${scope}&state=${state}`;
  res.redirect(url);
});

// 1b) Callback: exchange code for tokens
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');
    const tokenUrl = `${authority}/token`;
    const body = qs.stringify({
      client_id: AAD_CLIENT_ID,
      scope: 'openid profile offline_access User.Read',
      code,
      redirect_uri: AAD_REDIRECT_URI,
      grant_type: 'authorization_code',
      client_secret: AAD_CLIENT_SECRET
    });
    const r = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const j = await r.json();
    if (j.error) return res.status(400).json(j);
    // You may store j.access_token server-side in session or DB
    // For demo, show success and token (not recommended in prod)
    res.send(`<h2>Signed in</h2><pre>${JSON.stringify(j,null,2)}</pre><p>Copy access_token back to the frontend or implement server session storage.</p>`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2) Device Code Flow: request device code then poll
router.post('/device', async (req, res) => {
  try {
    const deviceUrl = `${authority}/devicecode`;
    const params = qs.stringify({ client_id: process.env.AAD_CLIENT_ID, scope: 'openid profile offline_access User.Read' });
    const r = await fetch(`${deviceUrl}?${params}`, { method: 'POST' });
    const j = await r.json();
    if (j.error) return res.status(400).json(j);
    // The server will need to poll token endpoint for user_code completion; for demo we just return instructions.
    // Implement polling in a background job for real scenarios.
    res.json(j); // contains user_code, verification_uri, device_code, expires_in, interval
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
