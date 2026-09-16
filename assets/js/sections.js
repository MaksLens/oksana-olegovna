/* =============================================================
   Движение в секциях: колода ситуаций и её живые иллюстрации,
   «было / стало», урок по минутам, галерея, документы, истории
   учеников, цены, заявка, вопросы.

   Всё считается по координатам на прокрутке, как на agent-ai.fun:
   наблюдатель за пересечением в части окружений молчит, и секции
   остаются мёртвыми. Ни одного флага «уже запланировано» — в
   фоновой вкладке такой флаг залипает навсегда.
   ============================================================= */
(function () {
  "use strict";

  var OO = window.OO;
  if (!OO) return;
  var vh = OO.vh, clamp01 = OO.clamp01, reduced = OO.reduced;

  // Проверка «видно ли блок» на все случаи: прокрутка, смена размера,
  // возврат во вкладку, догрузка страницы.
  function watch(fn) {
    addEventListener("scroll", fn, { passive: true });
    addEventListener("resize", fn, { passive: true });
    document.addEventListener("visibilitychange", fn);
    addEventListener("load", fn);
    setTimeout(fn, 250);
    setTimeout(fn, 900);
    fn();
  }

  // Анимация, которая крутится по кругу, только пока блок на экране:
  // человек должен увидеть её с начала, а не с середины.
  function whileVisible(el, start, stop) {
    var on = false;
    watch(function () {
      var r = el.getBoundingClientRect();
      var v = !document.hidden && r.height > 0 && r.top < vh() * .9 && r.bottom > vh() * .1;
      if (v && !on) { on = true; start(); }
      else if (!v && on) { on = false; stop(); }
    });
  }

  // Набор таймеров, которые можно сбросить разом
  function timers() {
    var list = [];
    return {
      add: function (fn, ms) { list.push(setTimeout(fn, ms)); },
      clear: function () { list.forEach(clearTimeout); list = []; }
    };
  }

  // Автопрокрутка по таймеру. Время копится только пока блок на экране,
  // вкладка видна и человек ничего не трогает: под курсором, под пальцем
  // и при открытом просмотре таймер стоит, а не сгорает. Ручное листание
  // начинает отсчёт заново — нельзя перелистнуть кадр, который человек
  // только что выбрал сам.
  function autoplay(o) {
    var acc = 0, last = 0, raf = 0, hold = 0, on = false, blocked = false;
    function loop(now) {
      raf = 0;
      if (!on || document.hidden) return;
      var dt = last ? Math.min(100, now - last) : 0;
      last = now;
      var b = o.blocked() || now < hold;
      if (b !== blocked) { blocked = b; o.root.classList.toggle("paused", b); }
      if (!b) {
        acc += dt;
        var p = Math.min(1, acc / o.dur);
        if (o.tick) o.tick(p);
        if (p >= 1) { acc = 0; o.end(); }
      }
      raf = requestAnimationFrame(loop);
    }
    watch(function () {
      var r = o.root.getBoundingClientRect();
      var v = !document.hidden && r.height > 0 && r.top < vh() * .85 && r.bottom > vh() * .15;
      if (v && !on) { on = true; last = 0; if (!raf) raf = requestAnimationFrame(loop); }
      else if (!v && on) { on = false; }
    });
    return {
      reset: function () { acc = 0; if (o.tick) o.tick(0); },
      hold: function (ms) { hold = performance.now() + ms; }
    };
  }

  // ── Колода ситуаций ─────────────────────────────────────────
  // Липкое позиционирование делает браузер, а мы добавляем то, чего
  // ему не хватает: нижняя карточка уменьшается и тускнеет, когда на
  // неё наезжает следующая. Без этого стопка — просто прямоугольники.
  var cards = [].slice.call(document.querySelectorAll(".card-s"));
  if (cards.length && !reduced) {
    var ticking = false;
    var paintStack = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        for (var i = 0; i < cards.length; i++) {
          var inner = cards[i].querySelector(".card-in");
          var art = cards[i].querySelector(".card-art");
          // Снимок идёт медленнее карточки: сдвиг от положения её центра в окне
          if (art) {
            var ar = art.getBoundingClientRect();
            var c = (ar.top + ar.height / 2 - vh() / 2) / vh();
            art.style.setProperty("--py", Math.max(-30, Math.min(30, -c * 26)).toFixed(1));
          }
          var next = cards[i + 1];
          if (!next) {
            inner.style.transform = ""; inner.style.filter = "";
            if (art) art.style.setProperty("--k", "0");
            continue;
          }
          var r = next.getBoundingClientRect();
          var stickTop = cards[i].getBoundingClientRect().top;
          var overlap = clamp01((vh() - r.top) / (vh() - stickTop + 1));
          var k = overlap * overlap;
          inner.style.transform = "scale(" + (1 - k * .055).toFixed(4) + ")";
          inner.style.filter = "brightness(" + (1 - k * .05).toFixed(3) + ")";
          // Накрытую карточку снимок провожает: приближается и темнеет
          if (art) art.style.setProperty("--k", k.toFixed(3));
        }
      });
    };
    watch(paintStack);
  }

  // ── Табло цифр ──────────────────────────────────────────────
  // Каждая цифра — столбик 0…9, который едет к нужному значению.
  // Лишние старшие разряды не пропадают рывком, а схлопываются.
  function makeOdo(el, cols) {
    el.textContent = "";
    el._d = [];
    for (var c = 0; c < cols; c++) {
      var d = document.createElement("span");
      d.className = "dg";
      d.style.setProperty("--k", c);
      var u = document.createElement("u");
      for (var k = 0; k < 10; k++) {
        var i = document.createElement("i");
        i.textContent = k;
        u.appendChild(i);
      }
      d.appendChild(u);
      el.appendChild(d);
      el._d.push(d);
    }
  }
  function setOdo(el, value) {
    var s = String(value);
    while (s.length < el._d.length) s = " " + s;
    for (var c = 0; c < el._d.length; c++) {
      var d = el._d[c];
      if (s[c] === " ") d.classList.add("off");
      else { d.classList.remove("off"); d.firstChild.style.setProperty("--n", s[c]); }
    }
  }

  // Даты для первой карточки. Все проверены: ошибка в дате на сайте
  // учителя истории стоила бы дороже, чем вся анимация.
  var EVENTS = [
    [862,  "Призвание варягов"],
    [988,  "Крещение Руси"],
    [1240, "Невская битва"],
    [1380, "Куликовская битва"],
    [1480, "Стояние на реке Угре"],
    [1613, "Начало династии Романовых"],
    [1703, "Основание Петербурга"],
    [1812, "Отечественная война"],
    [1861, "Отмена крепостного права"],
    [1945, "Победа в Великой Отечественной"],
    [1961, "Полёт Гагарина"]
  ];

  var dates = document.querySelector(".art-dates");
  if (dates) {
    var yr = dates.querySelector(".yr");
    var ev = dates.querySelector(".yr-ev");
    var dotsBox = dates.querySelector(".yr-dots");
    var di = 1;
    var datesPhoto = dates.querySelector(".art-photo");
    // Снимок широкий: каждая дата сдвигает кадр вдоль него, как по ленте
    // времени. После 1961 года кадр отматывается к началу вместе с табло.
    var panTo = function () {
      if (datesPhoto) datesPhoto.style.setProperty("--ox", (di / (EVENTS.length - 1) * 100).toFixed(1) + "%");
    };
    panTo();
    makeOdo(yr, 4);
    setOdo(yr, EVENTS[di][0]);
    ev.textContent = EVENTS[di][1];
    EVENTS.forEach(function () { dotsBox.appendChild(document.createElement("i")); });
    var paintDots = function () {
      for (var i = 0; i < dotsBox.children.length; i++) dotsBox.children[i].classList.toggle("on", i === di);
    };
    paintDots();

    if (!reduced) {
      var dT = timers();
      var stepDates = function () {
        di = (di + 1) % EVENTS.length;
        ev.classList.add("out");
        setOdo(yr, EVENTS[di][0]);
        paintDots();
        panTo();
        dT.add(function () { ev.textContent = EVENTS[di][1]; ev.classList.remove("out"); }, 420);
        dT.add(stepDates, 2700);
      };
      whileVisible(dates, function () { dT.add(stepDates, 1100); }, dT.clear);
    }
  }

  // ── Шкала «+15 за месяц» ────────────────────────────────────
  var score = document.querySelector(".art-score");
  if (score) {
    var was = score.querySelector(".ring-was");
    var add = score.querySelector(".ring-add");
    var sNum = score.querySelector(".ring-num b");
    var sLab = score.querySelector(".ring-num span");
    var START = 42, PLUS = 15;
    var scorePhoto = score.querySelector(".art-photo");
    // Паника — снимок мутный, серый и слишком близко. Пришли +15 баллов —
    // кадр отходит, становится резким и тёплым: картинка «проясняется».
    var mood = function (clear) {
      if (!scorePhoto) return;
      scorePhoto.style.setProperty("--blur", clear ? "0px" : "5px");
      scorePhoto.style.setProperty("--sat", clear ? "1.08" : ".3");
      scorePhoto.style.setProperty("--lum", clear ? "1.04" : ".95");
      scorePhoto.style.setProperty("--zoom", clear ? "1.07" : "1.18");
    };
    var finalScore = function () {
      mood(true);
      was.style.strokeDasharray = START + " " + (100 - START);
      add.style.strokeDasharray = PLUS + " " + (100 - PLUS);
      sNum.textContent = START + PLUS;
      sLab.textContent = "через месяц";
      score.classList.add("go");
    };
    if (reduced) finalScore();
    else {
      var sT = timers();
      var playScore = function () {
        sT.clear();
        // Сброс без перехода: иначе дуга на глазах уезжала бы назад
        [was, add].forEach(function (c) { c.style.transition = "none"; c.style.strokeDasharray = "0 100"; });
        void score.offsetWidth;
        [was, add].forEach(function (c) { c.style.transition = ""; });
        score.classList.remove("go");
        mood(false);
        sNum.textContent = "0";
        sLab.textContent = "баллов на старте";
        sT.add(function () {
          was.style.strokeDasharray = START + " " + (100 - START);
          OO.countTo(sNum, 0, START, 1100);
        }, 350);
        sT.add(function () {
          add.style.strokeDasharray = PLUS + " " + (100 - PLUS);
          OO.countTo(sNum, START, START + PLUS, 1200);
          sLab.textContent = "через месяц";
          score.classList.add("go");
          mood(true);
        }, 2300);
        sT.add(playScore, 6800);
      };
      whileVisible(score, playScore, sT.clear);
    }
  }

  // ── Проверка по критериям ───────────────────────────────────
  var check = document.querySelector(".art-check");
  if (check) {
    var crit = check.querySelectorAll(".crit li");
    var total = check.querySelector(".ans-total b");
    var POINTS = [2, 4, 6];
    var checkPhoto = check.querySelector(".art-photo");
    if (checkPhoto) { checkPhoto.style.setProperty("--fx", "68%"); checkPhoto.style.setProperty("--fy", "25%"); }
    // С каждым засчитанным критерием кадр приближается к зелёной галочке
    // на снимке — взгляд проверяющего идёт к ответу.
    var focus = function (step) {
      if (checkPhoto) checkPhoto.style.setProperty("--zoom", (1.06 + step * .06).toFixed(2));
    };
    var finalCheck = function () {
      focus(3);
      [].forEach.call(crit, function (li) { li.classList.add("ok"); });
      total.textContent = "6";
      check.classList.add("done");
    };
    if (reduced) finalCheck();
    else {
      var cT = timers();
      var playCheck = function () {
        cT.clear();
        check.classList.remove("done");
        check.classList.add("reset");
        [].forEach.call(crit, function (li) { li.classList.remove("ok"); });
        total.textContent = "0";
        focus(0);
        void check.offsetWidth;
        cT.add(function () { check.classList.remove("reset"); }, 60);
        [].forEach.call(crit, function (li, i) {
          cT.add(function () { li.classList.add("ok"); total.textContent = POINTS[i]; focus(i + 1); }, 1300 + i * 850);
        });
        cT.add(function () { check.classList.add("done"); }, 1300 + crit.length * 850 + 150);
        cT.add(playCheck, 7800);
      };
      whileVisible(check, playCheck, cT.clear);
    }
  }

  // ── Отсчёт дней до экзамена ─────────────────────────────────
  function daysWord(n) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return "день";
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "дня";
    return "дней";
  }
  var countArt = document.querySelector(".art-count");
  if (countArt) {
    var cnt = countArt.querySelector(".cnt");
    var cntL = countArt.querySelector(".cnt-l");
    var blocks = countArt.querySelectorAll(".blocks li");
    var countPhoto = countArt.querySelector(".art-photo");
    var setDays = function (n) { setOdo(cnt, n); cntL.textContent = daysWord(n) + " до экзамена"; };
    // 0 блоков закрыто — тёплый вечерний свет и тревога; все пять — утро
    var light = function (done) {
      var p = done / 5;
      countArt.style.setProperty("--warm", (1 - p).toFixed(2));
      if (countPhoto) {
        countPhoto.style.setProperty("--lum", (.9 + p * .14).toFixed(3));
        countPhoto.style.setProperty("--zoom", (1.14 - p * .06).toFixed(3));
      }
    };
    light(0);
    makeOdo(cnt, 2);
    setDays(30);
    if (reduced) {
      setDays(15);
      light(5);
      [].forEach.call(blocks, function (b) { b.classList.add("ok"); });
    } else {
      var nT = timers();
      var playCount = function () {
        nT.clear();
        [].forEach.call(blocks, function (b) { b.classList.remove("ok"); });
        setDays(30);
        light(0);
        // 30 → 15 за пять шагов: каждый шаг закрывает один блок экзамена
        [27, 24, 21, 18, 15].forEach(function (d, i) {
          nT.add(function () {
            setDays(d);
            if (blocks[i]) blocks[i].classList.add("ok");
            light(i + 1);
          }, 1000 + i * 1050);
        });
        nT.add(playCount, 1000 + 5 * 1050 + 2600);
      };
      whileVisible(countArt, playCount, nT.clear);
    }
  }

  // ── Как проходит обучение ───────────────────────────────────
  var les = document.querySelector(".les-sec");
  if (les) {
    var hold = les.querySelector(".les-hold");
    var lFill = les.querySelector(".les-rail u");
    var lItems = [].slice.call(les.querySelectorAll(".les li"));
    var t1 = les.querySelector(".t1"), t2 = les.querySelector(".t2"), t3 = les.querySelector(".t3");
    var arc = les.querySelector(".clock-arc");
    var word = les.querySelector(".clock-t b");
    var wordT = 0;
    watch(function () {
      var r = hold.getBoundingClientRect();
      if (!r.height) return;
      les.classList.add("live");
      // «Сейчас» — черта на 62% высоты окна: строка, до которой дочитали
      var now = vh() * .62;
      var p = clamp01((now - r.top) / r.height);
      if (lFill) lFill.style.clipPath = "inset(0 0 " + ((1 - p) * 100).toFixed(2) + "% 0)";
      var active = 0;
      for (var i = 0; i < lItems.length; i++) {
        var b = lItems[i].querySelector("b").getBoundingClientRect();
        var on = b.top + b.height / 2 <= now;
        lItems[i].classList.toggle("on", on);
        if (on) active = i;
      }
      // Старт тёплый, середина — лайм, к экзамену свет уходит в синий
      if (t1) t1.style.opacity = clamp01(1 - p * 2.1).toFixed(3);
      if (t2) t2.style.opacity = clamp01(1 - Math.abs(p - .46) * 2.8).toFixed(3);
      if (t3) t3.style.opacity = clamp01((p - .44) * 2.1).toFixed(3);
      if (arc) arc.style.strokeDasharray = (p * 100).toFixed(2) + " 100";
      // Слово в кольце меняется с коротким проявлением, а не мигает
      var w = lItems[active] ? lItems[active].dataset.short : "";
      if (word && word.dataset.w !== w) {
        word.dataset.w = w;
        word.classList.add("out");
        clearTimeout(wordT);
        wordT = setTimeout(function () { word.textContent = w; word.classList.remove("out"); }, reduced ? 0 : 220);
      }
    });
  }

  /* ═══════════ Просмотр на весь экран ═══════════
     Общий для галереи и документов. Карточка вылетает из своего места
     в центр экрана и возвращается обратно — человек не теряет, откуда
     открыл. Внутри: листание стрелками и пальцем, увеличение по нажатию. */
  var LB = (function () {
    var lb = document.querySelector(".lb");
    if (!lb) return null;
    var stage = lb.querySelector(".lb-stage");
    var fig = lb.querySelector(".lb-fig");
    var meta = lb.querySelector(".lb-meta");
    var title = lb.querySelector(".lb-title");
    var text = lb.querySelector(".lb-text");
    var count = lb.querySelector(".lb-count");
    var prevB = lb.querySelector(".lb-prev");
    var nextB = lb.querySelector(".lb-next");
    var items = [], idx = 0, srcOf = null, from = null, isOpen = false, zoomed = false, busy = false;

    function bindZoom(im) {
      var drag = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
      im.addEventListener("click", function (e) {
        e.stopPropagation();
        if (moved) { moved = false; return; }
        zoomed = !zoomed;
        if (zoomed) {
          var r = im.getBoundingClientRect();
          im.style.transformOrigin =
            ((e.clientX - r.left) / r.width * 100).toFixed(1) + "% " +
            ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%";
          ox = oy = 0;
          im.style.transform = "scale(2.2)";
          im.classList.add("zoom");
        } else {
          im.style.transform = "";
          im.classList.remove("zoom");
        }
      });
      im.addEventListener("pointerdown", function (e) {
        if (!zoomed) return;
        e.stopPropagation();
        drag = true; moved = false;
        sx = e.clientX - ox; sy = e.clientY - oy;
        im.setPointerCapture(e.pointerId);
        im.classList.add("moving");
      });
      im.addEventListener("pointermove", function (e) {
        if (!drag) return;
        ox = e.clientX - sx; oy = e.clientY - sy;
        if (Math.abs(ox) + Math.abs(oy) > 5) moved = true;
        im.style.transform = "translate(" + ox.toFixed(1) + "px," + oy.toFixed(1) + "px) scale(2.2)";
      });
      var up = function () { drag = false; im.classList.remove("moving"); };
      im.addEventListener("pointerup", up);
      im.addEventListener("pointercancel", up);
    }

    // Содержимое кадра: настоящая картинка, если файл уже на месте,
    // иначе копия заглушки — в просмотрщике должно быть то же, что
    // человек видел в карточке.
    function media(item) {
      var box = document.createElement("div");
      box.className = "lb-media";
      var img = item.node.querySelector("img");
      if (img && item.node.classList.contains("has")) {
        var im = document.createElement("img");
        im.src = img.currentSrc || img.src;
        im.alt = img.alt;
        box.appendChild(im);
        bindZoom(im);
      } else {
        var ph = item.node.cloneNode(true);
        var extra = ph.querySelector("img");
        if (extra) extra.remove();
        ph.classList.remove("doc-img");
        box.appendChild(ph);
      }
      return box;
    }

    function render(i) {
      idx = (i + items.length) % items.length;
      zoomed = false;
      var it = items[idx];
      fig.innerHTML = "";
      fig.appendChild(media(it));
      meta.textContent = it.meta || "";
      title.textContent = it.title || "";
      text.innerHTML = it.html || "";
      count.textContent = items.length > 1 ? (idx + 1) + " из " + items.length : "";
      prevB.hidden = nextB.hidden = items.length < 2;
    }

    // Полёт копии между карточкой и кадром просмотрщика. Масштаб
    // одинаковый по обеим осям: растянутая на лету грамота выглядит
    // сломанной, даже если это длится полсекунды.
    function fly(src, opening, done) {
      var target = fig.querySelector(".lb-media > *");
      var a = src && src.getBoundingClientRect();
      var b = target && target.getBoundingClientRect();
      if (reduced || !a || !b || !a.width || !b.width) { done(); return; }
      var clone = src.cloneNode(true);
      clone.removeAttribute("data-slot");
      clone.classList.add("lb-fly");
      clone.style.left = a.left + "px";
      clone.style.top = a.top + "px";
      clone.style.width = a.width + "px";
      clone.style.height = a.height + "px";
      var s = Math.min(b.width / a.width, b.height / a.height);
      var tx = (b.left + b.width / 2) - (a.left + a.width * s / 2);
      var ty = (b.top + b.height / 2) - (a.top + a.height * s / 2);
      var moved = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
      document.body.appendChild(clone);
      clone.style.transition = "none";
      clone.style.transform = opening ? "none" : moved;
      void clone.offsetWidth;
      clone.style.transition = "";
      clone.style.transform = opening ? moved : "none";
      setTimeout(function () {
        done();
        if (opening) {
          clone.style.opacity = "0";
          setTimeout(function () { clone.remove(); }, 320);
        } else clone.remove();
      }, 640);
    }

    function open(list, i, getSrc) {
      if (isOpen || busy) return;
      items = list; srcOf = getSrc; from = document.activeElement;
      isOpen = true; busy = true;
      lb.hidden = false;
      render(i);
      OO.lock(true);
      lb.classList.remove("ready");
      requestAnimationFrame(function () { lb.classList.add("open"); });
      fly(srcOf && srcOf(idx), true, function () { lb.classList.add("ready"); busy = false; });
      setTimeout(function () { lb.querySelector(".lb-x").focus({ preventScroll: true }); }, 60);
    }

    function close() {
      if (!isOpen || busy) return;
      isOpen = false; busy = true;
      var src = srcOf && srcOf(idx);
      var r = src && src.getBoundingClientRect();
      var inView = r && r.bottom > 0 && r.top < vh();
      lb.classList.remove("open");
      var finish = function () {
        lb.hidden = true;
        lb.classList.remove("ready");
        fig.innerHTML = "";
        OO.lock(false);
        busy = false;
        if (from && from.focus) from.focus({ preventScroll: true });
      };
      if (inView) {
        fly(src, false, finish);
        lb.classList.remove("ready");
      } else setTimeout(finish, 420);
    }

    function step(dir) {
      if (!isOpen || busy || items.length < 2) return;
      busy = true;
      fig.style.transition = "opacity .2s ease, transform .3s ease";
      fig.style.opacity = "0";
      fig.style.transform = "translateX(" + (-dir * 24) + "px)";
      setTimeout(function () {
        render(idx + dir);
        fig.style.transition = "none";
        fig.style.transform = "translateX(" + (dir * 24) + "px)";
        void fig.offsetWidth;
        fig.style.transition = "opacity .35s ease, transform .45s cubic-bezier(.22,1,.36,1)";
        fig.style.opacity = "";
        fig.style.transform = "";
        busy = false;
      }, 200);
    }

    prevB.addEventListener("click", function () { step(-1); });
    nextB.addEventListener("click", function () { step(1); });
    lb.querySelectorAll("[data-lb-close]").forEach(function (b) { b.addEventListener("click", close); });
    // Нажатие на пустое место вокруг кадра закрывает просмотр
    stage.addEventListener("click", function (e) {
      if (e.target === stage || e.target === fig || e.target.classList.contains("lb-media")) close();
    });

    // Пальцем: влево-вправо — листать, вниз — закрыть
    var px0 = 0, py0 = 0, tracking = false;
    fig.style.touchAction = "none";
    fig.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" || zoomed) return;
      tracking = true; px0 = e.clientX; py0 = e.clientY;
    });
    fig.addEventListener("pointerup", function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - px0, dy = e.clientY - py0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      else if (dy > 90 && dy > Math.abs(dx)) close();
    });
    fig.addEventListener("pointercancel", function () { tracking = false; });

    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Tab") {
        // Фокус не уходит под окно
        var f = [].filter.call(lb.querySelectorAll("button"), function (b) { return !b.hidden; });
        var at = f.indexOf(document.activeElement);
        e.preventDefault();
        var nx = e.shiftKey ? (at <= 0 ? f.length - 1 : at - 1) : (at + 1) % f.length;
        f[nx].focus();
      }
    });

    return { open: open, isOpen: function () { return isOpen; } };
  })();

  // ── Галерея ─────────────────────────────────────────────────
  // Листается сама, как истории: полоска текущего кадра заполняется, на
  // её конце кадр сменяется. Кадр на экране медленно приближается, соседние
  // уходят в глубину. С последнего на первый — не перемотка через всю
  // ленту, а короткая смена через размытие.
  var gal = document.querySelector("[data-gal]");
  if (gal) {
    var track = gal.querySelector(".gal-track");
    var slides = [].slice.call(track.querySelectorAll(".gal-s"));
    var prog = gal.querySelector(".gal-prog");
    var cap = gal.querySelector(".gal-cap");
    var cur = -1, capT = 0, gRaf = 0, gAuto = null, gHover = false, gTouch = false, wrapping = false;
    slides.forEach(function () {
      var i = document.createElement("i");
      i.appendChild(document.createElement("b"));
      prog.appendChild(i);
    });
    var bars = prog.children;

    var go = function (i, smooth) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: smooth === false || reduced ? "auto" : "smooth" });
    };

    var paintGal = function () {
      gRaf = 0;
      var w = track.clientWidth || 1, x = track.scrollLeft;
      var i = Math.max(0, Math.min(slides.length - 1, Math.round(x / w)));
      if (!reduced) {
        for (var k = 0; k < slides.length; k++) {
          var off = (k * w - x) / w;
          if (Math.abs(off) > 1.3) continue;
          slides[k].style.setProperty("--px", (-off * w * .12).toFixed(1) + "px");
          slides[k].style.setProperty("--depth", Math.min(1, Math.abs(off)).toFixed(3));
        }
      }
      if (i !== cur) {
        cur = i;
        for (var j = 0; j < bars.length; j++) {
          bars[j].classList.toggle("on", j === i);
          bars[j].classList.toggle("done", j < i);
          if (j !== i) bars[j].style.setProperty("--p", "0");
        }
        slides.forEach(function (sl, k) { sl.classList.toggle("cur", k === i); });
        var t = slides[i].querySelector("figcaption").textContent;
        cap.classList.add("out");
        clearTimeout(capT);
        capT = setTimeout(function () { cap.textContent = t; cap.classList.remove("out"); }, 200);
        if (gAuto) gAuto.reset();
      }
    };

    var wrapTo = function (i) {
      if (reduced) { go(i, false); return; }
      wrapping = true;
      gal.classList.add("wrap-out");
      setTimeout(function () {
        go(i, false);
        paintGal();
        gal.classList.remove("wrap-out");
        setTimeout(function () { wrapping = false; }, 400);
      }, 380);
    };
    var step = function (dir) {
      var n = cur + dir;
      if (n >= slides.length) wrapTo(0);
      else if (n < 0) wrapTo(slides.length - 1);
      else go(n);
    };

    track.addEventListener("scroll", function () { if (!gRaf) gRaf = requestAnimationFrame(paintGal); }, { passive: true });
    addEventListener("resize", function () { go(cur < 0 ? 0 : cur, false); paintGal(); }, { passive: true });
    paintGal();

    gal.querySelectorAll(".gal-b").forEach(function (btn) {
      btn.addEventListener("click", function () { step(+btn.dataset.dir); if (gAuto) gAuto.hold(1200); });
    });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      if (e.key === "Enter") openGal(cur);
    });

    // Мышью — перетаскиванием, как пальцем. Палец листает сам браузер.
    var down = false, moved = false, dx0 = 0, sl0 = 0;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; dx0 = e.clientX; sl0 = track.scrollLeft;
    });
    addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - dx0;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add("drag"); }
      if (moved) track.scrollLeft = sl0 - dx;
    });
    addEventListener("pointerup", function (e) {
      if (!down) return;
      down = false;
      if (!moved) return;
      var w = track.clientWidth, dx = e.clientX - dx0, base = Math.round(sl0 / w);
      go(Math.abs(dx) > w * .1 ? base + (dx < 0 ? 1 : -1) : base);
      setTimeout(function () { track.classList.remove("drag"); }, 480);
    });
    gal.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") gHover = true; });
    gal.addEventListener("pointerleave", function () { gHover = false; });
    track.addEventListener("touchstart", function () { gTouch = true; }, { passive: true });
    track.addEventListener("touchend", function () { gTouch = false; if (gAuto) gAuto.hold(2500); }, { passive: true });

    var gItems = slides.map(function (sl) {
      return { node: sl.querySelector(".ph"), title: sl.querySelector("figcaption").textContent, meta: "Фото", html: "" };
    });
    var openGal = function (i) {
      if (!LB) return;
      LB.open(gItems, i, function (k) {
        // Возвращаемся к тому кадру, на котором закрыли просмотр
        if (k !== cur) { go(k, false); paintGal(); }
        return slides[k].querySelector(".ph");
      });
    };
    track.addEventListener("click", function () {
      if (moved) { moved = false; return; }
      openGal(cur < 0 ? 0 : cur);
    });
    gal.querySelector(".gal-zoom").addEventListener("click", function () { openGal(cur < 0 ? 0 : cur); });

    if (!reduced && slides.length > 1) {
      gAuto = autoplay({
        root: gal, dur: 5200,
        blocked: function () {
          return gHover || gTouch || down || wrapping || (LB && LB.isOpen()) || gal.contains(document.activeElement);
        },
        tick: function (p) { if (bars[cur]) bars[cur].style.setProperty("--p", p.toFixed(4)); },
        end: function () { step(1); }
      });
    }
  }

  // ── Документы ───────────────────────────────────────────────
  // Текст для просмотра берём из самой карточки: подзаголовок плюс
  // скрытый .doc-more. Второго места, где он живёт, нет.
  var docs = [].slice.call(document.querySelectorAll(".doc"));
  if (docs.length && LB) {
    var docItems = docs.map(function (d) {
      var short = d.querySelector(".doc-txt p");
      return {
        node: d.querySelector(".doc-img"),
        title: d.querySelector(".doc-t").textContent,
        meta: (d.querySelector(".doc-txt em") || { textContent: "" }).textContent,
        html: (short ? "<p>" + short.innerHTML + "</p>" : "") + d.querySelector(".doc-more").innerHTML
      };
    });
    docs.forEach(function (d, i) {
      d.querySelector(".doc-open").addEventListener("click", function () {
        LB.open(docItems, i, function (k) { return docs[k].querySelector(".doc-img"); });
      });
    });
  }

  // ── Истории учеников ────────────────────────────────────────
  // На широком экране с мышью секция встаёт, лента едет вбок вместе
  // с прокруткой вниз. На телефоне и планшете — лента под палец:
  // перехватывать прокрутку там, где человек листает пальцем, нельзя.
  var casesSec = document.querySelector(".cases-sec");
  if (casesSec) {
    var run = casesSec.querySelector(".cases-run");
    var view = casesSec.querySelector(".cases-view");
    var cTrack = casesSec.querySelector(".cases-track");
    var cases = [].slice.call(cTrack.querySelectorAll(".case"));
    var progU = casesSec.querySelector(".cases-prog u");
    var panOn = false, maxShift = 0;

    // Линия роста и стартовое число выставляем сразу, а рисуем и
    // считаем, когда карточка въезжает в кадр.
    cases.forEach(function (c) {
      if (!c.dataset.to) return;
      var from = +c.dataset.from, to = +c.dataset.to;
      var min = +(c.dataset.min || 0), max = +(c.dataset.max || 100);
      var y0 = 70 - (from - min) / (max - min) * 60;
      var y1 = 70 - (to - min) / (max - min) * 60;
      var mid = (y0 + y1) / 2;
      var path = c.querySelector(".case-line path");
      path.setAttribute("d",
        "M6," + y0.toFixed(1) +
        " C60," + (y0 + 2).toFixed(1) + " 84," + (mid + 8).toFixed(1) + " 124," + mid.toFixed(1) +
        " S190," + (y1 + 1).toFixed(1) + " 232," + y1.toFixed(1));
      var dot = c.querySelector(".case-line circle");
      dot.setAttribute("cx", "232");
      dot.setAttribute("cy", y1.toFixed(1));
      if (!reduced) c.querySelector(".to b").textContent = from;
      else c.classList.add("go");
    });

    var playCase = function (c) {
      c._done = true;
      c.classList.add("go");
      OO.countTo(c.querySelector(".to b"), +c.dataset.from, +c.dataset.to, 1500);
    };

    // Закреплять ленту можно, только когда закреплённый кадр целиком
    // помещается в окно, и только при мыши: перехватывать прокрутку
    // там, где человек листает пальцем, нельзя.
    var canPan = function () {
      return !reduced && innerWidth > 1024 && vh() >= 700 && matchMedia("(hover: hover)").matches;
    };

    var paintCases = function () {
      var p = 0;
      if (panOn) {
        var r = run.getBoundingClientRect();
        p = maxShift > 0 ? clamp01(-r.top / maxShift) : 0;
        cTrack.style.transform = "translate3d(" + (-p * maxShift).toFixed(1) + "px,0,0)";
      } else {
        var m = view.scrollWidth - view.clientWidth;
        p = m > 0 ? view.scrollLeft / m : 0;
      }
      if (progU) progU.style.transform = "scaleX(" + Math.max(.04, p).toFixed(3) + ")";
      for (var i = 0; i < cases.length; i++) {
        var c = cases[i];
        if (c._done || !c.dataset.to || reduced) continue;
        var cr = c.getBoundingClientRect();
        if (cr.left < innerWidth * .82 && cr.right > innerWidth * .12 &&
            cr.top < vh() * .85 && cr.bottom > vh() * .15) playCase(c);
      }
    };

    var layoutCases = function () {
      var want = canPan();
      if (want !== panOn) {
        panOn = want;
        casesSec.classList.toggle("pan", panOn);
        cTrack.style.transform = "";
        run.style.height = "";
      }
      if (panOn) {
        maxShift = Math.max(0, cTrack.scrollWidth - document.documentElement.clientWidth);
        run.style.height = Math.round(vh() + maxShift) + "px";
      }
      paintCases();
    };

    addEventListener("resize", layoutCases, { passive: true });
    addEventListener("load", layoutCases);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutCases);
    layoutCases();
    watch(paintCases);
    view.addEventListener("scroll", paintCases, { passive: true });

    casesSec.querySelectorAll("[data-case]").forEach(function (b) {
      b.addEventListener("click", function () {
        var dir = +b.dataset.case;
        var stepW = cases[0].getBoundingClientRect().width + 20;
        if (panOn) {
          var r = run.getBoundingClientRect();
          var nowX = clamp01(-r.top / maxShift) * maxShift;
          var nextX = Math.max(0, Math.min(maxShift, nowX + dir * stepW));
          // Если лента ещё не встала на место, сначала доводим до её начала
          scrollTo({ top: scrollY + r.top + nextX, behavior: reduced ? "auto" : "smooth" });
        } else view.scrollBy({ left: dir * stepW, behavior: reduced ? "auto" : "smooth" });
      });
    });
  }

  // ── Отзывы ──────────────────────────────────────────────────
  // Лента бесконечная: набор карточек повторён трижды, и когда прокрутка
  // уходит из среднего набора, она незаметно перескакивает на тот же кадр
  // в среднем. Сама шагает по одной карточке; под курсором, под пальцем и
  // при открытом отзыве стоит. Центральная карточка выходит вперёд, по ней
  // пробегает блик, дальние поворачиваются и гаснут.
  var revSec = document.querySelector(".rev-sec");
  if (revSec) {
    var rView = revSec.querySelector(".rev-view");
    var rTrack = revSec.querySelector(".rev-track");
    var rOrig = [].slice.call(rTrack.querySelectorAll(".rev"));
    var N = rOrig.length;
    var loop = !reduced && N > 2;
    rOrig.forEach(function (c, i) {
      c.dataset.i = i;
      var shine = document.createElement("i");
      shine.className = "rev-shine";
      c.querySelector(".rev-shot").appendChild(shine);
    });
    if (loop) {
      var clone = function (c) {
        var k = c.cloneNode(true);
        k.classList.add("clone");
        k.setAttribute("aria-hidden", "true");
        k.querySelector(".rev-open").tabIndex = -1;
        return k;
      };
      rOrig.forEach(function (c) { rTrack.insertBefore(clone(c), rOrig[0]); });
      rOrig.forEach(function (c) { rTrack.appendChild(clone(c)); });
    }
    var rCards = [].slice.call(rTrack.querySelectorAll(".rev"));
    var rProg = revSec.querySelector(".cases-prog u");
    var setW = 0, base = 0, rRaf = 0, rCenter = null, rEndT = 0;
    var rHover = false, rTouch = false, rDown = false, rMoved = false, rx0 = 0, rsl0 = 0, rAuto = null;

    var centerOf = function (el) {
      var vr = rView.getBoundingClientRect(), r = el.getBoundingClientRect();
      return (r.left + r.width / 2) - (vr.left + vr.width / 2);
    };
    var measure = function () {
      setW = loop ? rOrig[0].offsetLeft - rCards[0].offsetLeft : 0;
      if (loop) {
        rView.scrollLeft += centerOf(rOrig[0]);
        base = rView.scrollLeft;
      }
    };

    var paintRev = function () {
      rRaf = 0;
      var vr = rView.getBoundingClientRect();
      var mid = vr.left + vr.width / 2, best = null, bestD = 2;
      for (var i = 0; i < rCards.length; i++) {
        var cr = rCards[i].getBoundingClientRect();
        if (cr.right < vr.left - 400 || cr.left > vr.right + 400) continue;
        var d = Math.max(-1, Math.min(1, (cr.left + cr.width / 2 - mid) / (vr.width / 2 || 1)));
        if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = rCards[i]; }
        if (!reduced) {
          rCards[i].style.setProperty("--ry", (-d * 14).toFixed(2) + "deg");
          rCards[i].style.setProperty("--rs", (1 - Math.abs(d) * .08).toFixed(3));
          rCards[i].style.setProperty("--ro", (1 - Math.abs(d) * .35).toFixed(3));
        }
      }
      if (best && best !== rCenter) {
        if (rCenter) rCenter.classList.remove("center");
        rCenter = best;
        rCenter.classList.add("center");
      }
      var p;
      if (loop && setW) p = (((rView.scrollLeft - base + setW / 2) % setW) + setW) % setW / setW;
      else { var m = rView.scrollWidth - rView.clientWidth; p = m > 0 ? rView.scrollLeft / m : 0; }
      if (rProg) rProg.style.transform = "scaleX(" + Math.max(.04, p).toFixed(3) + ")";
    };

    // Когда прокрутка остановилась за пределами среднего набора —
    // незаметно переносим её на тот же кадр в среднем.
    var normalize = function () {
      if (!loop || !setW || rDown || rTouch) return;
      var x = rView.scrollLeft;
      if (x < base - setW / 2) rView.scrollLeft = x + setW;
      else if (x > base + setW / 2) rView.scrollLeft = x - setW;
      paintRev();
    };
    var onScrollEnd = function () {
      normalize();
      if (rCenter && !reduced) {
        rCenter.classList.remove("shine");
        void rCenter.offsetWidth;
        rCenter.classList.add("shine");
      }
    };
    rView.addEventListener("scroll", function () {
      if (!rRaf) rRaf = requestAnimationFrame(paintRev);
      clearTimeout(rEndT);
      rEndT = setTimeout(onScrollEnd, 160);
    }, { passive: true });

    var stepW = function () {
      return rCards.length > 1 ? rCards[1].offsetLeft - rCards[0].offsetLeft : 300;
    };
    var stepRev = function (dir) {
      rView.scrollBy({ left: dir * stepW(), behavior: reduced ? "auto" : "smooth" });
    };
    revSec.querySelectorAll("[data-rev]").forEach(function (b) {
      b.addEventListener("click", function () { stepRev(+b.dataset.rev); if (rAuto) { rAuto.reset(); rAuto.hold(1500); } });
    });

    rView.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      rDown = true; rMoved = false; rx0 = e.clientX; rsl0 = rView.scrollLeft;
    });
    addEventListener("pointermove", function (e) {
      if (!rDown) return;
      var dx = e.clientX - rx0;
      if (!rMoved && Math.abs(dx) > 5) { rMoved = true; rView.classList.add("drag"); }
      if (rMoved) rView.scrollLeft = rsl0 - dx;
    });
    addEventListener("pointerup", function () {
      if (!rDown) return;
      rDown = false;
      if (!rMoved) return;
      // Отпустили — доводим до ближайшей к центру карточки
      if (rCenter) rView.scrollBy({ left: centerOf(rCenter), behavior: reduced ? "auto" : "smooth" });
      setTimeout(function () { rView.classList.remove("drag"); }, 480);
      if (rAuto) { rAuto.reset(); rAuto.hold(1500); }
    });
    rView.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") rHover = true; });
    rView.addEventListener("pointerleave", function () { rHover = false; });
    rView.addEventListener("touchstart", function () { rTouch = true; }, { passive: true });
    rView.addEventListener("touchend", function () {
      rTouch = false;
      if (rAuto) { rAuto.reset(); rAuto.hold(2500); }
      clearTimeout(rEndT);
      rEndT = setTimeout(onScrollEnd, 400);
    }, { passive: true });

    if (LB) {
      var avitoHref = OO.contactHref("avito");
      var rItems = rOrig.map(function (c) {
        return {
          node: c.querySelector(".rev-shot"), title: "Отзыв на Авито", meta: "Отзывы",
          html: avitoHref ? '<p><a class="lb-link" href="' + avitoHref + '" target="_blank" rel="noopener">Все 50 отзывов в профиле на Авито</a></p>' : ""
        };
      });
      // Лететь в просмотр и обратно — из той копии карточки, что ближе к центру
      var nearest = function (k) {
        var best = null, bd = 1e9;
        rCards.forEach(function (c) {
          if (+c.dataset.i !== k) return;
          var d = Math.abs(centerOf(c));
          if (d < bd) { bd = d; best = c; }
        });
        return best ? best.querySelector(".rev-shot") : null;
      };
      rCards.forEach(function (c) {
        c.querySelector(".rev-open").addEventListener("click", function () {
          if (rMoved) { rMoved = false; return; }
          LB.open(rItems, +c.dataset.i, nearest);
        });
      });
    }

    var rReady = function () { measure(); paintRev(); };
    addEventListener("resize", rReady, { passive: true });
    addEventListener("load", rReady);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rReady);
    rReady();

    if (loop) {
      rAuto = autoplay({
        root: revSec, dur: 3400,
        blocked: function () {
          return rHover || rTouch || rDown || (LB && LB.isOpen()) || revSec.contains(document.activeElement);
        },
        end: function () { stepRev(1); }
      });
    }
  }

  // ── Заявка ──────────────────────────────────────────────────
  var quiz = document.querySelector(".quiz");
  if (quiz) {
    var steps = [].slice.call(quiz.querySelectorAll(".qz-step"));
    var qProg = quiz.querySelector(".quiz-prog u");
    var qN = quiz.querySelector(".quiz-n");
    var qBack = quiz.querySelector(".qz-back");
    var qMsg = quiz.querySelector(".qz-msg");
    var qName = quiz.querySelector("#qz-name");
    var ans = {}, at = 0;

    var message = function () {
      var L = ["Здравствуйте, Оксана Олеговна!"];
      if (ans.who) L.push(ans.who);
      var what = [ans.exam, ans.subj].filter(Boolean);
      if (what.length) L.push("Подготовка: " + what.join(", ") + ".");
      if (ans.level) L.push("Сейчас: " + ans.level + ".");
      if (ans.format) L.push("Формат: " + ans.format + ".");
      L.push((ans.who && ans.who.indexOf("родитель") > -1 ? "Хотим" : "Хочу") + " записаться на бесплатный пробный урок.");
      var nm = qName.value.trim();
      if (nm) L.push("Меня зовут " + nm + ".");
      return L.join("\n");
    };
    var paintMsg = function () { qMsg.textContent = message(); };

    var showStep = function (i) {
      at = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach(function (s, k) {
        s.classList.toggle("on", k === at);
        s.classList.toggle("back", k < at);
      });
      qProg.style.transform = "scaleX(" + ((at + 1) / steps.length).toFixed(4) + ")";
      qN.textContent = (at + 1) + " из " + steps.length;
      qBack.hidden = at === 0;
      if (at === steps.length - 1) paintMsg();
    };

    steps.forEach(function (s, k) {
      s.querySelectorAll(".qz-o").forEach(function (o) {
        o.addEventListener("click", function () {
          s.querySelectorAll(".qz-o").forEach(function (x) { x.classList.toggle("sel", x === o); });
          ans[s.dataset.key] = o.dataset.v;
          // Короткая пауза: человек должен увидеть, что выбор принят
          setTimeout(function () { showStep(k + 1); }, reduced ? 0 : 280);
        });
      });
    });
    qBack.addEventListener("click", function () { showStep(at - 1); });
    qName.addEventListener("input", paintMsg);

    var copyText = function (t, cb) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(t).then(function () { cb(true); }, function () { cb(false); });
        return;
      }
      var ta = document.createElement("textarea");
      ta.value = t;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      cb(ok);
    };

    quiz.querySelectorAll("[data-send]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var kind = a.dataset.send, href = OO.contactHref(kind), t = message();
        if (!href) { e.preventDefault(); OO.noContact(); return; }
        a.target = "_blank";
        a.rel = "noopener";
        if (kind === "whatsapp") { a.href = href + "?text=" + encodeURIComponent(t); return; }
        // Ссылка на человека в Telegram не принимает готовый текст —
        // кладём его в буфер обмена, чтобы осталось только вставить.
        a.href = href;
        copyText(t, function (ok) {
          OO.toast(ok ? "Текст заявки скопирован. Вставьте его в чат." : "Откройте чат и коротко опишите ситуацию.");
        });
      });
    });
    quiz.querySelector(".qz-copy").addEventListener("click", function () {
      copyText(message(), function (ok) { OO.toast(ok ? "Текст скопирован" : "Не получилось скопировать, выделите текст вручную"); });
    });

    // Выбор формата в ценах отмечается в заявке заранее
    window.OOQuiz = {
      preset: function (key, label) {
        var step = quiz.querySelector('.qz-step[data-key="' + key + '"]');
        if (!step) return;
        step.querySelectorAll(".qz-o").forEach(function (o) {
          var hit = o.textContent.trim() === label;
          o.classList.toggle("sel", hit);
          if (hit) ans[key] = o.dataset.v;
        });
      }
    };
    showStep(0);
  }

  document.querySelectorAll("[data-pick]").forEach(function (b) {
    b.addEventListener("click", function () {
      var plan = b.closest(".plan");
      if (window.OOQuiz) window.OOQuiz.preset("format", plan.dataset.format);
      var t = document.getElementById("trial");
      if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      OO.toast("Формат «" + plan.dataset.format + "» отмечен в заявке");
    });
  });

  // ── Вопросы: плавное раскрытие ──────────────────────────────
  // <details> открывается и без скрипта; здесь только плавность высоты.
  document.querySelectorAll(".q").forEach(function (d) {
    var sum = d.querySelector("summary");
    var body = d.querySelector(".q-a");
    if (!body || !body.animate) return;
    sum.addEventListener("click", function (e) {
      if (reduced) return;
      e.preventDefault();
      if (d.classList.contains("closing")) return;
      if (d.open) {
        d.classList.add("closing");
        var h = body.offsetHeight;
        var anim = body.animate(
          [{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" });
        anim.onfinish = function () { d.open = false; d.classList.remove("closing"); };
      } else {
        d.open = true;
        var h2 = body.offsetHeight;
        body.animate(
          [{ height: "0px", opacity: 0 }, { height: h2 + "px", opacity: 1 }],
          { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
      }
    });
  });
})();
