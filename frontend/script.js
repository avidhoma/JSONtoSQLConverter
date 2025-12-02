// frontend/script.js
// Client-side app. The frontend expects backend endpoints at /api/* (see backend/server.js).
// NOTE: For production protect all secrets on server side.

(() => {
  // Helpers
  const $ = id => document.getElementById(id);
  const el = (t, props={}) => Object.assign(document.createElement(t), props);

  // DOM
  const optPaste = $('opt-paste'), optApi = $('opt-api');
  const pasteArea = $('paste-area'), apiArea = $('api-area');
  const jsonInput = $('json-input'), analyzeBtn = $('analyze-btn'), clearBtn = $('clear-btn');
  const apiUrl = $('api-url'), fetchApiBtn = $('fetch-api-btn'), apiAuthType = $('api-auth-type');
  const tokenRow = $('token-row'), aadRow = $('aad-row'), bearerToken = $('bearer-token');
  const aadAuthCodeBtn = $('aad-auth-code'), aadDeviceBtn = $('aad-device'), aadPasteBtn = $('aad-paste-token'), aadPastedToken = $('aad-pasted-token');
  const apiStatus = $('api-status');

  const step3 = $('step3'), step4 = $('step4'), step5 = $('step5'), step6 = $('step6');
  const schemaInfo = $('schema-info'), tableViz = $('table-visualization');

  const modeRadios = document.getElementsByName('mode');
  const generatePanel = $('generate-panel'), storePanel = $('store-panel');
  const sqlDialect = $('sql-dialect'), generateSqlBtn = $('generate-sql-btn'), downloadSqlBtn = $('download-sql-btn');
  const createSqlPre = $('create-sql'), insertSqlPre = $('insert-sql');

  const dbDialect = $('db-dialect'), dbHost = $('db-host'), dbPort = $('db-port'), dbName = $('db-name'), dbUser = $('db-user'), dbPass = $('db-pass');
  const testConnBtn = $('test-conn-btn'), storeDbBtn = $('store-db-btn'), dbConnStatus = $('db-conn-status');

  const insertControls = $('insert-controls'), execInsertBtn = $('execute-insert-btn'), downloadCsvBtn = $('download-csv-btn'), insertStatus = $('insert-status');

  // State
  const state = { jsonData: null, schema: null };

  // Input toggle
  optPaste.addEventListener('click', () => { optPaste.classList.add('active'); optApi.classList.remove('active'); pasteArea.style.display = 'block'; apiArea.style.display = 'none'; });
  optApi.addEventListener('click', () => { optApi.classList.add('active'); optPaste.classList.remove('active'); pasteArea.style.display = 'none'; apiArea.style.display = 'block'; });

  // Auth type toggle
  apiAuthType.addEventListener('change', () => {
    const v = apiAuthType.value; tokenRow.style.display = v === 'token' ? 'block' : 'none'; aadRow.style.display = v === 'aad' ? 'block' : 'none';
  });

  // Analyze JSON
  jsonInput.addEventListener('input', () => analyzeBtn.disabled = !jsonInput.value.trim());
  analyzeBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(jsonInput.value.trim());
      state.jsonData = parsed;
      const schema = inferSchema(parsed);
      state.schema = schema;
      renderSchema(schema); renderTables(schema);
      step3.style.display = step4.style.display = step5.style.display = step6.style.display = 'block';
    } catch (e) { alert('Invalid JSON: ' + e.message); }
  });

  clearBtn.addEventListener('click', () => { jsonInput.value = ''; analyzeBtn.disabled = true; step3.style.display = step4.style.display = step5.style.display = step6.style.display = 'none'; });

  // Fetch API
  fetchApiBtn.addEventListener('click', async () => {
    const url = apiUrl.value.trim(); if (!url) return alert('Enter API URL');
    apiStatus.textContent = 'Fetching...';
    try {
      const headers = {};
      if (apiAuthType.value === 'token' && bearerToken.value.trim()) headers['Authorization'] = 'Bearer ' + bearerToken.value.trim();
      if (apiAuthType.value === 'aad' && aadPastedToken.value.trim()) headers['Authorization'] = 'Bearer ' + aadPastedToken.value.trim();
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.jsonData = data;
      const schema = inferSchema(data);
      state.schema = schema;
      renderSchema(schema); renderTables(schema);
      step3.style.display = step4.style.display = step5.style.display = step6.style.display = 'block';
      apiStatus.innerHTML = '<span class="success">Fetched OK</span>';
    } catch (err) { apiStatus.innerHTML = '<span class="error">Fetch error: ' + err.message + '</span>'; }
  });

  // AAD flows (Auth Code opens backend /auth/aad/start)
  aadAuthCodeBtn.addEventListener('click', () => {
    window.location.href = '/auth/aad/start'; // backend will redirect to MS login
  });

  // Device code flow - backend will return message with instructions
  aadDeviceBtn.addEventListener('click', async () => {
    try {
      const r = await fetch('/auth/aad/device', { method: 'POST' });
      const j = await r.json();
      if (r.ok) {
        alert('Open: ' + j.verification_uri + ' and enter code: ' + j.user_code + '\nThe server is polling. Wait for success.');
      } else alert('Device flow error: ' + (j.message || r.status));
    } catch (e) { alert('Error: ' + e.message); }
  });

  // Paste token option
  aadPasteBtn.addEventListener('click', () => {
    aadPastedToken.style.display = 'block';
    alert('Paste a valid AAD access_token into the input and then Fetch the API using AAD option.');
  });

  // Mode toggle (generate/store)
  Array.from(modeRadios).forEach(r => r.addEventListener('change', () => {
    const v = document.querySelector('input[name="mode"]:checked').value;
    generatePanel.style.display = v === 'generate' ? 'block' : 'none';
    storePanel.style.display = v === 'store' ? 'block' : 'none';
  }));

  // SQL generation
  generateSqlBtn.addEventListener('click', () => {
    if (!state.schema) return alert('Analyze JSON first');
    const dialect = sqlDialect.value;
    const { create, insert } = generateSql(state.schema, dialect);
    createSqlPre.textContent = create;
    insertSqlPre.textContent = insert;
  });

  downloadSqlBtn.addEventListener('click', () => {
    const content = createSqlPre.textContent + '\n\n' + insertSqlPre.textContent;
    const blob = new Blob([content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'schema.sql'; a.click(); URL.revokeObjectURL(url);
  });

  // Test connection
  testConnBtn.addEventListener('click', async () => {
    const conn = collectConn(); if (!conn) return;
    dbConnStatus.textContent = 'Testing...';
    try {
      const res = await fetch('/api/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conn) });
      const j = await res.json();
      dbConnStatus.innerHTML = res.ok ? '<span class="success">OK</span>' : '<span class="error">' + (j.message || 'Failed') + '</span>';
    } catch (e) { dbConnStatus.innerHTML = '<span class="error">' + e.message + '</span>'; }
  });

  // Store schema & data
  storeDbBtn.addEventListener('click', async () => {
    if (!state.schema) return alert('Analyze JSON first');
    const conn = collectConn(); if (!conn) return;
    dbConnStatus.textContent = 'Storing...';
    try {
      const payload = { connection: conn, schema: state.schema };
      const res = await fetch('/api/store-schema', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      dbConnStatus.innerHTML = res.ok ? '<span class="success">' + (j.message || 'Stored') + '</span>' : '<span class="error">' + (j.message || 'Failed') + '</span>';
    } catch (e) { dbConnStatus.innerHTML = '<span class="error">' + e.message + '</span>'; }
  });

  // Insert controls and execution
  execInsertBtn.addEventListener('click', async () => {
    if (!state.schema) return alert('Analyze JSON first');
    insertStatus.textContent = 'Executing...';
    try {
      const payload = { operations: Array.from(Object.values(state.schema.tables || {})).map(t => ({ table: t.name, rows: t.rows })) };
      const res = await fetch('/api/insert-rows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      insertStatus.innerHTML = res.ok ? '<span class="success">' + (j.message || 'Insert OK') + '</span>' : '<span class="error">' + (j.message || 'Failed') + '</span>';
    } catch (e) { insertStatus.innerHTML = '<span class="error">' + e.message + '</span>'; }
  });

  downloadCsvBtn.addEventListener('click', () => {
    if (!state.schema) return alert('Analyze JSON first');
    for (const t of Object.values(state.schema.tables)) {
      const csv = toCsv(t);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = t.name + '.csv'; a.click(); URL.revokeObjectURL(url);
    }
  });

  // Utilities: infer schema — simplified and robust
  function inferSchema(data) {
    const schema = { tables: {}, relationships: [] };
    function ensureTable(name) {
      if (!schema.tables[name]) schema.tables[name] = { name, columns: {}, rows: [] };
      return schema.tables[name];
    }
    function inferType(v) {
      if (v === null || v === undefined) return 'TEXT';
      if (typeof v === 'boolean') return 'BOOLEAN';
      if (typeof v === 'number') return Number.isInteger(v) ? 'INTEGER' : 'DECIMAL';
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T/.test(v) || !isNaN(Date.parse(v))) return 'TIMESTAMP';
        if (v.includes('@')) return 'VARCHAR(255)';
        return v.length <= 50 ? 'VARCHAR(50)' : (v.length <= 255 ? 'VARCHAR(255)' : 'TEXT');
      }
      return 'TEXT';
    }

    // normalize root
    if (Array.isArray(data)) {
      processArray(data, 'items');
    } else if (typeof data === 'object' && data !== null) {
      const arrays = Object.entries(data).filter(([, v]) => Array.isArray(v));
      if (arrays.length > 0) {
        const main = arrays.reduce((a, b) => (a[1].length >= b[1].length ? a : b));
        processArray(main[1], main[0]);
        for (const [k, v] of arrays) if (k !== main[0]) processArray(v, k);
        const meta = Object.fromEntries(Object.entries(data).filter(([k]) => !arrays.some(a => a[0] === k)));
        if (Object.keys(meta).length > 0) processArray([meta], 'metadata');
      } else {
        processArray([data], 'record');
      }
    }

    function processArray(arr, tableName) {
      const t = ensureTable(tableName);
      arr.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          const row = {};
          for (const [k, v] of Object.entries(item)) {
            if (Array.isArray(v)) {
              const childName = (tableName + '_' + k).toLowerCase().replace(/[^a-z0-9_]/g, '_');
              processArray(v, childName);
            } else if (typeof v === 'object' && v !== null) {
              for (const [nk, nv] of Object.entries(v)) {
                const col = k + '_' + nk;
                t.columns[col] = t.columns[col] || { name: col, type: inferType(nv) };
                row[col] = nv;
              }
            } else {
              t.columns[k] = t.columns[k] || { name: k, type: inferType(v) };
              row[k] = v;
            }
          }
          t.rows.push(row);
        } else {
          t.columns['value'] = t.columns['value'] || { name: 'value', type: inferType(item) };
          t.rows.push({ value: item });
        }
      });
    }

    return schema;
  }

  // Render schema summary
  function renderSchema(schema) {
    schemaInfo.innerHTML = '';
    const tables = Object.keys(schema.tables).length;
    const columns = Object.values(schema.tables).reduce((s, t) => s + Object.keys(t.columns).length, 0);
    const rows = Object.values(schema.tables).reduce((s, t) => s + t.rows.length, 0);
    const cards = [
      { title: 'Tables', val: tables },
      { title: 'Columns', val: columns },
      { title: 'Rows', val: rows },
      { title: 'Relationships', val: schema.relationships.length }
    ];
    cards.forEach(c => {
      const d = el('div'); d.className = 'info-card';
      d.innerHTML = `<strong>${c.title}</strong><div style="margin-top:8px;font-size:18px">${c.val}</div>`;
      schemaInfo.appendChild(d);
    });
  }

  // Render table previews with scrollbars (horizontal + vertical)
  function renderTables(schema) {
    tableViz.innerHTML = '';
    state.schema.tables = schema.tables;
    for (const tableName of Object.keys(schema.tables)) {
      const t = schema.tables[tableName];
      const container = el('div'); container.className = 'table-container';
      const header = el('div'); header.className = 'table-header';
      header.innerHTML = `<div><strong>${t.name}</strong> — ${t.rows.length} rows</div><div class="muted">${Object.keys(t.columns).join(', ')}</div>`;
      container.appendChild(header);

      const wrapper = el('div'); wrapper.className = 'table-scroll';
      const table = el('table'); table.className = 'data-table';
      const thead = el('thead'); const headRow = el('tr');
      const colNames = Object.keys(t.columns);
      colNames.forEach(cn => { const th = el('th'); th.textContent = cn + ' (' + t.columns[cn].type + ')'; headRow.appendChild(th); });
      thead.appendChild(headRow); table.appendChild(thead);

      const tbody = el('tbody');
      const rowsToShow = t.rows.slice(0, 500);
      rowsToShow.forEach(r => {
        const tr = el('tr');
        colNames.forEach(col => { const td = el('td'); td.innerHTML = formatCell(r[col]); tr.appendChild(td); });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      wrapper.appendChild(table); container.appendChild(wrapper);
      tableViz.appendChild(container);
    }
  }

  function formatCell(v) { if (v === undefined || v === null) return '<em style="color:#999">NULL</em>'; const s = String(v); return s.length > 120 ? escapeHtml(s.slice(0, 120)) + '...' : escapeHtml(s); }
  function escapeHtml(s) { return s.replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // SQL generation
  function generateSql(schema, dialect) {
    let createSql = '', insertSql = '';
    for (const tName of Object.keys(schema.tables)) {
      const tbl = schema.tables[tName];
      createSql += `-- Table: ${tbl.name}\nCREATE TABLE ${quoteId(tbl.name, dialect)} (\n`;
      const cols = Object.keys(tbl.columns).map(cn => `  ${quoteId(cn, dialect)} ${mapType(tbl.columns[cn].type, dialect)}`);
      createSql += cols.join(',\n') + '\n);\n\n';
      if (tbl.rows.length > 0) {
        const colNames = Object.keys(tbl.columns);
        insertSql += `-- Data for ${tbl.name}\nINSERT INTO ${quoteId(tbl.name, dialect)} (${colNames.map(c => quoteId(c, dialect)).join(',')}) VALUES\n`;
        insertSql += tbl.rows.slice(0, 5000).map(r => '(' + colNames.map(c => formatSqlValue(r[c], dialect)).join(',') + ')').join(',\n') + ';\n\n';
      }
    }
    return { create: createSql, insert: insertSql };
  }

  function mapType(t, dialect) {
    const ut = t.toUpperCase();
    if (dialect === 'sqlite') {
      if (ut === 'DECIMAL') return 'REAL';
      if (ut.startsWith('VARCHAR')) return 'TEXT';
      if (ut === 'TIMESTAMP') return 'DATETIME';
      return ut;
    }
    if (dialect === 'mysql') {
      if (ut === 'INTEGER') return 'INT';
      if (ut === 'DECIMAL') return 'DECIMAL(10,2)';
      return ut;
    }
    // postgresql default
    if (ut === 'DECIMAL') return 'NUMERIC(18,4)';
    return ut;
  }

  function quoteId(id, dialect) { if (dialect === 'mysql') return '`' + id + '`'; return '"' + id + '"'; }
  function formatSqlValue(v, dialect) {
    if (v === undefined || v === null) return 'NULL';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return dialect === 'mysql' ? (v ? '1' : '0') : (v ? 'TRUE' : 'FALSE');
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  function collectConn() {
    const host = dbHost.value.trim(); if (!host) return alert('Enter host');
    return { dialect: dbDialect.value, host, port: dbPort.value || undefined, database: dbName.value, user: dbUser.value, password: dbPass.value };
  }

  // CSV helper
  function toCsv(tbl) {
    const cols = Object.keys(tbl.columns);
    const rows = tbl.rows;
    const lines = [cols.join(',')];
    rows.forEach(r => lines.push(cols.map(c => csvEscape(r[c])).join(',')));
    return lines.join('\n');
  }
  function csvEscape(v) { if (v === undefined || v === null) return ''; const s = String(v).replace(/"/g, '""'); return s.includes(',') || s.includes('\n') ? '"' + s + '"' : s; }

  // Expose state for debugging
  window.__json2sql_v2 = state;

})();
