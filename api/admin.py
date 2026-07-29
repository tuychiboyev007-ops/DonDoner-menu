#!/usr/bin/env python3
"""
DonDöner — admin panel API (bitta kishi uchun, PIN bilan himoyalangan)
====================================================================
admin.html shu manzilga so'rov yuboradi:

    POST /api/admin
    Header: X-Admin-Pin: <PIN>
    Body:   {"action": "get_menu" | "save_menu" | "upload_image", ...}

Amallar:
  get_menu      → hozirgi saqlangan menyuni qaytaradi
  save_menu     → {"menu": {...}} — butun menyuni saqlaydi
  upload_image  → {"filename", "content_type", "data_base64"} —
                   rasmni Blob'ga yuklaydi, ochiq URL qaytaradi

Muhit o'zgaruvchisi:
  ADMIN_PIN — panelga kirish uchun maxfiy PIN (sozlanmasa — hamma so'rov
              rad etiladi, xavfsizlik uchun standart yo'q)
"""

import base64
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

ADMIN_PIN = os.environ.get("ADMIN_PIN", "").strip()
MAX_BODY = 8 * 1024 * 1024  # rasm base64 uchun ~8MB yetarli
MAX_IMAGE_BYTES = 4 * 1024 * 1024


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        pin = self.headers.get("X-Admin-Pin", "")
        if not ADMIN_PIN or pin != ADMIN_PIN:
            return self._send(403, {"ok": False, "error": "PIN noto'g'ri"})

        length = int(self.headers.get("content-length", 0))
        if length > MAX_BODY:
            return self._send(413, {"ok": False, "error": "so'rov juda katta"})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self._send(400, {"ok": False, "error": "noto'g'ri so'rov"})

        action = payload.get("action")

        if action == "get_menu":
            return self._send(200, {"ok": True, "menu": _store.load_menu()})

        if action == "save_menu":
            menu = payload.get("menu")
            if not isinstance(menu, dict) or not menu.get("categories"):
                return self._send(400, {"ok": False, "error": "menyu bo'sh yoki noto'g'ri"})
            _store.save_menu(menu)
            return self._send(200, {"ok": True})

        if action == "upload_image":
            filename = payload.get("filename") or "image.jpg"
            content_type = payload.get("content_type") or "image/jpeg"
            try:
                raw = base64.b64decode(payload.get("data_base64") or "", validate=True)
            except Exception:  # noqa: BLE001
                return self._send(400, {"ok": False, "error": "rasm ma'lumoti buzilgan"})
            if not raw:
                return self._send(400, {"ok": False, "error": "rasm bo'sh"})
            if len(raw) > MAX_IMAGE_BYTES:
                return self._send(413, {"ok": False, "error": "rasm juda katta"})
            url = _store.save_image(filename, raw, content_type)
            if not url:
                return self._send(502, {"ok": False, "error": "yuklab bo'lmadi"})
            return self._send(200, {"ok": True, "url": url})

        return self._send(400, {"ok": False, "error": "noma'lum amal"})

    def do_GET(self):  # noqa: N802
        self._send(200, {"ok": True, "info": "DonDöner admin API"})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)
