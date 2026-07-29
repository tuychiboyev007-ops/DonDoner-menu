/*
 * DonDöner — tillar
 * ------------------------------------------------------------
 * Yangi matn qo'shish: ikkala tilga ham kalit qo'shing.
 * Tarjima topilmasa, o'zbekchasi ishlatiladi.
 */

const I18N = {
  uz: {
    // Umumiy
    cart: "Savat",
    orders: "Buyurtmalar",
    profile: "Profil",
    home: "Bosh sahifa",
    back: "Orqaga",
    save: "Saqlash",
    cancel: "Bekor qilish",

    // Bosh sahifa
    address: "Manzil",
    chooseAddress: "Manzilni tanlang…",
    delivery: "Yetkazish",
    pickup: "Olib ketish",
    searchFood: "Taom qidirish…",
    nothingFound: "Hech narsa topilmadi",

    // Taom
    addToCart: "Savatga qo'shish",
    addedToCart: "savatga qo'shildi",

    // Savat
    cartEmpty: "Savat bo'sh.<br>Menyudan taom tanlang.",
    products: "Mahsulotlar",
    total: "Jami",
    whereTo: "Qayerga",
    deliveryAddress: "Yetkazish manzili",
    chooseFromMap: "Xaritadan tanlang",
    house: "Uy",
    flat: "Xonadon",
    floor: "Qavat",
    entrance: "Podyezd",
    courierNote: "Kuryerga izoh",
    branch: "Filial",
    customer: "Mijoz",
    yourName: "Ismingiz",
    name: "Ism",
    phone: "Telefon raqam",
    orderNote: "Buyurtmaga izoh",
    extraNote: "Qo'shimcha izoh",
    placeOrder: "Buyurtma berish",

    // Tekshiruvlar
    enterName: "Ismingizni kiriting",
    enterPhone: "Telefon raqamni to'liq kiriting",
    chooseAddressFirst: "Yetkazish manzilini xaritadan tanlang",
    orderAccepted: "Buyurtma qabul qilindi ✅",

    // Manzil tanlash
    newAddress: "Yangi manzil",
    enterAddress: "Manzilni kiriting",
    detecting: "Manzil aniqlanmoqda…",
    notDetected: "Manzil aniqlanmadi — nuqtani surib ko'ring",
    continue: "Davom etish",
    noGeoSupport: "Qurilma joylashuvni qo'llamaydi",
    geoDenied: "Joylashuvga ruxsat berilmadi",
    geoFailed: "Joylashuv aniqlanmadi",

    // Buyurtmalar
    noOrders: "Hozircha buyurtma yo'q.",
    orderNo: "Buyurtma",
    statusNew: "Yangi",

    // Profil
    guest: "Mehmon",
    myOrders: "Buyurtmalarim",
    branches: "Filiallar",
    about: "Biz haqimizda",
    contacts: "Kontaktlar",
    language: "Til",
    editProfile: "Ma'lumotlarni tahrirlash",
    phoneNotSet: "Telefon kiritilmagan",
    freeDelivery: "Yetkazib berish — BEPUL",
    workHours: "Ish vaqti",
    ordersCount: "ta buyurtma",
    saved: "Saqlandi ✅",
  },

  ru: {
    cart: "Корзина",
    orders: "Заказы",
    profile: "Профиль",
    home: "Главная",
    back: "Назад",
    save: "Сохранить",
    cancel: "Отмена",

    address: "Адрес",
    chooseAddress: "Выберите адрес…",
    delivery: "Доставка",
    pickup: "Самовывоз",
    searchFood: "Поиск блюда…",
    nothingFound: "Ничего не найдено",

    addToCart: "Добавить в корзину",
    addedToCart: "добавлено в корзину",

    cartEmpty: "Корзина пуста.<br>Выберите блюдо из меню.",
    products: "Товары",
    total: "Итого",
    whereTo: "Куда",
    deliveryAddress: "Адрес доставки",
    chooseFromMap: "Выбрать на карте",
    house: "Дом",
    flat: "Квартира",
    floor: "Этаж",
    entrance: "Подъезд",
    courierNote: "Комментарий курьеру",
    branch: "Филиал",
    customer: "Клиент",
    yourName: "Ваше имя",
    name: "Имя",
    phone: "Номер телефона",
    orderNote: "Комментарий к заказу",
    extraNote: "Дополнительный комментарий",
    placeOrder: "Оформить заказ",

    enterName: "Введите ваше имя",
    enterPhone: "Введите номер телефона полностью",
    chooseAddressFirst: "Выберите адрес доставки на карте",
    orderAccepted: "Заказ принят ✅",

    newAddress: "Новый адрес",
    enterAddress: "Введите адрес",
    detecting: "Определяем адрес…",
    notDetected: "Адрес не определён — подвиньте карту",
    continue: "Продолжить",
    noGeoSupport: "Устройство не поддерживает геолокацию",
    geoDenied: "Доступ к геолокации запрещён",
    geoFailed: "Не удалось определить местоположение",

    noOrders: "Пока нет заказов.",
    orderNo: "Заказ",
    statusNew: "Новый",

    guest: "Гость",
    myOrders: "Мои заказы",
    branches: "Филиалы",
    about: "О нас",
    contacts: "Контакты",
    language: "Язык",
    editProfile: "Редактировать данные",
    phoneNotSet: "Телефон не указан",
    freeDelivery: "Доставка — БЕСПЛАТНО",
    workHours: "Часы работы",
    ordersCount: "заказов",
    saved: "Сохранено ✅",
  },
};

window.I18N = I18N;
