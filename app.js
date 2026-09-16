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

  // На своём сервере данные встроены в страницу, на GitHub Pages лежат рядом в content.json.
  // Пути к своим файлам делаем относительными, чтобы сайт работал в любой папке.
  function asset(u) {
    return typeof u === 'string' && /^\/(uploads|music)\//.test(u) ? u.slice(1) : u;
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
    $('avatar').src = profile.avatar;
    $('gateAvatar').src = profile.avatar;
    $('discImg').src = profile.avatar;
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

  function renderCategory(index, animate) {
    current = index;
    var cat = categories[index];
    Array.prototype.forEach.call(tabs.children, function (tab, i) {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    moveIndicator();

    var prices = $('prices');
    prices.replaceChildren();
    cat.prices.forEach(function (p) {
      prices.append(el('li', { class: 'price' },
        el('span', { text: p.label }), el('span', { class: 'price__dots' }), el('span', { class: 'price__value', text: p.price })));
    });
    if (!cat.prices.length) prices.append(el('li', { class: 'prices__empty', text: 'цены уточняй в личке ♡' }));

    var sheet = $('sheet');
    sheet.hidden = !cat.sheet;
    if (cat.sheet) {
      $('sheetImg').src = cat.sheet;
      sheet.onclick = function () { openLightbox([cat.sheet], 0); };
    }

    var gallery = $('gallery');
    gallery.replaceChildren();
    var shown = expanded ? cat.images : cat.images.slice(0, galleryPreview());
    shown.forEach(function (src, i) {
      var img = el('img', { src: src, alt: cat.title + ' — работа ' + (i + 1), decoding: 'async' });
      var btn = el('button', { class: 'shot', type: 'button', 'aria-label': 'Открыть работу ' + (i + 1) }, img);
      if (ratios[src]) {
        btn.dataset.ratio = ratios[src];
        img.classList.add('is-loaded');
      }
      img.addEventListener('load', function () {
        ratios[src] = img.naturalWidth / img.naturalHeight;
        btn.dataset.ratio = ratios[src];
        img.classList.add('is-loaded');
        scheduleLayout();
      });
      img.addEventListener('error', function () { btn.remove(); scheduleLayout(); });
      btn.addEventListener('click', function () { openLightbox(cat.images, i); });
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
      var img = el('img', { src: it.image, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
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
      if (!single) card.addEventListener('click', function () { openPicker(it, card); });
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

  function openPicker(it, trigger) {
    pickerFocus = trigger;
    $('pickerImg').src = it.image;
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
      a.addEventListener('click', function () { setTimeout(closePicker, 50); });
      list.append(a);
    });
    $('picker').hidden = false;
    document.body.style.overflow = 'hidden';
    var first = list.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  }

  function closePicker() {
    if ($('picker').hidden) return;
    $('picker').hidden = true;
    document.body.style.overflow = '';
    if (pickerFocus) pickerFocus.focus({ preventScroll: true });
  }

  $('picker').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closePicker();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePicker();
  });

  $('footer').textContent = '© ' + new Date().getFullYear() + ' ' + profile.name + ' · ' + data.site.footer;

  // ---------------------------------------------------------- просмотр работ

  var lb = { images: [], index: 0, lastFocus: null };

  function showLightbox() {
    var img = $('lbImg');
    img.src = lb.images[lb.index];
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
    $('lbCount').textContent = (lb.index + 1) + ' / ' + lb.images.length;
    var single = lb.images.length < 2;
    $('lbPrev').hidden = single;
    $('lbNext').hidden = single;
  }

  function openLightbox(images, index) {
    lb.images = images;
    lb.index = index;
    lb.lastFocus = document.activeElement;
    $('lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
    showLightbox();
    $('lbClose').focus();
  }

  function closeLightbox() {
    $('lightbox').hidden = true;
    document.body.style.overflow = '';
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
    if (!gate.hidden) {
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

  var inline = document.getElementById('lisi-data');
  var raw = inline ? inline.textContent.trim() : '';
  if (raw.charAt(0) === '{') {
    main(localize(JSON.parse(raw)));
  } else {
    fetch('content.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('content.json: ' + r.status);
        return r.json();
      })
      .then(function (d) { main(localize(d)); })
      .catch(function (err) {
        console.error(err);
        document.body.classList.add('is-entered');
        var gate = document.getElementById('gate');
        if (gate) gate.remove();
        document.getElementById('page').prepend(el('p', { class: 'card section', text: 'Не получилось загрузить сайт — обнови страницу ♡' }));
      });
  }
})();
