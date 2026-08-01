/*
 * Qandil restaurant — elektron menyu ma'lumotlari
 * ------------------------------------------------------------
 * Bu menyu admin panelga ulanmagan: hammasi shu faylda turadi.
 * O'zgartirish uchun shu yerdagi narx yoki nomni tahrirlang.
 *
 * price   — so'mda (butun son)
 * variants— bir taomning turlari: [{ label, price }, ...]
 *           variants bo'lsa, price o'rniga shular ko'rsatiladi
 * image   — images/qandil/... ichidagi surat. Bo'sh bo'lsa
 *           kartochka faqat nom va narx bilan chiqadi.
 *
 * Manba: restoranning Instagram'dagi «Меню» hikoyalari.
 */

const QANDIL = {
  restaurant: {
    name: "Qandil",
    kind: "restaurant",
    // Asosiy qiymat — ruscha, «...Uz» qo'shimchali — o'zbekcha
    tagline: "Блюда Востока и Европы",
    taglineUz: "Sharq va Yevropa taomlari",
    currency: "сум",
    currencyUz: "so'm",
    instagram: "qandil.restaurant",
  },

  categories: [
    {
      id: "salads",
      name: "Салаты и закуски",
      nameUz: "Salatlar va gazaklar",
      items: [
        {
          id: "suzma",
          name: "Сузма",
          nameUz: "Suzma",
          price: 18000,
          image: "images/qandil/suzma.jpg",
        },
        {
          id: "achichuk",
          name: "Айчучук",
          nameUz: "Achichuk",
          price: 25000,
          image: "images/qandil/achichuk.jpg",
        },
        {
          id: "veg-assorti",
          name: "Овощное ассорти",
          nameUz: "Sabzavot assorti",
          price: 41000,
          image: "images/qandil/veg-assorti.jpg",
        },
        {
          id: "greek",
          name: "Греческий",
          nameUz: "Grek salati",
          price: 47000,
          image: "images/qandil/greek.jpg",
        },
        {
          id: "crispy-eggplant",
          name: "Хрустящий баклажан",
          nameUz: "Qarsildoq baqlajon",
          price: 47000,
          image: "images/qandil/crispy-eggplant.jpg",
        },
        {
          id: "hearty-chicken",
          name: "Сытный с курицей и грибами",
          nameUz: "To'yimli — tovuq va qo'ziqorin bilan",
          price: 47000,
          image: "images/qandil/hearty-chicken.jpg",
        },
        {
          id: "caesar",
          name: "Цезарь",
          nameUz: "Sezar",
          image: "images/qandil/caesar.jpg",
          variants: [
            { label: "с курицей", labelUz: "tovuq bilan", price: 47000 },
            { label: "с креветкой", labelUz: "krevetka bilan", price: 75000 },
          ],
        },
        {
          id: "japanese",
          name: "Японский",
          nameUz: "Yaponcha",
          price: 55000,
          image: "images/qandil/japanese.jpg",
        },
        {
          id: "tuna-avocado",
          name: "Салат с тунцом и авокадо",
          nameUz: "Tunes va avokado salati",
          price: 75000,
          image: "images/qandil/tuna-avocado.jpg",
        },
        {
          id: "shrimp-mango",
          name: "Салат с креветками и манго",
          nameUz: "Krevetka va mango salati",
          price: 75000,
          image: "images/qandil/shrimp-mango.jpg",
        },
        {
          id: "buratta",
          name: "Салат Бурратто",
          nameUz: "Burratta salati",
          price: 85000,
          image: "images/qandil/buratta.jpg",
        },
      ],
    },

    {
      id: "soups",
      name: "Супы",
      nameUz: "Sho'rvalar",
      items: [
        {
          id: "moshxurda",
          name: "Мошхурда",
          nameUz: "Moshxo'rda",
          price: 41000,
          image: "images/qandil/moshxurda.jpg",
        },
        {
          id: "mastava",
          name: "Мастава",
          nameUz: "Mastava",
          price: 41000,
          image: "",
        },
        {
          id: "shurva",
          name: "Шурва",
          nameUz: "Sho'rva",
          image: "images/qandil/shurva.jpg",
          variants: [
            { label: "куй гушти", labelUz: "qo'y go'shti", price: 45000 },
            { label: "мол гушти", labelUz: "mol go'shti", price: 45000 },
          ],
        },
        {
          id: "tom-yam",
          name: "Том-Ям с морепродуктами",
          nameUz: "Tom-Yam dengiz mahsulotlari bilan",
          price: 70000,
          image: "images/qandil/tom-yam.jpg",
        },
      ],
    },
  ],
};

window.QANDIL = QANDIL;
