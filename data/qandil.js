/*
 * Qandil restaurant — elektron menyu ma'lumotlari
 * ------------------------------------------------------------
 * Bu menyu sahifama-sahifa suratlardan iborat: har bo'lim bitta
 * plakat, taom nomi va narxi suratning o'zida yozilgan.
 *
 * Yangi bo'lim qo'shish: rasmni images/qandil/ ichiga soling va
 * quyidagi ro'yxatga bir qator qo'shing.
 *
 * Manba: restoranning Instagram'dagi «Меню» hikoyalari.
 */

const QANDIL = {
  restaurant: {
    name: "Qandil",
    tagline: "Блюда Востока и Европы",
    instagram: "qandil.restaurant",
  },

  pages: [
    { id: "salads-1", title: "Закуски и салаты", image: "images/qandil/page-1.jpg" },
    { id: "salads-2", title: "Салаты", image: "images/qandil/page-2.jpg" },
    { id: "salads-3", title: "Салаты", image: "images/qandil/page-3.jpg" },
    { id: "soups", title: "Супы", image: "images/qandil/page-4.jpg" },
  ],
};

window.QANDIL = QANDIL;
