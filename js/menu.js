/*
 * DonDöner — ELEKTRON MENYU (varaqlanadigan)
 * ------------------------------------------------------------
 * Stol ustidagi QR kod shu sahifani ochadi:
 *     menu.html?b=b1
 * `b` — filial id'si: «tugadi» belgilari o'sha filialniki.
 *
 * Tuzilishi menyu kitobiday: 1-sahifa muqova, keyin har bo'limga
 * bittadan to'liq ekran sahifa. Surib yoki chetiga bosib varaqlanadi.
 *
 * Menyu ilova bilan bitta manbadan olinadi (/api/menu), shuning uchun
 * admin panelda o'zgargan narx bu yerda ham darhol ko'rinadi.
 */
(function () {
  "use strict";

  var LS_LANG = "dondoner_lang";
  var params = new URLSearchParams(location.search);
  var branchId = params.get("b") || "";
  var lang = localStorage.getItem(LS_LANG) || "ru";

  var book = document.getElementById("mBook");
  var dotsEl = document.getElementById("mDots");
  var countEl = document.getElementById("mCount");
  var langBtn = document.getElementById("mLang");

  var pageCount = 0;

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

  /* ---- Menyu ma'lumoti ---- */

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

  // O'lchamlar har biri alohida qatorda: nomi chapda, narxi o'ngda
  function sizesHtml(item, cls) {
    var parts = (item.variants || [])
      .filter(function (v) {
        return Number(v.price) > 0;
      })
      .map(function (v) {
        return (
          '<span class="sz"><i>' + esc(v.label) + "</i><b>" +
          money(Number(v.price)) + "</b></span>"
        );
      });
    return parts.length ? '<div class="' + cls + '">' + parts.join("") + "</div>" : "";
  }

  /* ---- Sahifalar ---- */

  function coverPage() {
    var r = restaurant();
    var b = branch();
    var h = r.hours || {};

    var lines = [];
    if (b) {
      lines.push("<b>" + esc(b.label) + "</b> · " + esc(b.address));
      if (b.phone) lines.push(esc(b.phone));
    }
    if (h.open && h.close) lines.push(esc(h.open) + " – " + esc(h.close));

    var sec = document.createElement("section");
    sec.className = "pg cover";
    sec.innerHTML =
      '<img class="cover__logo" src="images/logo.jpg" alt="' + esc(r.name || "DonDöner") + '" />' +
      '<h1 class="cover__name">' + esc(r.name || "DonDöner") + "</h1>" +
      '<p class="cover__hi">' + esc(t("welcome")) + "</p>" +
      '<p class="cover__tag">' + esc(r.tagline || "") + "</p>" +
      '<div class="cover__hint">⇄ ' + esc(t("swipeHint")) + "</div>" +
      '<div class="cover__branch">' + lines.join("<br />") + "</div>";
    return sec;
  }

  function dishCard(item) {
    var out = isOut(item);
    var sized = item.variants && item.variants.length;
    var html =
      '<div class="dish__item' + (out ? " is-out" : "") + '">' +
      '<img class="dish__img" src="' + esc(item.image) + '" alt="' + esc(item.name) +
      '" loading="lazy" />' +
      '<div class="dish__name">' + esc(item.name) + "</div>";

    if (sized) {
      html += sizesHtml(item, "dish__sizes");
    } else {
      html += '<div class="dish__price">' + money(Number(item.price));
      if (item.oldPrice) {
        html += '<span class="dish__old">' + money(Number(item.oldPrice)) + "</span>";
      }
      html += "</div>";
    }
    if (out) html += '<span class="outmark">' + esc(t("outOfStock")) + "</span>";
    return html + "</div>";
  }

  function plainRow(item) {
    var out = isOut(item);
    var sized = item.variants && item.variants.length;
    var desc = item.desc || item.weight || "";

    var html =
      '<div class="plain__row' + (out ? " is-out" : "") + '">' +
      '<div class="plain__lead">' +
      '<div class="plain__name">' + esc(item.name) + "</div>";
    if (desc) html += '<div class="plain__desc">' + esc(desc) + "</div>";
    if (sized) html += sizesHtml(item, "plain__sizes");
    if (out) html += '<span class="outmark">' + esc(t("outOfStock")) + "</span>";
    html += "</div>";

    if (!sized) {
      html += '<div class="plain__price">' + money(Number(item.price)) + "</div>";
    }
    return html + "</div>";
  }

  function catPage(cat) {
    var items = readyItems(cat);
    var withImg = items.filter(function (it) {
      return !!it.image;
    });
    // Bo'limdagi taomlarning yarmidan ko'pi rasmli bo'lsa — rasmli tartib,
    // aks holda qog'oz menyudagidek nom/narx ro'yxati (bo'sh joy qolmasin)
    var visual = withImg.length >= Math.ceil(items.length / 2);

    var body;
    if (visual) {
      body =
        '<div class="dish">' +
        items
          .map(function (it) {
            return it.image ? dishCard(it) : "";
          })
          .join("") +
        "</div>";
      var noImg = items.filter(function (it) {
        return !it.image;
      });
      if (noImg.length) {
        body += '<div class="plain">' + noImg.map(plainRow).join("") + "</div>";
      }
    } else {
      body = '<div class="plain">' + items.map(plainRow).join("") + "</div>";
    }

    var sec = document.createElement("section");
    sec.className = "pg";
    sec.innerHTML =
      '<div class="pg__head">' +
      '<div class="pg__ribbon"><h2 class="pg__title">' + esc(cat.name || "") + "</h2></div>" +
      // Brend nomi matn ko'rinishida — logotip rasmi qora fonli bo'lgani
      // uchun bordo lentada qora quti bo'lib ajralib turadi
      '<div class="pg__mark">' + esc(restaurant().name || "DonDöner") + "</div>" +
      "</div>" +
      '<div class="pg__rule"></div>' +
      '<div class="pg__body">' + body + "</div>" +
      '<div class="pg__foot">' + esc(t("photoNote")) + "</div>";
    return sec;
  }

  /* ---- Varaqlash ---- */

  function goTo(i) {
    i = Math.max(0, Math.min(pageCount - 1, i));
    book.scrollTo({ left: i * book.clientWidth, behavior: "smooth" });
  }

  function currentPage() {
    return Math.round(book.scrollLeft / Math.max(1, book.clientWidth));
  }

  function paintPosition() {
    var i = currentPage();
    countEl.textContent = i + 1 + " / " + pageCount;
    var dots = dotsEl.children;
    for (var k = 0; k < dots.length; k++) {
      dots[k].classList.toggle("is-on", k === i);
    }
  }

  function setupTaps() {
    [["prev", -1], ["next", 1]].forEach(function (pair) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tapzone tapzone--" + pair[0];
      btn.setAttribute("aria-label", pair[0]);
      btn.addEventListener("click", function () {
        goTo(currentPage() + pair[1]);
      });
      document.body.appendChild(btn);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") goTo(currentPage() + 1);
      if (e.key === "ArrowLeft") goTo(currentPage() - 1);
    });
  }

  /* ---- Chizish ---- */

  function render() {
    document.documentElement.lang = lang;
    langBtn.textContent = lang === "ru" ? "UZ" : "RU";

    var cats = (window.MENU.categories || []).filter(function (c) {
      return readyItems(c).length > 0;
    });

    book.innerHTML = "";
    book.appendChild(coverPage());
    cats.forEach(function (cat) {
      book.appendChild(catPage(cat));
    });

    pageCount = cats.length + 1;
    dotsEl.innerHTML = "";
    for (var i = 0; i < pageCount; i++) dotsEl.appendChild(document.createElement("i"));

    book.scrollTo({ left: 0 });
    paintPosition();
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
      book.innerHTML = '<section class="pg cover"><p class="cover__hi">Menyu topilmadi</p></section>';
      return;
    }
    render();
    setupTaps();

    var ticking = false;
    book.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          paintPosition();
        });
      },
      { passive: true }
    );

    langBtn.addEventListener("click", function () {
      var at = currentPage();
      lang = lang === "ru" ? "uz" : "ru";
      try {
        localStorage.setItem(LS_LANG, lang);
      } catch (e) {}
      render();
      // Til almashgach o'sha sahifada qolamiz
      book.scrollTo({ left: at * book.clientWidth });
      paintPosition();
    });

    // Ekran burilganda sahifa chetiga tekislanib qolsin
    window.addEventListener("resize", function () {
      goTo(currentPage());
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadMenu(start);
  });
})();
