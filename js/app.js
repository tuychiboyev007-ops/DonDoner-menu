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
  const LS_BRANCH = "dondoner_branch";
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
  // Standart til — ruscha. Foydalanuvchi Profil > Til orqali o'zgartirsa,
  // tanlovi localStorage'da saqlanadi va shundan keyin o'sha til ishlatiladi.
  let lang = localStorage.getItem(LS_LANG) || "ru";
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

  // Valyuta tanlangan tilga qarab yoziladi ("so'm" / "сум")
  function formatPrice(v) {
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + t("currency");
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

  // Yorliq bazada doim "Hit"/"Yangi"/"Achchiq" bo'lib turadi (rangi shunga bog'liq),
  // ekranda esa tanlangan tilda ko'rsatiladi
  function badgeText(badge) {
    const map = { Hit: "badgeHit", Yangi: "badgeNew", Achchiq: "badgeSpicy" };
    return map[badge] ? t(map[badge]) : badge;
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
  // Savat kaliti "id" yoki "id::O'lcham" ko'rinishida bo'ladi
  function splitKey(key) {
    const i = String(key).indexOf("::");
    return i === -1
      ? { id: key, variant: "" }
      : { id: key.slice(0, i), variant: key.slice(i + 2) };
  }

  function findItem(key) {
    const { id } = splitKey(key);
    return itemIndex[id] ? itemIndex[id].item : null;
  }
  function findIcon(key) {
    const { id } = splitKey(key);
    return itemIndex[id] ? itemIndex[id].icon : "🍽️";
  }

  // Kalit bo'yicha narx (o'lcham hisobga olinadi)
  function keyPrice(key) {
    const it = findItem(key);
    if (!it) return 0;
    const { variant } = splitKey(key);
    if (it.variants && it.variants.length) {
      const v = it.variants.filter(function (x) {
        return x.label === variant;
      })[0];
      return (v || it.variants[0]).price;
    }
    return it.price || 0;
  }

  // Kalit bo'yicha to'liq nom ("Pepperoni (Katta)")
  function keyName(key) {
    const it = findItem(key);
    if (!it) return "-";
    const { variant } = splitKey(key);
    return variant ? it.name + " (" + variant + ")" : it.name;
  }

  // Eng arzon narx — kartochkada "60 000 so'm dan" uchun
  function minPrice(item) {
    if (item.variants && item.variants.length) {
      return Math.min.apply(
        null,
        item.variants.map(function (v) {
          return v.price;
        })
      );
    }
    return item.price || 0;
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
    return Object.keys(cart).reduce(function (sum, key) {
      return sum + keyPrice(key) * cart[key];
    }, 0);
  }

  function addToCart(id) {
    const it = findItem(id);
    if (isOut(it)) return toast(t("outOfStock"));
    cart[id] = (cart[id] || 0) + 1;
    save(LS_CART, cart);
    refreshCartUI();
    haptic("light");
  }

  // Savatdagi, ammo shu orada tugab qolgan taomlar
  function outItemsInCart() {
    return Object.keys(cart).filter(function (key) {
      return isOut(findItem(key));
    });
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
    document.title = r.name + " — " + t("menuWord");
    const brand = document.getElementById("brandName");
    if (brand && r.name) brand.textContent = r.name;
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

  // Kategoriya nomining bosh harfi — kafel ichida ko'rsatiladi
  function catInitial(name) {
    return (name || "?").trim().charAt(0).toLocaleUpperCase("uz");
  }

  function setActiveChip(catId) {
    let active = null;
    chipsRoot.querySelectorAll(".chip").forEach(function (c) {
      const on = c.dataset.target === catId;
      c.classList.toggle("is-active", on);
      if (on) active = c;
    });
    if (!active) return;

    // Bo'limlar ko'p — faol kafel ekrandan chiqib ketmasligi uchun
    // kategoriya qatorini o'zi surib, uni o'rtaga keltiramiz
    const centered = active.offsetLeft - (chipsRoot.clientWidth - active.offsetWidth) / 2;
    const max = chipsRoot.scrollWidth - chipsRoot.clientWidth;
    const left = Math.max(0, Math.min(max, centered));
    if (Math.abs(chipsRoot.scrollLeft - left) > 4) {
      chipsRoot.scrollTo({ left: left, behavior: "smooth" });
    }
  }

  /* ---- Filial va taom mavjudligi ----
     Tugagan taom `item.outAt = ["b1"]` ko'rinishida saqlanadi.
     Eski `item.out = true` — hamma filialda tugagan degani. */
  function branches() {
    return (window.MENU.restaurant.branches || []);
  }

  function currentBranch() {
    const list = branches();
    return list[selectedBranch] || list[0] || null;
  }

  function currentBranchId() {
    const b = currentBranch();
    return b ? (b.id || "") : "";
  }

  // Taom tanlangan filialda tugaganmi?
  function isOut(item, branchId) {
    if (!item) return false;
    if (item.out === true && !item.outAt) return true; // eski format
    const list = item.outAt || [];
    if (!list.length) return false;
    const bid = branchId === undefined ? currentBranchId() : branchId;
    return list.indexOf(bid) !== -1;
  }

  function setBranch(idx) {
    const list = branches();
    if (!list.length) return;
    selectedBranch = ((idx % list.length) + list.length) % list.length;
    localStorage.setItem(LS_BRANCH, String(selectedBranch));
    paintBranchBar();
    renderMenu();
    if (currentPage === "cart") renderCart();
  }

  function paintBranchBar() {
    const bar = document.getElementById("branchBar");
    if (!bar) return;
    const list = branches();
    if (list.length < 2) { bar.hidden = true; return; }
    bar.hidden = false;
    const b = currentBranch();
    document.getElementById("branchBarName").textContent = b ? b.label : "";
  }

  function setupBranchBar() {
    const saved = parseInt(localStorage.getItem(LS_BRANCH), 10);
    if (!isNaN(saved) && branches()[saved]) selectedBranch = saved;
    paintBranchBar();
    const bar = document.getElementById("branchBar");
    if (bar) {
      bar.addEventListener("click", function () {
        haptic("light");
        setBranch(selectedBranch + 1);
      });
    }
  }

  /* Narxi kiritilmagan mahsulot mijozga ko'rsatilmaydi.
     Admin panelda yangi mahsulot narxsiz yaratiladi — narx qo'yilgunicha
     u menyuda chiqmaydi, ya'ni yarim tayyor taom mijozga ko'rinmaydi. */
  function isReady(item) {
    if (item.variants && item.variants.length) {
      return item.variants.some(function (v) { return Number(v.price) > 0; });
    }
    return Number(item.price) > 0;
  }

  function readyItems(cat) {
    return (cat.items || []).filter(isReady);
  }

  function renderChips() {
    chipsRoot.innerHTML = "";
    // Faqat kamida bitta tayyor taomi bor bo'limlar ko'rsatiladi
    window.MENU.categories.filter(function (c) {
      return readyItems(c).length > 0;
    }).forEach(function (cat, i) {
      const chip = el("button", "chip");
      chip.appendChild(el("span", "chip__tile", escapeHtml(catInitial(cat.name))));
      chip.appendChild(el("span", "chip__label", escapeHtml(cat.name)));
      if (i === 0) chip.classList.add("is-active");
      chip.dataset.target = cat.id;
      chip.addEventListener("click", function () {
        haptic("light");
        setActiveChip(cat.id);
        const s = document.getElementById("cat-" + cat.id);
        if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      chipsRoot.appendChild(chip);
    });
  }

  /* Sahifa surilganda faol kategoriya o'zi almashadi.
     Kafel qatoridan pastda turgan eng yuqoridagi bo'lim tanlanadi. */
  function setupCategorySpy() {
    let ticking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (ticking || currentPage !== "home") return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          const line = (chipsRoot.getBoundingClientRect().bottom || 0) + 8;
          let current = null;
          menuRoot.querySelectorAll(".section").forEach(function (s) {
            if (s.getBoundingClientRect().top <= line) current = s.dataset.cat;
          });
          if (!current) {
            const first = menuRoot.querySelector(".section");
            current = first ? first.dataset.cat : null;
          }
          if (current) setActiveChip(current);
        });
      },
      { passive: true }
    );
  }

  function renderMenu() {
    menuRoot.innerHTML = "";
    const q = searchQuery.trim().toLowerCase();

    window.MENU.categories.forEach(function (cat) {
      const items = readyItems(cat).filter(function (it) {
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
      section.appendChild(el("h2", "section__title", escapeHtml(cat.name)));

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
    const gone = isOut(item);
    const card = el("article", "product" + (gone ? " product--out" : ""));

    const media = el("div", "product__media", mediaContent(item, catIcon));
    if (gone) {
      media.appendChild(el("span", "product__outbadge", t("outOfStock")));
    } else if (item.badge) {
      media.appendChild(el("span", badgeClass(item.badge), escapeHtml(badgeText(item.badge))));
    }
    media.addEventListener("click", function () {
      openSheet(item, catIcon);
    });

    const body = el("div", "product__body");
    const hasVariants = !!(item.variants && item.variants.length > 1);

    // Narx: o'lchamli bo'lsa "dan", chegirma bo'lsa eski narx chizilgan holda
    let priceHtml = formatPrice(minPrice(item));
    if (hasVariants) priceHtml += ' <small class="product__from">' + t("from") + "</small>";
    if (item.oldPrice) {
      priceHtml += ` <s class="product__old">${formatPrice(item.oldPrice)}</s>`;
    }
    body.appendChild(el("div", "product__price", priceHtml));
    body.appendChild(el("div", "product__name", escapeHtml(item.name)));
    body.appendChild(
      el("div", "product__weight", escapeHtml(item.weight || item.desc || ""))
    );

    // Tugagan taom: ko'rinadi, lekin savatga qo'shib bo'lmaydi
    if (gone) {
      const off = el("button", "product__add product__add--out", t("outOfStock"));
      off.disabled = true;
      body.appendChild(off);
      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    // O'lchamli taomlar: avval tanlash oynasi ochiladi
    if (hasVariants) {
      const pick = el("button", "product__add product__add--pick", t("choose"));
      pick.addEventListener("click", function () {
        openSheet(item, catIcon);
      });
      body.appendChild(pick);
      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    const key = item.id;
    const qty = cart[key] || 0;
    if (qty > 0) {
      const stepper = el("div", "stepper");
      const minus = el("button", null, "−");
      const plus = el("button", null, "+");
      minus.addEventListener("click", function () {
        decFromCart(key);
      });
      plus.addEventListener("click", function () {
        addToCart(key);
      });
      stepper.appendChild(minus);
      stepper.appendChild(el("span", null, String(qty)));
      stepper.appendChild(plus);
      body.appendChild(stepper);
    } else {
      const add = el("button", "product__add", "+");
      add.addEventListener("click", function () {
        addToCart(key);
        toast(item.name + " " + t("addedToCart"));
      });
      body.appendChild(add);
    }

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  /* ============ Tafsilot oynasi ============ */
  const sheet = document.getElementById("sheet");

  let activeVariant = ""; // oynada tanlangan o'lcham

  function openSheet(item, catIcon) {
    activeItem = item;
    const hasVariants = !!(item.variants && item.variants.length);
    activeVariant = hasVariants ? item.variants[0].label : "";

    document.getElementById("sheetMedia").innerHTML = mediaContent(item, catIcon);
    document.getElementById("sheetTitle").textContent = item.name;
    document.getElementById("sheetWeight").textContent = item.weight || "";
    document.getElementById("sheetDesc").textContent = item.desc || "";

    // O'lcham tugmalari
    const box = document.getElementById("sheetVariants");
    if (hasVariants && item.variants.length > 1) {
      box.hidden = false;
      box.innerHTML = item.variants
        .map(function (v, i) {
          return (
            `<button type="button" class="vopt${i === 0 ? " is-active" : ""}" data-label="${escapeHtml(v.label)}">` +
            `<span class="vopt__label">${escapeHtml(v.label)}</span>` +
            `<span class="vopt__price">${formatPrice(v.price)}</span></button>`
          );
        })
        .join("");
      box.querySelectorAll(".vopt").forEach(function (b) {
        b.addEventListener("click", function () {
          activeVariant = b.dataset.label;
          box.querySelectorAll(".vopt").forEach(function (x) {
            x.classList.toggle("is-active", x === b);
          });
          updateSheetPrice();
          haptic("light");
        });
      });
    } else {
      box.hidden = true;
      box.innerHTML = "";
    }

    // Tugagan taomni oynadan ham qo'shib bo'lmaydi
    const addBtn = document.getElementById("sheetAdd");
    const gone = isOut(item);
    addBtn.disabled = gone;
    addBtn.textContent = gone ? t("outOfStock") : t("addToCart");

    updateSheetPrice();
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function sheetKey() {
    if (!activeItem) return "";
    return activeVariant ? activeItem.id + "::" + activeVariant : activeItem.id;
  }

  function updateSheetPrice() {
    const priceEl = document.getElementById("sheetPrice");
    let html = formatPrice(keyPrice(sheetKey()));
    if (activeItem && activeItem.oldPrice) {
      html += ` <s class="sheet__old">${formatPrice(activeItem.oldPrice)}</s>`;
    }
    priceEl.innerHTML = html;
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = "";
  }
  sheet.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeSheet();
  });
  document.getElementById("sheetAdd").addEventListener("click", function () {
    if (!activeItem) return;
    const key = sheetKey();
    addToCart(key);
    toast(keyName(key) + " " + t("addedToCart"));
    closeSheet();
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
          '<div class="empty__icon">🛒</div><div class="empty__text">' + t("cartEmpty") + "</div>"
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
      body.appendChild(el("div", "cart-item__name", escapeHtml(keyName(id))));
      body.appendChild(
        el("div", "cart-item__price", formatPrice(keyPrice(id) * cart[id]))
      );
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

    // «Ichimlik qo'shasizmi?» — savatda yo'q ichimliklarni taklif qilamiz
    const upsell = buildUpsell();
    if (upsell) cartRoot.appendChild(upsell);

    // Chegirma kodi
    cartRoot.appendChild(buildPromoBox());

    // Jami
    const summary = el("div", "cart-summary");
    summary.appendChild(
      el(
        "div",
        "cart-summary__row",
        `<span>${t("products")} (${cartCount()})</span><span>${formatPrice(cartTotal())}</span>`
      )
    );
    if (promoDiscount() > 0) {
      summary.appendChild(
        el(
          "div",
          "cart-summary__row cart-summary__row--promo",
          `<span>${t("discount")} · ${escapeHtml(promo.code)}</span>` +
          `<span>−${formatPrice(promoDiscount())}</span>`
        )
      );
    }
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
    const outKeys = outItemsInCart();
    if (outKeys.length) {
      // Savatga solingandan keyin tugab qolgan bo'lsa — buyurtmani to'xtatamiz
      goBtn.disabled = true;
      goBtn.textContent = t("outOfStock");
      const names = outKeys.map(keyName).join(", ");
      const box = el("div", "notice notice--warn", escapeHtml(t("outInCart") + ": " + names));
      const rm = el("button", "btn btn--mini notice__btn", t("removeOut"));
      rm.addEventListener("click", function () {
        outKeys.forEach(function (k) { delete cart[k]; });
        save(LS_CART, cart);
        refreshCartUI();
      });
      box.appendChild(rm);
      cartRoot.appendChild(box);
    } else if (!isOpen()) {
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

  /* Chegirma kodi maydoni. Kod qo'llanilgan bo'lsa — uni ko'rsatib,
     «bekor qilish» tugmasini beradi. */
  function buildPromoBox() {
    const wrap = el("div", "promo");

    if (promo) {
      wrap.classList.add("promo--on");
      wrap.appendChild(el("div", "promo__applied",
        "✅ <b>" + escapeHtml(promo.code) + "</b> — " +
        (promo.type === "percent" ? promo.value + "%" : formatPrice(promo.value))));
      const off = el("button", "promo__clear", t("cancel"));
      off.addEventListener("click", function () {
        promo = null;
        renderCart();
      });
      wrap.appendChild(off);
      return wrap;
    }

    const input = el("input", "promo__input");
    input.type = "text";
    input.placeholder = t("promoPlaceholder");
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "characters");

    const btn = el("button", "promo__btn", t("promoApply"));
    const msg = el("div", "promo__msg");

    function submit() {
      const code = input.value.trim();
      if (!code) return;
      btn.disabled = true;
      msg.textContent = "";
      applyPromo(code, function (ok, err, minOrder) {
        btn.disabled = false;
        if (ok) {
          haptic("medium");
          renderCart();
          toast(t("promoOk"));
          return;
        }
        msg.textContent =
          err === "min_order"
            ? t("promoMinOrder") + " " + formatPrice(minOrder || 0)
            : err === "inactive"
            ? t("promoInactive")
            : t("promoBad");
      });
    }

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });

    const row = el("div", "promo__row");
    row.appendChild(input);
    row.appendChild(btn);
    wrap.appendChild(row);
    wrap.appendChild(msg);
    return wrap;
  }

  /* Savatda ichimlik bo'lmasa — pastda gorizontal taklif qatori chiqadi.
     «drinks» bo'limi bo'lmasa yoki hammasi savatda bo'lsa, hech narsa ko'rsatilmaydi. */
  const UPSELL_CAT = "drinks";
  const UPSELL_MAX = 8;

  function buildUpsell() {
    const cat = (window.MENU.categories || []).filter(function (c) {
      return c.id === UPSELL_CAT;
    })[0];
    if (!cat) return null;

    const offer = readyItems(cat).filter(function (it) {
      return !it.out && !cart[it.id] && !(it.variants && it.variants.length);
    }).slice(0, UPSELL_MAX);
    if (!offer.length) return null;

    const wrap = el("div", "upsell");
    wrap.appendChild(el("div", "upsell__title", t("addDrink")));
    const row = el("div", "upsell__row");
    offer.forEach(function (it) {
      const c = el("button", "upsell__card");
      c.appendChild(el("div", "upsell__media", mediaContent(it, cat.icon)));
      c.appendChild(el("div", "upsell__name", escapeHtml(it.name)));
      c.appendChild(el("div", "upsell__price", formatPrice(minPrice(it))));
      c.addEventListener("click", function () {
        addToCart(it.id);
        toast(it.name + " " + t("addedToCart"));
      });
      row.appendChild(c);
    });
    wrap.appendChild(row);
    return wrap;
  }

  // Yetkazish narxi (olib ketishda 0)
  function deliveryFee() {
    const r = window.MENU.restaurant;
    return mode === "delivery" ? Number(r.deliveryFee || 0) : 0;
  }

  /* ---- Chegirma kodi ----
     promo = {code, discount, type, value} yoki null.
     Savat o'zgarganda chegirma qayta hisoblanadi (foizli kod uchun muhim). */
  let promo = null;

  // Chegirmani har safar qaytadan hisoblaymiz — savat o'zgarsa foizli
  // kod ham o'zgaradi. Formula server bilan bir xil.
  function promoDiscount() {
    if (!promo) return 0;
    const sub = cartTotal();
    if (promo.minOrder && sub < promo.minOrder) return 0;
    const raw = promo.type === "fixed"
      ? Number(promo.value || 0)
      : Math.floor((sub * Number(promo.value || 0)) / 100);
    return Math.max(0, Math.min(raw, sub));
  }

  // Yakuniy summa
  function orderTotal() {
    return Math.max(0, cartTotal() - promoDiscount()) + deliveryFee();
  }

  function applyPromo(code, done) {
    fetch("/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code, subtotal: cartTotal() }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) {
          promo = {
            code: d.code, type: d.type, value: d.value,
            minOrder: Number(d.minOrder || 0),
          };
          done(true);
        } else {
          done(false, (d && d.error) || "not_found", d && d.minOrder);
        }
      })
      .catch(function () { done(false, "network"); });
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
        localStorage.setItem(LS_BRANCH, String(selectedBranch));
        paintBranchBar();
        renderMenu();
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
      document.getElementById("pickerAddr").textContent = t("mapFailed");
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
    if (!pickerGeo) return toast(t("chooseAddressFirst"));
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
  // Yetkazish/olib ketish tugmasidagi matnni joriy holatga moslaydi
  function paintModeBtn() {
    const btn = document.getElementById("modeToggle");
    if (!btn) return;
    btn.dataset.mode = mode;
    const label = btn.querySelector(".modebtn__text");
    if (label) label.textContent = mode === "pickup" ? t("pickup") : t("delivery");
  }

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
    paintModeBtn();
    document.querySelector(".picker__title").textContent = t("newAddress");
    document.querySelector("#pickerInput").placeholder = t("enterAddress");
    document.querySelector("#pickerDone").textContent = t("continue");
    const pa = document.getElementById("pickerAddr");
    if (pa && !pickerLabel) pa.textContent = t("detecting");
    document.querySelector("#sheetAdd").textContent = t("addToCart");
    const dv = document.getElementById("deliveryAddr");
    if (dv && !geoLabel) dv.textContent = t("chooseAddress");
  }

  function setupPicker() {
    document.getElementById("subBack").addEventListener("click", closeSub);
    document.getElementById("orderBack").addEventListener("click", closeOrderPage);
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

    const items = Object.keys(cart).map(function (key) {
      return {
        id: key,
        name: keyName(key),
        price: keyPrice(key),
        qty: cart[key],
      };
    });

    const branches = window.MENU.restaurant.branches || [];
    const branch = branches[selectedBranch] || null;

    const order = {
      id: "#" + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      mode: mode,
      payment: payment,
      branch: branch
        ? {
            id: branch.id || "",
            index: selectedBranch,
            label: branch.label,
            address: branch.address,
            phone: branch.phone,
          }
        : null,
      name: name,
      phone: phone,
      addrParts: mode === "delivery" ? addrParts : null,
      geo: mode === "delivery" ? geo : null,
      geoLabel: mode === "delivery" ? geoLabel : "",
      note: note.trim(),
      items: items,
      subtotal: cartTotal(),
      discount: promoDiscount(),
      // Server kodni qaytadan tekshiradi va summani o'zi hisoblaydi
      promo: promo ? { code: promo.code } : null,
      total: orderTotal(),
      deliveryFee: deliveryFee(),
      status: "Yangi",
    };

    // Buyurtmani lokal tarixga saqlash va savatni tozalash
    orders.unshift(order);
    save(LS_ORDERS, orders);
    cart = {};
    promo = null;
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

  // Holat ma'lumotlari: bosqich raqami, belgisi, nomi
  const STATUS_INFO = {
    new: { step: 1, icon: "🕐", key: "statusNew" },
    accepted: { step: 1, icon: "✅", key: "stAccepted" },
    cooking: { step: 2, icon: "👨‍🍳", key: "stCooking" },
    onway: { step: 3, icon: "🛵", key: "stOnway" },
    done: { step: 4, icon: "🏁", key: "stDone" },
    cancelled: { step: 0, icon: "❌", key: "stCancelled" },
  };

  function statusInfo(status) {
    return STATUS_INFO[status] || STATUS_INFO.new;
  }

  // Serverdan buyurtmalarni olib kelamiz (Telegram ichida bo'lsa)
  function fetchOrders(done) {
    let initData = "";
    try {
      initData = (tg && tg.initData) || "";
    } catch (e) {}
    if (!initData) return done(null);

    fetch("/api/myorders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initData }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        done(d && d.ok ? d.orders : null);
      })
      .catch(function () {
        done(null);
      });
  }

  function renderOrders() {
    ordersRoot.innerHTML = '<div class="empty"><div class="empty__icon">⏳</div></div>';

    fetchOrders(function (serverOrders) {
      // Server javob bermasa — qurilmadagi tarixni ko'rsatamiz
      const list = serverOrders || orders.map(localToRecord);
      drawOrders(list);
    });
  }

  // Eski (lokal) yozuvni server formatiga keltiramiz
  function localToRecord(o) {
    return {
      number: String(o.id || "").replace("#", ""),
      status: "new",
      created_at: o.date,
      order: o,
    };
  }

  function drawOrders(list) {
    ordersRoot.innerHTML = "";
    if (!list.length) {
      ordersRoot.appendChild(
        el(
          "div",
          "empty",
          '<div class="empty__icon">📋</div><div class="empty__text">' +
            t("noOrders") +
            "</div>"
        )
      );
      return;
    }

    list.forEach(function (rec) {
      const o = rec.order || {};
      const info = statusInfo(rec.status);
      const card = el("button", "order-card");
      const when = formatDateTime(rec.created_at);

      card.innerHTML =
        '<div class="order-card__head">' +
        `<span class="order-card__id">${t("orderNo")} #${escapeHtml(String(rec.number))}</span>` +
        `<span class="order-card__status">${info.icon} ${escapeHtml(t(info.key))}</span>` +
        "</div>" +
        `<div class="order-card__date">${escapeHtml(when)}</div>` +
        '<div class="order-card__items">' +
        (o.items || [])
          .map(function (i) {
            return escapeHtml(i.name) + " ×" + i.qty;
          })
          .join(", ") +
        "</div>" +
        `<div class="order-card__total">${formatPrice(o.total || 0)}</div>`;

      card.addEventListener("click", function () {
        openOrderPage(rec);
      });
      ordersRoot.appendChild(card);
    });
  }

  // Vaqtlar har doim Toshkent bo'yicha ko'rsatiladi —
  // telefon boshqa mintaqada bo'lsa ham to'g'ri chiqadi
  function tashkentParts(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const tk = new Date(d.getTime() + (5 * 60 + d.getTimezoneOffset()) * 60000);
    return {
      day: tk.getDate(),
      month: tk.getMonth() + 1,
      year: tk.getFullYear(),
      hour: tk.getHours(),
      minute: tk.getMinutes(),
      time: tk.getTime(),
    };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateTime(iso) {
    if (!iso) return "";
    const p = tashkentParts(iso);
    if (!p) return iso;
    return (
      pad2(p.day) + "." + pad2(p.month) + "." + p.year +
      " " + pad2(p.hour) + ":" + pad2(p.minute)
    );
  }

  // Yetkazish oynasi: yaratilgan vaqt + 45 daqiqa
  function etaRange(iso) {
    const p = tashkentParts(iso);
    if (!p) return "";
    const end = new Date(p.time + 45 * 60000);
    return (
      pad2(p.hour) + ":" + pad2(p.minute) + " – " +
      pad2(end.getHours()) + ":" + pad2(end.getMinutes())
    );
  }

  /* ============ Buyurtma tafsiloti ============ */
  let currentOrderStatus = null;

  function openOrderPage(rec) {
    const o = rec.order || {};
    currentOrderStatus = rec.status;
    const info = statusInfo(rec.status);
    const r = window.MENU.restaurant;
    haptic("light");

    document.getElementById("orderTitle").textContent =
      t("orderDetail") + " #" + rec.number;
    currentOrderNumber = rec.number;

    // Bosqichlar chizig'i
    const steps = ["📄", "👨‍🍳", "🛵", "✓"];
    const stepsHtml = steps
      .map(function (s, i) {
        const active = info.step >= i + 1 ? " is-done" : "";
        return `<span class="ostep${active}">${s}</span>`;
      })
      .join('<span class="ostep__line"></span>');

    // Taomlar ro'yxati
    const itemsHtml = (o.items || [])
      .map(function (i) {
        return (
          '<div class="oitem">' +
          `<div class="oitem__name">${escapeHtml(i.name)}<small>${i.qty} ${t("pc")}</small></div>` +
          `<div class="oitem__price">${formatPrice(i.price * i.qty)}` +
          `<small>${formatPrice(i.price)}/${t("pc")}</small></div>` +
          "</div>"
        );
      })
      .join("");

    // Manzil
    const addrBits = [];
    if (o.geoLabel) addrBits.push(o.geoLabel);
    const a = o.addrParts || {};
    const detail = [];
    if (a.house) detail.push(a.house + "-uy");
    if (a.entrance) detail.push(a.entrance + "-podyezd");
    if (a.floor) detail.push(a.floor + "-qavat");
    if (a.flat) detail.push(a.flat + "-xonadon");
    if (detail.length) addrBits.push(detail.join(", "));

    const rows = [
      [t("fromWhere"), (o.branch && o.branch.label) || r.name],
      [t("toWhere"), o.mode === "pickup" ? t("pickup") : addrBits.join(", ") || "-"],
      [t("orderType"), o.mode === "pickup" ? t("pickup") : t("delivery")],
      [t("paymentType"), o.payment === "card" ? t("card") : t("cash")],
      [t("itemsCost"), formatPrice((o.total || 0) - (o.deliveryFee || 0))],
      [t("deliveryCost"), o.deliveryFee ? formatPrice(o.deliveryFee) : t("free")],
    ];

    const rowsHtml = rows
      .map(function (row) {
        return (
          '<div class="orow">' +
          `<span>${escapeHtml(row[0])}</span><span>${escapeHtml(String(row[1]))}</span>` +
          "</div>"
        );
      })
      .join("");

    const phone = (r.branches && r.branches[0] && r.branches[0].phone) || "";

    document.getElementById("orderBody").innerHTML =
      '<div class="ohead">' +
      `<p>${escapeHtml(t("createdAt"))} ${escapeHtml(formatDateTime(rec.created_at))}</p>` +
      "</div>" +
      '<div class="ostatus">' +
      `<div class="ostatus__icon">${info.icon}</div>` +
      `<div class="ostatus__name">${escapeHtml(t(info.key))}</div>` +
      (rec.status !== "cancelled" && rec.status !== "done"
        ? `<div class="ostatus__eta">${escapeHtml(t("etaText"))} ${escapeHtml(etaRange(rec.created_at))}</div>`
        : "") +
      `<div class="osteps">${stepsHtml}</div>` +
      "</div>" +
      (phone
        ? `<a class="obtn" href="tel:${phone.replace(/\s/g, "")}">💬 ${escapeHtml(t("support"))}</a>`
        : "") +
      `<h3 class="co-title">${escapeHtml(t("orderItems"))}</h3>` +
      `<div class="ocard">${itemsHtml}</div>` +
      `<h3 class="co-title">${escapeHtml(t("orderDetails"))}</h3>` +
      `<div class="ocard">${rowsHtml}` +
      `<div class="orow orow--total"><span>${escapeHtml(t("total"))}</span>` +
      `<span>${formatPrice(o.total || 0)}</span></div></div>` +
      (o.geo
        ? `<a class="obtn obtn--map" target="_blank" rel="noopener" href="https://maps.google.com/?q=${o.geo.lat},${o.geo.lng}">🗺 ${
            lang === "ru" ? "Открыть на карте" : "Xaritada ochish"
          }</a>`
        : "");

    document.getElementById("orderPage").hidden = false;
    document.body.style.overflow = "hidden";
    startOrderPolling();
  }

  // Sahifa ochiq turganda holatni muntazam yangilab turamiz
  let orderTimer = null;
  let currentOrderNumber = null;

  function startOrderPolling() {
    stopOrderPolling();
    orderTimer = setInterval(refreshOpenOrder, 15000);
  }

  function stopOrderPolling() {
    if (orderTimer) clearInterval(orderTimer);
    orderTimer = null;
  }

  function refreshOpenOrder() {
    if (document.getElementById("orderPage").hidden) return stopOrderPolling();
    fetchOrders(function (list) {
      if (!list) return;
      const fresh = list.filter(function (r) {
        return r.number === currentOrderNumber;
      })[0];
      // Holat o'zgargan bo'lsagina qayta chizamiz
      if (fresh && fresh.status !== currentOrderStatus) {
        currentOrderStatus = fresh.status;
        openOrderPage(fresh);
        haptic("light");
      }
    });
  }

  function closeOrderPage() {
    stopOrderPolling();
    document.getElementById("orderPage").hidden = true;
    document.body.style.overflow = "";
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
    // Bitta tugma: bosilganda yetkazish ↔ olib ketish almashadi
    document.getElementById("modeToggle").addEventListener("click", function () {
      mode = mode === "pickup" ? "delivery" : "pickup";
      paintModeBtn();
      const addr = document.getElementById("deliveryAddr");
      addr.textContent = mode === "pickup" ? t("pickupAtBranch") : t("chooseAddress");
      if (currentPage === "cart") renderCart();
      haptic("light");
    });

    // Qo'ng'iroqcha — buyurtmalar sahifasiga olib boradi
    document.getElementById("bellBtn").addEventListener("click", function () {
      switchPage("orders");
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

  /* Ilova ochilganini serverga bildiramiz. Agar mijoz hech narsa
     buyurtma qilmasdan chiqib ketsa, bot unga eslatma yuboradi.
     Buyurtma berilsa bu belgi serverda o'chiriladi. */
  function pingVisit() {
    let initData = "";
    try {
      initData = (tg && tg.initData) || "";
    } catch (e) {}
    if (!initData) return; // Telegram'dan tashqarida — kuzatmaymiz
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initData }),
    }).catch(function () {});
  }

  /* ---- Yashirin imo-ishora: logoni 3 marta bossa admin panel ochiladi ----
     Faqat restoran egasi uchun qulaylik — manzilni qo'lda yozish shart emas.
     Panelning o'zi PIN bilan himoyalangan, shuning uchun bu yerda
     hech qanday qo'shimcha tekshiruv kerak emas. */
  const ADMIN_TAPS = 3; // necha marta bosish kerak
  const ADMIN_TAP_GAP = 1200; // bosishlar orasidagi maksimal tanaffus (ms)

  function setupAdminGesture() {
    const logo = document.querySelector(".topbar__logoimg");
    if (!logo) return;

    let taps = 0;
    let timer = null;

    logo.addEventListener("click", function () {
      taps++;
      clearTimeout(timer);

      if (taps >= ADMIN_TAPS) {
        taps = 0;
        haptic("medium");
        window.location.href = "admin.html";
        return;
      }

      haptic("light");
      // Ketma-ketlik uzilib qolsa — hisobni nolga qaytaramiz
      timer = setTimeout(function () {
        taps = 0;
      }, ADMIN_TAP_GAP);
    });
  }

  // Bot xabaridagi «📋 Buyurtmani ko'rish» tugmasi ilovani
  // ?order=<raqam> bilan ochadi — shu buyurtmani darhol ko'rsatamiz
  function openOrderFromLink() {
    const params = new URLSearchParams(window.location.search);
    const num = parseInt(params.get("order"), 10);
    if (!num) return;
    switchPage("orders");
    fetchOrders(function (list) {
      if (!list) return;
      const rec = list.filter(function (r) {
        return r.number === num;
      })[0];
      if (rec) openOrderPage(rec);
    });
  }

  // Admin panelda tahrirlangan menyu bo'lsa — o'shani ishlatamiz,
  // bo'lmasa yoki server javob bermasa data/menu.js dagi standart menyu qoladi
  function loadRemoteMenu(done) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(function () {
      if (controller) controller.abort();
    }, 2500);
    fetch("/api/menu", controller ? { signal: controller.signal } : {})
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        clearTimeout(timer);
        if (d && d.menu && d.menu.categories && d.menu.categories.length) {
          window.MENU = d.menu;
        }
        done();
      })
      .catch(function () {
        clearTimeout(timer);
        done();
      });
  }

  /* ============ Ishga tushirish ============ */
  function init() {
    loadRemoteMenu(startApp);
  }

  function startApp() {
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
    setupAdminGesture();
    setupCategorySpy();
    setupBranchBar();
    pingVisit();
    document.documentElement.lang = lang;
    applyStaticLabels();
    refreshCartUI();
    openOrderFromLink();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
