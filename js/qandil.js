/*
 * Qandil restaurant — ELEKTRON MENYU
 * ------------------------------------------------------------
 * Stol ustidagi QR kod shu sahifani ochadi: qandil.html
 *
 * DonDöner menyusi bilan bir xil varaqlanadigan tuzilish, lekin
 * har taomning surati bor va brend ranglari yashil.
 *
 * Menyu ma'lumoti data/qandil.js faylida — bu restoran admin
 * panelga ulanmagan, shuning uchun serverga so'rov yuborilmaydi.
 */
(function () {
  "use strict";

  var LS_LANG = "qandil_lang";
  var lang = localStorage.getItem(LS_LANG) || "ru";

  var book = document.getElementById("qBook");
  var dotsEl = document.getElementById("qDots");
  var countEl = document.getElementById("qCount");
  var langBtn = document.getElementById("qLang");

  var pageCount = 0;

  var TEXT = {
    ru: {
      welcome: "Добро пожаловать!",
      swipeHint: "Нажмите или проведите, чтобы листать",
      pricesIn: "Цены указаны в сумах",
      bonAppetit: "Приятного аппетита!",
      thanks: "Спасибо, что выбрали нас",
      soon: "Фото скоро",
    },
    uz: {
      welcome: "Xush kelibsiz!",
      swipeHint: "Varaqlash uchun bosing yoki suring",
      pricesIn: "Narxlar so'mda",
      bonAppetit: "Yoqimli ishtaha!",
      thanks: "Bizni tanlaganingiz uchun rahmat",
      soon: "Surat tez orada",
    },
  };

  function t(key) {
    return (TEXT[lang] || TEXT.ru)[key] || key;
  }

  function esc(str) {
    return String(str === undefined || str === null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Menyuda valyuta har narxda takrorlanmaydi — sahifa boshida bir marta
  function num(v) {
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  var R = (window.QANDIL && window.QANDIL.restaurant) || {};

  // Ruscha va o'zbekcha nomlar bitta obyektda — tanlangan tilga qarab olamiz
  function pick(obj, key) {
    if (lang === "uz") {
      var uz = obj[key + "Uz"];
      if (uz) return uz;
    }
    return obj[key] || "";
  }

  /* ---- Sahifalar ---- */

  function coverPage(isEnd) {
    var sec = document.createElement("section");
    sec.className = "pg cover";
    sec.innerHTML =
      '<div class="cover__inner">' +
      '<img class="cover__logo' + (isEnd ? " cover__logo--sm" : "") +
      '" src="images/qandil-logo.png" alt="' + esc(R.name || "Qandil") + '" />' +
      '<div class="orn"><i></i><b>❧</b><i></i></div>' +
      '<p class="cover__hi">' + esc(t(isEnd ? "bonAppetit" : "welcome")) + "</p>" +
      '<p class="cover__tag">' +
      esc(isEnd ? t("thanks") : pick(R, "tagline")) + "</p>" +
      (isEnd
        ? ""
        : '<div class="cover__hint">⇄ ' + esc(t("swipeHint")) + "</div>") +
      (R.instagram
        ? '<a class="cover__ig" href="https://instagram.com/' + esc(R.instagram) +
          '" target="_blank" rel="noopener">@' + esc(R.instagram) + "</a>"
        : "") +
      "</div>";
    return sec;
  }

  function sizesHtml(item) {
    var parts = (item.variants || [])
      .filter(function (v) {
        return Number(v.price) > 0;
      })
      .map(function (v) {
        return (
          '<span class="sz"><i>' + esc(pick(v, "label")) + "</i>" +
          '<span class="lead"></span><b>' + num(Number(v.price)) + "</b></span>"
        );
      });
    return parts.length ? '<div class="dish__sizes">' + parts.join("") + "</div>" : "";
  }

  function dishCard(item) {
    var name = pick(item, "name");
    var media = item.image
      ? '<img class="dish__img" src="' + esc(item.image) + '" alt="' + esc(name) +
        '" loading="lazy" />'
      : '<div class="dish__ph">' + esc(t("soon")) + "</div>";

    var price = item.variants && item.variants.length
      ? sizesHtml(item)
      : '<div class="dish__price">' + num(Number(item.price)) + "</div>";

    return (
      '<div class="dish">' + media +
      '<div class="dish__name">' + esc(name) + "</div>" + price +
      "</div>"
    );
  }

  function catPage(cat) {
    var sec = document.createElement("section");
    sec.className = "pg";
    sec.innerHTML =
      '<div class="pg__head">' +
      '<div class="pg__ribbon"><h2 class="pg__title">' +
      esc(pick(cat, "name")) + "</h2></div>" +
      '<div class="pg__mark"><img src="images/qandil-logo.png" alt="" /></div>' +
      "</div>" +
      '<div class="pg__rule"></div>' +
      '<div class="pg__body">' +
      '<div class="sheetnote">' + esc(t("pricesIn")) + "</div>" +
      '<div class="dishes">' + (cat.items || []).map(dishCard).join("") + "</div>" +
      "</div>" +
      '<div class="pg__foot">' + esc(R.name || "Qandil") + " · " +
      esc(pick(R, "tagline")) + "</div>";
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

    var cats = (window.QANDIL.categories || []).filter(function (c) {
      return (c.items || []).length > 0;
    });

    book.innerHTML = "";
    book.appendChild(coverPage(false));
    cats.forEach(function (cat) {
      book.appendChild(catPage(cat));
    });
    book.appendChild(coverPage(true));

    pageCount = cats.length + 2;
    dotsEl.innerHTML = "";
    for (var i = 0; i < pageCount; i++) dotsEl.appendChild(document.createElement("i"));

    book.scrollTo({ left: 0 });
    paintPosition();
  }

  function start() {
    if (!window.QANDIL) {
      book.innerHTML = '<section class="pg cover"><p class="cover__hi">Меню недоступно</p></section>';
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
      book.scrollTo({ left: at * book.clientWidth });
      paintPosition();
    });

    window.addEventListener("resize", function () {
      goTo(currentPage());
    });
  }

  document.addEventListener("DOMContentLoaded", start);
})();
