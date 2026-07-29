#!/usr/bin/env python3
"""
DonDoner — Telegram bot (backend)
====================================================================
Vazifasi:
  1. /start bosilganda foydalanuvchiga Mini App'ni ochadigan tugma beradi.
  2. Mini App'dan kelgan buyurtmani (web_app_data) qabul qiladi.
  3. Buyurtmani ADMIN'ga (restoranga) yuboradi va mijozga tasdiq beradi.

Sozlamalar .env faylidan olinadi (maxfiy, git'ga tushmaydi):
  BOT_TOKEN     — BotFather bergan token
  WEBAPP_URL    — Mini App manzili (GitHub Pages https://...)
  ADMIN_CHAT_ID — buyurtmalar yuboriladigan chat (sizning Telegram ID yoki guruh)

Ishga tushirish:
  pip install -r requirements.txt
  python bot.py
"""

import os
import json
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

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")


def menu_keyboard():
    """Mini App'ni ochadigan reply-tugma.

    DIQQAT: web_app tugmasi REPLY klaviaturada bo'lgandagina Mini App
    buyurtmani botga qaytara oladi (sendData). Shuning uchun menyu shu
    tugma orqali ochilishi kerak.
    """
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True)
    if WEBAPP_URL:
        kb.add(
            types.KeyboardButton(
                "🍽 Menyuni ochish",
                web_app=types.WebAppInfo(WEBAPP_URL),
            )
        )
    kb.add(types.KeyboardButton("📞 Aloqa"), types.KeyboardButton("🕒 Ish vaqti"))
    return kb


@bot.message_handler(commands=["start"])
def cmd_start(message):
    name = message.from_user.first_name or "mehmon"
    text = (
        f"Assalomu alaykum, <b>{name}</b>! 🥙\n\n"
        "<b>DonDoner</b>ga xush kelibsiz.\n"
        "Menyuni ko'rish va buyurtma berish uchun quyidagi "
        "<b>«🍽 Menyuni ochish»</b> tugmasini bosing."
    )
    if not WEBAPP_URL:
        text += (
            "\n\n⚠️ <i>WEBAPP_URL hali sozlanmagan. .env faylida Mini App "
            "manzilini ko'rsating.</i>"
        )
    bot.send_message(message.chat.id, text, reply_markup=menu_keyboard())


@bot.message_handler(func=lambda m: m.text == "📞 Aloqa")
def cmd_contact(message):
    bot.send_message(message.chat.id, "📞 +998 90 000 00 00\n📍 Toshkent sh.")


@bot.message_handler(func=lambda m: m.text == "🕒 Ish vaqti")
def cmd_hours(message):
    bot.send_message(message.chat.id, "🕒 Har kuni 10:00 – 23:00")


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
    customer_id = message.from_user.id

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
        # ADMIN_CHAT_ID sozlanmagan bo'lsa — konsolga chiqaramiz
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


if __name__ == "__main__":
    print("🤖 DonDoner bot ishga tushdi...")
    if not WEBAPP_URL:
        print("⚠️  WEBAPP_URL sozlanmagan — Mini App tugmasi ko'rinmaydi.")
    if not ADMIN_CHAT_ID:
        print("⚠️  ADMIN_CHAT_ID sozlanmagan — buyurtmalar konsolga chiqadi.")
    bot.infinity_polling(skip_pending=True)
