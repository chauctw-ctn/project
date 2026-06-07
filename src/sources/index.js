"use strict";

const cache = require("../cache");

const { processNdjson } = require("../db/processor");

const {
  scheduleScadaJobs,
} = require("./scada/scheduler");

const {
  scheduleMqttJobs,
} = require("./mqtt/scheduler");

const {
  scheduleTvaJobs,
} = require("./tva/scheduler");

const {
  scheduleMonreJobs,
} = require("./monre/scheduler");

async function onData(source, normalized, ts) {
  try {
    cache.set(source, normalized);

    await processNdjson(normalized);

    console.log(
      `[${source}] ${ts.toISOString()} -> ${normalized.length || 0} records`
    );
  } catch (err) {
    console.error(`[${source}] Processing error`, err);
  }
}

async function start() {
  console.log("===================================");
  console.log("STARTING DATA SOURCES");
  console.log("===================================");

  scheduleScadaJobs((data, ts) =>
    onData("SCADA", data, ts)
  );

  scheduleMqttJobs((data, ts) =>
    onData("MQTT", data, ts)
  );

  scheduleTvaJobs((data, ts) =>
    onData("TVA", data, ts)
  );

  scheduleMonreJobs((data, ts) =>
    onData("MONRE", data, ts)
  );

  console.log("✓ SCADA Scheduler Started");
  console.log("✓ MQTT Scheduler Started");
  console.log("✓ TVA Scheduler Started");
  console.log("✓ MONRE Scheduler Started");
}

module.exports = {
  start,
};