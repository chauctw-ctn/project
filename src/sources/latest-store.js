"use strict";

const latestStore = new Map();

function saveLatest(source, stationId, payload) {
  if (!source || !stationId || !payload) return;

  const key = `${source}_${stationId}`;

  latestStore.set(key, {
    source,
    station_id: key,
    raw_station_id: stationId,
    timestamp: payload.ts || payload.timestamp || new Date().toISOString(),
    data: payload
  });
}

function getLatest(source = null, stationId = null) {
  if (source && stationId) {
    return latestStore.get(`${source}_${stationId}`) || null;
  }

  if (source) {
    return Array.from(latestStore.values())
      .filter(item => item.source === source);
  }

  return Array.from(latestStore.values());
}

function getGaugeValue(source, stationId, parameter) {
  const station = getLatest(source, stationId);

  if (!station) return null;

  return {
    success: true,
    source,
    station_id: station.station_id,
    parameter,
    value: Number(station.data[parameter]),
    timestamp: station.timestamp
  };
}

module.exports = {
  saveLatest,
  getLatest,
  getGaugeValue
};