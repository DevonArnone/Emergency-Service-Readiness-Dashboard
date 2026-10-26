#!/usr/bin/env python3
"""Build the county boundary GeoJSON used by the WebGL map.

Fetches the boundary from Fairfax County's public iCare ArcGIS service in
WGS84. When the service is unreachable, it inverse-projects the committed SVG
geometry in public/maps/fairfax-command-map.json instead, which is coarser
(about 60 m) but needs no network. Standard library only.
"""

from __future__ import annotations

import json
import math
import re
import ssl
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG_ASSET = ROOT / "public" / "maps" / "fairfax-command-map.json"
OUTPUT = ROOT / "public" / "maps" / "fairfax-county.geojson"
SERVICE = "https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer/0/query"
EARTH_RADIUS = 6378137


def fetch_service() -> dict:
    query = urllib.parse.urlencode({
        "where": "1=1", "outFields": "NAME", "outSR": 4326, "f": "geojson",
        "geometryPrecision": 6, "maxAllowableOffset": 0.00005,
    })
    context = ssl.create_default_context(cafile="/etc/ssl/cert.pem") if Path("/etc/ssl/cert.pem").is_file() else None
    with urllib.request.urlopen(f"{SERVICE}?{query}", timeout=30, context=context) as response:
        payload = json.load(response)
    geometry = payload["features"][0]["geometry"]
    return {"geometry": geometry, "source": "Fairfax County iCare ArcGIS service, layer 0 (WGS84)"}


def inverse_project_svg() -> dict:
    asset = json.loads(SVG_ASSET.read_text(encoding="utf-8"))
    transform = asset["projection"]["transform"]
    scale, tx, ty = transform["scale"], transform["translateX"], transform["translateY"]

    def lonlat(x: float, y: float) -> list[float]:
        mx, my = (x - tx) / scale, (ty - y) / scale
        lon = math.degrees(mx / EARTH_RADIUS)
        lat = math.degrees(2 * math.atan(math.exp(my / EARTH_RADIUS)) - math.pi / 2)
        return [round(lon, 6), round(lat, 6)]

    rings = []
    for chunk in re.findall(r"M[^M]+", asset["layers"]["county"]["path"]):
        points = [lonlat(float(x), float(y)) for x, y in re.findall(r"(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)", chunk)]
        if points[0] != points[-1]:
            points.append(points[0])
        rings.append(points)
    # Even-odd fill: the largest ring is the county, the others are the independent cities inside it.
    rings.sort(key=len, reverse=True)
    return {"geometry": {"type": "Polygon", "coordinates": rings}, "source": "Inverse projection of the committed SVG county path"}


def main() -> int:
    try:
        result = fetch_service()
    except Exception as error:  # noqa: BLE001 - any network failure falls back to the committed geometry
        print(f"service unavailable ({error}); using committed SVG geometry", file=sys.stderr)
        result = inverse_project_svg()
    collection = {
        "type": "FeatureCollection",
        "attribution": "Boundary: Fairfax County GIS (public). Simplified for display.",
        "source": result["source"],
        "features": [{"type": "Feature", "properties": {"name": "Fairfax County"}, "geometry": result["geometry"]}],
    }
    OUTPUT.write_text(json.dumps(collection, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} from {result['source']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
