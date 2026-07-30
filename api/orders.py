#!/usr/bin/env python3
"""
DonDöner — buyurtmalar boti (yordamchi webhook)
====================================================================
Bu bot faqat buyurtmalarni qabul qiladi (xabarlarni `api/webhook.py`
yuboradi). Shu fayl esa uning o'z xabarlariga javob beradi:

  /start yoki /id  →  shu chatning ID raqamini aytadi.

ID kerak bo'ladi: botni guruhga qo'shsangiz, buyurtmalar o'sha guruhga
tushishi uchun ORDERS_CHAT_ID ga guruh ID sini yozib qo'yasiz.

Muhit o'zgaruvchilari:
  ORDERS_BOT_TOKEN — buyurtmalar botining tokeni
  WEBHOOK_SECRET   — webhook himoyasi (asosiy bot bilan bir xil)
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

import telebot
from telebot import types

# _store shu papkada — Vercel muhitida yo'lni qo'lda ko'rsatamiz
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _store  # noqa: E402

ORDERS_BOT_TOKEN = os.environ.get("ORDERS_BOT_TOKEN", "").strip()
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").strip()
WEBAPP_URL = os.environ.get(
    "WEBAPP_URL", "https://dondoner-blush.vercel.app/"
).strip()

TASHKENT_TZ = timezone(timedelta(hours=5))

bot = telebot.TeleBot(ORDERS_BOT_TOKEN or "0:none", parse_mode="HTML", threaded=False)


# Holat nomlari: mijozga va xodimga ko'rinadigan matnlar
# Har bir holat uchun: (xodim kartochkasidagi yozuv — o'zbekcha,
#                        mijozga boradigan xabar — ruscha)
STATUS_LABELS = {
    "accepted": ("✅ Qabul qilindi", "✅ Ваш заказ принят!"),
    "cooking": ("👨‍🍳 Tayyorlanmoqda", "👨‍🍳 Ваш заказ готовится!"),
    "onway": ("🛵 Yo'lda", "🛵 Курьер выехал! Скоро будет у вас."),
    "done": ("🏁 Yetkazildi", "🏁 Заказ доставлен. Приятного аппетита! 🥙"),
    "cancelled": ("❌ Bekor qilindi", "❌ К сожалению, ваш заказ отменён. Пожалуйста, свяжитесь с нами."),
}


# Holat qatori aynan shu nomlar bilan boshlanadi.
# Belgiga qarab emas, to'liq nomga qarab tekshiramiz — aks holda
# kuryerga izoh (🛵 ...) ham holat deb o'chirilib ketardi.
STATUS_PREFIXES = tuple(label for label, _ in STATUS_LABELS.values())

# Keyingi qadam tugmalari — faqat mantiqan keladigan amal ko'rsatiladi
NEXT_ACTIONS = {
    "new": [("✅ Olaman", "accepted"), ("❌ Bekor", "cancelled")],
    "accepted": [("👨\u200d🍳 Tayyorlanmoqda", "cooking"), ("❌ Bekor", "cancelled")],
    "cooking": [("🛵 Yo'lda", "onway"), ("❌ Bekor", "cancelled")],
    "onway": [("🏁 Yetkazildi", "done")],
    "done": [],
    "cancelled": [],
}


def order_keyboard(status, path, geo=None):
    """Kartochka tugmalari: xarita + keyingi qadam."""
    kb = types.InlineKeyboardMarkup()
    g = geo or {}
    if g.get("lat") and g.get("lng"):
        kb.row(
            types.InlineKeyboardButton(
                "🗺 Xaritada ochish (yo'l)",
                url=f"https://maps.google.com/?q={g['lat']},{g['lng']}",
            )
        )
    actions = NEXT_ACTIONS.get(status, [])
    if actions:
        kb.row(
            *[
                types.InlineKeyboardButton(text, callback_data=f"st:{code}:{path}")
                for text, code in actions
            ]
        )
    return kb if kb.keyboard else None


def strip_status_lines(text):
    """Kartochkadan eski holat qatorlarini olib tashlaydi."""
    lines = text.split("\n")
    while lines and lines[-1].strip().startswith(STATUS_PREFIXES):
        lines.pop()
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def customer_view_keyboard(number):
    """«📋 Buyurtmani ko'rish» tugmasi — Mini App'ni to'g'ridan-to'g'ri
    shu buyurtma holat sahifasiga ochadi."""
    if not WEBAPP_URL:
        return None
    url = WEBAPP_URL.rstrip("/") + "/?order=" + str(number)
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton("📋 Посмотреть заказ", web_app=types.WebAppInfo(url)))
    return kb


def notify_customer(chat_id, text, number=None):
    """Mijozga asosiy bot orqali xabar yuboradi."""
    if not (BOT_TOKEN and chat_id):
        return
    try:
        telebot.TeleBot(BOT_TOKEN, parse_mode="HTML", threaded=False).send_message(
            chat_id, text, reply_markup=customer_view_keyboard(number) if number else None
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] mijozga xabar: {exc}")


@bot.callback_query_handler(func=lambda c: (c.data or "").startswith("st:"))
def cb_status(call):
    """Holat tugmalari: qabul qilindi / tayyorlanmoqda / yo'lda / yetkazildi."""
    try:
        _, status, path = (call.data or "").split(":", 2)
    except ValueError:
        return bot.answer_callback_query(call.id, "Noto'g'ri amal")

    label, customer_text = STATUS_LABELS.get(status, ("", ""))
    if not label:
        return bot.answer_callback_query(call.id, "Noma'lum holat")

    who = call.from_user.first_name or "Xodim"
    stamp = datetime.now(TASHKENT_TZ).strftime("%H:%M")

    try:
        bot.answer_callback_query(call.id, label)
    except Exception:  # noqa: BLE001
        pass

    # Bazada holatni yangilaymiz va mijozga xabar beramiz
    record = _store.update_status(path, status, who) if path else None
    geo = ((record or {}).get("order") or {}).get("geo")
    if record and customer_text:
        user = record.get("user") or {}
        num = record.get("number", "")
        notify_customer(user.get("id"), f"{customer_text}\n\nRaqami: <b>#{num}</b>", num)

    # Kartochkada faqat BITTA holat qatori turadi — eskisi almashtiriladi
    base = strip_status_lines(call.message.html_text or call.message.text or "")
    updated = f"{base}\n\n{label} · {who} · {stamp}"

    try:
        bot.edit_message_text(
            updated,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=order_keyboard(status, path, geo),
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] kartochka yangilanmadi: {exc}")


@bot.callback_query_handler(func=lambda c: (c.data or "") == "list:today")
def cb_list_today(call):
    """Bugungi buyurtmalar ro'yxati va qisqa hisobot."""
    try:
        bot.answer_callback_query(call.id)
    except Exception:  # noqa: BLE001
        pass
    bot.send_message(call.message.chat.id, build_report_text())


def build_report_text(day=None):
    """Kunlik hisobot matni."""
    rep = _store.day_report(day)
    records = _store.load_orders(day)
    if not records:
        return f"📋 <b>{rep['day']}</b>\n\nBugun hali buyurtma yo'q."

    lines = [f"📋 <b>Bugungi buyurtmalar</b> · {rep['day']}", ""]
    for r in records:
        o = r.get("order") or {}
        label = STATUS_LABELS.get(r.get("status", ""), ("🆕 Yangi",))[0]
        total = f"{int(o.get('total') or 0):,}".replace(",", " ")
        lines.append(f"#{r.get('number')} · {total} so'm · {label}")
    total = f"{rep['total']:,}".replace(",", " ")
    lines.append("")
    lines.append(f"🧾 Jami: <b>{rep['count']} ta</b> · <b>{total} so'm</b>")
    if rep["top"]:
        lines.append("")
        lines.append("🔥 <b>Ko'p buyurtma qilinganlar:</b>")
        for name, qty in rep["top"]:
            lines.append(f"  • {name} — {qty} ta")
    return "\n".join(lines)


@bot.message_handler(commands=["report", "hisobot"])
def cmd_report(message):
    bot.send_message(message.chat.id, build_report_text())


@bot.message_handler(commands=["start", "id"])
def cmd_start(message):
    chat = message.chat
    if chat.type in ("group", "supergroup"):
        text = (
            "✅ Buyurtmalar shu guruhga tushadi.\n\n"
            f"<b>Guruh ID:</b> <code>{chat.id}</code>\n\n"
            "Shu raqamni <code>ORDERS_CHAT_ID</code> sozlamasiga yozing."
        )
    else:
        text = (
            "✅ Tayyor! Buyurtmalar shu chatga tushadi.\n\n"
            f"<b>Chat ID:</b> <code>{chat.id}</code>\n\n"
            "📋 /report — bugungi buyurtmalar va savdo hisoboti"
        )
    bot.send_message(chat.id, text)


@bot.message_handler(
    content_types=["new_chat_members"],
    func=lambda m: True,
)
def on_added_to_group(message):
    """Bot guruhga qo'shilganda ID sini aytadi."""
    me = bot.get_me()
    added = message.new_chat_members or []
    if not any(u.id == me.id for u in added):
        return
    bot.send_message(
        message.chat.id,
        "👋 Salom! Endi buyurtmalar shu guruhga tushadi.\n\n"
        f"<b>Guruh ID:</b> <code>{message.chat.id}</code>\n\n"
        "Shu raqamni <code>ORDERS_CHAT_ID</code> sozlamasiga yozing.",
    )


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        if WEBHOOK_SECRET:
            got = self.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
            if got != WEBHOOK_SECRET:
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"forbidden")
                return

        length = int(self.headers.get("content-length", 0))
        body = self.rfile.read(length).decode("utf-8")
        try:
            bot.process_new_updates([types.Update.de_json(body)])
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] Orders update qayta ishlanmadi: {exc}")

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_GET(self):  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("📋 Buyurtmalar boti webhook ishlayapti".encode("utf-8"))
