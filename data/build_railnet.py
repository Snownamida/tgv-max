#!/usr/bin/env python3
"""Régénère public/railnet.geojson : le réseau ferré français, simplifié, coloré par vitesse.

Source : dataset SNCF « vitesse-maximale-nominale-sur-ligne » (2373 tronçons avec
géométrie + vitesse maximale). On simplifie chaque tronçon (Douglas-Peucker),
on arrondit les coordonnées et on ne garde qu'un niveau de vitesse `v` :
    3 = LGV (≥ 250 km/h) · 2 = 200-249 · 1 = 120-199 · 0 = < 120 km/h
Résultat ~0,6 Mo, chargé à la demande (fetch) par la couche carto.

Usage :  python3 data/build_railnet.py     (depuis la racine du projet)
"""
import urllib.request, json, ssl, math, os

CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
EXPORT = ("https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/"
          "vitesse-maximale-nominale-sur-ligne/exports/geojson?select=v_max,code_ligne")
EPS = 0.0010   # tolérance Douglas-Peucker (~100 m)
NDEC = 4       # décimales conservées (~11 m)


def perp(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b, dmax, idx = pts[0], pts[-1], 0, 0
    for i in range(1, len(pts) - 1):
        d = perp(pts[i], a, b)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [a, b]


def lvl(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return 0
    return 3 if v >= 250 else 2 if v >= 200 else 1 if v >= 120 else 0


def main():
    print("téléchargement export SNCF…")
    with urllib.request.urlopen(EXPORT, context=CTX, timeout=180) as r:
        src = json.load(r)
    out = []
    for f in src["features"]:
        g = f["geometry"]
        if g["type"] != "LineString":
            continue
        pts = [[round(x, NDEC), round(y, NDEC)] for x, y in rdp(g["coordinates"], EPS)]
        out.append({"type": "Feature", "properties": {"v": lvl(f["properties"].get("v_max"))},
                    "geometry": {"type": "LineString", "coordinates": pts}})
    body = json.dumps({"type": "FeatureCollection", "features": out}, separators=(",", ":"))
    os.makedirs("public", exist_ok=True)
    with open("public/railnet.geojson", "w") as fh:
        fh.write(body)
    print(f"écrit public/railnet.geojson : {len(out)} tronçons, {round(len(body)/1e6,2)} Mo")


if __name__ == "__main__":
    main()
