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


def get_blob(url):
    """Saqlangan JSON faylni o'qiydi."""
    try:
        req = urllib.request.Request(url)
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
    path = f"orders/{day}/{number:04d}-{uuid.uuid4().hex[:6]}.json"
    record["path"] = path
    record["url"] = put_blob(path, record)
    return record


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
    return record


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
