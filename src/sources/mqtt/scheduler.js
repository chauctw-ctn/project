"use strict";

const { saveLatest } = require("../latest-store");
const { connect, subscribe, onMessage } = require("./client");
const { openDb, ensureTable, insertRows, closeDb } = require("../../db/writer");

function shouldPersistNow(date = new Date(), intervalMinutes = 5) {
  return date.getMinutes() % intervalMinutes === 0;
}

function formatLocalTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + " " + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(":");
}

function flattenStationPayload(payload) {
  const stationId = payload.mqtt_id;
  const timestamp = payload.ts || payload.timestamp;

  if (!stationId || !timestamp) return [];

  return Object.keys(payload)
    .filter((key) => !["mqtt_id", "ts", "timestamp"].includes(key))
    .map((parameter) => ({
      station_id: `mqtt_${stationId}`,
      timestamp,
      parameter,
      value: payload[parameter]
    }));
}

function scheduleMqttJobs(overrides = {}) {
  const saveIntervalMinutes = Number(overrides.saveIntervalMinutes) || 5;
  const flushIntervalMs = Number(overrides.flushIntervalMs) || 1000;
  const saveDb = overrides.saveDb ?? process.env.MQTT_SAVE_DB !== "0";

  const db = saveDb ? openDb(overrides.db || "data/mysql.db") : null;
  const dbReady = db ? ensureTable(db) : null;

  const stationBuffer = new Map();
  let lastFlushKey = null;

  const client = connect(overrides);

  const flushBuffer = async () => {
    if (!db || stationBuffer.size === 0) return;

    const now = new Date();

    if (!shouldPersistNow(now, saveIntervalMinutes)) return;

    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (key === lastFlushKey) return;

    lastFlushKey = key;

    try {
      await dbReady;

      const savedTs = formatLocalTimestamp(now);

      const rows = Array.from(stationBuffer.values()).flatMap((stationPayload) =>
        flattenStationPayload({ ...stationPayload, ts: savedTs })
      );

      if (rows.length) {
        await insertRows(db, rows);
      }

      console.log(`[MQTT][SAVE] ${savedTs} inserted=${rows.length}`);
      stationBuffer.clear();
    } catch (err) {
      console.error("[MQTT][SAVE] Failed:", err.message || err);
    }
  };

  client.on("connect", () => {
    const url = `mqtt://${overrides.host || process.env.MQTT_HOST || "14.225.252.85"}:${overrides.port || process.env.MQTT_PORT || "1883"}`;

    console.log(`[MQTT] Connected to ${url}`);

    subscribe(client, overrides);

    if (!client._flushTimer) {
      client._flushTimer = setInterval(() => {
        flushBuffer();
      }, flushIntervalMs);
    }
  });

  onMessage(client, (stationPayload) => {
    console.log("[MQTT][DATA]", JSON.stringify(stationPayload));

    saveLatest("mqtt", stationPayload.mqtt_id, stationPayload);

    stationBuffer.set(stationPayload.mqtt_id, stationPayload);

    if (typeof overrides.onData === "function") {
      overrides.onData(stationPayload, stationPayload.ts);
    }

    flushBuffer();
  }, overrides);

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err.message || err);
  });

  client.on("close", () => {
    console.log("[MQTT] Connection closed");

    if (client._flushTimer) {
      clearInterval(client._flushTimer);
      client._flushTimer = null;
    }
  });

  client.stop = async () => {
    if (client._flushTimer) {
      clearInterval(client._flushTimer);
      client._flushTimer = null;
    }

    await new Promise((resolve) => client.end(true, resolve));

    if (db) {
      await closeDb(db);
    }
  };

  return client;
}

module.exports = {
  scheduleMqttJobs
};