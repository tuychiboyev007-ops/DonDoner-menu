/*
 * DonDoner — menyu ma'lumotlari
 * ------------------------------------------------------------
 * Bu yagona fayl orqali butun menyuni boshqarasiz.
 * Yangi taom qo'shish uchun kerakli kategoriya "items" ro'yxatiga
 * yangi obyekt qo'shing.
 *
 * price  — so'mda (butun son)
 * weight — gramm/hajm matni ("883 g", "0.5 L") — ixtiyoriy
 * badge  — ixtiyoriy yorliq: "Hit" | "Yangi" | "Achchiq"
 * image  — rasm manzili (images/... yoki URL). Bo'sh bo'lsa emoji chiqadi.
 */

const MENU = {
  restaurant: {
    name: "DonDöner",
    tagline: "Turkcha ishtaha — O'zbekona mehmondo'stlik",
    botUsername: "DonDoner_bot",
    currency: "so'm",
    delivery: "🚗 Yetkazib berish — BEPUL",
    // Ish vaqti (Toshkent vaqti). Yopiq bo'lsa buyurtma qabul qilinmaydi.
    hours: { open: "10:00", close: "23:00" },
    // Yetkazish shartlari
    minOrder: 50000, // minimal buyurtma summasi (so'm), 0 = cheklov yo'q
    deliveryFee: 0, // yetkazish narxi (so'm), 0 = bepul
    instagram: "dondoner.uz",
    telegramChannel: "dondoner_uz",
    branches: [
      {
        label: "1-filial",
        address: "Yangi Chorsu, 219-uy",
        phone: "+998 90 053 25 25",
      },
      {
        label: "2-filial",
        address: "Charxiy Sportivniy ko'cha, 18-uy",
        phone: "+998 95 864 25 25",
      },
    ],
  },

  categories: [
    {
      id: "sets",
      name: "Setlar",
      icon: "🍱",
      items: [
        {
          id: "set-tombik",
          name: "Tombik doner seti",
          desc: "Tombik doner, fri, salat, sho'rva, ayron, sous",
          price: 99000,
          weight: "883 g",
          badge: "Hit",
          image: "",
        },
        {
          id: "set-porsion",
          name: "Porsion doner seti",
          desc: "Porsion doner, fri, lavash, sho'rva, ayron, sous",
          price: 109000,
          weight: "820 g",
          image: "",
        },
        {
          id: "set-family",
          name: "Oilaviy set",
          desc: "2 doner, 2 lavash, fri, 2 ichimlik — 3-4 kishiga",
          price: 189000,
          weight: "1650 g",
          badge: "Yangi",
          image: "",
        },
      ],
    },
    {
      id: "doner",
      name: "Donerlar",
      icon: "🥙",
      items: [
        {
          id: "doner-tombik",
          name: "Tombik doner",
          desc: "Maxsus tombik nonda, tovuq go'shti, sabzavot, sous",
          price: 42000,
          weight: "420 g",
          badge: "Hit",
          image: "",
        },
        {
          id: "doner-porsion",
          name: "Porsion doner",
          desc: "Tovuq go'shti, fri, sabzavot, ikki xil sous — laganda",
          price: 49000,
          weight: "450 g",
          image: "",
        },
        {
          id: "doner-beef",
          name: "Mol doner",
          desc: "Mol go'shti, yangi sabzavotlar, firmaviy sous",
          price: 52000,
          weight: "430 g",
          image: "",
        },
      ],
    },
    {
      id: "lavash",
      name: "Lavashlar",
      icon: "🌯",
      items: [
        {
          id: "lavash-classic",
          name: "Klassik lavash",
          desc: "Tovuq, fri kartoshka, sabzavot, sous",
          price: 32000,
          weight: "380 g",
          image: "",
        },
        {
          id: "lavash-cheese",
          name: "Pishloqli lavash",
          desc: "Tovuq, ikki xil pishloq, sabzavotlar",
          price: 37000,
          weight: "400 g",
          badge: "Hit",
          image: "",
        },
        {
          id: "lavash-hot",
          name: "Achchiq lavash",
          desc: "Tovuq, jalapeño, achchiq sous",
          price: 35000,
          weight: "390 g",
          badge: "Achchiq",
          image: "",
        },
      ],
    },
    {
      id: "soup",
      name: "Sho'rvalar",
      icon: "🍲",
      items: [
        {
          id: "soup-lentil",
          name: "Yasmiq sho'rva",
          desc: "An'anaviy turk yasmiq sho'rvasi, limon bilan",
          price: 22000,
          weight: "300 g",
          image: "",
        },
        {
          id: "soup-chicken",
          name: "Tovuqli sho'rva",
          desc: "Tovuq bulyoni, sabzavotlar, ko'katlar",
          price: 24000,
          weight: "320 g",
          image: "",
        },
      ],
    },
    {
      id: "salad",
      name: "Salatlar",
      icon: "🥗",
      items: [
        {
          id: "salad-fresh",
          name: "Yangi sabzavot salati",
          desc: "Pomidor, bodring, ko'katlar, zaytun moyi",
          price: 18000,
          weight: "220 g",
          image: "",
        },
        {
          id: "salad-coleslaw",
          name: "Karam salati (coleslaw)",
          desc: "Maydalangan karam, sabzi, maxsus sous",
          price: 16000,
          weight: "200 g",
          image: "",
        },
      ],
    },
    {
      id: "sides",
      name: "Garnirlar",
      icon: "🍟",
      items: [
        {
          id: "fries",
          name: "Fri kartoshka",
          desc: "Qarsildoq qovurilgan kartoshka",
          price: 17000,
          weight: "150 g",
          image: "",
        },
        {
          id: "nuggets",
          name: "Nagets (6 dona)",
          desc: "Tovuq nagetslari, sous bilan",
          price: 24000,
          weight: "180 g",
          image: "",
        },
      ],
    },
    {
      id: "drinks",
      name: "Ichimliklar",
      icon: "🥤",
      items: [
        {
          id: "cola",
          name: "Coca-Cola 0.5L",
          desc: "Sovuq gazli ichimlik",
          price: 12000,
          weight: "0.5 L",
          image: "",
        },
        {
          id: "ayron",
          name: "Ayron",
          desc: "Tabiiy ayron, sovuq",
          price: 9000,
          weight: "0.5 L",
          image: "",
        },
        {
          id: "tea",
          name: "Choy",
          desc: "Ko'k yoki qora choy",
          price: 6000,
          weight: "0.4 L",
          image: "",
        },
      ],
    },
  ],
};

window.MENU = MENU;
