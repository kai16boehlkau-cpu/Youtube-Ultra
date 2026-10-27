/* ============================================================
 * YouTube Ultra – Startseite
 * Begrüßung, Filter-Chips, personalisiertes/neutrales Raster,
 * Skeleton-Loader, „Neu“- und „Für dich“-Abschnitte.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;

  var activeChip = 'all';

  function chipsHtml() {
    return '<div class="chips" role="tablist" aria-label="Filter">' +
      YU.config.chips.map(function (c) {
        return '<button class="chip' + (c.id === activeChip ? ' is-active' : '') + '" type="button" ' +
          'role="tab" aria-selected="' + (c.id === activeChip) + '" data-chip="' + esc(c.id) + '">' +
          esc(c.label) + '</button>';
      }).join('') + '</div>';
  }

  function esc(s) { return fmt.esc(s); }

  function render(container, ctx) {
    var chip = (ctx.query && ctx.query.chip) || activeChip;
    activeChip = chip;
    var chipCfg = YU.config.chips.filter(function (c) { return c.id === chip; })[0] || YU.config.chips[0];

    container.innerHTML =
      '<div class="page-enter">' +
        '<p class="greeting">' + greeting() + '</p>' +
        '<p class="greeting-sub" id="home-sub">Lade Empfehlungen…</p>' +
        chipsHtml() +
        '<div id="home-feed">' + ui.skeletonGrid(12) + '</div>' +
      '</div>';

    // Chips
    container.querySelectorAll('[data-chip]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeChip = btn.dataset.chip;
        YU.router.navigate('home?chip=' + encodeURIComponent(activeChip));
      });
    });

    var feedEl = container.querySelector('#home-feed');
    var subEl = container.querySelector('#home-sub');

    YU.reco.feed({
      query: chipCfg.query,
      recent: !!chipCfg.recent,
      limit: 40
    }).then(function (res) {
      var videos = res.videos;
      if (!videos.length) throw Object.assign(new Error('Leer'), { empty: true });

      subEl.textContent = res.personalized
        ? 'Personalisiert aus deinem Verlauf – lokal auf diesem Gerät berechnet.'
        : 'Neutrale Mischung – noch keine persönlichen Daten (oder Personalisierung pausiert).';

      feedEl.innerHTML = '<div class="vgrid">' +
        videos.map(function (v) { return ui.videoCard(v); }).join('') +
        '</div>' +
        '<div class="load-more"><button class="btn btn--ghost" type="button" id="home-more">Mehr laden</button></div>';

      wireCards(feedEl, videos);
      wireMore(feedEl, videos, chipCfg, subEl);
    }).catch(function (err) {
      if (err && err.demo) {
        subEl.textContent = 'Wichtiger Hinweis: Die YouTube-Datenquellen sind momentan nicht erreichbar. ' +
          'Die folgenden Karten sind klar gekennzeichnete BEISPIELDATEN und keine echten YouTube-Inhalte.';
        feedEl.innerHTML = '<div class="note-card" style="margin-bottom:16px">' +
          ui.icons.warn + '<div><b>Beispieldaten-Modus.</b> Es konnten keine echten Daten geladen werden ' +
          '(Datenquellen nicht erreichbar). Die Karten unten sind nur Layout-Beispiele: keine echten Titel, ' +
          'Kanäle oder Videos – und nicht abspielbar.</div></div>' +
          '<div class="vgrid">' + err.videos.map(function (v) { return ui.videoCard(v); }).join('') + '</div>';
        wireCards(feedEl, err.videos);
        return;
      }
      subEl.textContent = '';
      feedEl.innerHTML = ui.emptyState(
        ui.icons.wifi,
        'Keine Videos geladen',
        'Die Datenquellen (Piped-Instanzen bzw. API) sind gerade nicht erreichbar. ' +
        'Prüfe deine Internetverbindung und versuche es erneut. Du kannst auch unter ' +
        'Einstellungen einen eigenen API-Schlüssel eintragen.',
        '<div style="display:flex;gap:10px;margin-top:6px">' +
        '<button class="btn" type="button" id="home-retry">Erneut versuchen</button>' +
        '<a class="btn btn--ghost" href="#/settings">Einstellungen</a></div>'
      );
      var retry = feedEl.querySelector('#home-retry');
      if (retry) retry.addEventListener('click', function () { YU.router.refresh(); });
    });
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return 'Gute Nacht';
    if (h < 11) return 'Guten Morgen';
    if (h < 18) return 'Hallo, schön dich zu sehen';
    return 'Guten Abend';
  }

  function wireCards(root, videos) {
    root.querySelectorAll('[data-chip]') // keine
    ;
    root.querySelectorAll('.vcard[data-video]').forEach(function (card) {
      var v = findVideo(videos, card.dataset.video);
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-menu]') || e.target.closest('a')) return;
        if (v) openVideo(v);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && v && !e.target.closest('[data-menu]')) openVideo(v);
      });
    });
    root.querySelectorAll('[data-menu]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = findVideo(videos, btn.dataset.menu);
        if (!v) return;
        var r = btn.getBoundingClientRect();
        ui.videoMenu(v, r.left - 200, r.bottom + 6);
      });
    });
  }

  function findVideo(videos, id) {
    for (var i = 0; i < videos.length; i++) if (videos[i].id === id) return videos[i];
    return null;
  }

  function openVideo(v) {
    if (v.id.indexOf('demo-') === 0) {
      ui.toast('Beispieldaten sind nicht abspielbar – das sind keine echten Videos.', 'err');
      return;
    }
    YU.router.navigate('watch/' + v.id);
  }

  function wireMore(feedEl, videos, chipCfg, subEl) {
    var btn = feedEl.querySelector('#home-more');
    if (!btn) return;
    var loading = false;
    btn.addEventListener('click', function () {
      if (loading) return;
      loading = true;
      btn.textContent = 'Wird geladen…';
      btn.disabled = true;

      var q = chipCfg.query ||
        YU.config.defaultFeedQueries[Math.floor(Math.random() * YU.config.defaultFeedQueries.length)];

      YU.api.search(q, { maxResults: 25 }).then(function (r) {
        var fresh = r.videos.filter(function (v) {
          return !videos.some(function (x) { return x.id === v.id; });
        });
        if (!fresh.length) throw new Error('nichts neu');
        return YU.reco.rankFeed(fresh, { limit: fresh.length, exclude: videos.map(function (v) { return v.id; }) });
      }).then(function (more) {
        var grid = feedEl.querySelector('.vgrid');
        var tmp = document.createElement('div');
        tmp.innerHTML = more.map(function (v) { return ui.videoCard(v); }).join('');
        while (tmp.firstChild) grid.appendChild(tmp.firstChild);
        videos.push.apply(videos, more);
        wireCards(feedEl, videos);
        btn.textContent = 'Mehr laden';
        btn.disabled = false;
        loading = false;
      }).catch(function () {
        btn.textContent = 'Keine weiteren Videos verfügbar';
        btn.disabled = true;
        loading = false;
      });
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.home = { render: render };
})(window.YU = window.YU || {});
