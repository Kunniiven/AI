// Ensure forecastNextHour is requested where ColorfulClouds Minutely can provide
// a fallback. CN keeps its already-working path. HK/MO/TW are included here
// because Apple does not provide native next-hour precipitation there.

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

if (url.hostname === "weatherkit.apple.com" && url.pathname.startsWith("/api/v2/weather/") && colorfulCloudsMinutelyCountries.has(country)) {
    const dataSets = (url.searchParams.get("dataSets") || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

    if (!dataSets.includes("forecastNextHour")) dataSets.push("forecastNextHour");
    url.searchParams.set("dataSets", dataSets.join(","));

    if ($request.headers) {
        delete $request.headers["If-None-Match"];
        delete $request.headers["if-none-match"];
    }

    $request.url = url.toString();
}

$done($request);
