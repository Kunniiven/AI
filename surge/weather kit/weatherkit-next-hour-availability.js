// Add forecastNextHour availability where ColorfulClouds Minutely is supported.
// CN is handled by the existing CN path. All other Caiyun-supported regions,
// including HK/MO/TW, can receive a next-hour fallback when Apple does not.

const url = new URL($request.url);
const segments = url.pathname.split("/").filter(Boolean);
const locale = segments[3] || "";
const localeMatch = locale.match(/-([A-Za-z]{2})$/);
const localeCountry = localeMatch ? localeMatch[1].toUpperCase() : "";
const queryCountry = (url.searchParams.get("country") || "").toUpperCase();
const country = queryCountry || localeCountry;

const colorfulCloudsMinutelyCountries = new Set([
    "HK", "MO", "TW",
    "IT", "LT", "MT", "FR", "SK", "NO", "BY", "IS", "CZ", "SI", "DE", "ES", "UA", "DK", "PL", "FI", "SE", "HR", "RU", "RO", "PT", "EE", "RS", "AT", "GR", "HU",
    "FJ", "GU", "MH", "NC", "TR", "BH", "SA", "ID", "IR", "SG", "OM", "PH", "IN", "KH", "CY", "MY", "VN", "KW", "TH", "KR", "KP", "CA", "BS", "KY", "MX", "PA",
    "MQ", "CU", "BM", "PR", "CW", "GP", "NI", "BR", "GF", "CO", "GY", "PY", "AR",
]);

let body = $response.body;

if (colorfulCloudsMinutelyCountries.has(country)) {
    try {
        const appleCapabilities = JSON.parse(body);
        if (Array.isArray(appleCapabilities) && !appleCapabilities.includes("forecastNextHour")) {
            appleCapabilities.push("forecastNextHour");
            body = JSON.stringify(appleCapabilities);
        }
    } catch (_) {
        // Preserve Apple's original response when it is not valid JSON.
    }
}

$done({ body });
