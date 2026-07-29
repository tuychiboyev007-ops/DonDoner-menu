/*
 * DonDoner — Mini App mantiqi
 * ------------------------------------------------------------
 * - SPA navigatsiya: Bosh sahifa / Savat / Buyurtmalar / Profil
 * - Savat (localStorage'da saqlanadi)
 * - Checkout: forma to'ldirilib, buyurtma botga yuboriladi (tg.sendData)
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

  /* ============ Holat ============ */
  let cart = load(LS_CART, {}); // { itemId: qty }
  let orders = load(LS_ORDERS, []); // [{id, date, items, total, mode, ...}]
  let mode = "delivery"; // delivery | pickup
  let activeItem = null; // sheet uchun
  let selectedBranch = 0; // tanlangan filial indeksi (birinchisi standart)
  let geo = null; // tanlangan joylashuv: { lat, lng }
  let geoLabel = ""; // joylashuvning matnli manzili
  let pickerMap = null; // manzil tanlash xaritasi
  let pickerGeo = null; // tanlash jarayonidagi vaqtinchalik nuqta
  let pickerLabel = "";
  let skipNextLookup = false; // qidiruvdan tanlangan nom saqlanib qolsin
  // Tuzilmali manzil maydonlari (saqlanadi)
  let addrParts = load(LS_ADDR, { house: "", flat: "", floor: "", entrance: "", note: "" });
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
          '<div class="empty__icon">🔎</div><div class="empty__text">Hech narsa topilmadi</div>'
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
        `<span>Mahsulotlar (${cartCount()})</span><span>${formatPrice(cartTotal())}</span>`
      )
    );
    summary.appendChild(
      el(
        "div",
        "cart-summary__total",
        `<span>Jami</span><span>${formatPrice(cartTotal())}</span>`
      )
    );
    cartRoot.appendChild(summary);

    // Checkout forma
    cartRoot.appendChild(buildCheckout());

    // Pastda yopishib turadigan panel: jami + buyurtma tugmasi
    const bar = el("div", "checkout-bar");
    bar.innerHTML = `<span class="checkout-bar__total">${formatPrice(cartTotal())}</span>`;
    const goBtn = el("button", "btn btn--primary checkout-bar__btn", "Buyurtma berish");
    goBtn.addEventListener("click", submitOrder);
    bar.appendChild(goBtn);
    cartRoot.appendChild(bar);
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
      '<span class="mode-card__tick"></span>Yetkazish</button>' +
      `<button type="button" class="mode-card${mode === "pickup" ? " is-active" : ""}" data-mode="pickup">` +
      '<span class="mode-card__tick"></span>Olib ketish</button>' +
      "</div>";

    /* --- Qayerga: manzil + tuzilmali maydonlar --- */
    const addrRowHtml =
      '<button type="button" class="addr-row" id="addrRow">' +
      '<span class="addr-row__icon">🏠</span>' +
      '<span class="addr-row__body">' +
      '<span class="addr-row__label">Yetkazish manzili</span>' +
      `<span class="addr-row__value${geoLabel ? "" : " is-empty"}" id="addrValue">` +
      escapeHtml(geoLabel || "Xaritadan tanlang") +
      "</span></span>" +
      '<span class="addr-row__arrow">›</span></button>';

    const gridHtml =
      '<div class="addr-grid">' +
      `<input id="coHouse" type="text" placeholder="Uy" value="${escapeHtml(addrParts.house)}" />` +
      `<input id="coFlat" type="text" placeholder="Xonadon" value="${escapeHtml(addrParts.flat)}" />` +
      `<input id="coFloor" type="text" placeholder="Qavat" value="${escapeHtml(addrParts.floor)}" />` +
      `<input id="coEntrance" type="text" placeholder="Podyezd" value="${escapeHtml(addrParts.entrance)}" />` +
      "</div>" +
      `<textarea id="coCourier" class="addr-note" placeholder="Kuryerga izoh">${escapeHtml(addrParts.note)}</textarea>`;

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
      '<h3 class="co-title">Yetkazish</h3>' +
      modeHtml +
      '<div id="whereBlock">' +
      '<h3 class="co-title">Qayerga</h3>' +
      addrRowHtml +
      gridHtml +
      "</div>" +
      (branches.length
        ? '<h3 class="co-title">Filial</h3><div class="branch-select">' + branchHtml + "</div>"
        : "") +
      '<h3 class="co-title">Mijoz</h3>' +
      '<div class="field"><label>Ismingiz</label>' +
      `<input id="coName" type="text" placeholder="Ism" value="${escapeHtml(defaultName)}" /></div>` +
      '<div class="field"><label>Telefon raqam</label>' +
      '<div class="phone-input"><span class="phone-input__prefix">+998</span>' +
      '<input id="coPhone" type="tel" inputmode="numeric" placeholder="__ ___ __ __" /></div></div>' +
      '<div class="field"><label>Buyurtmaga izoh</label>' +
      '<textarea id="coNote" placeholder="Qo\'shimcha izoh"></textarea></div>';

    /* --- Hodisalar --- */
    wrap.querySelector("#modeCards").addEventListener("click", function (e) {
      const b = e.target.closest(".mode-card");
      if (!b) return;
      mode = b.dataset.mode;
      haptic("light");
      renderCart();
    });

    wrap.querySelector("#addrRow").addEventListener("click", openPicker);

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
    el.textContent = "Manzil aniqlanmoqda…";
    reverseGeocode(pickerGeo, function (addr) {
      pickerLabel = addr;
      el.textContent = addr || "Manzil aniqlanmadi — nuqtani surib ko'ring";
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
    if (!navigator.geolocation) return toast("Qurilma joylashuvni qo'llamaydi");
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
        toast(err && err.code === 1 ? "Joylashuvga ruxsat berilmadi" : "Joylashuv aniqlanmadi");
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

  function setupPicker() {
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

    if (!name) return toast("Ismingizni kiriting");
    const digits = phoneRaw.replace(/\D/g, "").slice(0, 9);
    if (digits.length !== 9) return toast("Telefon raqamni to'liq kiriting");
    const phone = formatPhone(digits);

    if (mode === "delivery" && !geo) {
      return toast("Yetkazish manzilini xaritadan tanlang");
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
      total: cartTotal(),
      status: "Yangi",
    };

    // Buyurtmani lokal tarixga saqlash va savatni tozalash
    orders.unshift(order);
    save(LS_ORDERS, orders);
    cart = {};
    save(LS_CART, cart);
    refreshCartUI();
    haptic("medium");

    // 1) Asosiy yo'l: chatga tayyor buyurtma matnini qo'yish.
    //    Ilova yopiladi, mijoz faqat "yuborish"ni bosadi.
    const botUsername = window.MENU.restaurant.botUsername;
    try {
      if (tg && typeof tg.openTelegramLink === "function" && botUsername) {
        tg.openTelegramLink(
          "https://t.me/" +
            botUsername +
            "?text=" +
            encodeURIComponent(buildOrderText(order))
        );
        return;
      }
    } catch (e) {}

    // 2) Zaxira: klaviatura tugmasidan ochilgan bo'lsa — sendData
    try {
      if (tg && typeof tg.sendData === "function") {
        tg.sendData(JSON.stringify({ type: "order", order: order }));
        toast("Buyurtma yuborildi ✅");
        return;
      }
    } catch (e) {}

    // 3) Oddiy brauzer: tasdiq va Buyurtmalar sahifasi
    toast("Buyurtma qabul qilindi ✅");
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
    const r = window.MENU.restaurant;
    const name = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Mehmon";
    const initial = (name[0] || "M").toUpperCase();
    const avatar = user && user.photo_url ? `<img src="${user.photo_url}" alt="" />` : initial;
    const uname = user && user.username ? "@" + user.username : "Telegram foydalanuvchi";

    let rows = (r.branches || [])
      .map(function (b) {
        return (
          `<div class="profile__row"><span class="emoji">📍</span>` +
          `<span>${escapeHtml(b.label)}: ${escapeHtml(b.address)}<br>` +
          `<a href="tel:${b.phone.replace(/\s/g, "")}">${escapeHtml(b.phone)}</a></span></div>`
        );
      })
      .join("");
    if (r.delivery) {
      rows += `<div class="profile__row"><span class="emoji">🚗</span>Yetkazib berish — BEPUL</div>`;
    }
    if (r.instagram) {
      rows += `<div class="profile__row"><span class="emoji">📸</span><a href="https://instagram.com/${r.instagram}" target="_blank" rel="noopener">@${r.instagram}</a></div>`;
    }
    rows += `<div class="profile__row"><span class="emoji">📋</span>Buyurtmalar tarixi: ${orders.length} ta</div>`;

    root.innerHTML =
      '<div class="profile__card">' +
      `<div class="profile__avatar">${avatar}</div>` +
      `<div><h3 class="profile__name">${escapeHtml(name)}</h3>` +
      `<p class="profile__sub">${escapeHtml(uname)}</p></div>` +
      "</div>" +
      `<div class="profile__list">${rows}</div>`;
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
    refreshCartUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
