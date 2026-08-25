// Experimental CN-only precipitation-map unlock for Apple Weather on iOS 26.
// iOS 26 precipitation tile URLs often omit country=..., so target country is tracked
// from other mapOverlay requests (e.g. airQuality?country=CN) and WeatherKit requests.
// The URL/query is never changed to avoid invalidating HHMAC authorization.
// Only GeoCountryCode/geocountrycode is forced to US for precipitation overlays whose
// tracked target country is CN. HK/MO/TW/other target regions are left untouched.

const url = new URL($request.url);
const stateKey = "@Kunniiven.WeatherKit.CNOnly.LastTargetCountry";
const precipitationPaths = new Set([
  "/v1/mapOverlay/precipitationRadarMap",
  "/v1/mapOverlay/precipitationForecastByFrameTime",
]);

if (url.hostname === "weather-map2.apple.com" && url.pathname.startsWith("/v1/mapOverlay/")) {
  const explicitCountry = (url.searchParams.get("country") || "").toUpperCase();

  // Some overlays such as airQuality explicitly carry country=CN/HK/etc.
  // Keep this as the freshest target-location hint for later precipitation tile requests.
  if (explicitCountry && typeof $persistentStore !== "undefined") {
    $persistentStore.write(explicitCountry, stateKey);
  }

  if (precipitationPaths.has(url.pathname)) {
    let targetCountry = explicitCountry;
    if (!targetCountry && typeof $persistentStore !== "undefined") {
      targetCountry = ($persistentStore.read(stateKey) || "").toUpperCase();
    }

    if (targetCountry === "CN") {
      const headers = $request.headers || {};
      const existingKey = Object.keys(headers).find(
        key => key.toLowerCase() === "geocountrycode",
      );

      if (existingKey) headers[existingKey] = "US";
      else headers.geocountrycode = "US";

      $request.headers = headers;
    }
  }
}

$done($request);
