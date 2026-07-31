/*
 * DonDöner — menyu ma'lumotlari (zaxira nusxa)
 * ------------------------------------------------------------
 * DIQQAT: kundalik menyu admin panel orqali boshqariladi va
 * serverda (/api/menu) saqlanadi. Bu fayl faqat ZAXIRA — server
 * javob bermay qolsa ilova shu ro'yxatni ko'rsatadi.
 *
 * Shuning uchun uni qo'lda tahrirlash shart emas: jonli menyu
 * o'zgarganda shu yerga ko'chirib qo'yiladi.
 *
 * price     — so'mda (butun son)
 * oldPrice  — chegirmadan oldingi narx (ustidan chizib ko'rsatiladi)
 * variants  — o'lcham/turlar: [{ label, price }, ...]
 * desc      — tarkibi
 * badge     — "Hit" | "Yangi" | "Achchiq"
 * image     — rasm manzili. Bo'sh bo'lsa emoji chiqadi.
 */

const MENU = {
  "restaurant": {
    "name": "DonDöner",
    "tagline": "Турецкий аппетит — узбекское гостеприимство",
    "botUsername": "DonDoner_bot",
    "currency": "сум",
    "delivery": "🚗 Доставка по городу БЕСПЛАТНО",
    "hours": {
      "open": "08:00",
      "close": "02:00"
    },
    "minOrder": 0,
    "deliveryFee": 0,
    "instagram": "dondoner.uz",
    "telegramChannel": "dondoner_uz",
    "branches": [
      {
        "label": "Филиал 1",
        "address": "Янги Чорсу, дом 219",
        "phone": "+998 90 053 25 25",
        "id": "b1",
        "chatId": ""
      },
      {
        "label": "Филиал 2",
        "address": "улица Чархий Спортивный, дом 18",
        "phone": "+998 95 864 25 25",
        "id": "b2",
        "chatId": ""
      }
    ]
  },
  "categories": [
    {
      "id": "sets",
      "name": "Сеты",
      "icon": "🍱",
      "items": [
        {
          "id": "set-donerli",
          "name": "Сет с донером",
          "desc": "Донер, хлеб, пастуший салат, соленья, аджика, айран или кола",
          "price": 75000,
          "image": ""
        },
        {
          "id": "set-kofteli",
          "name": "Сет с кёфте",
          "desc": "Кёфте, хлеб, пастуший салат, соленья, аджика, айран или кола",
          "price": 75000,
          "image": ""
        },
        {
          "id": "set-burger",
          "name": "Бургер сет",
          "desc": "Бургер, картофель фри, кола 0,25 л",
          "price": 42000,
          "oldPrice": 55000,
          "image": ""
        },
        {
          "id": "set-dondoner",
          "name": "DonDoner сет",
          "desc": "DonDoner, айран, симит",
          "price": 46000,
          "oldPrice": 56000,
          "image": ""
        },
        {
          "id": "set-lavash",
          "name": "Лаваш сет",
          "desc": "Лаваш, картофель фри, кола 0,25 л",
          "oldPrice": 57000,
          "image": "",
          "price": 48000
        },
        {
          "id": "set-durum",
          "name": "Дюрюм сет",
          "desc": "Дюрюм, картофель фри, айран",
          "price": 55000,
          "oldPrice": 68000,
          "image": ""
        },
        {
          "id": "set-arkadash",
          "name": "Аркадаш сет",
          "desc": "DonBurger, дюрюм, 2 колы 0,25 л, картофель фри",
          "price": 84000,
          "oldPrice": 99000,
          "badge": "Hit",
          "image": ""
        },
        {
          "id": "set-abi",
          "name": "Аби сет",
          "desc": "Донер, дюрюм, 2 колы 0,25 л, симит",
          "price": 82000,
          "oldPrice": 94000,
          "image": ""
        },
        {
          "id": "set-bebek",
          "name": "Бебек сет",
          "desc": "Мини донер, картофель фри, сок",
          "price": 37000,
          "oldPrice": 50000,
          "image": ""
        }
      ]
    },
    {
      "id": "main",
      "name": "Основные блюда",
      "icon": "🍽",
      "items": [
        {
          "id": "doner-plate",
          "name": "Донер",
          "desc": "В составе сета: пастуший салат, соленья, острый соус, айран или кола 0,25 л",
          "variants": [
            {
              "label": "Обычный",
              "price": 60000
            },
            {
              "label": "Сет",
              "price": 75000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/82cb46badc4c.jpg"
        },
        {
          "id": "kofte",
          "name": "Кёфте",
          "desc": "В составе сета: пастуший салат, соленья, острый соус, айран или кола 0,25 л",
          "variants": [
            {
              "label": "Обычный",
              "price": 60000
            },
            {
              "label": "Сет",
              "price": 75000
            }
          ],
          "badge": "Hit",
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/fdae1dccc5f1.jpg"
        },
        {
          "id": "iskender",
          "name": "Искендер кебаб",
          "desc": "В составе сета: пастуший салат, соленья, острый соус, айран или кола 0,25 л",
          "variants": [
            {
              "label": "Обычный",
              "price": 60000
            },
            {
              "label": "Сет",
              "price": 75000
            }
          ],
          "badge": "Yangi",
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/2fe0c2d0d514.jpg"
        }
      ]
    },
    {
      "id": "doner",
      "name": "Донеры",
      "icon": "🥙",
      "items": [
        {
          "id": "dondoner-mini",
          "name": "DonDoner мини",
          "price": 27000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/56cd197b8182.jpg"
        },
        {
          "id": "dondoner",
          "name": "DonDoner",
          "price": 38000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/56cd197b8182.jpg"
        },
        {
          "id": "doner-cheese",
          "name": "Донер чиз",
          "price": 42000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/56cd197b8182.jpg"
        },
        {
          "id": "doner-burger",
          "name": "Донер бургер",
          "price": 35000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/56cd197b8182.jpg"
        }
      ]
    },
    {
      "id": "pizza",
      "name": "Пиццы",
      "icon": "🍕",
      "items": [
        {
          "id": "pizza-pepperoni",
          "name": "Пепперони",
          "variants": [
            {
              "label": "Маленькая",
              "price": 60000
            },
            {
              "label": "Средняя",
              "price": 70000
            },
            {
              "label": "Большая",
              "price": 80000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/4e23d596500d.jpg"
        },
        {
          "id": "pizza-qazili",
          "name": "С казы",
          "variants": [
            {
              "label": "Маленькая",
              "price": 85000
            },
            {
              "label": "Средняя",
              "price": 105000
            },
            {
              "label": "Большая",
              "price": 120000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/8569e5d399c6.jpg"
        },
        {
          "id": "pizza-barbeque",
          "name": "Барбекю",
          "variants": [
            {
              "label": "Маленькая",
              "price": 60000
            },
            {
              "label": "Средняя",
              "price": 80000
            },
            {
              "label": "Большая",
              "price": 100000
            }
          ],
          "badge": "Hit",
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/74463c8d401d.jpg"
        },
        {
          "id": "pizza-4sezon",
          "name": "4 сезона",
          "variants": [
            {
              "label": "Большая",
              "price": 120000
            }
          ],
          "badge": "Hit",
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/abb3f1e0c937.jpg"
        },
        {
          "id": "pizza-cheese",
          "name": "Чиз",
          "variants": [
            {
              "label": "Маленькая",
              "price": 55000
            },
            {
              "label": "Средняя",
              "price": 65000
            },
            {
              "label": "Большая",
              "price": 75000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/4ca27f37bf43.jpg"
        },
        {
          "id": "pizza-doner",
          "name": "Донер пицца",
          "variants": [
            {
              "label": "Маленькая",
              "price": 65000
            },
            {
              "label": "Средняя",
              "price": 80000
            },
            {
              "label": "Большая",
              "price": 100000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/1a62e1f71b86.jpg"
        },
        {
          "id": "pizza-assorti",
          "name": "Ассорти",
          "variants": [
            {
              "label": "Маленькая",
              "price": 65000
            },
            {
              "label": "Средняя",
              "price": 85000
            },
            {
              "label": "Большая",
              "price": 100000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/bcda7b24def5.jpg"
        },
        {
          "id": "pizza-tovuqli",
          "name": "С курицей",
          "variants": [
            {
              "label": "Маленькая",
              "price": 50000
            },
            {
              "label": "Средняя",
              "price": 60000
            },
            {
              "label": "Большая",
              "price": 70000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/0671b505bb66.jpg"
        },
        {
          "id": "pizza-indeyka",
          "name": "Индейка",
          "variants": [
            {
              "label": "Маленькая",
              "price": 65000
            },
            {
              "label": "Средняя",
              "price": 75000
            },
            {
              "label": "Большая",
              "price": 95000
            }
          ],
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/dca52ccabed2.jpg"
        }
      ]
    },
    {
      "id": "burger",
      "name": "Бургеры",
      "icon": "🍔",
      "items": [
        {
          "id": "gamburger",
          "name": "Гамбургер",
          "price": 33000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/101d41b66487.jpg"
        },
        {
          "id": "cheese-burger",
          "name": "Чизбургер",
          "price": 35000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/f850b80964a7.jpg"
        },
        {
          "id": "donburger",
          "name": "DonBurger",
          "price": 38000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/fd60de7cdec8.jpg"
        },
        {
          "id": "double-burger",
          "name": "Двойной бургер",
          "price": 40000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/da6eb8acf6b1.jpg"
        },
        {
          "id": "muhtasham-burger",
          "name": "Мухташам бургер",
          "desc": "Бургер из мяса донера, сыр моцарелла, сливки и молочный соус",
          "price": 50000,
          "badge": "Hit",
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/c8286d5e2b51.jpg"
        }
      ]
    },
    {
      "id": "lavash",
      "name": "Лаваши",
      "icon": "🌯",
      "items": [
        {
          "id": "lavash",
          "name": "Лаваш",
          "price": 35000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/272447e14cba.jpg"
        },
        {
          "id": "lavash-extra",
          "name": "Экстра лаваш",
          "price": 38000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/272447e14cba.jpg"
        },
        {
          "id": "lavash-cheese",
          "name": "Лаваш чиз",
          "price": 38000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/272447e14cba.jpg"
        },
        {
          "id": "lavash-mini",
          "name": "Лаваш мини",
          "price": 32000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/272447e14cba.jpg"
        }
      ]
    },
    {
      "id": "durum",
      "name": "Дюрюм",
      "icon": "🌮",
      "items": [
        {
          "id": "durum-adana",
          "name": "Адана дюрюм",
          "price": 40000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/4564df71d7b4.jpg"
        },
        {
          "id": "durum-cheese",
          "name": "Чиз дюрюм",
          "price": 45000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/4564df71d7b4.jpg"
        }
      ]
    },
    {
      "id": "hotdog",
      "name": "Хот-доги",
      "icon": "🌭",
      "items": [
        {
          "id": "hotdog-kanada",
          "name": "Хот-дог Канада",
          "price": 13000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/8fb349f94867.jpg"
        },
        {
          "id": "hotdog-qovurilgan",
          "name": "Хот-дог жареный",
          "price": 15000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/b273560d8e21.jpg"
        },
        {
          "id": "hotdog-barbeque",
          "name": "Хот-дог барбекю",
          "price": 24000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/948ae281e8d6.jpg"
        }
      ]
    },
    {
      "id": "chicken",
      "name": "Куриный фастфуд",
      "icon": "🍗",
      "items": [
        {
          "id": "kfc-1",
          "name": "KFC 1 порция",
          "price": 28000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/430607da2aa4.jpg"
        },
        {
          "id": "kfc-1kg",
          "name": "KFC 1 кг",
          "price": 100000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/430607da2aa4.jpg"
        },
        {
          "id": "longer",
          "name": "Лонгер",
          "price": 28000,
          "image": ""
        },
        {
          "id": "kfc-burger",
          "name": "KFC бургер",
          "price": 28000,
          "image": ""
        }
      ]
    },
    {
      "id": "salad",
      "name": "Салаты",
      "icon": "🥗",
      "items": [
        {
          "id": "sezar",
          "name": "Цезарь",
          "price": 27000,
          "image": ""
        },
        {
          "id": "baqlajon",
          "name": "Хрустящие баклажаны",
          "price": 27000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/16629b373608.jpg"
        }
      ]
    },
    {
      "id": "snacks",
      "name": "Снеки",
      "icon": "🍟",
      "items": [
        {
          "id": "fri-standart",
          "name": "Картофель фри стандарт",
          "price": 18000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/9bb101888e50.jpg"
        },
        {
          "id": "derevenskiy",
          "name": "Деревенский",
          "price": 18000,
          "image": ""
        },
        {
          "id": "simit",
          "name": "Симит",
          "price": 8000,
          "image": "https://hwxrbgo5myy6nllr.public.blob.vercel-storage.com/images/uploads/90550afe4926.jpg"
        },
        {
          "id": "simit-nutella",
          "name": "Симит + Nutella",
          "price": 18000,
          "image": ""
        }
      ]
    },
    {
      "id": "soups",
      "name": "Супы",
      "icon": "🍲",
      "items": [
        {
          "id": "corba-mercimek",
          "name": "Мерджимек чорба",
          "price": 25000,
          "desc": "Турецкий суп из красной чечевицы. Любой суп — 1 порция, добавка без ограничений",
          "image": ""
        },
        {
          "id": "corba-ezogelin",
          "name": "Эзогелин чорба",
          "price": 25000,
          "desc": "Чечевица с булгуром и мятой. Любой суп — 1 порция, добавка без ограничений",
          "image": ""
        },
        {
          "id": "corba-et",
          "name": "Эт чорба",
          "price": 25000,
          "desc": "Наваристый мясной суп. Любой суп — 1 порция, добавка без ограничений",
          "image": ""
        }
      ]
    },
    {
      "id": "desserts",
      "name": "Десерты",
      "icon": "🍰",
      "items": [
        {
          "id": "sansebastian-classic",
          "name": "Сан Себастьян классический",
          "price": 35000,
          "desc": "Баскский чизкейк",
          "image": ""
        },
        {
          "id": "sansebastian-pistali",
          "name": "Сан Себастьян фисташковый",
          "price": 35000,
          "desc": "Баскский чизкейк с фисташкой",
          "image": ""
        },
        {
          "id": "sansebastian-ananasli",
          "name": "Сан Себастьян ананасовый",
          "price": 35000,
          "desc": "Баскский чизкейк с ананасом",
          "image": ""
        },
        {
          "id": "sansebastian-qulupnayli",
          "name": "Сан Себастьян клубничный",
          "price": 45000,
          "desc": "Баскский чизкейк с клубникой",
          "badge": "Hit",
          "image": ""
        },
        {
          "id": "sutlac",
          "name": "Сютлач",
          "price": 25000,
          "desc": "Турецкий молочный рисовый пудинг",
          "image": ""
        }
      ]
    },
    {
      "id": "drinks",
      "name": "Напитки",
      "icon": "🥤",
      "items": [
        {
          "id": "drink-cola-05",
          "name": "Coca-Cola 0,5 л",
          "price": 8000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-cola-1",
          "name": "Coca-Cola 1 л",
          "price": 14000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-fanta-05",
          "name": "Fanta 0,5 л",
          "price": 8000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-sprite-05",
          "name": "Sprite 0,5 л",
          "price": 8000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-ayran",
          "name": "Айран",
          "price": 8000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-water",
          "name": "Вода 0,5 л",
          "price": 5000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-tea",
          "name": "Чай",
          "price": 5000,
          "desc": "",
          "image": ""
        },
        {
          "id": "drink-juice",
          "name": "Сок",
          "price": 10000,
          "desc": "",
          "image": ""
        }
      ]
    },
    {
      "id": "sauces",
      "name": "Соусы",
      "icon": "🥫",
      "items": [
        {
          "id": "sauce-ketchup",
          "name": "Кетчуп",
          "price": 3000,
          "image": ""
        },
        {
          "id": "sauce-mayo",
          "name": "Майонез",
          "price": 3000,
          "image": ""
        },
        {
          "id": "sauce-garlic",
          "name": "Чесночный соус",
          "price": 4000,
          "image": ""
        },
        {
          "id": "sauce-chili",
          "name": "Соус чили",
          "price": 4000,
          "image": ""
        },
        {
          "id": "sauce-bbq",
          "name": "Соус барбекю",
          "price": 4000,
          "image": ""
        },
        {
          "id": "sauce-cheese",
          "name": "Сырный соус",
          "price": 5000,
          "image": ""
        }
      ]
    }
  ]
};

window.MENU = MENU;
