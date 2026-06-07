const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DEFAULT_DB_PATH =
	process.env.SQLITE_PATH || path.join(__dirname, "..", "..", "data", "mysql.db");

const TABLE_SCHEMA = `
	CREATE TABLE IF NOT EXISTS station_readings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		station_id TEXT NOT NULL,
		ts TEXT NOT NULL,
		parameter TEXT NOT NULL,
		value REAL
	);
`;

function openDb(dbPath = DEFAULT_DB_PATH) {
	return new sqlite3.Database(dbPath);
}

function ensureTable(db) {
	return new Promise((resolve, reject) => {
		db.exec(TABLE_SCHEMA, (err) => {
			if (err) {
				reject(err);
				return;
			}

			migrateSchema(db)
				.then(resolve)
				.catch(reject);
		});
	});
}

function migrateSchema(db) {
	return new Promise((resolve, reject) => {
		db.all("PRAGMA table_info(station_readings)", (err, columns) => {
			if (err) {
				reject(err);
				return;
			}

			const columnNames = columns.map((column) => column.name);
			const hasLegacyStationId = columnNames.includes("station_id");
			const hasScadaId = columnNames.includes("scada_id");
			const hasMqttId = columnNames.includes("mqtt_id");
			const hasTvaId = columnNames.includes("tva_id");
			const hasStationId = columnNames.includes("station_id");
			const hasCreatedAt = columnNames.includes("created_at");

			const needsMigration =
				hasCreatedAt || hasLegacyStationId || hasScadaId || hasMqttId || hasTvaId || !hasStationId;
			if (!needsMigration) {
				resolve();
				return;
			}

			const stationExpr = hasStationId
				? "station_id"
				: "CASE\n"
					.concat(hasScadaId ? "\tWHEN scada_id IS NOT NULL THEN 'scada_' || scada_id\n" : "")
					.concat(hasMqttId ? "\tWHEN mqtt_id IS NOT NULL THEN 'mqtt_' || mqtt_id\n" : "")
					.concat(hasTvaId ? "\tWHEN tva_id IS NOT NULL THEN 'tva_' || tva_id\n" : "")
					.concat(hasLegacyStationId ? "\tWHEN station_id IS NOT NULL THEN station_id\n" : "")
					.concat("\tELSE NULL\nEND");

			const migrateSql = `
				BEGIN TRANSACTION;
				ALTER TABLE station_readings RENAME TO station_readings_old;
				${TABLE_SCHEMA.trim()}
				INSERT INTO station_readings (id, station_id, ts, parameter, value)
				SELECT id, ${stationExpr}, ts, parameter, value
				FROM station_readings_old;
				DROP TABLE station_readings_old;
				COMMIT;
			`;

			db.exec(migrateSql, (execErr) => {
				if (execErr) {
					db.exec("ROLLBACK", () => {
						reject(execErr);
					});
					return;
				}
				resolve();
			});
		});
	});
}

function insertRows(db, rows) {
	if (!rows.length) {
		return Promise.resolve(0);
	}

	return new Promise((resolve, reject) => {
		let hasError = false;
		let lastError = null;

		db.serialize(() => {
			db.run("BEGIN TRANSACTION");
			const stmt = db.prepare(
				"INSERT INTO station_readings (station_id, ts, parameter, value) VALUES (?, ?, ?, ?)"
			);

			rows.forEach((row) => {
				stmt.run(
					[row.station_id, row.timestamp, row.parameter, row.value],
					(err) => {
						if (err) {
							hasError = true;
							lastError = err;
						}
					}
				);
			});

			stmt.finalize((err) => {
				if (err) {
					hasError = true;
					lastError = err;
				}

				if (hasError) {
					db.run("ROLLBACK", () => {
						reject(lastError || new Error("SQLite insert failed"));
					});
					return;
				}

				db.run("COMMIT", (commitErr) => {
					if (commitErr) {
						db.run("ROLLBACK", () => {
							reject(commitErr);
						});
						return;
					}
					resolve(rows.length);
				});
			});
		});
	});
}

function closeDb(db) {
	return new Promise((resolve, reject) => {
		db.close((err) => {
			if (err) {
				reject(err);
				return;
			}
			resolve();
		});
	});
}

module.exports = {
	DEFAULT_DB_PATH,
	openDb,
	ensureTable,
	insertRows,
	closeDb
};
