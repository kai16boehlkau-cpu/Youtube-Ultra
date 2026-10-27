/* ============================================================
 * YouTube Ultra – Suchergebnisseite
 * Ergebnis-Tabs (Videos/Kanäle/Playlists), Filter (Upload-Zeit,
 * Dauer, Sortierung – nur wirklich verfügbare Optionen),
 * „Mehr laden“-Pagination, letzte Suchbegriffe.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  var FILTERS = {
    time: [
      { id: '', label: 'Beliebig (Relevanz)' },
      { id: 'hour', label: 'Letzte Stunde' },
      { id: 'today', label: 'Heute' },
      { id: 'week', label: 'Diese Woche' },
      { id: 'month', label: 'Dieser Monat' },
      { id: 'year', label: 'Dieses Jahr' }
    ],
    duration: [
      { id: '', label: 'Jede Dauer' },
      { id: 'short', label: 'Unter 4 Minuten' },
      { id: 'medium', label: '4–20 Minuten' },
      { id: 'long', label: 'Über 20 Minuten' }
    ],
    sort: [
      { id: 'relevance', label: 'Relevanz' },
      { id: 'views', label: 'Beliebtheit' }
    ]
  };

  function publishedAfter(id) {
    var now = new Date();
    switch (id) {
      case 'hour': return new Date(now - 3600e3).toISOString();
      case 'today': return new Date(now - 86400e3).toISOString();
      case 'week': return new Date(now - 7 * 86400e3).toISOString();
      case 'month': return new Date(now - 30 * 86400e3).toISOString();
      case 'year': return new Date(now - 365 * 86400e3).toISOString();
      default: return '';
    }
  }

  function filterbarHtml(query) {
    function select(name, opts, current) {
      return '<div class="filter-group"><span class="fg-label">' + esc(name) + '</span>' +
        '<select class="select" data-filter="' + esc(name) + '" aria-label="Filter ' + esc(name) + '">' +
        opts.map(function (o) {
          return '<option value="' + esc(o.id) + '"' + (o.id === current ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select></div>';
    }
    return '<div class="filterbar">' +
      select('Upload-Zeit', FILTERS.time, query.time || '') +
      select('Dauer', FILTERS.duration, query.duration || '') +
      select('Sortierung', FILTERS.sort, query.sort || 'relevance') +
      '</div>' +
      '<p class="filter-note">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8.5v.2"/></svg>' +
      'Hinweis: „Letzte Stunde/Heute/…“ und die Filter werden bei der keyless-Quelle lokal angewendet, ' +
      'bei einer offiziellen API serverseitig. Sortierbar sind dort nur Relevanz und Beliebtheit.' +
      '</p>';
  }

  /* ---------- Klientseitige Filterung (keyless-Modus) ---------- */
  function applyClientFilters(videos, query) {
    var out = videos.slice();
    var pa = publishedAfter(query.time);
    if (pa) {
      var t0 = Date.parse(pa);
      out = out.filter(function (v) { return v.uploaded && v.uploaded >= t0; });
    }
    if (query.duration === 'short') out = out.filter(function (v) { return v.duration > 0 && v.duration < 240; });
    if (query.duration === 'medium') out = out.filter(function (v) { return v.duration >= 240 && v.duration <= 1200; });
    if (query.duration === 'long') out = out.filter(function (v) { return v.duration > 1200; });
    if (query.sort === 'views') out.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    return out;
  }

  function render(container, ctx) {
    var q = (ctx.query && ctx.query.q) || '';
    var tab = (ctx.query && ctx.query.tab) || 'videos';
    var query = ctx.query || {};

    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head">' +
          '<div><h1 class="page-title">' + (q ? 'Ergebnisse für „' + esc(q) + '“' : 'Suche') + '</h1>' +
          '<p class="page-sub" id="search-count"></p></div>' +
        '</div>' +
        (q ? filterbarHtml(query) : '') +
        '<div class="tabs" role="tablist" aria-label="Ergebnistyp">' +
          tabBtn('videos', 'Videos', tab) +
          tabBtn('channels', 'Kanäle', tab) +
          tabBtn('playlists', 'Playlists', tab) +
        '</div>' +
        '<div id="search-results">' + ui.skeletonGrid(10) + '</div>' +
        '<div class="load-more" id="search-more-wrap" hidden><button class="btn btn--ghost" type="button" id="search-more">Mehr laden</button></div>' +
      '</div>';

    // Tabs
    container.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        var params = ['q=' + encodeURIComponent(q), 'tab=' + b.dataset.tab];
        ['time', 'duration', 'sort'].forEach(function (k) {
          if (query[k]) params.push(k + '=' + encodeURIComponent(query[k]));
        });
        YU.router.navigate('search?' + params.join('&'));
      });
    });

    // Filter
    container.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var map = { 'Upload-Zeit': 'time', 'Dauer': 'duration', 'Sortierung': 'sort' };
        var key = map[sel.dataset.filter];
        var params = ['q=' + encodeURIComponent(q), 'tab=' + encodeURIComponent(tab)];
        ['time', 'duration', 'sort'].forEach(function (k) {
          var val = (k === key) ? sel.value : query[k];
          if (val) params.push(k + '=' + encodeURIComponent(val));
        });
        YU.router.navigate('search?' + params.join('&'));
      });
    });

    if (!q) {
      container.querySelector('#search-results').innerHTML = recentAndHint();
      wireRecent(container);
      return;
    }

    var results = container.querySelector('#search-results');
    var nextPage = null;
    var allVideos = [];

    function opts(extra) {
      var o = Object.assign({
        nextPage: extra && extra.nextPage,
        order: query.sort === 'views' ? 'views' : 'relevance',
        publishedAfter: publishedAfter(query.time) || undefined,
        videoDuration: query.duration === 'short' ? 'short' : (query.duration === 'long' ? 'long' : undefined)
      }, extra || {});
      return o;
    }

    function loadFirst() {
      YU.api.search(q, opts({ filter: tab === 'videos' ? undefined : (tab === 'channels' ? 'channels' : 'playlists') }))
        .then(function (r) {
          nextPage = r.nextPage;

          if (tab === 'channels' && r.channels && r.channels.length) {
            results.innerHTML = '<div class="entity-grid">' + r.channels.map(channelCard).join('') + '</div>';
            wireChannels(results);
          } else if (tab === 'playlists' && r.playlists && r.playlists.length) {
            results.innerHTML = '<div class="entity-grid">' + r.playlists.map(playlistCard).join('') + '</div>';
            wirePlaylists(results);
          } else if (tab !== 'videos' && ((tab === 'channels' && !(r.channels || []).length) || (tab === 'playlists' && !(r.playlists || []).length))) {
            results.innerHTML = ui.emptyState(ui.icons.search, 'Keine ' + (tab === 'channels' ? 'Kanäle' : 'Playlists') + ' gefunden',
              'Für diesen Begriff lieferte die Datenquelle keine ' + (tab === 'channels' ? 'Kanal-' : 'Playlist-') +
              'Ergebnisse. Der Keyless-Modus liefert hier nur, was die Instanz zurückgibt.');
          } else {
            var videos = r.videos || [];
            if (YU.api.mode() === 'keyless') videos = applyClientFilters(videos, query);
            allVideos = videos;
            if (!videos.length) {
              results.innerHTML = ui.emptyState(ui.icons.search, 'Keine Ergebnisse',
                'Für „' + q + '“ wurden mit den gewählten Filtern keine Videos gefunden. ' +
                'Versuche andere Suchbegriffe oder lockere die Filter.');
            } else {
              renderVideos(videos);
              var count = container.querySelector('#search-count');
              if (count) count.textContent = videos.length + ' Videos von ' +
                (r.source === 'official' ? 'der offiziellen API' : 'der keyless-Quelle') +
                (YU.api.mode() === 'keyless' && (query.time || query.duration) ? ' (lokale Filterung)' : '');
            }
          }

          var moreWrap = container.querySelector('#search-more-wrap');
          if (moreWrap && nextPage && allVideos.length) {
            moreWrap.hidden = false;
            var more = container.querySelector('#search-more');
            more.onclick = function () {
              more.disabled = true;
              more.textContent = 'Wird geladen…';
              YU.api.search(q, opts({ nextPage: nextPage, filter: tab === 'videos' ? undefined : tab.replace(/s$/, '') }))
                .then(function (r2) {
                  nextPage = r2.nextPage;
                  var v = r2.videos || [];
                  if (YU.api.mode() === 'keyless') v = applyClientFilters(v, query);
                  v = v.filter(function (x) { return !allVideos.some(function (y) { return y.id === x.id; }); });
                  allVideos = allVideos.concat(v);
                  renderVideos(allVideos);
                  more.disabled = false;
                  more.textContent = 'Mehr laden';
                  if (!nextPage) { moreWrap.hidden = true; }
                })
                .catch(function () {
                  more.textContent = 'Weitere Ergebnisse nicht verfügbar';
                  more.disabled = true;
                });
            };
          }
        })
        .catch(function (err) {
          if (err && err.demo) {
            results.innerHTML = '<div class="note-card" style="margin-bottom:16px">' + ui.icons.warn +
              '<div><b>Beispieldaten-Modus.</b> Die Suche konnte keine echten Ergebnisse laden – ' +
              'unten siehst du klar gekennzeichnete Beispiele (nicht abspielbar, keine echten Inhalte).</div></div>' +
              '<div class="vgrid">' + err.videos.map(function (v) { return ui.videoCard(v); }).join('') + '</div>';
            wireVideos(results, err.videos);
            return;
          }
          results.innerHTML = ui.emptyState(ui.icons.wifi, 'Suche fehlgeschlagen',
            'Die Datenquelle konnte nicht erreicht werden. Prüfe die Verbindung oder trage unter ' +
            'Einstellungen einen eigenen API-Schlüssel ein.',
            '<button class="btn" type="button" onclick="YU.router.refresh()">Erneut versuchen</button>');
        });
    }

    function renderVideos(videos) {
      results.innerHTML = '<div class="vgrid">' + videos.map(function (v) { return ui.videoCard(v); }).join('') + '</div>';
      wireVideos(results, videos);
    }

    loadFirst();
  }

  function tabBtn(id, label, active) {
    return '<button class="tab' + (id === active ? ' is-active' : '') + '" type="button" role="tab" ' +
      'aria-selected="' + (id === active) + '" data-tab="' + id + '">' + esc(label) + '</button>';
  }

  function channelCard(c) {
    return '<article class="entity-card" tabindex="0" role="link" data-channel="' + esc(c.id) + '">' +
      (c.avatar ? '<img loading="lazy" alt="" src="' + esc(c.avatar) + '" />'
                : '<div class="ph">' + esc(fmt.initial(c.name)) + '</div>') +
      '<h3>' + esc(c.name) + (c.verified ? ' ✓' : '') + '</h3>' +
      '<p>' + (c.subscribers ? esc(fmt.subsLabel(c.subscribers)) : 'Kanal auf YouTube') + '</p>' +
      '</article>';
  }

  function playlistCard(p) {
    var vid = p.id || '';
    return '<article class="entity-card" tabindex="0" role="link" data-playlist="' + esc(vid) + '">' +
      (p.thumbnail ? '<img class="sq" loading="lazy" alt="" src="' + esc(p.thumbnail) + '" />'
                   : '<div class="ph sq">' + esc(fmt.initial(p.name)) + '</div>') +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p>' + (p.videoCount ? esc(fmt.compact(p.videoCount)) + ' Videos' : 'Playlist') +
      (p.uploader ? ' · ' + esc(p.uploader) : '') + '</p>' +
      '</article>';
  }

  function wireVideos(root, videos) {
    root.querySelectorAll('.vcard[data-video]').forEach(function (card) {
      var v = videos.filter(function (x) { return x.id === card.dataset.video; })[0];
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-menu]') || e.target.closest('a')) return;
        if (!v) return;
        if (v.id.indexOf('demo-') === 0) { ui.toast('Beispieldaten sind nicht abspielbar.', 'err'); return; }
        YU.router.navigate('watch/' + v.id);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && v && v.id.indexOf('demo-') !== 0) YU.router.navigate('watch/' + v.id);
      });
    });
    root.querySelectorAll('[data-menu]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = videos.filter(function (x) { return x.id === btn.dataset.menu; })[0];
        if (!v) return;
        var r = btn.getBoundingClientRect();
        ui.videoMenu(v, r.left - 200, r.bottom + 6);
      });
    });
  }

  function wireChannels(root) {
    root.querySelectorAll('[data-channel]').forEach(function (card) {
      card.addEventListener('click', function () { YU.router.navigate('channel/' + card.dataset.channel); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') YU.router.navigate('channel/' + card.dataset.channel);
      });
    });
  }

  function wirePlaylists(root) {
    root.querySelectorAll('[data-playlist]').forEach(function (card) {
      card.addEventListener('click', function () { YU.router.navigate('ytplaylist/' + card.dataset.playlist); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') YU.router.navigate('ytplaylist/' + card.dataset.playlist);
      });
    });
  }

  function recentAndHint() {
    return '<div class="section-head"><h2>Zuletzt gesucht</h2></div>' +
      '<div id="recent-terms"></div>' +
      '<div class="note-card" style="margin-top:20px">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<div>Gib einen Begriff in die Suche oben ein und drücke <b>Enter</b> oder klicke das Suchsymbol. ' +
      'Vorschläge erscheinen während der Eingabe.</div></div>';
  }

  function wireRecent(container) {
    var box = container.querySelector('#recent-terms');
    if (!box) return;
    YU.store.listSearchHistory().then(function (rows) {
      if (!rows.length) {
        box.innerHTML = '<p class="page-sub">Noch keine Suchverläufe gespeichert.</p>';
        return;
      }
      box.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:9px">' +
        rows.slice(0, 14).map(function (r) {
          return '<button class="chip" type="button" data-term="' + esc(r.term) + '">' + esc(r.term) + '</button>';
        }).join('') + '</div>' +
        '<div style="margin-top:14px"><button class="btn btn--soft btn--sm" type="button" id="clear-terms">Suchverlauf löschen</button></div>';
      box.querySelectorAll('[data-term]').forEach(function (b) {
        b.addEventListener('click', function () { YU.router.navigate('search?q=' + encodeURIComponent(b.dataset.term)); });
      });
      var clr = box.querySelector('#clear-terms');
      if (clr) clr.addEventListener('click', function () {
        YU.store.clearSearchHistory().then(function () {
          ui.toast('Suchverlauf gelöscht', 'ok');
          YU.router.refresh();
        });
      });
    }).catch(function () {
      box.innerHTML = '<p class="page-sub">Suchverlauf nicht verfügbar.</p>';
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.search = { render: render };
})(window.YU = window.YU || {});
