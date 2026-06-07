"use strict";

const { normalizeParameter } = require("./parameterMapping");

const SKIP_KEYS = new Set([
	"station", "station_id", "scada_id", "mqtt_id", "tva_id", "ts", "timestamp"
]);

/**
 * Chuyển giá trị chuỗi "1.234,56" hoặc "1234.56" thành number.
 * Trả về null nếu chuỗi rỗng, giữ nguyên nếu không parse được.
 * @param {*} value
 * @returns {number|null|*}
 */
function normalizeNumber(value) {
	if (typeof value === "number") return value;
	if (typeof value !== "string") return value;
	const cleaned = value.replace(/,/g, "").trim();
	if (cleaned === "") return null;
	const n = Number(cleaned);
	return Number.isNaN(n) ? value : n;
}

/**
 * Parse chuỗi NDJSON hoặc mảng dòng JSON thành mảng objects.
 * @param {string|string[]} input
 * @returns {object[]}
 */
function parseNdjsonLines(input) {
	const lines = Array.isArray(input) ? input : String(input || "").split(/\r?\n/);
	return lines
		.map((l) => l.trim())
		.filter((l) => l.length > 0)
		.map((l) => JSON.parse(l));
}

/**
 * Chuyển một station payload thành mảng rows dạng:
 * { station_id, timestamp, parameter, value }
 * @param {object} payload
 * @returns {{ station_id: string, timestamp: string, parameter: string, value: * }[]}
 */
function flattenStationPayload(payload) {
	const stationIdRaw = payload.station_id || null;
	const scadaId      = payload.scada_id || payload.station || null;
	const mqttId       = payload.mqtt_id  || null;
	const tvaId        = payload.tva_id   || null;
	const timestamp    = payload.ts || payload.timestamp;

	if ((!stationIdRaw && !scadaId && !mqttId && !tvaId) || !timestamp) return [];

	const stationId = stationIdRaw
		? stationIdRaw
		: scadaId
		? `scada_${scadaId}`
		: mqttId
		? `mqtt_${mqttId}`
		: `tva_${tvaId}`;

	return Object.keys(payload)
		.filter((key) => !SKIP_KEYS.has(key))
		.map((parameter) => ({
			station_id: stationId,
			timestamp,
			parameter:  normalizeParameter(parameter),
			value:      normalizeNumber(payload[parameter])
		}));
}

/**
 * Parse NDJSON input thành mảng rows sẵn sàng insert DB.
 * @param {string|string[]} input
 * @returns {{ station_id, timestamp, parameter, value }[]}
 */
function parseNdjsonToRows(input) {
	return parseNdjsonLines(input).flatMap(flattenStationPayload);
}

module.exports = { normalizeNumber, parseNdjsonLines, flattenStationPayload, parseNdjsonToRows };