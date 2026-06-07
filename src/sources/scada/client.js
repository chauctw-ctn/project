"use strict";

const axios   = require("axios");
const cheerio = require("cheerio");
const { mapCnlToStationAndParameter } = require("./mapping");

const DEFAULT_CONFIG = {
	baseUrl:   process.env.SCADA_URL        || "http://14.161.36.253:86",
	loginUrl:  process.env.SCADA_LOGIN_URL  || "http://14.161.36.253:86/Scada/Login.aspx",
	username:  process.env.SCADA_USERNAME   || "cncamau",
	password:  process.env.SCADA_PASSWORD   || "cm123456",
	viewId:    Number(process.env.SCADA_VIEW_ID)    || 16,
	timeoutMs: Number(process.env.SCADA_TIMEOUT_MS) || 15000
};

// ── private helpers ───────────────────────────────────────────────────────────

function buildCurCnlUrl(config) {
	const params = new URLSearchParams({
		cnlNums: " ",
		viewIDs: " ",
		viewID:  String(config.viewId),
		_:       String(Date.now())
	});
	return `${config.baseUrl}/Scada/ClientApiSvc.svc/GetCurCnlDataExt?${params}`;
}

function createHttpClient(config) {
	return axios.create({
		timeout:        config.timeoutMs,
		maxRedirects:   5,
		validateStatus: (s) => s < 400,
		headers: {
			"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			Accept:            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
		}
	});
}

function collectCookies(existing, next) {
	const combined  = [...existing, ...next];
	const cookieSet = new Set(combined.map((c) => c.split(";")[0]));
	return Array.from(cookieSet).join("; ");
}

// ── exports ───────────────────────────────────────────────────────────────────

/**
 * Login vào Rapid SCADA, trả về { client, sessionCookie }.
 * @param {typeof DEFAULT_CONFIG} config
 */
async function loginScada(config) {
	const client = createHttpClient(config);

	const loginPage      = await client.get(config.loginUrl);
	const initialCookies = loginPage.headers["set-cookie"] || [];
	const initialHeader  = collectCookies([], initialCookies);

	const $                = cheerio.load(loginPage.data);
	const viewState        = $("input[name='__VIEWSTATE']").val();
	const eventValidation  = $("input[name='__EVENTVALIDATION']").val();
	const viewStateGen     = $("input[name='__VIEWSTATEGENERATOR']").val();

	if (!viewState) throw new Error("SCADA login failed: missing __VIEWSTATE");

	const loginData = new URLSearchParams({
		__VIEWSTATE:          viewState,
		__VIEWSTATEGENERATOR: viewStateGen    || "",
		__EVENTVALIDATION:    eventValidation || "",
		txtUsername:          config.username,
		txtPassword:          config.password,
		btnLogin:             "Login"
	});

	const loginResponse = await client.post(config.loginUrl, loginData.toString(), {
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Cookie:          initialHeader,
			Referer:         config.loginUrl
		}
	});

	const loginCookies  = loginResponse.headers["set-cookie"] || [];
	const sessionCookie = collectCookies(initialCookies, loginCookies);
	return { client, sessionCookie };
}

/**
 * Warm-up view cache để GetCurCnlDataExt trả đúng viewID.
 */
async function warmUpViewCache(config, client, sessionCookie) {
	const url = `${config.baseUrl}/Scada/View.aspx?viewID=${config.viewId}`;
	try {
		await client.get(url, {
			headers: { Cookie: sessionCookie, Referer: `${config.baseUrl}/Scada/View.aspx` }
		});
	} catch (err) {
		console.warn("[SCADA][CLIENT] Warm-up failed:", err.message || err);
	}
}

/**
 * Login → warm-up → fetch dữ liệu kênh hiện tại.
 *
 * @param {Partial<typeof DEFAULT_CONFIG>} [overrides]
 * @returns {Promise<{ url: string, raw: object, data: object[] }>}
 */
async function fetchScadaData(overrides = {}) {
	const config = { ...DEFAULT_CONFIG, ...overrides };
	const { client, sessionCookie } = await loginScada(config);
	await warmUpViewCache(config, client, sessionCookie);

	const url      = buildCurCnlUrl(config);
	const response = await client.get(url, {
		headers: {
			Accept:  "application/json",
			Cookie:  sessionCookie,
			Referer: `${config.baseUrl}/Scada/View.aspx`
		}
	});

	const payload = response.data;
	const parsed  = payload && payload.d ? JSON.parse(payload.d) : null;

	if (!parsed || !parsed.Success) {
		const message = parsed?.ErrorMessage ?? "Unknown SCADA error";
		throw new Error(`SCADA response error: ${message}`);
	}

	return {
		url,
		raw:  payload,
		data: (parsed.Data || []).map((item) => ({
			CnlNum: item.CnlNum,
			Text:   item.Text,
			...mapCnlToStationAndParameter(item.CnlNum)
		}))
	};
}

module.exports = { fetchScadaData, loginScada, warmUpViewCache };