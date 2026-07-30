#!/usr/bin/env python3
"""
DonDöner — buyurtmasiz chiqib ketganlarga eslatma
====================================================================
Mijoz ilovani ochib, hech narsa buyurtma qilmasdan chiqib ketsa,
belgilangan vaqtdan keyin unga bot orqali eslatma yuboriladi.

Bu manzilni tashqi jadval (GitHub Actions cron) har 5 daqiqada
chaqiradi — Vercel'ning Hobby tarifida cron kuniga faqat 1 marta
ishlagani uchun.

    POST /api/followup
    Header: X-Followup-Secret: <FOLLOWUP_SECRET>
    → { "ok": true, "sent": 2, "skipped": 5 }

Qoidalar:
  * eslatma tashrifdan keyin `delayMin` daqiqa o'tgach yuboriladi
  * 6 soatdan eski tashriflar tashlab yuboriladi (kech qoldi)
  * bir mijozga kuniga faqat bitta eslatma
  * buyurtma bergan bo'lsa yozuv allaqachon o'chirilgan bo'ladi

Muhit o'zgaruvchilari:
  BOT_TOKEN        — xabar yuborish uchun
  WEBAPP_URL       — «Открыть меню» tugmasi uchun
  FOLLOWUP_SECRET  — manzilni himoyalash uchun maxfiy kalit
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
WEBAPP_URL = os.environ.get("WEBAPP_URL", "").strip()
FOLLOWUP_SECRET = os.environ.get("FOLLOWUP_SECRET", "").strip()

MAX_AGE_MIN = 360   # 6 soatdan eski tashrifga eslatma yuborilmaydi
MAX_PER_RUN = 25    # bitta ishga tushishda ko'pi bilan shuncha xabar


def keyboard():
    if not WEBAPP_URL:
        return None
    return {
        "inline_keyboard": [
            [{"text": "🍽 Открыть меню", "web_app": {"url": WEBAPP_URL}}]
        ]
    }


def send(chat_id, text):
    fields = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    kb = keyboard()
    if kb:
        fields["reply_markup"] = json.dumps(kb, ensure_ascii=False)
    data = urllib.parse.urlencode(fields).encode("utf-8")
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        with urllib.request.urlopen(url, data=data, timeout=10) as resp:
            return bool(json.loads(resp.read().decode("utf-8")).get("ok"))
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] eslatma yuborilmadi: {exc}")
        return False


def minutes_since(iso_text):
    """Berilgan vaqtdan hozirgacha necha daqiqa o'tgan."""
    try:
        then = datetime.fromisoformat(iso_text)
    except (TypeError, ValueError):
        return None
    now = datetime.now(_store.TASHKENT_TZ)
    if then.tzinfo is None:
        then = then.replace(tzinfo=_store.TASHKENT_TZ)
    return (now - then).total_seconds() / 60.0


def run():
    cfg = _store.load_followup_config()
    if not cfg.get("enabled", True):
        return {"ok": True, "disabled": True, "sent": 0}
    if not BOT_TOKEN:
        return {"ok": False, "error": "BOT_TOKEN sozlanmagan"}

    delay = max(1, int(cfg.get("delayMin") or 5))
    text = cfg.get("text") or _store.DEFAULT_FOLLOWUP["text"]
    today = _store.today_key()

    sent = skipped = 0
    stale_urls = []

    for visit in _store.load_visits():
        if sent >= MAX_PER_RUN:
            break
        age = minutes_since(visit.get("opened_at"))
        if age is None:
            continue

        # Hali vaqti kelmagan — keyingi safar ko'ramiz
        if age < delay:
            skipped += 1
            continue

        # Juda eskisiga endi eslatma yuborishning ma'nosi yo'q
        if age > MAX_AGE_MIN:
            stale_urls.append(visit.get("_url", ""))
            continue

        # Bugun allaqachon yuborilgan bo'lsa — takrorlamaymiz
        if visit.get("notified_day") == today:
            skipped += 1
            continue

        if send(visit["id"], text):
            sent += 1
        # Yuborilgan yoki yuborilmagan — qaytadan urinmaymiz
        visit["notified_day"] = today
        visit.pop("_url", None)  # bu faqat ichki maydon, saqlanmasin
        _store.put_blob(_store.visit_path(visit["id"]), visit)

    if stale_urls:
        _store.delete_blobs(stale_urls)

    return {"ok": True, "sent": sent, "skipped": skipped,
            "cleaned": len(stale_urls)}


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        got = self.headers.get("X-Followup-Secret", "")
        if not FOLLOWUP_SECRET or got != FOLLOWUP_SECRET:
            return self._send(403, {"ok": False, "error": "forbidden"})
        self._send(200, run())

    def do_GET(self):  # noqa: N802
        self._send(200, {"ok": True, "info": "DonDöner followup"})

    def _send(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
