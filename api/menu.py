#!/usr/bin/env python3
"""
DonDöner — jonli menyu (ochiq, faqat o'qish uchun)
====================================================================
Mini App sahifa ochilganda shu manzildan so'raydi:

    GET /api/menu
    → { "ok": true, "menu": {...} | null }

Admin panelda hech narsa saqlanmagan bo'lsa `menu` — null, va ilova
data/menu.js dagi standart menyuni ko'rsatishda davom etadi.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_GET(self):  # noqa: N802
        menu = _store.load_menu()
        self._send(200, {"ok": True, "menu": menu})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
