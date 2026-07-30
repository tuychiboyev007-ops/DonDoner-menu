#!/usr/bin/env python3
"""
DonDöner — admin panel API (bitta kishi uchun, PIN bilan himoyalangan)
====================================================================
admin.html shu manzilga so'rov yuboradi:

    POST /api/admin
    Header: X-Admin-Pin: <PIN>
    Body:   {"action": "...", ...}

Amallar:
  get_menu        → hozirgi saqlangan menyuni qaytaradi
  save_menu       → {"menu": {...}} — butun menyuni saqlaydi
  upload_image    → {"filename", "content_type", "data_base64"} —
                     rasmni Blob'ga yuklaydi, ochiq URL qaytaradi
  get_promos      → chegirma kodlari ro'yxati
  save_promos     → {"codes": [...]} — kodlarni saqlaydi
  broadcast_count → nechta mijozga xabar ketishini aytadi
  broadcast       → {"text": "..."} — barcha mijozlarga xabar yuboradi

Muhit o'zgaruvchilari:
  ADMIN_PIN — panelga kirish uchun maxfiy PIN (sozlanmasa — hamma so'rov
              rad etiladi, xavfsizlik uchun standart yo'q)
  BOT_TOKEN — reklama xabarini yuborish uchun (mijoz boti)
"""

import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

ADMIN_PIN = os.environ.get("ADMIN_PIN", "").strip()
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
MAX_BODY = 8 * 1024 * 1024  # rasm base64 uchun ~8MB yetarli
MAX_IMAGE_BYTES = 4 * 1024 * 1024


def broadcast(text):
    """Buyurtma bergan barcha mijozlarga xabar yuboradi.

    Telegram sekundiga ~30 xabarga ruxsat beradi, shuning uchun har
    xabardan keyin qisqa pauza qilamiz. Bloklab qo'ygan mijozlar
    xatolik beradi — ular shunchaki «failed» ga qo'shiladi.
    """
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    sent = failed = 0
    for uid in _store.all_customer_ids():
        fields = {"chat_id": uid, "text": text, "parse_mode": "HTML"}
        data = urllib.parse.urlencode(fields).encode("utf-8")
        try:
            with urllib.request.urlopen(url, data=data, timeout=10) as resp:
                ok = json.loads(resp.read().decode("utf-8")).get("ok")
            sent += 1 if ok else 0
            failed += 0 if ok else 1
        except Exception:  # noqa: BLE001 — bitta mijoz uchun to'xtamaymiz
            failed += 1
        time.sleep(0.05)
    return sent, failed


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

        if action == "get_promos":
            return self._send(200, {"ok": True, "codes": _store.load_promos()})

        if action == "save_promos":
            codes = payload.get("codes")
            if not isinstance(codes, list):
                return self._send(400, {"ok": False, "error": "ro'yxat kutilgan edi"})
            clean = []
            for c in codes[:100]:
                if not isinstance(c, dict):
                    continue
                code = str(c.get("code") or "").strip().upper()
                if not code:
                    continue
                clean.append({
                    "code": code,
                    "type": "fixed" if c.get("type") == "fixed" else "percent",
                    "value": max(0, int(c.get("value") or 0)),
                    "minOrder": max(0, int(c.get("minOrder") or 0)),
                    "active": bool(c.get("active", True)),
                })
            _store.save_promos(clean)
            return self._send(200, {"ok": True, "codes": clean})

        if action == "broadcast_count":
            return self._send(200, {"ok": True, "count": len(_store.all_customer_ids())})

        if action == "broadcast":
            text = str(payload.get("text") or "").strip()
            if not text:
                return self._send(400, {"ok": False, "error": "xabar bo'sh"})
            if len(text) > 3500:
                return self._send(400, {"ok": False, "error": "xabar juda uzun"})
            if not BOT_TOKEN:
                return self._send(500, {"ok": False, "error": "BOT_TOKEN sozlanmagan"})
            sent, failed = broadcast(text)
            return self._send(200, {"ok": True, "sent": sent, "failed": failed})

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
