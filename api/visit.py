#!/usr/bin/env python3
"""
DonDöner — «ilova ochildi» belgisi
====================================================================
Mini App ishga tushganda bir marta chaqiriladi:

    POST /api/visit   { "initData": "<telegram initData>" }
    → { "ok": true }

Shu yozuv asosida `api/followup.py` buyurtma qilmasdan chiqib ketgan
mijozlarga eslatma yuboradi. Buyurtma berilsa yozuv o'chiriladi
(`api/order.py` ichida `clear_visit`).

Muhit o'zgaruvchisi:
  BOT_TOKEN — initData imzosini tekshirish uchun
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
MAX_BODY = 8 * 1024


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        try:
            length = min(int(self.headers.get("Content-Length") or 0), MAX_BODY)
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:  # noqa: BLE001
            return self._send(400, {"ok": False})

        valid, user = _store.check_init_data(data.get("initData", ""), BOT_TOKEN)
        if not valid or not user.get("id"):
            # Telegram'dan tashqarida ochilgan — kuzatmaymiz
            return self._send(200, {"ok": False, "error": "no_user"})

        cfg = _store.load_followup_config()
        if not cfg.get("enabled", True):
            return self._send(200, {"ok": True, "skipped": True})

        _store.save_visit(user)
        self._send(200, {"ok": True})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
