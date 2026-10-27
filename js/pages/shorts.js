/* ============================================================
 * YouTube Ultra – Shorts
 * Eigene vertikale Ansicht mit Snap-Scrolling. Shorts werden
 * über die Suche (Shorts-Filter) geladen; Wiedergabe über den
 * offiziellen Player im jeweiligen Card, mit deutlichem
 * „Auf YouTube öffnen“-Fallback.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  var feedEl = null;
  var observer = null;
  var loadedIds = {};

  var SHORTS_QUERIES = ['shorts deutsch', 'short funny deutsch', 'kurz video lustig', 'shorts minecraft', 'shorts musik'];

  function render(container, ctx) {
    container.innerHTML =
      '<div class="page-enter shorts-wrap">' +
        '<div style="width:min(430px,100%)">' +
          '<div class="shorts-head">' +
            '<h1>Shorts</h1>' +
            '<button class="btn btn--soft btn--sm" type="button" id="shorts-reload">Neue Vorschläge</button>' +
          '</div>' +
          '<div id="shorts-body">' + ui.loadingBlock('Shorts werden geladen…') + '</div>' +
        '</div>' +
      '</div>';

    container.querySelector('#shorts-reload').addEventListener('click', function () {
      loadedIds = {};
      YU.router.refresh();
    });

    load(container);
  }

  function load(container) {
    var body = container.querySelector('#shorts-body');
    var TARGET = 10;

    function isShort(v) { return v && v.duration > 0 && v.duration <= 90; }

    // Mehrere Suchen parallel, damit genug Kurzvideos zusammenkommen
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
      // Fallback: etwas längere Kurzvideos (Shorts dürfen bis 3 Min. sein)
      if (shorts.length < TARGET) {
        var extra = all.filter(function (v) {
          return v.duration > 90 && v.duration <= 180 && !isShort(v);
        });
        shorts = YU.fmt.uniq(shorts.concat(extra), function (v) { return v.id; });
      }
      if (!shorts.length) throw new Error('leer');
      return shorts.slice(0, 18);
    })
      .then(function (shorts) {
        paint(body, shorts);
      })
      .catch(function (err) {
        if (err && err.demo) {
          body.innerHTML = '<div class="note-card">' + ui.icons.warn +
            '<div><b>Beispieldaten-Modus.</b> Es konnten keine echten Shorts geladen werden – ' +
            'die angezeigten Karten sind nur Beispiele.</div></div>';
          return;
        }
        body.innerHTML = ui.emptyState(ui.icons.wifi, 'Keine Shorts verfügbar',
          'Die Datenquelle hat momentan keine kurzen Videos geliefert. ' +
          'Versuche es gleich noch einmal oder prüfe deine Verbindung.',
          '<button class="btn" type="button" onclick="YU.router.refresh()">Erneut laden</button>');
      });
  }

  function paint(body, shorts) {
    var html = '<div class="shorts-feed" id="shorts-feed" tabindex="0" aria-label="Shorts-Feed">';
    shorts.forEach(function (v, i) {
      html += '<div class="short-card" data-short="' + esc(v.id) + '" data-idx="' + i + '">' +
        '<div class="short-card__placeholder" data-play="' + esc(v.id) + '" role="button" tabindex="0" ' +
        'aria-label="' + esc(v.title) + ' abspielen">' +
          (v.thumbnail ? '<img alt="" src="' + esc(v.thumbnail) + '" />' : '') +
          '<span class="sp-play"><svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></span>' +
        '</div>' +
        '<div class="short-card__info">' +
          '<h3>' + esc(v.title) + '</h3>' +
          '<div class="sc-channel">' +
            (v.channelAvatar ? '<img alt="" src="' + esc(v.channelAvatar) + '" />' : '') +
            '<span>' + esc(v.channelName) + '</span>' +
          '</div>' +
          (v.views ? '<div class="mini__meta">' + esc(fmt.views(v.views)) + '</div>' : '') +
        '</div>' +
        '<div class="short-card__rail">' +
          '<button class="rail-btn" type="button" data-like="' + esc(v.id) + '" aria-label="Gefällt mir">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg>Like</button>' +
          '<button class="rail-btn" type="button" data-later="' + esc(v.id) + '" aria-label="Später ansehen">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 1.5"/></svg>Später</button>' +
          '<button class="rail-btn" type="button" data-open="' + esc(v.id) + '" aria-label="Auf YouTube öffnen">' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13.5V19H5V6h5.5"/></svg>YouTube</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    body.innerHTML = html;

    feedEl = body.querySelector('#shorts-feed');

    // Aktionen
    var byId = {};
    shorts.forEach(function (v) { byId[v.id] = v; });

    body.querySelectorAll('[data-play]').forEach(function (ph) {
      ph.addEventListener('click', function () { playShort(ph.dataset.play, byId[ph.dataset.play], ph); });
      ph.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playShort(ph.dataset.play, byId[ph.dataset.play], ph); }
      });
    });
    body.querySelectorAll('[data-like]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = byId[b.dataset.like];
        if (!v) return;
        YU.reco.trackLike(v).then(function () {
          b.classList.add('is-active');
          ui.toast('Gefällt mir gespeichert', 'ok');
        });
      });
    });
    body.querySelectorAll('[data-later]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = byId[b.dataset.later];
        if (!v) return;
        YU.store.addLater(v).then(function () { ui.toast('Später ansehen gespeichert', 'ok'); });
      });
    });
    body.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.open('https://www.youtube.com/watch?v=' + b.dataset.open, '_blank', 'noopener');
      });
    });

    // Automatisch den sichtbaren Short tracken (kein Autoplay ohne Klick)
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var card = en.target;
          if (en.isIntersecting && en.intersectionRatio > 0.6) {
            var id = card.dataset.short;
            if (!loadedIds[id]) {
              loadedIds[id] = 1;
              var v = byId[id];
              if (v) YU.reco.trackWatchStart(v);
            }
          }
        });
      }, { root: feedEl, threshold: [0.6] });
      body.querySelectorAll('.short-card').forEach(function (c) { observer.observe(c); });
    }
  }

  function playShort(id, video, placeholder) {
    if (!video) return;
    var card = placeholder.closest('.short-card');
    if (!card) return;
    if (!loadedIds['played-' + id]) {
      loadedIds['played-' + id] = 1;
      YU.reco.trackWatchStart(video);
    }
    // Offizieller Player (YouTube selbst erlaubt Autoplay mit Mute-Regel –
    // wir starten ohne Mute-Parameter, falls der Browser blockiert, zeigt YouTube einen Hinweis)
    placeholder.remove();
    var mount = document.createElement('div');
    mount.id = 'short-player-' + id;
    mount.style.cssText = 'position:absolute;inset:0';
    card.insertBefore(mount, card.firstChild);

    YU.player.loadApi().then(function (YT) {
      /* eslint-disable no-new */
      new YT.Player(mount.id, {
        videoId: id,
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onError: function () {
            card.innerHTML = '<div class="player-fallback">' +
              '<b>Short kann hier nicht abgespielt werden</b>' +
              '<p>Der Eigentümer hat die Einbettung nicht erlaubt oder das Video ist nicht verfügbar.</p>' +
              '<a class="btn" href="https://www.youtube.com/watch?v=' + esc(id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>' +
              '</div>';
          }
        }
      });
    }).catch(function () {
      card.innerHTML = '<div class="player-fallback">' +
        '<b>Player nicht verfügbar</b>' +
        '<p>Der offizielle YouTube-Player konnte nicht geladen werden.</p>' +
        '<a class="btn" href="https://www.youtube.com/watch?v=' + esc(id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>' +
        '</div>';
    });
  }

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
    feedEl = null;
    loadedIds = {};
    // Kurz-Player instanzieren nicht global → beim Zerstören der Seite DOM leer,
    // YT-Instanzen werden durch DOM-Entfernung befreit (kein Referenz-Leak relevant)
  }

  YU.pages = YU.pages || {};
  YU.pages.shorts = { render: render, destroy: destroy };
})(window.YU = window.YU || {});
