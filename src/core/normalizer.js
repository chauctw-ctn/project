"use strict";

/**
 * Gộp mảng data items thành object keyed by station id.
 * Mỗi item cần có .station và .parameter (đã map từ cnlMapping).
 *
 * @param {{ station: string|null, parameter: string|null, Text: string }[]} items
 * @param {string} ts  - timestamp dạng "YYYY-MM-DD HH:mm:ss"
 * @returns {{ [stationId: string]: { scada_id: string, ts: string, [param]: string } }}
 */
function normalizeStationData(items, ts) {
	return items.reduce((acc, item) => {
		if (!item.station || !item.parameter) return acc;
		if (!acc[item.station]) acc[item.station] = { scada_id: item.station, ts };
		acc[item.station][item.parameter] = item.Text;
		return acc;
	}, {});
}

/**
 * Chuyển normalized object thành chuỗi NDJSON (1 dòng / trạm).
 * @param {{ [stationId: string]: object }} normalized
 * @returns {string}
 */
function normalizeToNdjson(normalized) {
	return Object.values(normalized)
		.map((payload) => JSON.stringify(payload))
		.join("\n");
}

/**
 * Format Date thành "YYYY-MM-DD HH:mm:ss".
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function formatTimestamp(date = new Date()) {
	const pad = (v, len = 2) => String(v).padStart(len, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	);
}

/**
 * Kiểm tra có đúng mốc N phút không (dùng để quyết định có persist không).
 * @param {Date}   [date=new Date()]
 * @param {number} [intervalMinutes=5]
 * @returns {boolean}
 */
function shouldPersistNow(date = new Date(), intervalMinutes = 5) {
	return date.getMinutes() % intervalMinutes === 0;
}

module.exports = { normalizeStationData, normalizeToNdjson, formatTimestamp, shouldPersistNow };