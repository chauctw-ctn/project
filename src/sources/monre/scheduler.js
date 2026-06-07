// monre/scheduler.js
"use strict";

const { fetchMonreData, normalizeMonreFeatures, formatTimestamp } = require("./client");
const { openDb, ensureTable, insertRows, closeDb } = require("../../db/writer");

function shouldPersistNow(date = new Date(), intervalMinutes = 5) {
    return date.getMinutes() % intervalMinutes === 0;
}

function flattenMonrePayload(payload) {
    const stationId = payload.station_id;
    const timestamp = payload.ts;

    if (!stationId || !timestamp) return [];

    return Object.keys(payload)
        .filter((key) => !["station_id", "ts"].includes(key))
        .map((parameter) => ({
            station_id: stationId, // Đã có tiền tố monre_ từ client.js
            timestamp,
            parameter,
            value: payload[parameter]
        }));
}

function scheduleMonreJobs(overrides = {}) {
    const saveIntervalMinutes = Number(overrides.saveIntervalMinutes) || 5;
    const tickIntervalMs = Number(overrides.tickIntervalMs) || 1000;
    const fetchIntervalMs = Number(overrides.fetchIntervalMs) || 30000;
    const saveDb = overrides.saveDb ?? process.env.MONRE_SAVE_DB !== "0";

    const db = saveDb ? openDb(overrides.db || "data/mysql.db") : null;
    const dbReady = db ? ensureTable(db) : null;

    let latestNormalized = [];
    let inFlight = false;
    let lastFlushKey = null;

    // 1. Vòng lặp quét dữ liệu từ API mỗi 30 giây (hoặc tùy cấu hình)
    const runFetch = async () => {
        if (inFlight) return;
        inFlight = true;
        try {
            const features = await fetchMonreData(overrides);
            latestNormalized = normalizeMonreFeatures(features);
            console.log(`[MONRE][FETCH] ${formatTimestamp()} active stations: ${latestNormalized.length}`);

            latestNormalized.forEach((payload) => {
                console.log(`[MONRE][DATA] ${JSON.stringify(payload)}`);
            });
            
            if (typeof overrides.onFetch === "function") {
                overrides.onFetch(latestNormalized);
            }
        } catch (err) {
            console.error("[MONRE][FETCH] Failed to fetch endpoint:", err.message || err);
        } finally {
            inFlight = false;
        }
    };

    // Kích hoạt quét phát đầu tiên ngay khi chạy ứng dụng
    runFetch();
    const fetchTimer = setInterval(runFetch, fetchIntervalMs);

    // 2. Vòng lặp kiểm tra thời gian lưu DB (Tick 1 giây một lần giống MQTT)
    const tick = async () => {
        const now = new Date();
        if (!shouldPersistNow(now, saveIntervalMinutes)) return;

        const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
        if (key === lastFlushKey) return;
        lastFlushKey = key;

        const savedTs = formatTimestamp(now);
        if (!latestNormalized || latestNormalized.length === 0) {
            console.log(`[MONRE][SAVE] ${savedTs} skipped (no target telemetry cached)`);
            return;
        }

        try {
            if (db) {
                await dbReady;
                // Làm phẳng dữ liệu dạng mảng cột dọc thích ứng DB quan hệ
                const rows = latestNormalized.flatMap((payload) =>
                    flattenMonrePayload({ ...payload, ts: savedTs })
                );

                if (rows.length) {
                    await insertRows(db, rows);
                }
                console.log(`[MONRE][SAVE] ${savedTs} inserted=${rows.length} records`);
            }
        } catch (err) {
            console.error("[MONRE][SAVE] Database persistent error:", err.message || err);
        }
    };

    const saveTimer = setInterval(tick, tickIntervalMs);

    // Trả về đối tượng để điều khiển đóng luồng khi cần tắt app an toàn
    return {
        fetchTimer,
        saveTimer,
        stop: async () => {
            clearInterval(fetchTimer);
            clearInterval(saveTimer);
            if (db) {
                await closeDb(db);
            }
            console.log("[MONRE] Scheduler stopped cleanly.");
        }
    };
}

module.exports = {
    scheduleMonreJobs
};