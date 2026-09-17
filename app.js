(function () {
  'use strict';

  var ICONS = window.LISI_ICONS || {};
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) node.append(arguments[i]);
    return node;
  }

  function icon(type) {
    return svgFrom(ICONS[type] || ICONS.website);
  }

  function svgFrom(def) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', def.path);
    if (def.stroke) {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    } else {
      svg.setAttribute('fill', 'currentColor');
    }
    svg.append(path);
    return svg;
  }

  // пустая строка — новый абзац, одиночный перенос — перенос строки
  function paragraphs(container, text) {
    container.replaceChildren();
    String(text || '').split(/\n\s*\n/).forEach(function (chunk) {
      if (!chunk.trim()) return;
      var p = el('p');
      chunk.split('\n').forEach(function (lineText, i) {
        if (i) p.append(el('br'));
        p.append(lineText);
      });
      container.append(p);
    });
  }

  function safeStorage(action, key, value) {
    try {
      if (action === 'get') return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* приватный режим — просто не запоминаем */ }
    return null;
  }

  // ---------------------------------------------------------- статистика переходов
  // Работает только на опубликованном сайте: config.js задаёт LISI_STATS.
  // Ни имён, ни IP: случайный номер гостя в браузере, тип устройства,
  // откуда пришёл, язык и часовой пояс.

  var STATS = window.LISI_STATS || null;

  function visitorId() {
    var id = safeStorage('get', 'lisi:visitor');
    if (!id || !/^[a-z0-9]{6,32}$/.test(id)) {
      id = (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 16);
      safeStorage('set', 'lisi:visitor', id);
    }
    return id;
  }

  function deviceType() {
    if (!window.matchMedia('(pointer: coarse)').matches) return 'desktop';
    return Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'mobile';
  }

  function referrerHost() {
    try {
      if (!document.referrer) return '';
      var host = new URL(document.referrer).hostname.replace(/^www\./, '');
      return host === location.hostname ? '' : host.slice(0, 120);
    } catch (e) {
      return '';
    }
  }

  function track(type, target, label, item) {
    if (!STATS || !STATS.url || !STATS.key) return;
    var zone = '';
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) { /* старый браузер */ }
    var request = {
      method: 'POST',
      headers: { apikey: STATS.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        type: type,
        target: String(target || 'other').slice(0, 40),
        label: label ? String(label).slice(0, 160) : null,
        item: item ? String(item).slice(0, 80) : null,
        visitor: visitorId(),
        device: deviceType(),
        referrer: type === 'visit' ? referrerHost() : null,
        lang: (navigator.language || '').slice(0, 20),
        tz: zone.slice(0, 60)
      })
    };
    try {
      // keepalive — чтобы запрос не оборвался, если страница сразу закроется;
      // если браузер так не умеет, шлём обычным запросом
      fetch(STATS.url, Object.assign({ keepalive: true }, request)).catch(function () {
        fetch(STATS.url, request).catch(function () {});
      });
    } catch (e) { /* статистика не должна ломать сайт */ }
  }

  // и обычный клик, и колёсиком «открыть в новой вкладке» — это переход
  function onOpen(node, handler) {
    node.addEventListener('click', handler);
    node.addEventListener('auxclick', function (e) { if (e.button === 1) handler(e); });
  }

  function trackVisit() {
    try {
      if (sessionStorage.getItem('lisi:visit')) return;
      sessionStorage.setItem('lisi:visit', '1');
    } catch (e) { /* без sessionStorage считаем каждую загрузку */ }
    track('visit', 'page');
  }

  // На своём сервере данные встроены в страницу, на GitHub Pages лежат рядом в content.json.
  // Пути к своим файлам делаем относительными, чтобы сайт работал в любой папке.
  function asset(u) {
    return typeof u === 'string' && /^\/(uploads|music)\//.test(u) ? u.slice(1) : u;
  }

  // ---------------------------------------------------------- лёгкие картинки
  // Свои загрузки бывают по 5–8 МБ, а фото из VK приходят оригиналами на 2–5 МБ.
  // В сетке показываем уменьшенные копии, оригинал грузим только при просмотре.
  // Копии своих загрузок лежат в uploads/thumbs/ (их делает панель); если копии нет — берём оригинал.

  var THUMBS = window.LISI_THUMBS || '';
  var noPreview = {};

  // VK отдаёт фото любой ширины из списка as по параметру cs
  function vkSized(src, px) {
    if (!/^https:\/\/[\w.-]+\.(vkuserphoto\.ru|userapi\.com)\//.test(src)) return src;
    try {
      var u = new URL(src);
      var widths = (u.searchParams.get('as') || '').split(',').map(function (s) { return parseInt(s, 10); }).filter(Boolean);
      if (!u.searchParams.get('cs') || !widths.length) return src;
      widths.sort(function (a, b) { return a - b; });
      u.searchParams.set('cs', (widths.filter(function (w) { return w >= px; })[0] || widths[widths.length - 1]) + 'x0');
      return u.href;
    } catch (e) {
      return src;
    }
  }

  function preview(src, px) {
    if (!src || noPreview[src]) return src;
    var own = THUMBS && /^uploads\/(img-[\w-]+)\.(png|jpe?g|webp|avif)$/i.exec(src);
    return own ? THUMBS + own[1] + '.webp' : vkSized(src, px);
  }

  // если уменьшенная копия не открылась — показываем оригинал, и только потом сдаёмся
  function setImage(img, src, px, onFail) {
    var small = preview(src, px);
    var fallback = small === src;
    img.onerror = function () {
      if (!fallback) {
        fallback = true;
        noPreview[src] = true;
        img.src = src;
        return;
      }
      img.onerror = null;
      if (onFail) onFail();
    };
    img.src = small;
  }

  function localize(d) {
    d.profile.avatar = asset(d.profile.avatar);
    d.profile.cover = asset(d.profile.cover);
    d.music.src = asset(d.music.src);
    d.commissions.categories.forEach(function (c) {
      c.sheet = asset(c.sheet);
      c.images = c.images.map(asset);
    });
    if (d.merch) d.merch.items.forEach(function (it) { it.image = asset(it.image); });
    return d;
  }

  function main(data) {
  // ---------------------------------------------------------- шапка и ссылки

  var profile = data.profile;
  document.title = profile.name ? profile.name + ' ♡' : document.title;
  $('name').textContent = profile.name;
  $('roles').textContent = profile.roles;
  $('greeting').textContent = profile.greeting;
  $('orderButtonText').textContent = profile.orderButton || 'заказать арт';
  if (profile.avatar) {
    setImage($('avatar'), profile.avatar, 480);
    setImage($('gateAvatar'), profile.avatar, 480);
    setImage($('discImg'), profile.avatar, 480);
  }
  $('avatar').alt = profile.name;
  if (profile.cover) $('cover').style.backgroundImage = 'url(' + JSON.stringify(profile.cover) + ')';

  var linksBox = $('links');
  (data.links || []).forEach(function (link) {
    if (!link.visible || !link.url) return;
    var def = ICONS[link.type] || ICONS.website;
    var a = el('a', {
      class: 'link',
      href: link.url,
      target: /^mailto:/.test(link.url) ? null : '_blank',
      rel: 'noopener noreferrer me'
    }, el('span', { class: 'link__icon' }, icon(link.type)), el('span', { text: link.label || def.label }));
    a.style.setProperty('--brand', def.color);
    onOpen(a, function () { track('link', link.type, link.label || def.label, link.id); });
    linksBox.append(a);
  });

  // ---------------------------------------------------------- обо мне

  var about = data.about;
  if (!about.enabled || (!about.text.trim() && !about.facts.length)) {
    $('about').remove();
    $('aboutButton').remove();
  } else {
    $('aboutTitle').textContent = about.title;
    $('aboutButton').textContent = about.title;
    paragraphs($('aboutText'), about.text);
    about.facts.forEach(function (fact) {
      if (!fact.label && !fact.value) return;
      $('facts').append(el('li', { class: 'fact' },
        el('span', { class: 'fact__emoji', text: fact.emoji || '♡' }),
        el('span', null, el('span', { class: 'fact__label', text: fact.label }), el('span', { class: 'fact__value', text: fact.value }))
      ));
    });
    $('signature').textContent = about.signature;
  }

  // ---------------------------------------------------------- заказы

  var com = data.commissions;
  var categories = com.categories.filter(function (c) { return c.prices.length || c.images.length || c.sheet; });

  $('statusText').textContent = com.open ? com.openText : com.closedText;
  $('status').classList.toggle('is-closed', !com.open);
  if (com.open && com.openText) {
    $('avatarBadge').textContent = com.openText;
    $('avatarBadge').hidden = false;
  }
  if (com.contactUrl && com.contactLabel) {
    $('contact').href = com.contactUrl;
    $('contact').textContent = com.contactLabel;
    onOpen($('contact'), function () {
      track('contact', 'contact', com.contactLabel);
      var cat = categories[current];
      var text = cat && orderText(cat);
      if (!text) return;
      copyText(text).then(function () {
        siteToast('Текст заказа скопирован ♡ Вставь его в чат');
      }, function () { /* не вышло — просто откроется чат */ });
    });
  } else {
    $('contact').remove();
  }
  if (com.deadline) $('deadline').textContent = com.deadline;
  else $('deadlineRow').remove();

  com.rules.forEach(function (rule) { $('rules').append(el('li', { text: rule })); });
  if (!com.rules.length) $('rulesBox').remove();

  var tabs = $('tabs');
  var current = 0;
  var expanded = false;
  var ratios = {};
  var layoutFrame = 0;
  var phone = window.matchMedia('(max-width: 720px)');

  function galleryPreview() { return phone.matches ? 9 : 12; }

  // Ряды одной высоты, растянутые на всю ширину: как в фотоальбоме.
  // Пропорции каждого арта известны после загрузки, до неё считаем 4:5.
  function layoutGallery() {
    var box = $('gallery');
    if (!box) return;
    var width = box.clientWidth;
    if (!width) return;
    var gap = parseFloat(getComputedStyle(box).columnGap) || 10;
    var target = width < 480 ? 140 : width < 760 ? 190 : 250;
    var row = [];
    var sum = 0;
    function place(isLast) {
      var height = (width - gap * (row.length - 1)) / sum;
      var stretch = !(isLast && height > target * 1.35);
      if (!stretch) height = target;
      height = Math.min(height, target * 2);
      row.forEach(function (item, k) {
        item.node.style.height = Math.round(height) + 'px';
        item.node.style.width = Math.floor(item.ratio * height) + 'px';
        item.node.classList.toggle('is-grow', stretch && k === row.length - 1);
      });
      row = [];
      sum = 0;
    }
    Array.prototype.forEach.call(box.querySelectorAll('.shot'), function (node) {
      var ratio = parseFloat(node.dataset.ratio) || 0.8;
      row.push({ node: node, ratio: ratio });
      sum += ratio;
      if (sum * target + gap * (row.length - 1) >= width) place(false);
    });
    if (row.length) place(true);
  }

  function scheduleLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layoutGallery);
  }

  function moveIndicator() {
    var active = tabs.querySelector('[aria-selected="true"]');
    if (!active) return;
    tabs.style.setProperty('--x', active.offsetLeft + 'px');
    tabs.style.setProperty('--w', active.offsetWidth + 'px');
  }

  // ---------------------------------------------------------- калькулятор
  // Пункты прайса можно отмечать: размер (один), вариант вроде фона (один или ни одного),
  // добавки и «ещё один персонаж» со счётчиком. Внизу — примерная сумма, а кнопка связи
  // копирует готовый текст заказа.

  var calc = {};
  var nf = window.Intl ? new Intl.NumberFormat('ru-RU') : { format: String };

  function priceKind(p) {
    if (p.kind) return p.kind;
    var price = String(p.price || '');
    if (!/\d/.test(price)) return 'none';
    if (/%/.test(price)) return /персонаж|character|челов|ещё од|еще од/i.test(p.label) ? 'each' : 'add';
    if (/фон|background/i.test(p.label)) return 'choice';
    if (/^\s*\+/.test(price)) return 'add';
    return 'base';
  }

  function priceAmount(price) {
    var m = String(price).replace(/(\d)[\s ](?=\d{3}(\D|$))/g, '$1').match(/\d+(?:[.,]\d+)?/);
    return m ? parseFloat(m[0].replace(',', '.')) : 0;
  }

  function calcState(cat) {
    if (!calc[cat.id]) calc[cat.id] = { base: '', choice: '', add: {}, each: {} };
    return calc[cat.id];
  }

  function calcSummary(cat) {
    var st = calcState(cat);
    var byId = {};
    cat.prices.forEach(function (p) { byId[p.id] = p; });
    var base = byId[st.base];
    var parts = [];
    var picked = [];
    if (base) { parts.push(base.label); picked.push(base); }
    if (byId[st.choice]) { parts.push(byId[st.choice].label); picked.push(byId[st.choice]); }
    cat.prices.forEach(function (p) {
      if (st.add[p.id]) { parts.push(p.label); picked.push(p); }
      if (st.each[p.id] > 0) { parts.push(p.label + ' ×' + st.each[p.id]); picked.push(p); }
    });
    if (!picked.length) return null;
    if (!base) return { parts: parts, text: 'выбери размер ✦' };
    var baseSum = priceAmount(base.price);
    var total = baseSum;
    var cost = function (p) { return /%/.test(p.price) ? baseSum * priceAmount(p.price) / 100 : priceAmount(p.price); };
    picked.forEach(function (p) {
      if (p === base) return;
      total += cost(p) * (st.each[p.id] > 0 ? st.each[p.id] : 1);
    });
    var currency = (String(base.price).match(/[₽$€£¥]|руб/) || ['₽'])[0];
    var from = picked.some(function (p) { return /^\s*(от|from|~)/i.test(p.price); });
    return { parts: parts, total: total, text: (from ? 'от ' : '') + nf.format(Math.round(total)) + ' ' + currency };
  }

  function renderPrices(cat) {
    var prices = $('prices');
    var st = calcState(cat);
    prices.replaceChildren();
    if (!cat.prices.length) {
      prices.append(el('li', { class: 'prices__empty', text: 'цены уточняй в личке ♡' }));
      $('calc').hidden = true;
      return;
    }
    var usable = cat.prices.some(function (p) { return priceKind(p) === 'base' && priceAmount(p.price) > 0; });

    cat.prices.forEach(function (p) {
      var kind = usable ? priceKind(p) : 'none';
      var li = el('li', { class: 'price' },
        el('span', { class: 'price__label', text: p.label }), el('span', { class: 'price__dots' }), el('span', { class: 'price__value', text: p.price }));
      if (kind === 'base' || kind === 'choice' || kind === 'add') {
        var isOn = kind === 'add' ? !!st.add[p.id] : st[kind] === p.id;
        var box = el('input', { type: kind === 'add' ? 'checkbox' : 'radio', name: 'calc-' + kind, class: 'sr' });
        box.checked = isOn;
        li = el('li', { class: 'price price--pick price--' + kind + (isOn ? ' is-on' : '') });
        var label = el('label', { class: 'price__row' }, box, el('span', { class: 'price__mark', 'aria-hidden': 'true' }),
          el('span', { class: 'price__label', text: p.label }), el('span', { class: 'price__dots' }), el('span', { class: 'price__value', text: p.price }));
        li.append(label);
        // радио нельзя снять повторным нажатием — для размера и фона делаем это сами
        box.addEventListener('click', function () {
          if (kind === 'add') st.add[p.id] = box.checked;
          else st[kind] = st[kind] === p.id ? '' : p.id;
          renderPrices(cat);
          var again = $('prices').querySelector('[data-id="' + p.id + '"] input');
          if (again) again.focus({ preventScroll: true });
        });
      } else if (kind === 'each') {
        var n = st.each[p.id] || 0;
        var count = el('output', { class: 'stepper__n', text: String(n), 'aria-live': 'polite' });
        var minus = el('button', { class: 'stepper__btn', type: 'button', 'aria-label': 'меньше: ' + p.label, text: '−' });
        var plus = el('button', { class: 'stepper__btn', type: 'button', 'aria-label': 'больше: ' + p.label, text: '+' });
        minus.disabled = n <= 0;
        plus.disabled = n >= 10;
        var change = function (delta, btn) {
          st.each[p.id] = Math.max(0, Math.min(10, (st.each[p.id] || 0) + delta));
          renderPrices(cat);
          var again = $('prices').querySelector('[data-id="' + p.id + '"] .stepper__btn:' + (btn === minus ? 'first-of-type' : 'last-of-type'));
          if (again && !again.disabled) again.focus({ preventScroll: true });
        };
        minus.addEventListener('click', function () { change(-1, minus); });
        plus.addEventListener('click', function () { change(1, plus); });
        li.className = 'price price--each' + (n ? ' is-on' : '');
        li.append(el('span', { class: 'stepper' }, minus, count, plus));
      }
      li.setAttribute('data-id', p.id);
      prices.append(li);
    });

    var box = $('calc');
    box.hidden = !usable;
    if (!usable) return;
    var sum = calcSummary(cat);
    $('calcTotal').textContent = sum ? sum.text : '—';
    $('calcHint').textContent = !sum
      ? 'отметь пункты прайса — посчитаю примерно ✦'
      : sum.total == null
        ? 'без размера посчитать не получится'
        : 'примерная цена ♡ кнопка ниже скопирует текст заказа';
    box.classList.toggle('is-ready', !!(sum && sum.total != null));
  }

  function orderText(cat) {
    var sum = calcSummary(cat);
    if (!sum || sum.total == null) return '';
    return 'Привет! Хочу заказать арт (' + cat.title + '): ' + sum.parts.join(', ') + '. По прайсу выходит ' + sum.text + '.';
  }

  // Копируем сразу, пока идёт клик: через миг откроется вкладка с чатом, и асинхронный
  // буфер обмена может отказать «страница не в фокусе»
  function copyText(text) {
    var area = el('textarea', { readonly: 'readonly', 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;opacity:0;pointer-events:none' });
    area.value = text;
    document.body.append(area);
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* старый браузер */ }
    area.remove();
    if (ok) return Promise.resolve();
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('copy'));
  }

  var toastTimer = 0;
  function siteToast(text) {
    var t = $('siteToast');
    t.textContent = text;
    t.hidden = false;
    t.classList.remove('is-out');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.add('is-out');
      toastTimer = setTimeout(function () { t.hidden = true; }, 350);
    }, 4200);
  }

  function renderCategory(index, animate) {
    current = index;
    var cat = categories[index];
    Array.prototype.forEach.call(tabs.children, function (tab, i) {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    moveIndicator();

    renderPrices(cat);

    var sheet = $('sheet');
    sheet.hidden = !cat.sheet;
    if (cat.sheet) {
      setImage($('sheetImg'), cat.sheet, 720, function () { sheet.hidden = true; });
      sheet.onclick = function () { openLightbox([cat.sheet], 0, 720); };
    }

    var gallery = $('gallery');
    gallery.replaceChildren();
    var shown = expanded ? cat.images : cat.images.slice(0, galleryPreview());
    shown.forEach(function (src, i) {
      var img = el('img', { alt: cat.title + ' — работа ' + (i + 1), decoding: 'async' });
      var btn = el('button', { class: 'shot', type: 'button', 'aria-label': 'Открыть работу ' + (i + 1) }, img);
      if (ratios[src]) {
        btn.dataset.ratio = ratios[src];
        img.classList.add('is-loaded');
      }
      img.addEventListener('load', function () {
        // у картинок без собственного размера (например, SVG) оставляем 4:5
        ratios[src] = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0.8;
        btn.dataset.ratio = ratios[src];
        img.classList.add('is-loaded');
        scheduleLayout();
      });
      setImage(img, src, 720, function () { btn.remove(); scheduleLayout(); });
      btn.addEventListener('click', function () { openLightbox(cat.images, i, 720); });
      gallery.append(btn);
    });
    if (!cat.images.length) gallery.append(el('p', { class: 'gallery__empty', text: 'примеры скоро появятся ✦' }));
    layoutGallery();

    var more = $('more');
    var hiddenCount = cat.images.length - shown.length;
    more.hidden = hiddenCount <= 0;
    more.textContent = 'показать ещё ' + hiddenCount + ' ✦';

    if (animate) {
      var panel = $('panel');
      panel.classList.remove('is-switching');
      void panel.offsetWidth;
      panel.classList.add('is-switching');
    }
  }

  if (!categories.length) {
    // кнопка связи живёт в колонке с ценами — без категорий переносим её, а не теряем
    if ($('contact')) $('order').append($('contact'));
    $('tabs').remove();
    $('panel').remove();
  } else {
    categories.forEach(function (cat, i) {
      var tab = el('button', { class: 'tab', type: 'button', role: 'tab', text: cat.title });
      tab.addEventListener('click', function () {
        if (current === i) return;
        expanded = false;
        renderCategory(i, true);
      });
      tabs.append(tab);
    });
    tabs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = (current + (e.key === 'ArrowRight' ? 1 : -1) + categories.length) % categories.length;
      expanded = false;
      renderCategory(next, true);
      tabs.children[next].focus();
    });
    if (categories.length < 2) tabs.hidden = true;
    $('more').addEventListener('click', function () {
      expanded = true;
      renderCategory(current, false);
    });
    renderCategory(0, false);
    window.addEventListener('resize', moveIndicator);
    if (window.ResizeObserver) new ResizeObserver(scheduleLayout).observe($('gallery'));
    else window.addEventListener('resize', scheduleLayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
  }

  // ---------------------------------------------------------- мерч

  var MARKETS = window.LISI_MARKETS || {};
  var merch = data.merch;
  var merchItems = (merch && merch.items || []).filter(function (it) {
    return it.links.some(function (l) { return l.url; });
  });

  function marketLogo(key) {
    var m = MARKETS[key] || MARKETS.other;
    var logo = el('span', { class: 'mk__logo', 'aria-hidden': 'true' });
    logo.style.setProperty('--mk', m.color);
    if (m.text) logo.style.setProperty('--mk-text', m.text);
    if (m.path) logo.append(svgFrom(m));
    else logo.textContent = m.badge;
    return logo;
  }

  if (!merch || !merch.enabled || !merchItems.length) {
    $('merch').remove();
    $('merchButton').remove();
  } else {
    var PAGE = phone.matches ? 8 : 15;
    var state = { cat: '', query: '', limit: PAGE };
    var ALIASES = {
      'my little pony': 'пони млп мой маленький пони',
      'gameoverse': 'геймоверс',
      'alien stage': 'элиен стейдж',
      'genshin impact': 'геншин',
      'удивительный цифровой цирк': 'цц amazing digital circus',
      'дроны-убийцы': 'дроны убийцы murder drones',
      'южный парк': 'south park',
      'дом совы': 'owl house'
    };
    var norm = function (s) { return String(s).toLowerCase().replace(/ё/g, 'е'); };
    merchItems.forEach(function (it) {
      var hay = norm(it.title + ' ' + it.subtitle + ' ' + it.category);
      Object.keys(ALIASES).forEach(function (k) { if (hay.indexOf(k) >= 0) hay += ' ' + ALIASES[k]; });
      it._hay = hay;
    });

    var cats = [];
    merchItems.forEach(function (it) { if (it.category && cats.indexOf(it.category) < 0) cats.push(it.category); });

    $('merchTitle').textContent = merch.title;
    $('merchButton').textContent = merch.title;
    $('merchLead').textContent = merch.lead;
    if (!merch.lead) $('merchLead').remove();

    var chipsBox = $('merchChips');
    [''].concat(cats).forEach(function (cat) {
      var count = cat ? merchItems.filter(function (it) { return it.category === cat; }).length : merchItems.length;
      var chip = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(cat === state.cat) },
        cat || 'всё', el('small', { text: String(count) }));
      chip.addEventListener('click', function () {
        state.cat = cat;
        state.limit = PAGE;
        renderMerch();
      });
      chipsBox.append(chip);
    });
    if (cats.length < 2) chipsBox.hidden = true;

    var matches = function (it) {
      if (state.cat && it.category !== state.cat) return false;
      var words = norm(state.query).split(/\s+/).filter(Boolean);
      return words.every(function (w) {
        // «значок» должен находить «значки», поэтому для длинных слов срезаем окончание
        return it._hay.indexOf(w) >= 0 || (w.length > 4 && it._hay.indexOf(w.slice(0, -2)) >= 0);
      });
    };

    var productCard = function (it) {
      var links = it.links.filter(function (l) { return l.url; });
      var single = links.length === 1;
      var card = single
        ? el('a', { class: 'product', href: links[0].url, target: '_blank', rel: 'noopener noreferrer' })
        : el('button', { class: 'product', type: 'button', 'aria-haspopup': 'dialog' });
      var img = el('img', { alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      setImage(img, it.image, 540, function () { img.style.visibility = 'hidden'; });
      var markets = el('span', { class: 'product__markets' });
      links.forEach(function (l) {
        var m = MARKETS[l.market] || MARKETS.other;
        var pill = el('span', { class: 'mk', title: m.label }, marketLogo(l.market));
        if (l.price) pill.append(l.price);
        else pill.classList.add('mk--bare');
        markets.append(pill);
      });
      card.append(
        el('span', { class: 'product__img' }, img, it.category ? el('span', { class: 'product__kind', text: it.category }) : null),
        el('span', { class: 'product__body' },
          el('span', { class: 'product__title', text: it.title }),
          it.subtitle ? el('span', { class: 'product__sub', text: it.subtitle }) : null,
          markets));
      card.setAttribute('aria-label', it.title + (it.subtitle ? ', ' + it.subtitle : '') + (single ? '' : ' — выбрать магазин'));
      if (single) onOpen(card, function () { track('market', links[0].market, productName(it), it.id); });
      else card.addEventListener('click', function () { openPicker(it, card); });
      return card;
    };

    var renderMerch = function () {
      var list = merchItems.filter(matches);
      var grid = $('merchGrid');
      grid.replaceChildren();
      list.slice(0, state.limit).forEach(function (it) { grid.append(productCard(it)); });
      $('merchEmpty').hidden = list.length > 0;
      var rest = list.length - state.limit;
      $('merchMore').hidden = rest <= 0;
      $('merchMore').textContent = 'показать ещё ' + Math.min(rest, PAGE) + (rest > PAGE ? ' из ' + rest : '') + ' ✦';
      Array.prototype.forEach.call(chipsBox.children, function (chip, i) {
        chip.setAttribute('aria-pressed', String((i === 0 ? '' : cats[i - 1]) === state.cat));
      });
    };

    var searchTimer = 0;
    $('merchSearch').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.query = e.target.value;
        state.limit = PAGE;
        renderMerch();
      }, 120);
    });
    $('merchMore').addEventListener('click', function () {
      state.limit += PAGE;
      renderMerch();
    });
    renderMerch();
  }

  // окно «где купить» — когда один товар есть на нескольких маркетах
  var pickerFocus = null;

  function productName(it) {
    return it.title + (it.subtitle ? ' · ' + it.subtitle : '');
  }

  // лайтбокс и окно маркетов оба запирают прокрутку — отпускаем, только когда закрыты оба
  function syncScrollLock() {
    document.body.style.overflow = $('lightbox').hidden && $('picker').hidden ? '' : 'hidden';
  }

  function openPicker(it, trigger) {
    pickerFocus = trigger;
    setImage($('pickerImg'), it.image, 540);
    $('pickerTitle').textContent = it.title;
    $('pickerSub').textContent = it.subtitle;
    var list = $('pickerList');
    list.replaceChildren();
    it.links.filter(function (l) { return l.url; }).forEach(function (l) {
      var m = MARKETS[l.market] || MARKETS.other;
      var arrow = svgFrom({ stroke: true, path: 'M9 6l6 6-6 6' });
      arrow.setAttribute('class', 'market__arrow');
      var a = el('a', { class: 'market', href: l.url, target: '_blank', rel: 'noopener noreferrer' },
        marketLogo(l.market), el('span', { class: 'market__name', text: m.label }),
        l.price ? el('span', { class: 'market__price', text: l.price }) : null, arrow);
      a.style.setProperty('--mk', m.color);
      onOpen(a, function () {
        track('market', l.market, productName(it), it.id);
        setTimeout(closePicker, 50);
      });
      list.append(a);
    });
    $('picker').hidden = false;
    syncScrollLock();
    var first = list.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  }

  function closePicker() {
    if ($('picker').hidden) return;
    $('picker').hidden = true;
    syncScrollLock();
    if (pickerFocus) pickerFocus.focus({ preventScroll: true });
  }

  $('picker').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closePicker();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePicker();
  });

  $('footer').textContent = ['© ' + new Date().getFullYear() + (profile.name ? ' ' + profile.name : ''), data.site.footer]
    .filter(Boolean)
    .join(' · ');

  // ---------------------------------------------------------- просмотр работ

  var lb = { images: [], index: 0, px: 720, lastFocus: null };

  function showLightbox() {
    var img = $('lbImg');
    var src = lb.images[lb.index];
    // уменьшенная копия уже скачана сеткой — показываем её сразу, а оригинал подменяет её, когда догрузится
    // фото из VK на 2560 px ни одному экрану не нужны — хватает 1440
    var large = vkSized(src, 1440);
    setImage(img, src, lb.px);
    if (img.getAttribute('src') !== large) {
      var full = new Image();
      full.onload = function () {
        if (!$('lightbox').hidden && lb.images[lb.index] === src) {
          img.onerror = null;
          img.src = large;
        }
      };
      full.src = large;
    }
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
    $('lbCount').textContent = (lb.index + 1) + ' / ' + lb.images.length;
    var single = lb.images.length < 2;
    $('lbPrev').hidden = single;
    $('lbNext').hidden = single;
  }

  function openLightbox(images, index, px) {
    lb.images = images;
    lb.index = index;
    lb.px = px || 720;
    lb.lastFocus = document.activeElement;
    $('lightbox').hidden = false;
    syncScrollLock();
    showLightbox();
    $('lbClose').focus();
  }

  function closeLightbox() {
    $('lightbox').hidden = true;
    syncScrollLock();
    if (lb.lastFocus) lb.lastFocus.focus();
  }

  function step(delta) {
    lb.index = (lb.index + delta + lb.images.length) % lb.images.length;
    showLightbox();
  }

  $('lbClose').addEventListener('click', closeLightbox);
  $('lbPrev').addEventListener('click', function () { step(-1); });
  $('lbNext').addEventListener('click', function () { step(1); });
  $('lightbox').addEventListener('click', function (e) { if (e.target === this) closeLightbox(); });
  document.addEventListener('keydown', function (e) {
    if ($('lightbox').hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  // ---------------------------------------------------------- музыка

  var music = data.music;
  var audio = $('audio');
  var player = $('player');
  var volumeInput = $('volume');
  var hasMusic = !!(music.enabled && music.src);
  var entered = false;
  var musicBroken = false;
  var fadeFrame = 0;

  var savedVolume = parseFloat(safeStorage('get', 'lisi:volume'));
  var volume = isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : music.volume;

  function setVolumeUi(v) {
    volumeInput.value = v;
    volumeInput.style.setProperty('--v', Math.round(v * 100) + '%');
  }

  function fadeTo(target, ms, done) {
    cancelAnimationFrame(fadeFrame);
    var from = audio.volume;
    var start = performance.now();
    (function tick(now) {
      var k = Math.min(1, (now - start) / ms);
      audio.volume = from + (target - from) * k * k * (3 - 2 * k);
      if (k < 1) fadeFrame = requestAnimationFrame(tick);
      else if (done) done();
    })(start);
  }

  function play(fadeMs) {
    audio.volume = 0;
    var attempt = audio.play();
    if (attempt && attempt.then) {
      attempt.then(function () { fadeTo(volume, fadeMs); }, function () { player.classList.remove('is-playing'); });
    } else {
      fadeTo(volume, fadeMs);
    }
  }

  function pause() {
    fadeTo(0, 350, function () { audio.pause(); });
  }

  if (hasMusic) {
    audio.src = music.src;
    // с нуля — встроенный бесшовный повтор, с отметки — возвращаемся к ней вручную
    audio.loop = music.loop && !music.startAt;
    audio.addEventListener('loadedmetadata', function () {
      if (music.startAt && music.startAt < audio.duration) audio.currentTime = music.startAt;
    });
    audio.addEventListener('ended', function () {
      if (!music.loop) return;
      audio.currentTime = music.startAt || 0;
      var again = audio.play();
      if (again && again.catch) again.catch(function () {});
    });
    audio.addEventListener('play', function () { player.classList.add('is-playing'); $('playBtn').setAttribute('aria-label', 'Пауза'); });
    audio.addEventListener('pause', function () { player.classList.remove('is-playing'); $('playBtn').setAttribute('aria-label', 'Играть'); });
    audio.addEventListener('error', function () {
      console.warn('Трек не загрузился:', music.src);
      musicBroken = true;
      player.hidden = true;
    });

    $('trackTitle').textContent = music.title || 'без названия';
    $('trackArtist').textContent = music.artist;
    $('trackArtist').hidden = !music.artist;
    setVolumeUi(volume);

    $('playBtn').addEventListener('click', function () {
      if (audio.paused) play(500); else pause();
    });
    volumeInput.addEventListener('input', function () {
      cancelAnimationFrame(fadeFrame);
      volume = parseFloat(volumeInput.value);
      audio.volume = volume;
      audio.muted = false;
      player.classList.remove('is-muted');
      setVolumeUi(volume);
      safeStorage('set', 'lisi:volume', String(volume));
    });
    $('muteBtn').addEventListener('click', function () {
      audio.muted = !audio.muted;
      player.classList.toggle('is-muted', audio.muted);
      $('muteBtn').setAttribute('aria-label', audio.muted ? 'Включить звук' : 'Выключить звук');
    });

    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: music.title || profile.name,
        artist: music.artist || profile.name,
        artwork: profile.avatar ? [{ src: new URL(profile.avatar, location.href).href, sizes: '512x512' }] : []
      });
    }
  }

  function enter(withSound) {
    if (entered) return;
    entered = true;
    document.body.classList.add('is-entered');
    var gate = $('gate');
    // без музыки заставку убирают ещё до входа — её может уже не быть
    if (gate && !gate.hidden) {
      gate.classList.add('is-leaving');
      setTimeout(function () { gate.remove(); }, 800);
    }
    if (hasMusic && !musicBroken) {
      player.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { player.classList.add('is-shown'); });
      });
      if (withSound) play(1800);
    }
  }

  if (hasMusic) {
    // браузер не даст включить звук без действия человека — поэтому заставка
    $('gateText').textContent = data.site.gateText || 'нажми, чтобы войти';
    $('gateName').textContent = profile.name;
    $('gate').hidden = false;
    $('gate').addEventListener('click', function () { enter(true); });
    $('gateQuiet').addEventListener('click', function (e) {
      e.stopPropagation();
      enter(false);
    });
    $('gateEnter').focus({ preventScroll: true });
  } else {
    $('gate').remove();
    enter(false);
  }

  // ---------------------------------------------------------- искорки по клику

  var SPARKS = ['♡', '✦', '♡', '✿', '✧'];
  var COLORS = ['#c8567c', '#ff8fb3', '#ffffff', '#e36d96'];
  document.addEventListener('pointerdown', function (e) {
    if (reduceMotion || e.button !== 0 || !document.body.animate) return;
    for (var i = 0; i < 7; i++) {
      var s = el('span', { class: 'spark', text: SPARKS[i % SPARKS.length], 'aria-hidden': 'true' });
      s.style.left = e.clientX + 'px';
      s.style.top = e.clientY + 'px';
      s.style.color = COLORS[i % COLORS.length];
      s.style.fontSize = (12 + Math.random() * 10) + 'px';
      document.body.append(s);
      var angle = Math.random() * Math.PI * 2;
      var dist = 28 + Math.random() * 42;
      s.animate([
        { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + Math.cos(angle) * dist + 'px), calc(-50% + ' + (Math.sin(angle) * dist - 12) + 'px)) scale(1) rotate(' + (Math.random() * 120 - 60) + 'deg)', opacity: 0 }
      ], { duration: 650 + Math.random() * 350, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = (function (node) {
        return function () { node.remove(); };
      })(s);
    }
  }, { passive: true });
  }

  function start(data) {
    main(localize(data));
    trackVisit();
  }

  function loadFailed(err) {
    console.error(err);
    document.body.classList.add('is-entered');
    var gate = document.getElementById('gate');
    if (gate) gate.remove();
    document.getElementById('page').prepend(el('p', { class: 'card section', text: 'Не получилось загрузить сайт — обнови страницу ♡' }));
  }

  var inline = document.getElementById('lisi-data');
  var raw = inline ? inline.textContent.trim() : '';
  if (raw.charAt(0) === '{') {
    start(JSON.parse(raw));
  } else {
    // ошибка загрузки — сообщение посетителю; ошибка в самом коде сайта — только в консоль,
    // иначе недорисованная страница получила бы ещё и ложное «не получилось загрузить»
    fetch('content.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('content.json: ' + r.status);
        return r.json();
      })
      .then(function (d) {
        setTimeout(function () { start(d); }, 0);
      }, loadFailed);
  }
})();
