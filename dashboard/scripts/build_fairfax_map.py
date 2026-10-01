#!/usr/bin/env python3
"""Build the offline Fairfax County command-map geometry asset.

The script reads public layers from Fairfax County's iCare ArcGIS REST service,
projects them into the dashboard's 920 x 600 SVG coordinate system, simplifies
them at display resolution, and writes deterministic JSON. It intentionally
uses only the Python standard library.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


SERVICE_URL = "https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "public" / "maps" / "fairfax-command-map.json"
VIEWBOX = (0, 0, 920, 600)
DRAW_BOUNDS = (36.0, 18.0, 884.0, 582.0)
CLIP_BOUNDS = (0.0, 0.0, 920.0, 600.0)
PAGE_SIZE = 2_000
USER_AGENT = "AegisMapAssetBuilder/1.0 (offline general-information map)"


def certificate_context() -> ssl.SSLContext:
    """Use an explicit OS certificate bundle when framework Python has none."""
    candidates = (os.environ.get("SSL_CERT_FILE"), "/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt")
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ssl.create_default_context(cafile=candidate)
    return ssl.create_default_context()


SSL_CONTEXT = certificate_context()


@dataclass(frozen=True)
class LayerSpec:
    key: str
    layer_id: int
    where: str
    fields: tuple[str, ...]
    tolerance: float


LAYER_SPECS = (
    LayerSpec("county", 0, "1=1", ("NAME",), 0.45),
    LayerSpec("major_roads", 1, "1=1", ("ROAD_CLASS", "ROUTE", "STNAME", "STR_LAB"), 0.75),
    LayerSpec(
        "streets",
        2,
        "FFX_CLASS IN ('FRE','EXP','MAA','MEA','MIA','PKY','COL')",
        ("FFX_CLASS", "FULLNAME", "ROUTE_ALIAS"),
        1.1,
    ),
    LayerSpec("local_streets", 2, "FFX_CLASS='LOC'", ("FFX_CLASS",), 1.8),
    LayerSpec(
        "water_bodies",
        10,
        "VISIBLE='Y' AND TYPE IN ('RIVER','LAKE','POND')",
        ("NAME", "TYPE"),
        0.65,
    ),
    LayerSpec(
        "streams",
        11,
        "VISIBLE='Y' AND CENTERLINE='Y' AND (TYPE='RIVER' OR (TYPE='STREAM' AND STREAMORDER >= 3))",
        ("NAME", "TYPE", "STREAMORDER"),
        1.0,
    ),
)


def fetch_json(url: str, params: dict[str, Any] | None = None, attempts: int = 4) -> dict[str, Any]:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=90, context=SSL_CONTEXT) as response:
                payload = json.load(response)
            if "error" in payload:
                raise RuntimeError(f"ArcGIS error for {url}: {payload['error']}")
            return payload
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == attempts - 1:
                raise RuntimeError(f"Unable to read {url}: {error}") from error
            time.sleep(1.5 * (attempt + 1))
    raise AssertionError("unreachable")


def layer_metadata(layer_id: int) -> dict[str, Any]:
    return fetch_json(f"{SERVICE_URL}/{layer_id}", {"f": "json"})


def query_layer(spec: LayerSpec) -> tuple[list[dict[str, Any]], str]:
    metadata = layer_metadata(spec.layer_id)
    oid = next((field["name"] for field in metadata["fields"] if field["type"] == "esriFieldTypeOID"), "OBJECTID")
    output_fields = ",".join((oid, *spec.fields))
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        payload = fetch_json(
            f"{SERVICE_URL}/{spec.layer_id}/query",
            {
                "where": spec.where,
                "outFields": output_fields,
                "returnGeometry": "true",
                "outSR": "3857",
                "orderByFields": f"{oid} ASC",
                "resultOffset": offset,
                "resultRecordCount": PAGE_SIZE,
                "returnExceededLimitFeatures": "true",
                "f": "json",
            },
        )
        page = payload.get("features", [])
        rows.extend(page)
        offset += len(page)
        if not page or (len(page) < PAGE_SIZE and not payload.get("exceededTransferLimit", False)):
            break

    rows.sort(key=lambda feature: sortable_id(feature.get("attributes", {}).get(oid)))
    return rows, oid


def sortable_id(value: Any) -> tuple[int, str]:
    try:
        return (0, f"{int(value):020d}")
    except (TypeError, ValueError):
        return (1, str(value))


def geometry_parts(feature: dict[str, Any]) -> tuple[str, list[list[list[float]]]]:
    geometry = feature.get("geometry") or {}
    if "rings" in geometry:
        return "polygon", geometry["rings"]
    if "paths" in geometry:
        return "polyline", geometry["paths"]
    return "unknown", []


def all_points(features: Iterable[dict[str, Any]]) -> Iterable[tuple[float, float]]:
    for feature in features:
        _, parts = geometry_parts(feature)
        for part in parts:
            for x, y in part:
                yield float(x), float(y)


def bounds_for(features: Sequence[dict[str, Any]]) -> tuple[float, float, float, float]:
    points = list(all_points(features))
    if not points:
        raise RuntimeError("County border query returned no geometry")
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def uniform_transform(source_bounds: tuple[float, float, float, float]) -> tuple[float, float, float]:
    """One geographic scale for both axes, centred in DRAW_BOUNDS: x = tx + mx*s, y = ty - my*s."""
    source_left, source_bottom, source_right, source_top = source_bounds
    draw_left, draw_top, draw_right, draw_bottom = DRAW_BOUNDS
    scale = min((draw_right - draw_left) / (source_right - source_left), (draw_bottom - draw_top) / (source_top - source_bottom))
    centre_x = (draw_left + draw_right) / 2
    centre_y = (draw_top + draw_bottom) / 2
    translate_x = centre_x - (source_left + source_right) / 2 * scale
    translate_y = centre_y + (source_bottom + source_top) / 2 * scale
    return scale, translate_x, translate_y


def projector(source_bounds: tuple[float, float, float, float]):
    scale, translate_x, translate_y = uniform_transform(source_bounds)

    def project(point: Sequence[float]) -> tuple[float, float]:
        x, y = point
        return translate_x + x * scale, translate_y - y * scale

    return project


def squared_distance_to_segment(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return (px - x1) ** 2 + (py - y1) ** 2
    factor = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    near_x, near_y = x1 + factor * dx, y1 + factor * dy
    return (px - near_x) ** 2 + (py - near_y) ** 2


def simplify(points: Sequence[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    if len(points) <= 2:
        return list(points)
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    threshold = tolerance * tolerance
    while stack:
        start, end = stack.pop()
        farthest = -1
        farthest_distance = threshold
        for index in range(start + 1, end):
            distance = squared_distance_to_segment(points[index], points[start], points[end])
            if distance > farthest_distance:
                farthest, farthest_distance = index, distance
        if farthest >= 0:
            keep.add(farthest)
            stack.append((start, farthest))
            stack.append((farthest, end))
    return [points[index] for index in sorted(keep)]


def simplify_ring(points: Sequence[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Simplify a closed ring without introducing a long closing chord."""
    if len(points) <= 3:
        return list(points)
    left_index = min(range(len(points)), key=lambda index: (points[index][0], points[index][1]))
    right_index = max(range(len(points)), key=lambda index: (points[index][0], points[index][1]))
    if left_index > right_index:
        left_index, right_index = right_index, left_index
    first_arc = list(points[left_index : right_index + 1])
    second_arc = list(points[right_index:]) + list(points[: left_index + 1])
    first_arc = simplify(first_arc, tolerance)
    second_arc = simplify(second_arc, tolerance)
    return first_arc + second_arc[1:-1]


def normalized_part(
    points: Sequence[Sequence[float]],
    project,
    tolerance: float,
    polygon: bool,
) -> list[tuple[float, float]]:
    projected: list[tuple[float, float]] = []
    for point in points:
        candidate = project(point)
        if not projected or candidate != projected[-1]:
            projected.append(candidate)
    if polygon and len(projected) > 1 and projected[0] == projected[-1]:
        projected.pop()
    minimum = 3 if polygon else 2
    if len(projected) < minimum:
        return []
    projected = simplify_ring(projected, tolerance) if polygon else simplify(projected, tolerance)
    return projected if len(projected) >= minimum else []


def polygon_area(points: Sequence[tuple[float, float]]) -> float:
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(points, (*points[1:], points[0]))) / 2)


def clip_segment(
    start: tuple[float, float],
    end: tuple[float, float],
) -> tuple[tuple[float, float], tuple[float, float]] | None:
    """Clip one line segment to the SVG view box with Liang–Barsky."""
    left, top, right, bottom = CLIP_BOUNDS
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    lower, upper = 0.0, 1.0
    for direction, distance in (
        (-dx, x1 - left),
        (dx, right - x1),
        (-dy, y1 - top),
        (dy, bottom - y1),
    ):
        if direction == 0:
            if distance < 0:
                return None
            continue
        ratio = distance / direction
        if direction < 0:
            lower = max(lower, ratio)
        else:
            upper = min(upper, ratio)
        if lower > upper:
            return None
    return ((x1 + lower * dx, y1 + lower * dy), (x1 + upper * dx, y1 + upper * dy))


def same_point(first: tuple[float, float], second: tuple[float, float]) -> bool:
    return abs(first[0] - second[0]) < 1e-6 and abs(first[1] - second[1]) < 1e-6


def clip_polyline(points: Sequence[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    parts: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    for start, end in zip(points, points[1:]):
        clipped = clip_segment(start, end)
        if clipped is None:
            if len(current) >= 2:
                parts.append(current)
            current = []
            continue
        clipped_start, clipped_end = clipped
        if current and same_point(current[-1], clipped_start):
            if not same_point(current[-1], clipped_end):
                current.append(clipped_end)
        else:
            if len(current) >= 2:
                parts.append(current)
            current = [clipped_start, clipped_end]
    if len(current) >= 2:
        parts.append(current)
    return parts


def clip_polygon(points: Sequence[tuple[float, float]]) -> list[tuple[float, float]]:
    """Clip a polygon ring to the SVG view box with Sutherland–Hodgman."""
    left, top, right, bottom = CLIP_BOUNDS

    def clip_edge(
        source: list[tuple[float, float]],
        inside,
        intersection,
    ) -> list[tuple[float, float]]:
        if not source:
            return []
        output: list[tuple[float, float]] = []
        previous = source[-1]
        previous_inside = inside(previous)
        for current in source:
            current_inside = inside(current)
            if current_inside:
                if not previous_inside:
                    output.append(intersection(previous, current))
                output.append(current)
            elif previous_inside:
                output.append(intersection(previous, current))
            previous, previous_inside = current, current_inside
        return output

    def vertical(first: tuple[float, float], second: tuple[float, float], x: float) -> tuple[float, float]:
        if second[0] == first[0]:
            return x, first[1]
        ratio = (x - first[0]) / (second[0] - first[0])
        return x, first[1] + ratio * (second[1] - first[1])

    def horizontal(first: tuple[float, float], second: tuple[float, float], y: float) -> tuple[float, float]:
        if second[1] == first[1]:
            return first[0], y
        ratio = (y - first[1]) / (second[1] - first[1])
        return first[0] + ratio * (second[0] - first[0]), y

    output = list(points)
    output = clip_edge(output, lambda point: point[0] >= left, lambda first, second: vertical(first, second, left))
    output = clip_edge(output, lambda point: point[0] <= right, lambda first, second: vertical(first, second, right))
    output = clip_edge(output, lambda point: point[1] >= top, lambda first, second: horizontal(first, second, top))
    output = clip_edge(output, lambda point: point[1] <= bottom, lambda first, second: horizontal(first, second, bottom))
    return output


def number(value: float) -> str:
    rounded = round(value, 1)
    if abs(rounded) < 0.05:
        rounded = 0.0
    return f"{rounded:.1f}".rstrip("0").rstrip(".")


def svg_path(parts: Sequence[Sequence[tuple[float, float]]], close: bool = False) -> str:
    commands: list[str] = []
    for part in parts:
        if not part:
            continue
        commands.append(f"M{number(part[0][0])} {number(part[0][1])}")
        commands.extend(f"L{number(x)} {number(y)}" for x, y in part[1:])
        if close:
            commands.append("Z")
    return "".join(commands)


def projected_parts(
    features: Sequence[dict[str, Any]],
    project,
    tolerance: float,
    polygon: bool,
    minimum_area: float = 0,
) -> tuple[list[list[tuple[float, float]]], int]:
    output: list[list[tuple[float, float]]] = []
    input_vertices = 0
    for feature in features:
        _, parts = geometry_parts(feature)
        for part in parts:
            input_vertices += len(part)
            normalized = normalized_part(part, project, tolerance, polygon)
            if not normalized:
                continue
            if polygon:
                clipped_polygon = simplify_ring(clip_polygon(normalized), tolerance)
                if len(clipped_polygon) >= 3 and polygon_area(clipped_polygon) >= minimum_area:
                    output.append(clipped_polygon)
            else:
                for clipped_line in clip_polyline(normalized):
                    simplified_line = simplify(clipped_line, tolerance)
                    if len(simplified_line) >= 2:
                        output.append(simplified_line)
    return output, input_vertices


def inverse_web_mercator(x: float, y: float) -> tuple[float, float]:
    radius = 6_378_137.0
    longitude = math.degrees(x / radius)
    latitude = math.degrees(math.atan(math.sinh(y / radius)))
    return longitude, latitude


def road_group(attributes: dict[str, Any]) -> str:
    road_class = (attributes.get("FFX_CLASS") or "").strip().upper()
    if road_class in {"FRE", "EXP"}:
        return "freeway"
    if road_class in {"MAA", "MEA", "MIA", "PKY"}:
        return "arterial"
    return "collector"


def route_labels(features: Sequence[dict[str, Any]], project) -> list[dict[str, Any]]:
    supported_routes = {"1", "7", "28", "29", "50", "66", "95", "123", "236", "244", "267", "395", "495", "7100"}
    by_route: dict[str, list[tuple[float, float]]] = {}
    for feature in features:
        route = str(feature.get("attributes", {}).get("ROUTE") or "").strip()
        if route not in supported_routes:
            continue
        _, parts = geometry_parts(feature)
        by_route.setdefault(route, []).extend(project(point) for part in parts for point in part)
    labels = []
    for route in sorted(by_route, key=lambda value: (len(value), value)):
        points = by_route[route]
        if not points:
            continue
        labels.append(
            {
                "route": route,
                "x": round(sum(point[0] for point in points) / len(points), 1),
                "y": round(sum(point[1] for point in points) / len(points), 1),
            }
        )
    return labels


def build_asset() -> dict[str, Any]:
    fetched: dict[str, list[dict[str, Any]]] = {}
    oid_fields: dict[str, str] = {}
    for spec in LAYER_SPECS:
        print(f"Fetching layer {spec.layer_id}: {spec.key}", file=sys.stderr)
        fetched[spec.key], oid_fields[spec.key] = query_layer(spec)

    source_bounds = bounds_for(fetched["county"])
    project = projector(source_bounds)
    layer_stats: dict[str, dict[str, int]] = {}

    county_parts, county_vertices = projected_parts(
        fetched["county"], project, LAYER_SPECS[0].tolerance, polygon=True
    )
    layer_stats["county"] = {
        "features": len(fetched["county"]),
        "paths": len(county_parts),
        "sourceVertices": county_vertices,
        "outputVertices": sum(map(len, county_parts)),
    }

    major_parts, major_vertices = projected_parts(
        fetched["major_roads"], project, LAYER_SPECS[1].tolerance, polygon=False
    )
    layer_stats["majorRoads"] = {
        "features": len(fetched["major_roads"]),
        "paths": len(major_parts),
        "sourceVertices": major_vertices,
        "outputVertices": sum(map(len, major_parts)),
    }

    street_groups: dict[str, list[dict[str, Any]]] = {"freeway": [], "arterial": [], "collector": []}
    for feature in fetched["streets"]:
        street_groups[road_group(feature.get("attributes", {}))].append(feature)
    street_paths: dict[str, str] = {}
    for group, features in street_groups.items():
        parts, source_vertices = projected_parts(features, project, LAYER_SPECS[2].tolerance, polygon=False)
        street_paths[group] = svg_path(parts)
        layer_stats[f"streets.{group}"] = {
            "features": len(features),
            "paths": len(parts),
            "sourceVertices": source_vertices,
            "outputVertices": sum(map(len, parts)),
        }

    # A stable one-in-two register of local roads restores the fine-grained
    # street texture at wall-board scale without turning the offline asset
    # into a full street database. The geometry remains sourced from iCare.
    local_oid = oid_fields["local_streets"]
    local_sample = [
        feature for feature in fetched["local_streets"]
        if int(feature.get("attributes", {}).get(local_oid, 0)) % 2 == 0
    ]
    local_parts, local_vertices = projected_parts(
        local_sample, project, LAYER_SPECS[3].tolerance, polygon=False
    )
    street_paths["local"] = svg_path(local_parts)
    layer_stats["streets.local"] = {
        "features": len(local_sample),
        "paths": len(local_parts),
        "sourceVertices": local_vertices,
        "outputVertices": sum(map(len, local_parts)),
    }

    water_parts, water_vertices = projected_parts(
        fetched["water_bodies"],
        project,
        LAYER_SPECS[4].tolerance,
        polygon=True,
        minimum_area=3.0,
    )
    layer_stats["waterBodies"] = {
        "features": len(fetched["water_bodies"]),
        "paths": len(water_parts),
        "sourceVertices": water_vertices,
        "outputVertices": sum(map(len, water_parts)),
    }

    stream_parts, stream_vertices = projected_parts(
        fetched["streams"], project, LAYER_SPECS[5].tolerance, polygon=False
    )
    layer_stats["streams"] = {
        "features": len(fetched["streams"]),
        "paths": len(stream_parts),
        "sourceVertices": stream_vertices,
        "outputVertices": sum(map(len, stream_parts)),
    }

    lower_left = inverse_web_mercator(source_bounds[0], source_bounds[1])
    upper_right = inverse_web_mercator(source_bounds[2], source_bounds[3])
    return {
        "schemaVersion": 1,
        "name": "Fairfax County command map",
        "viewBox": list(VIEWBOX),
        "projection": {
            "type": "uniform-fit-web-mercator",
            "sourceSpatialReference": "EPSG:3857",
            "preserveAspectRatio": True,
            "transform": dict(zip(("scale", "translateX", "translateY"), (round(value, 9) for value in uniform_transform(source_bounds)))),
            "drawBounds": list(DRAW_BOUNDS),
            "sourceBounds": [round(value, 3) for value in source_bounds],
            "geographicBounds": [
                round(lower_left[0], 6),
                round(lower_left[1], 6),
                round(upper_right[0], 6),
                round(upper_right[1], 6),
            ],
        },
        "attribution": "Fairfax County, Virginia — DTA/iCare ArcGIS MapServer",
        "disclaimer": "General planning context only. Not for dispatch, navigation, boundary determination, or emergency response decisions. Verify against authoritative Fairfax County systems.",
        "sources": [
            {
                "layer": spec.key,
                "layerId": spec.layer_id,
                "url": f"{SERVICE_URL}/{spec.layer_id}",
                "where": spec.where,
                "oidField": oid_fields[spec.key],
            }
            for spec in LAYER_SPECS
        ],
        "layers": {
            "county": {"fillRule": "evenodd", "path": svg_path(county_parts, close=True)},
            "waterBodies": {"fillRule": "evenodd", "path": svg_path(water_parts, close=True)},
            "streams": {"path": svg_path(stream_parts)},
            "streets": street_paths,
            "majorRoads": {"path": svg_path(major_parts)},
            "routeLabels": route_labels(fetched["major_roads"], project),
        },
        "stats": layer_stats,
    }


def reproject_legacy_asset(asset: dict[str, Any]) -> dict[str, Any]:
    """Convert an asset written with independent x/y fitting to the single-scale projection.

    The legacy fit was an exact per-axis affine of Web Mercator, so its coordinates invert
    without refetching. Simplification and clipping already applied are preserved.
    """
    projection = asset["projection"]
    if projection.get("preserveAspectRatio"):
        return asset
    source_left, source_bottom, source_right, source_top = projection["sourceBounds"]
    draw_left, draw_top, draw_right, draw_bottom = projection["drawBounds"]
    scale_x = (draw_right - draw_left) / (source_right - source_left)
    scale_y = (draw_bottom - draw_top) / (source_top - source_bottom)
    project = projector((source_left, source_bottom, source_right, source_top))

    def convert(x: float, y: float) -> tuple[float, float]:
        return project((source_left + (x - draw_left) / scale_x, source_top - (y - draw_top) / scale_y))

    def convert_path(path: str) -> str:
        parts: list[list[tuple[float, float]]] = []
        closed = "Z" in path
        for chunk in path.replace("Z", "").split("M")[1:]:
            points = []
            for pair in chunk.split("L"):
                x, y = (float(value) for value in pair.split())
                points.append(convert(x, y))
            parts.append(points)
        return svg_path(parts, close=closed)

    layers = asset["layers"]
    for key in ("county", "waterBodies", "streams", "majorRoads"):
        layers[key]["path"] = convert_path(layers[key]["path"])
    for key, path in layers["streets"].items():
        layers["streets"][key] = convert_path(path)
    for label in layers["routeLabels"]:
        label["x"], label["y"] = (round(value, 1) for value in convert(label["x"], label["y"]))
    bounds = (source_left, source_bottom, source_right, source_top)
    projection.update({
        "type": "uniform-fit-web-mercator",
        "preserveAspectRatio": True,
        "transform": dict(zip(("scale", "translateX", "translateY"), (round(value, 9) for value in uniform_transform(bounds)))),
    })
    return asset


def validate_asset(asset: dict[str, Any], path: Path) -> None:
    if asset.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported or missing schemaVersion")
    if asset.get("viewBox") != list(VIEWBOX):
        raise RuntimeError("Unexpected SVG viewBox")
    if not asset.get("projection", {}).get("preserveAspectRatio"):
        raise RuntimeError("Map geometry must use one geographic scale for both axes")
    layers = asset.get("layers", {})
    required_paths = (
        layers.get("county", {}).get("path"),
        layers.get("waterBodies", {}).get("path"),
        layers.get("streams", {}).get("path"),
        layers.get("majorRoads", {}).get("path"),
        layers.get("streets", {}).get("freeway"),
        layers.get("streets", {}).get("arterial"),
    )
    if not all(isinstance(value, str) and value.startswith("M") for value in required_paths):
        raise RuntimeError("One or more required map layers has no SVG path data")
    if path.stat().st_size > 1_000_000:
        raise RuntimeError(f"Map asset is too large: {path.stat().st_size:,} bytes")
    for layer, stats in asset.get("stats", {}).items():
        if stats["outputVertices"] > stats["sourceVertices"]:
            raise RuntimeError(f"{layer} output contains more vertices than its source")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Generated JSON asset path")
    parser.add_argument("--verify-only", action="store_true", help="Validate an existing asset without network access")
    parser.add_argument("--reproject", action="store_true", help="Convert a legacy per-axis asset to one geographic scale without network access")
    args = parser.parse_args()
    output = args.output.resolve()

    if args.reproject:
        asset = reproject_legacy_asset(json.loads(output.read_text(encoding="utf-8")))
        output.write_text(json.dumps(asset, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
        validate_asset(asset, output)
        print(f"Reprojected {output} ({output.stat().st_size:,} bytes)")
        return 0

    if args.verify_only:
        asset = json.loads(output.read_text(encoding="utf-8"))
        validate_asset(asset, output)
        print(f"Validated {output} ({output.stat().st_size:,} bytes)")
        return 0

    asset = build_asset()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(asset, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
    validate_asset(asset, output)
    print(f"Wrote {output} ({output.stat().st_size:,} bytes)")
    for layer, stats in asset["stats"].items():
        print(f"  {layer}: {stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
