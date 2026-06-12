"use strict";
const Database = require("better-sqlite3");
const db = new Database("data/mysql.db");
const rows = db.prepare(`
    SELECT *
    FROM station_readings
    ORDER BY id DESC
    LIMIT 500
`).all();
console.table(rows);
db.close();