#!/usr/bin/env python3
"""
DonDöner — manzil aniqlash (reverse geocoding)
====================================================================
Mini App joylashuvni aniqlagach, shu funksiya koordinatani matnli
manzilga aylantiradi:

    GET /api/geocode?lat=41.311081&lng=69.240562
    → {"address": "Besh-Yog'och mahallasi, Chilonzor tumani, Toshkent"}

Nima uchun brauzerdan emas, server orqali:
  - CORS cheklovlari bo'lmaydi
  - Nominatim qoidasiga muvofiq to'g'ri User-Agent yuboriladi
"""

import json
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

NOMINATIM = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "DonDonerMenu/1.0 (Telegram Mini App; +https://dondoner-blush.vercel.app)"
TIMEOUT = 8

# Qidiruv Toshkent atrofi bilan cheklanadi (chap-past, o'ng-yuqori)
TASHKENT_VIEWBOX = "69.05,41.15,69.55,41.45"


def short_address(data):
    """Nominatim javobidan qisqa, o'qishli manzil yasaydi."""
    addr = data.get("address") or {}
    parts = []
    road = addr.get("road") or addr.get("pedestrian") or addr.get("neighbourhood")
    if road:
        num = addr.get("house_number")
        parts.append(f"{road}, {num}-uy" if num else road)
    for key in ("suburb", "city_district", "town", "city"):
        value = addr.get(key)
        if value and value not in parts:
            parts.append(value)
            break
    if not parts:
        return data.get("display_name", "")
    return ", ".join(parts)


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def search_places(query):
    """Manzil bo'yicha qidiruv — ro'yxat qaytaradi."""
    url = NOMINATIM_SEARCH + "?" + urllib.parse.urlencode(
        {
            "format": "json",
            "q": query,
            "accept-language": "uz",
            "limit": "6",
            "countrycodes": "uz",
            "viewbox": TASHKENT_VIEWBOX,
            "bounded": "0",
            "addressdetails": "1",
        }
    )
    items = []
    for place in fetch_json(url):
        items.append(
            {
                "title": short_address(place) or place.get("display_name", ""),
                "full": place.get("display_name", ""),
                "lat": place.get("lat"),
                "lng": place.get("lon"),
            }
        )
    return items


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_GET(self):  # noqa: N802
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        lat = (params.get("lat") or [""])[0]
        lng = (params.get("lng") or [""])[0]
        search = (params.get("q") or [""])[0].strip()

        # Qidiruv rejimi
        if search:
            payload = {"results": []}
            try:
                payload["results"] = search_places(search)
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] search: {exc}")
                payload["error"] = "qidiruv ishlamadi"
            return self._send(payload)

        result = {"address": ""}
        try:
            float(lat), float(lng)  # tekshiruv — faqat son bo'lsin
            url = NOMINATIM + "?" + urllib.parse.urlencode(
                {
                    "format": "json",
                    "zoom": "18",
                    "accept-language": "uz",
                    "lat": lat,
                    "lon": lng,
                }
            )
            data = fetch_json(url)
            result["address"] = short_address(data)
            result["full"] = data.get("display_name", "")
        except (ValueError, TypeError):
            result["error"] = "noto'g'ri koordinata"
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] geocode: {exc}")
            result["error"] = "aniqlanmadi"

        self._send(result)

    def _send(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)
