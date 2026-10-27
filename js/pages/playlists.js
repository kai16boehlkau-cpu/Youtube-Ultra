/* ============================================================
 * YouTube Ultra – Playlists
 * • Eigene Playlists: lokal (IndexedDB) – erstellen, umbenennen,
 *   löschen, sortieren, Einträge entfernen, abspielen.
 * • YouTube-Playlists (Suchergebnisse): Metadaten + Videos,
 *   sofern die Datenquelle sie liefert; sonst ehrlicher Hinweis
 *   mit Link auf YouTube.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  /* ---------- Übersicht: eigene Playlists ---------- */
  function render(container) {
    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head">' +
          '<div><h1 class="page-title">Playlists</h1>' +
          '<p class="page-sub">Deine eigenen Playlists – vollständig lokal auf diesem Gerät gespeichert.</p></div>' +
          '<button class="btn" type="button" id="pl-new">Playlist erstellen</button>' +
        '</div>' +
        '<div id="pl-body">' + ui.skeletonGrid(4) + '</div>' +
      '</div>';

    container.querySelector('#pl-new').addEventListener('click', function () {
      ui.openModal({
        title: 'Neue Playlist',
        desc: 'Gib der Playlist einen Namen.',
        placeholder: 'z. B. „Favoriten 2026“',
        confirmLabel: 'Erstellen'
      }).then(function (name) {
        if (!name) return;
        YU.store.createPlaylist(name).then(function () {
          ui.toast('Playlist erstellt', 'ok');
          YU.router.refresh();
        });
      });
    });

    paint(container);
  }

  function paint(container) {
    var body = container.querySelector('#pl-body');
    YU.store.listPlaylists().then(function (pls) {
      if (!pls.length) {
        body.innerHTML = ui.emptyState(
          ui.icons.list,
          'Noch keine Playlists',
          'Erstelle deine erste Playlist – Videos fügst du über das 3-Punkte-Menü ' +
          '(„Zu Playlist hinzufügen“) hinzu.',
          '<button class="btn" type="button" id="pl-new-2">Playlist erstellen</button>'
        );
        var b = body.querySelector('#pl-new-2');
        if (b) b.addEventListener('click', function () { document.getElementById('pl-new').click(); });
        return;
      }

      // Cover = Thumbnail des ersten Videos
      return Promise.all(pls.map(function (pl) {
        return YU.store.playlistItems(pl.id).then(function (items) {
          return { pl: pl, count: items.length, cover: items[0] ? items[0].thumbnail : '' };
        });
      })).then(function (rows) {
        body.innerHTML = '<div class="entity-grid">' + rows.map(function (r) {
          return '<article class="entity-card" tabindex="0" role="link" data-pl="' + esc(r.pl.id) + '">' +
            (r.cover
              ? '<img class="sq" alt="" src="' + esc(r.cover) + '" />'
              : '<div class="ph sq">' +
                '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="16" cy="19" r="2.2"/><path d="M17.5 12.5v6.2"/></svg></div>') +
            '<h3>' + esc(r.pl.name) + '</h3>' +
            '<p>' + r.count + ' Video' + (r.count === 1 ? '' : 's') +
            ' · erstellt ' + esc(fmt.date(r.pl.createdAt)) + '</p>' +
            '</article>';
        }).join('') + '</div>';

        body.querySelectorAll('[data-pl]').forEach(function (card) {
          var go = function () { YU.router.navigate('playlists/' + card.dataset.pl); };
          card.addEventListener('click', go);
          card.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        });
      });
    }).catch(function () {
      body.innerHTML = ui.emptyState(ui.icons.warn, 'Playlists nicht verfügbar',
        'Der lokale Speicher (IndexedDB) ist nicht erreichbar.');
    });
  }

  /* ---------- Playlist-Detail ---------- */
  function renderDetail(container, ctx) {
    var id = ctx.params.id;
    container.innerHTML = '<div class="page-enter">' + ui.loadingBlock('Playlist wird geladen…') + '</div>';

    YU.store.getPlaylist(id).then(function (pl) {
      if (!pl) {
        container.innerHTML = ui.emptyState(ui.icons.warn, 'Playlist nicht gefunden',
          'Diese Playlist existiert nicht (mehr) auf diesem Gerät.',
          '<a class="btn" href="#/playlists">Zurück zu Playlists</a>');
        return null;
      }
      return YU.store.playlistItems(id).then(function (items) {
        drawDetail(container, pl, items);
      });
    }).catch(function () {
      container.innerHTML = ui.emptyState(ui.icons.warn, 'Fehler', 'Playlist konnte nicht geladen werden.');
    });
  }

  function drawDetail(container, pl, items) {
    var totalSec = items.reduce(function (s, i) { return s + (i.duration || 0); }, 0);

    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="plhead">' +
          '<div class="plhead__art">' +
            (items[0] && items[0].thumbnail
              ? '<img alt="" src="' + esc(items[0].thumbnail) + '" />'
              : '<svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.4"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="16" cy="19" r="2.2"/><path d="M17.5 12.5v6.2"/></svg>') +
          '</div>' +
          '<div class="plhead__text">' +
            '<span class="kicker">Playlist · lokal</span>' +
            '<h1>' + esc(pl.name) + '</h1>' +
            '<p class="pl-meta">' + items.length + ' Video' + (items.length === 1 ? '' : 's') +
              (totalSec ? ' · insgesamt ' + esc(fmt.duration(totalSec)) : '') +
              ' · zuletzt bearbeitet ' + esc(fmt.relTime(pl.updatedAt)) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="pl-actions">' +
          '<button class="play-fab" type="button" id="pl-play" aria-label="Playlist abspielen"' + (items.length ? '' : ' disabled') + '>' +
            '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></button>' +
          '<button class="btn btn--ghost btn--sm" type="button" id="pl-rename">Umbenennen</button>' +
          '<button class="btn btn--danger btn--sm" type="button" id="pl-delete">Playlist löschen</button>' +
        '</div>' +
        '<div id="pl-items">' +
          (items.length
            ? '<div class="rowlist">' + items.map(function (it, i) {
                return '<div class="pl-item" data-video="' + esc(it.videoId) + '" tabindex="0" role="link">' +
                  '<button class="iconbtn pl-item__grip" type="button" data-move="up" data-id="' + esc(it.videoId) + '" ' +
                    'aria-label="Nach oben verschieben" title="Nach oben"' + (i === 0 ? ' disabled' : '') + ' style="width:30px;height:30px">' +
                    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 14l6-6 6 6"/></svg></button>' +
                  '<span class="idx">' + (i + 1) + '</span>' +
                  (it.thumbnail ? '<img alt="" loading="lazy" src="' + esc(it.thumbnail) + '" />' : '<img alt="" />') +
                  '<div class="pl-title">' + esc(it.title) +
                    '<div class="pl-sub">' + esc(it.channelName) + (it.duration ? ' · ' + esc(fmt.duration(it.duration)) : '') + '</div></div>' +
                  '<div class="pl-actions">' +
                    '<button class="iconbtn" type="button" data-move="down" data-id="' + esc(it.videoId) + '" ' +
                      'aria-label="Nach unten verschieben" title="Nach unten" style="width:32px;height:32px"' +
                      (i === items.length - 1 ? ' disabled' : '') + '>' +
                      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 10l6 6 6-6"/></svg></button>' +
                    '<button class="iconbtn" type="button" data-pl-remove="' + esc(it.videoId) + '" ' +
                      'aria-label="Aus Playlist entfernen" title="Entfernen" style="width:32px;height:32px">' +
                      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg></button>' +
                  '</div>' +
                '</div>';
              }).join('') + '</div>'
            : ui.emptyState(ui.icons.list, 'Playlist ist leer',
                'Füge Videos über das 3-Punkte-Menü einer Karte hinzu („Zu Playlist hinzufügen“).',
                '<a class="btn" href="#/home">Videos entdecken</a>')) +
        '</div>' +
      '</div>';

    // Aktionen
    container.querySelector('#pl-rename').addEventListener('click', function () {
      ui.openModal({ title: 'Playlist umbenennen', value: pl.name, confirmLabel: 'Speichern' })
        .then(function (name) {
          if (!name) return;
          YU.store.renamePlaylist(pl.id, name).then(function () {
            ui.toast('Umbenannt', 'ok');
            YU.router.refresh();
          });
        });
    });

    container.querySelector('#pl-delete').addEventListener('click', function () {
      ui.confirmModal('Playlist löschen?',
        '„' + pl.name + '“ und alle Einträge werden vom Gerät entfernt.', 'Löschen')
        .then(function (ok) {
          if (!ok) return;
          YU.store.deletePlaylist(pl.id).then(function () {
            ui.toast('Playlist gelöscht', 'ok');
            YU.router.navigate('playlists');
          });
        });
    });

    container.querySelector('#pl-play').addEventListener('click', function () {
      if (!items.length) return;
      YU.router.navigate('watch/' + items[0].videoId);
    });

    // Zeilen
    container.querySelectorAll('.pl-item[data-video]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        YU.router.navigate('watch/' + row.dataset.video);
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') YU.router.navigate('watch/' + row.dataset.video);
      });
    });
    container.querySelectorAll('[data-pl-remove]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        YU.store.removeFromPlaylist(pl.id, b.dataset.plRemove).then(function () {
          ui.toast('Video entfernt');
          YU.router.refresh();
        });
      });
    });
    container.querySelectorAll('[data-move]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var dir = b.dataset.move === 'up' ? -1 : 1;
        YU.store.movePlaylistItem(pl.id, b.dataset.id, dir).then(function () {
          YU.router.refresh();
        });
      });
    });
  }

  /* ---------- YouTube-Playlist (aus Suchergebnissen) ---------- */
  function renderYtPlaylist(container, ctx) {
    var id = ctx.params.id;
    container.innerHTML = '<div class="page-enter">' + ui.loadingBlock('Playlist wird geladen…') + '</div>';

    YU.api.getPlaylist(id).then(function (pl) {
      var ytLink = '<a class="btn btn--ghost" href="https://www.youtube.com/playlist?list=' + esc(id) +
        '" target="_blank" rel="noopener">Auf YouTube öffnen</a>';

      if (!pl.itemsAvailable || !(pl.videos || []).length) {
        container.innerHTML =
          '<div class="page-enter">' +
            '<div class="plhead">' +
              '<div class="plhead__art">' + (pl.thumbnail
                ? '<img alt="" src="' + esc(pl.thumbnail) + '" />'
                : '<svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.4"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="16" cy="19" r="2.2"/></svg>') + '</div>' +
              '<div class="plhead__text"><span class="kicker">YouTube-Playlist</span>' +
              '<h1>' + esc(pl.name || '(Playlist)') + '</h1>' +
              '<p class="pl-meta">' + (pl.videoCount ? esc(fmt.compact(pl.videoCount)) + ' Videos' : '') +
              (pl.uploader ? ' · ' + esc(pl.uploader) : '') + '</p></div>' +
            '</div>' +
            '<div class="pl-actions">' + ytLink + '</div>' +
            '<div class="note-card">' + ui.icons.warn +
              '<div><b>Die Playlist-Inhalte können mit der keyless-Quelle nicht geladen werden.</b><br>' +
              'Die verfügbaren Instanzen liefern für diese Playlist keine Einzelvideos. ' +
              'Mit einem eigenen API-Schlüssel (Einstellungen) würden die Videos hier erscheinen.</div></div>' +
          '</div>';
        return;
      }

      var videos = pl.videos;
      container.innerHTML =
        '<div class="page-enter">' +
          '<div class="plhead">' +
            '<div class="plhead__art">' + (pl.thumbnail
              ? '<img alt="" src="' + esc(pl.thumbnail) + '" />'
              : (videos[0] && videos[0].thumbnail ? '<img alt="" src="' + esc(videos[0].thumbnail) + '" />' : '')) + '</div>' +
            '<div class="plhead__text"><span class="kicker">YouTube-Playlist</span>' +
            '<h1>' + esc(pl.name || '(Playlist)') + '</h1>' +
            '<p class="pl-meta">' + videos.length + ' von ' + (pl.videoCount ? esc(fmt.compact(pl.videoCount)) : '?') +
            ' Videos geladen' + (pl.uploader ? ' · ' + esc(pl.uploader) : '') + '</p></div>' +
          '</div>' +
          '<div class="pl-actions">' +
            '<button class="play-fab" type="button" id="ytpl-play" aria-label="Erstes Video abspielen">' +
            '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></button>' +
            ytLink +
          '</div>' +
          '<div class="rowlist" id="ytpl-list">' +
            videos.map(function (v, i) {
              return ui.listRow(v, { dateLabel: '' }).replace('<div class="vrow"',
                '<div class="vrow" data-idx="' + i + '"');
            }).join('') +
          '</div>' +
        '</div>';

      container.querySelector('#ytpl-play').addEventListener('click', function () {
        YU.router.navigate('watch/' + videos[0].id);
      });
      container.querySelectorAll('#ytpl-list .vrow[data-video]').forEach(function (row) {
        row.addEventListener('click', function () {
          YU.router.navigate('watch/' + row.dataset.video);
        });
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') YU.router.navigate('watch/' + row.dataset.video);
        });
      });
    }).catch(function (err) {
      container.innerHTML = ui.emptyState(
        ui.icons.warn, 'Playlist konnte nicht geladen werden',
        (err && err.message) || 'Die Datenquelle hat die Playlist nicht geliefert.',
        '<a class="btn" href="https://www.youtube.com/playlist?list=' + esc(id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>'
      );
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.playlists = { render: render };
  YU.pages.playlistDetail = { render: renderDetail };
  YU.pages.ytplaylist = { render: renderYtPlaylist };
})(window.YU = window.YU || {});
