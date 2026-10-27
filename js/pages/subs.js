/* ============================================================
 * YouTube Ultra – Abos
 * Neueste Videos der abonnierten Kanäle (parallel abgerufen,
 * begrenzt), Abo-Verwaltung, ehrliche Hinweise bei Quell-Limits.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  function render(container) {
    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head"><div>' +
          '<h1 class="page-title">Abos</h1>' +
          '<p class="page-sub">Neue Videos der Kanäle, die du abonniert hast – Abos liegen nur lokal auf diesem Gerät.</p>' +
        '</div></div>' +
        '<div id="subs-body">' + ui.skeletonGrid(8) + '</div>' +
      '</div>';

    YU.store.listSubs().then(function (subs) {
      if (!subs.length) {
        container.querySelector('#subs-body').innerHTML = ui.emptyState(
          ui.icons.subs,
          'Noch keine Abos',
          'Abonniere Kanäle über die Watch-Seite oder das 3-Punkte-Menü einer Karte. ' +
          'Die Abos werden lokal gespeichert und erscheinen dann hier.',
          '<a class="btn" href="#/home">Zur Startseite</a>'
        );
        return;
      }
      paintSubs(container, subs);
    }).catch(function () {
      container.querySelector('#subs-body').innerHTML = ui.emptyState(
        ui.icons.warn, 'Abos nicht verfügbar',
        'Der lokale Speicher (IndexedDB) ist nicht erreichbar – vermutlich läuft die App im Privatmodus oder wurde blockiert.'
      );
    });
  }

  function paintSubs(container, subs) {
    var body = container.querySelector('#subs-body');

    // Kopf: Abo-Chips mit Verwaltung
    body.innerHTML =
      '<div class="chips" style="position:static;background:none" aria-label="Abonnierte Kanäle">' +
        subs.map(function (s) {
          return '<button class="chip" type="button" data-manage="' + esc(s.channelId) + '" title="Abo verwalten">' +
            esc(s.name || s.channelId.slice(0, 12)) + '</button>';
        }).join('') +
      '</div>' +
      '<div id="subs-feed">' + ui.skeletonGrid(8) + '</div>';

    body.querySelectorAll('[data-manage]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var r = btn.getBoundingClientRect();
        var ch = subs.filter(function (s) { return s.channelId === btn.dataset.manage; })[0];
        ui.openMenu({
          x: r.left, y: r.bottom + 6,
          title: ch ? ch.name : '', sub: 'Abo verwalten',
          items: [
            {
              label: 'Kanal anzeigen',
              onClick: function () { YU.router.navigate('channel/' + btn.dataset.manage); }
            },
            {
              label: 'Abo kündigen',
              danger: true,
              onClick: function () {
                YU.reco.unsubscribe(btn.dataset.manage).then(function () {
                  ui.toast('Abo gekündigt');
                  YU.router.refresh();
                });
              }
            }
          ]
        });
      });
    });

    // Videos aller Kanäle parallel (gegattert) laden
    var feedEl = body.querySelector('#subs-feed');
    var limit = YU.config.parallelChannels;
    var queue = subs.slice(0, 12); // Datenminimierung: max. 12 Kanäle pro Abruf
    var collected = [];
    var failed = 0;
    var idx = 0;

    function nextBatch() {
      if (idx >= queue.length) return Promise.resolve();
      var batch = queue.slice(idx, idx + limit);
      idx += limit;
      return Promise.all(batch.map(function (s) {
        return YU.api.getChannelVideos(s.channelId, 8).then(function (vids) {
          vids.forEach(function (v) { v.__sub = s.name; });
          collected = collected.concat(vids);
        }).catch(function () { failed++; });
      })).then(nextBatch);
    }

    nextBatch().then(function () {
      if (!collected.length) {
        feedEl.innerHTML = ui.emptyState(
          ui.icons.wifi,
          failed ? 'Kanäle konnten nicht abgerufen werden' : 'Noch keine Videos',
          failed
            ? 'Die Datenquelle hat ' + (failed === 1 ? 'einen Kanal' : failed + ' Kanäle') +
              ' nicht liefern können (die keyless-Instanz unterstützt Kanal-Abos-Feeds nur eingeschränkt). ' +
              'Unter Einstellungen kannst du einen eigenen API-Schlüssel eintragen – dann funktionieren Kanal-Feeds zuverlässig.'
            : 'Deine abonnierten Kanäle haben noch keine neuen Videos.',
          '<a class="btn btn--ghost" href="#/home">Zur Startseite</a>'
        );
        return;
      }
      var sorted = collected.sort(function (a, b) { return (b.uploaded || 0) - (a.uploaded || 0); });
      YU.reco.rankFeed(sorted, { limit: 36 }).then(function (ranked) {
        feedEl.innerHTML = '<div class="vgrid">' + ranked.map(function (v) {
          return ui.videoCard(v, { badge: 'Abo' });
        }).join('') + '</div>';
        wire(feedEl, ranked);
      });
    });

    function wire(root, videos) {
      root.querySelectorAll('.vcard[data-video]').forEach(function (card) {
        var v = videos.filter(function (x) { return x.id === card.dataset.video; })[0];
        card.addEventListener('click', function (e) {
          if (e.target.closest('[data-menu]') || e.target.closest('a') || !v) return;
          YU.router.navigate('watch/' + v.id);
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && v) YU.router.navigate('watch/' + v.id);
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
  }

  YU.pages = YU.pages || {};
  YU.pages.subs = { render: render };
})(window.YU = window.YU || {});
