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
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

import telebot
from telebot import types

ORDERS_BOT_TOKEN = os.environ.get("ORDERS_BOT_TOKEN", "").strip()
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").strip()

TASHKENT_TZ = timezone(timedelta(hours=5))

bot = telebot.TeleBot(ORDERS_BOT_TOKEN or "0:none", parse_mode="HTML", threaded=False)


@bot.callback_query_handler(func=lambda c: (c.data or "").startswith("take:"))
def cb_take(call):
    """«✅ Olaman» — buyurtmani kim olganini kartochkaga yozib qo'yadi."""
    who = call.from_user.first_name or "Xodim"
    if call.from_user.username:
        who += f" (@{call.from_user.username})"
    stamp = datetime.now(TASHKENT_TZ).strftime("%H:%M")

    try:
        bot.answer_callback_query(call.id, "Qabul qilindi ✅")
    except Exception:  # noqa: BLE001
        pass

    original = call.message.html_text or call.message.text or ""
    if "✅ Qabul qildi:" in original:
        return  # allaqachon olingan

    updated = f"{original}\n━━━━━━━━━━━━━━━\n✅ <b>Qabul qildi:</b> {who} · {stamp}"

    # Tugmalardan «Olaman»ni olib tashlaymiz, xarita havolasi qolsin
    markup = call.message.reply_markup
    rows = []
    if markup and markup.keyboard:
        for row in markup.keyboard:
            keep = [b for b in row if not (b.callback_data or "").startswith("take:")]
            if keep:
                rows.append(keep)
    new_markup = types.InlineKeyboardMarkup()
    for row in rows:
        new_markup.row(*row)

    try:
        bot.edit_message_text(
            updated,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=new_markup if rows else None,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN] kartochka yangilanmadi: {exc}")


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
            f"<b>Chat ID:</b> <code>{chat.id}</code>"
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
