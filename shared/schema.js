/* Приводит содержимое сайта к безопасному виду. Один и тот же код работает
   на сервере (Node) и в панели на GitHub Pages (браузер).
   Отсутствующие поля берутся из умолчаний, лишние отбрасываются. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./icons'));
  else root.LISI_SCHEMA = factory(root.LISI_ICONS);
})(typeof self !== 'undefined' ? self : this, function (ICONS) {
  'use strict';
  const MARKETS = ICONS.MARKETS || (typeof self !== 'undefined' && self.LISI_MARKETS) || {};
  const CONTROL = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');

  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = (v, max, def = '') => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(CONTROL, '').slice(0, max) : def);
  const line = (v, max, def = '') => text(v, max, def).replace(/\s*\n\s*/g, ' ');
  const bool = (v, def) => (typeof v === 'boolean' ? v : def);
  const num = (v, min, max, def) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
  const randomId = () => Math.random().toString(36).slice(2, 12);
  const id = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : randomId());
  const list = (v, def, max) => (Array.isArray(v) ? v : def).slice(0, max);
  // размер (выбрать один), вариант на выбор вроде фона, добавка, «за каждого», не считать
  const PRICE_KINDS = ['base', 'choice', 'add', 'each', 'none'];

  // http(s)-адрес, mailto (если разрешено) или свой файл /uploads/… и /music/…
  function url(v, { mailto = false } = {}) {
    if (typeof v !== 'string') return '';
    let s = v.trim();
    if (!s) return '';
    if (/^\/(uploads|music)\/[\w.-]+$/.test(s) && !s.includes('..')) return s;
    if (!/^[a-z][a-z\d+.-]*:/i.test(s)) {
      if (mailto && /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(s)) s = 'mailto:' + s;
      else s = 'https://' + s.replace(/^\/+/, '');
    }
    try {
      const u = new URL(s);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return u.hostname.includes('.') || u.hostname === 'localhost' ? u.href.slice(0, 2000) : '';
      }
      if (mailto && u.protocol === 'mailto:') return u.href.slice(0, 300);
    } catch (e) {
      /* не адрес */
    }
    return '';
  }

  function sanitizeContent(input, defaults) {
    const c = isObj(input) ? input : {};
    const d = defaults;
    const sub = (key) => (isObj(c[key]) ? c[key] : {});
    const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

    const P = sub('profile');
    const profile = {
      name: line(P.name, 60, d.profile.name),
      roles: line(P.roles, 120, d.profile.roles),
      greeting: text(P.greeting, 600, d.profile.greeting),
      avatar: has(P, 'avatar') ? url(P.avatar) : d.profile.avatar,
      // логотип вместо имени в шапке и на заставке; пусто — пишется имя шрифтом
      logo: has(P, 'logo') ? url(P.logo) : d.profile.logo || '',
      cover: has(P, 'cover') ? url(P.cover) : d.profile.cover,
      orderButton: line(P.orderButton, 60, d.profile.orderButton),
    };

    const S = sub('site');
    const site = {
      gateText: line(S.gateText, 80, d.site.gateText),
      footer: line(S.footer, 160, d.site.footer),
    };

    const M = sub('music');
    const music = {
      enabled: bool(M.enabled, d.music.enabled),
      // встроенная шкатулка была WAV на 4 МБ, теперь это тот же трек в .m4a на 0,5 МБ
      src: has(M, 'src') ? url(M.src).replace(/^\/music\/music-box\.wav$/, '/music/music-box.m4a') : d.music.src,
      title: line(M.title, 100, d.music.title),
      artist: line(M.artist, 100, d.music.artist),
      volume: num(M.volume, 0, 1, d.music.volume),
      startAt: num(M.startAt, 0, 36000, d.music.startAt),
      loop: bool(M.loop, d.music.loop),
    };

    const links = list(c.links, d.links, 40)
      .filter(isObj)
      .map((l) => {
        const type = typeof l.type === 'string' && ICONS[l.type] ? l.type : 'website';
        return {
          id: id(l.id),
          type,
          label: line(l.label, 40, ICONS[type].label),
          url: url(l.url, { mailto: true }),
          visible: bool(l.visible, true),
        };
      });

    const A = sub('about');
    const about = {
      enabled: bool(A.enabled, d.about.enabled),
      title: line(A.title, 60, d.about.title),
      text: text(A.text, 6000, d.about.text),
      signature: line(A.signature, 60, d.about.signature),
      facts: list(A.facts, d.about.facts, 12)
        .filter(isObj)
        .map((f) => ({ id: id(f.id), emoji: line(f.emoji, 16), label: line(f.label, 40), value: line(f.value, 200) })),
    };

    const C = sub('commissions');
    const DC = d.commissions;
    const commissions = {
      open: bool(C.open, DC.open),
      openText: line(C.openText, 40, DC.openText),
      closedText: line(C.closedText, 40, DC.closedText),
      contactLabel: line(C.contactLabel, 60, DC.contactLabel),
      contactUrl: has(C, 'contactUrl') ? url(C.contactUrl, { mailto: true }) : DC.contactUrl,
      deadline: line(C.deadline, 200, DC.deadline),
      rules: list(C.rules, DC.rules, 30)
        .map((r) => line(r, 300).trim())
        .filter(Boolean),
      categories: list(C.categories, DC.categories, 8)
        .filter(isObj)
        .map((cat) => ({
          id: id(cat.id),
          title: line(cat.title, 30, 'без названия'),
          sheet: url(cat.sheet),
          prices: list(cat.prices, [], 12)
            .filter(isObj)
            .map((p) => {
              // kind — как пункт считается в калькуляторе на сайте; пусто — угадать по тексту
              const kind = PRICE_KINDS.includes(p.kind) ? p.kind : '';
              return { id: id(p.id), label: line(p.label, 60), price: line(p.price, 30), ...(kind ? { kind } : {}) };
            }),
          images: list(cat.images, [], 60)
            .map((src) => url(src))
            .filter(Boolean),
        })),
    };

    const G = sub('merch');
    const DG = d.merch;
    const merch = {
      enabled: bool(G.enabled, DG.enabled),
      title: line(G.title, 60, DG.title),
      lead: text(G.lead, 400, DG.lead),
      items: list(G.items, DG.items, 300)
        .filter(isObj)
        .map((it) => ({
          id: id(it.id),
          title: line(it.title, 80),
          subtitle: line(it.subtitle, 120),
          category: line(it.category, 40).trim(),
          image: url(it.image),
          links: list(it.links, [], 8)
            .filter(isObj)
            .map((l) => ({
              market: typeof l.market === 'string' && MARKETS[l.market] ? l.market : 'other',
              url: url(l.url),
              price: line(l.price, 30),
            })),
        })),
    };

    return { profile, site, music, links, about, commissions, merch };
  }

  return { sanitizeContent, url };
});
