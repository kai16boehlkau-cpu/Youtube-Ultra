/* ============================================================
 * YouTube Ultra – Shorts (Vollbild-Feed wie Instagram/TikTok)
 * • Ein Video pro Bildschirm, vertikales Snap-Scrolling.
 * • Auto-Play (stumm, wie Reels/TikTok) – Ton per Tap möglich.
 * • Tippen = Play/Pause, rechte Leiste = Like/Später/YouTube.
 * • Fortschrittsbalken unten; Nachbarn werden vorgeladen,
 *   entfernte Player werden freigegeben.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }

  var overlay = null;
  var feedEl = null;
  var observer = null;
  var progressTimer = null;
  var players = {};      // id -> YT.Player
  var mounted = {};      // id -> card element
  var byId = {};
  var order = [];        // Video-Objekte in Anzeige-Reihenfolge
  var activeIdx = 0;
  var muted = loadMutePref(); // Ton-Einstellung merken (erster Start stumm, Browser-Regel)
  var preloadTimers = {}; // gestaffeltes Vorab-Mounten

  var PRELOAD_AHEAD = 7;  // wie viele nächste Videos vorab gemountet werden
  var KEEP_BEHIND = 2;    // wie viele zurückliegende gemountet bleiben

  var SHORTS_QUERIES = ['shorts deutsch', 'short funny deutsch', 'kurz video lustig', 'shorts minecraft', 'shorts musik'];

  // Ton-Präferenz (damit man NUR einmal entstummen muss)
  function loadMutePref() {
    try { var v = localStorage.getItem('yu.shorts.muted'); return v === null ? true : v === '1'; }
    catch (e) { return true; }
  }
  function saveMutePref() { try { localStorage.setItem('yu.shorts.muted', muted ? '1' : '0'); } catch (e) {} }

  /* ---------- Render ---------- */
  function render(container) {
    // Vollbild-Overlay – kein page-enter (transform würde position:fixed stören)
    container.innerHTML =
      '<div class="shorts-overlay">' +
        '<div class="sc-header">' +
          '<button class="sc-iconbtn" type="button" data-back aria-label="Zurück">' +
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' +
          '</button>' +
          '<h1>Shorts</h1>' +
          '<span class="sc-spacer"></span>' +
          '<button class="sc-iconbtn" type="button" data-mute aria-label="Ton an/aus"></button>' +
        '</div>' +
        '<div id="shorts-body" style="height:100%"><div class="shorts-msg">Shorts werden geladen…</div></div>' +
      '</div>';

    overlay = container.querySelector('.shorts-overlay');
    updateMuteBtn();

    overlay.querySelector('[data-back]').addEventListener('click', function () {
      if (window.history.length > 1) window.history.back();
      else YU.router.navigate('home');
    });
    overlay.querySelector('[data-mute]').addEventListener('click', function () {
      muted = !muted;
      saveMutePref();
      // Allen (auch vorab geladenen) Playern sofort anwenden → nächste Videos haben Ton
      Object.keys(players).forEach(function (id) {
        try { if (muted) players[id].mute(); else players[id].unMute(); } catch (e) {}
      });
      updateMuteBtn();
    });

    load(container);
  }

  function updateMuteBtn() {
    if (!overlay) return;
    var b = overlay.querySelector('[data-mute]');
    if (!b) return;
    b.innerHTML = muted
      ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4M19 6.2a8 8 0 0 1 0 11.6"/></svg>';
  }

  /* ---------- Daten laden ---------- */
  function load(container) {
    var body = container.querySelector('#shorts-body');
    var TARGET = 12;
    function isShort(v) { return v && v.duration > 0 && v.duration <= 90; }

    var queries = [
      SHORTS_QUERIES[Math.floor(Math.random() * SHORTS_QUERIES.length)],
      'shorts ' + ['funny', 'gaming', 'musik', 'doku', 'minecraft'][Math.floor(Math.random() * 5)],
      'kurzvideo lustig deutsch',
      'short film deutsch'
    ];

    Promise.all(queries.map(function (q) {
      return YU.api.search(q, { maxResults: 20 }).catch(function () { return null; });
    })).then(function (results) {
      var all = [];
      results.forEach(function (r) { if (r && r.videos) all = all.concat(r.videos); });
      all = YU.fmt.uniq(all, function (v) { return v.id; });
      var shorts = all.filter(isShort);
      if (shorts.length < TARGET) {
        var extra = all.filter(function (v) { return v.duration > 90 && v.duration <= 180 && !isShort(v); });
        shorts = YU.fmt.uniq(shorts.concat(extra), function (v) { return v.id; });
      }
      if (!shorts.length) throw new Error('leer');
      return shorts.slice(0, 16);
    })
      .then(function (shorts) { paint(body, shorts); })
      .catch(function (err) {
        if (err && err.demo) {
          body.innerHTML = '<div class="shorts-msg">' + ui.icons.warn +
            '<p><b>Beispieldaten-Modus.</b> Keine echten Shorts verfügbar.</p></div>';
          return;
        }
        body.innerHTML = '<div class="shorts-msg">' + ui.icons.wifi +
          '<p>Keine Shorts verfügbar.</p>' +
          '<button class="btn" type="button" onclick="YU.router.refresh()">Erneut laden</button></div>';
      });
  }

  /* ---------- Feed malen ---------- */
  function paint(body, shorts) {
    order = shorts;
    byId = {};
    shorts.forEach(function (v) { byId[v.id] = v; });

    var html = '<div class="shorts-feed" id="shorts-feed">';
    shorts.forEach(function (v, i) {
      html += '<div class="short-card" data-short="' + esc(v.id) + '" data-idx="' + i + '">' +
        '<div class="sc-player" data-player></div>' +
        '<div class="sc-tap" data-tap></div>' +
        '<div class="sc-bigplay" data-bigplay><span>' +
          '<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>' +
        '</span></div>' +
        '<div class="sc-rail">' +
          railBtn('like', v.id, 'Gefällt mir', '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg>') +
          railBtn('later', v.id, 'Später', '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 1.5"/></svg>') +
          railBtn('open', v.id, 'YouTube', '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13.5V19H5V6h5.5"/></svg>') +
        '</div>' +
        '<div class="sc-bottom">' +
          '<div class="sc-channel">' +
            (v.channelAvatar ? '<img alt="" src="' + esc(v.channelAvatar) + '" />' : '') +
            '<b>' + esc(v.channelName || '') + '</b>' +
          '</div>' +
          '<div class="sc-title">' + esc(v.title || '') + '</div>' +
          (v.views ? '<div class="sc-meta">' + esc(fmt.views(v.views)) + ' Aufrufe</div>' : '') +
        '</div>' +
        '<div class="sc-progress"><i data-progress></i></div>' +
      '</div>';
    });
    html += '</div>';
    body.innerHTML = html;

    feedEl = body.querySelector('#shorts-feed');

    // Tap → Play/Pause (Stopp, damit es nicht durchschlägt)
    body.querySelectorAll('[data-tap]').forEach(function (tap) {
      tap.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePlay(parseInt(tap.closest('.short-card').dataset.idx, 10));
      });
    });
    // Rail-Aktionen
    body.querySelectorAll('[data-like]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); like(b); });
    });
    body.querySelectorAll('[data-later]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); later(b); });
    });
    body.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        window.open('https://www.youtube.com/watch?v=' + b.dataset.open, '_blank', 'noopener');
      });
    });

    setupObserver(body);
    setActive(0); // ersten Short sofort starten
  }

  function railBtn(action, id, label, icon) {
    return '<button class="rail-btn" type="button" data-' + action + '="' + esc(id) + '" aria-label="' + esc(label) + '">' +
      '<span class="rb-ico">' + icon + '</span>' + esc(label) + '</button>';
  }

  /* ---------- Sichtbarkeit → aktiven Short wählen ---------- */
  function setupObserver(body) {
    if (!('IntersectionObserver' in window)) { setActive(0); return; }
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.55) {
          setActive(parseInt(en.target.dataset.idx, 10));
        }
      });
    }, { root: feedEl, threshold: [0.55, 0.8] });
    body.querySelectorAll('.short-card').forEach(function (c) { observer.observe(c); });
  }

  function setActive(idx) {
    if (idx == null || idx < 0 || idx >= order.length) return;
    var prev = order[activeIdx];
    if (idx === activeIdx && prev && players[prev.id]) { play(idx); return; }
    activeIdx = idx;

    order.forEach(function (v, i) {
      var ahead = i - idx;   // >0 = bevorstehend
      var behind = idx - i;  // >0 = bereits gesehen
      if (i === idx) {
        // aktiv → mounten (Auto-Play stumm) und starten
        ensurePlayer(v, true).then(function () { play(idx); });
      } else if (ahead > 0 && ahead <= PRELOAD_AHEAD) {
        // nächste Videos vorab mounten (nicht starten) → kein Ruckeln/Ladebildschirm
        schedulePreload(v, ahead);
      } else if (behind > 0 && behind <= KEEP_BEHIND) {
        // letzte paar gemountet halten (pausiert) → schnelles Zurückwischen
        clearPreload(v.id);
        if (players[v.id]) { try { players[v.id].pauseVideo(); } catch (e) {} }
        else ensurePlayer(v, false);
      } else {
        // weit entfernt → freigeben
        clearPreload(v.id);
        if (players[v.id]) destroyPlayer(v.id);
      }
    });
  }

  // Gestaffelt vorab mounten, damit nicht alle Player auf einmal per Netz stoßen
  function schedulePreload(v, ahead) {
    if (players[v.id]) return;
    clearPreload(v.id);
    preloadTimers[v.id] = setTimeout(function () {
      delete preloadTimers[v.id];
      ensurePlayer(v, false);
    }, Math.min(ahead, 6) * 150);
  }
  function clearPreload(id) {
    if (preloadTimers[id]) { clearTimeout(preloadTimers[id]); delete preloadTimers[id]; }
  }

  /* ---------- Player (offizieller YouTube-Player, controls:0) ---------- */
  function ensurePlayer(v, autoplay) {
    return new Promise(function (resolve) {
      if (!v) return resolve(null);
      if (players[v.id]) return resolve(players[v.id]);
      var card = feedEl.querySelector('.short-card[data-short="' + cssEsc(v.id) + '"]');
      if (!card) return resolve(null);
      var holder = card.querySelector('[data-player]');
      if (!holder) return resolve(null);
      var mountId = 'sc-yt-' + v.id;
      holder.innerHTML = '<div id="' + mountId + '"></div>';

      YU.player.loadApi().then(function (YT) {
        var p = new YT.Player(mountId, {
          videoId: v.id,
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: autoplay ? 1 : 0, mute: muted ? 1 : 0, playsinline: 1,
            controls: 0, rel: 0, modestbranding: 1, showinfo: 0, iv_load_policy: 3
          },
          events: {
            onReady: function () { try { if (muted) p.mute(); else p.unMute(); } catch (e) {} resolve(p); },
            onStateChange: function (e) { onState(e, v); },
            onError: function () { showError(card, v); resolve(null); }
          }
        });
        players[v.id] = p;
        mounted[v.id] = card;
      }).catch(function () { showError(card, v); resolve(null); });
    });
  }

  function play(idx) {
    var v = order[idx];
    if (!v || !players[v.id]) return;
    clearPreload(v.id);
    try { players[v.id].playVideo(); } catch (e) {}
    // Ton-Status anwenden (auch bei vorab geladenen, stumm erzeugten Playern)
    try { if (muted) players[v.id].mute(); else players[v.id].unMute(); } catch (e) {}
    setBigPlay(idx, false);
    startProgress(idx);
    if (!v._tracked) { v._tracked = 1; YU.reco.trackWatchStart(v); }
  }

  function togglePlay(idx) {
    var v = order[idx];
    if (!v || !players[v.id]) return;
    try {
      var st = players[v.id].getPlayerState();
      if (st === 1) { players[v.id].pauseVideo(); setBigPlay(idx, true); stopProgress(); }
      else { players[v.id].playVideo(); setBigPlay(idx, false); startProgress(idx); }
    } catch (e) {}
  }

  function setBigPlay(idx, show) {
    if (!feedEl) return;
    var card = feedEl.querySelector('.short-card[data-idx="' + idx + '"]');
    var bp = card && card.querySelector('[data-bigplay]');
    if (bp) bp.classList.toggle('is-visible', !!show);
  }

  function onState(e, v) {
    if (!order[activeIdx] || order[activeIdx].id !== v.id) return;
    if (e.data === 1) startProgress(activeIdx);
    else if (e.data === 2 || e.data === 0) stopProgress();
  }

  function startProgress(idx) {
    stopProgress();
    var v = order[idx];
    if (!v || !players[v.id] || !feedEl) return;
    var card = feedEl.querySelector('.short-card[data-idx="' + idx + '"]');
    var bar = card && card.querySelector('[data-progress]');
    if (!bar) return;
    progressTimer = setInterval(function () {
      try {
        var cur = players[v.id].getCurrentTime() || 0;
        var dur = players[v.id].getDuration() || 0;
        bar.style.width = dur ? Math.min(100, (cur / dur) * 100) + '%' : '0%';
      } catch (e) {}
    }, 250);
  }
  function stopProgress() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }

  function destroyPlayer(id) {
    clearPreload(id);
    var card = mounted[id];
    try { if (players[id] && players[id].destroy) players[id].destroy(); } catch (e) {}
    delete players[id];
    delete mounted[id];
    if (card) { var h = card.querySelector('[data-player]'); if (h) h.innerHTML = ''; }
  }

  function showError(card, v) {
    var h = card.querySelector('[data-player]');
    if (h) h.innerHTML = '<div class="player-fallback">' +
      '<b>Short nicht verfügbar</b>' +
      '<p>Einbetten nicht erlaubt oder Video nicht abrufbar.</p>' +
      '<a class="btn" href="https://www.youtube.com/watch?v=' + esc(v.id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>' +
      '</div>';
  }

  function like(b) {
    var v = byId[b.dataset.like];
    if (!v) return;
    YU.reco.trackLike(v).then(function () { b.classList.add('is-active'); ui.toast('Gefällt mir gespeichert', 'ok'); });
  }
  function later(b) {
    var v = byId[b.dataset.later];
    if (!v) return;
    YU.store.addLater(v).then(function () { ui.toast('Später ansehen gespeichert', 'ok'); });
  }

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
    stopProgress();
    Object.keys(players).forEach(function (id) { try { if (players[id] && players[id].destroy) players[id].destroy(); } catch (e) {} });
    players = {}; mounted = {}; byId = {}; order = [];
    activeIdx = 0; muted = loadMutePref(); feedEl = null; overlay = null;
  }

  YU.pages = YU.pages || {};
  YU.pages.shorts = { render: render, destroy: destroy };
})(window.YU = window.YU || {});
