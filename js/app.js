/*
 * DonDoner — Mini App mantiqi
 * ------------------------------------------------------------
 * - SPA navigatsiya: Bosh sahifa / Savat / Buyurtmalar / Profil
 * - Savat (localStorage'da saqlanadi)
 * - Checkout: forma to'ldirilib, buyurtma /api/order orqali yuboriladi
 * - Buyurtmalar tarixi (localStorage)
 * - Telegram Web App integratsiyasi (tema, expand, haptic, user)
 */

(function () {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp;
  const CURRENCY = (window.MENU && window.MENU.restaurant.currency) || "so'm";
  const LS_CART = "dondoner_cart";
  const LS_ORDERS = "dondoner_orders";
  const LS_ADDR = "dondoner_addr";
  const LS_GEO = "dondoner_geo";
  const LS_LANG = "dondoner_lang";
  const LS_PROFILE = "dondoner_profile";

  /* ============ Holat ============ */
  let cart = load(LS_CART, {}); // { itemId: qty }
  let orders = load(LS_ORDERS, []); // [{id, date, items, total, mode, ...}]
  let mode = "delivery"; // delivery | pickup
  let activeItem = null; // sheet uchun
  let selectedBranch = 0; // tanlangan filial indeksi (birinchisi standart)
  let payment = "cash"; // cash | card
  let geo = null; // tanlangan joylashuv: { lat, lng }
  let geoLabel = ""; // joylashuvning matnli manzili
  let pickerMap = null; // manzil tanlash xaritasi
  let pickerGeo = null; // tanlash jarayonidagi vaqtinchalik nuqta
  let pickerLabel = "";
  let skipNextLookup = false; // qidiruvdan tanlangan nom saqlanib qolsin
  // Tuzilmali manzil maydonlari (saqlanadi)
  let addrParts = load(LS_ADDR, { house: "", flat: "", floor: "", entrance: "", note: "" });
  let lang = localStorage.getItem(LS_LANG) || "uz";
  let profile = load(LS_PROFILE, { name: "", phone: "" });
  const savedGeo = load(LS_GEO, null);
  if (savedGeo && savedGeo.lat) {
    geo = { lat: savedGeo.lat, lng: savedGeo.lng };
    geoLabel = savedGeo.label || "";
  }

  /* ============ Yordamchilar ============ */
  function load(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  // Tarjima: kalit topilmasa o'zbekchasi, u ham bo'lmasa kalitning o'zi
  function t(key) {
    const dict = (window.I18N && window.I18N[lang]) || {};
    const fallback = (window.I18N && window.I18N.uz) || {};
    return dict[key] || fallback[key] || key;
  }

  function setLang(next) {
    lang = next;
    try {
      localStorage.setItem(LS_LANG, next);
    } catch (e) {}
    document.documentElement.lang = next;
    renderAll();
  }

  function formatPrice(v) {
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + CURRENCY;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function el(tag, className, html) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function badgeClass(badge) {
    const map = { Hit: "badge--hit", Yangi: "badge--yangi", Achchiq: "badge--achchiq" };
    return "badge " + (map[badge] || "");
  }

  function mediaContent(item, fallbackEmoji) {
    if (item.image) {
      return `<img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
    }
    return fallbackEmoji || "🍽️";
  }

  // ID bo'yicha taomni topish (+ kategoriya emojisi)
  const itemIndex = {};
  function buildIndex() {
    window.MENU.categories.forEach(function (cat) {
      cat.items.forEach(function (it) {
        itemIndex[it.id] = { item: it, icon: cat.icon };
      });
    });
  }
  function findItem(id) {
    return itemIndex[id] ? itemIndex[id].item : null;
  }
  function findIcon(id) {
    return itemIndex[id] ? itemIndex[id].icon : "🍽️";
  }

  function haptic(type) {
    try {
      tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred(type || "light");
    } catch (e) {}
  }

  /* ---- Telefon: +998 XX XXX XX XX ko'rinishida formatlash ---- */
  const PHONE_PREFIX = "+998 ";

  function formatPhone(raw) {
    // "998" dan keyingi raqamlarni ajratib olamiz (maks 9 ta)
    let digits = raw.replace(/\D/g, "");
    if (digits.indexOf("998") === 0) digits = digits.slice(3);
    digits = digits.slice(0, 9);

    let out = PHONE_PREFIX;
    if (digits.length) out += digits.slice(0, 2);
    if (digits.length > 2) out += " " + digits.slice(2, 5);
    if (digits.length > 5) out += " " + digits.slice(5, 7);
    if (digits.length > 7) out += " " + digits.slice(7, 9);
    return out;
  }

  function phoneDigits(value) {
    let d = value.replace(/\D/g, "");
    if (d.indexOf("998") === 0) d = d.slice(3);
    return d;
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.hidden = true;
    }, 1800);
  }

  /* ============ Ish vaqti ============ */
  // Toshkent vaqti (UTC+5) bo'yicha hozirgi daqiqalar
  function tashkentMinutes() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const tk = new Date(utc + 5 * 3600000);
    return tk.getHours() * 60 + tk.getMinutes();
  }

  function toMinutes(hhmm) {
    const p = String(hhmm || "").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  // Ochiqmi? Yarim tundan oshadigan vaqt ham to'g'ri hisoblanadi (10:00–01:00)
  function isOpen() {
    const h = window.MENU.restaurant.hours;
    if (!h || !h.open || !h.close) return true;
    const now = tashkentMinutes();
    const open = toMinutes(h.open);
    const close = toMinutes(h.close);
    return close > open ? now >= open && now < close : now >= open || now < close;
  }

  function closedText() {
    const h = window.MENU.restaurant.hours || {};
    const now = tashkentMinutes();
    const prefix = now < toMinutes(h.open) ? t("opensToday") : t("opensAt");
    return t("closedNow") + " · " + prefix + " " + h.open + " " + t("willOpen");
  }

  /* ============ Telegram ============ */
  function initTelegram() {
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#000000");
    } catch (e) {}
  }

  function tgUser() {
    try {
      return tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    } catch (e) {
      return null;
    }
  }

  /* ============ Savat mantiqi ============ */
  function cartCount() {
    return Object.values(cart).reduce(function (a, b) {
      return a + b;
    }, 0);
  }
  function cartTotal() {
    return Object.keys(cart).reduce(function (sum, id) {
      const it = findItem(id);
      return sum + (it ? it.price * cart[id] : 0);
    }, 0);
  }

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    save(LS_CART, cart);
    refreshCartUI();
    haptic("light");
  }
  function decFromCart(id) {
    if (!cart[id]) return;
    cart[id] -= 1;
    if (cart[id] <= 0) delete cart[id];
    save(LS_CART, cart);
    refreshCartUI();
    haptic("light");
  }

  function refreshCartUI() {
    const count = cartCount();
    const badge = document.getElementById("cartBadge");
    badge.textContent = count;
    badge.hidden = count === 0;
    // Bosh sahifadagi steppers va savat sahifasini yangilash
    renderMenu();
    if (currentPage === "cart") renderCart();
  }

  /* ============ Bosh sahifa ============ */
  const menuRoot = document.getElementById("menu");
  const chipsRoot = document.getElementById("chips");
  let searchQuery = "";

  function renderHeader() {
    const r = window.MENU.restaurant;
    document.title = r.name + " — Menyu";
    let html = (r.branches || [])
      .map(function (b) {
        return (
          `<div>📍 ${escapeHtml(b.address)} — ` +
          `<a href="tel:${b.phone.replace(/\s/g, "")}">${escapeHtml(b.phone)}</a></div>`
        );
      })
      .join("");
    if (r.delivery) html += `<div>${escapeHtml(r.delivery)}</div>`;
    if (r.instagram) {
      html += `<div>📸 <a href="https://instagram.com/${r.instagram}" target="_blank" rel="noopener">@${r.instagram}</a></div>`;
    }
    document.getElementById("footer").innerHTML = html;
  }

  function renderChips() {
    chipsRoot.innerHTML = "";
    window.MENU.categories.forEach(function (cat, i) {
      const chip = el("button", "chip", cat.icon + " " + cat.name);
      if (i === 0) chip.classList.add("is-active");
      chip.dataset.target = cat.id;
      chip.addEventListener("click", function () {
        haptic("light");
        const s = document.getElementById("cat-" + cat.id);
        if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      chipsRoot.appendChild(chip);
    });
  }

  function renderMenu() {
    menuRoot.innerHTML = "";
    const q = searchQuery.trim().toLowerCase();

    window.MENU.categories.forEach(function (cat) {
      const items = cat.items.filter(function (it) {
        if (!q) return true;
        return (
          it.name.toLowerCase().includes(q) ||
          (it.desc || "").toLowerCase().includes(q)
        );
      });
      if (items.length === 0) return;

      const section = el("section", "section");
      section.id = "cat-" + cat.id;
      section.dataset.cat = cat.id;
      section.appendChild(
        el("h2", "section__title", `<span>${cat.icon}</span> ${escapeHtml(cat.name)}`)
      );

      const grid = el("div", "grid");
      items.forEach(function (it) {
        grid.appendChild(buildProduct(it, cat.icon));
      });
      section.appendChild(grid);
      menuRoot.appendChild(section);
    });

    if (!menuRoot.children.length) {
      menuRoot.appendChild(
        el(
          "div",
          "empty",
          '<div class="empty__icon">🔎</div><div class="empty__text">' + t("nothingFound") + '</div>'
        )
      );
    }
  }

  function buildProduct(item, catIcon) {
    const card = el("article", "product");

    const media = el("div", "product__media", mediaContent(item, catIcon));
    if (item.badge) {
      media.appendChild(el("span", badgeClass(item.badge), escapeHtml(item.badge)));
    }
    media.addEventListener("click", function () {
      openSheet(item, catIcon);
    });

    const body = el("div", "product__body");
    body.appendChild(el("div", "product__price", formatPrice(item.price)));
    body.appendChild(el("div", "product__name", escapeHtml(item.name)));
    body.appendChild(el("div", "product__weight", escapeHtml(item.weight || "")));

    const qty = cart[item.id] || 0;
    if (qty > 0) {
      const stepper = el("div", "stepper");
      const minus = el("button", null, "−");
      const plus = el("button", null, "+");
      minus.addEventListener("click", function () {
        decFromCart(item.id);
      });
      plus.addEventListener("click", function () {
        addToCart(item.id);
      });
      stepper.appendChild(minus);
      stepper.appendChild(el("span", null, String(qty)));
      stepper.appendChild(plus);
      body.appendChild(stepper);
    } else {
      const add = el("button", "product__add", "+");
      add.addEventListener("click", function () {
        addToCart(item.id);
        toast(item.name + " savatga qo'shildi");
      });
      body.appendChild(add);
    }

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  /* ============ Tafsilot oynasi ============ */
  const sheet = document.getElementById("sheet");

  function openSheet(item, catIcon) {
    activeItem = item;
    document.getElementById("sheetMedia").innerHTML = mediaContent(item, catIcon);
    document.getElementById("sheetTitle").textContent = item.name;
    document.getElementById("sheetPrice").textContent = formatPrice(item.price);
    document.getElementById("sheetWeight").textContent = item.weight || "";
    document.getElementById("sheetDesc").textContent = item.desc || "";
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = "";
  }
  sheet.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeSheet();
  });
  document.getElementById("sheetAdd").addEventListener("click", function () {
    if (activeItem) {
      addToCart(activeItem.id);
      toast(activeItem.name + " savatga qo'shildi");
      closeSheet();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !sheet.hidden) closeSheet();
  });

  /* ============ Savat sahifasi ============ */
  const cartRoot = document.getElementById("cartBody");

  function renderCart() {
    cartRoot.innerHTML = "";
    const ids = Object.keys(cart);

    if (ids.length === 0) {
      cartRoot.appendChild(
        el(
          "div",
          "empty",
          '<div class="empty__icon">🛒</div><div class="empty__text">Savat bo\'sh.<br>Menyudan taom tanlang.</div>'
        )
      );
      return;
    }

    ids.forEach(function (id) {
      const it = findItem(id);
      if (!it) return;
      const row = el("div", "cart-item");
      row.appendChild(el("div", "cart-item__media", mediaContent(it, findIcon(id))));

      const body = el("div", "cart-item__body");
      body.appendChild(el("div", "cart-item__name", escapeHtml(it.name)));
      body.appendChild(el("div", "cart-item__price", formatPrice(it.price * cart[id])));
      row.appendChild(body);

      const stepper = el("div", "cart-item__stepper");
      const minus = el("button", null, "−");
      const plus = el("button", null, "+");
      minus.addEventListener("click", function () {
        decFromCart(id);
      });
      plus.addEventListener("click", function () {
        addToCart(id);
      });
      stepper.appendChild(minus);
      stepper.appendChild(el("span", null, String(cart[id])));
      stepper.appendChild(plus);
      row.appendChild(stepper);

      cartRoot.appendChild(row);
    });

    // Jami
    const summary = el("div", "cart-summary");
    summary.appendChild(
      el(
        "div",
        "cart-summary__row",
        `<span>${t("products")} (${cartCount()})</span><span>${formatPrice(cartTotal())}</span>`
      )
    );
    if (deliveryFee() > 0) {
      summary.appendChild(
        el(
          "div",
          "cart-summary__row",
          `<span>${t("deliveryFeeText")}</span><span>${formatPrice(deliveryFee())}</span>`
        )
      );
    } else if (mode === "delivery") {
      summary.appendChild(
        el(
          "div",
          "cart-summary__row",
          `<span>${t("deliveryFeeText")}</span><span>${t("free")}</span>`
        )
      );
    }
    summary.appendChild(
      el(
        "div",
        "cart-summary__total",
        `<span>${t("total")}</span><span>${formatPrice(orderTotal())}</span>`
      )
    );
    cartRoot.appendChild(summary);

    // Checkout forma
    cartRoot.appendChild(buildCheckout());

    // Pastda yopishib turadigan panel: jami + buyurtma tugmasi
    const bar = el("div", "checkout-bar");
    bar.innerHTML = `<span class="checkout-bar__total">${formatPrice(orderTotal())}</span>`;
    const goBtn = el("button", "btn btn--primary checkout-bar__btn", t("placeOrder"));

    // Yopiq yoki minimal summa yetmasa — buyurtma berilmaydi
    const r = window.MENU.restaurant;
    const shortfall = minShortfall();
    if (!isOpen()) {
      goBtn.disabled = true;
      goBtn.textContent = t("closedNow");
      cartRoot.appendChild(el("div", "notice notice--warn", escapeHtml(closedText())));
    } else if (shortfall > 0) {
      goBtn.disabled = true;
      goBtn.textContent =
        t("addMore") + " " + formatPrice(shortfall);
      cartRoot.appendChild(
        el(
          "div",
          "notice",
          escapeHtml(
            t("minOrderText") + ": " + formatPrice(r.minOrder) + " — " +
            t("addMore") + " " + formatPrice(shortfall) + " " + t("toMinOrder")
          )
        )
      );
    } else {
      goBtn.addEventListener("click", submitOrder);
    }

    bar.appendChild(goBtn);
    cartRoot.appendChild(bar);
  }

  // Yetkazish narxi (olib ketishda 0)
  function deliveryFee() {
    const r = window.MENU.restaurant;
    return mode === "delivery" ? Number(r.deliveryFee || 0) : 0;
  }

  // Yakuniy summa
  function orderTotal() {
    return cartTotal() + deliveryFee();
  }

  // Minimal summagacha qancha yetmayapti
  function minShortfall() {
    const min = Number(window.MENU.restaurant.minOrder || 0);
    if (mode !== "delivery" || !min) return 0;
    return Math.max(0, min - cartTotal());
  }

  function buildCheckout() {
    const wrap = el("div", "checkout");
    const user = tgUser();
    const defaultName = user
      ? [user.first_name, user.last_name].filter(Boolean).join(" ")
      : "";
    const branches = window.MENU.restaurant.branches || [];

    /* --- Yetkazish turi (kartochkalar) --- */
    const modeHtml =
      '<div class="mode-cards" id="modeCards">' +
      `<button type="button" class="mode-card${mode === "delivery" ? " is-active" : ""}" data-mode="delivery">` +
      '<span class="mode-card__tick"></span>' + escapeHtml(t("delivery")) + '</button>' +
      `<button type="button" class="mode-card${mode === "pickup" ? " is-active" : ""}" data-mode="pickup">` +
      '<span class="mode-card__tick"></span>' + escapeHtml(t("pickup")) + '</button>' +
      "</div>";

    /* --- Qayerga: manzil + tuzilmali maydonlar --- */
    const addrRowHtml =
      '<button type="button" class="addr-row" id="addrRow">' +
      '<span class="addr-row__icon">🏠</span>' +
      '<span class="addr-row__body">' +
      '<span class="addr-row__label">' + escapeHtml(t("deliveryAddress")) + '</span>' +
      `<span class="addr-row__value${geoLabel ? "" : " is-empty"}" id="addrValue">` +
      escapeHtml(geoLabel || t("chooseFromMap")) +
      "</span></span>" +
      '<span class="addr-row__arrow">›</span></button>';

    const gridHtml =
      '<div class="addr-grid">' +
      `<input id="coHouse" type="text" placeholder="${escapeHtml(t('house'))}" value="${escapeHtml(addrParts.house)}" />` +
      `<input id="coFlat" type="text" placeholder="${escapeHtml(t('flat'))}" value="${escapeHtml(addrParts.flat)}" />` +
      `<input id="coFloor" type="text" placeholder="${escapeHtml(t('floor'))}" value="${escapeHtml(addrParts.floor)}" />` +
      `<input id="coEntrance" type="text" placeholder="${escapeHtml(t('entrance'))}" value="${escapeHtml(addrParts.entrance)}" />` +
      "</div>" +
      `<textarea id="coCourier" class="addr-note" placeholder="${escapeHtml(t('courierNote'))}">${escapeHtml(addrParts.note)}</textarea>`;

    /* --- Filial --- */
    const branchHtml = branches
      .map(function (b, i) {
        return (
          `<button type="button" class="branch-opt${i === selectedBranch ? " is-active" : ""}" data-idx="${i}">` +
          `${escapeHtml(b.label)}<small>📍 ${escapeHtml(b.address)}</small></button>`
        );
      })
      .join("");

    wrap.innerHTML =
      '<h3 class="co-title">' + escapeHtml(t("delivery")) + '</h3>' +
      modeHtml +
      '<div id="whereBlock">' +
      '<h3 class="co-title">' + escapeHtml(t("whereTo")) + '</h3>' +
      addrRowHtml +
      gridHtml +
      "</div>" +
      (branches.length
        ? '<h3 class="co-title">' + escapeHtml(t("branch")) + '</h3><div class="branch-select">' + branchHtml + "</div>"
        : "") +
      '<h3 class="co-title">' + escapeHtml(t("payment")) + '</h3>' +
      '<div class="mode-cards" id="payCards">' +
      `<button type="button" class="mode-card${payment === "cash" ? " is-active" : ""}" data-pay="cash">` +
      '<span class="mode-card__tick"></span>💵 ' + escapeHtml(t("cash")) + '</button>' +
      `<button type="button" class="mode-card${payment === "card" ? " is-active" : ""}" data-pay="card">` +
      '<span class="mode-card__tick"></span>💳 ' + escapeHtml(t("card")) + '</button>' +
      '</div>' +
      '<h3 class="co-title">' + escapeHtml(t("customer")) + '</h3>' +
      '<div class="field"><label>' + escapeHtml(t("yourName")) + '</label>' +
      `<input id="coName" type="text" placeholder="${escapeHtml(t('name'))}" value="${escapeHtml(defaultName)}" /></div>` +
      '<div class="field"><label>' + escapeHtml(t("phone")) + '</label>' +
      '<div class="phone-input"><span class="phone-input__prefix">+998</span>' +
      '<input id="coPhone" type="tel" inputmode="numeric" placeholder="__ ___ __ __" /></div></div>' +
      '<div class="field"><label>' + escapeHtml(t("orderNote")) + '</label>' +
      `<textarea id="coNote" placeholder="${escapeHtml(t("extraNote"))}"></textarea></div>`;

    /* --- Hodisalar --- */
    wrap.querySelector("#modeCards").addEventListener("click", function (e) {
      const b = e.target.closest(".mode-card");
      if (!b) return;
      mode = b.dataset.mode;
      haptic("light");
      renderCart();
    });

    wrap.querySelector("#addrRow").addEventListener("click", openPicker);

    wrap.querySelector("#payCards").addEventListener("click", function (e) {
      const b = e.target.closest(".mode-card");
      if (!b) return;
      payment = b.dataset.pay;
      wrap.querySelectorAll("#payCards .mode-card").forEach(function (x) {
        x.classList.toggle("is-active", x === b);
      });
      haptic("light");
    });

    // Manzil maydonlari saqlanadi
    ["coHouse", "coFlat", "coFloor", "coEntrance", "coCourier"].forEach(function (id) {
      const input = wrap.querySelector("#" + id);
      input.addEventListener("input", function () {
        addrParts = {
          house: wrap.querySelector("#coHouse").value.trim(),
          flat: wrap.querySelector("#coFlat").value.trim(),
          floor: wrap.querySelector("#coFloor").value.trim(),
          entrance: wrap.querySelector("#coEntrance").value.trim(),
          note: wrap.querySelector("#coCourier").value.trim(),
        };
        save(LS_ADDR, addrParts);
      });
    });

    // Telefon — faqat raqamlar, +998 alohida turadi
    const phoneInput = wrap.querySelector("#coPhone");
    phoneInput.addEventListener("input", function () {
      let d = phoneInput.value.replace(/\D/g, "").slice(0, 9);
      let out = d.slice(0, 2);
      if (d.length > 2) out += " " + d.slice(2, 5);
      if (d.length > 5) out += " " + d.slice(5, 7);
      if (d.length > 7) out += " " + d.slice(7, 9);
      phoneInput.value = out;
    });

    wrap.querySelectorAll(".branch-opt").forEach(function (b) {
      b.addEventListener("click", function () {
        selectedBranch = parseInt(b.dataset.idx, 10) || 0;
        wrap.querySelectorAll(".branch-opt").forEach(function (x) {
          x.classList.toggle("is-active", x === b);
        });
        haptic("light");
      });
    });

    // Olib ketishda manzil bloki kerak emas
    if (mode === "pickup") {
      wrap.querySelector("#whereBlock").style.display = "none";
    }
    return wrap;
  }
  /* ============ Manzil tanlash ekrani ============ */
  const TASHKENT = { lat: 41.311081, lng: 69.240562 };

  function mapsLink(g) {
    return "https://maps.google.com/?q=" + g.lat + "," + g.lng;
  }

  // Koordinatadan matnli manzil (server orqali — CORS muammosi yo'q)
  function reverseGeocode(g, done) {
    fetch("/api/geocode?lat=" + g.lat + "&lng=" + g.lng)
      .then(function (r) { return r.json(); })
      .then(function (d) { done((d && d.address) || ""); })
      .catch(function () { done(""); });
  }

  function openPicker() {
    const el = document.getElementById("picker");
    el.hidden = false;
    document.body.style.overflow = "hidden";
    haptic("light");

    const start = geo || TASHKENT;
    pickerGeo = { lat: start.lat, lng: start.lng };
    pickerLabel = geo ? geoLabel : "";

    const mapEl = document.getElementById("pickerMap");
    if (typeof L === "undefined") {
      document.getElementById("pickerAddr").textContent =
        "Xarita yuklanmadi — manzilni qidiruvdan tanlang";
      return;
    }

    if (pickerMap) { pickerMap.remove(); pickerMap = null; }
    pickerMap = L.map(mapEl, {
      attributionControl: false,
      zoomControl: false,
    }).setView([parseFloat(start.lat), parseFloat(start.lng)], 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 })
      .addTo(pickerMap);

    // Xarita surilganda markazdagi nuqta yangi joyni ko'rsatadi
    pickerMap.on("movestart", function () {
      document.getElementById("picker").classList.add("is-moving");
    });
    pickerMap.on("moveend", function () {
      document.getElementById("picker").classList.remove("is-moving");
      const c = pickerMap.getCenter();
      pickerGeo = { lat: c.lat.toFixed(6), lng: c.lng.toFixed(6) };
      if (skipNextLookup) {
        skipNextLookup = false;
        return;
      }
      updatePickerAddr();
    });

    setTimeout(function () {
      if (pickerMap) pickerMap.invalidateSize();
      updatePickerAddr();
    }, 150);
  }

  function closePicker() {
    document.getElementById("picker").hidden = true;
    document.body.style.overflow = "";
    hidePickerResults();
  }

  function updatePickerAddr() {
    const el = document.getElementById("pickerAddr");
    if (!pickerGeo) return;
    el.textContent = t("detecting");
    reverseGeocode(pickerGeo, function (addr) {
      pickerLabel = addr;
      el.textContent = addr || t("notDetected");
    });
  }

  function hidePickerResults() {
    const box = document.getElementById("pickerResults");
    box.hidden = true;
    box.innerHTML = "";
  }

  // Qidiruv (server orqali)
  let searchTimer = null;
  function pickerSearch(query) {
    clearTimeout(searchTimer);
    if (query.trim().length < 3) return hidePickerResults();
    searchTimer = setTimeout(function () {
      fetch("/api/geocode?q=" + encodeURIComponent(query))
        .then(function (r) { return r.json(); })
        .then(function (d) { renderPickerResults((d && d.results) || []); })
        .catch(hidePickerResults);
    }, 400);
  }

  function renderPickerResults(items) {
    const box = document.getElementById("pickerResults");
    if (!items.length) return hidePickerResults();
    box.innerHTML = "";
    items.forEach(function (it) {
      const li = el("li", "picker__result");
      li.innerHTML =
        "<strong>" + escapeHtml(it.title) + "</strong>" +
        "<small>" + escapeHtml(it.full) + "</small>";
      li.addEventListener("click", function () {
        pickerGeo = { lat: parseFloat(it.lat).toFixed(6), lng: parseFloat(it.lng).toFixed(6) };
        pickerLabel = it.title;
        document.getElementById("pickerAddr").textContent = it.title;
        document.getElementById("pickerInput").value = "";
        hidePickerResults();
        if (pickerMap) {
          skipNextLookup = true;
          pickerMap.setView([parseFloat(pickerGeo.lat), parseFloat(pickerGeo.lng)], 17);
        }
        haptic("light");
      });
      box.appendChild(li);
    });
    box.hidden = false;
  }

  // «Meni topish»
  function pickerLocateMe() {
    if (!navigator.geolocation) return toast(t("noGeoSupport"));
    const btn = document.getElementById("pickerLocate");
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        btn.disabled = false;
        const g = {
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        };
        pickerGeo = g;
        if (pickerMap) pickerMap.setView([parseFloat(g.lat), parseFloat(g.lng)], 17);
        else updatePickerAddr();
        haptic("medium");
      },
      function (err) {
        btn.disabled = false;
        toast(err && err.code === 1 ? t("geoDenied") : t("geoFailed"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function confirmPicker() {
    if (!pickerGeo) return toast("Xaritadan joyni tanlang");
    geo = pickerGeo;
    geoLabel = pickerLabel;
    save(LS_GEO, { lat: geo.lat, lng: geo.lng, label: geoLabel });
    closePicker();
    haptic("medium");
    if (currentPage === "cart") renderCart();
  }

  // Til o'zgarganda hamma narsani qayta chizamiz
  function renderAll() {
    applyStaticLabels();
    renderChips();
    renderMenu();
    renderHeader();
    if (currentPage === "cart") renderCart();
    else if (currentPage === "orders") renderOrders();
    else if (currentPage === "profile") renderProfile();
  }

  // HTML'dagi qo'zg'almas yozuvlar
  function applyStaticLabels() {
    const map = {
      "page-cart": "cart",
      "page-orders": "orders",
      "page-profile": "profile",
    };
    Object.keys(map).forEach(function (id) {
      const h = document.querySelector("#" + id + " .pagehead h2");
      if (h) h.textContent = t(map[id]);
    });
    const tabs = { home: "home", cart: "cart", orders: "orders", profile: "profile" };
    document.querySelectorAll(".tabbar__btn").forEach(function (b) {
      const label = b.querySelector(".tabbar__label");
      if (label) label.textContent = t(tabs[b.dataset.page]);
    });
    document.querySelector("#searchInput").placeholder = t("searchFood");
    document.querySelector(".delivery__label").textContent = t("address");
    document.querySelectorAll(".segmented__btn").forEach(function (b) {
      b.textContent = b.dataset.mode === "pickup" ? t("pickup") : t("delivery");
    });
    document.querySelector(".picker__title").textContent = t("newAddress");
    document.querySelector("#pickerInput").placeholder = t("enterAddress");
    document.querySelector("#pickerDone").textContent = t("continue");
    document.querySelector("#sheetAdd").textContent = t("addToCart");
    const dv = document.getElementById("deliveryAddr");
    if (dv && !geoLabel) dv.textContent = t("chooseAddress");
  }

  function setupPicker() {
    document.getElementById("subBack").addEventListener("click", closeSub);
    document.getElementById("pickerBack").addEventListener("click", closePicker);
    document.getElementById("pickerDone").addEventListener("click", confirmPicker);
    document.getElementById("pickerLocate").addEventListener("click", pickerLocateMe);
    document.getElementById("pickerInput").addEventListener("input", function (e) {
      pickerSearch(e.target.value);
    });
  }

  /* ============ Buyurtma yuborish ============ */
  // Buyurtmani chatga tayyor xabar (draft) sifatida qo'yamiz —
  // mijoz faqat "yuborish"ni bosadi, bot esa buyurtmani adminga uzatadi.
  // Bu usul serversiz ishlaydi va inline «Ochish» tugmasi bilan mos.
  function buildOrderText(order) {
    const L = [];
    // 1-qator — bot shu yerdan buyurtma raqamini oladi (o'zgartirmang)
    L.push("🧾 Buyurtma " + order.id);
    L.push("");
    order.items.forEach(function (i) {
      L.push("▪️ " + i.name);
      L.push(
        "    " + i.qty + " × " + formatPrice(i.price) + " = " + formatPrice(i.price * i.qty)
      );
    });
    L.push("");
    L.push("💰 Jami: " + formatPrice(order.total));
    L.push("");
    if (order.branch) {
      L.push("🏬 " + order.branch.label + " — " + order.branch.address);
    }
    L.push("🚚 " + (order.mode === "pickup" ? "Olib ketish" : "Yetkazish"));
    if (order.geoLabel) L.push("📍 " + order.geoLabel);
    const a = order.addrParts;
    if (a) {
      const bits = [];
      if (a.house) bits.push(a.house + "-uy");
      if (a.entrance) bits.push(a.entrance + "-podyezd");
      if (a.floor) bits.push(a.floor + "-qavat");
      if (a.flat) bits.push(a.flat + "-xonadon");
      if (bits.length) L.push("🏠 " + bits.join(", "));
      if (a.note) L.push("🛵 Kuryerga: " + a.note);
    }
    if (order.geo) L.push("🗺 " + mapsLink(order.geo));
    L.push("");
    L.push("👤 " + order.name);
    L.push("📞 " + order.phone);
    if (order.note) L.push("📝 " + order.note);
    return L.join("\n");
  }

  function submitOrder() {
    const name = (document.getElementById("coName").value || "").trim();
    const phoneRaw = (document.getElementById("coPhone").value || "").trim();
    const note = (document.getElementById("coNote") || {}).value || "";

    if (!name) return toast(t("enterName"));
    const digits = phoneRaw.replace(/\D/g, "").slice(0, 9);
    if (digits.length !== 9) return toast(t("enterPhone"));
    const phone = formatPhone(digits);

    if (mode === "delivery" && !geo) {
      return toast(t("chooseAddressFirst"));
    }
    if (!isOpen()) return toast(closedText());
    if (minShortfall() > 0) {
      return toast(t("addMore") + " " + formatPrice(minShortfall()));
    }

    const items = Object.keys(cart).map(function (id) {
      const it = findItem(id);
      return { id: id, name: it.name, price: it.price, qty: cart[id] };
    });

    const branches = window.MENU.restaurant.branches || [];
    const branch = branches[selectedBranch] || null;

    const order = {
      id: "#" + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      mode: mode,
      payment: payment,
      branch: branch
        ? { label: branch.label, address: branch.address, phone: branch.phone }
        : null,
      name: name,
      phone: phone,
      addrParts: mode === "delivery" ? addrParts : null,
      geo: mode === "delivery" ? geo : null,
      geoLabel: mode === "delivery" ? geoLabel : "",
      note: note.trim(),
      items: items,
      total: orderTotal(),
      deliveryFee: deliveryFee(),
      status: "Yangi",
    };

    // Buyurtmani lokal tarixga saqlash va savatni tozalash
    orders.unshift(order);
    save(LS_ORDERS, orders);
    cart = {};
    save(LS_CART, cart);
    refreshCartUI();
    haptic("medium");

    sendOrderToServer(order);
  }

  // Buyurtmani serverga yuboramiz — mijoz hech narsa yubormaydi
  function sendOrderToServer(order) {
    const text = buildOrderText(order);
    let initData = "";
    try {
      initData = (tg && tg.initData) || "";
    } catch (e) {}

    // Telegramdan tashqarida (oddiy brauzer) — faqat lokal tasdiq
    if (!initData) {
      toast(t("orderAccepted"));
      renderOrders();
      switchPage("orders");
      return;
    }

    toast(lang === "ru" ? "Отправляем…" : "Yuborilmoqda…");

    fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initData, text: text, order: order }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok && d.ok, data: d };
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error((res.data && res.data.error) || "xato");
        toast(t("orderAccepted"));
        haptic("medium");
        renderOrders();
        switchPage("orders");
        // Telegram ilovasi buyurtma tasdig'ini chatda ko'rsatsin
        setTimeout(function () {
          try {
            if (tg && typeof tg.close === "function") tg.close();
          } catch (e) {}
        }, 1200);
      })
      .catch(function () {
        // Server javob bermasa — buyurtma yo'qolmasin, chatga havola beramiz
        orderFallback(text);
      });
  }

  // Zaxira yo'l: chatni ochib, matnni nusxalash imkonini beramiz
  function orderFallback(text) {
    const botUsername = window.MENU.restaurant.botUsername;
    toast(
      lang === "ru"
        ? "Не удалось отправить — позвоните нам"
        : "Yuborilmadi — bizga qo'ng'iroq qiling"
    );
    try {
      if (tg && typeof tg.openTelegramLink === "function" && botUsername) {
        tg.openTelegramLink(
          "https://t.me/" + botUsername + "?text=" + encodeURIComponent(text)
        );
      }
    } catch (e) {}
    renderOrders();
    switchPage("orders");
  }

  /* ============ Buyurtmalar sahifasi ============ */
  const ordersRoot = document.getElementById("ordersBody");

  function renderOrders() {
    ordersRoot.innerHTML = "";
    if (orders.length === 0) {
      ordersRoot.appendChild(
        el(
          "div",
          "empty",
          '<div class="empty__icon">📋</div><div class="empty__text">Hozircha buyurtma yo\'q.</div>'
        )
      );
      return;
    }
    orders.forEach(function (o) {
      const card = el("div", "order-card");
      card.appendChild(
        el(
          "div",
          "order-card__head",
          `<span class="order-card__id">Buyurtma ${escapeHtml(o.id)}</span>` +
            `<span class="order-card__status">${escapeHtml(o.status)}</span>`
        )
      );
      const d = new Date(o.date);
      const dateStr = d.toLocaleString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      card.appendChild(el("div", "order-card__date", dateStr + " · " + (o.mode === "pickup" ? "Olib ketish" : "Yetkazish")));
      const itemsStr = o.items
        .map(function (i) {
          return escapeHtml(i.name) + " ×" + i.qty;
        })
        .join(", ");
      card.appendChild(el("div", "order-card__items", itemsStr));
      card.appendChild(el("div", "order-card__total", formatPrice(o.total)));
      ordersRoot.appendChild(card);
    });
  }

  /* ============ Profil sahifasi ============ */
  function renderProfile() {
    const root = document.getElementById("profileBody");
    const user = tgUser();
    const tgName = user
      ? [user.first_name, user.last_name].filter(Boolean).join(" ")
      : "";
    const name = profile.name || tgName || t("guest");
    const phone = profile.phone || t("phoneNotSet");
    const initial = (name[0] || "M").toUpperCase();
    const avatar =
      user && user.photo_url ? `<img src="${user.photo_url}" alt="" />` : initial;

    const rows = [
      { icon: "📋", label: t("myOrders"), badge: String(orders.length), screen: "orders" },
      { icon: "🏬", label: t("branches"), screen: "branches" },
      { icon: "ℹ️", label: t("about"), screen: "about" },
      { icon: "📞", label: t("contacts"), screen: "contacts" },
      { icon: "🌐", label: t("language"), badge: lang === "ru" ? "Русский" : "O'zbekcha", screen: "language" },
    ];

    root.innerHTML =
      '<div class="prof-head">' +
      `<div class="prof-head__avatar">${avatar}</div>` +
      '<div class="prof-head__info">' +
      `<h3 class="prof-head__name">${escapeHtml(name)}</h3>` +
      `<p class="prof-head__phone">${escapeHtml(phone)}</p></div>` +
      '<button class="prof-head__edit" id="profEdit" aria-label="' +
      escapeHtml(t("editProfile")) +
      '">✏️</button></div>' +
      '<div class="prof-list">' +
      rows
        .map(function (r) {
          return (
            `<button type="button" class="prof-row" data-screen="${r.screen}">` +
            `<span class="prof-row__icon">${r.icon}</span>` +
            `<span class="prof-row__label">${escapeHtml(r.label)}</span>` +
            (r.badge ? `<span class="prof-row__badge">${escapeHtml(r.badge)}</span>` : "") +
            '<span class="prof-row__arrow">›</span></button>'
          );
        })
        .join("") +
      "</div>" +
      `<p class="prof-foot">${escapeHtml(window.MENU.restaurant.name)} · ${escapeHtml(
        window.MENU.restaurant.tagline
      )}</p>`;

    root.querySelector("#profEdit").addEventListener("click", openProfileEdit);
    root.querySelectorAll(".prof-row").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const screen = btn.dataset.screen;
        if (screen === "orders") return switchPage("orders");
        openSub(screen);
      });
    });
  }

  /* ---- Profil ma'lumotlarini tahrirlash ---- */
  function openProfileEdit() {
    haptic("light");
    openSub("editProfile");
  }

  /* ============ Ichki ekranlar ============ */
  function openSub(screen) {
    const box = document.getElementById("subpage");
    const title = document.getElementById("subTitle");
    const body = document.getElementById("subBody");
    const r = window.MENU.restaurant;
    haptic("light");

    if (screen === "branches") {
      title.textContent = t("branches");
      body.innerHTML = (r.branches || [])
        .map(function (b) {
          return (
            '<div class="info-card">' +
            `<h4>${escapeHtml(b.label)}</h4>` +
            `<p>📍 ${escapeHtml(b.address)}</p>` +
            `<p>📞 <a href="tel:${b.phone.replace(/\s/g, "")}">${escapeHtml(b.phone)}</a></p>` +
            `<a class="info-link" target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(
              b.address + ", Toshkent"
            )}">🗺 ${lang === "ru" ? "Открыть на карте" : "Xaritada ochish"}</a>` +
            "</div>"
          );
        })
        .join("");
    } else if (screen === "about") {
      title.textContent = t("about");
      body.innerHTML =
        '<div class="info-card">' +
        `<h4>${escapeHtml(r.name)}</h4>` +
        `<p>${escapeHtml(r.tagline)}</p>` +
        `<p>🇹🇷 ${lang === "ru" ? "Настоящий донер на дровах" : "O'tinda tayyorlangan asl doner"}</p>` +
        `<p>🚗 ${escapeHtml(t("freeDelivery"))}</p>` +
        "</div>";
    } else if (screen === "contacts") {
      title.textContent = t("contacts");
      let html = (r.branches || [])
        .map(function (b) {
          return (
            '<div class="info-card">' +
            `<h4>${escapeHtml(b.label)}</h4>` +
            `<p>📍 ${escapeHtml(b.address)}</p>` +
            `<p>📞 <a href="tel:${b.phone.replace(/\s/g, "")}">${escapeHtml(b.phone)}</a></p>` +
            "</div>"
          );
        })
        .join("");
      if (r.instagram) {
        html +=
          '<div class="info-card">' +
          `<p>📸 <a href="https://instagram.com/${r.instagram}" target="_blank" rel="noopener">@${escapeHtml(
            r.instagram
          )}</a></p></div>`;
      }
      body.innerHTML = html;
    } else if (screen === "language") {
      title.textContent = t("language");
      body.innerHTML =
        '<div class="lang-list">' +
        `<button type="button" class="lang-opt${lang === "uz" ? " is-active" : ""}" data-lang="uz">🇺🇿 O'zbekcha</button>` +
        `<button type="button" class="lang-opt${lang === "ru" ? " is-active" : ""}" data-lang="ru">🇷🇺 Русский</button>` +
        "</div>";
      body.querySelectorAll(".lang-opt").forEach(function (b) {
        b.addEventListener("click", function () {
          setLang(b.dataset.lang);
          closeSub();
        });
      });
    } else if (screen === "editProfile") {
      title.textContent = t("editProfile");
      const user = tgUser();
      const tgName = user
        ? [user.first_name, user.last_name].filter(Boolean).join(" ")
        : "";
      const digits = (profile.phone || "").replace(/\D/g, "").replace(/^998/, "");
      body.innerHTML =
        '<div class="field"><label>' + escapeHtml(t("yourName")) + "</label>" +
        `<input id="pfName" type="text" value="${escapeHtml(profile.name || tgName)}" /></div>` +
        '<div class="field"><label>' + escapeHtml(t("phone")) + "</label>" +
        '<div class="phone-input"><span class="phone-input__prefix">+998</span>' +
        `<input id="pfPhone" type="tel" inputmode="numeric" placeholder="__ ___ __ __" value="${escapeHtml(
          formatLocalPhone(digits)
        )}" /></div></div>` +
        '<button class="btn btn--primary" id="pfSave">' + escapeHtml(t("save")) + "</button>";

      const pfPhone = body.querySelector("#pfPhone");
      pfPhone.addEventListener("input", function () {
        pfPhone.value = formatLocalPhone(pfPhone.value.replace(/\D/g, ""));
      });
      body.querySelector("#pfSave").addEventListener("click", function () {
        const d = pfPhone.value.replace(/\D/g, "").slice(0, 9);
        profile = {
          name: body.querySelector("#pfName").value.trim(),
          phone: d.length === 9 ? formatPhone(d) : "",
        };
        save(LS_PROFILE, profile);
        toast(t("saved"));
        closeSub();
        renderProfile();
      });
    }

    box.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSub() {
    document.getElementById("subpage").hidden = true;
    document.body.style.overflow = "";
  }

  // "901234567" -> "90 123 45 67"
  function formatLocalPhone(digits) {
    const d = String(digits).replace(/\D/g, "").replace(/^998/, "").slice(0, 9);
    let out = d.slice(0, 2);
    if (d.length > 2) out += " " + d.slice(2, 5);
    if (d.length > 5) out += " " + d.slice(5, 7);
    if (d.length > 7) out += " " + d.slice(7, 9);
    return out;
  }

  /* ============ Navigatsiya ============ */
  let currentPage = "home";
  function switchPage(page) {
    currentPage = page;
    document.querySelectorAll(".page").forEach(function (p) {
      p.classList.toggle("is-active", p.id === "page-" + page);
    });
    document.querySelectorAll(".tabbar__btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.page === page);
    });
    window.scrollTo(0, 0);

    if (page === "cart") renderCart();
    else if (page === "orders") renderOrders();
    else if (page === "profile") renderProfile();

    haptic("light");
  }

  function setupTabbar() {
    document.querySelectorAll(".tabbar__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchPage(btn.dataset.page);
      });
    });
  }

  /* ============ Yetkazish/olib ketish, qidiruv ============ */
  function setupControls() {
    document.getElementById("modeToggle").addEventListener("click", function (e) {
      const b = e.target.closest(".segmented__btn");
      if (!b) return;
      mode = b.dataset.mode;
      document.querySelectorAll(".segmented__btn").forEach(function (x) {
        x.classList.toggle("is-active", x === b);
      });
      const addr = document.getElementById("deliveryAddr");
      addr.textContent = mode === "pickup" ? "Filialdan olib ketish" : "Manzilni tanlang…";
      if (currentPage === "cart") renderCart();
      haptic("light");
    });

    const searchBtn = document.getElementById("searchBtn");
    const searchBar = document.getElementById("searchBar");
    const searchInput = document.getElementById("searchInput");
    searchBtn.addEventListener("click", function () {
      searchBar.hidden = !searchBar.hidden;
      if (!searchBar.hidden) searchInput.focus();
      else {
        searchInput.value = "";
        searchQuery = "";
        renderMenu();
      }
    });
    searchInput.addEventListener("input", function () {
      searchQuery = searchInput.value;
      renderMenu();
    });
  }

  /* ============ Ishga tushirish ============ */
  function init() {
    if (!window.MENU) {
      menuRoot.innerHTML = '<div class="empty">Menyu topilmadi 😕</div>';
      return;
    }
    initTelegram();
    buildIndex();
    renderHeader();
    renderChips();
    renderMenu();
    setupTabbar();
    setupControls();
    setupPicker();
    document.documentElement.lang = lang;
    applyStaticLabels();
    refreshCartUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
