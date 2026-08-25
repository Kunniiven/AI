// Experimental CN-only precipitation-map unlock for Apple Weather on iOS 26.
// Mainland target detection uses the mapOverlay URL's country=CN parameter.
// To avoid invalidating the request's HHMAC authorization, the URL/query is left unchanged.
// Only the GeoCountryCode/geocountrycode request header is forced to US for CN precipitation overlays.
// HK/MO/TW/other target regions are left untouched.

const url = new URL($request.url);
const precipitationPaths = new Set([
  "/v1/mapOverlay/precipitationRadarMap",
  "/v1/mapOverlay/precipitationForecastByFrameTime",
]);

const targetCountry = (url.searchParams.get("country") || "").toUpperCase();

if (
  url.hostname === "weather-map2.apple.com" &&
  precipitationPaths.has(url.pathname) &&
  targetCountry === "CN"
) {
  const headers = $request.headers || {};
  const existingKey = Object.keys(headers).find(
    key => key.toLowerCase() === "geocountrycode",
  );

  if (existingKey) {
    headers[existingKey] = "US";
  } else {
    headers.geocountrycode = "US";
  }

  $request.headers = headers;
}

$done($request);
