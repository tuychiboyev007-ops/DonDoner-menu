#!/usr/bin/env python3
"""
DonDöner — buyurtma qabul qilish (Mini App → server → bot)
====================================================================
Mini App «Buyurtma berish» bosilganda shu manzilga POST qiladi:

    POST /api/order
    { "initData": "<Telegram imzosi>", "text": "🧾 Buyurtma #...", ... }

Server:
  1. initData imzosini BOT_TOKEN bilan tekshiradi (soxta buyurtma o'tmaydi)
  2. Buyurtmani ORDERS botiga (yoki asosiy botga) yuboradi
  3. Mijozga tasdiq xabarini yuboradi

Shu yo'l bilan mijoz hech narsa yubormaydi — bir bosishda tayyor.

Muhit o'zgaruvchilari:
  BOT_TOKEN, ADMIN_CHAT_ID, ORDERS_BOT_TOKEN, ORDERS_CHAT_ID
"""

import hashlib
import hmac
import html
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "").strip()
ORDERS_BOT_TOKEN = os.environ.get("ORDERS_BOT_TOKEN", "").strip() or BOT_TOKEN
ORDERS_CHAT_ID = os.environ.get("ORDERS_CHAT_ID", "").strip() or ADMIN_CHAT_ID

TASHKENT_TZ = timezone(timedelta(hours=5))
MAX_BODY = 32 * 1024  # buyurtma matni uchun yetarli


def esc(text):
    return html.escape(str(text), quote=False)


def send_message(token, chat_id, text):
    """Telegram'ga xabar yuboradi."""
    if not token or not chat_id:
        return False, "sozlanmagan"
    payload = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    ).encode("utf-8")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        with urllib.request.urlopen(url, data=payload, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return bool(data.get("ok")), data.get("description", "")
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def check_init_data(init_data):
    """Telegram initData imzosini tekshiradi.

    Qaytaradi: (to'g'rimi, foydalanuvchi ma'lumoti)
    Hujjat: https://core.telegram.org/bots/webapps#validating-data
    """
    if not init_data or not BOT_TOKEN:
        return False, {}
    try:
        pairs = urllib.parse.parse_qsl(init_data, keep_blank_values=True)
        received_hash = ""
        items = []
        for key, value in pairs:
            if key == "hash":
                received_hash = value
            else:
                items.append(f"{key}={value}")
        if not received_hash:
            return False, {}

        check_string = "\n".join(sorted(items))
        secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calc, received_hash):
            return False, {}

        user = {}
        for key, value in pairs:
            if key == "user":
                user = json.loads(value)
        return True, user
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] initData tekshiruvi: {exc}")
        return False, {}


def build_card(order_text, user):
    """Buyurtma matnini professional kartochkaga aylantiradi."""
    lines = order_text.split("\n")
    first = lines[0] if lines else ""
    order_no = ""
    if "#" in first:
        order_no = "#" + first.split("#", 1)[1].split()[0]
        body = "\n".join(lines[1:]).strip("\n")
    else:
        body = order_text.strip("\n")

    stamp = datetime.now(TASHKENT_TZ).strftime("%d.%m.%Y · %H:%M")
    uname = user.get("username")
    who = f"@{uname}" if uname else f"id {user.get('id', '-')}"

    header = "🔔 <b>YANGI BUYURTMA</b>"
    if order_no:
        header += f"  <code>{esc(order_no)}</code>"

    return (
        f"{header}\n"
        f"<i>{stamp}</i>\n"
        f"➖➖➖➖➖➖➖➖➖➖\n"
        f"{esc(body)}\n"
        f"➖➖➖➖➖➖➖➖➖➖\n"
        f"💬 Telegram: {esc(who)}"
    )


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("content-length", 0))
        if length > MAX_BODY:
            return self._send(413, {"ok": False, "error": "juda katta"})

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self._send(400, {"ok": False, "error": "noto'g'ri so'rov"})

        order_text = (payload.get("text") or "").strip()
        if not order_text:
            return self._send(400, {"ok": False, "error": "buyurtma bo'sh"})

        valid, user = check_init_data(payload.get("initData", ""))
        if not valid:
            # Telegram'dan tashqarida ochilgan yoki imzo noto'g'ri
            return self._send(403, {"ok": False, "error": "tekshiruvdan o'tmadi"})

        # 1) Buyurtmani restoranga
        ok, err = send_message(ORDERS_BOT_TOKEN, ORDERS_CHAT_ID, build_card(order_text, user))
        if not ok:
            print(f"[WARN] buyurtma yuborilmadi: {err}")
            # Zaxira: asosiy bot orqali adminga
            ok, err = send_message(
                BOT_TOKEN, ADMIN_CHAT_ID, build_card(order_text, user)
            )
            if not ok:
                return self._send(502, {"ok": False, "error": "yuborilmadi"})

        # 2) Mijozga tasdiq
        chat_id = user.get("id")
        if chat_id:
            send_message(
                BOT_TOKEN,
                chat_id,
                "✅ <b>Buyurtmangiz qabul qilindi!</b>\n"
                "Tez orada operator siz bilan bog'lanadi. Rahmat! 🙌",
            )

        self._send(200, {"ok": True})

    def do_GET(self):  # noqa: N802
        self._send(200, {"ok": True, "info": "buyurtma qabul qilish nuqtasi"})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)
