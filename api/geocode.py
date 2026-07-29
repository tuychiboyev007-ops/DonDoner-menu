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
USER_AGENT = "DonDonerMenu/1.0 (Telegram Mini App; +https://dondoner-blush.vercel.app)"
TIMEOUT = 8


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


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_GET(self):  # noqa: N802
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        lat = (params.get("lat") or [""])[0]
        lng = (params.get("lng") or [""])[0]

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
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            result["address"] = short_address(data)
            result["full"] = data.get("display_name", "")
        except (ValueError, TypeError):
            result["error"] = "noto'g'ri koordinata"
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] geocode: {exc}")
            result["error"] = "aniqlanmadi"

        body = json.dumps(result, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(body)
