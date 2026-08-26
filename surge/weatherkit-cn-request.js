// Force mainland China WeatherKit requests to include forecastNextHour.
// This intentionally matches the older .4/.5 behavior while next-hour
// precipitation is being isolated from the AQI path.
// Query country has priority over locale, so HK/MO/TW are never treated as CN
// just because the UI language/locale is Chinese.

const url = new URL($request.url);
const segments = url.pathname.split("/").filter(Boolean);
const locale = segments[3] || "";
const localeMatch = locale.match(/-([A-Za-z]{2})$/);
const localeCountry = localeMatch ? localeMatch[1].toUpperCase() : "";
const queryCountry = (url.searchParams.get("country") || "").toUpperCase();
const country = queryCountry || localeCountry;

if (url.hostname === "weatherkit.apple.com" && url.pathname.startsWith("/api/v2/weather/") && country === "CN") {
    const dataSets = (url.searchParams.get("dataSets") || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

    if (!dataSets.includes("forecastNextHour")) dataSets.push("forecastNextHour");
    url.searchParams.set("dataSets", dataSets.join(","));

    // Keep response matching deterministic when CN comes from locale.
    if (!queryCountry) url.searchParams.set("country", "CN");

    if ($request.headers) {
        delete $request.headers["If-None-Match"];
        delete $request.headers["if-none-match"];
    }

    $request.url = url.toString();
}

$done($request);
