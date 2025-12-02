\# JSON → SQL Converter — V2 (Frontend + Backend)



A developer tool to convert JSON into relational schema + SQL, preview table data, and optionally create schema and insert data into a database. Includes support for fetching JSON from APIs with Bearer token or Azure AD authentication (3 AAD flows supported: Authorization Code, Device Code, and Paste Token).



\## Features



\- Paste JSON or fetch from API (No Auth / Bearer / Azure AD)

\- Robust inference of tables, columns, and types

\- Scrollable data preview (handles many columns/rows)

\- SQL generation (PostgreSQL, MySQL, SQLite)

\- Store schema \& data in DB (Postgres, MySQL, MSSQL, SQLite) via backend

\- Test DB connection from UI

\- Insert data into DB (backend executes)

\- CSV export per table

\- AAD Auth: Authorization Code Flow, Device Code Flow, or Paste Token (user chooses)



> \*\*Security note\*\*: Never store DB credentials or secrets on the frontend. Always use HTTPS and secure server-side handling.



\## Repo structure





