"use strict";

/**
 * Map channel number → [stationId, parameter].
 * Thêm/bớt kênh tại đây khi lắp thêm sensor.
 */
const cnlMapping = {
	2902: ["gs4nm2", "level"],
	2904: ["gs4nm2", "flow"],
	2905: ["gs4nm2", "totalIndex"],

	2907: ["gs5nm1", "level"],
	2909: ["gs5nm1", "flow"],
	2910: ["gs5nm1", "totalIndex"],

	2912: ["gs4nm1", "level"],
	2914: ["gs4nm1", "flow"],
	2915: ["gs4nm1", "totalIndex"],

	2917: ["tb1", "level"],
	2919: ["tb1", "flow"],
	2920: ["tb1", "totalIndex"],

	2922: ["tb24", "amino"],
	2923: ["tb24", "level"],
	2925: ["tb24", "nitrat"],
	2926: ["tb24", "pH"],
	2927: ["tb24", "TDS"],

	2928: ["gs5nm1", "amino"],
	2929: ["gs5nm1", "nitrat"],
	2930: ["gs5nm1", "pH"],
	2931: ["gs5nm1", "TDS"],

	2932: ["gs4nm2", "amino"],
	2933: ["gs4nm2", "nitrat"],
	2934: ["gs4nm2", "pH"],
	2935: ["gs4nm2", "TDS"]
};

/**
 * Tra cnlMapping, trả về { station, parameter }.
 * Trả về null nếu channel không có trong map.
 * @param {number} cnlNum
 * @returns {{ station: string|null, parameter: string|null }}
 */
function mapCnlToStationAndParameter(cnlNum) {
	const mapped = cnlMapping[cnlNum];
	if (!mapped) return { station: null, parameter: null };
	const [station, parameter] = mapped;
	return { station, parameter };
}

module.exports = { cnlMapping, mapCnlToStationAndParameter };