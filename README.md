# 🥙 DonDoner — Telegram Mini App (menyu + buyurtma)

Telegram ichida ochiladigan to'liq ovqat yetkazish ilovasi: menyu, savat,
buyurtma berish, buyurtmalar tarixi va profil. Frontend statik fayllardan
iborat (**bepul** joylanadi), buyurtmalarni bot orqali qabul qilasiz.

## 📁 Tuzilishi

```
├── index.html          # Mini App (4 tab: Bosh sahifa / Savat / Buyurtmalar / Profil)
├── css/style.css       # Dizayn (yashil brend, Telegram temasi)
├── js/app.js           # Savat, checkout, navigatsiya, Telegram integratsiya
├── data/menu.js        # 👉 TAOMLAR shu yerda (oson tahrirlanadi)
└── bot/
    ├── bot.py          # Telegram bot (buyurtmalarni qabul qiladi)
    ├── requirements.txt
    └── .env.example    # sozlamalar namunasi
```

## 🔐 Eng muhim: token xavfsizligi

> ⚠️ **Bot tokeningizni hech kimga bermang va hech qayerga ochiq yozmang.**
> Agar token commit'ga tushsa yoki chatda ko'rinsa — darhol
> [@BotFather](https://t.me/BotFather) → `/revoke` orqali **yangi token** oling.
>
> Bu loyihada token faqat `bot/.env` faylida turadi va u `.gitignore` orqali
> git'dan chetlatilgan — GitHub'ga **hech qachon** yuklanmaydi.

---

## 1-qism: Mini App (frontend)

### ✏️ Menyuni tahrirlash

Barcha taomlar `data/menu.js` faylida. Yangi taom qo'shish:

```js
{
  id: "doner-new",              // takrorlanmas nom
  name: "Yangi doner",
  desc: "Tarkibi haqida qisqa izoh",
  price: 30000,                 // so'mda, butun son
  weight: "420 g",              // ixtiyoriy
  badge: "Yangi",               // ixtiyoriy: "Hit" | "Yangi" | "Achchiq"
  image: "images/doner.jpg",    // ixtiyoriy — bo'sh bo'lsa emoji chiqadi
}
```

Restoran nomi, telefon, ish vaqti — shu faylning yuqorisidagi `restaurant`
bo'limida.

### 🚀 Bepul joylash (GitHub Pages)

1. Repozitoriyni GitHub'ga push qiling.
2. **Settings → Pages → Source** → `Deploy from a branch`, branch: `main`,
   papka: `/ (root)`.
3. Bir necha daqiqadan so'ng manzil tayyor:
   `https://<username>.github.io/DonDoner-menu/`

### 🧪 Lokal ko'rish

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

---

## 2-qism: Bot (backend)

Bot `/start` bosilganda menyu tugmasini beradi va Mini App'dan kelgan
buyurtmalarni sizga (adminga) yuboradi.

### ⚙️ Sozlash

1. `bot/` papkasiga o'ting va sozlamalar faylini yarating:

   ```bash
   cd bot
   cp .env.example .env
   ```

2. `.env` faylini to'ldiring:

   ```
   BOT_TOKEN=BotFather_bergan_token
   WEBAPP_URL=https://<username>.github.io/DonDoner-menu/
   ADMIN_CHAT_ID=Sizning_Telegram_ID
   ```

   > 💡 O'z Telegram ID'ingizni bilish uchun
   > [@userinfobot](https://t.me/userinfobot) ga `/start` yozing.

3. Kutubxonalarni o'rnating va botni ishga tushiring:

   ```bash
   pip install -r requirements.txt
   python bot.py
   ```

Bot ishlab turgan vaqtda `/start` bosilsa — **«🍽 Menyuni ochish»** tugmasi
chiqadi. U orqali Mini App ochiladi va buyurtma to'g'ridan-to'g'ri botga
qaytadi.

> ⚠️ **Muhim:** Mini App buyurtmani botga qaytarishi uchun u **shu tugma**
> (reply-klaviatura) orqali ochilishi kerak. BotFather'dagi «menu button»
> orqali ochilsa, buyurtma yuborish `sendData` ishlamaydi (Telegram cheklovi).

### 🌐 Doimiy ishlash — Vercel (joriy holat)

Loyiha **Vercel**'da joylashtirilgan: Mini App ham, bot ham bitta manzilda.

- **Mini App:** https://dondoner-blush.vercel.app/
- **Bot webhook:** https://dondoner-blush.vercel.app/api/webhook

Vercel sozlamalari (Settings → Environment Variables):

| O'zgaruvchi | Vazifasi |
|---|---|
| `BOT_TOKEN` | BotFather tokeni |
| `ADMIN_CHAT_ID` | buyurtma va fikrlar boradigan chat |
| `WEBHOOK_SECRET` | webhook himoyasi (Telegram shu kalitni yuboradi) |
| `WEBAPP_URL` | «Открыть» tugmasi ochadigan manzil |

Qayta deploy qilish:

```bash
vercel deploy --prod
```

Webhook'ni qayta ulash (odatda kerak emas):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://dondoner-blush.vercel.app/api/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

> ⚠️ Polling (`bot/bot.py`) va webhook bir vaqtda ishlamaydi. Webhook
> yoqilgan — `bot.py` faqat lokal sinov uchun qoldirilgan. Unga qaytish
> uchun avval `deleteWebhook` chaqiring.
>
> Eslatma: serverless muhitda 45 daqiqalik "eslatma" xabari ishlamaydi
> (doimiy jarayon yo'q) — qolgan hamma funksiya to'liq ishlaydi.

---

## 🤖 BotFather sozlamalari (ixtiyoriy, lekin tavsiya)

Menyu tugmasidan tashqari, botga qulaylik uchun:

- `/setmenubutton` — botning pastki menyu tugmasiga Mini App URL'ini qo'ying
  (menyuни ko'rsatish uchun; lekin buyurtma reply-tugma orqali ketadi).
- `/setdescription`, `/setabouttext` — bot tavsifi.
- `/setuserpic` — bot rasmi (logotip).

> 💡 Stollarga QR-kod qo'ying — u botni `https://t.me/<bot_username>` orqali
> ochsin.

## 🎨 Xususiyatlari

- 📱 Mobil uchun optimallashtirilgan, delivery-app ko'rinishi
- 🌗 Telegram temasiga (yorug'/qorong'i) avtomatik moslashadi
- 🛒 Savat: qo'shish/kamaytirish, jami hisob
- 🧾 Checkout: ism, telefon, manzil, yetkazish/olib ketish
- 📋 Buyurtmalar tarixi (qurilmada saqlanadi)
- 👤 Profil (Telegram foydalanuvchi ma'lumoti)
- 📳 Haptic (tebranish) his-tuyg'usi
- ⚡ Build kerak emas — sof HTML/CSS/JS
