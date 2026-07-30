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
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

# _store shu papkada — Vercel muhitida yo'lni qo'lda ko'rsatamiz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "").strip()
ORDERS_BOT_TOKEN = os.environ.get("ORDERS_BOT_TOKEN", "").strip() or BOT_TOKEN
ORDERS_CHAT_ID = os.environ.get("ORDERS_CHAT_ID", "").strip() or ADMIN_CHAT_ID
WEBAPP_URL = os.environ.get(
    "WEBAPP_URL", "https://dondoner-blush.vercel.app/"
).strip()

TASHKENT_TZ = timezone(timedelta(hours=5))
MAX_BODY = 32 * 1024  # buyurtma matni uchun yetarli


def esc(text):
    return html.escape(str(text), quote=False)


def send_message(token, chat_id, text, keyboard=None):
    """Telegram'ga xabar yuboradi (ixtiyoriy tugmalar bilan)."""
    if not token or not chat_id:
        return False, "sozlanmagan"
    fields = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if keyboard:
        fields["reply_markup"] = json.dumps(keyboard, ensure_ascii=False)
    payload = urllib.parse.urlencode(fields).encode("utf-8")
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


def fmt_sum(value):
    """92000 -> '92 000 so'm'"""
    try:
        return f"{int(value):,}".replace(",", " ") + " so'm"
    except (ValueError, TypeError):
        return str(value)


def apply_promo(order):
    """Chegirmani serverda qayta hisoblab, buyurtma summasini tuzatadi.

    Mijoz tomonidan kelgan `discount` va `total` e'tiborga olinmaydi —
    faqat kodning o'zi olinadi va hamma narsa qaytadan sanaladi.
    """
    items = order.get("items") or []
    subtotal = 0
    for it in items:
        try:
            subtotal += int(it.get("price") or 0) * int(it.get("qty") or 1)
        except (TypeError, ValueError):
            pass

    try:
        fee = int(order.get("deliveryFee") or 0)
    except (TypeError, ValueError):
        fee = 0

    code = ""
    if isinstance(order.get("promo"), dict):
        code = str(order["promo"].get("code") or "")

    discount = 0
    promo = _store.find_promo(code) if code else None
    if promo:
        discount, reason = _store.promo_discount(promo, subtotal)
        if reason:
            discount = 0

    if discount > 0:
        order["promo"] = {
            "code": str(promo.get("code", "")).upper(),
            "type": promo.get("type", "percent"),
            "value": int(promo.get("value") or 0),
            "discount": discount,
        }
    else:
        order.pop("promo", None)

    order["subtotal"] = subtotal
    order["discount"] = discount
    order["total"] = max(0, subtotal - discount) + fee
    return order


def build_card(order, user, number=None):
    """Buyurtma kartochkasi (reference ko'rinishida)."""
    L = []
    L.append("🆕 <b>Yangi zakaz!</b>")
    L.append(f"📦 <b>#{number}</b>")
    L.append("━━━━━━━━━━━━━━━")

    for it in order.get("items", []):
        L.append(f"• {esc(it.get('name', '-'))} ×{it.get('qty', 1)}")

    L.append("━━━━━━━━━━━━━━━")

    if order.get("discount"):
        pr = order.get("promo") or {}
        L.append(f"🏷 {esc(str(pr.get('code', '')))} − {esc(fmt_sum(order['discount']))}")

    pay = "Naqd" if order.get("payment") != "card" else "Karta"
    L.append(f"💰 <b>{esc(fmt_sum(order.get('total', 0)))}</b> · {pay}")

    name = order.get("name") or user.get("first_name") or "-"
    L.append(f"👤 {esc(name)}")

    phone = (order.get("phone") or "").replace(" ", "")
    if phone:
        L.append(f"📞 {esc(phone)}")

    if order.get("mode") == "pickup":
        L.append("🏃 Olib ketish")
    else:
        addr_bits = []
        if order.get("geoLabel"):
            addr_bits.append(order["geoLabel"])
        parts = order.get("addrParts") or {}
        detail = []
        if parts.get("house"):
            detail.append(parts["house"] + "-uy")
        if parts.get("entrance"):
            detail.append(parts["entrance"] + "-podyezd")
        if parts.get("floor"):
            detail.append(parts["floor"] + "-qavat")
        if parts.get("flat"):
            detail.append(parts["flat"] + "-xonadon")
        if detail:
            addr_bits.append(", ".join(detail))
        if addr_bits:
            L.append(f"📍 {esc(' · '.join(addr_bits))}")
        if parts.get("note"):
            L.append(f"🛵 {esc(parts['note'])}")

    branch = order.get("branch") or {}
    if branch.get("label"):
        L.append(f"🏬 {esc(branch['label'])}")

    if order.get("note"):
        L.append(f"📝 {esc(order['note'])}")

    uname = user.get("username")
    if uname:
        L.append(f"💬 @{esc(uname)}")

    return "\n".join(L)


def build_confirm_keyboard(number):
    """Mijozga tasdiq xabari tugmasi — bosilsa Mini App shu
    buyurtmaning holat sahifasini to'g'ridan-to'g'ri ochadi."""
    if not WEBAPP_URL:
        return None
    url = WEBAPP_URL.rstrip("/") + "/?order=" + str(number)
    return {
        "inline_keyboard": [
            [{"text": "📋 Посмотреть заказ", "web_app": {"url": url}}]
        ]
    }


def build_buttons(order, path):
    """Yangi buyurtma kartochkasi tugmalari: xarita + keyingi qadam."""
    rows = []
    g = order.get("geo") or {}
    if g.get("lat") and g.get("lng"):
        rows.append([
            {
                "text": "🗺 Xaritada ochish (yo'l)",
                "url": f"https://maps.google.com/?q={g['lat']},{g['lng']}",
            }
        ])
    rows.append([
        {"text": "✅ Olaman", "callback_data": f"st:accepted:{path}"},
        {"text": "❌ Bekor", "callback_data": f"st:cancelled:{path}"},
    ])
    return {"inline_keyboard": rows}


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("content-length", 0))
        if length > MAX_BODY:
            return self._send(413, {"ok": False, "error": "juda katta"})

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self._send(400, {"ok": False, "error": "noto'g'ri so'rov"})

        order = payload.get("order") or {}
        if not order.get("items"):
            return self._send(400, {"ok": False, "error": "buyurtma bo'sh"})

        valid, user = check_init_data(payload.get("initData", ""))
        if not valid:
            # Telegram'dan tashqarida ochilgan yoki imzo noto'g'ri
            return self._send(403, {"ok": False, "error": "tekshiruvdan o'tmadi"})

        # Chegirmani serverda qaytadan hisoblaymiz — mijoz yuborgan
        # summaga ishonmaymiz (soxta chegirma o'tib ketmasin)
        apply_promo(order)

        # 1) Bazaga saqlaymiz — kunlik tartib raqamini shu yerdan olamiz
        record = _store.save_order(order, user)

        # Buyurtma berdi — «qaytib keling» eslatmasi endi kerak emas
        _store.clear_visit(user.get("id"))
        number = record.get("number", 1)

        # 2) Buyurtmani restoranga
        card = build_card(order, user, number)
        keyboard = build_buttons(order, record.get("path", ""))
        ok, err = send_message(ORDERS_BOT_TOKEN, ORDERS_CHAT_ID, card, keyboard)
        if not ok:
            print(f"[WARN] buyurtma yuborilmadi: {err}")
            # Zaxira: asosiy bot orqali adminga
            ok, err = send_message(BOT_TOKEN, ADMIN_CHAT_ID, card, keyboard)
            if not ok:
                return self._send(502, {"ok": False, "error": "yuborilmadi"})

        # 3) Mijozga tasdiq — «Buyurtmani ko'rish» tugmasi bilan
        chat_id = user.get("id")
        if chat_id:
            send_message(
                BOT_TOKEN,
                chat_id,
                f"✅ <b>Ваш заказ принят!</b>\n"
                f"Номер: <b>#{number}</b>\n\n"
                "📋 Следить за статусом можно по кнопке ниже "
                "или в разделе «Заказы».\n\n"
                "Оператор скоро свяжется с вами. Спасибо! 🙌",
                build_confirm_keyboard(number),
            )

        self._send(200, {"ok": True, "number": number})

    def do_GET(self):  # noqa: N802
        self._send(200, {"ok": True, "info": "buyurtma qabul qilish nuqtasi"})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)
