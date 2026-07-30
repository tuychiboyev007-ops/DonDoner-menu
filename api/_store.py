#!/usr/bin/env python3
"""
DonDöner — ma'lumot saqlash qatlami (Vercel Blob)
====================================================================
Buyurtmalar oddiy JSON fayllar sifatida saqlanadi:

    orders/2026-07-29/0003-a1b2c3.json

Fayl nomidagi `0003` — o'sha kunning tartib raqami. Shu tufayli:
  - buyurtma raqami har kuni 1 dan boshlanadi (restoranlarga qulay)
  - kunlik ro'yxat va hisobot bitta ro'yxatlash bilan olinadi

Muhit o'zgaruvchisi:
  BLOB_READ_WRITE_TOKEN — Vercel Blob do'koni tokeni (avtomatik qo'shiladi)
"""

import hashlib
import hmac
import json
import os
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone

BLOB_TOKEN = os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip()
BLOB_API = "https://blob.vercel-storage.com"
TASHKENT_TZ = timezone(timedelta(hours=5))
TIMEOUT = 10


def today_key():
    return datetime.now(TASHKENT_TZ).strftime("%Y-%m-%d")


def _request(method, url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {BLOB_TOKEN}")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body) if body else {}


def list_blobs(prefix):
    """Berilgan prefiksdagi fayllar ro'yxati."""
    if not BLOB_TOKEN:
        return []
    try:
        url = f"{BLOB_API}?" + urllib.parse.urlencode({"prefix": prefix, "limit": "1000"})
        return _request("GET", url).get("blobs", [])
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] blob list: {exc}")
        return []


def put_blob(pathname, payload):
    """JSON faylni saqlaydi. Muvaffaqiyatli bo'lsa URL qaytaradi."""
    if not BLOB_TOKEN:
        return ""
    try:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        url = f"{BLOB_API}/{urllib.parse.quote(pathname)}"
        res = _request(
            "PUT",
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-add-random-suffix": "0",
                "x-cache-control-max-age": "0",
            },
        )
        return res.get("url", "")
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] blob put: {exc}")
        return ""


def get_blob(url, fresh=False):
    """Saqlangan JSON faylni o'qiydi.

    fresh=True — yaqinda yozilgan fayl uchun. Blob URL'i CDN'da bir
    necha soniya keshlanib turadi, shuning uchun noyob so'rov qo'shamiz.
    """
    try:
        if fresh and url:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}_={uuid.uuid4().hex}"
        req = urllib.request.Request(url)
        req.add_header("Cache-Control", "no-cache")
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] blob get: {exc}")
        return None


# ------------------------------------------------------------------
# Buyurtmalar
# ------------------------------------------------------------------

def next_number(day=None):
    """Shu kunning navbatdagi buyurtma raqami (1 dan boshlanadi)."""
    day = day or today_key()
    blobs = list_blobs(f"orders/{day}/")
    highest = 0
    for b in blobs:
        name = b.get("pathname", "").rsplit("/", 1)[-1]
        head = name.split("-", 1)[0]
        if head.isdigit():
            highest = max(highest, int(head))
    return highest + 1


def save_order(order, user, number=None, day=None):
    """Buyurtmani saqlaydi. Saqlangan yozuvni qaytaradi."""
    day = day or today_key()
    number = number or next_number(day)
    record = {
        "number": number,
        "day": day,
        "created_at": datetime.now(TASHKENT_TZ).isoformat(timespec="seconds"),
        "status": "new",
        "order": order,
        "user": {
            "id": user.get("id"),
            "username": user.get("username", ""),
            "first_name": user.get("first_name", ""),
        },
    }
    suffix = uuid.uuid4().hex[:6]
    path = f"orders/{day}/{number:04d}-{suffix}.json"
    record["path"] = path
    # Mijoz o'z buyurtmalarini tez topishi uchun ikkinchi nusxa
    uid = user.get("id")
    record["user_path"] = f"users/{uid}/{day}-{number:04d}-{suffix}.json" if uid else ""
    record["url"] = put_blob(path, record)
    if record["user_path"]:
        put_blob(record["user_path"], record)
    return record


def load_user_orders(user_id, limit=20):
    """Bitta mijozning buyurtmalari (yangisidan eskisiga)."""
    blobs = list_blobs(f"users/{user_id}/")
    blobs.sort(key=lambda b: b.get("pathname", ""), reverse=True)
    out = []
    for b in blobs[:limit]:
        data = get_blob(b.get("url", ""))
        if data:
            out.append(data)
    return out


def load_orders(day=None):
    """Kun bo'yicha buyurtmalar (raqam bo'yicha tartiblangan)."""
    day = day or today_key()
    records = []
    for b in list_blobs(f"orders/{day}/"):
        data = get_blob(b.get("url", ""))
        if data:
            records.append(data)
    records.sort(key=lambda r: r.get("number", 0))
    return records


def update_status(path, status, actor=""):
    """Buyurtma holatini yangilaydi."""
    blobs = list_blobs(path)
    if not blobs:
        return None
    record = get_blob(blobs[0].get("url", ""))
    if not record:
        return None
    record["status"] = status
    record.setdefault("history", []).append(
        {
            "status": status,
            "actor": actor,
            "at": datetime.now(TASHKENT_TZ).strftime("%H:%M"),
        }
    )
    put_blob(path, record)
    # Mijoz nusxasini ham yangilaymiz — ilovada holat ko'rinsin
    if record.get("user_path"):
        put_blob(record["user_path"], record)
    return record


# ------------------------------------------------------------------
# Menyu (admin panel)
# ------------------------------------------------------------------

MENU_PATH = "menu/current.json"


def save_menu(menu):
    """Butun menyuni saqlaydi (admin panel «Saqlash»)."""
    return put_blob(MENU_PATH, menu)


def load_menu():
    """Admin tahrirlagan menyu. Hali tahrirlanmagan bo'lsa — None."""
    for b in list_blobs("menu/"):
        if b.get("pathname") == MENU_PATH:
            return get_blob(b.get("url", ""))
    return None


PROMO_PATH = "promos/current.json"


def save_promos(codes):
    """Chegirma kodlari ro'yxatini saqlaydi."""
    return put_blob(PROMO_PATH, {"codes": codes})


def load_promos():
    """Chegirma kodlari. Hali qo'shilmagan bo'lsa — bo'sh ro'yxat."""
    for b in list_blobs("promos/"):
        if b.get("pathname") == PROMO_PATH:
            data = get_blob(b.get("url", "")) or {}
            return data.get("codes", [])
    return []


def find_promo(code):
    """Kodni topadi (katta-kichik harf farqsiz). Topilmasa — None."""
    want = (code or "").strip().upper()
    if not want:
        return None
    for p in load_promos():
        if str(p.get("code", "")).strip().upper() == want:
            return p
    return None


def promo_discount(promo, subtotal):
    """Kodga ko'ra chegirma summasi. Yaroqsiz bo'lsa (0, sabab) qaytaradi."""
    if not promo:
        return 0, "not_found"
    if not promo.get("active", True):
        return 0, "inactive"
    min_order = int(promo.get("minOrder") or 0)
    if min_order and subtotal < min_order:
        return 0, "min_order"
    value = int(promo.get("value") or 0)
    if value <= 0:
        return 0, "not_found"
    if promo.get("type") == "fixed":
        discount = value
    else:  # percent
        discount = subtotal * value // 100
    # Chegirma buyurtma summasidan oshib ketmasin
    return max(0, min(discount, subtotal)), ""


def check_init_data(init_data, bot_token):
    """Telegram Mini App initData imzosini tekshiradi.

    Qaytaradi: (to'g'rimi, foydalanuvchi ma'lumoti)
    Hujjat: https://core.telegram.org/bots/webapps#validating-data
    """
    if not init_data or not bot_token:
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
        secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
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


# ---------- «Kirdi-chiqdi» kuzatuvi (buyurtmasiz ketgan mijozlar) ----------
VISIT_PREFIX = "visits/"
FOLLOWUP_PATH = "followup/config.json"

DEFAULT_FOLLOWUP = {
    "enabled": True,
    "delayMin": 5,      # necha daqiqadan keyin eslatma yuborilsin
    "text": "👀 Вы заглядывали в наше меню…\n"
            "Возвращайтесь — у нас есть ещё много вкусного! 🥙",
}


def save_followup_config(cfg):
    """Eslatma sozlamalarini saqlaydi."""
    return put_blob(FOLLOWUP_PATH, cfg)


def load_followup_config():
    """Eslatma sozlamalari. Saqlanmagan bo'lsa — standart qiymatlar."""
    for b in list_blobs("followup/"):
        if b.get("pathname") == FOLLOWUP_PATH:
            data = get_blob(b.get("url", "")) or {}
            cfg = dict(DEFAULT_FOLLOWUP)
            cfg.update({k: v for k, v in data.items() if k in DEFAULT_FOLLOWUP})
            return cfg
    return dict(DEFAULT_FOLLOWUP)


def visit_path(user_id):
    return f"{VISIT_PREFIX}{user_id}.json"


def save_visit(user):
    """Mijoz ilovani ochganini belgilab qo'yadi.

    Bugun allaqachon eslatma yuborilgan bo'lsa, o'sha belgi saqlanib
    qoladi — bir kunda bir necha marta kirsa ham xabar takrorlanmaydi.
    """
    uid = user.get("id")
    if not uid:
        return None
    today = today_key()

    notified_day = ""
    want = visit_path(uid)
    for b in list_blobs(want):
        if b.get("pathname") == want:
            old = get_blob(b.get("url", ""), fresh=True) or {}
            notified_day = old.get("notified_day", "")
            break

    record = {
        "id": uid,
        "name": user.get("first_name", ""),
        "username": user.get("username", ""),
        "opened_at": datetime.now(TASHKENT_TZ).isoformat(timespec="seconds"),
        "day": today,
    }
    if notified_day == today:
        record["notified_day"] = notified_day
    put_blob(want, record)
    return record


def delete_blobs(urls):
    """Blob fayllarni o'chiradi (to'liq URL bo'yicha)."""
    urls = [u for u in urls if u]
    if not urls or not BLOB_TOKEN:
        return False
    try:
        _request(
            "POST",
            f"{BLOB_API}/delete",
            data=json.dumps({"urls": urls}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] blob delete: {exc}")
        return False


def clear_visit(user_id):
    """Buyurtma berilgach yozuvni o'chiradi — eslatma ketmasin."""
    if not user_id:
        return
    want = visit_path(user_id)
    for b in list_blobs(want):
        if b.get("pathname") == want:
            delete_blobs([b.get("url", "")])
            return


def load_visits():
    """Barcha kutilayotgan tashriflar (o'chirish uchun blob URL bilan)."""
    out = []
    for b in list_blobs(VISIT_PREFIX):
        data = get_blob(b.get("url", ""), fresh=True)
        if data and data.get("id"):
            data["_url"] = b.get("url", "")
            out.append(data)
    return out


def all_customer_ids():
    """Buyurtma bergan barcha mijozlarning Telegram ID lari (takrorsiz)."""
    ids = []
    seen = set()
    for b in list_blobs("users/"):
        # users/<id>/<fayl>.json
        parts = str(b.get("pathname", "")).split("/")
        if len(parts) < 2 or not parts[1]:
            continue
        uid = parts[1]
        if uid not in seen:
            seen.add(uid)
            ids.append(uid)
    return ids


def save_image(filename, raw_bytes, content_type):
    """Mahsulot rasmini Blob'ga yuklaydi, ochiq URL qaytaradi."""
    if not BLOB_TOKEN:
        return ""
    try:
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()[:5]
        pathname = f"images/uploads/{uuid.uuid4().hex[:12]}{ext}"
        url = f"{BLOB_API}/{urllib.parse.quote(pathname)}"
        res = _request(
            "PUT",
            url,
            data=raw_bytes,
            headers={
                "Content-Type": content_type or "application/octet-stream",
                "x-add-random-suffix": "0",
            },
        )
        return res.get("url", "")
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] rasm yuklanmadi: {exc}")
        return ""


def day_report(day=None):
    """Kunlik hisobot: nechta buyurtma, qancha savdo, top taomlar."""
    day = day or today_key()
    records = load_orders(day)
    total = 0
    items = {}
    by_status = {}
    for r in records:
        o = r.get("order") or {}
        if r.get("status") != "cancelled":
            total += int(o.get("total") or 0)
        by_status[r.get("status", "new")] = by_status.get(r.get("status", "new"), 0) + 1
        for it in o.get("items", []):
            name = it.get("name", "-")
            items[name] = items.get(name, 0) + int(it.get("qty") or 0)
    top = sorted(items.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return {
        "day": day,
        "count": len(records),
        "total": total,
        "top": top,
        "by_status": by_status,
    }
