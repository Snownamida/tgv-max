#!/usr/bin/env python3
"""Régénère js/stations.js à partir de sources ouvertes.

Pipeline :
  1. Liste toutes les gares (origine + destination) du jeu de données SNCF « tgvmax ».
  2. Récupère coordonnées + code UIC via le dépôt ouvert trainline-eu/stations
     (jointure sur le code SNCF à 5 lettres, ex. FRPLY).
  3. Corrige à la main les quelques gares absentes (petites gares/arrêts de la Meuse).
  4. Joint la fréquentation annuelle (dataset SNCF « frequentation-gares ») via l'UIC.
  5. Agrège par NOM de gare (une ville = plusieurs quais partagent le même nom,
     ex. « PARIS (intramuros) ») : centroïde, trafic tgvmax, fréquentation cumulée.
  6. Écrit js/stations.js (tableau trié par trafic).

Champs par gare : n=nom, lat, lon, c=pays, t=trafic tgvmax, f=voyageurs/an, k=clé recherche.

Usage :  python3 data/build_stations.py     (depuis la racine du projet)
"""
import urllib.request, urllib.parse, json, ssl, csv, io, os, unicodedata, re, statistics as st
from collections import defaultdict

CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE
API = "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax/records"
TRAINLINE = "https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv"
FREQ = "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/frequentation-gares/exports/json"

# Gares absentes de trainline (arrêts autocar de la Meuse, gares récentes) -> coords manuelles
PATCH = {
    "DEBGB": (52.54874, 13.38860), "DEQLI": (48.93447, 8.95584),
    "FRKGD": (48.75970, 5.59060), "FRLPZ": (49.01860, 5.28610),
    "FRSHY": (48.88940, 5.54420), "FRSHZ": (48.91670, 5.41670), "FRSIA": (48.83580, 5.53110),
}


def fetch_json(url):
    with urllib.request.urlopen(url, context=CTX, timeout=90) as r:
        return json.load(r)


def group_pairs(code_field, name_field):
    out, off = {}, 0
    while True:
        url = f"{API}?select={code_field},{name_field}&group_by={code_field},{name_field}&limit=100&offset={off}"
        res = fetch_json(url).get("results", [])
        for row in res:
            out[row[code_field]] = row[name_field]
        if len(res) < 100:
            break
        off += 100
    return out


def norm(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[()]", " ", s).upper()).strip()


def num(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def main():
    print("1/6  gares du jeu de données…")
    stations = {**group_pairs("origine_iata", "origine"), **group_pairs("destination_iata", "destination")}
    print(f"     {len(stations)} codes")

    print("2/6  coordonnées + UIC trainline-eu…")
    raw = urllib.request.urlopen(TRAINLINE, context=CTX, timeout=180).read().decode("utf-8")
    by_sncf, uic_by_sncf = {}, {}
    for row in csv.DictReader(io.StringIO(raw), delimiter=";"):
        sid = row.get("sncf_id", "").strip()
        lat, lon, uic = row.get("latitude", "").strip(), row.get("longitude", "").strip(), (row.get("uic") or "").strip()
        if sid and lat and lon:
            by_sncf[sid] = (float(lat), float(lon))
        if sid and uic:
            uic_by_sncf[sid] = uic[:7]  # 7 chiffres (sans clé de contrôle)

    print("3/6  jointure + corrections…")
    geo = {}
    for code, name in stations.items():
        if code in by_sncf:
            geo[code] = (name, *by_sncf[code])
        elif code in PATCH:
            geo[code] = (name, *PATCH[code])
        else:
            print("     ! manquant :", code, name)

    print("4/6  fréquentation annuelle…")
    freq7 = {}
    for r in fetch_json(FREQ):
        uic = str(r.get("code_uic_complet") or "").strip()
        v = num(r.get("total_voyageurs_2024")) or num(r.get("total_voyageurs_2023"))
        if len(uic) >= 7 and v is not None:
            freq7[uic[:7]] = v

    print("5/6  agrégation par nom…")
    traf_url = API + "?" + urllib.parse.urlencode({"select": "origine,count(*) as n", "group_by": "origine", "order_by": "n DESC", "limit": 100})
    traf = {r["origine"]: r["n"] for r in fetch_json(traf_url).get("results", [])}
    pts = defaultdict(list)   # nom -> [(lat, lon)]
    country = {}              # nom -> pays
    fsum = defaultdict(int)   # nom -> fréquentation cumulée
    for code, (name, lat, lon) in geo.items():
        pts[name].append((lat, lon))
        country[name] = code[:2]
        f = freq7.get(uic_by_sncf.get(code))
        if f:
            fsum[name] += f
    rows = []
    for name, plist in pts.items():
        rows.append({
            "n": name, "lat": round(st.mean(p[0] for p in plist), 5),
            "lon": round(st.mean(p[1] for p in plist), 5),
            "c": country[name], "t": traf.get(name, 0), "f": fsum[name], "k": norm(name),
        })
    rows.sort(key=lambda r: -r["t"])

    print("6/6  écriture src/assets/data/stations.json…")
    os.makedirs("src/assets/data", exist_ok=True)
    payload = [
        {"name": r["n"], "lat": r["lat"], "lon": r["lon"],
         "country": r["c"], "traffic": r["t"], "ridership": r["f"]}
        for r in rows
    ]
    with open("src/assets/data/stations.json", "w") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    with_f = sum(1 for r in rows if r["f"])
    print(f"OK — {len(rows)} gares, dont {with_f} avec fréquentation.")


if __name__ == "__main__":
    main()
