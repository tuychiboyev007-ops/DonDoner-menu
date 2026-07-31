/*
 * DonDöner — ELEKTRON MENYU
 * ------------------------------------------------------------
 * Stol ustidagi QR kod shu sahifani ochadi:
 *     menu.html?b=b1
 * `b` — filial id'si. Har filial o'z «tugadi» belgilarini ko'rsatadi.
 *
 * Bu sahifa ilovadan mustaqil: savat, buyurtma va Telegram kerak emas.
 * Menyu esa aynan bitta manbadan olinadi (/api/menu), shuning uchun
 * admin panelda o'zgartirilgan narx bu yerda ham darhol ko'rinadi.
 */
(function () {
  "use strict";

  var LS_LANG = "dondoner_lang";
  var params = new URLSearchParams(location.search);
  var branchId = params.get("b") || "";
  var lang = localStorage.getItem(LS_LANG) || "ru";

  var bodyEl = document.getElementById("mBody");
  var navEl = document.getElementById("mNav");

  function t(key) {
    var pack = (window.I18N && window.I18N[lang]) || {};
    var fall = (window.I18N && window.I18N.uz) || {};
    return pack[key] !== undefined ? pack[key] : fall[key] !== undefined ? fall[key] : key;
  }

  function esc(str) {
    return String(str === undefined || str === null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(v) {
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + t("currency");
  }

  /* ---- Narx va mavjudlik ---- */

  // Narxi kiritilmagan taom menyuda ko'rsatilmaydi
  function isReady(item) {
    if (item.variants && item.variants.length) {
      return item.variants.some(function (v) {
        return Number(v.price) > 0;
      });
    }
    return Number(item.price) > 0;
  }

  function readyItems(cat) {
    return (cat.items || []).filter(isReady);
  }

  // Taom shu filialda tugaganmi? (eski `out: true` — hamma filialda)
  function isOut(item) {
    if (item.out === true && !item.outAt) return true;
    var list = item.outAt || [];
    return list.length ? list.indexOf(branchId) !== -1 : false;
  }

  function restaurant() {
    return (window.MENU && window.MENU.restaurant) || {};
  }

  function branch() {
    var list = restaurant().branches || [];
    if (!list.length) return null;
    for (var i = 0; i < list.length; i++) {
      if ((list[i].id || "") === branchId) return list[i];
    }
    return list[0];
  }

  /* ---- Chizish ---- */

  function paintHead() {
    document.documentElement.lang = lang;
    document.getElementById("mTagline").textContent = restaurant().tagline || "";
    document.getElementById("mLang").textContent = lang === "ru" ? "UZ" : "RU";

    var b = branch();
    var h = restaurant().hours || {};
    var rows = [];
    if (b) {
      rows.push("<b>" + esc(b.label) + "</b> · " + esc(b.address));
      if (b.phone) {
        rows.push(
          '☎ <a href="tel:' + esc(b.phone.replace(/\s/g, "")) + '" style="color:inherit">' +
            esc(b.phone) + "</a>"
        );
      }
    }
    if (h.open && h.close) rows.push("🕐 " + esc(h.open) + " – " + esc(h.close));
    document.getElementById("mBranch").innerHTML = rows.join("<br />");
  }

  function paintNav(cats) {
    navEl.innerHTML = "";
    cats.forEach(function (cat) {
      var a = document.createElement("button");
      a.type = "button";
      a.className = "mnav__link";
      a.textContent = cat.name || "";
      a.dataset.target = cat.id;
      a.addEventListener("click", function () {
        var s = document.getElementById("sec-" + cat.id);
        if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      navEl.appendChild(a);
    });
  }

  function itemRow(item) {
    var out = isOut(item);
    var row = document.createElement("div");
    row.className = "mrow" + (out ? " mrow--out" : "");

    var html = "";
    if (item.image) {
      html +=
        '<img class="mrow__img" src="' + esc(item.image) + '" alt="' + esc(item.name) +
        '" loading="lazy" />';
    }

    html += '<div class="mrow__body"><div class="mrow__name">' + esc(item.name) + "</div>";

    var desc = item.desc || item.weight || "";
    if (desc) html += '<div class="mrow__desc">' + esc(desc) + "</div>";

    var sized = item.variants && item.variants.length;
    if (sized) {
      var parts = item.variants
        .filter(function (v) {
          return Number(v.price) > 0;
        })
        .map(function (v) {
          return "<span>" + esc(v.label) + "<b>" + money(Number(v.price)) + "</b></span>";
        });
      html += '<div class="mrow__sizes">' + parts.join("") + "</div>";
    }

    if (out) html += '<span class="mrow__out">' + esc(t("outOfStock")) + "</span>";
    html += "</div>";

    // O'lchamsiz taomda narx o'ngda turadi
    if (!sized) {
      html += '<div class="mrow__price">' + money(Number(item.price));
      if (item.oldPrice) {
        html += '<span class="mrow__old">' + money(Number(item.oldPrice)) + "</span>";
      }
      html += "</div>";
    }

    row.innerHTML = html;
    return row;
  }

  function paintMenu() {
    var cats = (window.MENU.categories || []).filter(function (c) {
      return readyItems(c).length > 0;
    });

    paintHead();
    paintNav(cats);

    bodyEl.innerHTML = "";
    cats.forEach(function (cat) {
      var sec = document.createElement("section");
      sec.id = "sec-" + cat.id;
      sec.dataset.cat = cat.id;

      var h2 = document.createElement("h2");
      h2.className = "msec";
      h2.textContent = cat.name || "";
      sec.appendChild(h2);

      readyItems(cat).forEach(function (item) {
        sec.appendChild(itemRow(item));
      });
      bodyEl.appendChild(sec);
    });

    paintFoot();
    setActive(cats.length ? cats[0].id : "");
  }

  function paintFoot() {
    var r = restaurant();
    var html = '<div class="mfoot__brand">' + esc(r.name || "DonDöner") + "</div>";
    if (r.delivery) html += esc(r.delivery) + "<br />";
    (r.branches || []).forEach(function (b) {
      html += esc(b.label) + " · " + esc(b.address) + "<br />";
    });
    if (r.instagram) {
      html +=
        '<a href="https://instagram.com/' + esc(r.instagram) +
        '" target="_blank" rel="noopener">@' + esc(r.instagram) + "</a>";
    }
    document.getElementById("mFoot").innerHTML = html;
  }

  /* Sahifa surilganda tasmadagi faol bo'lim o'zi almashadi */
  function setActive(catId) {
    var active = null;
    var links = navEl.querySelectorAll(".mnav__link");
    for (var i = 0; i < links.length; i++) {
      var on = links[i].dataset.target === catId;
      links[i].classList.toggle("is-active", on);
      if (on) active = links[i];
    }
    if (!active) return;
    // Bo'limlar ko'p — faol yozuv ekrandan chiqib ketmasin
    var left = active.offsetLeft - (navEl.clientWidth - active.offsetWidth) / 2;
    var max = navEl.scrollWidth - navEl.clientWidth;
    left = Math.max(0, Math.min(max, left));
    if (Math.abs(navEl.scrollLeft - left) > 4) {
      navEl.scrollTo({ left: left, behavior: "smooth" });
    }
  }

  function setupSpy() {
    var ticking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var line = navEl.getBoundingClientRect().bottom + 10;
          var current = null;
          var secs = bodyEl.querySelectorAll("section");
          for (var i = 0; i < secs.length; i++) {
            if (secs[i].getBoundingClientRect().top <= line) current = secs[i].dataset.cat;
          }
          if (!current && secs.length) current = secs[0].dataset.cat;
          if (current) setActive(current);
        });
      },
      { passive: true }
    );
  }

  /* ---- Ishga tushirish ---- */

  // Serverdagi menyu — admin panelda tahrirlangani. Javob bermasa,
  // data/menu.js dagi zaxira ro'yxat ishlatiladi.
  function loadMenu(done) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 4000);
    fetch("/api/menu", ctrl ? { signal: ctrl.signal } : {})
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

  function start() {
    if (!window.MENU) {
      bodyEl.innerHTML = '<div class="mloading">Меню недоступно</div>';
      return;
    }
    paintMenu();
    setupSpy();

    document.getElementById("mLang").addEventListener("click", function () {
      lang = lang === "ru" ? "uz" : "ru";
      try {
        localStorage.setItem(LS_LANG, lang);
      } catch (e) {}
      paintMenu();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadMenu(start);
  });
})();
