// src/sources/tva/scheduler.js
"use strict";

const { fetchTVAData, normalizeStations, formatTimestamp } = require("./client");
const { openDb, ensureTable, insertRows, closeDb } = require("../../db/writer");

function shouldPersistNow(date = new Date(), intervalMinutes = 5) {
    return date.getMinutes() % intervalMinutes === 0;
}

function flattenTvaPayload(payload) {
    const stationId = payload.tva_id;
    const timestamp = payload.ts;

    if (!stationId || !timestamp) return [];

    return Object.keys(payload)
        .filter((key) => !["tva_id", "ts"].includes(key))
        .map((parameter) => ({
            station_id: `tva_${stationId}`,
            timestamp,
            parameter,
            value: payload[parameter]
        }));
}

function scheduleTVAJobs(overrides = {}) {
    const saveIntervalMinutes = Number(overrides.saveIntervalMinutes) || 5;
    const tickIntervalMs = Number(overrides.tickIntervalMs) || 1000;
    const fetchIntervalMs = Number(overrides.fetchIntervalMs) || 30000;
    const saveDb = overrides.saveDb ?? process.env.TVA_SAVE_DB !== "0";

    const db = saveDb ? openDb(overrides.db || "data/mysql.db") : null;
    const dbReady = db ? ensureTable(db) : null;

    let latestNormalized = [];
    let inFlight = false;
    let lastFlushKey = null;

    // 1. Luồng chạy ngầm cào trang Web định kỳ (30s / lần)
    const runFetch = async () => {
        if (inFlight) return;
        inFlight = true;
        try {
            const result = await fetchTVAData(overrides);
            latestNormalized = normalizeStations(result.stations);
            console.log(`[TVA][FETCH] ${formatTimestamp()} active stations: ${latestNormalized.length}`);

            latestNormalized.forEach((payload) => {
                console.log(`[TVA][DATA] ${JSON.stringify(payload)}`);
            });

            if (typeof overrides.onFetch === "function") {
                overrides.onFetch(latestNormalized);
            }
        } catch (err) {
            console.error("[TVA][FETCH] Failed to scrap portal website:", err.message || err);
        } finally {
            inFlight = false;
        }
    };

    // Khởi động lượt quét đầu tiên khi ứng dụng chạy
    runFetch();
    const fetchTimer = setInterval(runFetch, fetchIntervalMs);

    // 2. Luồng kiểm tra điều kiện ghi nhận dữ liệu vào Database quan hệ (Mỗi 5 phút)
    const tick = async () => {
        const now = new Date();
        if (!shouldPersistNow(now, saveIntervalMinutes)) return;

        const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
        if (key === lastFlushKey) return;
        lastFlushKey = key;

        const savedTs = formatTimestamp(now);
        if (!latestNormalized || latestNormalized.length === 0) {
            console.log(`[TVA][SAVE] ${savedTs} skipped (no cached portal data)`);
            return;
        }

        try {
            if (db) {
                await dbReady;
                
                // Chuyển dữ liệu cấu trúc cột ngang sang cột dọc để insert DB
                const rows = latestNormalized.flatMap((payload) =>
                    flattenTvaPayload({ ...payload, ts: savedTs })
                );

                if (rows.length) {
                    await insertRows(db, rows);
                }
                console.log(`[TVA][SAVE] ${savedTs} inserted=${rows.length} records`);
            }
        } catch (err) {
            console.error("[TVA][SAVE] Database persistent error:", err.message || err);
        }
    };

    const saveTimer = setInterval(tick, tickIntervalMs);

    // Trả về cấu trúc điều khiển giải phóng tài nguyên hệ thống
    return {
        fetchTimer,
        saveTimer,
        stop: async () => {
            clearInterval(fetchTimer);
            clearInterval(saveTimer);
            if (db) {
                await closeDb(db);
            }
            console.log("[TVA] Scheduler stopped cleanly.");
        }
    };
}

module.exports = {
    scheduleTVAJobs,
    scheduleTvaJobs: scheduleTVAJobs
};