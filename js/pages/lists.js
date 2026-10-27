/* ============================================================
 * YouTube Ultra – Listen: „Später ansehen“ & „Gefällt mir“
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  /* ---------- Später ansehen ---------- */
  function renderLater(container) {
    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head"><div>' +
          '<h1 class="page-title">Später ansehen</h1>' +
          '<p class="page-sub">Merkliste – lokal gespeichert, Reihenfolge: zuletzt hinzugefügt.</p>' +
        '</div></div>' +
        '<div id="later-body">' + ui.skeletonRows(6) + '</div>' +
      '</div>';

    YU.store.listLater().then(function (rows) {
      var body = container.querySelector('#later-body');
      if (!rows.length) {
        body.innerHTML = ui.emptyState(
          ui.icons.play,
          'Noch nichts vorgemerkt',
          'Über das 3-Punkte-Menü einer Karte oder den „Später ansehen“-Button auf der Watch-Seite ' +
          'fügst du Videos zu dieser Liste hinzu.',
          '<a class="btn" href="#/home">Zur Startseite</a>'
        );
        return;
      }
      body.innerHTML = '<div class="rowlist">' + rows.map(function (r) {
        return ui.listRow(r, {
          showAdded: true,
          actions: '' +
            '<button class="iconbtn" type="button" data-play="' + esc(r.videoId) + '" title="Jetzt ansehen" aria-label="Jetzt ansehen" style="width:34px;height:34px">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></button>' +
            '<button class="iconbtn" type="button" data-remove="' + esc(r.videoId) + '" title="Entfernen" aria-label="Entfernen" style="width:34px;height:34px">' +
            '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg></button>'
        });
      }).join('') + '</div>';

      body.querySelectorAll('.vrow[data-video]').forEach(function (row) {
        row.addEventListener('click', function (e) {
          if (e.target.closest('[data-remove]')) return;
          YU.router.navigate('watch/' + row.dataset.video);
        });
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') YU.router.navigate('watch/' + row.dataset.video);
        });
      });
      body.querySelectorAll('[data-remove]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          YU.store.removeLater(b.dataset.remove).then(function () {
            ui.toast('Entfernt');
            var row = b.closest('.vrow');
            if (row) { row.style.opacity = '0'; setTimeout(function () { row.remove(); }, 200); }
          });
        });
      });
    }).catch(function () {
      container.querySelector('#later-body').innerHTML = ui.emptyState(
        ui.icons.warn, 'Liste nicht verfügbar', 'Der lokale Speicher konnte nicht gelesen werden.');
    });
  }

  /* ---------- Gefällt mir ---------- */
  function renderLiked(container) {
    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head"><div>' +
          '<h1 class="page-title">Gefällt mir</h1>' +
          '<p class="page-sub">Videos, die du mit „Gefällt mir“ markiert hast – sie fließen in die Empfehlungen ein.</p>' +
        '</div></div>' +
        '<div id="liked-body">' + ui.skeletonGrid(8) + '</div>' +
      '</div>';

    YU.store.listLiked().then(function (rows) {
      var body = container.querySelector('#liked-body');
      if (!rows.length) {
        body.innerHTML = ui.emptyState(
          ui.icons.heart,
          'Noch nichts geliked',
          'Über den „Gefällt mir“-Button auf der Watch-Seite oder im 3-Punkte-Menü ' +
          'sammelst du hier deine Favoriten.',
          '<a class="btn" href="#/home">Zur Startseite</a>'
        );
        return;
      }
      var videos = rows.map(function (r) {
        return {
          id: r.videoId, title: r.title, thumbnail: r.thumbnail,
          channelName: r.channelName, channelId: r.channelId,
          duration: r.duration, views: 0, uploaded: r.likedAt,
          uploadedLabel: 'geliked ' + fmt.relTime(r.likedAt), source: 'local'
        };
      });
      body.innerHTML = '<div class="vgrid">' + videos.map(function (v) { return ui.videoCard(v); }).join('') + '</div>';
      body.querySelectorAll('.vcard[data-video]').forEach(function (card) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('[data-menu]') || e.target.closest('a')) return;
          YU.router.navigate('watch/' + card.dataset.video);
        });
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') YU.router.navigate('watch/' + card.dataset.video);
        });
      });
      body.querySelectorAll('[data-menu]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var v = videos.filter(function (x) { return x.id === btn.dataset.menu; })[0];
          if (!v) return;
          var r = btn.getBoundingClientRect();
          ui.videoMenu(v, r.left - 200, r.bottom + 6);
        });
      });
    }).catch(function () {
      container.querySelector('#liked-body').innerHTML = ui.emptyState(
        ui.icons.warn, 'Liste nicht verfügbar', 'Der lokale Speicher konnte nicht gelesen werden.');
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.later = { render: renderLater };
  YU.pages.liked = { render: renderLiked };
})(window.YU = window.YU || {});
