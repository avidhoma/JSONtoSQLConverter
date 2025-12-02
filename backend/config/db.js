// backend/config/db.js
// Provides DB connection helpers for Postgres, MySQL, MSSQL, SQLite.


const pg = require('pg');
const mysql = require('mysql2/promise');
const mssql = require('mssql');
const sqlite3 = require('sqlite3');

async function testConnection(conn) {
  const dialect = conn.dialect;
  if (dialect === 'postgresql' || dialect === 'postgres') {
    const client = new pg.Client({ host: conn.host, port: conn.port || 5432, user: conn.user, password: conn.password, database: conn.database });
    await client.connect(); await client.end(); return true;
  } else if (dialect === 'mysql') {
    const c = await mysql.createConnection({ host: conn.host, port: conn.port || 3306, user: conn.user, password: conn.password, database: conn.database });
    await c.end(); return true;
  } else if (dialect === 'mssql') {
    const pool = await mssql.connect({ user: conn.user, password: conn.password, server: conn.host, port: parseInt(conn.port||1433), database: conn.database, options: { encrypt: true, trustServerCertificate: true } });
    await pool.close(); return true;
  } else if (dialect === 'sqlite' || conn.dialect === 'sqlite3') {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(conn.database || ':memory:', sqlite3.OPEN_READONLY, (err) => {
        if (err) reject(err); else { db.close(); resolve(true); }
      });
    });
  }
  throw new Error('Unsupported dialect: ' + dialect);
}

function mapTypeToSql(type, dialect) {
  const t = (type||'TEXT').toUpperCase();
  if (dialect === 'sqlite') {
    if (t === 'DECIMAL') return 'REAL';
    if (t.startsWith('VARCHAR')) return 'TEXT';
    if (t === 'TIMESTAMP') return 'DATETIME';
    return t;
  }
  if (dialect === 'mysql') {
    if (t === 'INTEGER') return 'INT';
    if (t === 'DECIMAL') return 'DECIMAL(10,2)';
    return t;
  }
  // Postgres / mssql default
  if (t === 'DECIMAL') return 'NUMERIC(18,4)';
  return t;
}

async function createSchemaAndInsert(conn, schema) {
  // Connect based on dialect and run create statements then insert small batch.
  const dialect = conn.dialect;
  if (dialect === 'postgresql' || dialect === 'postgres') {
    const client = new pg.Client({ host: conn.host, port: conn.port || 5432, user: conn.user, password: conn.password, database: conn.database });
    await client.connect();
    for (const t of schema.tables) {
      const colDefs = t.columns.map(c => `"${c.name}" ${mapTypeToSql(c.type, 'postgresql')}`).join(', ');
      const sql = `CREATE TABLE IF NOT EXISTS "${t.name}" (${colDefs});`;
      await client.query(sql);
      // insert rows (small subset)
      if (t.rows && t.rows.length) {
        const cols = t.columns.map(c => c.name);
        const vals = t.rows.slice(0, 100).map(r => '(' + cols.map(c => r[c] === undefined ? 'NULL' : `'${String(r[c]).replace(/'/g,"''")}'`).join(',') + ')').join(',');
        const insert = `INSERT INTO "${t.name}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES ${vals};`;
        await client.query(insert);
      }
    }
    await client.end();
    return { ok: true };
  } else if (dialect === 'mysql') {
    const conn2 = await mysql.createConnection({ host: conn.host, port: conn.port || 3306, user: conn.user, password: conn.password, database: conn.database });
    for (const t of schema.tables) {
      const colDefs = t.columns.map(c => `\`${c.name}\` ${mapTypeToSql(c.type,'mysql')}`).join(', ');
      await conn2.query(`CREATE TABLE IF NOT EXISTS \`${t.name}\` (${colDefs}) ENGINE=InnoDB;`);
      if (t.rows && t.rows.length) {
        const cols = t.columns.map(c => c.name);
        const vals = t.rows.slice(0,100).map(r => '(' + cols.map(c => r[c] === undefined ? 'NULL' : `'${String(r[c]).replace(/'/g,"''")}'`).join(',') + ')').join(',');
        await conn2.query(`INSERT INTO \`${t.name}\` (${cols.map(c=>`\`${c}\``).join(',')}) VALUES ${vals};`);
      }
    }
    await conn2.end(); return { ok: true };
  } else if (dialect === 'mssql') {
    const pool = await mssql.connect({ user: conn.user, password: conn.password, server: conn.host, port: parseInt(conn.port||1433), database: conn.database, options: { encrypt: true, trustServerCertificate: true }});
    for (const t of schema.tables) {
      const colDefs = t.columns.map(c => `[${c.name}] ${mapTypeToSql(c.type,'mssql')}`).join(', ');
      await pool.request().query(`IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='${t.name}' AND xtype='U') CREATE TABLE [${t.name}] (${colDefs});`);
      if (t.rows && t.rows.length) {
        const cols = t.columns.map(c => c.name);
        for (const r of t.rows.slice(0,100)) {
          const values = cols.map(c => r[c] === undefined ? 'NULL' : `'${String(r[c]).replace(/'/g,"''")}'`).join(',');
          await pool.request().query(`INSERT INTO [${t.name}] (${cols.map(c=>`[${c}]`).join(',')}) VALUES (${values});`);
        }
      }
    }
    await pool.close(); return { ok: true };
  } else if (dialect === 'sqlite' || conn.dialect === 'sqlite3') {
    return new Promise((resolve, reject) => {
      const dbfile = conn.database || ':memory:';
      const db = new sqlite3.Database(dbfile, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
        if (err) return reject(err);
        try {
          for (const t of schema.tables) {
            const colDefs = t.columns.map(c => `"${c.name}" ${mapTypeToSql(c.type,'sqlite')}`).join(', ');
            await run(db, `CREATE TABLE IF NOT EXISTS "${t.name}" (${colDefs});`);
            if (t.rows && t.rows.length) {
              const cols = t.columns.map(c => c.name);
              const vals = t.rows.slice(0,100).map(r => '(' + cols.map(c => r[c] === undefined ? 'NULL' : `'${String(r[c]).replace(/'/g,"''")}'`).join(',') + ')').join(',');
              await run(db, `INSERT INTO "${t.name}" (${cols.map(c=>`"${c}"`).join(',')}) VALUES ${vals};`);
            }
          }
          db.close(); resolve({ ok: true });
        } catch (e) { db.close(); reject(e); }
      });
    });
  }
  throw new Error('Unsupported dialect: ' + dialect);
}

async function insertRows(conn, operations) {
  // operations: [{table: 'name', rows: [...]}, ...]
  // Similar to above: execute inserts in target DB. Implement batching and prepared statements in production.
  const dialect = conn.dialect;
  // Implementation is analogous to createSchemaAndInsert but only inserts rows.
  // For brevity, call createSchemaAndInsert with schema shaped from operations.
  const schema = { tables: operations.map(op => ({ name: op.table, columns: op.columns || (op.rows[0] ? Object.keys(op.rows[0]).map(n => ({ name: n, type: 'TEXT' })) : []), rows: op.rows })) };
  return await createSchemaAndInsert(conn, schema);
}


// Small helper for sqlite run with Promise
function run(db, sql) {
  return new Promise((resolve, reject) => db.run(sql, function(err) { if (err) reject(err); else resolve(this); }));
}

module.exports = { testConnection, createSchemaAndInsert, insertRows };
