// Track the country of the WeatherKit location currently being requested.
// This state is used by weather-map2 requests because precipitation map tiles
// often do not include a country query parameter on iOS 26.
// Also force mainland China WeatherKit requests to include forecastNextHour.

const url = new URL($request.url);
const segments = url.pathname.split("/").filter(Boolean);
const locale = segments[3] || "";
const localeMatch = locale.match(/-([A-Za-z]{2})$/);
const localeCountry = localeMatch ? localeMatch[1].toUpperCase() : "";
const queryCountry = (url.searchParams.get("country") || "").toUpperCase();
const country = queryCountry || localeCountry;
const stateKey = "@Kunniiven.WeatherKit.CNOnly.LastTargetCountry";

if (url.hostname === "weatherkit.apple.com" && url.pathname.startsWith("/api/v2/weather/")) {
    if (country && typeof $persistentStore !== "undefined") {
        $persistentStore.write(country, stateKey);
    }

    if (country === "CN") {
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
}

$done($request);
