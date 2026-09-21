# Fairfax County command-map geometry

`fairfax-command-map.json` is a build-time snapshot for Aegis' 920 × 600 SVG
command map. The application can render it without contacting a third-party map
service at runtime.

## Official sources

The geometry comes from the Fairfax County, Virginia **DTA/iCare ArcGIS
MapServer**:

- [County Border — layer 0](https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer/0)
- [Major Roads — layer 1](https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer/1)
- [Streets — layer 2](https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer/2)
- [Water Bodies — layer 10](https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer/10)
- [Streams — layer 11](https://www.fairfaxcounty.gov/gisint2/rest/services/DTA/iCare/MapServer/11)

Source attribution: **Fairfax County, Virginia**. The generated asset records
the exact query filters and layer URLs in its `sources` field.

## Rebuilding

From `dashboard/`:

```bash
python3 scripts/build_fairfax_map.py
python3 scripts/build_fairfax_map.py --verify-only
```

The standard-library builder pages through the public service in stable object
ID order, requests Web Mercator geometry, fits it to the SVG view box, applies
display-resolution Ramer–Douglas–Peucker simplification, and emits deterministic
minified JSON. Streets are limited to freeway, expressway, arterial, parkway,
and collector classes. Water is limited to visible rivers, lakes, ponds, and
higher-order stream centerlines. Tiny water polygons below three SVG square
pixels are omitted.

## Use limitation

This derivative is **general planning context only**. It is not suitable for
dispatch, navigation, legal boundary determination, or emergency response
decisions. Verify operational information against authoritative Fairfax County
systems. Aegis is an unofficial concept and is not endorsed by Fairfax County.
