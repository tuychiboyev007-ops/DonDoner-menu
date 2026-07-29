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

  /* ============ Holat ============ */
  let cart = load(LS_CART, {}); // { itemId: qty }
  let orders = load(LS_ORDERS, []); // [{id, date, items, total, mode, ...}]
  let mode = "delivery"; // delivery | pickup
  let activeItem = null; // sheet uchun
  let selectedBranch = 0; // tanlangan filial indeksi (birinchisi standart)
  let geo = null; // aniqlangan joylashuv: { lat, lng }
  let geoLabel = ""; // joylashuvning matnli manzili (Nominatim)
  let mapObj = null; // Leaflet xarita nusxasi
  let markerObj = null; // xaritadagi nuqta

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
  }

  function buildCheckout() {
    const wrap = el("div", "checkout");
    const user = tgUser();
    const defaultName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "";

    // Filial tanlash tugmalari
    const branches = window.MENU.restaurant.branches || [];
    const branchHtml = branches
      .map(function (b, i) {
        return (
          `<button type="button" class="branch-opt${i === selectedBranch ? " is-active" : ""}" data-idx="${i}">` +
          `${escapeHtml(b.label)}<small>📍 ${escapeHtml(b.address)}</small></button>`
        );
      })
      .join("");

    wrap.innerHTML =
      (branches.length
        ? `<div class="field"><label>Filialni tanlang</label><div class="branch-select">${branchHtml}</div></div>`
        : "") +
      '<div class="field"><label>Ismingiz</label>' +
      `<input id="coName" type="text" placeholder="Ism" value="${escapeHtml(defaultName)}" /></div>` +
      '<div class="field"><label>Telefon raqam</label>' +
      `<input id="coPhone" type="tel" inputmode="numeric" value="${PHONE_PREFIX}" /></div>` +
      '<div class="field" id="coAddrField"><label>Yetkazish manzili</label>' +
      '<textarea id="coAddr" placeholder="Ko\'cha, uy, xonadon…"></textarea>' +
      '<button type="button" class="geo-btn" id="geoBtn">📍 Joylashuvimni aniqlash</button>' +
      '<div class="geo-box" id="geoBox" hidden>' +
      '<div class="geo-map" id="geoMap"></div>' +
      '<div class="geo-hint">Nuqtani surib aniq joyni belgilashingiz mumkin</div>' +
      '<div class="geo-addr" id="geoAddr"></div>' +
      "</div></div>" +
      '<div class="field"><label>Izoh (ixtiyoriy)</label>' +
      '<textarea id="coNote" placeholder="Qo\'shimcha izoh"></textarea></div>';

    // Telefon maydoni — har doim +998 bilan boshlanadi
    const phoneInput = wrap.querySelector("#coPhone");
    phoneInput.addEventListener("input", function () {
      phoneInput.value = formatPhone(phoneInput.value);
    });
    phoneInput.addEventListener("focus", function () {
      if (!phoneInput.value.trim()) phoneInput.value = PHONE_PREFIX;
      // Kursorni oxiriga qo'yamiz (prefiksni o'chirib yubormasin)
      setTimeout(function () {
        const end = phoneInput.value.length;
        phoneInput.setSelectionRange(end, end);
      }, 0);
    });

    // Joylashuvni aniqlash
    const geoBtn = wrap.querySelector("#geoBtn");
    geoBtn.addEventListener("click", function () {
      requestGeo(geoBtn);
    });
    if (geo) {
      geoBtn.textContent = "📍 Joylashuvni yangilash";
      // DOM'ga qo'shilgandan keyin xaritani chizamiz
      setTimeout(showGeoMap, 0);
    }

    // Filial tanlash bosilganda
    wrap.querySelectorAll(".branch-opt").forEach(function (b) {
      b.addEventListener("click", function () {
        selectedBranch = parseInt(b.dataset.idx, 10) || 0;
        wrap.querySelectorAll(".branch-opt").forEach(function (x) {
          x.classList.toggle("is-active", x === b);
        });
        haptic("light");
      });
    });

    const btn = el("button", "btn btn--primary", "Buyurtma berish");
    btn.addEventListener("click", submitOrder);
    wrap.appendChild(btn);

    // Olib ketish rejimida manzil kerak emas
    if (mode === "pickup") {
      const af = wrap.querySelector("#coAddrField");
      if (af) af.style.display = "none";
    }
    return wrap;
  }

  /* ============ Joylashuv ============ */
  function mapsLink(g) {
    return "https://maps.google.com/?q=" + g.lat + "," + g.lng;
  }

  // Manzil nomini aniqlash (OpenStreetMap Nominatim — bepul)
  function lookupAddress(g) {
    const addrEl = document.getElementById("geoAddr");
    if (addrEl) addrEl.textContent = "Manzil aniqlanmoqda…";
    fetch("/api/geocode?lat=" + g.lat + "&lng=" + g.lng)
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        geoLabel = (d && d.address) || "";
        const el = document.getElementById("geoAddr");
        if (el) el.textContent = geoLabel ? "📍 " + geoLabel : "";
      })
      .catch(function () {
        geoLabel = "";
        const el = document.getElementById("geoAddr");
        if (el) el.textContent = "";
      });
  }

  // Xaritani ko'rsatish (nuqtani surish mumkin)
  function showGeoMap() {
    const box = document.getElementById("geoBox");
    const mapEl = document.getElementById("geoMap");
    if (!box || !mapEl || !geo) return;
    box.hidden = false;

    if (typeof L === "undefined") {
      // Leaflet yuklanmasa — oddiy havola bilan cheklanamiz
      mapEl.innerHTML =
        '<a class="geo-fallback" href="' +
        mapsLink(geo) +
        '" target="_blank" rel="noopener">🗺 Xaritada ko\'rish</a>';
      return;
    }

    const pos = [parseFloat(geo.lat), parseFloat(geo.lng)];
    if (mapObj) {
      mapObj.remove();
      mapObj = null;
    }
    mapObj = L.map(mapEl, { attributionControl: false }).setView(pos, 17);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(mapObj);

    markerObj = L.marker(pos, { draggable: true }).addTo(mapObj);
    markerObj.on("dragend", function () {
      const p = markerObj.getLatLng();
      geo = { lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) };
      haptic("light");
      lookupAddress(geo);
    });
    mapObj.on("click", function (e) {
      markerObj.setLatLng(e.latlng);
      geo = { lat: e.latlng.lat.toFixed(6), lng: e.latlng.lng.toFixed(6) };
      haptic("light");
      lookupAddress(geo);
    });

    // Yashirin holatda chizilgani uchun o'lchamni yangilaymiz
    setTimeout(function () {
      if (mapObj) mapObj.invalidateSize();
    }, 120);

    // Plitkalar yuklanmasa (internet sekin/bloklangan) — havola ko'rsatamiz
    setTimeout(function () {
      const tiles = mapEl.querySelectorAll("img.leaflet-tile");
      let ok = 0;
      tiles.forEach(function (t) {
        if (t.naturalWidth > 0) ok++;
      });
      if (ok === 0) {
        const hint = document.querySelector(".geo-hint");
        if (hint) {
          hint.innerHTML =
            'Xarita yuklanmadi — <a href="' +
            mapsLink(geo) +
            '" target="_blank" rel="noopener">xaritada ochish</a>';
        }
      }
    }, 5000);

    lookupAddress(geo);
  }

  function requestGeo(btn) {
    if (!navigator.geolocation) {
      toast("Qurilma joylashuvni qo'llab-quvvatlamaydi");
      return;
    }
    haptic("light");
    btn.disabled = true;
    btn.textContent = "⏳ Aniqlanmoqda…";

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        geo = {
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        };
        btn.disabled = false;
        btn.textContent = "📍 Joylashuvni yangilash";
        showGeoMap();
        toast("Joylashuv aniqlandi ✅");
        haptic("medium");
      },
      function (err) {
        btn.disabled = false;
        btn.textContent = "📍 Joylashuvimni aniqlash";
        const msg =
          err && err.code === 1
            ? "Joylashuvga ruxsat berilmadi"
            : "Joylashuv aniqlanmadi";
        toast(msg + " — manzilni qo'lda yozing");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
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
    if (order.mode !== "pickup" && order.address) L.push("📍 " + order.address);
    if (order.geoLabel) L.push("📌 " + order.geoLabel);
    if (order.geo) L.push("🗺 " + mapsLink(order.geo));
    L.push("");
    L.push("👤 " + order.name);
    L.push("📞 " + order.phone);
    if (order.note) L.push("📝 " + order.note);
    return L.join("\n");
  }

  function submitOrder() {
    const name = (document.getElementById("coName").value || "").trim();
    const phone = (document.getElementById("coPhone").value || "").trim();
    const addr = (document.getElementById("coAddr") || {}).value || "";
    const note = (document.getElementById("coNote") || {}).value || "";

    if (!name) return toast("Ismingizni kiriting");
    if (phoneDigits(phone).length !== 9) {
      return toast("Telefon raqamni to'liq kiriting");
    }
    if (mode === "delivery" && !addr.trim() && !geo) {
      return toast("Manzilni yozing yoki joylashuvni aniqlang");
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
      address: addr.trim(),
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
    refreshCartUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
