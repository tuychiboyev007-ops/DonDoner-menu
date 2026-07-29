#!/usr/bin/env python3
"""
DonDoner — Telegram bot (backend)
====================================================================
Vazifasi:
  1. /start — xush kelibsiz xabari + Mini App'ni ochadigan tugma.
  2. Mini App'dan kelgan buyurtmani (web_app_data) qabul qiladi,
     ADMIN'ga yuboradi va mijozga tasdiq beradi.
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
import json
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
    "name": "DonDoner",
    "about": "🥙 O'tinda tayyorlangan asl doner",
    "hours": "Har kuni 10:00 – 23:00",
    "address": "Toshkent sh.",
    "phone": "+998 90 000 00 00",
}

# Menyuni ochib, shuncha vaqt ichida buyurtma qilmaganlarga eslatma
NUDGE_AFTER_SECONDS = 45 * 60  # 45 daqiqa

BTN_MENU = "Ochish"
BTN_FEEDBACK = "✍️ Fikr qoldirish"
KNOWN_BUTTONS = {BTN_MENU, BTN_FEEDBACK}

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

# Eslatma navbati: chat_id -> /start bosilgan vaqt
_nudge_queue = {}
_nudge_lock = threading.Lock()


def menu_keyboard():
    """Asosiy klaviatura.

    DIQQAT: web_app tugmasi REPLY klaviaturada bo'lgandagina Mini App
    buyurtmani botga qaytara oladi (sendData). Shuning uchun menyu shu
    tugma orqali ochilishi kerak.
    """
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    if WEBAPP_URL:
        kb.add(types.KeyboardButton(BTN_MENU, web_app=types.WebAppInfo(WEBAPP_URL)))
    kb.add(types.KeyboardButton(BTN_FEEDBACK))
    return kb


@bot.message_handler(commands=["start"])
def cmd_start(message):
    text = "Xush kelibsiz! 🥙"
    if not WEBAPP_URL:
        text += (
            "\n\n⚠️ <i>WEBAPP_URL hali sozlanmagan. .env faylida Mini App "
            "manzilini ko'rsating.</i>"
        )
    bot.send_message(message.chat.id, text, reply_markup=menu_keyboard())

    # Eslatma navbatiga qo'shamiz (buyurtma qilsa — o'chiriladi)
    with _nudge_lock:
        _nudge_queue[message.chat.id] = time.time()


@bot.message_handler(func=lambda m: m.text == BTN_FEEDBACK)
def cmd_feedback(message):
    msg = bot.send_message(
        message.chat.id,
        "Fikringizni yozib qoldiring — biz uchun juda muhim! 👇",
    )
    bot.register_next_step_handler(msg, on_feedback_text)


def on_feedback_text(message):
    """Fikr matnini qabul qilib, adminga yuboradi."""
    text = (message.text or "").strip()
    if not text or text in KNOWN_BUTTONS or text.startswith("/"):
        bot.send_message(message.chat.id, "Fikr qoldirish bekor qilindi.")
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

    bot.send_message(
        message.chat.id,
        "Rahmat! Fikringiz qabul qilindi 🙏",
        reply_markup=menu_keyboard(),
    )


@bot.message_handler(content_types=["web_app_data"])
def on_web_app_data(message):
    """Mini App'dan kelgan buyurtmani qabul qiladi."""
    try:
        payload = json.loads(message.web_app_data.data)
    except (ValueError, AttributeError):
        bot.send_message(message.chat.id, "Buyurtmani o'qib bo'lmadi 😕")
        return

    if payload.get("type") != "order":
        return

    order = payload.get("order", {})

    # Buyurtma qildi — eslatma kerak emas
    with _nudge_lock:
        _nudge_queue.pop(message.chat.id, None)

    # Mijozga tasdiq
    bot.send_message(
        message.chat.id,
        f"✅ Buyurtmangiz qabul qilindi!\n\n"
        f"Raqami: <b>{order.get('id', '-')}</b>\n"
        f"Tez orada operator siz bilan bog'lanadi. Rahmat! 🙌",
        reply_markup=menu_keyboard(),
    )

    # Adminga to'liq buyurtma
    admin_text = format_order_for_admin(order, message.from_user)
    if ADMIN_CHAT_ID:
        try:
            bot.send_message(ADMIN_CHAT_ID, admin_text)
        except Exception as exc:  # noqa: BLE001
            print(f"[WARN] Adminga yuborilmadi: {exc}")
    else:
        print("[ORDER]\n" + admin_text)


def format_order_for_admin(order, user):
    lines = ["🆕 <b>YANGI BUYURTMA</b>", ""]
    lines.append(f"№ {order.get('id', '-')}")
    lines.append(f"🕒 {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    lines.append(
        "🚚 " + ("Olib ketish" if order.get("mode") == "pickup" else "Yetkazish")
    )
    lines.append("")
    lines.append(f"👤 {order.get('name', '-')}")
    lines.append(f"📞 {order.get('phone', '-')}")
    if order.get("mode") != "pickup" and order.get("address"):
        lines.append(f"📍 {order.get('address')}")
    if order.get("note"):
        lines.append(f"📝 {order.get('note')}")
    lines.append("")
    lines.append("<b>Buyurtma:</b>")
    for it in order.get("items", []):
        line_total = it.get("price", 0) * it.get("qty", 0)
        lines.append(
            f"  • {it.get('name')} ×{it.get('qty')} — {line_total:,} so'm".replace(
                ",", " "
            )
        )
    total = order.get("total", 0)
    lines.append("")
    lines.append(f"💰 <b>Jami: {total:,} so'm</b>".replace(",", " "))
    lines.append("")
    lines.append(f"tg id: {user.id}" + (f" (@{user.username})" if user.username else ""))
    return "\n".join(lines)


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
                    "Taomlarimizni ko'rib chiqdingiz 👀\n"
                    "Davom etamizmi? Sizga yoqadigan yana ko'p narsamiz bor! 🥙",
                    reply_markup=menu_keyboard(),
                )
            except Exception as exc:  # noqa: BLE001
                print(f"[WARN] Eslatma yuborilmadi ({chat_id}): {exc}")


if __name__ == "__main__":
    print("🤖 DonDoner bot ishga tushdi...")
    if not WEBAPP_URL:
        print("⚠️  WEBAPP_URL sozlanmagan — Mini App tugmasi ko'rinmaydi.")
    if not ADMIN_CHAT_ID:
        print("⚠️  ADMIN_CHAT_ID sozlanmagan — buyurtmalar konsolga chiqadi.")
    threading.Thread(target=nudge_loop, daemon=True).start()
    bot.infinity_polling(skip_pending=True)
