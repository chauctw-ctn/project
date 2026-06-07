"use strict";

const { fetchScadaData } = require("./client");
const { normalizeStationData, normalizeToNdjson, formatTimestamp, shouldPersistNow } = require("../../core/normalizer");
const { processNdjson } = require("../../db/processor");

// ── fetch loop (mỗi 30 giây) ─────────────────────────────────────────────────

/**
 * Fetch dữ liệu SCADA định kỳ, gọi onFetch(normalized, ts) sau mỗi lần thành công.
 *
 * @param {object}   [overrides]
 * @param {function} [overrides.onFetch]         - callback(normalized, ts)
 * @param {number}   [overrides.fetchIntervalMs] - default 30000
 * @returns {NodeJS.Timeout}
 */
function scheduleFetchEveryThirtySeconds(overrides = {}) {
	let inFlight          = false;
	const onFetch         = overrides.onFetch;
	const fetchIntervalMs = Number(overrides.fetchIntervalMs) || 30000;

	const runFetch = async () => {
		if (inFlight) return;
		inFlight   = true;
		const ts   = formatTimestamp();
		try {
			const result     = await fetchScadaData(overrides);
			const normalized = normalizeStationData(result.data, ts);
			console.log(`[SCADA][FETCH] ${ts} records=${result.data.length}`);			
			Object.values(normalized).forEach((payload) => {
				console.log(`[SCADA][DATA] ${JSON.stringify(payload)}`);
			});
			if (typeof onFetch === "function") onFetch(normalized, ts);
		} catch (err) {
			console.error("[SCADA][FETCH] Failed:", err.message || err);
		} finally {
			inFlight = false;
		}
	};

	runFetch(); // fetch ngay khi khởi động
	return setInterval(runFetch, fetchIntervalMs);
}

// ── save loop (mỗi 5 phút) ───────────────────────────────────────────────────

/**
 * Tick mỗi giây, persist khi đúng mốc N phút.
 * Nếu truyền getLatestNormalized thì dùng cache thay vì fetch lại.
 *
 * @param {object}   [overrides]
 * @param {function} [overrides.getLatestNormalized] - () => normalized object từ cache
 * @param {number}   [overrides.saveIntervalMinutes] - default 5
 * @param {number}   [overrides.tickIntervalMs]      - default 1000
 * @param {string}   [overrides.db]                  - dbPath override
 * @returns {NodeJS.Timeout}
 */
function scheduleEveryFiveMinutes(overrides = {}) {
	let lastRunKey            = null;
	const saveIntervalMinutes = Number(overrides.saveIntervalMinutes) || 5;
	const tickIntervalMs      = Number(overrides.tickIntervalMs)      || 1000;
	const getLatestNormalized = overrides.getLatestNormalized;
	const dbOptions           = overrides.db ? { dbPath: overrides.db } : {};

	const tick = async () => {
		const now    = new Date();
		const minute = now.getMinutes();
		if (minute % saveIntervalMinutes !== 0) return;

		const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${minute}`;
		if (key === lastRunKey) return;
		lastRunKey = key;

		const saveTs = formatTimestamp(now);

		// ── path A: dùng cache (scheduler chính) ──
		if (typeof getLatestNormalized === "function") {
			const cached = getLatestNormalized();
			if (!cached || Object.keys(cached).length === 0) {
				console.log(`[SCADA][SAVE] ${saveTs} skipped (no cached data)`);
				return;
			}
			const normalized = Object.fromEntries(
				Object.entries(cached).map(([id, payload]) => [id, { ...payload, ts: saveTs }])
			);
			try {
				const { inserted } = await processNdjson(normalizeToNdjson(normalized), dbOptions);
				console.log(`[SCADA][SAVE] ${saveTs} inserted=${inserted}`);
			} catch (err) {
				console.error("[SCADA][SAVE] Failed:", err.message || err);
			}
			return;
		}

		// ── path B: fetch trực tiếp (standalone / debug) ──
		if (!shouldPersistNow(now, saveIntervalMinutes)) return;
		try {
			const result     = await fetchScadaData(overrides);
			const normalized = normalizeStationData(result.data, saveTs);
			const { inserted } = await processNdjson(normalizeToNdjson(normalized), dbOptions);
			console.log(`[SCADA][SAVE] ${saveTs} inserted=${inserted}`);
		} catch (err) {
			console.error("[SCADA][SAVE] Failed:", err.message || err);
		}
	};

	tick(); // chạy ngay nếu đang đúng mốc
	return setInterval(tick, tickIntervalMs);
}

// ── entry point ───────────────────────────────────────────────────────────────

/**
 * Khởi chạy cả hai vòng lặp.
 * fetchTimer cập nhật cache, saveTimer đọc cache để persist.
 *
 * @param {object} [overrides] - truyền thẳng vào cả hai scheduler
 * @returns {{ fetchTimer: NodeJS.Timeout, saveTimer: NodeJS.Timeout }}
 */
function scheduleScadaJobs(overrides = {}) {
	let latestNormalized = null;
	let latestTimestamp  = null;

	const fetchTimer = scheduleFetchEveryThirtySeconds({
		...overrides,
		onFetch: (normalized, ts) => {
			latestNormalized = normalized;
			latestTimestamp  = ts;
			// Nếu caller muốn nhận event (ví dụ: cache.js, ws.js)
			if (typeof overrides.onFetch === "function") {
				overrides.onFetch(normalized, ts);
			}
		}
	});

	const saveTimer = scheduleEveryFiveMinutes({
		...overrides,
		getLatestNormalized: () => latestNormalized,
		getLatestTimestamp:  () => latestTimestamp
	});

	return { fetchTimer, saveTimer };
}

module.exports = {
	scheduleFetchEveryThirtySeconds,
	scheduleEveryFiveMinutes,
	scheduleScadaJobs		
};