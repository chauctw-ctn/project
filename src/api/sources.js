"use strict";

const express = require("express");
const {
  getLatest,
  getGaugeValue
} = require("../sources/latest-store");

const router = express.Router();

router.get("/latest", (req, res) => {
  const { source, station_id } = req.query;

  const data = getLatest(source || null, station_id || null);

  res.json({
    success: true,
    data
  });
});

router.get("/gauge", (req, res) => {
  const { source, station_id, parameter } = req.query;

  if (!source || !station_id || !parameter) {
    return res.status(400).json({
      success: false,
      message: "Thiếu source, station_id hoặc parameter"
    });
  }

  const result = getGaugeValue(source, station_id, parameter);

  if (!result) {
    return res.json({
      success: false,
      message: "Chưa có dữ liệu cho trạm này"
    });
  }

  if (!Number.isFinite(result.value)) {
    return res.json({
      success: false,
      message: `Không tìm thấy hoặc không hợp lệ parameter: ${parameter}`,
      data: result
    });
  }

  res.json(result);
});


router.get("/stats", (req, res) => {
    const stations = getLatest();

    const stats = {
        totalStations: stations.length,
        bySource: {},
        sources: []
    };

    stations.forEach((item) => {
        if (!stats.bySource[item.source]) {
            stats.bySource[item.source] = 0;
        }

        stats.bySource[item.source]++;
    });

    stats.sources = Object.keys(stats.bySource).map((source) => ({
        source,
        totalStations: stats.bySource[source]
    }));

    res.json({
        success: true,
        data: stats
    });
});

router.get("/gauge-sum", (req, res) => {
    const { source, parameter } = req.query;

    const stationIds = String(req.query.station_ids || "")
        .split(",")
        .map(id => id.trim())
        .filter(Boolean);

    if (!source || !parameter || stationIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Thiếu source, parameter hoặc station_ids"
        });
    }

    const stations = getLatest(source);

    const selectedStations = stations.filter(item =>
        stationIds.includes(item.raw_station_id) ||
        stationIds.includes(item.station_id)
    );

    const values = selectedStations.map(item => {
        const rawValue = item.data[parameter];

        const value = Number(
            String(rawValue).replace(/,/g, "")
        );

        return {
            station_id: item.station_id,
            raw_station_id: item.raw_station_id,
            value
        };
    });

    const validValues = values.filter(item =>
        Number.isFinite(item.value)
    );

    const total = validValues.reduce((sum, item) => {
        return sum + item.value;
    }, 0);

    res.json({
        success: true,
        source,
        parameter,
        requested_station_ids: stationIds,
        matched_count: selectedStations.length,
        valid_count: validValues.length,
        value: total,
        items: validValues
    });
});

router.get("/total-flow-all", (req, res) => {
    const source = req.query.source || null;

    const stations = getLatest(source);

    const items = stations.map(item => {
        const flow = Number(
            String(item.data.flow ?? 0).replace(/,/g, "")
        );

        return {
            source: item.source,
            station_id: item.station_id,
            raw_station_id: item.raw_station_id,
            flow
        };
    });

    const validItems = items.filter(item =>
        Number.isFinite(item.flow)
    );

    const totalFlow = validItems.reduce((sum, item) => {
        return sum + item.flow;
    }, 0);

    res.json({
        success: true,
        source: source || "all",
        total_station_count: stations.length,
        valid_flow_count: validItems.length,
        value: totalFlow,
        unit: "m³/h",
        items: validItems
    });
});

module.exports = router;