#!/usr/bin/env python3
"""
DonDoner — Telegram bot (backend)
====================================================================
Vazifasi:
  1. /start — qisqa xush kelibsiz + xabar tagiga yopishgan (inline)
     «Ochish» va «✍️ Fikr qoldirish» tugmalari.
  2. Mini App'dan kelgan buyurtma matnini (🧾 bilan boshlanadi) qabul
     qiladi: ADMIN'ga uzatadi va mijozga tasdiq beradi.
  3. ✍️ Fikr qoldirish — mijoz fikri ADMIN'ga boradi.
  4. Eslatma: menyuni ochib buyurtma qilmagan mijozga bir muddatdan
     keyin bitta yumshoq eslatma yuboriladi.

Sozlamalar .env faylidan olinadi (maxfiy, git'ga tushmaydi):
  BOT_TOKEN     — BotFather bergan token
  WEBAPP_URL    — Mini App manzili (https://...)
  ADMIN_CHAT_ID — buyurtma va fikrlar boradigan chat ID

Ishga tushirish:
  pip install -r requirements.txt
  python bot.py
"""

import os
import time
import threading
from datetime import datetime

import telebot
from telebot import types

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv bo'lmasa, muhit o'zgaruvchilaridan o'qiydi

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
WEBAPP_URL = os.environ.get("WEBAPP_URL", "").strip()
ADMIN_CHAT_ID = os.environ.get("ADMIN_CHAT_ID", "").strip()

if not BOT_TOKEN:
    raise SystemExit(
        "❌ BOT_TOKEN topilmadi. .env fayl yarating (namuna: .env.example)."
    )

# ------------------------------------------------------------------
# Restoran ma'lumotlari — shu yerdan tahrirlang
# ------------------------------------------------------------------
RESTAURANT = {
    "name": "DonDöner",
    "about": "🥙 O'tinda tayyorlangan asl doner — TURK ART CAFE",
    "branches": [
        {"address": "Yangi Chorsu, 219-uy", "phone": "+998 90 053 25 25"},
        {"address": "Charxiy Sportivniy ko'cha, 18-uy", "phone": "+998 95 864 25 25"},
    ],
    "delivery": "Yetkazib berish — BEPUL",
    "instagram": "dondoner.uz",
    "telegram_channel": "dondoner_uz",
}

# Menyuni ochib, shuncha vaqt ichida buyurtma qilmaganlarga eslatma
NUDGE_AFTER_SECONDS = 45 * 60  # 45 daqiqa

ORDER_PREFIX = "🧾"  # Mini App'dan keladigan buyurtma matni shu bilan boshlanadi

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

# Eslatma navbati: chat_id -> /start bosilgan vaqt
_nudge_queue = {}
_nudge_lock = threading.Lock()


def inline_keyboard():
    """Xabar tagiga yopishgan tugmalar (reference ko'rinishi)."""
    kb = types.InlineKeyboardMarkup()
    if WEBAPP_URL:
        kb.add(
            types.InlineKeyboardButton(
                "Открыть", web_app=types.WebAppInfo(WEBAPP_URL)
            )
        )
    kb.add(types.InlineKeyboardButton("✍️ Оставить отзыв", callback_data="feedback"))
    return kb


@bot.message_handler(commands=["start"])
def cmd_start(message):
    text = "Добро пожаловать"
    if not WEBAPP_URL:
        text += (
            "\n\n⚠️ <i>WEBAPP_URL hali sozlanmagan. .env faylida Mini App "
            "manzilini ko'rsating.</i>"
        )
    bot.send_message(message.chat.id, text, reply_markup=inline_keyboard())

    # Eslatma navbatiga qo'shamiz (buyurtma qilsa — o'chiriladi)
    with _nudge_lock:
        _nudge_queue[message.chat.id] = time.time()


FEEDBACK_PROMPT = "Напишите ваш отзыв — нам очень важно ваше мнение 👇"


@bot.callback_query_handler(func=lambda c: c.data == "feedback")
def cb_feedback(call):
    bot.answer_callback_query(call.id)
    msg = bot.send_message(
        call.message.chat.id,
        FEEDBACK_PROMPT,
        reply_markup=types.ReplyKeyboardRemove(),
    )
    bot.register_next_step_handler(msg, on_feedback_text)


# Eski versiya klaviaturasidan qolgan tugma bosilsa ham ishlasin
@bot.message_handler(
    func=lambda m: (m.text or "") in ("✍️ Fikr qoldirish", "✍️ Оставить отзыв")
)
def legacy_feedback_button(message):
    msg = bot.send_message(
        message.chat.id,
        FEEDBACK_PROMPT,
        reply_markup=types.ReplyKeyboardRemove(),
    )
    bot.register_next_step_handler(msg, on_feedback_text)


def on_feedback_text(message):
    """Fikr matnini qabul qilib, adminga yuboradi."""
    text = (message.text or "").strip()
    if not text or text.startswith("/") or text.startswith(ORDER_PREFIX):
        bot.send_message(message.chat.id, "Отменено.")
        return

    user = message.from_user
    who = user.first_name or "Mijoz"
    if user.username:
        who += f" (@{user.username})"

    if ADMIN_CHAT_ID:
        try:
            bot.send_message(
                ADMIN_CHAT_ID,
                f"💬 <b>YANGI FIKR</b>\n\n{text}\n\n— {who}, id: {user.id}",
            )
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Fikr adminga yuborilmadi: {exc}")
    else:
        print(f"[FEEDBACK] {who}: {text}")

    bot.send_message(message.chat.id, "Спасибо! Ваш отзыв принят 🙏")


@bot.message_handler(func=lambda m: (m.text or "").startswith(ORDER_PREFIX))
def on_order_text(message):
    """Mini App chatga qo'ygan buyurtma xabarini qabul qiladi."""
    user = message.from_user

    # Buyurtma qildi — eslatma kerak emas
    with _nudge_lock:
        _nudge_queue.pop(message.chat.id, None)

    # Mijozga tasdiq
    bot.send_message(
        message.chat.id,
        "✅ Ваш заказ принят!\n"
        "Оператор скоро свяжется с вами. Спасибо! 🙌",
        reply_markup=inline_keyboard(),
    )

    # Adminga uzatish
    who = f"tg id: {user.id}" + (f" (@{user.username})" if user.username else "")
    admin_text = (
        f"🆕 <b>YANGI BUYURTMA</b>\n"
        f"🕒 {datetime.now().strftime('%d.%m.%Y %H:%M')}\n\n"
        f"{message.text}\n\n{who}"
    )
    if ADMIN_CHAT_ID:
        try:
            bot.send_message(ADMIN_CHAT_ID, admin_text)
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Adminga yuborilmadi: {exc}")
    else:
        print("[ORDER]\n" + admin_text)


def nudge_loop():
    """Buyurtma qilmagan mijozlarga bitta yumshoq eslatma yuboradi."""
    while True:
        time.sleep(60)
        now = time.time()
        due = []
        with _nudge_lock:
            for chat_id, ts in list(_nudge_queue.items()):
                if now - ts >= NUDGE_AFTER_SECONDS:
                    due.append(chat_id)
                    _nudge_queue.pop(chat_id, None)
        for chat_id in due:
            try:
                bot.send_message(
                    chat_id,
                    "Вы смотрели наши блюда 👀\n"
                    "Давайте продолжим — у нас есть ещё много того, "
                    "что вам понравится 🥙",
                    reply_markup=inline_keyboard(),
                )
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] Eslatma yuborilmadi ({chat_id}): {exc}")


if __name__ == "__main__":
    print("🤖 DonDoner bot ishga tushdi...")
    if not WEBAPP_URL:
        print("⚠️  WEBAPP_URL sozlanmagan — «Ochish» tugmasi ko'rinmaydi.")
    if not ADMIN_CHAT_ID:
        print("⚠️  ADMIN_CHAT_ID sozlanmagan — buyurtmalar konsolga chiqadi.")
    threading.Thread(target=nudge_loop, daemon=True).start()
    bot.infinity_polling(skip_pending=True)
