/* =============================================================
   Оксана Олеговна — движение на первом экране и общие мелочи.

   Без библиотек, как на agent-ai.fun: всё укладывается в несколько
   килобайт и не мешает странице открываться на мобильном интернете,
   а родители читают её именно так — с телефона, между делами.
   ============================================================= */
(function () {
  "use strict";

  // Высота окна бывает нулевой: страница ещё не разложена, вкладка
  // в фоне, окно свёрнуто. С нулём все проверки видимости молча
  // перестают срабатывать, и половина страницы остаётся невидимой.
  function vh() {
    return innerHeight || document.documentElement.clientHeight || 800;
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  var root = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = matchMedia("(hover: none)").matches;
  var draft = root.classList.contains("draft");

  // Общее для sections.js — чтобы не держать две копии одних и тех же функций
  var OO = window.OO = { vh: vh, clamp01: clamp01, reduced: reduced, touch: touch, draft: draft };

  // ── Счёт числа ──────────────────────────────────────────────
  // С замедлением к концу: глаз успевает поймать итоговое число.
  // Страховка таймером обязательна: requestAnimationFrame в фоновой
  // вкладке придерживается, и число застряло бы на полпути.
  OO.countTo = function (el, from, to, dur, fmt) {
    fmt = fmt || String;
    var id = (el._cnt || 0) + 1;
    el._cnt = id;
    if (reduced) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function step(t) {
      if (el._cnt !== id) return;
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
    setTimeout(function () { if (el._cnt === id) el.textContent = fmt(to); }, dur + 90);
  };

  // ── Всплывающее сообщение ───────────────────────────────────
  var toastEl = document.querySelector(".toast"), toastT = 0;
  OO.toast = function (text, ms) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add("in");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("in"); }, ms || 3400);
  };

  // ── Замок прокрутки под окнами ──────────────────────────────
  // Ширину полосы прокрутки возвращаем отступом, иначе страница
  // под окном дёргается вбок в момент открытия.
  var locks = 0;
  OO.lock = function (on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    if (locks) {
      var sw = innerWidth - root.clientWidth;
      root.style.overflow = "hidden";
      document.body.style.paddingRight = sw > 0 ? sw + "px" : "";
    } else {
      root.style.overflow = "";
      document.body.style.paddingRight = "";
    }
  };

  // ── Появление при прокрутке ─────────────────────────────────
  // Считаем по координатам, а не наблюдателем: IntersectionObserver
  // в части окружений молчит (например, когда страница считается
  // скрытой), и тогда половина страницы остаётся невидимой.
  var pending = [].slice.call(document.querySelectorAll(".up, .stagger"));

  // Во вкладке, которую не видно, браузер не проигрывает переходы, и
  // блок может навсегда застрять полупрозрачным. Такой блок ставим в
  // конечный вид без анимации и через два кадра возвращаем переходы —
  // значение уже конечное, второй раз ничего не поедет.
  function settle(el) {
    el.classList.add("inst");
    void el.offsetWidth;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.remove("inst"); });
    });
  }

  function show(node, delay) {
    if (document.hidden) { node.classList.add("in"); settle(node); return; }
    if (delay) setTimeout(function () { node.classList.add("in"); }, delay * 1000);
    else node.classList.add("in");
  }

  function reveal() {
    var line = vh() * .92;
    for (var i = pending.length - 1; i >= 0; i--) {
      var el = pending[i];
      if (el.getBoundingClientRect().top > line) continue;
      show(el, parseFloat(el.dataset.delay || 0));
      pending.splice(i, 1);
    }
  }
  OO.reveal = reveal;

  // ── Заголовок по словам ─────────────────────────────────────
  // Разбиваем в скрипте, а не руками в разметке: так заголовок
  // остаётся цельным текстом для поиска и для чтения с экрана.
  document.querySelectorAll("[data-words]").forEach(function (host) {
    host.setAttribute("aria-label", host.textContent.replace(/\s+/g, " ").trim());
    var lines = host.innerHTML.split(/<br\s*\/?>/i);
    host.innerHTML = "";
    var idx = 0;
    lines.forEach(function (line) {
      var wrapLine = document.createElement("span");
      wrapLine.className = "reveal";
      wrapLine.setAttribute("aria-hidden", "true");
      line.trim().split(/\s+/).forEach(function (w, i, arr) {
        var s = document.createElement("span");
        s.innerHTML = w + (i < arr.length - 1 ? "&nbsp;" : "");
        s.style.transitionDelay = (idx * 0.075) + "s";
        wrapLine.appendChild(s);
        idx++;
      });
      host.appendChild(wrapLine);
    });
    var parts = host.querySelectorAll(".reveal");
    if (document.hidden) {
      parts.forEach(function (r) { r.classList.add("in"); settle(r); });
      return;
    }
    // Первый экран показываем сразу, без ожидания прокрутки
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        parts.forEach(function (r) { r.classList.add("in"); });
      });
    });
  });

  // ── Шапка ───────────────────────────────────────────────────
  var nav = document.querySelector(".nav");
  if (nav) setTimeout(function () {
    nav.classList.add("in");
    if (document.hidden) settle(nav);
  }, 220);

  // Пункт меню подчёркнут, пока на экране его раздел
  var links = [].slice.call(document.querySelectorAll(".nav-menu a"));
  var marks = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
  function markNav() {
    var mid = vh() * .38, cur = -1;
    for (var i = 0; i < marks.length; i++) {
      if (!marks[i]) continue;
      var r = marks[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) cur = i;
    }
    for (var k = 0; k < links.length; k++) links[k].classList.toggle("on", k === cur);
  }

  // ── Нижнее меню на телефоне ─────────────────────────────────
  // Пункт подсвечивается, пока на экране его раздел; «Обо мне» держится
  // и на наградах, «Отзывы» — и на историях учеников. Подложка едет к
  // активному пункту. Пока открыта клавиатура, меню прячется.
  var tabbar = document.querySelector(".tabbar");
  var tabs = tabbar ? [].slice.call(tabbar.querySelectorAll(".tab")) : [];
  var tabZones = { about: ["about", "path", "awards", "publications"], reviews: ["cases", "reviews"], trial: ["trial"], price: ["price"] };
  var tabCur = null;
  function paintTabs() {
    if (!tabbar) return;
    var mid = vh() * .45, found = null;
    Object.keys(tabZones).forEach(function (key) {
      tabZones[key].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) found = key;
      });
    });
    if (found === tabCur) return;
    tabCur = found;
    tabs.forEach(function (t, i) {
      var on = t.dataset.tab === found;
      t.classList.toggle("on", on);
      if (on) tabbar.style.setProperty("--ti", i);
    });
    tabbar.classList.toggle("has-on", !!found);
  }
  if (tabbar) {
    setTimeout(function () {
      tabbar.classList.add("in");
      if (document.hidden) settle(tabbar);
    }, 700);
    document.addEventListener("focusin", function (e) {
      if (e.target.matches("input, textarea, select")) tabbar.classList.add("kb");
    });
    document.addEventListener("focusout", function (e) {
      if (e.target.matches("input, textarea, select")) tabbar.classList.remove("kb");
    });
  }

  // Всё, что зависит от положения, считаем сразу, без откладывания на
  // кадр: флаг «кадр уже запрошен» в фоновой вкладке залипает, и меню
  // переставало подсвечивать разделы. Проверки дешёвые — пара прямоугольников.
  function onScroll() {
    reveal();
    markNav();
    paintTabs();
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      document.querySelectorAll(".up.in, .stagger.in, .reveal.in, .nav.in, .tabbar.in").forEach(settle);
    }
    reveal(); markNav(); paintTabs();
  });
  // При обновлении страницы браузер возвращает прежнюю позицию прокрутки
  // уже после запуска скриптов и не шлёт при этом событий.
  addEventListener("load", onScroll);
  setTimeout(onScroll, 200);
  setTimeout(onScroll, 800);
  reveal();

  // ── Магнитные кнопки ────────────────────────────────────────
  // Кнопка тянется к курсору в пределах своей рамки и мягко
  // возвращается. На тач-устройствах выключено: курсора там нет.
  if (!touch && !reduced) {
    document.querySelectorAll(".btn").forEach(function (btn) {
      var raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
      function loop() {
        cx += (tx - cx) * .16;
        cy += (ty - cy) * .16;
        btn.style.transform = "translate(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px)";
        if (Math.abs(tx - cx) > .1 || Math.abs(ty - cy) > .1) raf = requestAnimationFrame(loop);
        else { raf = 0; if (!tx && !ty) btn.style.transform = ""; }
      }
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var px = e.clientX - r.left, py = e.clientY - r.top;
        btn.style.setProperty("--mx", px + "px");
        btn.style.setProperty("--my", py + "px");
        tx = (px - r.width / 2) * .2;
        ty = (py - r.height / 2) * .3;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      btn.addEventListener("pointerleave", function () {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(loop);
      });
    });
  }

  // ── Пятно за курсором ───────────────────────────────────────
  // Цикл крутится, только пока пятно догоняет курсор: неподвижная
  // мышь не должна тратить кадры.
  var spot = document.getElementById("spot");
  if (spot && !touch && !reduced) {
    var sx = innerWidth / 2, sy = vh() / 2, gx = sx, gy = sy, sraf = 0;
    function spotLoop() {
      sx += (gx - sx) * .08;
      sy += (gy - sy) * .08;
      spot.style.transform = "translate(" + (sx - 230).toFixed(1) + "px," + (sy - 230).toFixed(1) + "px)";
      sraf = (Math.abs(gx - sx) > .3 || Math.abs(gy - sy) > .3) ? requestAnimationFrame(spotLoop) : 0;
    }
    addEventListener("pointermove", function (e) {
      gx = e.clientX; gy = e.clientY;
      spot.style.opacity = "1";
      if (!sraf) sraf = requestAnimationFrame(spotLoop);
    }, { passive: true });
  }

  // ── Наклон портрета ─────────────────────────────────────────
  // Небольшой поворот вслед за курсором. Плашки стоят глубже фото
  // (translateZ), поэтому при наклоне смещаются сильнее — появляется
  // объём, а не просто поворот картинки.
  var por = document.querySelector(".por");
  if (por && !touch && !reduced) {
    var stage = por.closest(".por-stage");
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      var dx = (e.clientX - r.left - r.width / 2) / r.width;
      var dy = (e.clientY - r.top - r.height / 2) / r.height;
      por.style.transform =
        "rotateY(" + (dx * 11).toFixed(2) + "deg) rotateX(" + (-dy * 8).toFixed(2) + "deg)";
    });
    stage.addEventListener("pointerleave", function () { por.style.transform = ""; });
  }

  // ── Счётчики ────────────────────────────────────────────────
  // Цифра, которая просто стоит, не читается как достижение.
  // В разметке лежит итоговое число — без скрипта человек видит его.
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var target = parseFloat(el.dataset.count);
    var suf = el.dataset.suffix || "";
    var fmt = function (v) { return v + suf; };
    if (reduced || target === 0) return;
    el.textContent = fmt(0);
    var done = false;
    function maybeCount() {
      if (done) return;
      var r = el.getBoundingClientRect();
      if (r.top > vh() * .9 || r.bottom < 0) return;
      done = true;
      removeEventListener("scroll", maybeCount);
      OO.countTo(el, 0, target, 1500, fmt);
    }
    addEventListener("scroll", maybeCount, { passive: true });
    addEventListener("load", maybeCount);
    setTimeout(maybeCount, 200);
    setTimeout(maybeCount, 800);
    maybeCount();
  });

  // ── Контакты ────────────────────────────────────────────────
  // Все ссылки на мессенджеры собираются из window.CONTACTS в index.html.
  var C = window.CONTACTS || {};
  OO.contactHref = function (kind) {
    var v = String(C[kind] || "").trim();
    if (!v) return "";
    if (kind === "telegram") return "https://t.me/" + v.replace(/^@/, "");
    if (kind === "whatsapp") return "https://wa.me/" + v.replace(/\D/g, "");
    if (kind === "phone") return "tel:+" + v.replace(/\D/g, "");
    return v;
  };
  OO.noContact = function () {
    OO.toast(draft
      ? "Контакт ещё не вписан: заполните window.CONTACTS в конце index.html"
      : "Контакт скоро появится. Пока можно оставить заявку ниже.");
  };
  document.querySelectorAll("[data-contact]").forEach(function (a) {
    var kind = a.dataset.contact, href = OO.contactHref(kind);
    if (href) {
      a.href = href;
      if (kind !== "phone") { a.target = "_blank"; a.rel = "noopener"; }
    } else {
      a.addEventListener("click", function (e) { e.preventDefault(); OO.noContact(); });
    }
  });

  // ── Окно «Задать вопрос» ────────────────────────────────────
  var ask = document.querySelector(".ask"), askFrom = null, askT = 0;
  function openAsk() {
    if (!ask) return;
    clearTimeout(askT);
    askFrom = document.activeElement;
    ask.hidden = false;
    OO.lock(true);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ask.classList.add("open"); });
    });
    var first = ask.querySelector(".ask-a");
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 80);
  }
  function closeAsk() {
    if (!ask || ask.hidden || !ask.classList.contains("open")) return;
    ask.classList.remove("open");
    OO.lock(false);
    askT = setTimeout(function () { ask.hidden = true; }, 480);
    if (askFrom && askFrom.focus) askFrom.focus({ preventScroll: true });
  }
  document.querySelectorAll("[data-ask]").forEach(function (b) { b.addEventListener("click", openAsk); });
  if (ask) {
    ask.querySelectorAll("[data-ask-close]").forEach(function (b) { b.addEventListener("click", closeAsk); });
    ask.querySelectorAll(".ask-a").forEach(function (a) {
      a.addEventListener("click", function () { if (OO.contactHref(a.dataset.contact)) closeAsk(); });
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAsk(); });
})();

/* =============================================================
   Фон первого экрана.

   Дорого выглядит не предмет, а свет. Поэтому здесь мягкие
   перетекающие пятна: границы размыты настолько, что глаз читает
   их как подсветку страницы, а не как объекты. Поверх — едва
   заметная зернистость: ровная заливка выдаёт дешёвый градиент.
   ============================================================= */
(function () {
  "use strict";

  var host = document.getElementById("goo");
  if (!host) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cv = document.createElement("canvas");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  host.appendChild(cv);

  var ctx = cv.getContext("2d");
  var DPR = Math.min(devicePixelRatio || 1, 1.5);   // это фон, ретина ни к чему
  var W = 0, H = 0, vis = true, inView = true;

  /* Синий держит основу, лайм появляется одним пятном, глубокий
     индиго даёт остальным дно. */
  var SPOTS = [
    { c: "59,73,223",   a: .28, x: .72, y: .26, r: .30, sx: .000041, sy: .000034 },
    { c: "108,121,255", a: .24, x: .88, y: .55, r: .26, sx: .000033, sy: .000045 },
    { c: "201,242,77",  a: .24, x: .74, y: .80, r: .22, sx: .000047, sy: .000029 },
    { c: "42,53,184",   a: .18, x: .62, y: .62, r: .24, sx: .000028, sy: .000039 },
    { c: "140,152,255", a: .16, x: .95, y: .16, r: .18, sx: .000052, sy: .000036 }
  ];
  SPOTS.forEach(function (s) { s.px = Math.random() * 6.28; s.py = Math.random() * 6.28; });

  // Шум рисуем один раз в отдельный холст: генерировать его
  // каждый кадр незачем, а разница незаметна.
  var grain = document.createElement("canvas");
  grain.width = grain.height = 140;
  (function () {
    var g = grain.getContext("2d");
    var img = g.createImageData(140, 140);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 128 + (Math.random() - .5) * 42;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 12;
    }
    g.putImageData(img, 0, 0);
  })();
  var pattern = null;

  function size() {
    var r = host.getBoundingClientRect();
    if (r.width < 10) return;
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    pattern = ctx.createPattern(grain, "repeat");
  }
  addEventListener("resize", size, { passive: true });
  document.addEventListener("visibilitychange", function () { vis = !document.hidden; });
  // Первый экран ушёл из вида — фон не рисуем, батарея важнее
  addEventListener("scroll", function () {
    inView = host.getBoundingClientRect().bottom > 0;
  }, { passive: true });
  size();

  // Курсор чуть тянет пятна за собой. Так слабо, что этого не
  // замечают — но страница перестаёт быть картинкой.
  var mx = .5, my = .5, tmx = .5, tmy = .5;
  addEventListener("pointermove", function (e) {
    var r = host.getBoundingClientRect();
    tmx = (e.clientX - r.left) / (r.width || 1);
    tmy = (e.clientY - r.top) / (r.height || 1);
  }, { passive: true });

  (function tick(t) {
    requestAnimationFrame(tick);
    if (!vis || !inView) return;
    if (!W) { size(); return; }

    mx += (tmx - mx) * .03;
    my += (tmy - my) * .03;

    ctx.clearRect(0, 0, W, H);
    var side = Math.max(W, H);

    for (var i = 0; i < SPOTS.length; i++) {
      var s = SPOTS[i];
      var x = (s.x + Math.sin(t * s.sx + s.px) * .09 + (mx - .5) * .05) * W;
      var y = (s.y + Math.cos(t * s.sy + s.py) * .10 + (my - .5) * .04) * H;
      var r = s.r * side * (1 + Math.sin(t * s.sx * 1.7 + s.py) * .12);

      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(" + s.c + "," + s.a + ")");
      g.addColorStop(.45, "rgba(" + s.c + "," + (s.a * .45).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + s.c + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    }

    if (pattern) {
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
  })(0);
})();
