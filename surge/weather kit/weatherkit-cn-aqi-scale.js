// Normalize the Chinese WeatherKit AQI scale URL on iOS 26.6+.
// Apple currently appends a numeric schema version such as .2604.
// iRingo v3.3.1 strips that suffix before requesting the scale definition.
// This script intentionally touches HJ6332012 only, leaving HK/MO/TW/native
// WeatherKit air-quality scales unchanged.

const url = new URL($request.url);

if (url.hostname === "weatherkit.apple.com" && url.pathname.startsWith("/api/v1/airQualityScale/")) {
    const parts = url.pathname.split("/");
    const scaleIndex = parts.length - 1;
    const scale = parts[scaleIndex] || "";

    if (/^HJ6332012(?:\.\d+)?$/i.test(scale)) {
        parts[scaleIndex] = "HJ6332012";
        url.pathname = parts.join("/");

        if ($request.headers) {
            delete $request.headers["If-None-Match"];
            delete $request.headers["if-none-match"];
        }

        $request.url = url.toString();
    }
}

$done($request);
