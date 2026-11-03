/* Оксана Олеговна — версия 2. Без библиотек.
   Положения считаются сразу в обработчике прокрутки: в скрытой вкладке rAF стоит. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var vw = innerWidth, vh = innerHeight, sy = scrollY;
  var mx = vw / 2, my = vh / 2;
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- контакты ---------- */
  var C = window.CONTACTS || {};
  function contactUrl(kind) {
    var v = String(C[kind] || '').trim();
    if (!v) return '';
    if (kind === 'telegram' && !/^https?:/.test(v)) return 'https://t.me/' + v.replace(/^@/, '');
    return v;
  }
  $$('[data-contact]').forEach(function (a) {
    var u = contactUrl(a.dataset.contact);
    if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener'; }
  });

  /* ---------- тост ---------- */
  var toastEl = $('.toast'), toastT;
  function toast(t) {
    toastEl.textContent = t; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /* ---------- разбивка заголовков на слова ---------- */
  function splitWords(el) {
    var i = 0;
    function unit(node) {
      var w = d.createElement('span'), wi = d.createElement('span');
      w.className = 'w'; wi.className = 'wi'; wi.style.setProperty('--i', i++);
      w.appendChild(wi); return { w: w, wi: wi };
    }
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(d.createTextNode(' ')); return; }
            var u = unit(); u.wi.textContent = p; frag.appendChild(u.w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          if (n.classList.contains('pw')) {
            var u = unit(); u.w.classList.add('w-pw');
            n.parentNode.replaceChild(u.w, n); u.wi.appendChild(n);
          } else walk(n);
        }
      });
    })(el);
  }
  $$('[data-split]').forEach(splitWords);

  /* слова для «прокрутки по словам» */
  function scrubWords(el) {
    var words = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = d.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach(function (p) {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(d.createTextNode(' ')); return; }
            var s = d.createElement('span'); s.className = 'sw'; s.textContent = p; frag.appendChild(s); words.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          if (n.classList.contains('pw')) { n.classList.add('sw'); words.push(n); }
          else walk(n);
        }
      });
    })(el);
    el._words = words; el._n = -1;
  }
  var scrubs = $$('[data-scrub]');
  scrubs.forEach(scrubWords);

  /* ---------- контуры-таблетки ---------- */
  var pws = $$('.pw');
  function sizePill(pw) {
    var s = pw._svg, r = pw._rect, w = pw.offsetWidth, h = pw.offsetHeight;
    if (!w || !h) return;
    var sw = pw.closest('.h1') ? 2.3 : 1.6, o = sw / 2, rw = w - sw, rh = h - sw, rx = rh / 2;
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    r.setAttribute('x', o); r.setAttribute('y', o); r.setAttribute('width', rw); r.setAttribute('height', rh); r.setAttribute('rx', rx);
    s.style.setProperty('--len', (2 * (rw - 2 * rx) + 2 * Math.PI * rx + 2).toFixed(1));
  }
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (es) { es.forEach(function (e) { sizePill(e.target); }); }) : null;
  pws.forEach(function (pw) {
    var s = d.createElementNS(NS, 'svg'), r = d.createElementNS(NS, 'rect');
    s.setAttribute('class', 'pw-o'); s.setAttribute('aria-hidden', 'true'); s.appendChild(r); pw.appendChild(s);
    pw._svg = s; pw._rect = r; sizePill(pw);
    if (ro) ro.observe(pw);
  });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { pws.forEach(sizePill); });

  /* заголовок первого экрана: строки таблеток не шире колонки */
  var h1 = $('.h1'), pls = $$('.pl', h1);
  function fitH1() {
    h1.style.fontSize = '';
    var w = h1.clientWidth, max = 0;
    pls.forEach(function (p) { max = Math.max(max, p.scrollWidth); });
    if (max > w) h1.style.fontSize = (parseFloat(getComputedStyle(h1).fontSize) * w / max * 0.97).toFixed(1) + 'px';
    pws.forEach(sizePill);
  }
  fitH1();
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(fitH1);

  /* ---------- счётчики ---------- */
  function count(el) {
    if (el._done) return; el._done = true;
    var to = parseFloat(el.dataset.count), t0 = performance.now(), dur = RM ? 1 : 1700;
    (function step(t) {
      var p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(to * (p === 1 ? 1 : e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
    setTimeout(function () { el.textContent = to; }, dur + 120);
  }

  /* ---------- появление ---------- */
  function show(el) {
    el.classList.add('in');
    // в лентах вбок соседние карточки проявляются вместе — край следующей виден сразу
    var row = el.parentNode;
    if (row && row.matches && row.matches('.plans, .car-in, .sit-grid') && el.hasAttribute('data-reveal')) {
      $$('[data-reveal]', row).forEach(function (x) { if (x !== el) { x.classList.add('in'); io.unobserve(x); } });
    }
    if (el.classList.contains('pw')) el.classList.add('drawn');
    $$('.pw', el).forEach(function (p, k) { p.style.setProperty('--pd', (0.25 + k * 0.16) + 's'); p.classList.add('drawn'); });
    if (el.dataset.count) count(el);
    $$('[data-count]', el).forEach(count);
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  var revealSel = '[data-reveal],[data-split],.pw,[data-count],.sr,.tile';
  // stagger соседей
  $$('.facts, .sit-grid, .bento, .plans, .hr-list, .tsteps').forEach(function (g) {
    $$('[data-reveal]', g).forEach(function (el, k) { el.style.setProperty('--d', (k * 0.08) + 's'); });
  });
  function arm() { $$(revealSel).forEach(function (el) { if (!el.closest('.hero') && !el.closest('.loader')) io.observe(el); }); }

  /* ---------- загрузка и первый экран ---------- */
  var loader = $('.loader'), started = false, seen = store.get('oo2-seen');
  function heroIntro() {
    var h1 = $('.h1');
    $$('.pw', h1).forEach(function (p, k) { p.style.setProperty('--kd', (k * 0.13) + 's'); p.style.setProperty('--pd', (0.35 + k * 0.17) + 's'); });
    h1.classList.add('in');
    setTimeout(function () { $$('.pw', h1).forEach(function (p) { p.classList.add('drawn'); }); }, 60);
    $$('.hero [data-reveal]').forEach(function (el, k) { el.style.setProperty('--d', (0.5 + k * 0.08) + 's'); el.classList.add('in'); });
    // чат: сообщения по очереди
    var items = $$('[data-chat]'), k = 0;
    (function next() {
      if (k >= items.length) return;
      items[k].classList.add('in'); k++;
      setTimeout(next, RM ? 0 : (k === 1 ? 900 : 1100));
    })();
    setTimeout(function () { $('.bots').classList.add('on'); }, 1600);
  }
  function start() {
    if (started) return; started = true;
    if (loader) { loader.classList.add('done'); setTimeout(function () { loader.remove(); }, 1300); }
    store.set('oo2-seen', '1');
    setTimeout(heroIntro, loader && !seen ? 450 : 50);
    arm();
  }
  if (RM || seen) { root.classList.add('seen'); if (loader) loader.remove(); loader = null; start(); }
  else {
    setTimeout(function () { $$('.loader .pw').forEach(function (p, k) { p.style.setProperty('--pd', (k * 0.25) + 's'); p.classList.add('drawn'); }); }, 80);
    var t0 = performance.now();
    var ready = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
    ready.then(function () { setTimeout(start, Math.max(0, 1500 - (performance.now() - t0))); });
    setTimeout(start, 3200);
  }

  $$('.rings i').forEach(function (i, k) { i.style.setProperty('--k', k); });

  /* ---------- телефон: сообщения стопкой, верхнее улетает и уходит назад ---------- */
  (function () {
    var mq = matchMedia('(max-width: 760px)'), items = $$('.chat .msg'), top = 0, timer = null;
    function apply() { items.forEach(function (m, i) { m.dataset.pos = Math.min((i - top + items.length) % items.length, 3); }); }
    function step() {
      var m = items[top]; m.classList.add('fly');
      setTimeout(function () { m.classList.remove('fly'); top = (top + 1) % items.length; apply(); }, 420);
    }
    function sync() {
      clearInterval(timer);
      if (!mq.matches) { items.forEach(function (m) { m.removeAttribute('data-pos'); m.classList.remove('fly'); }); return; }
      apply();
      if (!RM) timer = setInterval(function () { if (!d.hidden && heroVis) step(); }, 3200);
    }
    if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
    sync();
  })();

  /* ---------- волна голосового ---------- */
  $$('.wave i').forEach(function (i, k) {
    i.style.setProperty('--h', Math.round(30 + 70 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.6))));
    i.style.setProperty('--k', k);
  });

  /* ---------- ОГЭ / ЕГЭ на телефоне ---------- */
  var seg = $('.seg'), EX = {
    ege: { k: 'ЕГЭ · средний балл', n: 85, s: 'мои ученики', w: '85%' },
    oge: { k: 'ОГЭ‑2026 · Семён', n: 36, s: 'из 37 баллов', w: '97%' }
  };
  if (seg) {
    seg.dataset.on = 'ege';
    $$('.seg-b', seg).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.exam, e = EX[v];
        seg.dataset.on = v;
        $$('.seg-b', seg).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        $('[data-exam-text]').textContent = e.k; $('[data-exam-sub]').textContent = e.s;
        var n = $('[data-exam-num]'); n.dataset.count = e.n; n._done = false; count(n);
        $('.ha-bar i').style.setProperty('--w', e.w);
      });
    });
  }

  /* ---------- меню ---------- */
  var menu = $('#menu');
  function setMenu(open) {
    menu.classList.toggle('open', open); menu.setAttribute('aria-hidden', String(!open));
    root.classList.toggle('lock', open);
    $$('[data-open-menu], .nav-burger').forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
    if (open) setTimeout(function () { $('.menu-x').focus(); }, 300);
  }
  $$('.menu-in a').forEach(function (a, k) { a.style.setProperty('--i', k); a.addEventListener('click', function () { setMenu(false); }); });
  $$('[data-open-menu], .nav-burger').forEach(function (b) { b.addEventListener('click', function () { setMenu(true); }); });
  $('.menu-x').addEventListener('click', function () { setMenu(false); });
  $('.menu-cta').addEventListener('click', function () { setMenu(false); });

  /* ---------- плавающее меню и подсветка раздела ---------- */
  var nav = $('#nav'), tabbar = $('.tabbar'), hero = $('#hero');
  var spyLinks = $$('.nav-pill a'), ind = $('.nav-ind'), spySecs = spyLinks.map(function (a) { return d.getElementById(a.dataset.spy); });
  var curSpy = null;
  function navUpdate() {
    var past = sy > hero.offsetHeight * 0.6;
    nav.classList.toggle('show', past);
    tabbar.classList.toggle('show', sy > 260);
    var act = null;
    spySecs.forEach(function (s, k) { if (s && s.getBoundingClientRect().top < vh * 0.42) act = k; });
    if (act !== null && spySecs[act].getBoundingClientRect().bottom < vh * 0.2) act = null;
    if (act === curSpy) return; curSpy = act;
    spyLinks.forEach(function (a, k) { a.classList.toggle('on', k === act); });
    if (act === null) { ind.classList.remove('on'); return; }
    var a = spyLinks[act];
    ind.style.setProperty('--x', a.offsetLeft + 'px'); ind.style.setProperty('--w', a.offsetWidth + 'px'); ind.classList.add('on');
  }

  /* ---------- слова по прокрутке, линии, мега-заголовок ---------- */
  function scrubUpdate() {
    scrubs.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.38), 0, 1);
      var n = Math.round(p * el._words.length);
      if (n === el._n) return; el._n = n;
      el._words.forEach(function (w, k) { w.classList.toggle('on', k < n); });
    });
  }
  var draws = $$('[data-draw]').map(function (p) {
    var len = 0; try { len = p.getTotalLength(); } catch (e) {}
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    return { p: p, len: len, host: p.closest('svg').parentNode };
  });
  function drawUpdate() {
    draws.forEach(function (o) {
      var r = o.host.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var p = clamp((vh - r.top) / (vh * 0.75 + r.height * 0.45), 0, 1);
      o.p.style.strokeDashoffset = (o.len * (1 - p)).toFixed(1);
    });
  }
  var mega = $('[data-mega]');
  function megaUpdate() {
    if (!mega) return;
    var r = mega.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    mega.style.setProperty('--mp', (clamp(1 - (r.top + r.height) / (vh + r.height), 0, 1) * 100).toFixed(1) + '%');
  }

  /* ---------- стопка карточек «Обучение» ---------- */
  var scs = $$('.sc');
  scs.forEach(function (c, k) { c.style.setProperty('--i', k); });
  function stackUpdate() {
    for (var k = 0; k < scs.length - 1; k++) {
      var a = scs[k].getBoundingClientRect(), b = scs[k + 1].getBoundingClientRect();
      if (a.bottom < -100 || a.top > vh) continue;
      var q = clamp(1 - (b.top - a.top) / a.height, 0, 1);
      var inner = scs[k].firstElementChild;
      inner.style.transform = 'scale(' + (1 - q * 0.07).toFixed(4) + ')';
      inner.style.setProperty('--q', q.toFixed(3));
    }
  }

  /* ---------- «Мой путь»: горизонтальная лента ---------- */
  var P = { el: $('.path'), track: $('.path-track'), cards: $$('.pc'), years: $$('.path-years span'), yInd: $('.py-ind'), line: $('.path-line'), on: false };
  P.fg = $('.pl-fg', P.line); P.bg = $('.pl-bg', P.line);
  function pathMeasure() {
    P.on = FINE && vw > 1024 && vh >= 680 && !RM;
    P.el.classList.toggle('is-pin', P.on);
    if (!P.on) { P.el.style.height = ''; P.track.style.transform = ''; P.cards.forEach(function (c) { c.style.transform = ''; c.style.opacity = ''; }); return; }
    P.track.style.transform = '';
    var tw = P.track.scrollWidth;
    P.dist = Math.max(1, tw - vw);
    P.el.style.height = (vh + P.dist) + 'px';
    P.top = P.el.getBoundingClientRect().top + sy;
    // линия-таймлайн над карточками
    var y = 56, pts = P.cards.map(function (c) { return c.offsetLeft + c.offsetWidth / 2; });
    var x0 = pts[0] - 260, dstr = 'M' + x0 + ' ' + y, prev = x0;
    pts.forEach(function (x, k) {
      var mid = (prev + x) / 2, amp = k % 2 ? 34 : -34;
      dstr += ' C' + mid + ' ' + (y + amp) + ' ' + mid + ' ' + (y - amp) + ' ' + x + ' ' + y;
      prev = x;
    });
    P.line.setAttribute('width', tw); P.line.setAttribute('viewBox', '0 0 ' + tw + ' 110');
    P.fg.setAttribute('d', dstr); P.bg.setAttribute('d', dstr);
    $$('.pl-dot, .pl-head', P.line).forEach(function (n) { n.remove(); });
    P.dots = pts.map(function (x) {
      var c = d.createElementNS(NS, 'circle'); c.setAttribute('class', 'pl-dot'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 8); P.line.appendChild(c); return { c: c, x: x };
    });
    P.head = d.createElementNS(NS, 'circle'); P.head.setAttribute('class', 'pl-head'); P.head.setAttribute('r', 5); P.line.appendChild(P.head);
    P.len = P.fg.getTotalLength(); P.fg.style.strokeDasharray = P.len; P.x0 = x0; P.tw = tw;
    // таблица «длина пути → x» для точного рисования
    P.lut = []; for (var i = 0; i <= 200; i++) { var L = P.len * i / 200; P.lut.push([P.fg.getPointAtLength(L).x, L]); }
  }
  function lenAtX(x) {
    var lut = P.lut; if (x <= lut[0][0]) return 0;
    for (var i = 1; i < lut.length; i++) if (lut[i][0] >= x) { var a = lut[i - 1], b = lut[i]; return a[1] + (b[1] - a[1]) * ((x - a[0]) / ((b[0] - a[0]) || 1)); }
    return P.len;
  }
  var curYear = -1;
  function pathUpdate() {
    if (!P.on) return;
    var p = clamp((sy - P.top) / P.dist, 0, 1), shift = p * P.dist;
    P.track.style.transform = 'translate3d(' + (-shift).toFixed(1) + 'px,0,0)';
    var front = shift + vw * 0.62, L = lenAtX(front);
    P.fg.style.strokeDashoffset = (P.len - L).toFixed(1);
    var pt = P.fg.getPointAtLength(L); P.head.setAttribute('cx', pt.x); P.head.setAttribute('cy', pt.y);
    var yi = 0;
    P.dots.forEach(function (o, k) { var on = o.x <= front; o.c.classList.toggle('on', on); if (on) yi = k; });
    P.cards.forEach(function (c) {
      var r = c.getBoundingClientRect(), rel = (r.left + r.width / 2 - vw * 0.5) / vw, q = Math.max(0, rel - 0.18);
      c.style.transform = 'translate3d(0,' + (q * 110).toFixed(1) + 'px,0) rotate(' + (q * 7).toFixed(2) + 'deg) scale(' + (1 - q * 0.1).toFixed(3) + ')';
      c.style.opacity = (1 - clamp((rel - 0.42) * 1.5, 0, 0.75)).toFixed(3);
    });
    if (yi !== curYear) {
      curYear = yi;
      P.years.forEach(function (s, k) { s.classList.toggle('on', k === yi); });
      var s = P.years[yi]; P.yInd.style.width = s.offsetWidth + 'px'; P.yInd.style.transform = 'translateX(' + s.offsetLeft + 'px)';
    }
  }

  /* ---------- веер наград ---------- */
  var fan = $('[data-fan]'), fcs = $$('.fc', fan), fanOpen = false, fanHover = -1;
  function fanLayout() {
    if (vw <= 760) { fcs.forEach(function (c) { c.style.removeProperty('--tx'); c.style.removeProperty('--ty'); c.style.removeProperty('--rot'); c.classList.remove('fc-l', 'fc-r'); }); return; }
    var n = fcs.length, mid = (n - 1) / 2, spread = Math.min(150, (fan.clientWidth - 400) / (n - 1));
    fcs.forEach(function (c, i) {
      var k = i - mid, tx, ty, rot;
      if (fanOpen) { tx = k * spread; rot = k * 6; ty = k * k * 8 - (k === 0 ? 24 : 0); }
      else { tx = k * 6; rot = k * 1.5; ty = 140; }
      if (fanOpen && fanHover >= 0) {
        if (i === fanHover) { ty -= 70; rot *= 0.35; }
        else tx += (i < fanHover ? -1 : 1) * 46;
      }
      c.style.setProperty('--tx', tx.toFixed(1) + 'px'); c.style.setProperty('--ty', ty.toFixed(1) + 'px'); c.style.setProperty('--rot', rot.toFixed(2) + 'deg');
      c.style.setProperty('--z', i === fanHover ? 40 : 20 - Math.round(Math.abs(k) * 2));
      c.classList.toggle('fc-l', k < 0); c.classList.toggle('fc-r', k > 0);
    });
  }
  new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && !fanOpen) { fanOpen = true; setTimeout(fanLayout, 120); } });
  }, { threshold: 0.35 }).observe(fan);
  fcs.forEach(function (c, i) {
    c.addEventListener('pointerenter', function () { if (FINE) { fanHover = i; fanLayout(); } });
    c.addEventListener('click', function () { openAward(+c.dataset.award, c); });
    c.addEventListener('pointerdown', function () { var o = AW[+c.dataset.award]; if (o && o.img && !o._pre) { o._pre = new Image(); o._pre.src = 'assets/awards/' + o.img + '.webp'; } });
  });
  fan.addEventListener('pointerleave', function () { fanHover = -1; fanLayout(); });
  var awPanel = fan.parentNode;
  if (FINE) awPanel.addEventListener('pointermove', function (e) {
    var r = awPanel.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5;
    fan.style.transform = 'rotate(' + (x * 4).toFixed(2) + 'deg) translateX(' + (x * 24).toFixed(1) + 'px)';
  });
  fanLayout();

  /* ---------- окно просмотра ---------- */
  var modal = $('#modal'), mCard = $('.modal-card', modal), mArt = $('.modal-art', modal), lastFocus = null;
  function useSvg(id, vb) { return '<svg viewBox="' + vb + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function openModal(o) {
    lastFocus = d.activeElement;
    mCard.style.setProperty('--a', o.a); mCard.style.setProperty('--b', o.b);
    // есть фото — сразу показываем его (уже загруженное превью), без персонажа-заглушки;
    // полноразмерный файл подменяет превью, как только догрузится
    mArt.innerHTML = '';
    if (o.img) {
      var im = new Image(); im.alt = o.t; im.decoding = 'async';
      im.src = o.thumb || o.img; mArt.appendChild(im);
      if (o.thumb && o.thumb !== o.img) {
        var full = new Image();
        full.onload = function () { if (im.isConnected) im.src = o.img; };
        full.src = o.img;
      }
    } else mArt.innerHTML = useSvg(o.m, o.vb);
    $('.modal-k', modal).textContent = o.k; $('#modal-t').textContent = o.t;
    $('.modal-txt', modal).innerHTML = o.html;
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); root.classList.add('lock');
    setTimeout(function () { $('.modal-x', modal).focus(); }, 60);
  }
  function closeModal() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); root.classList.remove('lock');
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); if (menu.classList.contains('open')) setMenu(false); }
  });
  var P_ = function (a) { return a.map(function (t) { return '<p>' + t + '</p>'; }).join(''); };

  var AW = [
    { k: 'АГПУ, Армавир · 2015', t: 'Красный диплом бакалавра', m: 'm-scroll', vb: '0 0 210 170', a: '#22C3D8', b: '#0E8FB0', img: 'diplom-bakalavra',
      txt: ['Армавирская государственная педагогическая академия, 2015 год, направление «Педагогическое образование». Ещё во время учёбы — научные статьи, публикации и выступления на конференциях.', 'Отсюда привычка разбираться в предмете системно: сначала связи и причины, потом детали. Так же построены мои уроки.'] },
    { k: 'Магистратура · 2017', t: 'Красный диплом магистра', m: 'm-cap', vb: '0 0 210 180', a: '#8C7BFF', b: '#5B47E0', img: 'diplom-magistra',
      txt: ['Армавирский государственный педагогический университет. Магистратура на бюджете, окончила с отличием в 2017 году и защитила магистерскую диссертацию.', 'Глубокая предметная база помогает объяснять сложные темы простыми словами и отвечать на вопросы, которые выходят за рамки учебника.'] },
    { k: 'Повышение квалификации', t: 'Сертификаты и удостоверения', m: 'm-book', vb: '0 0 160 210', a: '#4F8BFF', b: '#2D4FE0', img: 'sertifikaty-kvalifikaciya',
      txt: ['Сертификаты и удостоверения о повышении квалификации.', 'Слежу за каждым изменением экзамена, чтобы готовить по актуальным требованиям, а не по прошлогодним.'] },
    { k: '«Учитель года Адыгеи — 2022»', t: 'Победитель муниципального этапа', m: 'm-bell', vb: '0 0 180 210', a: '#FF7A86', b: '#E94766', img: 'gramota-pobeditel-municipal',
      txt: ['Грамота Управления образования Кошехабльского района: победитель муниципального этапа Всероссийского конкурса «Учитель года Адыгеи — 2022».'] },
    { k: '«Учитель года Адыгеи — 2022»', t: 'Диплом Главы Республики Адыгея', m: 'm-medal', vb: '0 0 170 230', a: '#FFC24D', b: '#F08A12', img: 'diplom-glavy-adygei',
      txt: ['Призёр республиканского конкурса «Учитель года Адыгеи», ТОП‑5 учителей республики. Награду вручал Глава Республики Адыгея Мурат Каральбиевич Кумпилов.', '«Учитель года» — один из самых известных профессиональных конкурсов для учителей в России. Участники дают открытые уроки перед жюри, проводят мастер-классы и защищают свою методику.', 'Для родителей это знак, что подход к урокам прошёл проверку профессионального сообщества, а не держится только на отзывах.'] },
    { k: '«Учитель года — 2022»', t: 'Призёр республиканского этапа', m: 'm-medal', vb: '0 0 170 230', a: '#FF9A6B', b: '#F0602E', img: 'gramota-prizer-respublika',
      txt: ['Почётная грамота муниципального образования «Кошехабльский район»: призёр республиканского этапа Всероссийского конкурса «Учитель года — 2022».'] },
    { k: 'Всероссийская олимпиада школьников', t: 'Подготовка призёра регионального этапа', m: 'm-owl', vb: '0 0 180 210', a: '#7BE07B', b: '#2FB860', img: 'gramota-olimpiada-vsosh',
      txt: ['Почётная грамота за подготовку призёра III (регионального) этапа Всероссийской олимпиады школьников, 2022–2023 учебный год.'] },
    { k: 'Олимпиада', t: 'Подготовка призёров по избирательному праву', m: 'm-column', vb: '0 0 160 230', a: '#C3B1FF', b: '#8E72F5', img: 'gramota-izbiratelnoe-pravo',
      txt: ['Почётная грамота за подготовку призёров олимпиады по избирательному праву.'] },
    { k: 'ЕГЭ · ОГЭ · олимпиады', t: 'Эксперт по проверке экзаменов', m: 'm-owl', vb: '0 0 180 210', a: '#3E6BFF', b: '#2445C9', img: '',
      txt: ['Эксперт видит сотни работ и знает, на чём чаще всего теряют баллы: неполный ответ, пример не по условию, аргумент без обоснования.', 'На уроках я показываю эти ловушки заранее, чтобы на экзамене в них не попасть.'] }
  ];
  function openAward(i) {
    var o = AW[i]; if (!o) return;
    openModal({ k: o.k, t: o.t, m: o.m, vb: o.vb, a: o.a, b: o.b, img: o.img ? 'assets/awards/' + o.img + '.webp' : '', thumb: o.img ? 'assets/awards/thumb/' + o.img + '.webp' : '', html: P_(o.txt) });
  }

  var ST = [
    { k: 'Соня · ЕГЭ · 7 месяцев · +51 балл', t: 'Семь месяцев системной работы', m: 'm-column', vb: '0 0 160 230', a: '#C9F05E', b: '#9AD22B',
      parts: [['С чем пришла', 'По совету подруги. Очень способная ученица, готовая работать и развиваться.'], ['Что делали', 'Не просто учили материал, а выстроили систему подготовки, разобрали слабые места и научились уверенно решать задания экзамена.'], ['Итог', '83 балла вместо 32 на старте.']] },
    { k: 'Екатерина, Екатеринбург · ЕГЭ · обществознание · в паре', t: '90 баллов и всего 3 ошибки', m: 'm-book', vb: '0 0 160 210', a: '#C7B6FF', b: '#8E72F5',
      parts: [['Как занимались', 'Раз в неделю в паре, с ноября. Были пропуски из-за каникул, но мы продолжали работать по системе.'], ['Итог', '90 баллов по обществознанию, всего 3 ошибки на экзамене. Результат системной подготовки и работы ученицы.']] },
    { k: 'Семён · ОГЭ‑2026 · обществознание · +23 балла', t: '36 из 37 на ОГЭ', m: 'm-clip', vb: '0 0 170 220', a: '#FFB8A1', b: '#FF6A45',
      parts: [['Как занимались', 'Всего раз в неделю по 45 минут, с декабря до июня.'], ['Итог', '36 баллов из 37 возможных. Семён перешёл в 10 класс, и мы продолжаем работу.']] },
    { k: 'София · ЕГЭ · пересдача · +19 баллов', t: 'Пересдача за две недели', m: 'm-hourglass', vb: '0 0 150 220', a: '#9FD8FF', b: '#3D8BFF',
      parts: [['С чем пришла', 'Нашла меня на Авито. До пересдачи оставалось всего две недели.'], ['Что делали', 'Системно разобрали ошибки, закрыли пробелы и подготовились по моей методике.'], ['Итог', 'Поступление в Санкт-Петербургский институт культуры, профессия — лингвист-переводчик.']] },
    { k: 'Фатима · ОГЭ · история · 1 месяц', t: 'Месяц до экзамена', m: 'm-medal', vb: '0 0 170 230', a: '#FFE08A', b: '#F5A623',
      parts: [['Что делали', 'Сразу определили чёткий маршрут: что изучаем, какие темы в приоритете и на чём сосредоточиться в первую очередь.'], ['Итог', 'Четвёрка на ОГЭ по истории.']],
      quote: '«Честно, я очень переживала: взяла на себя большую ответственность. Когда времени мало, особенно важны система, стратегия и работа без лишнего».' }
  ];
  $$('[data-story-open]').forEach(function (b) {
    b.addEventListener('click', function () {
      var o = ST[+b.closest('[data-story]').dataset.story];
      var html = o.parts.map(function (p) { return '<h4>' + p[0] + '</h4><p>' + p[1] + '</p>'; }).join('') + (o.quote ? '<blockquote>' + o.quote + '</blockquote>' : '');
      openModal({ k: o.k, t: o.t, m: o.m, vb: o.vb, a: o.a, b: o.b, html: html });
    });
  });

  /* ---------- карточки «С чем приходят»: перевернуть и потянуть ---------- */
  $$('.stk').forEach(function (s) {
    var sx, sy0, drag = false, down = false, id;
    s.addEventListener('pointerdown', function (e) {
      down = true; drag = false; sx = e.clientX; sy0 = e.clientY; id = e.pointerId;
    });
    s.addEventListener('pointermove', function (e) {
      if (!down || e.pointerType === 'touch') return;
      var dx = e.clientX - sx, dy = e.clientY - sy0;
      if (!drag && Math.hypot(dx, dy) > 6) { drag = true; s.classList.add('drag'); try { s.setPointerCapture(id); } catch (er) {} }
      if (drag) {
        s.style.setProperty('--dx', dx + 'px'); s.style.setProperty('--dy', dy + 'px'); s.style.setProperty('--dr', clamp(dx * 0.06, -18, 18) + 'deg');
      }
    });
    function up() {
      if (!down) return; down = false;
      if (drag) {
        s.classList.remove('drag');
        s.style.setProperty('--dx', '0px'); s.style.setProperty('--dy', '0px'); s.style.setProperty('--dr', '0deg');
      } else s.classList.toggle('flip');
    }
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', function () { down = false; drag = false; s.classList.remove('drag'); s.style.setProperty('--dx', '0px'); s.style.setProperty('--dy', '0px'); s.style.setProperty('--dr', '0deg'); });
    s.setAttribute('tabindex', '0'); s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Перевернуть карточку');
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.classList.toggle('flip'); } });
  });

  /* ---------- ленты (истории, фото): перетаскивание мышью ---------- */
  $$('.car').forEach(function (car) {
    var down = false, x0, s0, moved = 0, vx = 0, lx = 0, lt = 0, raf;
    // картинки не утаскивать браузером, текст не выделять — иначе мышь «залипает» на фото
    $$('img', car).forEach(function (im) { im.draggable = false; });
    car.addEventListener('dragstart', function (e) { e.preventDefault(); });
    car.addEventListener('mousedown', function (e) { if (e.button === 0 && !e.target.closest('button, a')) e.preventDefault(); });
    addEventListener('pointercancel', function () { if (down) { down = false; car.classList.remove('dragging'); } });
    var wrap = car.parentNode, eL = $('.car-edge-l', wrap), eR = $('.car-edge-r', wrap);
    function edges() {
      if (!eL) return;
      var max = car.scrollWidth - car.clientWidth - 4;
      eL.hidden = car.scrollLeft <= 4; eR.hidden = car.scrollLeft >= max;
    }
    car.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges); addEventListener('load', edges); edges();
    car.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = 0; x0 = e.clientX; s0 = car.scrollLeft; lx = e.clientX; lt = performance.now(); vx = 0; cancelAnimationFrame(raf);
    });
    addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - x0; moved = Math.max(moved, Math.abs(dx));
      if (moved > 5) car.classList.add('dragging');
      car.scrollLeft = s0 - dx;
      var t = performance.now(); vx = (e.clientX - lx) / Math.max(1, t - lt); lx = e.clientX; lt = t;
    });
    addEventListener('pointerup', function () {
      if (!down) return; down = false;
      setTimeout(function () { car.classList.remove('dragging'); }, 0);
      var v = -vx * 16;
      (function glide() { if (Math.abs(v) < 0.4) return; car.scrollLeft += v; v *= 0.94; raf = requestAnimationFrame(glide); })();
    });
    $$('[data-car]', car.closest('section')).forEach(function (b) {
      b.addEventListener('click', function () {
        var w = Math.max(car.querySelector('.car-in').firstElementChild.offsetWidth + 18, car.clientWidth * 0.6);
        car.scrollBy({ left: w * +b.dataset.car, behavior: RM ? 'auto' : 'smooth' });
      });
    });
  });

  /* ---------- фото ---------- */
  var PH = [
    { k: '«Учитель года Адыгеи — 2022»', t: 'Это меня награждает Глава Адыгеи Мурат Каральбиевич Кумпилов', img: 'oksana-kumpilov', a: '#FFC24D', b: '#F08A12',
      txt: ['Призёр республиканского конкурса «Учитель года Адыгеи», ТОП‑5 учителей республики.'] },
    { k: 'Итоги конкурса', t: 'Призёр республиканского этапа «Учитель года Адыгеи» в 2022 году', img: 'uchitel-goda-itogi', a: '#C9B6FF', b: '#7C5CFF', txt: [] },
    { k: 'Выступление', t: 'На выступлении', img: 'oksana-podium', a: '#7FE0A0', b: '#21A856', txt: [] },
    { k: 'Республика Адыгея', t: 'Фестиваль педагогических команд «Дорогами мастерства»', img: 'festival-2025', a: '#9CC0FF', b: '#2F6BFF',
      txt: ['Педагогические фестивали и профессиональные встречи — часть моего пути.'] }
  ];
  $$('[data-photo]').forEach(function (f) {
    f.addEventListener('click', function () {
      var o = PH[+f.dataset.photo];
      openModal({ k: o.k, t: o.t, m: 'm-medal', vb: '0 0 170 230', a: o.a, b: o.b, img: 'assets/photos/' + o.img + '.webp', html: P_(o.txt) });
    });
  });

  /* ---------- переписки с учениками ---------- */
  var rvStrip = $('.rv-strip');
  if (rvStrip) rvStrip.addEventListener('click', function (e) {
    var b = e.target.closest('.rvc'); if (!b) return;
    openModal({ k: 'Из переписки с учеником', t: 'Что пишут после экзаменов', m: 'm-heart', vb: '0 0 180 175', a: '#E7DDFF', b: '#C9B6FF', img: b.dataset.rev,
      html: '<p>Все 50 отзывов учеников и родителей — в профиле на Авито.</p>' });
  });

  /* ---------- сборщик сообщения ---------- */
  var B = $('[data-builder]'), bdText = $('[data-bd-text]');
  function pick(k) { var b = $('[data-k="' + k + '"] .is-on', B); return b ? b.textContent.replace(/ /g, ' ').trim() : ''; }
  function msgText() {
    var fmt = pick('fmt'), lines = ['Здравствуйте, Оксана Олеговна!'];
    lines.push(pick('who') === 'Родитель' ? 'Пишу как родитель.' : 'Пишу как ученик.');
    lines.push('Готовимся: ' + pick('exam') + '.');
    lines.push('Предмет: ' + pick('subj').toLowerCase() + '.');
    lines.push('Сейчас: ' + pick('lvl').toLowerCase() + '.');
    lines.push(fmt === 'Помогите выбрать' ? 'С форматом помогите выбрать.' : 'Удобный формат: ' + fmt.toLowerCase() + '.');
    lines.push('Хотим записаться на бесплатный пробный урок.');
    return lines.join('\n');
  }
  function bdRender(flash) {
    bdText.textContent = msgText();
    if (flash) { bdText.classList.remove('flash'); void bdText.offsetWidth; bdText.classList.add('flash'); }
  }
  $$('.bd-ch', B).forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('button', g).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      bdRender(true);
    });
  });
  $$('[data-format]').forEach(function (a) {
    a.addEventListener('click', function () {
      var f = a.dataset.format;
      $$('[data-k="fmt"] button', B).forEach(function (x) { x.classList.toggle('is-on', x.textContent.trim() === f); });
      bdRender(true);
    });
  });
  function copy(t, cb) {
    function fallback() {
      var ta = d.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      d.body.appendChild(ta); ta.select(); var ok = false; try { ok = d.execCommand('copy'); } catch (e) {} ta.remove(); cb(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(function () { cb(true); }, fallback);
    else fallback();
  }
  $('[data-bd-copy]').addEventListener('click', function () {
    copy(msgText(), function (ok) { toast(ok ? 'Текст скопирован' : 'Не удалось скопировать — выделите текст вручную'); });
  });
  $('[data-bd-send]').addEventListener('click', function (e) {
    e.preventDefault();
    var u = contactUrl('telegram'), w = u ? window.open('', '_blank') : null;
    copy(msgText(), function (ok) {
      if (u) { if (w) w.location.href = u; else location.href = u; toast(ok ? 'Текст скопирован — вставьте его в чат' : 'Откроется Telegram — перепишите текст из окна'); }
      else toast(ok ? 'Текст скопирован. Ссылка на Telegram скоро появится' : 'Ссылка на Telegram скоро появится');
    });
  });
  bdRender(false);

  /* ---------- вопросы ---------- */
  $$('.fq').forEach(function (f) {
    var q = $('.fq-q', f);
    q.addEventListener('click', function () {
      var open = !f.classList.contains('open');
      $$('.fq.open').forEach(function (x) { if (x !== f) { x.classList.remove('open'); $('.fq-q', x).setAttribute('aria-expanded', 'false'); } });
      f.classList.toggle('open', open); q.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- плавающая картинка у списков ---------- */
  var hp = $('.hp'), hpIn = $('.hp-in'), hpOn = false, hx = mx, hy = my;
  var PAPER = function (t) {
    return '<svg viewBox="0 0 200 240"><rect x="14" y="10" width="172" height="220" rx="16" fill="#fff"/><rect x="34" y="34" width="96" height="12" rx="6" fill="#14161D"/><rect x="34" y="54" width="70" height="12" rx="6" fill="#14161D"/>' +
      '<g fill="#E3E6EE"><rect x="34" y="84" width="132" height="7" rx="3.5"/><rect x="34" y="98" width="120" height="7" rx="3.5"/><rect x="34" y="112" width="128" height="7" rx="3.5"/><rect x="34" y="126" width="96" height="7" rx="3.5"/><rect x="34" y="148" width="132" height="7" rx="3.5"/><rect x="34" y="162" width="110" height="7" rx="3.5"/></g>' +
      '<circle cx="150" cy="198" r="20" fill="#FF5A36"/><text x="150" y="202" text-anchor="middle" font-family="Onest,sans-serif" font-size="10" font-weight="700" fill="#fff">' + t + '</text></svg>';
  };
  var HP = {
    pubs: [{ bg: '#FFE3D9', html: PAPER('РИНЦ') }, { bg: '#DCEBFF', html: PAPER('2017') }],
    faq: [['m-hourglass', '0 0 150 220', '#FFE3D9'], ['m-panic', '0 0 190 210', '#FFF0BD'], ['m-medal', '0 0 170 230', '#E9FFB0'], ['m-book', '0 0 160 210', '#DCEBFF'], ['m-owl', '0 0 180 210', '#E7DDFF'], ['m-heart', '0 0 180 175', '#FFE0EC'], ['m-clip', '0 0 170 220', '#E3F7A6'], ['m-qmark', '0 0 200 210', '#D3F4F8']]
  };
  if (FINE && !RM) {
    $$('[data-hp]').forEach(function (list) {
      var kind = list.classList.contains('pub-list') ? 'pubs' : 'faq';
      $$('[data-hp-i]', list).forEach(function (it) {
        it.addEventListener('pointerenter', function () {
          var i = +it.dataset.hpI, o = HP[kind][i];
          if (kind === 'pubs') { hp.style.setProperty('--hp-bg', o.bg); hpIn.innerHTML = o.html; }
          else { hp.style.setProperty('--hp-bg', o[2]); hpIn.innerHTML = useSvg(o[0], o[1]); }
          if (!hpOn) { hx = mx; hy = my; }
          hpOn = true; hp.classList.add('on');
        });
      });
      list.addEventListener('pointerleave', function () { hpOn = false; hp.classList.remove('on'); });
    });
  }

  /* ---------- магнит, наклон ---------- */
  if (FINE && !RM) {
    $$('.mag').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.translate = (x * 0.25).toFixed(1) + 'px ' + (y * 0.35).toFixed(1) + 'px';
      });
      el.addEventListener('pointerleave', function () { el.style.translate = ''; });
    });
    $$('[data-tilt]').forEach(function (el) {
      el.style.transition = 'transform .6s cubic-bezier(.2,.9,.2,1)';
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(1000px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- курсор ---------- */
  var cur = $('.cur'), cDot = $('.cur-dot'), cRing = $('.cur-ring'), cLab = $('.cur-label'), rx = mx, ry = my;
  if (FINE && !RM) {
    root.classList.add('has-cursor');
    d.addEventListener('pointerover', function (e) {
      var t = e.target.closest('a, button, [data-cursor], .stk, .fc, .ph, .rvc, .car');
      var lab = '';
      if (t) lab = t.dataset.cursor || (t.matches('.fc, .ph, .rvc') ? 'Смотреть' : t.matches('.stk') ? 'Нажать' : t.matches('.car') ? 'Тянуть' : '');
      cur.classList.toggle('hover', !!t && !lab);
      cur.classList.toggle('label', !!lab);
      if (lab) cLab.textContent = lab;
    });
    d.addEventListener('pointerleave', function () { cur.style.opacity = '0'; });
    d.addEventListener('pointerenter', function () { cur.style.opacity = ''; });
  }
  addEventListener('pointermove', function (e) {
    mx = e.clientX; my = e.clientY;
    if (FINE) cDot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
  }, { passive: true });

  /* ---------- глаз ---------- */
  var eye = $('.eye'), eyeP = $('.eye-p');
  function blink() {
    if (eye) { eye.classList.add('blink'); setTimeout(function () { eye.classList.remove('blink'); }, 160); }
    setTimeout(blink, 2600 + Math.random() * 3200);
  }
  if (eye && !RM) setTimeout(blink, 2000);

  /* ---------- курсоры с именами на первом экране ---------- */
  var botsBox = $('.bots'), bots = $$('.bots .bot').map(function (el, i) {
    return { el: el, x: 80 + i * 200, y: 200 + i * 120, tx: 0, ty: 0, t: 0, sp: 0.012 + i * 0.004 };
  });
  var heroRect = { w: vw, h: vh };
  function botTarget(b) {
    b.tx = 40 + Math.random() * (heroRect.w - 160);
    b.ty = 90 + Math.random() * (heroRect.h - 200);
    b.t = performance.now() + 2200 + Math.random() * 2600;
  }
  bots.forEach(botTarget);

  /* ---------- бегущие строки ---------- */
  var marquees = $$('[data-marquee]').map(function (m) {
    var tr = $('.mq-track', m), html = tr.innerHTML;
    tr.innerHTML = html + html.replace(/<(span|svg|button)/g, '<$1 aria-hidden="true" tabindex="-1"');
    var o = { m: m, tr: tr, x: 0, w: tr.scrollWidth / 2, sp: parseFloat(m.dataset.speed || '1'), vis: false, flat: m.classList.contains('marquee-s') || m.hasAttribute('data-pause') };
    if (m.hasAttribute('data-pause') && FINE) { m.addEventListener('pointerenter', function () { o.hold = true; }); m.addEventListener('pointerleave', function () { o.hold = false; }); }
    $$('img', tr).forEach(function (im) { im.addEventListener('load', function () { o.w = tr.scrollWidth / 2; }); });
    new IntersectionObserver(function (es) { o.vis = es[0].isIntersecting; }).observe(m);
    return o;
  });
  // лента отзывов: на телефоне и планшете — обычная прокрутка пальцем вместо бегущей строки
  var touchMQ = matchMedia('(max-width: 760px), (hover: none)');
  function marqueeMode() {
    marquees.forEach(function (o) {
      if (!o.m.hasAttribute('data-pause')) return;
      o.native = touchMQ.matches; o.m.classList.toggle('rv-scroll', o.native);
      if (o.native) { o.tr.style.transform = ''; o.x = 0; }
    });
  }
  if (touchMQ.addEventListener) touchMQ.addEventListener('change', marqueeMode); else touchMQ.addListener(marqueeMode);
  marqueeMode();

  /* ---------- телефон: точки под лентами и лёгкий «толчок» — видно, что их листают ---------- */
  (function () {
    var mq = matchMedia('(max-width: 760px)');
    [['.sit-grid', '.stk'], ['.path-track', '.pc'], ['.fan', '.fc'], ['.plans', '.plan'],
     ['.car-ph', '.car-in > .ph'], ['[data-car-track]', '.car-in > .cs'], ['.rv-strip', '.mq-track > .rvc:not([aria-hidden])']
    ].forEach(function (df) {
      var sc = $(df[0]); if (!sc) return;
      var items = $$(df[1], sc); if (items.length < 2) return;
      var dots = d.createElement('div'); dots.className = 'dots'; dots.setAttribute('aria-hidden', 'true');
      items.forEach(function (it) {
        var b = d.createElement('button'); b.type = 'button'; b.tabIndex = -1;
        b.addEventListener('click', function () {
          var r = it.getBoundingClientRect(), s = sc.getBoundingClientRect();
          sc.scrollTo({ left: sc.scrollLeft + r.left - s.left - (sc.clientWidth - r.width) / 2, behavior: RM ? 'auto' : 'smooth' });
        });
        dots.appendChild(b);
      });
      sc.parentNode.insertBefore(dots, sc.nextSibling);
      var btns = $$('button', dots), cur = -1;
      function mark() {
        var s = sc.getBoundingClientRect(), mid = s.left + sc.clientWidth / 2, best = 0, bd = 1e9;
        items.forEach(function (it, i) { var r = it.getBoundingClientRect(), dd = Math.abs(r.left + r.width / 2 - mid); if (dd < bd) { bd = dd; best = i; } });
        if (sc.scrollLeft < 4) best = 0;
        if (sc.scrollLeft > sc.scrollWidth - sc.clientWidth - 4) best = items.length - 1;
        if (best === cur) return; cur = best;
        btns.forEach(function (b, i) { b.classList.toggle('on', i === best); });
      }
      sc.addEventListener('scroll', mark, { passive: true });
      addEventListener('resize', mark); mark();
      // один раз, когда лента впервые видна: карточки чуть «съезжают» влево и возвращаются
      var moving = sc.matches('.car-ph, [data-car-track]') ? [$('.car-in', sc)] : sc.matches('.rv-strip') ? [$('.mq-track', sc)] : items;
      var done = false;
      new IntersectionObserver(function (es, ob) {
        if (done || !es[0].isIntersecting || !mq.matches || RM || sc.scrollLeft > 4) return;
        done = true; ob.disconnect();
        setTimeout(function () {
          moving.forEach(function (m) { m.classList.add('nudge'); });
          setTimeout(function () { moving.forEach(function (m) { m.classList.remove('nudge'); }); }, 1300);
        }, 900);
      }, { threshold: 0.6 }).observe(sc);
    });
  })();

  /* ---------- главный цикл ---------- */
  var vel = 0, lastSy = sy, dir = 1, heroVis = true;
  new IntersectionObserver(function (es) { heroVis = es[0].isIntersecting; }).observe(hero);
  function loop(t) {
    var dy = sy - lastSy; lastSy = sy; vel = lerp(vel, dy, 0.15);
    if (Math.abs(vel) > 0.6) dir = vel > 0 ? 1 : -1;
    if (!RM) {
      marquees.forEach(function (o) {
        if (!o.vis || !o.w || o.hold || o.native) return;
        o.x -= (0.55 * o.sp + Math.min(Math.abs(vel) * 0.35, 14)) * dir;
        if (o.x <= -o.w) o.x += o.w; if (o.x > 0) o.x -= o.w;
        var sk = o.flat ? 0 : clamp(-vel * 0.25, -8, 8);
        o.tr.style.transform = 'translate3d(' + o.x.toFixed(1) + 'px,0,0) skewX(' + sk.toFixed(2) + 'deg)';
      });
      if (heroVis && bots.length) {
        var hr = hero.getBoundingClientRect(), inHero = mx > hr.left && mx < hr.right && my > hr.top && my < hr.bottom;
        heroRect.w = hr.width; heroRect.h = hr.height;
        bots.forEach(function (b, i) {
          if (i === 0 && inHero && FINE) { b.tx = mx - hr.left + 46; b.ty = my - hr.top + 34; }
          else if (t > b.t) botTarget(b);
          b.x = lerp(b.x, b.tx, b.sp); b.y = lerp(b.y, b.ty, b.sp);
          b.el.style.transform = 'translate3d(' + b.x.toFixed(1) + 'px,' + b.y.toFixed(1) + 'px,0)';
        });
      }
      if (eyeP) {
        var er = eye.getBoundingClientRect();
        if (er.bottom > 0 && er.top < vh) {
          var ex = clamp((mx - (er.left + er.width / 2)) / (vw * 0.5), -1, 1), ey = clamp((my - (er.top + er.height / 2)) / (vh * 0.5), -1, 1);
          eyeP._x = lerp(eyeP._x || 0, ex * 30, 0.12); eyeP._y = lerp(eyeP._y || 0, ey * 14, 0.12);
          eyeP.setAttribute('transform', 'translate(' + eyeP._x.toFixed(2) + ' ' + eyeP._y.toFixed(2) + ')');
        }
      }
      if (hpOn || hp.classList.contains('on')) {
        var px = hx; hx = lerp(hx, mx, 0.14); hy = lerp(hy, my, 0.14);
        hp.style.transform = 'translate3d(' + (hx - 105).toFixed(1) + 'px,' + (hy - 125).toFixed(1) + 'px,0) rotate(' + clamp((hx - px) * 0.9, -14, 14).toFixed(2) + 'deg)';
      }
    }
    if (FINE && !RM) {
      rx = lerp(rx, mx, 0.2); ry = lerp(ry, my, 0.2);
      cRing.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- прокрутка и размеры ---------- */
  function onScroll() {
    sy = scrollY;
    navUpdate(); scrubUpdate(); drawUpdate(); megaUpdate(); stackUpdate(); pathUpdate();
  }
  addEventListener('scroll', onScroll, { passive: true });
  var rT;
  function onResize() {
    vw = innerWidth; vh = innerHeight;
    fitH1(); pathMeasure(); fanLayout(); curSpy = -2; curYear = -1;
    marquees.forEach(function (o) { o.w = o.tr.scrollWidth / 2; });
    onScroll();
  }
  addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(onResize, 120); });
  addEventListener('load', onResize);
  pathMeasure(); onScroll();
})();
