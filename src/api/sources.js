"use strict";

const express = require("express");
const {
	getLatest,
	getGaugeValue
} = require("../sources/latest-store");

const router = express.Router();

const STATION_GP = {
	GP393: [
		"clngs5nm1",
		"gs1nm1",
		"gs2nm1",
		"gs3nm1",
		"gs4nm1",
		"gs5nm1",
		"qt1nm1",
		"qt2nm1"
	],

	GP391: [
		"g21",
		"g26",
		"qt2m"
	],

	GP35: [
		"clnqt4",
		"g1",
		"g12",
		"g15",
		"g18",
		"g2",
		"g20",
		"g22",
		"g23",
		"g24",
		"g25",
		"g27",
		"g4",
		"qt3",
		"qt4",
		"qt5"
	],

	GP36: [
		"clngs4nm2",
		"gs1nm2",
		"gs2nm2",
		"gs3nm2",
		"gs4nm2",
		"qt1nm2",
		"qt2nm2"
	],

	GPSTN: [
		"20a",
		"30a",
		"31b",
		"gtacvan",
		"g16"
	]
};

function parseNumber(value) {
	const number = Number(String(value ?? 0).replace(/,/g, ""));
	return Number.isFinite(number) ? number : 0;
}

function normalizeRawStationId(rawStationId) {
	return String(rawStationId || "")
		.trim()
		.toLowerCase()
		.replace(/^monre_/, "")
		.replace(/^mqtt_/, "")
		.replace(/^scada_/, "")
		.replace(/^tva_/, "")
		.replace(/^tb/, "g")
		.replace(/^gtacvan$/, "tacvan")
		.replace(/^g20a$/, "20a")
		.replace(/^g30a$/, "30a")
		.replace(/^g31b$/, "31b");
}

function getItemValue(item, parameter) {
	return parseNumber(item.data?.[parameter]);
}

function getFlowValue(item) {
	return getItemValue(item, "flow");
}

function buildFlowItem(item) {
	return {
		source: item.source,
		station_id: item.station_id,
		raw_station_id: item.raw_station_id,
		normalized_raw_station_id: normalizeRawStationId(item.raw_station_id),
		flow: getFlowValue(item)
	};
}

function totalFlowByRawStationIds(stations, rawStationIds) {
	const rawSet = new Set(
		rawStationIds.map(normalizeRawStationId)
	);

	const items = stations
		.filter(item => rawSet.has(normalizeRawStationId(item.raw_station_id)))
		.map(buildFlowItem)
		.filter(item => Number.isFinite(item.flow));

	const totalFlow = items.reduce((sum, item) => sum + item.flow, 0);

	return {
		total_station_count: rawStationIds.length,
		matched_count: items.length,
		valid_flow_count: items.length,
		value: Number(totalFlow.toFixed(2)),
		unit: "m³/h",
		items
	};
}

function getAllGpStationIds() {
	return [
		...STATION_GP.GP393,
		...STATION_GP.GP391,
		...STATION_GP.GP35,
		...STATION_GP.GP36,
		...STATION_GP.GPSTN
	];
}

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
		stationIds.includes(item.station_id) ||
		stationIds.map(normalizeRawStationId).includes(normalizeRawStationId(item.raw_station_id))
	);

	const values = selectedStations.map(item => {
		const value = getItemValue(item, parameter);

		return {
			source: item.source,
			station_id: item.station_id,
			raw_station_id: item.raw_station_id,
			normalized_raw_station_id: normalizeRawStationId(item.raw_station_id),
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
		value: Number(total.toFixed(2)),
		items: validValues
	});
});

router.get("/total-flow-all", (req, res) => {
	const source = req.query.source || null;
	const stations = getLatest(source);

	const items = stations
		.map(buildFlowItem)
		.filter(item => Number.isFinite(item.flow));

	const totalFlow = items.reduce((sum, item) => {
		return sum + item.flow;
	}, 0);

	res.json({
		success: true,
		source: source || "all",
		total_station_count: stations.length,
		valid_flow_count: items.length,
		value: Number(totalFlow.toFixed(2)),
		unit: "m³/h",
		items
	});
});

router.get("/total-flow-gp-all", (req, res) => {
	const stations = getLatest();
	const result = totalFlowByRawStationIds(stations, getAllGpStationIds());

	res.json({
		success: true,
		source: "all",
		group: "ALL_GP",
		...result
	});
});

router.get("/total-flow-gp393", (req, res) => {
	const stations = getLatest();
	const result = totalFlowByRawStationIds(stations, STATION_GP.GP393);

	res.json({
		success: true,
		source: "all",
		group: "GP393",
		...result
	});
});

router.get("/total-flow-gp391", (req, res) => {
	const stations = getLatest();
	const result = totalFlowByRawStationIds(stations, STATION_GP.GP391);

	res.json({
		success: true,
		source: "all",
		group: "GP391",
		...result
	});
});

router.get("/total-flow-gp35", (req, res) => {
	const stations = getLatest();
	const result = totalFlowByRawStationIds(stations, STATION_GP.GP35);

	res.json({
		success: true,
		source: "all",
		group: "GP35",
		...result
	});
});

router.get("/total-flow-gp36", (req, res) => {
	const stations = getLatest();
	const result = totalFlowByRawStationIds(stations, STATION_GP.GP36);

	res.json({
		success: true,
		source: "all",
		group: "GP36",
		...result
	});
});

router.get("/total-flow-gpstn", (req, res) => {
	const stations = getLatest();
	const result = totalFlowByRawStationIds(stations, STATION_GP.GPSTN);

	res.json({
		success: true,
		source: "all",
		group: "GPSTN",
		...result
	});
});

module.exports = router;