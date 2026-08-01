/*
 * Qandil restaurant — ELEKTRON MENYU
 * ------------------------------------------------------------
 * Har bo'lim — bitta to'liq sahifa plakat. Taom nomi va narxi
 * suratning o'zida yozilgan, shuning uchun bu yerda ro'yxat ham,
 * kartochka ham chizilmaydi: sahifa faqat suratni ko'rsatadi.
 *
 * Chapga/o'ngga surib yoki ekran chetiga bosib varaqlanadi.
 * Suratni ikki marta bosib kattalashtirish mumkin.
 */
(function () {
  "use strict";

  var book = document.getElementById("qBook");
  var dotsEl = document.getElementById("qDots");
  var countEl = document.getElementById("qCount");

  var pageCount = 0;

  function esc(str) {
    return String(str === undefined || str === null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var R = (window.QANDIL && window.QANDIL.restaurant) || {};

  /* ---- Sahifalar ---- */

  function coverPage(isEnd) {
    var sec = document.createElement("section");
    sec.className = "pg cover";
    sec.innerHTML =
      '<div class="cover__inner">' +
      '<img class="cover__logo" src="images/qandil-logo.png" alt="' +
      esc(R.name || "Qandil") + '" />' +
      '<div class="orn"><i></i><b>❧</b><i></i></div>' +
      '<p class="cover__hi">' +
      (isEnd ? "Приятного аппетита!" : "Добро пожаловать!") + "</p>" +
      '<p class="cover__tag">' +
      esc(isEnd ? "Спасибо, что выбрали нас" : R.tagline || "") + "</p>" +
      (isEnd
        ? ""
        : '<div class="cover__hint">⇄ Нажмите или проведите, чтобы листать</div>') +
      (R.instagram
        ? '<a class="cover__ig" href="https://instagram.com/' + esc(R.instagram) +
          '" target="_blank" rel="noopener">@' + esc(R.instagram) + "</a>"
        : "") +
      "</div>";
    return sec;
  }

  function menuPage(page) {
    var sec = document.createElement("section");
    sec.className = "pg";
    sec.innerHTML =
      '<div class="sheet__head">' +
      '<img class="sheet__logo" src="images/qandil-logo.png" alt="" />' +
      '<h2 class="sheet__title">' + esc(page.title || "") + "</h2>" +
      "</div>" +
      '<div class="sheet__body">' +
      '<img class="sheet__img" src="' + esc(page.image) + '" alt="' +
      esc(page.title || "") + '" loading="lazy" />' +
      "</div>" +
      // Narxlar suratda kichik — kattalashtirish mumkinligini aytamiz
      '<div class="sheet__foot">Нажмите на фото, чтобы увеличить</div>';
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

  /* Suratni bosib kattalashtirish — narxni yaqindan ko'rish uchun */
  function setupZoom() {
    var box = document.getElementById("qZoom");
    var img = document.getElementById("qZoomImg");
    book.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.classList.contains("sheet__img")) return;
      img.src = t.src;
      box.hidden = false;
    });
    box.addEventListener("click", function () {
      box.hidden = true;
      img.src = "";
    });
  }

  /* ---- Chizish ---- */

  function render() {
    var pages = window.QANDIL.pages || [];

    book.innerHTML = "";
    book.appendChild(coverPage(false));
    pages.forEach(function (p) {
      book.appendChild(menuPage(p));
    });
    book.appendChild(coverPage(true));

    pageCount = pages.length + 2;
    dotsEl.innerHTML = "";
    for (var i = 0; i < pageCount; i++) dotsEl.appendChild(document.createElement("i"));

    book.scrollTo({ left: 0 });
    paintPosition();
  }

  function start() {
    if (!window.QANDIL) {
      book.innerHTML =
        '<section class="pg cover"><p class="cover__hi">Меню недоступно</p></section>';
      return;
    }
    render();
    setupTaps();
    setupZoom();

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

    window.addEventListener("resize", function () {
      goTo(currentPage());
    });
  }

  document.addEventListener("DOMContentLoaded", start);
})();
