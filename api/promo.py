#!/usr/bin/env python3
"""
DonDöner — chegirma kodini tekshirish (ochiq)
====================================================================
Mijoz savatda kodni kiritganda chaqiriladi:

    POST /api/promo   { "code": "DONER10", "subtotal": 120000 }
    → { "ok": true,  "code": "DONER10", "discount": 12000,
        "type": "percent", "value": 10 }
    → { "ok": false, "error": "not_found" | "inactive" | "min_order",
        "minOrder": 100000 }

Chegirma bu yerda ham qayta hisoblanadi (mijoz tomonidagi songa
ishonilmaydi) — buyurtma yuborilganda `api/order.py` yana tekshiradi.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

MAX_BODY = 4 * 1024


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        try:
            length = min(int(self.headers.get("Content-Length") or 0), MAX_BODY)
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:  # noqa: BLE001
            return self._send(400, {"ok": False, "error": "bad_request"})

        code = str(data.get("code") or "").strip()
        try:
            subtotal = max(0, int(data.get("subtotal") or 0))
        except (TypeError, ValueError):
            subtotal = 0

        promo = _store.find_promo(code)
        discount, reason = _store.promo_discount(promo, subtotal)
        if reason:
            payload = {"ok": False, "error": reason}
            if reason == "min_order" and promo:
                payload["minOrder"] = int(promo.get("minOrder") or 0)
            return self._send(200, payload)

        self._send(200, {
            "ok": True,
            "code": str(promo.get("code", "")).upper(),
            "discount": discount,
            "type": promo.get("type", "percent"),
            "value": int(promo.get("value") or 0),
            "minOrder": int(promo.get("minOrder") or 0),
        })

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
