/* ============================================================
 * YouTube Ultra – Verlauf
 * Datum-Gruppen, Thumbnail/Titel/Kanal, Einzelentfernung,
 * Gesamtlöschen, Wiedergabefortschritt & „Fortsetzen“.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  function render(container) {
    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head">' +
          '<div><h1 class="page-title">Verlauf</h1>' +
          '<p class="page-sub">Gespeichert lokal in deinem Browser (IndexedDB) – niemals auf einem Server.</p></div>' +
          '<div style="display:flex;gap:9px">' +
            '<button class="btn btn--soft btn--sm" type="button" id="hist-search">Verlauf durchsuchen</button>' +
            '<button class="btn btn--danger btn--sm" type="button" id="hist-clear">Verlauf löschen</button>' +
          '</div>' +
        '</div>' +
        '<div id="hist-searchbox" hidden style="margin-bottom:14px">' +
          '<input class="field" id="hist-q" type="search" placeholder="Verlauf durchsuchen…" aria-label="Verlauf durchsuchen" />' +
        '</div>' +
        '<div id="hist-body">' + ui.skeletonRows(8) + '</div>' +
      '</div>';

    var filter = '';
    container.querySelector('#hist-search').addEventListener('click', function () {
      var box = container.querySelector('#hist-searchbox');
      box.hidden = !box.hidden;
      if (!box.hidden) container.querySelector('#hist-q').focus();
      else { filter = ''; paint(container, null); }
    });
    container.querySelector('#hist-q').addEventListener('input', fmt.debounce(function (e) {
      filter = e.target.value.toLowerCase();
      paint(container, null);
    }, 200));

    container.querySelector('#hist-clear').addEventListener('click', function () {
      ui.confirmModal('Verlauf wirklich löschen?',
        'Alle gespeicherten Wiedergaben (inkl. Fortschritt) werden von diesem Gerät entfernt. ' +
        'Das lässt sich nicht rückgängig machen.', 'Alles löschen')
        .then(function (ok) {
          if (!ok) return;
          YU.store.clearHistory().then(function () {
            ui.toast('Verlauf gelöscht', 'ok');
            YU.router.refresh();
          });
        });
    });

    paint(container, null);
  }

  var cached = null;

  function paint(container, rowsPromise) {
    var body = container.querySelector('#hist-body');
    var p = rowsPromise || (cached && !container.querySelector('#hist-q').value ? Promise.resolve(cached)
      : YU.store.listHistory());

    p.then(function (rows) {
      if (rowsPromise === null) cached = rows;
      var filter = (container.querySelector('#hist-q').value || '').toLowerCase();
      if (filter) {
        rows = rows.filter(function (r) {
          return (r.title || '').toLowerCase().indexOf(filter) !== -1 ||
            (r.channelName || '').toLowerCase().indexOf(filter) !== -1;
        });
      }

      if (!rows.length) {
        body.innerHTML = ui.emptyState(
          ui.icons.history,
          filter ? 'Nichts gefunden' : 'Noch kein Verlauf',
          filter ? 'Keine Einträge passen zu diesem Filter.' :
            'Videos, die du ansiehst, erscheinen hier – mit Datum, Fortschritt und der Möglichkeit, einzelne Einträge zu löschen.',
          '<a class="btn" href="#/home">Zur Startseite</a>'
        );
        return;
      }

      var groups = [];
      var lastDay = '';
      rows.forEach(function (r) {
        var day = fmt.dayKey(r.watchedAt);
        if (day !== lastDay) {
          groups.push({ day: day, items: [] });
          lastDay = day;
        }
        groups[groups.length - 1].items.push(r);
      });

      var html = '';
      groups.forEach(function (g) {
        html += '<div class="date-divider">' + esc(g.day) + '</div><div class="rowlist">';
        g.items.forEach(function (r) {
          html += ui.listRow(r, {
            showProgress: true,
            showWatched: true,
            dateLabel: fmt.dateTime(r.watchedAt),
            actions: '' +
              '<button class="iconbtn" type="button" data-resume="' + esc(r.id) + '" title="Fortsetzen" aria-label="Fortsetzen" style="width:34px;height:34px">' +
              '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></button>' +
              '<button class="iconbtn" type="button" data-remove="' + esc(r.id) + '" title="Aus Verlauf entfernen" aria-label="Aus Verlauf entfernen" style="width:34px;height:34px">' +
              '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg></button>'
          });
        });
        html += '</div>';
      });
      body.innerHTML = html;
      wire(body, rows);
    }).catch(function () {
      body.innerHTML = ui.emptyState(ui.icons.warn, 'Verlauf nicht verfügbar',
        'Der lokale Speicher (IndexedDB) konnte nicht geöffnet werden. ' +
        'Prüfe, ob die Seite im Privatmodus läuft oder der Browser Speicher blockiert.');
    });
  }

  function wire(body, rows) {
    body.querySelectorAll('.vrow[data-video]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('[data-remove]') || e.target.closest('[data-resume]')) return;
        var r = rows.filter(function (x) { return x.id === row.dataset.video; })[0];
        if (!r) return;
        YU.router.navigate('watch/' + r.id);
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') YU.router.navigate('watch/' + row.dataset.video);
      });
    });
    body.querySelectorAll('[data-resume]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        YU.router.navigate('watch/' + b.dataset.resume);
      });
    });
    body.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        YU.store.removeHistory(b.dataset.remove).then(function () {
          ui.toast('Eintrag entfernt');
          var row = b.closest('.vrow');
          if (row) { row.style.opacity = '0'; setTimeout(function () { row.remove(); }, 200); }
        });
      });
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.history = { render: render };
})(window.YU = window.YU || {});
