"use strict";

const PARAMETER_MAP = {
	// Vietnamese → English
	"lưu lượng": "flow",
	"luu luong": "flow",
	"lưu lượng tức thời": "flow",
	"luu luong tuc thoi": "flow",
	"lưu lượng tổng": "total",
	"luu luong tong": "total",
	"tổng lưu lượng": "totalIndex",
	"tong luu luong": "totalIndex",
	"chỉ số tổng": "totalIndex",
	"chi so tong": "totalIndex",
	"chỉ số tổng đồng hồ lưu lượng": "totalIndex",
	"chi so tong dong ho luu luong": "totalIndex",
	"mực nước": "level",
	"muc nuoc": "level",
	ph: "ph",
	"độ ph": "ph",
	"do ph": "ph",
	"nhiet do": "temp",
	nhiet_do: "temp",
	cod: "cod",
	tss: "tss",
	"clo dư": "clo",
	"clo du": "clo",

	// English → English (chuẩn hóa)
	flow: "flow",
	level: "level",
	total: "total",
	totalindex: "totalIndex",
	temp: "temp",
	temperature: "temp",
	"total index": "totalIndex",
};

/**
 * Chuẩn hóa tên thông số về dạng key chuẩn.
 * Bỏ dấu, lowercase, trim rồi tra PARAMETER_MAP.
 * @param {string} paramName
 * @returns {string}
 */
function normalizeParameter(paramName) {
	if (!paramName) return "";
	const key = String(paramName)
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim();
	return PARAMETER_MAP[key] || key;
}

module.exports = { PARAMETER_MAP, normalizeParameter };