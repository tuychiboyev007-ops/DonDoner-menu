/*
 * DonDöner — menyu ma'lumotlari
 * ------------------------------------------------------------
 * Bu yagona fayl orqali butun menyuni boshqarasiz.
 *
 * price     — so'mda (butun son)
 * oldPrice  — chegirmadan oldingi narx (ixtiyoriy, ustidan chizib ko'rsatiladi)
 * variants  — o'lcham/turlar: [{ label: "Katta", price: 80000 }, ...]
 *             variants bo'lsa, price o'rniga shular ishlatiladi
 * desc      — tarkibi
 * badge     — "Hit" | "Yangi" | "Achchiq"
 * image     — rasm manzili (images/...). Bo'sh bo'lsa emoji chiqadi.
 */

const MENU = {
  restaurant: {
    name: "DonDöner",
    tagline: "Turkcha ishtaha — O'zbekona mehmondo'stlik",
    botUsername: "DonDoner_bot",
    currency: "so'm",
    delivery: "🚗 Shahar bo'ylab yetkazib berish BEPUL",
    // Ish vaqti (Toshkent). 08:00 dan tunki 02:00 gacha.
    hours: { open: "08:00", close: "02:00" },
    minOrder: 0, // minimal buyurtma yo'q
    deliveryFee: 0, // yetkazish bepul
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
    /* ---------------- SETLAR ---------------- */
    {
      id: "sets",
      name: "Setlar",
      icon: "🍱",
      items: [
        {
          id: "set-donerli",
          name: "Donerli SET",
          desc: "Doner, ekmek, choban salat, tuzlama, adjika, ayron yoki cola",
          price: 75000,
          image: "",
        },
        {
          id: "set-kofteli",
          name: "Kofteli SET",
          desc: "Kofte, ekmek, choban salat, tuzlama, adjika, ayron yoki cola",
          price: 75000,
          image: "",
        },
        {
          id: "set-burger",
          name: "Burger SET",
          desc: "Burger, fri, cola 0.25l",
          price: 42000,
          oldPrice: 55000,
          image: "",
        },
        {
          id: "set-dondoner",
          name: "DonDoner SET",
          desc: "DonDoner, ayron, simit",
          price: 46000,
          oldPrice: 56000,
          image: "",
        },
        {
          id: "set-lavash",
          name: "Lavash SET",
          desc: "Lavash, fri, cola 0.25l",
          price: 48000,
          oldPrice: 57000,
          image: "",
        },
        {
          id: "set-durum",
          name: "Durum SET",
          desc: "Durum, fri, ayron",
          price: 55000,
          oldPrice: 68000,
          image: "",
        },
        {
          id: "set-arkadash",
          name: "Arkadash SET",
          desc: "DonBurger, durum, 2 ta cola 0.25l, fri",
          price: 84000,
          oldPrice: 99000,
          badge: "Hit",
          image: "",
        },
        {
          id: "set-abi",
          name: "Abi SET",
          desc: "Doner, durum, 2 ta cola 0.25l, simit",
          price: 82000,
          oldPrice: 94000,
          image: "",
        },
        {
          id: "set-bebek",
          name: "Bebek SET",
          desc: "Mini doner, fri, sok",
          price: 37000,
          oldPrice: 50000,
          image: "",
        },
      ],
    },

    /* ---------------- ASOSIY TAOMLAR ---------------- */
    {
      id: "main",
      name: "Asosiy taomlar",
      icon: "🍽",
      items: [
        {
          id: "doner-plate",
          name: "Doner",
          desc: "Set tarkibi: choban salat, tuzlama, achchiq sous, ayron yoki cola 0,25L",
          variants: [
            { label: "Oddiy", price: 60000 },
            { label: "Set", price: 75000 },
          ],
          image: "",
        },
        {
          id: "kofte",
          name: "Kofte",
          desc: "Set tarkibi: choban salat, tuzlama, achchiq sous, ayron yoki cola 0,25L",
          variants: [
            { label: "Oddiy", price: 60000 },
            { label: "Set", price: 75000 },
          ],
          badge: "Hit",
          image: "",
        },
        {
          id: "iskender",
          name: "Iskender Kebab",
          desc: "Set tarkibi: choban salat, tuzlama, achchiq sous, ayron yoki cola 0,25L",
          variants: [
            { label: "Oddiy", price: 60000 },
            { label: "Set", price: 75000 },
          ],
          badge: "Yangi",
          image: "",
        },
      ],
    },

    /* ---------------- DONERLAR ---------------- */
    {
      id: "doner",
      name: "Donerlar",
      icon: "🥙",
      items: [
        { id: "dondoner-mini", name: "DonDoner mini", price: 27000, image: "" },
        { id: "dondoner", name: "DonDoner", price: 38000, image: "" },
        { id: "doner-cheese", name: "Doner cheese", price: 42000, image: "" },
        { id: "doner-burger", name: "Doner burger", price: 35000, image: "" },
      ],
    },

    /* ---------------- PITSALAR ---------------- */
    {
      id: "pizza",
      name: "Pitsalar",
      icon: "🍕",
      items: [
        {
          id: "pizza-pepperoni",
          name: "Pepperoni",
          variants: [
            { label: "Kichik", price: 60000 },
            { label: "O'rta", price: 70000 },
            { label: "Katta", price: 80000 },
          ],
          image: "",
        },
        {
          id: "pizza-qazili",
          name: "Qazili",
          variants: [
            { label: "Kichik", price: 85000 },
            { label: "O'rta", price: 105000 },
            { label: "Katta", price: 120000 },
          ],
          image: "",
        },
        {
          id: "pizza-barbeque",
          name: "Barbeque",
          variants: [
            { label: "Kichik", price: 60000 },
            { label: "O'rta", price: 80000 },
            { label: "Katta", price: 100000 },
          ],
          badge: "Hit",
          image: "",
        },
        {
          id: "pizza-4sezon",
          name: "4 sezon",
          variants: [{ label: "Katta", price: 120000 }],
          badge: "Hit",
          image: "",
        },
        {
          id: "pizza-cheese",
          name: "Cheese",
          variants: [
            { label: "Kichik", price: 55000 },
            { label: "O'rta", price: 65000 },
            { label: "Katta", price: 75000 },
          ],
          image: "",
        },
        {
          id: "pizza-doner",
          name: "Doner pitsa",
          variants: [
            { label: "Kichik", price: 65000 },
            { label: "O'rta", price: 80000 },
            { label: "Katta", price: 100000 },
          ],
          image: "",
        },
        {
          id: "pizza-assorti",
          name: "Assorti",
          variants: [
            { label: "Kichik", price: 65000 },
            { label: "O'rta", price: 85000 },
            { label: "Katta", price: 100000 },
          ],
          image: "",
        },
        {
          id: "pizza-tovuqli",
          name: "Tovuqli",
          variants: [
            { label: "Kichik", price: 50000 },
            { label: "O'rta", price: 60000 },
            { label: "Katta", price: 70000 },
          ],
          image: "",
        },
        {
          id: "pizza-indeyka",
          name: "Indeyka",
          variants: [
            { label: "Kichik", price: 65000 },
            { label: "O'rta", price: 75000 },
            { label: "Katta", price: 95000 },
          ],
          image: "",
        },
      ],
    },

    /* ---------------- BURGERLAR ---------------- */
    {
      id: "burger",
      name: "Burgerlar",
      icon: "🍔",
      items: [
        { id: "gamburger", name: "Gamburger", price: 33000, image: "" },
        { id: "cheese-burger", name: "Cheese burger", price: 35000, image: "" },
        { id: "donburger", name: "DonBurger", price: 38000, image: "" },
        { id: "double-burger", name: "Double burger", price: 40000, image: "" },
        {
          id: "muhtasham-burger",
          name: "Muhtasham Burger",
          desc: "Doner go'shtidan burger, motsarella sir, qaymoqli slivka va sutli sous",
          price: 50000,
          badge: "Hit",
          image: "",
        },
      ],
    },

    /* ---------------- LAVASHLAR ---------------- */
    {
      id: "lavash",
      name: "Lavashlar",
      icon: "🌯",
      items: [
        { id: "lavash", name: "Lavash", price: 35000, image: "" },
        { id: "lavash-extra", name: "Extra lavash", price: 38000, image: "" },
        { id: "lavash-cheese", name: "Lavash cheese", price: 38000, image: "" },
        { id: "lavash-mini", name: "Lavash mini", price: 32000, image: "" },
      ],
    },

    /* ---------------- DURUM ---------------- */
    {
      id: "durum",
      name: "Durum",
      icon: "🌮",
      items: [
        { id: "durum-adana", name: "Adana dürüm", price: 40000, image: "" },
        { id: "durum-cheese", name: "Cheese dürüm", price: 45000, image: "" },
      ],
    },

    /* ---------------- HOT-DOGLAR ---------------- */
    {
      id: "hotdog",
      name: "Hot-Doglar",
      icon: "🌭",
      items: [
        { id: "hotdog-kanada", name: "Hot-Dog kanada", price: 13000, image: "" },
        { id: "hotdog-qovurilgan", name: "Hot-Dog qovurilgan", price: 15000, image: "" },
        { id: "hotdog-barbeque", name: "Barbeque Hot-Dog", price: 24000, image: "" },
      ],
    },

    /* ---------------- TOVUQLI FAST FOOD ---------------- */
    {
      id: "chicken",
      name: "Tovuqli fast food",
      icon: "🍗",
      items: [
        { id: "kfc-1", name: "KFC 1 porsiya", price: 28000, image: "" },
        { id: "kfc-1kg", name: "KFC 1 kg", price: 100000, image: "" },
        { id: "longer", name: "Longer", price: 28000, image: "" },
        { id: "kfc-burger", name: "KFC Burger", price: 28000, image: "" },
      ],
    },

    /* ---------------- SALATLAR ---------------- */
    {
      id: "salad",
      name: "Salatlar",
      icon: "🥗",
      items: [
        { id: "sezar", name: "Sezar", price: 27000, image: "" },
        { id: "baqlajon", name: "Qarsildoq baqlajon", price: 27000, image: "" },
      ],
    },

    /* ---------------- SNEKLAR ---------------- */
    {
      id: "snacks",
      name: "Sneklar",
      icon: "🍟",
      items: [
        { id: "fri-standart", name: "Fri standart", price: 18000, image: "" },
        { id: "derevenskiy", name: "Derevenskiy", price: 18000, image: "" },
        { id: "simit", name: "Simit", price: 8000, image: "" },
        { id: "simit-nutella", name: "Simit + Nutella", price: 18000, image: "" },
      ],
    },
  ],
};

window.MENU = MENU;
