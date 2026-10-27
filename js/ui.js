/* ============================================================
 * YouTube Ultra – UI-Bausteine
 * Karten, Zeilen, Skeletons, Toasts, Menüs, Modals, Popover,
 * Sidebar, Benachrichtigungen, Sprachsuche. Alle Buttons haben
 * echte Aktionen.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var esc = fmt.esc;

  /* ---------- Dauer-Badge ---------- */
  function durBadge(sec) {
    if (!sec || sec <= 0) return '';
    return '<span class="vcard__dur">' + esc(fmt.duration(sec)) + '</span>';
  }

  /* ---------- Thumbnail-HTML mit Lazy-Load ---------- */
  function thumbImg(v, cls) {
    var src = v.thumbnail || (v.id && v.id.indexOf('demo-') !== 0 ? fmt.thumb(v.id, 640) : '');
    if (!src || (v.id && v.id.indexOf('demo-') === 0)) {
      return '<div class="vcard__thumb--fallback" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>' +
        '</div>';
    }
    return '<img class="' + (cls || 'vcard__thumb') + '" loading="lazy" decoding="async" alt="" ' +
      'src="' + esc(src) + '" data-id="' + esc(v.id) + '" />';
  }

  /* ---------- Video-Karte (Grid) ---------- */
  function videoCard(v, opts) {
    opts = opts || {};
    if (!v) return '';
    var isDemo = v.id && v.id.indexOf('demo-') === 0;
    var badge = '';
    if (isDemo) badge = '<span class="vcard__badge vcard__badge--neutral">Beispieldaten</span>';
    else if (opts.badge) badge = '<span class="vcard__badge">' + esc(opts.badge) + '</span>';

    var stats = [];
    if (v.views) stats.push(fmt.views(v.views));
    var when = v.uploaded ? fmt.relTime(v.uploaded) : (v.uploadedLabel || '');
    if (when) stats.push(when);

    var avatar = v.channelAvatar
      ? '<img class="vcard__avatar" loading="lazy" alt="" src="' + esc(v.channelAvatar) + '" />'
      : '<span class="vcard__avatar vcard__avatar--ph" aria-hidden="true">' + esc(fmt.initial(v.channelName)) + '</span>';

    var progress = opts.progress != null && opts.progress > 0 && v.duration
      ? '<div class="vcard__progress" aria-hidden="true"><i style="width:' +
        Math.min(100, Math.round((opts.progress / v.duration) * 100)) + '%"></i></div>'
      : '';

    return '' +
      '<article class="vcard" tabindex="0" role="link" data-video="' + esc(v.id) + '" ' +
      'aria-label="' + esc(v.title) + '">' +
        '<div class="vcard__thumbwrap">' +
          thumbImg(v) +
          badge +
          durBadge(v.duration) +
          '<div class="vcard__play" aria-hidden="true"><span>' +
            '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>' +
          '</span></div>' +
          progress +
          '<button class="vcard__menu" type="button" data-menu="' + esc(v.id) + '" aria-label="Weitere Aktionen für ' + esc(v.title) + '">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="vcard__meta">' +
          avatar +
          '<div class="vcard__info">' +
            '<h3 class="vcard__title">' + esc(v.title) + '</h3>' +
            '<p class="vcard__channel">' +
              (v.channelId ? '<a href="#/channel/' + esc(v.channelId) + '" data-chan="' + esc(v.channelId) + '">' + esc(v.channelName) + '</a>'
                           : '<span>' + esc(v.channelName) + '</span>') +
              (v.verified ? ' <span class="verified" title="Verifiziert">✓</span>' : '') +
            '</p>' +
            (stats.length ? '<p class="vcard__stats">' + stats.map(esc).join(' · ') + '</p>' : '') +
            (v.reason ? '<p class="vcard__reason">' +
              '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8.5v.2"/></svg>' +
              esc(v.reason) + '</p>' : '') +
          '</div>' +
          '<button class="iconbtn" type="button" data-menu="' + esc(v.id) + '" aria-label="Menü öffnen" style="width:32px;height:32px;flex-shrink:0">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>' +
          '</button>' +
        '</div>' +
      '</article>';
  }

  /* ---------- Kompakte Zeile (Watch-Seite, Listen) ---------- */
  function miniRow(v, opts) {
    opts = opts || {};
    if (!v) return '';
    var src = v.thumbnail || fmt.thumb(v.id, 320);
    var isDemo = v.id && v.id.indexOf('demo-') === 0;
    var meta = [];
    if (v.channelName) meta.push(v.channelName);
    if (v.views) meta.push(fmt.views(v.views));
    else if (v.uploaded) meta.push(fmt.relTime(v.uploaded));
    else if (v.uploadedLabel) meta.push(v.uploadedLabel);
    return '' +
      '<article class="mini" tabindex="0" role="link" data-video="' + esc(v.id) + '" aria-label="' + esc(v.title) + '">' +
        '<div class="mini__thumb">' +
          (isDemo || !src
            ? '<div class="vcard__thumb--fallback" aria-hidden="true">▶</div>'
            : '<img loading="lazy" decoding="async" alt="" src="' + esc(src) + '" />') +
          durBadge(v.duration) +
        '</div>' +
        '<div>' +
          '<h4 class="mini__title">' + esc(v.title) + (isDemo ? ' <span class="vcard__badge vcard__badge--neutral">Beispiel</span>' : '') + '</h4>' +
          '<p class="mini__meta">' + meta.map(esc).join(' · ') + '</p>' +
          (opts.reason && v.reason ? '<p class="vcard__reason">' + esc(v.reason) + '</p>' : '') +
        '</div>' +
      '</article>';
  }

  /* ---------- Listenzeile (Verlauf, Später, Playlist) ---------- */
  function listRow(v, opts) {
    opts = opts || {};
    if (!v) return '';
    var vid = v.videoId || v.id;
    var isDemo = vid && vid.indexOf('demo-') === 0;
    var src = v.thumbnail || (!isDemo ? fmt.thumb(vid, 320) : '');
    var meta = [];
    if (v.channelName) meta.push(v.channelName);
    if (v.duration) meta.push(fmt.duration(v.duration));
    if (opts.showProgress && v.progress > 0 && v.duration) {
      meta.push(fmt.duration(v.progress) + ' von ' + fmt.duration(v.duration));
    }
    if (opts.showWatched && v.watchedAt) meta.push('Angesehen ' + fmt.relTime(v.watchedAt));
    if (opts.showAdded && v.addedAt) meta.push('Hinzugefügt ' + fmt.relTime(v.addedAt));

    var actions = opts.actions || '';
    var progress = (opts.showProgress && v.progress > 0 && v.duration)
      ? '<div class="vcard__progress" style="position:absolute;left:0;right:0;bottom:0;height:3px;background:#fff2"><i style="display:block;height:100%;background:var(--accent);width:' +
        Math.min(100, Math.round((v.progress / v.duration) * 100)) + '%"></i></div>'
      : '';

    return '' +
      '<div class="vrow" tabindex="0" role="link" data-video="' + esc(vid) + '" data-row-video="' + esc(vid) + '">' +
        '<div class="vrow__thumbwrap">' +
          (src ? '<img loading="lazy" alt="" src="' + esc(src) + '" />'
               : '<div class="vcard__thumb--fallback" aria-hidden="true">▶</div>') +
          (v.duration ? durBadge(v.duration) : '') + progress +
        '</div>' +
        '<div style="min-width:0">' +
          '<h3 class="vrow__title">' + esc(v.title) + (isDemo ? ' <span class="vcard__badge vcard__badge--neutral">Beispiel</span>' : '') + '</h3>' +
          '<p class="vrow__meta">' + meta.map(esc).join(' · ') +
            (opts.dateLabel ? ' <span class="vrow__date">· ' + esc(opts.dateLabel) + '</span>' : '') +
          '</p>' +
        '</div>' +
        '<div class="vrow__actions">' + actions + '</div>' +
      '</div>';
  }

  /* ---------- Skeletons ---------- */
  function skeletonGrid(n) {
    var out = '';
    for (var i = 0; i < (n || 10); i++) {
      out += '<div class="skel-card">' +
        '<div class="skeleton skeleton--thumb"></div>' +
        '<div style="display:flex;gap:11px"><div class="skeleton skeleton--circle"></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;gap:8px">' +
        '<div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line w70"></div>' +
        '<div class="skeleton skeleton--line w45"></div></div></div></div>';
    }
    return '<div class="vgrid">' + out + '</div>';
  }

  function skeletonRows(n) {
    var out = '';
    for (var i = 0; i < (n || 6); i++) {
      out += '<div class="skel-row"><div class="skeleton skeleton--thumb"></div>' +
        '<div style="display:flex;flex-direction:column;gap:9px;justify-content:center">' +
        '<div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line w45"></div></div></div>';
    }
    return '<div class="rowlist">' + out + '</div>';
  }

  function loadingBlock(label) {
    return '<div class="loading-block"><div class="spinner" role="status" aria-label="' + esc(label || 'Lädt') + '"></div>' +
      '<span>' + esc(label || 'Wird geladen…') + '</span></div>';
  }

  /* ---------- Leerzustand ---------- */
  function emptyState(icon, title, text, actionHtml) {
    return '<div class="empty">' +
      '<div class="empty__icon">' + icon + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(text) + '</p>' +
      (actionHtml || '') + '</div>';
  }

  var ICONS = {
    history: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="16" cy="19" r="2.2"/><path d="M17.5 12.5v6.2"/></svg>',
    subs: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6.5h16M6 10.5h12"/><rect x="3" y="14" width="7" height="6" rx="2"/><rect x="14" y="14" width="7" height="6" rx="2"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4M12 16.5v.2"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9a13 13 0 0 1 16 0M7 12.5a8.5 8.5 0 0 1 10 0M10 16a4 4 0 0 1 4 0M12 19.5v.2"/></svg>'
  };

  /* ---------- Toast ---------- */
  function toast(message, type, ms) {
    var layer = document.getElementById('toast-layer');
    if (!layer) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    el.textContent = message;
    layer.appendChild(el);
    var t = setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 220);
    }, ms || 3200);
    el.addEventListener('click', function () { clearTimeout(t); el.remove(); });
    // Maximal 4 gleichzeitig
    while (layer.children.length > 4) layer.firstChild.remove();
  }

  /* ---------- Kontextmenü ---------- */
  var menuCloser = null;

  function closeMenu() {
    var layer = document.getElementById('menu-layer');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    if (menuCloser) { document.removeEventListener('mousedown', menuCloser, true); menuCloser = null; }
  }

  /**
   * @param {{x:number,y:number, title?:string, sub?:string, items:Array<{label:string, icon?:string, danger?:boolean, onClick:Function}>}} opts
   */
  function openMenu(opts) {
    closeMenu();
    var layer = document.getElementById('menu-layer');
    if (!layer) return;
    var html = '<div class="menu" role="menu">';
    if (opts.title) {
      html += '<div class="menu__head"><b>' + esc(opts.title) + '</b>' +
        (opts.sub ? '<span>' + esc(opts.sub) + '</span>' : '') + '</div>';
    }
    opts.items.forEach(function (it, i) {
      if (it.sep) { html += '<div class="menu__sep"></div>'; return; }
      html += '<button class="menu__item' + (it.danger ? ' menu__item--danger' : '') + '" type="button" role="menuitem" data-i="' + i + '">' +
        (it.icon || '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/></svg>') +
        '<span>' + esc(it.label) + '</span></button>';
    });
    html += '</div>';
    layer.innerHTML = html;
    layer.hidden = false;

    var menu = layer.querySelector('.menu');
    // Position (innerhalb des Viewports)
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var x = Math.min(opts.x, window.innerWidth - mw - 10);
    var y = Math.min(opts.y, window.innerHeight - mh - 10);
    menu.style.left = Math.max(8, x) + 'px';
    menu.style.top = Math.max(8, y) + 'px';

    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-i]');
      if (!btn) return;
      var item = opts.items[+btn.dataset.i];
      closeMenu();
      if (item && item.onClick) item.onClick();
    });

    // Schließen bei Klick außerhalb / Escape
    setTimeout(function () {
      menuCloser = function (e) {
        if (!menu.contains(e.target)) closeMenu();
      };
      document.addEventListener('mousedown', menuCloser, true);
    }, 0);
  }

  function onEscCloseMenu(e) { if (e.key === 'Escape') closeMenu(); }
  document.addEventListener('keydown', onEscCloseMenu);

  /* ---------- Modal ---------- */
  var modalCloser = null;

  function closeModal() {
    var layer = document.getElementById('modal-layer');
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
    if (modalCloser) { document.removeEventListener('mousedown', modalCloser, true); modalCloser = null; }
    document.removeEventListener('keydown', modalEsc);
  }

  function modalEsc(e) { if (e.key === 'Escape') closeModal(); }

  /**
   * @param {{title:string, desc?:string, body?:string, confirmLabel?:string, cancelLabel?:string, danger?:boolean, onMount?:Function, onConfirm?:Function}} opts
   * @returns {Promise<string|null>} Wert (z. B. Eingabe) oder null bei Abbruch
   */
  function openModal(opts) {
    return new Promise(function (resolve) {
      var layer = document.getElementById('modal-layer');
      if (!layer) { resolve(null); return; }
      var inputId = 'mfi-' + Date.now().toString(36);
      layer.innerHTML = '' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
          '<h3>' + esc(opts.title) + '</h3>' +
          (opts.desc ? '<p class="modal__desc">' + esc(opts.desc) + '</p>' : '') +
          (opts.body || '') +
          (opts.input !== false
            ? '<input id="' + inputId + '" class="field" type="text" maxlength="120" ' +
              'value="' + esc(opts.value || '') + '" placeholder="' + esc(opts.placeholder || '') + '" />'
            : '') +
          '<div class="modal__actions">' +
            '<button type="button" class="btn btn--ghost" data-act="cancel">' + esc(opts.cancelLabel || 'Abbrechen') + '</button>' +
            '<button type="button" class="btn' + (opts.danger ? ' btn--danger' : '') + '" data-act="ok">' + esc(opts.confirmLabel || 'OK') + '</button>' +
          '</div>' +
        '</div>';
      layer.hidden = false;

      var modal = layer.querySelector('.modal');
      var input = layer.querySelector('#' + inputId);
      var done = false;

      function finish(val) {
        if (done) return;
        done = true;
        closeModal();
        resolve(val);
      }

      layer.querySelector('[data-act="cancel"]').addEventListener('click', function () { finish(null); });
      layer.querySelector('[data-act="ok"]').addEventListener('click', function () {
        finish(input ? input.value.trim() : true);
      });
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') finish(input.value.trim());
        });
        setTimeout(function () { input.focus(); input.select(); }, 30);
      }
      modalCloser = function (e) { if (!modal.contains(e.target)) finish(null); };
      setTimeout(function () {
        document.addEventListener('mousedown', modalCloser, true);
      }, 0);
      document.addEventListener('keydown', modalEsc);

      if (opts.onMount) opts.onMount(modal, finish);
    });
  }

  function confirmModal(title, desc, confirmLabel) {
    return openModal({
      title: title, desc: desc, input: false,
      confirmLabel: confirmLabel || 'Bestätigen', danger: true
    }).then(function (v) { return v !== null; });
  }

  /* ---------- Video-Menü (3-Punkte) mit echten Aktionen ---------- */
  function videoMenu(video, x, y) {
    var items = [];
    items.push({
      label: 'Jetzt ansehen',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
      onClick: function () { YU.router.navigate('watch/' + video.id); }
    });
    items.push({
      label: 'Später ansehen',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 1.5"/></svg>',
      onClick: function () {
        YU.store.addLater(video).then(function () {
          toast('Zu „Später ansehen“ hinzugefügt', 'ok');
        }).catch(function () { toast('Konnte nicht gespeichert werden', 'err'); });
      }
    });
    items.push({
      label: 'Zu Playlist hinzufügen',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h11M4 12h11M4 17h7"/><path d="M17.5 12.5v6.2"/><circle cx="16" cy="19" r="2.2"/></svg>',
      onClick: function () { addToPlaylistFlow(video); }
    });
    items.push({
      label: 'Gefällt mir',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg>',
      onClick: function () {
        YU.reco.trackLike(video).then(function () { toast('Gefällt mir gespeichert', 'ok'); });
      }
    });
    if (video.channelId) {
      items.push({
        label: 'Kanal abonnieren',
        icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6.5h16M6 10.5h12"/><rect x="3" y="14" width="7" height="6" rx="2"/><rect x="14" y="14" width="7" height="6" rx="2"/></svg>',
        onClick: function () {
          YU.reco.trackSubscribe({ id: video.channelId, name: video.channelName }).then(function () {
            toast('Kanal abonniert', 'ok');
          });
        }
      });
      items.push({
        label: 'Kanal anzeigen',
        icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>',
        onClick: function () { YU.router.navigate('channel/' + video.channelId); }
      });
    }
    items.push({ sep: true });
    items.push({
      label: 'Nicht interessiert',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M9 15c1.8-1.8 4.2-1.8 6 0M9.5 9.5v.2M14.5 9.5v.2"/></svg>',
      onClick: function () {
        YU.reco.hideVideo(video).then(function () {
          toast('Wird dir weniger empfohlen');
          var card = document.querySelector('[data-video="' + cssEsc(video.id) + '"]');
          if (card && card.classList.contains('vcard')) {
            card.style.transition = 'opacity .25s, transform .25s';
            card.style.opacity = '0';
            card.style.transform = 'scale(.96)';
            setTimeout(function () { card.remove(); }, 260);
          } else if (YU.router.current().indexOf('home') === 0) {
            YU.router.refresh();
          }
        });
      }
    });
    if (video.channelId) {
      items.push({
        label: 'Kanal nicht empfehlen',
        icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4l16 16"/><circle cx="12" cy="12" r="8.5"/></svg>',
        onClick: function () {
          YU.reco.hideChannel(video.channelId, video.channelName).then(function () {
            toast('Kanal wird nicht mehr empfohlen');
            YU.router.refresh();
          });
        }
      });
    }
    items.push({
      label: 'In neuem Tab öffnen',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13.5V19H5V6h5.5"/></svg>',
      onClick: function () {
        if (video.id.indexOf('demo-') === 0) { toast('Beispieldaten sind nicht verlinkbar', 'err'); return; }
        window.open('https://www.youtube.com/watch?v=' + video.id, '_blank', 'noopener');
      }
    });
    items.push({
      label: 'Auf YouTube öffnen',
      icon: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10.5 9.7v4.6l4-2.3z" fill="currentColor" stroke="none"/></svg>',
      onClick: function () {
        if (video.id.indexOf('demo-') === 0) { toast('Beispieldaten sind nicht verlinkbar', 'err'); return; }
        window.open('https://www.youtube.com/watch?v=' + video.id, '_blank', 'noopener');
      }
    });

    openMenu({ x: x, y: y, title: video.title, sub: video.channelName, items: items });
  }

  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /* ---------- „Zu Playlist“-Flow ---------- */
  function addToPlaylistFlow(video) {
    YU.store.listPlaylists().then(function (pls) {
      var body = '';
      if (pls.length) {
        body = '<div class="rowlist" style="margin-top:6px;max-height:280px;overflow:auto">' +
          pls.map(function (p) {
            return '<button class="menu__item" type="button" data-pl="' + esc(p.id) + '" style="width:100%">' +
              '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="16" cy="19" r="2.2"/></svg>' +
              '<span>' + esc(p.name) + '</span></button>';
          }).join('') + '</div>';
      } else {
        body = '<p class="modal__desc">Du hast noch keine Playlists. Lege eine an:</p>';
      }
      body += '<input class="field" id="newpl-name" type="text" placeholder="Name der neuen Playlist" maxlength="80" style="margin-top:12px" />';

      openModal({
        title: 'Zu Playlist hinzufügen',
        desc: 'Video: ' + video.title,
        body: body,
        input: false,
        confirmLabel: 'Neue Playlist',
        cancelLabel: 'Schließen',
        onMount: function (modal, finish) {
          modal.querySelectorAll('[data-pl]').forEach(function (btn) {
            btn.addEventListener('click', function () {
              var plId = btn.dataset.pl;
              finish(null);
              YU.store.addToPlaylist(plId, video).then(function (r) {
                if (r.duplicate) toast('Video ist bereits in der Playlist');
                else toast('Zur Playlist hinzugefügt', 'ok');
              }).catch(function () { toast('Speichern fehlgeschlagen', 'err'); });
            });
          });
        }
      }).then(function (val) {
        if (val === true) {
          // Confirm-Button = „Neue Playlist“ anlegen
          var nameInput = document.getElementById('newpl-name');
          var name = nameInput ? nameInput.value.trim() : '';
          if (!name) { toast('Bitte einen Namen eingeben', 'err'); return; }
          YU.store.createPlaylist(name).then(function (pl) {
            return YU.store.addToPlaylist(pl.id, video);
          }).then(function () {
            toast('Playlist erstellt und Video hinzugefügt', 'ok');
          }).catch(function () { toast('Speichern fehlgeschlagen', 'err'); });
        }
      });
    }).catch(function () {
      toast('Playlists nicht verfügbar', 'err');
    });
  }

  /* ---------- Popover generisch ---------- */
  function togglePopover(btn, panelId, builder) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var open = !panel.hidden;
    document.querySelectorAll('.popover').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('[aria-expanded]').forEach(function (b) {
      if (b.id === 'btn-notifications' || b.id === 'btn-profile') b.setAttribute('aria-expanded', 'false');
    });
    if (open) return;
    builder(panel);
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }

  function closePopovers() {
    document.querySelectorAll('.popover').forEach(function (p) { p.hidden = true; });
    ['btn-notifications', 'btn-profile'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  document.addEventListener('mousedown', function (e) {
    if (!e.target.closest('.popover-anchor')) closePopovers();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closePopovers(); closeMenu(); }
  });

  /* ---------- Thumbnail-Einblendung ----------
     .vcard__thumb startet mit opacity:0 und bekommt per load-Event
     die Klasse .is-loaded (opacity:1). load bubblet nicht, deshalb
     fangen wir es in der Capture-Phase auf Dokument-Ebene ab. */
  function markLoaded(img) {
    if (!img || img.tagName !== 'IMG' || !img.classList.contains('vcard__thumb')) return;
    img.classList.add('is-loaded');
  }
  document.addEventListener('load', function (e) {
    markLoaded(e.target);   // load-Event = Bild ist da
  }, true);

  // Falls Bilder schon geladen sind, bevor die Delegation lief
  function sweepCompleteThumbs(root) {
    (root || document).querySelectorAll('img.vcard__thumb').forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) markLoaded(img);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { sweepCompleteThumbs(document); });
  } else {
    sweepCompleteThumbs(document);
  }
  // Beim Rendern neuer Seiten ebenfalls nachziehen
  var domObserver = null;
  function observeThumbs() {
    if (!window.MutationObserver) return;
    if (domObserver) return;
    domObserver = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes && Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'IMG') { if (n.complete && n.naturalWidth > 0) markLoaded(n); }
          else sweepCompleteThumbs(n);
        });
      });
    });
    domObserver.observe(document.getElementById('view-content') || document.body,
      { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeThumbs);
  } else { observeThumbs(); }

  /* ---------- Bild-Fallback (aufgelöste Thumbnails/Avatare) ---------- */
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;

    function replaceWith(node) {
      if (img.parentNode) img.replaceWith(node);
    }
    function letterFallback() {
      var span = document.createElement('span');
      var cls = img.className || '';
      span.className = cls + (cls ? ' ' : '') + 'img-fallback';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = '?';
      var owner = img.closest('.vcard__meta, .watch__channel, .sc-channel, .entity-card, .short-card__info');
      var name = '';
      if (owner) {
        var nameEl = owner.querySelector('.vcard__channel, .w-name, h3, .mini__meta');
        name = nameEl ? nameEl.textContent.trim() : '';
      }
      span.textContent = fmt.initial(name || '?');
      span.style.cssText += ';display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--dim)';
      replaceWith(span);
    }
    function thumbFallback() {
      var ph = document.createElement('div');
      ph.className = 'vcard__thumb--fallback';
      ph.setAttribute('aria-hidden', 'true');
      ph.textContent = '▶';
      replaceWith(ph);
    }

    var isAvatar = /vcard__avatar|c-avatar|sc-channel|watch__channel|entity-card/.test(
      (img.className || '') + ' ' + ((img.parentNode && img.parentNode.className) || ''));

    if (img.dataset.fallbackDone) {
      if (isAvatar) letterFallback(); else thumbFallback();
      return;
    }
    img.dataset.fallbackDone = '1';
    var id = img.dataset.id;
    if (id && id.indexOf('demo-') !== 0) {
      img.src = fmt.thumb(id, 320); // kleineres Thumbnail als zweiter Versuch
    } else if (isAvatar) {
      letterFallback();
    } else {
      thumbFallback();
    }
  }, true);

  YU.ui = {
    videoCard: videoCard,
    miniRow: miniRow,
    listRow: listRow,
    skeletonGrid: skeletonGrid,
    skeletonRows: skeletonRows,
    loadingBlock: loadingBlock,
    emptyState: emptyState,
    icons: ICONS,
    toast: toast,
    openMenu: openMenu,
    closeMenu: closeMenu,
    openModal: openModal,
    closeModal: closeModal,
    confirmModal: confirmModal,
    videoMenu: videoMenu,
    addToPlaylistFlow: addToPlaylistFlow,
    togglePopover: togglePopover,
    closePopovers: closePopovers,
    thumbImg: thumbImg,
    durBadge: durBadge
  };
})(window.YU = window.YU || {});
