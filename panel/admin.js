(function () {
  'use strict';

  const ICONS = window.LISI_ICONS;
  const MARKETS = window.LISI_MARKETS;
  // на GitHub Pages panel/config.js задаёт репозиторий; на своём сервере конфига нет
  const CONFIG = window.LISI_PANEL || null;
  const GH = !!(CONFIG && CONFIG.mode === 'github');
  const SCHEMA = window.LISI_SCHEMA;
  const app = document.getElementById('app');
  const S = { session: null, content: null, saved: '', problem: null, section: 'links', uploads: 0, saving: false, onChange: null };

  const SECTIONS = [
    { id: 'links', title: 'Ссылки', icon: 'links', render: renderLinks },
    { id: 'music', title: 'Музыка', icon: 'music', render: renderMusic },
    { id: 'profile', title: 'Профиль', icon: 'user', render: renderProfile },
    { id: 'about', title: 'Обо мне', icon: 'heart', render: renderAbout },
    { id: 'orders', title: 'Заказы', icon: 'brush', render: renderOrders },
    { id: 'merch', title: 'Мерч', icon: 'bag', render: renderMerch },
    { id: 'files', title: 'Файлы', icon: 'folder', render: renderFiles },
    { id: 'security', title: 'Безопасность', icon: 'lock', render: renderSecurity },
  ];

  // ---------------------------------------------------------------- помощники

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : value);
      }
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) node.append(kid);
    return node;
  }

  const UI_PATHS = {
    links: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
    music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21a8 8 0 0 1 16 0',
    heart: 'M12 20s-7.5-4.6-9.2-9.3C1.7 7.6 3.6 4.5 6.8 4.5c2.1 0 3.9 1.3 5.2 3.2 1.3-1.9 3.1-3.2 5.2-3.2 3.2 0 5.1 3.1 4 6.2C19.5 15.4 12 20 12 20z',
    brush: 'M4 20l4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10L4 20zM13.5 7.5l3 3',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    bag: 'M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    left: 'M15 6l-6 6 6 6',
    right: 'M9 6l6 6-6 6',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    x: 'M6 6l12 12M18 6L6 18',
    plus: 'M12 5v14M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    play: 'M8 5.5v13l10.5-6.5z',
    image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01',
  };

  function ui(name, cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', UI_PATHS[name]);
    svg.append(path);
    return svg;
  }

  function brandIcon(type) {
    return svgFrom(ICONS[type] || ICONS.website);
  }

  function marketBadge(key, dim) {
    const m = MARKETS[key] || MARKETS.other;
    const badge = h('span', { class: `mkb${dim ? ' is-empty' : ''}`, title: m.label, style: `--mk:${m.color};--mk-text:${m.text || '#fff'}` });
    if (m.path) badge.append(svgFrom(m));
    else badge.textContent = m.badge;
    return badge;
  }

  function svgFrom(def) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (def.stroke) {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    } else {
      svg.setAttribute('fill', 'currentColor');
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', def.path);
    svg.append(path);
    return svg;
  }

  const rid = () => Math.random().toString(36).slice(2, 10);
  const move = (arr, from, to) => arr.splice(to, 0, arr.splice(from, 1)[0]);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

  function store(action, key, value) {
    try {
      if (action === 'get') return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch {}
    return null;
  }

  function toast(message, type = 'ok') {
    const node = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' }, ui(type === 'error' ? 'x' : 'check'), h('span', { text: message }));
    document.getElementById('toasts').append(node);
    setTimeout(() => {
      node.classList.add('is-out');
      setTimeout(() => node.remove(), 300);
    }, type === 'error' ? 5500 : 2800);
  }

  async function api(method, url, body) {
    const headers = { 'X-Lisi': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    } catch {
      throw new Error('Сервер не отвечает — он запущен?');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (res.status === 401 && S.content && url !== '/api/login') {
      S.content = null;
      renderAuth('login');
      throw new Error('Сессия закончилась — войди заново');
    }
    if (!res.ok) throw new Error((data && data.error) || `Ошибка ${res.status}`);
    return data;
  }

  function xhrSend(method, url, headers, body, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(Object.assign(new Error((data && (data.error || data.message)) || `Ошибка ${xhr.status}`), { status: xhr.status }));
      };
      xhr.onerror = () => reject(new Error('Загрузка не удалась — проверь интернет'));
      xhr.send(body);
    });
  }

  // Проверка содержимого файла по первым байтам — тот же список, что на сервере
  function sniff(b, kind) {
    const at = (offset, str) => b.length >= offset + str.length && Array.from(str).every((ch, i) => b[offset + i] === ch.charCodeAt(0));
    if (kind === 'image') {
      if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
      if (b[0] === 0x89 && at(1, 'PNG')) return '.png';
      if (at(0, 'GIF8')) return '.gif';
      if (at(0, 'RIFF') && at(8, 'WEBP')) return '.webp';
      if (at(4, 'ftypavif') || at(4, 'ftypavis')) return '.avif';
      return null;
    }
    if (at(0, 'ID3')) return '.mp3';
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return (b[1] & 0x06) === 0 ? '.aac' : '.mp3';
    if (at(0, 'OggS')) return '.ogg';
    if (at(0, 'RIFF') && at(8, 'WAVE')) return '.wav';
    if (at(0, 'fLaC')) return '.flac';
    if (at(4, 'ftyp')) return '.m4a';
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return '.webm';
    return null;
  }

  // ---------------------------------------------------------------- куда сохраняем

  // Свой сервер: пароль, сохранение через /api
  function serverBackend() {
    return {
      kind: 'server',
      limits: { audio: 40, image: 15 },
      savedNote: 'Сохранено ♡ Обнови сайт, чтобы увидеть',
      session: () => api('GET', '/api/session'),
      profile: () => api('GET', '/api/profile'),
      setup: (password) => api('POST', '/api/setup', { password }),
      login: (password) => api('POST', '/api/login', { password }),
      logout: () => api('POST', '/api/logout'),
      logoutAll: () => api('POST', '/api/logout-all'),
      changePassword: (current, next) => api('POST', '/api/password', { current, next }),
      loadContent: () => api('GET', '/api/content'),
      saveContent: (content) => api('PUT', '/api/content', { content }),
      listUploads: () => api('GET', '/api/uploads'),
      deleteUpload: (file) => api('DELETE', `/api/uploads?name=${encodeURIComponent(file.name)}`),
      upload: (file, kind, onProgress) =>
        xhrSend('POST', `/api/upload?kind=${kind}`, { 'X-Lisi': '1', 'X-File-Name': encodeURIComponent(file.name) }, file, onProgress),
    };
  }

  // GitHub Pages: сервера нет, изменения коммитятся прямо в репозиторий сайта через GitHub API
  function githubBackend() {
    const { owner, repo, branch } = CONFIG;
    const REPO = `/repos/${owner}/${repo}`;
    const TOKEN_KEY = 'lisi:github-token';
    let token = '';
    let contentSha = null;
    let defaults = null;
    try {
      token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
    } catch {}

    const storeToken = (value, remember) => {
      token = value;
      try {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        if (value) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, value);
      } catch {}
    };
    const headers = () => ({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: `Bearer ${token}` });
    const bytesToB64 = (bytes) => {
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    const textToB64 = (str) => bytesToB64(new TextEncoder().encode(str));
    const b64ToText = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

    async function gh(method, path, body) {
      let res;
      try {
        res = await fetch(`https://api.github.com${path}`, {
          method,
          headers: body ? { ...headers(), 'Content-Type': 'application/json' } : headers(),
          body: body ? JSON.stringify(body) : undefined,
          cache: 'no-store',
        });
      } catch {
        throw new Error('GitHub не отвечает — проверь интернет');
      }
      let data = null;
      try {
        data = await res.json();
      } catch {}
      if (res.status === 401 && S.content) {
        S.content = null;
        renderAuth('login');
        throw Object.assign(new Error('Токен больше не действует — войди заново'), { status: 401 });
      }
      if (!res.ok) throw Object.assign(new Error((data && data.message) || `Ошибка GitHub ${res.status}`), { status: res.status });
      return data;
    }

    return {
      kind: 'github',
      limits: { audio: 25, image: 10 },
      savedNote: 'Сохранено ♡ Сайт обновится примерно через минуту',
      async session() {
        const base = { setUp: true, canSetUp: false, loggedIn: false, siteUrl: CONFIG.siteUrl };
        if (!token) return base;
        try {
          const r = await gh('GET', REPO);
          return { ...base, loggedIn: !!(r.permissions && r.permissions.push) };
        } catch (e) {
          if ([401, 403, 404].includes(e.status)) return base;
          throw e;
        }
      },
      async profile() {
        const r = await fetch(`${CONFIG.siteUrl}content.json?v=${Date.now()}`, { cache: 'no-store' }).then((x) => x.json());
        return { name: r.profile.name, avatar: r.profile.avatar };
      },
      async login(value, remember) {
        const candidate = value.trim();
        if (!candidate) throw new Error('Вставь токен');
        token = candidate;
        let r;
        try {
          r = await gh('GET', REPO);
        } catch (e) {
          token = '';
          if (e.status === 401) throw new Error('GitHub не принял токен — проверь, что он скопирован целиком');
          if (e.status === 403 || e.status === 404) throw new Error(`У токена нет доступа к репозиторию ${owner}/${repo}`);
          throw e;
        }
        if (!r.permissions || !r.permissions.push) {
          token = '';
          throw new Error('У токена только чтение — в Permissions нужен Contents: Read and write');
        }
        storeToken(candidate, remember);
      },
      async logout() {
        storeToken('');
      },
      async loadContent() {
        if (!defaults) defaults = await fetch(`defaults.json?v=${Date.now()}`, { cache: 'no-store' }).then((x) => x.json());
        const file = await gh('GET', `${REPO}/contents/content.json?ref=${encodeURIComponent(branch)}`);
        contentSha = file.sha;
        return { content: SCHEMA.sanitizeContent(JSON.parse(b64ToText(file.content)), defaults), problem: null };
      },
      async saveContent(content) {
        const clean = SCHEMA.sanitizeContent(content, defaults);
        let r;
        try {
          r = await gh('PUT', `${REPO}/contents/content.json`, {
            message: 'Панель: обновлено содержимое сайта',
            content: textToB64(`${JSON.stringify(clean, null, 2)}\n`),
            sha: contentSha,
            branch,
          });
        } catch (e) {
          if (e.status === 409) throw new Error('content.json уже изменили в другом месте. Обнови страницу панели и внеси правки заново');
          throw e;
        }
        contentSha = r.content.sha;
        return { content: clean };
      },
      async listUploads() {
        let items;
        try {
          items = await gh('GET', `${REPO}/contents/uploads?ref=${encodeURIComponent(branch)}`);
        } catch (e) {
          if (e.status === 404) return { files: [] };
          throw e;
        }
        const used = S.saved;
        return {
          files: items
            .filter((f) => f.type === 'file')
            .map((f) => ({ name: f.name, url: `/uploads/${f.name}`, size: f.size, mtime: null, sha: f.sha, used: used.includes(`"/uploads/${f.name}"`) })),
        };
      },
      async deleteUpload(file) {
        if (file.used) throw new Error('Файл используется на сайте — сначала убери его оттуда и сохрани');
        await gh('DELETE', `${REPO}/contents/uploads/${encodeURIComponent(file.name)}`, { message: `Панель: удалён файл ${file.name}`, sha: file.sha, branch });
      },
      async upload(file, kind, onProgress) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const ext = sniff(bytes, kind);
        if (!ext) throw new Error(kind === 'audio' ? 'это не похоже на аудиофайл (mp3, ogg, m4a, wav, flac)' : 'это не похоже на картинку (jpg, png, webp, gif)');
        const name = `${kind === 'audio' ? 'track' : 'img'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`;
        const body = JSON.stringify({ message: `Панель: загружен файл ${name}`, content: bytesToB64(bytes), branch });
        await xhrSend('PUT', `https://api.github.com${REPO}/contents/uploads/${name}`, { ...headers(), 'Content-Type': 'application/json' }, body, onProgress);
        return { url: `/uploads/${name}`, originalName: file.name, size: file.size };
      },
    };
  }

  const B = GH ? githubBackend() : serverBackend();

  // Предпросмотр своих файлов: на GitHub Pages свежезагруженное появляется на сайте не сразу,
  // а в репозитории — сразу, поэтому в панели показываем его оттуда
  function view(u) {
    if (!GH || !u || !/^\/(uploads|music)\//.test(u)) return u;
    return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repo}/${CONFIG.branch}${u}`;
  }

  function upload(file, kind, onProgress) {
    const limitMb = B.limits[kind];
    // слишком большой файл сервер оборвёт, и браузер покажет лишь «ошибку сети» — проверяем заранее
    if (file.size > limitMb * 1024 * 1024) return Promise.reject(new Error(`файл больше ${limitMb} МБ`));
    S.uploads++;
    return B.upload(file, kind, onProgress).finally(() => {
      S.uploads--;
    });
  }

  function normalizeUrl(value, allowMail) {
    const v = value.trim();
    if (!v || /^[a-z][a-z\d+.-]*:/i.test(v) || v.startsWith('/')) return v;
    if (allowMail && /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(v)) return `mailto:${v}`;
    return `https://${v}`;
  }

  function validUrl(value) {
    if (!value) return true;
    if (/^\/(uploads|music)\/[\w.-]+$/.test(value)) return true;
    try {
      const u = new URL(value);
      if (u.protocol === 'mailto:') return true;
      return (u.protocol === 'https:' || u.protocol === 'http:') && (u.hostname.includes('.') || u.hostname === 'localhost');
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------- поля формы

  function input(obj, key, o = {}) {
    const el = o.multiline
      ? h('textarea', { rows: o.rows || 4, maxlength: o.max, placeholder: o.placeholder, class: o.class })
      : h('input', { type: o.type || 'text', maxlength: o.max, placeholder: o.placeholder, class: o.class, min: o.min, step: o.step, autocomplete: 'off', spellcheck: o.url ? 'false' : null });
    el.value = obj[key] == null ? '' : obj[key];
    el.addEventListener('input', () => {
      obj[key] = o.number ? Math.max(0, Number(el.value) || 0) : el.value;
      el.classList.remove('is-invalid');
      if (o.onInput) o.onInput(obj[key]);
      changed();
    });
    if (o.url) {
      el.addEventListener('change', () => {
        const v = normalizeUrl(el.value, o.mail);
        if (v !== el.value) {
          el.value = v;
          obj[key] = v;
          if (o.onInput) o.onInput(v);
          changed();
        }
        el.classList.toggle('is-invalid', !validUrl(v));
        if (o.onCommit) o.onCommit(v);
      });
      if (!validUrl(el.value)) el.classList.add('is-invalid');
    }
    return el;
  }

  function field(label, control, hint) {
    return h('label', { class: 'field' }, h('span', { class: 'field__label', text: label }), control, hint && h('span', { class: 'field__hint', text: hint }));
  }

  function toggle(obj, key, label, desc, onChange) {
    const box = h('input', { type: 'checkbox', class: 'switch__input', role: 'switch' });
    box.checked = !!obj[key];
    box.addEventListener('change', () => {
      obj[key] = box.checked;
      changed();
      if (onChange) onChange(box.checked);
    });
    return h('label', { class: 'switch' }, box, h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
      h('span', { class: 'switch__text' }, h('b', { text: label }), desc && h('span', { text: desc })));
  }

  function iconBtn(icon, title, disabled, onclick, variant) {
    return h('button', { class: `icon-btn${variant ? ` icon-btn--${variant}` : ''}`, type: 'button', title, 'aria-label': title, disabled, onclick }, ui(icon));
  }

  const head = (title, desc) => h('header', { class: 'page-head' }, h('h1', { text: title }), desc && h('p', { text: desc }));
  const card = (...kids) => h('section', { class: 'card' }, ...kids);
  const cardTitle = (text) => h('h3', { class: 'card__title', text });

  // Список с перетаскиванием, стрелками и удалением
  function listEditor(items, row, { empty, addLabel, make, max } = {}) {
    const rows = h('div', { class: 'rows' });
    let dragging = false;

    function redraw() {
      rows.replaceChildren();
      if (!items.length && empty) rows.append(h('p', { class: 'rows__empty', text: empty }));
      items.forEach((item, i) => {
        const grip = h('span', { class: 'grip', title: 'Перетащи, чтобы поменять порядок' }, ui('grip'));
        const node = h('div', { class: 'row', 'data-index': i }, grip,
          h('div', { class: 'row__body' }, row(item, i, redraw)),
          h('div', { class: 'row__ctl' },
            iconBtn('up', 'Выше', i === 0, () => { move(items, i, i - 1); changed(); redraw(); }),
            iconBtn('down', 'Ниже', i === items.length - 1, () => { move(items, i, i + 1); changed(); redraw(); }),
            iconBtn('trash', 'Удалить', false, () => { items.splice(i, 1); changed(); redraw(); }, 'danger')));

        grip.addEventListener('pointerdown', () => {
          node.draggable = true;
          document.addEventListener('pointerup', () => { node.draggable = false; }, { once: true });
        });
        node.addEventListener('dragstart', (e) => {
          dragging = true;
          node.classList.add('is-dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
        });
        node.addEventListener('dragover', (e) => {
          if (!dragging) return;
          e.preventDefault();
          const current = rows.querySelector('.is-dragging');
          if (!current || current === node) return;
          const box = node.getBoundingClientRect();
          rows.insertBefore(current, e.clientY > box.top + box.height / 2 ? node.nextSibling : node);
        });
        node.addEventListener('drop', (e) => e.preventDefault());
        node.addEventListener('dragend', () => {
          node.draggable = false;
          if (!dragging) return;
          dragging = false;
          const order = Array.from(rows.querySelectorAll('.row'), (n) => Number(n.dataset.index));
          if (order.some((k, j) => k !== j)) {
            items.splice(0, items.length, ...order.map((k) => items[k]));
            changed();
          }
          redraw();
        });
        rows.append(node);
      });
    }

    redraw();
    const wrap = h('div', { class: 'rows-wrap' }, rows);
    wrap.redraw = redraw;
    if (make) {
      wrap.style.display = 'grid';
      wrap.style.gap = '10px';
      wrap.append(h('button', {
        class: 'btn btn--soft btn--add',
        type: 'button',
        onclick: () => {
          if (max && items.length >= max) return toast(`Не больше ${max}`, 'error');
          items.push(make());
          changed();
          redraw();
          const last = rows.lastElementChild && rows.lastElementChild.querySelector('input:not([type="checkbox"]), textarea');
          if (last) last.focus();
        },
      }, ui('plus'), addLabel));
    }
    return wrap;
  }

  // ---------------------------------------------------------------- загрузка файлов

  function dropzone({ kind, accept, label, hint, multiple, onDone }) {
    const fileInput = h('input', { type: 'file', accept, multiple, hidden: true });
    const bar = h('span');
    const status = h('span', { class: 'drop__status' });
    const zone = h('div', { class: 'drop', tabindex: '0', role: 'button' },
      ui('upload', 'drop__icon'), h('b', { text: label }), h('span', { class: 'drop__hint', text: hint }), status, h('span', { class: 'progress' }, bar), fileInput);

    zone.addEventListener('click', (e) => { if (e.target !== fileInput) fileInput.click(); });
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('is-over');
      handle(Array.from(e.dataTransfer.files));
    });
    fileInput.addEventListener('change', () => {
      handle(Array.from(fileInput.files));
      fileInput.value = '';
    });

    async function handle(files) {
      if (!files.length) return;
      if (!multiple) files = files.slice(0, 1);
      zone.classList.add('is-busy');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        status.textContent = files.length > 1 ? `Загружаю ${i + 1} из ${files.length}…` : `Загружаю «${file.name}»…`;
        bar.style.width = '0%';
        try {
          onDone(await upload(file, kind, (p) => { bar.style.width = `${Math.round(p * 100)}%`; }), file);
        } catch (err) {
          toast(`${file.name}: ${err.message}`, 'error');
        }
      }
      zone.classList.remove('is-busy');
      status.textContent = '';
      bar.style.width = '0%';
    }
    zone.handle = handle;
    return zone;
  }

  function imageField(label, obj, key, { shape, hint, onChange }) {
    const img = h('img', { alt: '' });
    const empty = h('span', { class: 'thumb__empty', text: 'нет картинки' });
    const thumb = h('div', { class: `thumb thumb--${shape}` }, img, empty);
    const sync = () => {
      const has = !!obj[key];
      if (has && img.getAttribute('src') !== view(obj[key])) img.src = view(obj[key]);
      img.hidden = !has;
      empty.hidden = has;
      empty.textContent = 'нет картинки';
      if (onChange) onChange();
    };
    img.addEventListener('error', () => {
      img.hidden = true;
      empty.hidden = false;
      empty.textContent = 'не открылась';
    });
    const urlInput = input(obj, key, { url: true, placeholder: 'https://… или загрузи файл', onCommit: sync });
    const zone = dropzone({
      kind: 'image',
      accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif',
      label: 'Загрузить картинку',
      hint: `или перетащи сюда · jpg, png, webp, gif до ${B.limits.image} МБ`,
      onDone: (res) => {
        obj[key] = res.url;
        urlInput.value = res.url;
        urlInput.classList.remove('is-invalid');
        sync();
        changed();
      },
    });
    zone.style.padding = '14px';
    sync();
    return h('div', { class: 'field' }, h('span', { class: 'field__label', text: label }),
      h('div', { class: 'image-field__row' }, thumb, h('div', { class: 'image-field__side' }, zone, urlInput, hint && h('span', { class: 'field__hint', text: hint }))));
  }

  // ---------------------------------------------------------------- выбор иконки

  let popover = null;

  function closePopover() {
    if (!popover) return;
    popover.node.remove();
    document.removeEventListener('pointerdown', popover.outside, true);
    document.removeEventListener('keydown', popover.onKey, true);
    popover = null;
  }

  function pickIcon(anchor, onPick) {
    closePopover();
    const node = h('div', { class: 'popover', role: 'dialog', 'aria-label': 'Выбери соцсеть' },
      h('div', { class: 'popover__grid' }, Object.entries(ICONS).map(([type, def]) =>
        h('button', { class: 'pick', type: 'button', style: `--brand:${def.color}`, onclick: () => { closePopover(); onPick(type); } },
          h('i', null, brandIcon(type)), h('span', { text: def.label })))));
    document.body.append(node);
    const r = anchor.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - node.offsetWidth - 12;
    node.style.left = `${Math.max(12, Math.min(r.left, maxLeft)) + window.scrollX}px`;
    const below = r.bottom + node.offsetHeight + 12 < window.innerHeight;
    node.style.top = `${(below ? r.bottom + 8 : Math.max(12, r.top - node.offsetHeight - 8)) + window.scrollY}px`;
    const outside = (e) => { if (!node.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closePopover(); };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closePopover();
        anchor.focus();
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKey, true);
    popover = { node, outside, onKey };
    node.querySelector('button').focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- разделы

  function renderLinks(root) {
    const links = S.content.links;
    root.append(head('Ссылки', 'Кнопки соцсетей под шапкой сайта. Порядок здесь — порядок на сайте: перетаскивай за точки слева или двигай стрелками.'));

    const preview = h('div', { class: 'preview-links' });
    const drawPreview = () => {
      preview.replaceChildren(...links.filter((l) => l.visible && l.url).map((l) => {
        const def = ICONS[l.type] || ICONS.website;
        return h('span', { class: 'pill', style: `--brand:${def.color}` }, h('i', null, brandIcon(l.type)), h('span', { text: l.label || def.label }));
      }));
    };

    const editor = listEditor(links, (link, i, redraw) => {
      const def = ICONS[link.type] || ICONS.website;
      const typeBtn = h('button', {
        class: 'type-btn', type: 'button', style: `--brand:${def.color}`, title: 'Сменить соцсеть', 'aria-label': `Соцсеть: ${def.label}. Сменить`,
        onclick: (e) => pickIcon(e.currentTarget, (type) => {
          if (!link.label || link.label === def.label) link.label = ICONS[type].label;
          link.type = type;
          changed();
          redraw();
        }),
      }, brandIcon(link.type));
      const openLink = h('a', { class: 'icon-btn', href: link.url || '#', target: '_blank', rel: 'noopener noreferrer', title: 'Открыть ссылку', 'aria-disabled': link.url ? null : 'true' }, ui('external'));
      const url = input(link, 'url', {
        url: true, mail: true, class: 'url', placeholder: link.type === 'email' ? 'почта@пример.ru' : 'https://…',
        onInput: (v) => { openLink.href = v || '#'; openLink.setAttribute('aria-disabled', v ? 'false' : 'true'); },
      });
      const vis = h('button', {
        class: 'icon-btn vis', type: 'button', 'aria-pressed': String(link.visible), title: link.visible ? 'Видна на сайте — скрыть' : 'Скрыта — показать',
        onclick: () => { link.visible = !link.visible; changed(); redraw(); },
      }, ui(link.visible ? 'eye' : 'eyeOff'));
      return h('div', { class: `link-row${link.visible ? '' : ' is-off'}` }, typeBtn, input(link, 'label', { max: 40, placeholder: def.label }), url, vis, openLink);
    }, { empty: 'Ссылок пока нет' });

    const add = h('button', {
      class: 'btn btn--soft btn--add', type: 'button',
      onclick: (e) => pickIcon(e.currentTarget, (type) => {
        if (links.length >= 40) return toast('Не больше 40 ссылок', 'error');
        links.push({ id: rid(), type, label: ICONS[type].label, url: '', visible: true });
        changed();
        editor.redraw();
        const rows = editor.querySelectorAll('.row');
        const last = rows[rows.length - 1];
        if (last) last.querySelector('.url').focus();
      }),
    }, ui('plus'), 'Добавить ссылку');

    root.append(card(editor, add));
    root.append(card(cardTitle('Так кнопки выглядят на сайте'), preview));
    drawPreview();
    S.onChange = drawPreview;
  }

  function renderMusic(root) {
    const m = S.content.music;
    root.append(head('Музыка', 'Трек, который играет, когда человек заходит на сайт.'));
    root.append(card(toggle(m, 'enabled', 'Играть музыку при входе',
      'Браузеры не дают сайтам включать звук сами, поэтому перед сайтом появляется заставка «нажми, чтобы войти». Клик по ней и запускает трек.')));

    const audio = h('audio', { controls: true, preload: 'metadata' });
    const nowTitle = h('b');
    const nowArtist = h('span');
    const now = h('div', { class: 'now' },
      h('div', { class: 'now__disc' }, h('img', { src: view(S.content.profile.avatar) || null, alt: '' })),
      h('div', { class: 'now__meta' }, nowTitle, nowArtist), audio);
    audio.addEventListener('play', () => now.classList.add('is-playing'));
    audio.addEventListener('pause', () => now.classList.remove('is-playing'));
    audio.addEventListener('error', () => { if (m.src) nowArtist.textContent = 'файл не открывается — проверь ссылку'; });

    const syncMeta = () => {
      nowTitle.textContent = m.src ? m.title || 'без названия' : 'трек не выбран';
      nowArtist.textContent = m.src ? m.artist : 'загрузи файл или вставь ссылку';
    };
    const syncSrc = () => {
      if (audio.getAttribute('src') !== view(m.src)) {
        if (m.src) audio.src = view(m.src);
        else audio.removeAttribute('src');
        audio.load();
      }
      audio.volume = m.volume;
      syncMeta();
    };

    const title = input(m, 'title', { max: 100, onInput: syncMeta });
    const artist = input(m, 'artist', { max: 100, onInput: syncMeta });
    const src = input(m, 'src', { url: true, placeholder: 'https://…/track.mp3', onCommit: syncSrc });
    const zone = dropzone({
      kind: 'audio',
      accept: 'audio/*,.mp3,.m4a,.ogg,.opus,.wav,.flac,.aac,.webm',
      label: 'Перетащи сюда трек или нажми, чтобы выбрать',
      hint: `mp3, m4a, ogg, wav, flac — до ${B.limits.audio} МБ`,
      onDone: (res, file) => {
        const base = file.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
        const parts = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
        m.src = res.url;
        m.artist = parts ? parts[1] : '';
        m.title = parts ? parts[2] : base;
        m.startAt = 0;
        src.value = m.src;
        src.classList.remove('is-invalid');
        title.value = m.title;
        artist.value = m.artist;
        start.value = 0;
        syncSrc();
        changed();
        toast('Трек загружен — не забудь сохранить');
      },
    });

    root.append(card(cardTitle('Трек'), now, zone,
      field('…или прямая ссылка на аудиофайл', src, 'Ссылка должна вести прямо на файл. Страницы YouTube, VK или Яндекс Музыки не подойдут.'),
      h('div', { class: 'grid2' }, field('Название', title), field('Исполнитель', artist))));

    const volValue = h('output', { class: 'range-val' });
    const vol = h('input', { type: 'range', min: '0', max: '100', step: '1' });
    vol.value = Math.round(m.volume * 100);
    const syncVol = () => {
      volValue.textContent = `${vol.value}%`;
      vol.style.setProperty('--v', `${vol.value}%`);
    };
    vol.addEventListener('input', () => {
      m.volume = Number(vol.value) / 100;
      audio.volume = m.volume;
      syncVol();
      changed();
    });
    syncVol();

    const start = input(m, 'startAt', { type: 'number', number: true, min: '0', step: '1', class: 'short' });
    const take = h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: () => {
        m.startAt = Math.floor(audio.currentTime || 0);
        start.value = m.startAt;
        changed();
        toast(`Трек начнётся с ${fmtTime(m.startAt)}`);
      },
    }, ui('clock'), 'Взять из плеера');
    const listen = h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: () => {
        if (!m.src) return toast('Сначала выбери трек', 'error');
        audio.currentTime = m.startAt || 0;
        audio.play().catch(() => toast('Не получилось включить трек', 'error'));
      },
    }, ui('play'), 'Послушать с этого места');

    root.append(card(cardTitle('Как играть'),
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Громкость по умолчанию', volValue), vol,
        h('span', { class: 'field__hint', text: 'Посетитель может поменять её в плеере — его выбор запомнится в его браузере.' })),
      h('div', { class: 'field' }, h('span', { class: 'field__label', text: 'Начинать с секунды' }), h('div', { class: 'inline' }, start, take, listen),
        h('span', { class: 'field__hint', text: 'Поставь трек на паузу в нужном месте и нажми «Взять из плеера».' })),
      toggle(m, 'loop', 'Повторять по кругу'),
      field('Текст на заставке', input(S.content.site, 'gateText', { max: 80, placeholder: 'нажми, чтобы войти' }))));

    syncSrc();
  }

  function renderProfile(root) {
    const p = S.content.profile;
    root.append(head('Профиль', 'Шапка сайта: имя, приветствие, аватарка и фон.'));
    root.append(card(
      h('div', { class: 'grid2' }, field('Имя', input(p, 'name', { max: 60 })), field('Подзаголовок', input(p, 'roles', { max: 120, placeholder: 'художник · дизайнер · аниматор' }))),
      field('Приветствие', input(p, 'greeting', { multiline: true, rows: 3, max: 600 })),
      field('Текст кнопки заказа', input(p, 'orderButton', { max: 60 }))));
    root.append(card(cardTitle('Картинки'),
      imageField('Аватарка', p, 'avatar', { shape: 'round', hint: 'Лучше квадратная, от 400×400.' }),
      imageField('Фон шапки', p, 'cover', { shape: 'wide', hint: 'Широкая картинка — на сайте она затемняется, чтобы текст читался.' })));
    root.append(card(field('Подпись внизу сайта', input(S.content.site, 'footer', { max: 160 }), 'Перед ней автоматически ставится © год и имя.')));
  }

  function renderAbout(root) {
    const a = S.content.about;
    root.append(head('Обо мне', 'Раздел под шапкой: пара слов о себе и короткие факты карточками.'));
    const counter = h('span', { class: 'counter' });
    const syncCount = () => { counter.textContent = ` · ${a.text.length} / 6000`; };
    const text = input(a, 'text', { multiline: true, rows: 10, max: 6000, onInput: syncCount });
    syncCount();
    root.append(card(
      toggle(a, 'enabled', 'Показывать раздел на сайте'),
      h('div', { class: 'grid2' }, field('Заголовок', input(a, 'title', { max: 60 })), field('Подпись в конце', input(a, 'signature', { max: 60, placeholder: 'Лиси ♡' }))),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Текст', counter), text,
        h('span', { class: 'field__hint', text: 'Пустая строка между кусками текста — новый абзац.' }))));
    root.append(card(cardTitle('Факты'), h('p', { class: 'card__desc', text: 'Карточки под текстом: эмодзи, подпись и значение.' }),
      listEditor(a.facts, (f) => h('div', { class: 'fact-row' },
        input(f, 'emoji', { max: 16, class: 'emoji', placeholder: '✨' }),
        input(f, 'label', { max: 40, placeholder: 'подпись' }),
        input(f, 'value', { max: 200, placeholder: 'значение', class: 'grow' })),
      { empty: 'Фактов нет — раздел покажет только текст', addLabel: 'Добавить факт', make: () => ({ id: rid(), emoji: '✨', label: '', value: '' }), max: 12 })));
  }

  function galleryEditor(images) {
    const grid = h('div', { class: 'gal' });
    const counter = h('span', { class: 'counter' });
    const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', multiple: true, hidden: true });
    const addLabel = h('span', { text: 'добавить картинки' });
    const addTile = h('button', { class: 'gal__add', type: 'button', onclick: () => fileInput.click() }, ui('plus'), addLabel);

    async function uploadMany(files) {
      files = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name));
      if (!files.length) return;
      addTile.classList.add('is-busy');
      for (let i = 0; i < files.length; i++) {
        if (images.length >= 60) {
          toast('В категории не больше 60 картинок', 'error');
          break;
        }
        addLabel.textContent = `загружаю ${i + 1} / ${files.length}`;
        try {
          const res = await upload(files[i], 'image', (p) => { addLabel.textContent = `загружаю ${i + 1} / ${files.length} · ${Math.round(p * 100)}%`; });
          images.push(res.url);
          changed();
          draw();
        } catch (err) {
          toast(`${files[i].name}: ${err.message}`, 'error');
        }
      }
      addTile.classList.remove('is-busy');
      addLabel.textContent = 'добавить картинки';
    }

    fileInput.addEventListener('change', () => {
      uploadMany(Array.from(fileInput.files));
      fileInput.value = '';
    });
    addTile.addEventListener('dragover', (e) => { e.preventDefault(); addTile.classList.add('is-over'); });
    addTile.addEventListener('dragleave', () => addTile.classList.remove('is-over'));
    addTile.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      addTile.classList.remove('is-over');
      uploadMany(Array.from(e.dataTransfer.files));
    });

    function draw() {
      grid.replaceChildren();
      images.forEach((src, i) => {
        const tile = h('div', { class: 'gal__tile' });
        const img = h('img', { src: view(src), alt: `Работа ${i + 1}`, loading: 'lazy' });
        img.addEventListener('error', () => tile.classList.add('is-broken'));
        tile.append(img, h('div', { class: 'gal__ctl' },
          iconBtn('left', 'Левее', i === 0, () => { move(images, i, i - 1); changed(); draw(); }),
          iconBtn('right', 'Правее', i === images.length - 1, () => { move(images, i, i + 1); changed(); draw(); }),
          iconBtn('x', 'Убрать', false, () => { images.splice(i, 1); changed(); draw(); }, 'danger')));
        grid.append(tile);
      });
      grid.append(addTile);
      counter.textContent = `${images.length} / 60`;
    }

    const urlInput = h('input', { type: 'url', placeholder: 'или вставь ссылку на картинку', spellcheck: 'false' });
    const addUrl = () => {
      const v = normalizeUrl(urlInput.value);
      if (!v) return;
      if (!validUrl(v)) return urlInput.classList.add('is-invalid');
      if (images.length >= 60) return toast('В категории не больше 60 картинок', 'error');
      images.push(v);
      urlInput.value = '';
      changed();
      draw();
    };
    urlInput.addEventListener('input', () => urlInput.classList.remove('is-invalid'));
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addUrl();
      }
    });

    draw();
    return h('div', { class: 'gal-wrap' }, grid, fileInput,
      h('div', { class: 'inline' }, urlInput, h('button', { class: 'btn btn--soft', type: 'button', onclick: addUrl }, 'Добавить'), counter));
  }

  function renderOrders(root) {
    const c = S.content.commissions;
    root.append(head('Заказы', 'Статус, цены, примеры работ и правила.'));
    root.append(card(
      toggle(c, 'open', 'Принимаю заказы', 'Меняет плашку на сайте: зелёная «открыты» или серая «закрыты».'),
      h('div', { class: 'grid2' }, field('Текст, когда открыты', input(c, 'openText', { max: 40 })), field('Текст, когда закрыты', input(c, 'closedText', { max: 40 }))),
      h('div', { class: 'grid2' },
        field('Кнопка связи', input(c, 'contactLabel', { max: 60, placeholder: 'написать в Telegram' })),
        field('Куда ведёт кнопка', input(c, 'contactUrl', { url: true, mail: true, placeholder: 'https://t.me/…' }))),
      field('Срок выполнения', input(c, 'deadline', { max: 200 }))));

    const cats = h('div');
    const drawCats = () => {
      cats.replaceChildren();
      c.categories.forEach((cat, ci) => {
        const header = h('div', { class: 'cat__head' },
          input(cat, 'title', { max: 30, placeholder: 'название вкладки' }),
          iconBtn('up', 'Выше', ci === 0, () => { move(c.categories, ci, ci - 1); changed(); drawCats(); }),
          iconBtn('down', 'Ниже', ci === c.categories.length - 1, () => { move(c.categories, ci, ci + 1); changed(); drawCats(); }),
          iconBtn('trash', 'Удалить категорию', false, () => {
            if (!confirm(`Удалить категорию «${cat.title}» вместе с ценами и примерами?`)) return;
            c.categories.splice(ci, 1);
            changed();
            drawCats();
          }, 'danger'));
        cats.append(card(header,
          h('h4', { class: 'mini', text: 'Цены' }),
          listEditor(cat.prices, (p) => h('div', { class: 'price-row' },
            input(p, 'label', { max: 60, placeholder: 'что именно' }),
            input(p, 'price', { max: 30, placeholder: '1000 ₽' })),
          { empty: 'Цен нет — на сайте будет «цены уточняй в личке»', addLabel: 'Добавить цену', make: () => ({ id: rid(), label: '', price: '' }), max: 12 }),
          h('h4', { class: 'mini', text: 'Прайс-лист' }),
          imageField('Картинка с прайсом', cat, 'sheet', { shape: 'wide', hint: 'Необязательно. На сайте стоит над примерами и открывается целиком по клику.' }),
          h('h4', { class: 'mini', text: 'Примеры работ' }),
          galleryEditor(cat.images)));
      });
      cats.append(h('button', {
        class: 'btn btn--soft', type: 'button',
        onclick: () => {
          if (c.categories.length >= 8) return toast('Не больше 8 категорий', 'error');
          c.categories.push({ id: rid(), title: 'новая', sheet: '', prices: [], images: [] });
          changed();
          drawCats();
        },
      }, ui('plus'), 'Добавить категорию'));
    };
    drawCats();
    root.append(h('h2', { class: 'subhead', text: 'Категории' }), cats);

    // правила — массив строк, поэтому привязка по индексу
    const rules = listEditor(c.rules, (rule, i) => {
      const el = h('input', { type: 'text', maxlength: '300', placeholder: 'правило' });
      el.value = rule;
      el.addEventListener('input', () => {
        c.rules[i] = el.value;
        changed();
      });
      return el;
    }, { empty: 'Правил нет — блок на сайте скроется', addLabel: 'Добавить правило', make: () => '', max: 30 });
    root.append(h('h2', { class: 'subhead', text: 'Правила при заказе' }), card(rules));
  }

  function renderMerch(root) {
    const g = S.content.merch;
    root.append(head('Мерч', 'Каталог товаров на сайте. Нажатие на товар ведёт на маркет, а если маркетов несколько — посетитель выбирает, где открыть.'));
    root.append(card(
      toggle(g, 'enabled', 'Показывать каталог на сайте'),
      field('Заголовок', input(g, 'title', { max: 60 })),
      field('Текст под заголовком', input(g, 'lead', { multiline: true, rows: 2, max: 400 }))));

    let openId = null;
    const list = h('div', { class: 'merch-list' });
    const counter = h('span', { class: 'counter' });
    const datalist = h('datalist', { id: 'merchCategories' });
    const search = h('input', { type: 'search', placeholder: 'найти товар: название, фандом, категория…', autocomplete: 'off' });
    search.addEventListener('input', () => draw());

    const badges = (it) => it.links.map((l) => marketBadge(l.market, !l.url));
    const describe = (it) => [it.category, it.subtitle].filter(Boolean).join(' · ') || 'без подписи';

    function row(it, canMove) {
      const i = g.items.indexOf(it);
      const isOpen = openId === it.id;
      const thumb = h('img', { class: 'merch-row__img', src: view(it.image) || null, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      const title = h('b', { text: it.title || 'без названия' });
      const sub = h('span', { text: describe(it) });
      const logos = h('span', { class: 'merch-row__mk' }, badges(it));
      const refreshHead = () => {
        title.textContent = it.title || 'без названия';
        sub.textContent = describe(it);
        logos.replaceChildren(...badges(it));
        if (it.image) thumb.src = view(it.image);
        else thumb.removeAttribute('src');
      };
      const node = h('div', { class: `merch-row${isOpen ? ' is-open' : ''}` },
        h('div', { class: 'merch-row__head' }, thumb, h('div', { class: 'merch-row__meta' }, title, sub), logos,
          h('div', { class: 'row__ctl' },
            canMove && iconBtn('up', 'Выше', i === 0, () => { move(g.items, i, i - 1); changed(); draw(); }),
            canMove && iconBtn('down', 'Ниже', i === g.items.length - 1, () => { move(g.items, i, i + 1); changed(); draw(); }),
            h('button', {
              class: 'btn btn--soft btn--sm', type: 'button', 'aria-expanded': String(isOpen),
              onclick: () => { openId = isOpen ? null : it.id; draw(); },
            }, isOpen ? 'Свернуть' : 'Изменить'),
            iconBtn('trash', 'Удалить товар', false, () => {
              if (!confirm(`Убрать «${it.title || 'без названия'}» из каталога?`)) return;
              g.items.splice(g.items.indexOf(it), 1);
              changed();
              draw();
            }, 'danger'))));

      if (isOpen) {
        const category = input(it, 'category', { max: 40, placeholder: 'например, брелоки', onInput: refreshHead });
        category.setAttribute('list', 'merchCategories');
        const links = listEditor(it.links, (l) => {
          const select = h('select', null, Object.entries(MARKETS).map(([key, m]) => h('option', { value: key, text: m.label })));
          select.value = l.market;
          select.addEventListener('change', () => {
            l.market = select.value;
            changed();
            refreshHead();
          });
          return h('div', { class: 'mlink-row' }, select,
            input(l, 'url', { url: true, placeholder: 'https://… ссылка на этот товар', onInput: refreshHead }),
            input(l, 'price', { max: 30, placeholder: 'цена (необяз.)' }));
        }, {
          empty: 'Ссылок нет — без них товар не появится на сайте',
          addLabel: 'Добавить маркет',
          make: () => ({ market: 'wildberries', url: '', price: '' }),
          max: 8,
        });
        node.append(h('div', { class: 'merch-row__edit' },
          h('div', { class: 'grid2' },
            field('Название', input(it, 'title', { max: 80, onInput: refreshHead })),
            field('Подпись', input(it, 'subtitle', { max: 120, placeholder: 'фандом, размер…', onInput: refreshHead }))),
          field('Категория', category, 'Одинаковая категория — одна вкладка-фильтр на сайте.'),
          imageField('Картинка', it, 'image', { shape: 'product', hint: 'Лучше всего вертикальная, 3:4.', onChange: refreshHead }),
          h('div', { class: 'field' }, h('span', { class: 'field__label', text: 'Где купить' }), links,
            h('span', { class: 'field__hint', text: 'Цена показывается на карточке рядом со значком маркета. Цены на маркетах часто меняются — её можно не указывать.' }))));
      }
      return node;
    }

    function draw() {
      datalist.replaceChildren(...[...new Set(g.items.map((it) => it.category).filter(Boolean))].map((c) => h('option', { value: c })));
      const q = search.value.trim().toLowerCase().replace(/ё/g, 'е');
      const shown = g.items.filter((it) => !q || `${it.title} ${it.subtitle} ${it.category}`.toLowerCase().replace(/ё/g, 'е').includes(q));
      counter.textContent = q ? `${shown.length} из ${g.items.length}` : `${g.items.length} шт.`;
      list.replaceChildren();
      if (!shown.length) list.append(h('p', { class: 'rows__empty', text: g.items.length ? 'Ничего не нашлось' : 'Товаров пока нет' }));
      shown.forEach((it) => list.append(row(it, !q)));
    }

    const add = h('button', {
      class: 'btn btn--primary', type: 'button',
      onclick: () => {
        if (g.items.length >= 300) return toast('Не больше 300 товаров', 'error');
        const it = { id: rid(), title: '', subtitle: '', category: '', image: '', links: [{ market: 'wildberries', url: '', price: '' }] };
        g.items.unshift(it);
        openId = it.id;
        search.value = '';
        changed();
        draw();
        const first = list.querySelector('.merch-row__edit input');
        if (first) first.focus();
      },
    }, ui('plus'), 'Добавить товар');

    root.append(card(h('div', { class: 'merch-tools' }, search, counter, add), datalist, list));
    draw();
  }

  async function renderFiles(root) {
    root.append(head('Файлы', 'Всё, что загружено через панель. Файлы, которых нет на сайте, можно удалить.'));
    const box = card(h('p', { class: 'muted', text: 'Загружаю список…' }));
    root.append(box);
    let files;
    try {
      ({ files } = await B.listUploads());
    } catch (err) {
      box.replaceChildren(h('p', { class: 'banner', text: err.message }));
      return;
    }
    if (!box.isConnected) return;
    box.replaceChildren();
    if (isDirty()) box.append(h('p', { class: 'note', text: 'Есть несохранённые изменения. Пометка «на сайте» считается по последней сохранённой версии.' }));
    if (!files.length) return box.append(h('p', { class: 'muted', text: 'Пока ничего не загружено.' }));
    box.append(h('div', { class: 'files' }, files.map((f) => {
      const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name);
      const row = h('div', { class: 'file' },
        h('a', { class: 'file__thumb', href: view(f.url), target: '_blank', rel: 'noopener', title: 'Открыть' }, isImage ? h('img', { src: view(f.url), alt: '', loading: 'lazy' }) : ui('music')),
        h('div', { style: 'min-width:0' }, h('div', { class: 'file__name', text: f.name }),
          h('div', { class: 'file__meta', text: f.mtime ? `${fmtSize(f.size)} · ${new Date(f.mtime).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}` : fmtSize(f.size) })),
        h('span', { class: `badge ${f.used ? 'badge--used' : 'badge--free'}`, text: f.used ? 'на сайте' : 'не используется' }),
        iconBtn('trash', f.used ? 'Используется на сайте' : 'Удалить файл', f.used, async () => {
          if (!confirm(`Удалить ${f.name} насовсем?`)) return;
          try {
            await B.deleteUpload(f);
            row.remove();
            toast('Файл удалён');
          } catch (err) {
            toast(err.message, 'error');
          }
        }, 'danger'));
      return row;
    })));
  }

  function renderSecurity(root) {
    if (GH) {
      root.append(head('Безопасность', 'Панель входит на GitHub по токену.'));
      root.append(card(cardTitle('Токен GitHub'),
        h('p', { class: 'card__desc', text: 'Токен хранится только в этом браузере. Если устройство чужое или токен мог утечь — выйди и отзови токен на GitHub: без него панель ничего изменить не сможет.' }),
        h('div', { class: 'inline' },
          h('button', { class: 'btn btn--ghost', type: 'button', onclick: logout }, ui('logout'), 'Выйти на этом устройстве'),
          h('a', { class: 'btn btn--soft', href: 'https://github.com/settings/personal-access-tokens', target: '_blank', rel: 'noopener noreferrer' }, ui('external'), 'Мои токены на GitHub'))));
      root.append(card(cardTitle('Где лежит сайт'),
        h('p', { class: 'card__desc' }, 'Репозиторий: ',
          h('a', { href: `https://github.com/${CONFIG.owner}/${CONFIG.repo}`, target: '_blank', rel: 'noopener noreferrer', text: `${CONFIG.owner}/${CONFIG.repo}` }),
          '. Каждое сохранение — это коммит, так что любую старую версию можно вернуть через историю репозитория.')));
      return;
    }
    root.append(head('Безопасность', 'Пароль от панели и выход.'));
    const current = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const next = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '8' });
    const again = h('input', { type: 'password', autocomplete: 'new-password', required: true });
    const form = h('form', {
      class: 'card',
      onsubmit: async (e) => {
        e.preventDefault();
        if (next.value.length < 8) return toast('Новый пароль — минимум 8 символов', 'error');
        if (next.value !== again.value) return toast('Новые пароли не совпадают', 'error');
        try {
          await B.changePassword(current.value, next.value);
          form.reset();
          toast('Пароль изменён. Входы на других устройствах сброшены.');
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    }, cardTitle('Сменить пароль'), field('Текущий пароль', current),
    h('div', { class: 'grid2' }, field('Новый пароль', next, 'Минимум 8 символов'), field('Новый ещё раз', again)),
    h('div', null, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Сменить пароль')));
    root.append(form);
    root.append(card(cardTitle('Выход'), h('p', { class: 'card__desc', text: '«Выйти везде» закроет панель на всех устройствах, где был выполнен вход.' }),
      h('div', { class: 'inline' },
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: logout }, ui('logout'), 'Выйти'),
        h('button', { class: 'btn btn--danger', type: 'button', onclick: logoutAll }, 'Выйти везде'))));
  }

  // ---------------------------------------------------------------- состояние

  const isDirty = () => !!S.content && JSON.stringify(S.content) !== S.saved;

  function changed() {
    const bar = document.getElementById('savebar');
    if (bar) bar.hidden = !isDirty();
    if (S.onChange) S.onChange();
  }

  async function save() {
    if (S.saving || !isDirty()) return;
    if (S.uploads > 0) return toast('Дождись, пока загрузятся файлы', 'error');
    const invalid = document.querySelector('.main .is-invalid');
    if (invalid) {
      invalid.focus();
      return toast('Проверь ссылки, подсвеченные красным', 'error');
    }
    S.saving = true;
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    const sent = JSON.stringify(S.content);
    try {
      const res = await B.saveContent(S.content);
      S.saved = JSON.stringify(res.content);
      // сервер мог поправить данные (например, дописать https://) — тогда перерисуем
      if (S.saved !== sent) {
        S.content = JSON.parse(S.saved);
        renderSection();
      }
      changed();
      refreshBrand();
      toast(B.savedNote);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      S.saving = false;
      btn.disabled = false;
    }
  }

  function discard() {
    S.content = JSON.parse(S.saved);
    renderSection();
    changed();
    toast('Изменения отменены');
  }

  async function logout() {
    if (isDirty() && !confirm('Есть несохранённые изменения. Всё равно выйти?')) return;
    try {
      await B.logout();
    } catch {}
    S.content = null;
    renderAuth('login');
  }

  async function logoutAll() {
    if (!confirm('Выйти на всех устройствах?')) return;
    try {
      await B.logoutAll();
    } catch {}
    S.content = null;
    renderAuth('login');
  }

  // ---------------------------------------------------------------- экраны

  function refreshBrand() {
    const img = document.getElementById('brandAvatar');
    const name = document.getElementById('brandName');
    if (!img) return;
    const p = JSON.parse(S.saved).profile;
    if (p.avatar) img.src = view(p.avatar);
    img.hidden = !p.avatar;
    name.textContent = p.name || 'Лиси';
  }

  function renderSection() {
    closePopover();
    const main = document.getElementById('main');
    S.onChange = null;
    main.replaceChildren();
    if (S.problem) main.append(h('p', { class: 'banner', text: S.problem }));
    const section = SECTIONS.find((s) => s.id === S.section) || SECTIONS[0];
    section.render(main);
    document.querySelectorAll('.nav [data-id]').forEach((b) => {
      if (b.dataset.id === section.id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    document.title = `${section.title} · Панель Лиси`;
  }

  function go(id) {
    S.section = id;
    store('set', 'lisi:section', id);
    renderSection();
    window.scrollTo(0, 0);
  }

  function renderShell() {
    const p = S.content.profile;
    app.className = '';
    app.replaceChildren(
      h('div', { class: 'shell' },
        h('aside', { class: 'side' },
          h('div', { class: 'brand' }, h('img', { id: 'brandAvatar', src: view(p.avatar) || null, alt: '', hidden: !p.avatar }),
            h('div', null, h('b', { id: 'brandName', text: p.name || 'Лиси' }), h('span', { text: 'панель владельца' }))),
          h('nav', { class: 'nav', 'aria-label': 'Разделы' }, SECTIONS.map((s) =>
            h('button', { class: 'nav__item', type: 'button', 'data-id': s.id, onclick: () => go(s.id) }, ui(s.icon), h('span', { text: s.title })))),
          h('div', { class: 'side__foot' },
            h('a', { class: 'nav__item', href: S.session.siteUrl, target: '_blank', rel: 'noopener' }, ui('external'), h('span', { text: 'Открыть сайт' })),
            h('button', { class: 'nav__item', type: 'button', onclick: logout }, ui('logout'), h('span', { text: 'Выйти' })))),
        h('main', { class: 'main', id: 'main' })),
      h('div', { class: 'savebar', id: 'savebar', hidden: true },
        h('span', { class: 'savebar__text', text: 'Есть несохранённые изменения' }),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: discard }, 'Отменить'),
        h('button', { class: 'btn btn--primary', id: 'saveBtn', type: 'button', onclick: save }, ui('check'), 'Сохранить')));
    renderSection();
  }

  function authAvatar() {
    const avatar = h('img', { class: 'auth__avatar', alt: '' });
    avatar.hidden = true;
    B.profile().then((p) => {
      if (!p.avatar) return;
      avatar.src = view(p.avatar);
      avatar.hidden = false;
    }).catch(() => {});
    return avatar;
  }

  // Вход на GitHub Pages: токен GitHub вместо пароля
  function renderTokenAuth() {
    const tokenInput = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…', required: true });
    const remember = h('input', { type: 'checkbox' });
    remember.checked = true;
    const error = h('p', { class: 'auth__error', role: 'alert' });
    const submit = h('button', { class: 'btn btn--primary btn--wide', type: 'submit' }, 'Войти');
    const form = h('form', {
      class: 'auth auth--wide',
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = '';
        submit.disabled = true;
        try {
          await B.login(tokenInput.value, remember.checked);
          tokenInput.value = '';
          await boot();
        } catch (err) {
          error.textContent = err.message;
          submit.disabled = false;
          tokenInput.select();
        }
      },
    }, authAvatar(),
    h('h1', { class: 'auth__title', text: 'Панель Лиси ♡' }),
    h('p', { class: 'auth__lead', text: 'Сайт живёт на GitHub, поэтому вход — по токену GitHub. Он разрешает панели сохранять изменения в репозиторий сайта.' }),
    h('details', { class: 'howto' },
      h('summary', { text: 'Как получить токен (нужно один раз)' }),
      h('ol', null,
        h('li', null, 'Войди на GitHub в аккаунт ', h('b', { text: CONFIG.owner }), ' и открой ',
          h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener noreferrer' }, 'создание токена'), '.'),
        h('li', null, 'Название — любое, например «панель сайта». Срок действия — например, год.'),
        h('li', null, 'Repository access → Only select repositories → ', h('b', { text: CONFIG.repo }), '.'),
        h('li', null, 'Permissions → Repository permissions → Contents → ', h('b', { text: 'Read and write' }), '.'),
        h('li', null, 'Нажми Generate token, скопируй токен и вставь его ниже. Больше GitHub его не покажет.'))),
    field('Токен', tokenInput),
    h('label', { class: 'check' }, remember, h('span', { text: 'Запомнить на этом устройстве' })),
    error, submit);
    app.className = '';
    app.replaceChildren(h('div', { class: 'auth-page' }, form));
    document.title = 'Вход · Панель Лиси';
    tokenInput.focus();
  }

  function renderAuth(mode) {
    if (GH) return renderTokenAuth();
    const setup = mode === 'setup';
    const password = h('input', { type: 'password', autocomplete: setup ? 'new-password' : 'current-password', required: true });
    const again = setup ? h('input', { type: 'password', autocomplete: 'new-password', required: true }) : null;
    const error = h('p', { class: 'auth__error', role: 'alert' });
    const submit = h('button', { class: 'btn btn--primary btn--wide', type: 'submit' }, setup ? 'Задать пароль и войти' : 'Войти');
    const form = h('form', {
      class: 'auth',
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = '';
        if (setup && password.value.length < 8) return (error.textContent = 'Пароль — минимум 8 символов');
        if (setup && password.value !== again.value) return (error.textContent = 'Пароли не совпадают');
        submit.disabled = true;
        try {
          await (setup ? B.setup(password.value) : B.login(password.value));
          await boot();
        } catch (err) {
          error.textContent = err.message;
          submit.disabled = false;
          password.select();
        }
      },
    }, authAvatar(),
    h('h1', { class: 'auth__title', text: setup ? 'Привет! ♡' : 'С возвращением ♡' }),
    h('p', { class: 'auth__lead', text: setup ? 'Это панель владельца сайта. Придумай пароль — по нему сюда можно будет заходить.' : 'Панель владельца сайта' }),
    field('Пароль', password, setup ? 'Минимум 8 символов' : null),
    again && field('Ещё раз', again),
    error, submit);
    app.className = '';
    app.replaceChildren(h('div', { class: 'auth-page' }, form));
    document.title = 'Вход · Панель Лиси';
    password.focus();
  }

  async function boot() {
    try {
      S.session = await B.session();
    } catch (err) {
      app.className = 'boot';
      app.textContent = err.message;
      return;
    }
    if (S.session.authProblem) {
      app.className = 'boot';
      app.replaceChildren(h('p', { class: 'banner', text: S.session.authProblem }));
      return;
    }
    if (!S.session.setUp) return renderAuth('setup');
    if (!S.session.loggedIn) return renderAuth('login');
    const data = await B.loadContent();
    S.content = data.content;
    S.saved = JSON.stringify(data.content);
    S.problem = data.problem;
    const remembered = store('get', 'lisi:section');
    if (SECTIONS.some((s) => s.id === remembered)) S.section = remembered;
    renderShell();
  }

  document.addEventListener('keydown', (e) => {
    const isS = e.code === 'KeyS' || ['s', 'S', 'ы', 'Ы'].includes(e.key);
    if ((e.ctrlKey || e.metaKey) && isS && S.content) {
      e.preventDefault();
      save();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (isDirty() || S.uploads > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  // файл, брошенный мимо зоны загрузки, не должен открываться вместо панели
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  boot();
})();
