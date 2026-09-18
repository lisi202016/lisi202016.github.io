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
    { id: 'stats', title: 'Статистика', icon: 'chart', render: renderStats },
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
    chart: 'M4 20V11M10 20V5M16 20v-6M3 20h18',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
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

  function timeoutSignal(ms) {
    return typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
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
      // Первое соединение с api.github.com иногда висит десятки секунд, а повторный запрос проходит сразу.
      // Чтение поэтому ждём недолго и повторяем; запись не повторяем — иначе можно закоммитить дважды.
      const read = method === 'GET';
      const attempts = read ? 3 : 1;
      let res;
      for (let attempt = 1; ; attempt++) {
        try {
          res = await fetch(`https://api.github.com${path}`, {
            method,
            headers: body ? { ...headers(), 'Content-Type': 'application/json' } : headers(),
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
            signal: timeoutSignal(read ? 12000 : 45000),
          });
          break;
        } catch {
          if (attempt >= attempts) throw new Error('GitHub не отвечает — проверь интернет');
          bootStatus(`GitHub долго не отвечает — пробую ещё раз (${attempt + 1} из ${attempts})…`);
        }
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
        const r = await fetch(`${CONFIG.siteUrl}content.json?v=${Date.now()}`, { cache: 'no-store', signal: timeoutSignal(15000) }).then((x) => x.json());
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
        if (!defaults) {
          try {
            defaults = await fetch(`defaults.json?v=${Date.now()}`, { cache: 'no-store', signal: timeoutSignal(15000) }).then((x) => x.json());
          } catch {
            throw new Error('не открылся файл настроек панели — проверь интернет');
          }
        }
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
        const thumbs = new Map();
        if (items.some((f) => f.type === 'dir' && f.name === 'thumbs')) {
          try {
            (await gh('GET', `${REPO}/contents/uploads/thumbs?ref=${encodeURIComponent(branch)}`)).forEach((t) => thumbs.set(t.name, t));
          } catch {}
        }
        return {
          files: items
            .filter((f) => f.type === 'file')
            .map((f) => {
              const t = thumbPath(`/uploads/${f.name}`);
              const thumb = t && thumbs.get(t.split('/').pop());
              return { name: f.name, url: `/uploads/${f.name}`, size: f.size, mtime: null, sha: f.sha, thumb: thumb ? { name: thumb.name, sha: thumb.sha } : null, used: used.includes(`"/uploads/${f.name}"`) };
            }),
        };
      },
      async stats(days) {
        let zone = 'Europe/Moscow';
        try {
          zone = Intl.DateTimeFormat().resolvedOptions().timeZone || zone;
        } catch {}
        let res;
        try {
          res = await fetch(`${CONFIG.stats.endpoint}?days=${days}&tz=${encodeURIComponent(zone)}`, {
            headers: { 'x-github-token': token },
            cache: 'no-store',
            signal: timeoutSignal(30000),
          });
        } catch {
          throw new Error('Сервис статистики не отвечает — проверь интернет');
        }
        let data = null;
        try {
          data = await res.json();
        } catch {}
        if (!res.ok) throw new Error((data && data.error) || `Ошибка ${res.status}`);
        return data;
      },
      async deleteUpload(file) {
        if (file.used) throw new Error('Файл используется на сайте — сначала убери его оттуда и сохрани');
        await gh('DELETE', `${REPO}/contents/uploads/${encodeURIComponent(file.name)}`, { message: `Панель: удалён файл ${file.name}`, sha: file.sha, branch });
        if (file.thumb) {
          await gh('DELETE', `${REPO}/contents/uploads/thumbs/${encodeURIComponent(file.thumb.name)}`, { message: `Панель: удалена копия ${file.thumb.name}`, sha: file.thumb.sha, branch }).catch(() => {});
        }
      },
      async uploadThumb(url, blob) {
        const path = thumbPath(url);
        if (!path) return;
        const body = JSON.stringify({ message: `Панель: копия для сетки ${path.split('/').pop()}`, content: bytesToB64(new Uint8Array(await blob.arrayBuffer())), branch });
        await xhrSend('PUT', `https://api.github.com${REPO}/contents${path}`, { ...headers(), 'Content-Type': 'application/json' }, body);
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

  // VK отдаёт фото любой ширины из списка as по параметру cs — оригиналы там по 2–5 МБ
  function vkSized(src, px) {
    if (!/^https:\/\/[\w.-]+\.(vkuserphoto\.ru|userapi\.com)\//.test(src || '')) return src;
    try {
      const u = new URL(src);
      const widths = (u.searchParams.get('as') || '').split(',').map((s) => parseInt(s, 10)).filter(Boolean).sort((a, b) => a - b);
      if (!u.searchParams.get('cs') || !widths.length) return src;
      u.searchParams.set('cs', `${widths.find((w) => w >= px) || widths[widths.length - 1]}x0`);
      return u.href;
    } catch {
      return src;
    }
  }

  // Уменьшенная копия своей картинки: uploads/thumbs/<имя>.webp. Её делает панель при загрузке.
  const THUMB_RE = /^\/uploads\/(img-[\w-]+)\.(png|jpe?g|webp|avif)$/i;
  const thumbPath = (u) => {
    const m = THUMB_RE.exec(u || '');
    return m ? `/uploads/thumbs/${m[1]}.webp` : null;
  };

  // В панели тоже показываем лёгкие копии; если копии нет — оригинал
  function showThumb(img, src, onFail) {
    const full = view(src);
    const small = (B.uploadThumb && thumbPath(src) && view(thumbPath(src))) || vkSized(full, 360);
    let fellBack = small === full;
    img.onerror = () => {
      if (!fellBack) {
        fellBack = true;
        img.src = full;
        return;
      }
      if (onFail) onFail();
    };
    img.src = small;
  }

  // Картинку готовим прямо в браузере: огромный оригинал ужимаем в WebP до 2560 px,
  // а для сеток на сайте делаем копию на 1000 px. GIF не трогаем — там может быть анимация.
  const IMAGE_MAX = 2560;
  const THUMB_MAX = 1000;

  function openImage(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img.naturalWidth && img.naturalHeight ? img : null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  function toWebp(img, maxSide, quality) {
    let source = img;
    let w = img.naturalWidth;
    let hgt = img.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(w, hgt));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(hgt * scale));
    const canvas = (cw, ch) => Object.assign(document.createElement('canvas'), { width: cw, height: ch });
    // сильное уменьшение за один шаг даёт «лесенку», поэтому уменьшаем вдвое, пока не подойдём близко
    while (w / 2 >= tw * 1.4) {
      w = Math.round(w / 2);
      hgt = Math.round(hgt / 2);
      const step = canvas(w, hgt);
      const ctx = step.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, w, hgt);
      source = step;
    }
    const out = canvas(tw, th);
    const ctx = out.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, tw, th);
    return new Promise((resolve) => {
      try {
        out.toBlob((blob) => resolve(blob && blob.type === 'image/webp' ? blob : null), 'image/webp', quality);
      } catch {
        resolve(null);
      }
    });
  }

  async function prepareImage(file) {
    if (!/\.(png|jpe?g|webp|avif)$/i.test(file.name) && !/^image\/(png|jpeg|webp|avif)$/.test(file.type)) return { file, thumb: null };
    const img = await openImage(file);
    if (!img) return { file, thumb: null };
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    let main = file;
    if (file.size > 1.5 * 1024 * 1024 || long > IMAGE_MAX) {
      const blob = await toWebp(img, IMAGE_MAX, 0.9);
      if (blob && blob.size < file.size * 0.9) main = new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.webp`, { type: 'image/webp' });
    }
    const thumb = B.uploadThumb ? await toWebp(img, THUMB_MAX, 0.82) : null;
    return { file: main, thumb };
  }

  async function upload(file, kind, onProgress) {
    const limitMb = B.limits[kind];
    // PNG на 12 МБ после сжатия влезет в лимит, а вот совсем огромное даже не открываем
    if (kind !== 'image' && file.size > limitMb * 1024 * 1024) throw new Error(`файл больше ${limitMb} МБ`);
    if (file.size > 80 * 1024 * 1024) throw new Error('файл больше 80 МБ');
    S.uploads++;
    try {
      let thumb = null;
      if (kind === 'image') ({ file, thumb } = await prepareImage(file));
      // слишком большой файл сервер оборвёт, и браузер покажет лишь «ошибку сети» — проверяем заранее
      if (file.size > limitMb * 1024 * 1024) throw new Error(`файл больше ${limitMb} МБ`);
      const res = await B.upload(file, kind, onProgress);
      if (thumb) {
        try {
          await B.uploadThumb(res.url, thumb);
        } catch (err) {
          console.warn('Копия для сетки не загрузилась — сайт покажет оригинал', err);
        }
      }
      return res;
    } finally {
      S.uploads--;
    }
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

  // ---------------------------------------------------------------- перетаскивание
  // Своё, на pointer-событиях: встроенный drag-and-drop браузера не работает на телефонах.
  // Мышью элемент берётся, как только его потянули; пальцем — после удержания ~0,3 с,
  // чтобы обычная прокрутка страницы ничего не цепляла. За «ручку» (instant) — сразу.
  const NOT_DRAGGABLE = 'button, input, textarea, select, option, a, label, [contenteditable], .popover';
  const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function sortable(container, { items, handle, instant, layout = 'list', ghostOf, enabled, onSort }) {
    const kids = () => Array.from(container.children).filter((n) => n.matches(items) && !n.classList.contains('drag-ghost'));

    container.addEventListener('dragstart', (e) => {
      if (e.target.closest && e.target.closest(items)) e.preventDefault();
    });

    container.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.sortHandled || !e.isPrimary || (enabled && !enabled())) return;
      const item = e.target.closest(items);
      if (!item || item.parentElement !== container) return;
      const quick = instant && e.target.closest(instant);
      if (!quick && e.target.closest(NOT_DRAGGABLE)) return;
      if (handle && !e.target.closest(handle)) return;
      e.sortHandled = true;
      if (quick) e.preventDefault();

      const touch = e.pointerType !== 'mouse';
      const start = { x: e.clientX, y: e.clientY };
      const last = { x: e.clientX, y: e.clientY };
      let timer = 0;
      let drag = null;

      const onTouchMove = (ev) => {
        if (drag) ev.preventDefault();
      };
      const onContext = (ev) => ev.preventDefault();

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('touchmove', onTouchMove, { passive: false });
        container.removeEventListener('contextmenu', onContext);
        item.classList.remove('is-pressing');
      }

      function begin() {
        const from = kids().indexOf(item);
        if (from < 0) return cleanup();
        const source = (ghostOf && ghostOf(item)) || item;
        const rect = source.getBoundingClientRect();
        const ghost = source.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.removeAttribute('id');
        Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        document.body.append(ghost);
        item.classList.remove('is-pressing');
        item.classList.add('is-drag-source');
        document.body.classList.add('is-sorting');
        const sel = window.getSelection && window.getSelection();
        if (sel) sel.removeAllRanges();
        if (document.activeElement && item.contains(document.activeElement)) document.activeElement.blur();
        if (touch && navigator.vibrate) navigator.vibrate(12);
        drag = { from, ghost, rect, home: item.nextSibling, scroll: 0, frame: 0 };
        try {
          container.setPointerCapture(e.pointerId);
        } catch {}
        follow();
      }

      // где элемент стоит по разметке — без сдвигов от анимации, иначе соседи «убегают» из-под курсора
      function slot(n) {
        const base = container.getBoundingClientRect();
        const x = n.offsetParent === container ? base.left + container.clientLeft : base.left - container.offsetLeft;
        const y = n.offsetParent === container ? base.top + container.clientTop : base.top - container.offsetTop;
        return { left: x + n.offsetLeft, top: y + n.offsetTop, width: n.offsetWidth, height: n.offsetHeight };
      }

      function place() {
        const nodes = kids();
        let target = null;
        let after = false;
        for (const n of nodes) {
          const box = slot(n);
          const inX = last.x >= box.left && last.x <= box.left + box.width;
          const inY = last.y >= box.top && last.y <= box.top + box.height;
          if (layout === 'grid' ? inX && inY : inY) {
            target = n;
            after = layout === 'grid' ? last.x > box.left + box.width / 2 : last.y > box.top + box.height / 2;
            break;
          }
        }
        // в списке выше первого или ниже последнего — ставим в самое начало или конец
        if (!target && layout !== 'grid' && nodes.length) {
          const first = slot(nodes[0]);
          const end = slot(nodes[nodes.length - 1]);
          if (last.y < first.top) {
            target = nodes[0];
          } else if (last.y > end.top + end.height) {
            target = nodes[nodes.length - 1];
            after = true;
          }
        }
        if (!target || target === item) return;
        const ref = after ? target.nextSibling : target;
        if (ref === item || (ref ? ref.previousSibling : container.lastChild) === item) return;
        const before = new Map(nodes.map((n) => [n, n.getBoundingClientRect()]));
        container.insertBefore(item, ref);
        if (calmMotion.matches) return;
        nodes.forEach((n) => {
          const a = before.get(n);
          const b = n.getBoundingClientRect();
          const dx = a.left - b.left;
          const dy = a.top - b.top;
          if (Math.abs(dx) + Math.abs(dy) > 0.5) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 170, easing: 'cubic-bezier(.2,.8,.3,1)' });
        });
      }

      function follow() {
        if (!drag) return;
        drag.ghost.style.transform = `translate(${last.x - start.x}px, ${last.y - start.y}px) scale(1.03)`;
        place();
      }

      // у края экрана страница сама едет в сторону пальца
      function autoScroll() {
        const edge = Math.min(90, innerHeight * 0.15);
        const speed = last.y < edge ? -(edge - last.y) : last.y > innerHeight - edge ? last.y - (innerHeight - edge) : 0;
        if (!drag || !speed) {
          if (drag) drag.frame = 0;
          return;
        }
        window.scrollBy(0, Math.round(speed / 4));
        follow();
        drag.frame = requestAnimationFrame(autoScroll);
      }

      function onMove(ev) {
        if (ev.pointerId !== e.pointerId) return;
        last.x = ev.clientX;
        last.y = ev.clientY;
        const dist = Math.hypot(last.x - start.x, last.y - start.y);
        if (!drag) {
          if (!touch || quick) {
            if (dist > 5) begin();
          } else if (dist > 10) {
            cleanup(); // палец поехал раньше, чем взял — это прокрутка
          }
          return;
        }
        ev.preventDefault();
        follow();
        if (!drag.frame) drag.frame = requestAnimationFrame(autoScroll);
      }

      function finish(commit) {
        cleanup();
        if (!drag) return;
        const { ghost, from, home, frame, rect } = drag;
        cancelAnimationFrame(frame);
        drag = null;
        if (!commit) container.insertBefore(item, home && home.parentNode === container ? home : null);
        const to = kids().indexOf(item);
        const box = item.getBoundingClientRect();
        document.body.classList.remove('is-sorting');
        // клик, который браузер пришлёт после отпускания, не должен нажать кнопку под пальцем
        const swallow = (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        window.addEventListener('click', swallow, true);
        setTimeout(() => window.removeEventListener('click', swallow, true), 0);
        let landed = false;
        const land = () => {
          if (landed) return;
          landed = true;
          ghost.remove();
          item.classList.remove('is-drag-source');
          if (commit && to !== from) onSort(from, to);
        };
        if (calmMotion.matches) return land();
        // копия «прилетает» на новое место и только потом исчезает
        const landing = `translate(${box.left - rect.left}px, ${box.top - rect.top}px)`;
        ghost.animate([{ transform: ghost.style.transform }, { transform: landing }], { duration: 140, easing: 'ease-out' });
        ghost.style.transform = landing;
        setTimeout(land, 150);
      }

      const onUp = (ev) => ev.pointerId === e.pointerId && finish(true);
      const onCancel = (ev) => ev.pointerId === e.pointerId && finish(false);
      const onKey = (ev) => {
        if (ev.key !== 'Escape' || !drag) return;
        ev.preventDefault();
        ev.stopPropagation();
        finish(false);
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      if (touch && !quick) {
        container.addEventListener('contextmenu', onContext);
        item.classList.add('is-pressing');
        timer = setTimeout(begin, 280);
      }
    });
  }

  const head = (title, desc) => h('header', { class: 'page-head' }, h('h1', { text: title }), desc && h('p', { text: desc }));
  const card = (...kids) => h('section', { class: 'card' }, ...kids);
  const cardTitle = (text) => h('h3', { class: 'card__title', text });

  // Список с перетаскиванием, стрелками и удалением
  function listEditor(items, row, { empty, addLabel, make, max } = {}) {
    const rows = h('div', { class: 'rows' });

    function redraw() {
      rows.replaceChildren();
      if (!items.length && empty) rows.append(h('p', { class: 'rows__empty', text: empty }));
      items.forEach((item, i) => {
        rows.append(h('div', { class: 'row' },
          h('span', { class: 'grip', title: 'Потяни, чтобы поменять порядок' }, ui('grip')),
          h('div', { class: 'row__body' }, row(item, i, redraw)),
          h('div', { class: 'row__ctl' },
            iconBtn('up', 'Выше', i === 0, () => { move(items, i, i - 1); changed(); redraw(); }),
            iconBtn('down', 'Ниже', i === items.length - 1, () => { move(items, i, i + 1); changed(); redraw(); }),
            iconBtn('trash', 'Удалить', false, () => { items.splice(i, 1); changed(); redraw(); }, 'danger'))));
      });
    }

    sortable(rows, {
      items: '.row',
      instant: '.grip',
      onSort: (from, to) => {
        move(items, from, to);
        changed();
        redraw();
      },
    });
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
    let shown = null;
    const sync = () => {
      const has = !!obj[key];
      img.hidden = !has;
      empty.hidden = has;
      empty.textContent = 'нет картинки';
      if (has && shown !== obj[key]) {
        shown = obj[key];
        showThumb(img, obj[key], () => {
          img.hidden = true;
          empty.hidden = false;
          empty.textContent = 'не открылась';
        });
      }
      if (onChange) onChange();
    };
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
      // кнопка «открыть» получает адрес, только когда он настоящий: javascript: и прочее сюда не попадёт
      const openable = (v) => !!v && validUrl(v);
      const openLink = h('a', { class: 'icon-btn', href: openable(link.url) ? link.url : '#', target: '_blank', rel: 'noopener noreferrer', title: 'Открыть ссылку', 'aria-disabled': openable(link.url) ? null : 'true' }, ui('external'));
      const url = input(link, 'url', {
        url: true, mail: true, class: 'url', placeholder: link.type === 'email' ? 'почта@пример.ru' : 'https://…',
        onInput: (v) => {
          openLink.href = openable(v) ? v : '#';
          openLink.setAttribute('aria-disabled', openable(v) ? 'false' : 'true');
        },
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

  // та же кривая, что в плеере на сайте: ползунок по квадрату и слышимый минимум
  const volumeGain = (v) => (v <= 0 ? 0 : 0.05 + 0.95 * v * v);

  const MUSIC_BOX = { src: '/music/music-box.m4a', title: 'Музыкальная шкатулка', artist: '', startAt: 0, volume: 0.2 };

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
      audio.volume = volumeGain(m.volume);
      syncMeta();
      syncBox();
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

    // встроенный трек сайта — лежит в music/ и никуда не пропадает, даже если загрузить свой
    const boxNote = h('span', { class: 'field__hint' });
    const boxBtn = h('button', {
      class: 'btn btn--soft', type: 'button',
      onclick: () => {
        if (m.src === MUSIC_BOX.src) return toast('Шкатулка уже стоит');
        Object.assign(m, MUSIC_BOX);
        src.value = m.src;
        src.classList.remove('is-invalid');
        title.value = m.title;
        artist.value = m.artist;
        start.value = 0;
        vol.value = Math.round(m.volume * 100);
        syncVol();
        syncSrc();
        changed();
        toast('Музыкальная шкатулка снова стоит — не забудь сохранить');
      },
    }, ui('music'), 'Вернуть музыкальную шкатулку');
    const syncBox = () => {
      const isBox = m.src === MUSIC_BOX.src;
      boxBtn.disabled = isBox;
      boxNote.textContent = isBox
        ? 'Сейчас играет музыкальная шкатулка — встроенный трек сайта.'
        : 'Загруженный трек не удалится: он останется в разделе «Файлы».';
    };

    root.append(card(cardTitle('Трек'), now, zone,
      field('…или прямая ссылка на аудиофайл', src, 'Ссылка должна вести прямо на файл. Страницы YouTube, VK или Яндекс Музыки не подойдут.'),
      h('div', { class: 'grid2' }, field('Название', title), field('Исполнитель', artist)),
      h('div', { class: 'field' }, h('div', { class: 'inline' }, boxBtn), boxNote)));

    const volValue = h('output', { class: 'range-val' });
    const vol = h('input', { type: 'range', min: '0', max: '100', step: '1' });
    vol.value = Math.round(m.volume * 100);
    const syncVol = () => {
      volValue.textContent = `${vol.value}%`;
      vol.style.setProperty('--v', `${vol.value}%`);
    };
    vol.addEventListener('input', () => {
      m.volume = Number(vol.value) / 100;
      audio.volume = volumeGain(m.volume);
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
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Громкость при входе', volValue), vol,
        h('span', { class: 'field__hint', text: 'С неё музыка начинается у каждого, кто заходит на сайт, — лучше потише. Сделать громче можно в плеере на сайте.' })),
      h('div', { class: 'field' }, h('span', { class: 'field__label', text: 'Начинать с секунды' }), h('div', { class: 'inline' }, start, take, listen),
        h('span', { class: 'field__hint', text: 'Поставь трек на паузу в нужном месте и нажми «Взять из плеера».' })),
      toggle(m, 'loop', 'Повторять по кругу'),
      field('Текст на заставке', input(S.content.site, 'gateText', { max: 80, placeholder: 'нажми, чтобы войти' }))));

    syncSrc();
  }

  function renderProfile(root) {
    const p = S.content.profile;
    root.append(head('Профиль', 'Шапка сайта: имя или логотип, приветствие, аватарка и фон.'));
    root.append(card(
      h('div', { class: 'grid2' }, field('Имя', input(p, 'name', { max: 60 })), field('Подзаголовок', input(p, 'roles', { max: 120, placeholder: 'художник · дизайнер · аниматор' }))),
      field('Приветствие', input(p, 'greeting', { multiline: true, rows: 3, max: 600 })),
      field('Текст кнопки заказа', input(p, 'orderButton', { max: 60 }))));
    root.append(card(cardTitle('Картинки'),
      imageField('Логотип', p, 'logo', { shape: 'logo', hint: 'Показывается вместо имени в шапке и на заставке. Лучше PNG с прозрачным фоном. Пусто — имя пишется шрифтом.' }),
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

    sortable(grid, {
      items: '.gal__tile',
      layout: 'grid',
      onSort: (from, to) => {
        move(images, from, to);
        changed();
        draw();
      },
    });

    function draw() {
      grid.replaceChildren();
      images.forEach((src, i) => {
        const tile = h('div', { class: 'gal__tile', title: 'Зажми и перетащи, чтобы поменять место' });
        const img = h('img', { alt: `Работа ${i + 1}`, loading: 'lazy', draggable: 'false' });
        showThumb(img, src, () => tile.classList.add('is-broken'));
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

  // как пункт прайса считается в калькуляторе на сайте — то же угадывание, что в app.js
  const PRICE_KIND_NAMES = { base: 'размер, выбрать один', choice: 'на выбор, как фон', add: 'добавка', each: 'за каждого, счётчик', none: 'не считать' };
  function guessPriceKind(p) {
    const price = String(p.price || '');
    if (!/\d/.test(price)) return 'none';
    if (/%/.test(price)) return /персонаж|character|челов|ещё од|еще од/i.test(p.label) ? 'each' : 'add';
    if (/фон|background/i.test(p.label)) return 'choice';
    if (/^\s*\+/.test(price)) return 'add';
    return 'base';
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
          h('p', { class: 'field__hint', text: 'На сайте прайс работает как калькулятор: посетитель отмечает пункты и видит примерную сумму, а кнопка связи копирует текст заказа. «Как считать» обычно угадывается само по тексту.' }),
          listEditor(cat.prices, (p) => {
            const kind = h('select', { class: 'price-kind', title: 'Как считать в калькуляторе', 'aria-label': 'Как считать в калькуляторе' });
            const fill = () => {
              kind.replaceChildren(...[['', `авто: ${PRICE_KIND_NAMES[guessPriceKind(p)]}`], ...Object.entries(PRICE_KIND_NAMES)]
                .map(([value, text]) => h('option', { value, text })));
              kind.value = p.kind || '';
            };
            fill();
            kind.addEventListener('change', () => {
              if (kind.value) p.kind = kind.value;
              else delete p.kind;
              changed();
            });
            return h('div', { class: 'price-row' },
              input(p, 'label', { max: 60, placeholder: 'что именно', onInput: fill }),
              input(p, 'price', { max: 30, placeholder: '1000 ₽', onInput: fill }),
              kind);
          },
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
    // порядок меняем только в полном списке: в результатах поиска непонятно, куда встанет товар
    sortable(list, {
      items: '.merch-row',
      handle: '.merch-row__head',
      instant: '.grip',
      ghostOf: (node) => node.querySelector('.merch-row__head'),
      enabled: () => !search.value.trim(),
      onSort: (from, to) => {
        move(g.items, from, to);
        changed();
        draw();
      },
    });

    const badges = (it) => it.links.map((l) => marketBadge(l.market, !l.url));
    const describe = (it) => [it.category, it.subtitle].filter(Boolean).join(' · ') || 'без подписи';

    function row(it, canMove) {
      const i = g.items.indexOf(it);
      const isOpen = openId === it.id;
      const thumb = h('img', { class: 'merch-row__img', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', draggable: 'false' });
      const title = h('b', { text: it.title || 'без названия' });
      const sub = h('span', { text: describe(it) });
      const logos = h('span', { class: 'merch-row__mk' }, badges(it));
      let shownImage = null;
      const refreshHead = () => {
        title.textContent = it.title || 'без названия';
        sub.textContent = describe(it);
        logos.replaceChildren(...badges(it));
        if (it.image === shownImage) return;
        shownImage = it.image;
        if (it.image) showThumb(thumb, it.image);
        else thumb.removeAttribute('src');
      };
      refreshHead();
      const node = h('div', { class: `merch-row${isOpen ? ' is-open' : ''}` },
        h('div', { class: 'merch-row__head', title: canMove ? 'Зажми и перетащи, чтобы поменять место' : null },
          canMove && h('span', { class: 'grip' }, ui('grip')), thumb, h('div', { class: 'merch-row__meta' }, title, sub), logos,
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

  // ---------------------------------------------------------------- статистика

  const nf = new Intl.NumberFormat('ru-RU');
  const plural = (n, one, few, many) => {
    const a = n % 10;
    const b = n % 100;
    if (a === 1 && b !== 11) return one;
    return a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const peopleText = (n) => `${nf.format(n)} ${plural(n, 'человек', 'человека', 'человек')}`;
  const ZONE_NAMES = {
    'Europe/Moscow': 'Москва', 'Europe/Kaliningrad': 'Калининград', 'Europe/Samara': 'Самара', 'Europe/Volgograd': 'Волгоград',
    'Europe/Saratov': 'Саратов', 'Europe/Ulyanovsk': 'Ульяновск', 'Europe/Astrakhan': 'Астрахань', 'Europe/Kirov': 'Киров',
    'Asia/Yekaterinburg': 'Екатеринбург', 'Asia/Omsk': 'Омск', 'Asia/Novosibirsk': 'Новосибирск', 'Asia/Barnaul': 'Барнаул',
    'Asia/Tomsk': 'Томск', 'Asia/Novokuznetsk': 'Новокузнецк', 'Asia/Krasnoyarsk': 'Красноярск', 'Asia/Irkutsk': 'Иркутск',
    'Asia/Chita': 'Чита', 'Asia/Yakutsk': 'Якутск', 'Asia/Vladivostok': 'Владивосток', 'Asia/Sakhalin': 'Сахалин',
    'Asia/Magadan': 'Магадан', 'Asia/Kamchatka': 'Камчатка', 'Europe/Minsk': 'Минск', 'Europe/Kiev': 'Киев', 'Europe/Kyiv': 'Киев',
    'Asia/Almaty': 'Алматы', 'Asia/Tashkent': 'Ташкент', 'Asia/Bishkek': 'Бишкек', 'Asia/Tbilisi': 'Тбилиси', 'Asia/Yerevan': 'Ереван',
    'Asia/Baku': 'Баку', 'Europe/Riga': 'Рига', 'Europe/Vilnius': 'Вильнюс', 'Europe/Tallinn': 'Таллин', 'Europe/Berlin': 'Берлин',
    'Europe/Istanbul': 'Стамбул',
  };
  const zoneName = (z) => ZONE_NAMES[z] || (z === 'unknown' ? 'не определился' : z.split('/').pop().replace(/_/g, ' '));
  const DEVICE_NAMES = { mobile: 'Телефон', tablet: 'Планшет', desktop: 'Компьютер', unknown: 'Не определилось' };
  const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const shortDate = (day) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
  const longDate = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  const STATS_SERIES = [
    { key: 'visits', label: 'Заходы', color: '#2a78d6' },
    { key: 'clicks', label: 'Переходы по ссылкам', color: '#c8567c' },
  ];

  function statTile(label, value, note) {
    return h('div', { class: 'tile' },
      h('span', { class: 'tile__label', text: label }),
      h('b', { class: 'tile__value', text: nf.format(value) }),
      note && h('span', { class: 'tile__note', text: note }));
  }

  function targetIcon(type, target) {
    if (type === 'market') return marketBadge(target);
    const def = type === 'contact' ? { color: '#C8567C', stroke: true, path: UI_PATHS.brush } : ICONS[target] || ICONS.website;
    return h('i', { class: 'mkb', style: `--mk:${def.color};--mk-text:#fff` }, svgFrom(def));
  }

  // Горизонтальные полосы: одна серия — один цвет, значение у конца полосы
  function barList(rows, empty) {
    if (!rows.length) return h('p', { class: 'muted', text: empty });
    const max = Math.max(1, ...rows.map((r) => r.value));
    return h('div', { class: 'bars' }, rows.map((r) => {
      const fill = h('span', { class: 'bars__fill' });
      fill.style.width = `${Math.max(1.5, (r.value / max) * 100)}%`;
      return h('div', { class: 'bars__row' },
        h('div', { class: 'bars__head' }, r.icon || null, h('span', { class: 'bars__label', text: r.label }),
          h('b', { class: 'bars__value', text: nf.format(r.value) }), r.note && h('span', { class: 'bars__note', text: r.note })),
        h('div', { class: 'bars__track' }, fill));
    }));
  }

  // Линии «заходы» и «переходы» по дням: одна ось, перекрестие с подсказкой, таблица рядом
  function dailyChart(daily, days) {
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const today = new Date();
    const points = Array.from({ length: days }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
      const key = localDay(date);
      const row = byDay.get(key);
      return { day: key, visits: row ? row.visits : 0, clicks: row ? row.clicks : 0 };
    });
    const NS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs) => {
      const node = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
      return node;
    };
    const plot = h('div', { class: 'chart__plot', tabindex: '0', role: 'img', 'aria-label': 'График заходов и переходов по дням. Стрелки влево и вправо переключают день.' });
    const tip = h('div', { class: 'chart__tip', hidden: true });
    let geometry = null;
    let active = points.length - 1;

    function draw() {
      const W = Math.max(280, plot.clientWidth);
      const H = 230;
      const pad = { l: 40, r: 14, t: 14, b: 30 };
      let max = Math.max(2, ...points.flatMap((p) => [p.visits, p.clicks]));
      const e = 10 ** Math.floor(Math.log10(max));
      max = [1, 2, 5, 10].map((f) => f * e).find((v) => v >= max);
      if (max % 2) max *= 2;
      const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
      const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
      const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
      [0, max / 2, max].forEach((v) => {
        svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'chart__grid' }));
        const t = svgEl('text', { x: pad.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart__tick' });
        t.textContent = nf.format(v);
        svg.append(t);
      });
      [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].forEach((i) => {
        const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
        const t = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': anchor, class: 'chart__tick' });
        t.textContent = shortDate(points[i].day);
        svg.append(t);
      });
      STATS_SERIES.forEach((s) => {
        const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join('');
        svg.append(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      });
      const cross = svgEl('line', { y1: pad.t, y2: H - pad.b, class: 'chart__cross' });
      const dots = STATS_SERIES.map((s) => svgEl('circle', { r: 4, fill: s.color, stroke: '#fff', 'stroke-width': 2 }));
      svg.append(cross, ...dots);
      plot.replaceChildren(svg, tip);
      geometry = { W, x, y, cross, dots, pad };
      show(active, !tip.hidden);
    }

    function show(i, visible) {
      if (!geometry) return;
      active = Math.max(0, Math.min(points.length - 1, i));
      const p = points[active];
      const { W, x, y, cross, dots, pad } = geometry;
      cross.setAttribute('x1', x(active));
      cross.setAttribute('x2', x(active));
      dots.forEach((dot, k) => {
        dot.setAttribute('cx', x(active));
        dot.setAttribute('cy', y(p[STATS_SERIES[k].key]));
      });
      [cross, ...dots].forEach((n) => { n.style.visibility = visible ? 'visible' : 'hidden'; });
      tip.hidden = !visible;
      if (!visible) return;
      tip.replaceChildren(h('span', { class: 'chart__date', text: longDate(p.day) }),
        ...STATS_SERIES.map((s) => h('span', { class: 'chart__row' },
          h('b', { text: nf.format(p[s.key]) }), h('i', { class: 'legend__key', style: `--c:${s.color}` }), h('span', { text: s.label }))));
      const left = x(active) + 14 + 190 > W ? x(active) - 14 - 190 : x(active) + 14;
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${pad.t}px`;
    }

    plot.addEventListener('pointermove', (ev) => {
      if (!geometry) return;
      const rect = plot.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const span = (geometry.W - geometry.pad.l - geometry.pad.r) / Math.max(1, points.length - 1);
      show(Math.round((px - geometry.pad.l) / span), true);
    });
    plot.addEventListener('pointerleave', () => show(active, false));
    plot.addEventListener('focus', () => show(active, true));
    plot.addEventListener('blur', () => show(active, false));
    plot.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        show(active + (ev.key === 'ArrowRight' ? 1 : -1), true);
      }
    });
    if (window.ResizeObserver) new ResizeObserver(() => draw()).observe(plot);
    // не requestAnimationFrame: в фоновой вкладке он не срабатывает, и график оставался бы пустым
    setTimeout(draw, 0);

    const table = h('table', { class: 'stats-table' },
      h('thead', null, h('tr', null, h('th', { text: 'День' }), ...STATS_SERIES.map((s) => h('th', { text: s.label })))),
      h('tbody', null, points.slice().reverse().map((p) =>
        h('tr', null, h('td', { text: longDate(p.day) }), h('td', { text: nf.format(p.visits) }), h('td', { text: nf.format(p.clicks) })))));

    return h('div', { class: 'chart' },
      h('div', { class: 'legend' }, STATS_SERIES.map((s) => h('span', { class: 'legend__item' }, h('i', { class: 'legend__key', style: `--c:${s.color}` }), s.label))),
      plot,
      h('details', { class: 'chart__table' }, h('summary', { text: 'Таблица по дням' }), table));
  }

  function renderStats(root) {
    root.append(head('Статистика', 'Сколько людей заходит на сайт и куда они переходят: соцсети, кнопка заказа, маркеты с мерчем.'));
    if (!GH || !CONFIG.stats) {
      root.append(card(
        h('p', { class: 'card__desc' }, 'Статистика собирается только на опубликованном сайте, поэтому смотреть её нужно в панели на GitHub Pages: ',
          h('a', { href: 'https://lisi202016.github.io/panel/', target: '_blank', rel: 'noopener noreferrer', text: 'lisi202016.github.io/panel' }), '.')));
      return;
    }
    const days = S.statsDays || 30;
    const body = h('div', { class: 'stats' }, h('p', { class: 'muted', text: 'Считаю…' }));
    const reload = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => load() }, ui('refresh'), 'Обновить');
    root.append(
      h('div', { class: 'stats-bar' },
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Период' }, [7, 30, 90].map((d) =>
          h('button', { class: 'seg__btn', type: 'button', 'aria-pressed': String(d === days), onclick: () => { S.statsDays = d; renderSection(); } }, `${d} дней`))),
        reload),
      body,
      h('p', { class: 'field__hint stats-privacy', text: 'Имена и IP-адреса не собираются. «Гость» — это отдельный браузер со случайным номером; город определяется по часовому поясу устройства, поэтому он примерный.' }));

    async function load() {
      body.classList.add('is-loading');
      reload.disabled = true;
      let res;
      try {
        res = await B.stats(days);
      } catch (err) {
        if (!body.isConnected) return;
        body.classList.remove('is-loading');
        body.replaceChildren(h('p', { class: 'banner', text: err.message }));
        reload.disabled = false;
        return;
      }
      if (!body.isConnected) return;
      body.classList.remove('is-loading');
      reload.disabled = false;
      const st = res.stats;
      const t = st.totals;
      const share = t.visitors ? Math.round((t.clickers / t.visitors) * 100) : 0;
      const links = st.targets.map((r) => ({
        icon: targetIcon(r.type, r.target),
        label: r.type === 'contact' ? `Кнопка заказа · ${r.label || 'связаться'}` : r.label || (ICONS[r.target] ? ICONS[r.target].label : r.target),
        value: r.clicks,
        note: peopleText(r.people),
      }));
      const markets = st.markets.map((r) => ({ icon: targetIcon('market', r.target), label: (MARKETS[r.target] || MARKETS.other).label, value: r.clicks, note: peopleText(r.people) }));
      const products = st.products.map((r) => ({ label: r.label || 'товар', value: r.clicks, note: peopleText(r.people) }));
      const who = (rows, name) => rows.map((r) => ({ label: name(r.name), value: r.people }));

      body.replaceChildren(
        h('div', { class: 'tiles' },
          statTile('Заходы', t.visits, `за ${days} дней`),
          statTile('Гостей', t.visitors, 'разных браузеров'),
          statTile('Переходы по ссылкам', t.clicks, 'соцсети, заказ, мерч'),
          statTile('Кликнули хоть раз', t.clickers, t.visitors ? `${share}% гостей` : '—')),
        card(cardTitle('По дням'), dailyChart(st.daily, days)),
        h('div', { class: 'grid2 stats-grid' },
          card(cardTitle('Соцсети и кнопка заказа'), barList(links, 'Пока никто не переходил')),
          card(cardTitle('Мерч: какой маркет открывают'), barList(markets, 'Пока никто не открывал товары'))),
        card(cardTitle('Мерч: популярные товары'), barList(products, 'Пока пусто')),
        card(cardTitle('Кто заходит'),
          h('div', { class: 'who' },
            h('div', null, h('h4', { class: 'mini', text: 'Устройство' }), barList(who(st.devices, (n) => DEVICE_NAMES[n] || n), 'Нет данных')),
            h('div', null, h('h4', { class: 'mini', text: 'Откуда пришли' }), barList(who(st.referrers, (n) => (n === 'direct' ? 'Напрямую или из закладок' : n)), 'Нет данных')),
            h('div', null, h('h4', { class: 'mini', text: 'Город (по часовому поясу)' }), barList(who(st.zones, zoneName), 'Нет данных')))),
        card(cardTitle('Последние переходы'), st.recent.length
          ? h('div', { class: 'table-scroll' }, h('table', { class: 'stats-table' },
            h('thead', null, h('tr', null, ['Когда', 'Куда', 'Гость', 'Устройство', 'Город'].map((c) => h('th', { text: c })))),
            h('tbody', null, st.recent.map((r) => h('tr', null,
              h('td', { text: new Date(r.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }),
              h('td', null, h('span', { class: 'who-cell' }, targetIcon(r.type, r.target),
                h('span', { text: r.type === 'market' ? `${(MARKETS[r.target] || MARKETS.other).label} · ${r.label || ''}` : r.type === 'contact' ? 'Кнопка заказа' : r.label || r.target }))),
              h('td', { text: r.visitor ? `#${r.visitor}` : '—' }),
              h('td', { text: DEVICE_NAMES[r.device] || '—' }),
              h('td', { text: r.zone ? zoneName(r.zone) : '—' }))))))
          : h('p', { class: 'muted', text: 'Пока никто никуда не переходил.' })));
    }
    load();
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
    if (!files.length) return box.append(h('p', { class: 'muted', text: 'Пока ничего не загружено.' }));
    // файл, который вставлен, но ещё не сохранён, тоже «занят» — иначе его можно удалить из-под себя
    const draft = JSON.stringify(S.content);
    files.forEach((f) => {
      f.used = f.used || draft.includes(`"${f.url}"`);
    });
    box.append(h('div', { class: 'files' }, files.map((f) => {
      const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name);
      let preview = ui('music');
      if (isImage) {
        preview = h('img', { alt: '', loading: 'lazy' });
        if (f.thumb || !GH) showThumb(preview, f.url);
        else preview.src = view(f.url);
      }
      const row = h('div', { class: 'file' },
        h('a', { class: 'file__thumb', href: view(f.url), target: '_blank', rel: 'noopener', title: 'Открыть' }, preview),
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

  function findInvalidUrl(c) {
    const checks = [
      ['profile', 'аватарка', c.profile.avatar],
      ['profile', 'фон шапки', c.profile.cover],
      ['music', 'трек', c.music.src],
      ['orders', 'кнопка связи', c.commissions.contactUrl],
      ...c.links.map((l) => ['links', l.label || 'ссылка', l.url]),
      ...c.commissions.categories.flatMap((cat) => [
        ['orders', `прайс-лист «${cat.title}»`, cat.sheet],
        ...cat.images.map((src) => ['orders', `пример в «${cat.title}»`, src]),
      ]),
      ...c.merch.items.flatMap((it) => [
        ['merch', `картинка «${it.title || 'товар'}»`, it.image],
        ...it.links.map((l) => ['merch', `маркет у «${it.title || 'товар'}»`, l.url]),
      ]),
    ];
    const found = checks.find(([, , value]) => value && !validUrl(normalizeUrl(value, true)));
    return found ? { section: found[0], where: found[1] } : null;
  }

  function changed() {
    const bar = document.getElementById('savebar');
    if (bar) bar.hidden = !isDirty();
    if (S.onChange) S.onChange();
  }

  async function save() {
    if (S.saving || !isDirty()) return;
    if (S.uploads > 0) return toast('Дождись, пока загрузятся файлы', 'error');
    // проверяем все разделы, а не только открытый: иначе неверная ссылка из другого
    // раздела молча превратилась бы в пустую при сохранении
    const bad = findInvalidUrl(S.content);
    if (bad) {
      if (S.section !== bad.section) go(bad.section);
      const invalid = document.querySelector('.main .is-invalid');
      if (invalid) invalid.focus();
      return toast(`Проверь ссылку: ${bad.where}`, 'error');
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

  // пока панель стоит на заставке — пишем на ней, что происходит, вместо вечного «загрузка…»
  function bootStatus(text) {
    if (app.className === 'boot' && !app.querySelector('button')) app.textContent = text;
  }

  function bootFailed(message) {
    app.className = 'boot';
    app.replaceChildren(h('div', { class: 'auth' },
      h('p', { class: 'banner', text: message }),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => { app.textContent = 'загрузка…'; boot(); } }, 'Попробовать ещё раз')));
  }

  async function boot() {
    const slow = setTimeout(() => bootStatus(GH ? 'Подключаюсь к GitHub — сегодня он отвечает медленно…' : 'Сервер отвечает медленно…'), 4000);
    try {
      S.session = await B.session();
    } catch (err) {
      clearTimeout(slow);
      bootFailed(err.message);
      return;
    }
    if (S.session.authProblem || !S.session.setUp || !S.session.loggedIn) clearTimeout(slow);
    if (S.session.authProblem) {
      app.className = 'boot';
      app.replaceChildren(h('p', { class: 'banner', text: S.session.authProblem }));
      return;
    }
    if (!S.session.setUp) return renderAuth('setup');
    if (!S.session.loggedIn) return renderAuth('login');
    let data;
    try {
      data = await B.loadContent();
    } catch (err) {
      // без этого панель навсегда оставалась на «загрузка…»
      clearTimeout(slow);
      bootFailed(`Не получилось загрузить содержимое сайта: ${err.message}`);
      return;
    }
    clearTimeout(slow);
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
