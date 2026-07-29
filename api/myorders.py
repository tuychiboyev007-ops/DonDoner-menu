#!/usr/bin/env python3
"""
DonDöner — mijozning buyurtmalari
====================================================================
Mini App «Buyurtmalar» bo'limi shu manzildan ma'lumot oladi:

    POST /api/myorders
    { "initData": "<Telegram imzosi>" }
    → { "ok": true, "orders": [ { number, status, created_at, order, ... } ] }

initData imzosi tekshiriladi — har kim faqat o'z buyurtmalarini ko'radi.
"""

import hashlib
import hmac
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
MAX_BODY = 8 * 1024


def check_init_data(init_data):
    """Telegram imzosini tekshiradi → (to'g'rimi, foydalanuvchi)."""
    if not init_data or not BOT_TOKEN:
        return False, {}
    try:
        pairs = urllib.parse.parse_qsl(init_data, keep_blank_values=True)
        received = ""
        items = []
        for key, value in pairs:
            if key == "hash":
                received = value
            else:
                items.append(f"{key}={value}")
        if not received:
            return False, {}
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(
            secret, "\n".join(sorted(items)).encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(calc, received):
            return False, {}
        user = {}
        for key, value in pairs:
            if key == "user":
                user = json.loads(value)
        return True, user
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] initData: {exc}")
        return False, {}


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("content-length", 0))
        if length > MAX_BODY:
            return self._send(413, {"ok": False, "error": "juda katta"})
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self._send(400, {"ok": False, "error": "noto'g'ri so'rov"})

        valid, user = check_init_data(payload.get("initData", ""))
        if not valid or not user.get("id"):
            return self._send(403, {"ok": False, "error": "tekshiruvdan o'tmadi"})

        records = _store.load_user_orders(user["id"], limit=20)
        # Ilovaga faqat kerakli maydonlarni yuboramiz
        orders = [
            {
                "number": r.get("number"),
                "status": r.get("status", "new"),
                "created_at": r.get("created_at", ""),
                "day": r.get("day", ""),
                "history": r.get("history", []),
                "order": r.get("order", {}),
            }
            for r in records
        ]
        self._send(200, {"ok": True, "orders": orders})

    def do_GET(self):  # noqa: N802
        self._send(200, {"ok": True, "info": "mijoz buyurtmalari"})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)
