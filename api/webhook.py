#!/usr/bin/env python3
"""
DonDöner bot — Vercel webhook versiyasi (serverless)
====================================================================
Telegram har bir yangilanishni shu manzilga POST qiladi:
    https://<loyiha>.vercel.app/api/webhook

Muhit o'zgaruvchilari (Vercel dashboard → Settings → Environment Variables):
  BOT_TOKEN      — BotFather bergan token (majburiy)
  ADMIN_CHAT_ID  — buyurtma va fikrlar boradigan chat ID (majburiy)
  WEBAPP_URL     — Mini App manzili (ixtiyoriy, standart: GitHub Pages)
  WEBHOOK_SECRET — setWebhook'da berilgan maxfiy kalit (ixtiyoriy,
                   qo'yilsa, faqat Telegram'dan kelgan so'rovlar qabul qilinadi)

Serverless muhitda xotira saqlanmaydi, shuning uchun hamma narsa
holatsiz (stateless) ishlaydi:
  - fikr so'rovi ForceReply orqali (javob xabaridan aniqlanadi)
  - buyurtma 🧾 belgisi bilan boshlanadigan matndan aniqlanadi
"""

import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler

import telebot
from telebot import types

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "").strip()
WEBAPP_URL = os.environ.get(
    "WEBAPP_URL", "https://tuychiboyev007-ops.github.io/DonDoner-menu/"
).strip()
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "").strip()

ORDER_PREFIX = "🧾"
FEEDBACK_PROMPT = "Напишите ваш отзыв — нам очень важно ваше мнение 👇"

# threaded=False — serverless uchun majburiy
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML", threaded=False)


def inline_keyboard():
    kb = types.InlineKeyboardMarkup()
    if WEBAPP_URL:
        kb.add(
            types.InlineKeyboardButton("Открыть", web_app=types.WebAppInfo(WEBAPP_URL))
        )
    kb.add(types.InlineKeyboardButton("✍️ Оставить отзыв", callback_data="feedback"))
    return kb


def user_line(user):
    return f"tg id: {user.id}" + (f" (@{user.username})" if user.username else "")


def to_admin(text):
    if ADMIN_CHAT_ID:
        try:
            bot.send_message(ADMIN_CHAT_ID, text)
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Adminga yuborilmadi: {exc}")
    else:
        print("[ADMIN]\n" + text)


@bot.message_handler(commands=["start"])
def cmd_start(message):
    bot.send_message(message.chat.id, "Добро пожаловать", reply_markup=inline_keyboard())


@bot.callback_query_handler(func=lambda c: c.data == "feedback")
def cb_feedback(call):
    bot.answer_callback_query(call.id)
    bot.send_message(
        call.message.chat.id,
        FEEDBACK_PROMPT,
        reply_markup=types.ForceReply(),
    )


@bot.message_handler(func=lambda m: (m.text or "").startswith(ORDER_PREFIX))
def on_order_text(message):
    """Mini App chatga qo'ygan buyurtma xabari."""
    bot.send_message(
        message.chat.id,
        "✅ Ваш заказ принят!\nОператор скоро свяжется с вами. Спасибо! 🙌",
        reply_markup=inline_keyboard(),
    )
    to_admin(
        f"🆕 <b>YANGI BUYURTMA</b>\n"
        f"🕒 {datetime.now().strftime('%d.%m.%Y %H:%M')}\n\n"
        f"{message.text}\n\n{user_line(message.from_user)}"
    )


@bot.message_handler(func=lambda m: m.content_type == "text")
def on_text(message):
    """Fikr (ForceReply javobi) yoki oddiy xabar — adminga uzatiladi."""
    text = (message.text or "").strip()
    if not text or text.startswith("/"):
        return

    is_feedback = bool(
        message.reply_to_message
        and (message.reply_to_message.text or "") == FEEDBACK_PROMPT
    )
    label = "💬 <b>YANGI FIKR</b>" if is_feedback else "💬 <b>Mijozdan xabar</b>"
    to_admin(f"{label}\n\n{text}\n\n{user_line(message.from_user)}")
    bot.send_message(message.chat.id, "Спасибо! Ваше сообщение принято 🙏")


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel talabi
    def do_POST(self):  # noqa: N802
        # Maxfiy kalit tekshiruvi (sozlangan bo'lsa)
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
            update = types.Update.de_json(body)
            bot.process_new_updates([update])
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] Update qayta ishlanmadi: {exc}")

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_GET(self):  # noqa: N802
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("🤖 DonDöner bot webhook ishlayapti".encode("utf-8"))
