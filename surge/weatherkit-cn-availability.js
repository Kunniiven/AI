// CN-only WeatherKit availability modifier.
// Mainland China gets the capabilities required by iRingo plus weatherMaps.
// HK/MO/TW/other regions keep Apple's original capability list untouched.

const url = new URL($request.url);
const segments = url.pathname.split("/").filter(Boolean);
const locale = segments[3] || "";
const localeMatch = locale.match(/-([A-Za-z]{2})$/);
const localeCountry = localeMatch ? localeMatch[1].toUpperCase() : "";
const queryCountry = (url.searchParams.get("country") || "").toUpperCase();
const country = queryCountry || localeCountry;

let body = $response.body;

if (country === "CN") {
    try {
        const appleCapabilities = JSON.parse(body);
        if (Array.isArray(appleCapabilities)) {
            const cnCapabilities = [
                "airQuality",
                "currentWeather",
                "forecastDaily",
                "forecastHourly",
                "forecastPeriodic",
                "historicalComparisons",
                "weatherChanges",
                "forecastNextHour",
                "weatherAlerts",
                "weatherAlertNotifications",
                "news",
                "weatherMaps",
            ];
            body = JSON.stringify([...new Set([...appleCapabilities, ...cnCapabilities])]);
        }
    } catch (_) {
        // On malformed/non-JSON responses, preserve Apple's original response.
    }
}

$done({ body });
