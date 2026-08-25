// Experimental CN-only precipitation-map unlock for Apple Weather on iOS 26.
// Based on the mapOverlay handling present in NSRingo/WeatherKit's current dev Request.mjs.
// Only changes the GeoCountryCode/geocountrycode request header when it explicitly equals CN.
// HK/MO/TW/other regions are left untouched.

const url = new URL($request.url);
const precipitationPaths = new Set([
  "/v1/mapOverlay/precipitationRadarMap",
  "/v1/mapOverlay/precipitationForecastByFrameTime",
]);

if (url.hostname === "weather-map2.apple.com" && precipitationPaths.has(url.pathname)) {
  const headers = $request.headers || {};
  const countryHeaderKey = Object.keys(headers).find(
    key => key.toLowerCase() === "geocountrycode",
  );

  if (countryHeaderKey && String(headers[countryHeaderKey]).toUpperCase() === "CN") {
    headers[countryHeaderKey] = "US";
    $request.headers = headers;
  }
}

$done($request);
