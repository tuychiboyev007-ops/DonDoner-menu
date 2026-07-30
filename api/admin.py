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
  get_report      → kunlik hisobot, filiallar bo'yicha alohida
  get_promos      → chegirma kodlari ro'yxati
  save_promos     → {"codes": [...]} — kodlarni saqlaydi
  get_followup    → «qaytib keling» eslatmasi sozlamalari
  save_followup   → {"config": {...}} — eslatma sozlamalarini saqlaydi
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


def _sum_group(records):
    """Bir guruh buyurtma bo'yicha: soni, savdosi, holatlari, top taomlar.

    Bekor qilingan buyurtma savdoga qo'shilmaydi, lekin soniga kiradi.
    """
    total = 0
    statuses = {}
    items = {}
    for r in records:
        o = r.get("order") or {}
        st = r.get("status") or "new"
        statuses[st] = statuses.get(st, 0) + 1
        if st != "cancelled":
            try:
                total += int(o.get("total") or 0)
            except (TypeError, ValueError):
                pass
        for it in o.get("items", []):
            name = it.get("name", "-")
            try:
                qty = int(it.get("qty") or 1)
            except (TypeError, ValueError):
                qty = 1
            items[name] = items.get(name, 0) + qty
    top = sorted(items.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return {
        "count": len(records),
        "total": total,
        "statuses": statuses,
        "top": [{"name": n, "qty": q} for n, q in top],
    }


def day_report_by_branch(day=None):
    """Kunlik hisobot — har filial uchun alohida."""
    day = day or _store.today_key()
    records = _store.load_orders(day)

    menu = _store.load_menu() or {}
    branches = (menu.get("restaurant") or {}).get("branches") or []

    # Buyurtmalarni filial nomi bo'yicha guruhlaymiz
    grouped = {}
    for r in records:
        o = r.get("order") or {}
        label = str((o.get("branch") or {}).get("label") or "")
        grouped.setdefault(label, []).append(r)

    out = []
    used = set()
    for b in branches:
        label = str(b.get("label") or "")
        used.add(label)
        info = _sum_group(grouped.get(label, []))
        info["id"] = b.get("id") or ""
        info["label"] = label
        out.append(info)

    # Filiali ko'rsatilmagan yoki o'chirilgan filial buyurtmalari
    rest = [r for lbl, rs in grouped.items() if lbl not in used for r in rs]
    other = _sum_group(rest) if rest else None

    return {
        "ok": True,
        "day": day,
        "branches": out,
        "other": other,
        "all": _sum_group(records),
    }


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

        if action == "get_report":
            return self._send(200, day_report_by_branch(payload.get("day")))

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

        if action == "get_followup":
            return self._send(200, {"ok": True, "config": _store.load_followup_config()})

        if action == "save_followup":
            cfg = payload.get("config")
            if not isinstance(cfg, dict):
                return self._send(400, {"ok": False, "error": "sozlama noto'g'ri"})
            text = str(cfg.get("text") or "").strip()
            if len(text) > 1000:
                return self._send(400, {"ok": False, "error": "matn juda uzun"})
            clean = {
                "enabled": bool(cfg.get("enabled", True)),
                # 1 daqiqadan 12 soatgacha
                "delayMin": max(1, min(720, int(cfg.get("delayMin") or 5))),
                "text": text or _store.DEFAULT_FOLLOWUP["text"],
            }
            _store.save_followup_config(clean)
            return self._send(200, {"ok": True, "config": clean})

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
