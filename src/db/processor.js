"use strict";

const { parseNdjsonToRows } = require("../core/parser");
const { openDb, ensureTable, insertRows, closeDb } = require("./writer");

/**
 * Parse NDJSON → rows → persist vào SQLite.
 *
 * @param {string|string[]} input       - NDJSON string hoặc mảng JSON lines
 * @param {object}          [options]
 * @param {string}          [options.dbPath]   - đường dẫn SQLite file
 * @param {object}          [options.dbWriter] - inject dbWriter (testing / DI)
 * @returns {Promise<{ inserted: number }>}
 */
async function processNdjson(input, options = {}) {
	const rows = parseNdjsonToRows(input);

	// Hỗ trợ inject dbWriter để test không cần file thật
	const dbWriter = options.dbWriter || { openDb, ensureTable, insertRows, closeDb };

	const db = dbWriter.openDb(options.dbPath);
	try {
		await dbWriter.ensureTable(db);
		const inserted = await dbWriter.insertRows(db, rows);
		return { inserted };
	} finally {
		await dbWriter.closeDb(db);
	}
}

module.exports = { processNdjson };