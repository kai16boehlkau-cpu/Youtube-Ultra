/* ============================================================
 * YouTube Ultra – „Meine Videos“
 * Ehrlich: Ohne Google-Anmeldung kann eine statische Seite
 * keine eigenen Videos hochladen oder das eigene Konto
 * abrufen. Diese Seite zeigt deshalb die lokal gespeicherten
 * eigenen Sammlungen (Verlauf, Likes, Playlists, Später) und
 * erklärt die Grenze transparent.
 * ============================================================ */
(function (YU) {
  'use strict';

  var ui = YU.ui;
  var fmt = YU.fmt;
  function esc(s) { return fmt.esc(s); }

  function render(container) {
    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head"><div>' +
          '<h1 class="page-title">Meine Videos</h1>' +
          '<p class="page-sub">Deine eigenen Sammlungen in dieser App – lokal gespeichert.</p>' +
        '</div></div>' +

        '<div class="note-card" style="margin-bottom:20px">' + ui.icons.warn +
          '<div><b>Warum keine Uploads?</b><br>' +
          'Diese App ist eine reine HTML/CSS/JS-Anwendung ohne Server und ohne Google-Anmeldung. ' +
          'Das Hochladen von Videos oder das Auslesen deines YouTube-Kontos („Meine Videos“ bei YouTube) ' +
          'ist technisch nicht möglich – dafür bräuchte es OAuth-Anmeldung und einen Backend-Dienst. ' +
          'Hier siehst du stattdessen, was die App lokal für dich verwaltet.</div></div>' +

        '<div id="mine-stats"></div>' +
        '<div class="section-head"><h2>Zuletzt gesehen</h2>' +
          '<a class="section-note" href="#/history" style="color:var(--accent)">Kompletter Verlauf →</a></div>' +
        '<div id="mine-recent">' + ui.skeletonRows(4) + '</div>' +
      '</div>';

    Promise.all([
      YU.store.listHistory().catch(function () { return []; }),
      YU.store.listLiked().catch(function () { return []; }),
      YU.store.listPlaylists().catch(function () { return []; }),
      YU.store.listLater().catch(function () { return []; }),
      YU.store.listSubs().catch(function () { return []; })
    ]).then(function (res) {
      var stats = container.querySelector('#mine-stats');
      var cards = [
        { n: res[0].length, label: 'Videos im Verlauf', href: '#/history', icon: ui.icons.history },
        { n: res[1].length, label: 'Gefällt mir', href: '#/liked', icon: ui.icons.heart },
        { n: res[2].length, label: 'Playlists', href: '#/playlists', icon: ui.icons.list },
        { n: res[3].length, label: 'Später ansehen', href: '#/later', icon: ui.icons.play },
        { n: res[4].length, label: 'Abos', href: '#/subs', icon: ui.icons.subs }
      ];
      stats.innerHTML = '<div class="entity-grid" style="margin-bottom:8px">' +
        cards.map(function (c) {
          return '<a class="entity-card" href="' + c.href + '" style="padding:18px 14px">' +
            '<div class="ph" style="width:52px;height:52px;font-size:0">' + c.icon + '</div>' +
            '<h3 style="font-size:22px">' + c.n + '</h3>' +
            '<p>' + esc(c.label) + '</p></a>';
        }).join('') + '</div>';

      var recent = res[0].slice(0, 5);
      var box = container.querySelector('#mine-recent');
      if (!recent.length) {
        box.innerHTML = ui.emptyState(ui.icons.play, 'Noch nichts',
          'Sobald du Videos ansiehst, erscheinen sie hier.',
          '<a class="btn" href="#/home">Zur Startseite</a>');
        return;
      }
      box.innerHTML = '<div class="rowlist">' + recent.map(function (r) {
        return ui.listRow(r, { showProgress: true, dateLabel: fmt.relTime(r.watchedAt) });
      }).join('') + '</div>';
      box.querySelectorAll('.vrow[data-video]').forEach(function (row) {
        row.addEventListener('click', function () { YU.router.navigate('watch/' + row.dataset.video); });
      });
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.mine = { render: render };
})(window.YU = window.YU || {});
