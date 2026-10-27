/* ============================================================
 * YouTube Ultra – Kanalseite
 * Banner, Avatar, Abonnenten, Beschreibung, Tabs (Videos /
 * Playlists / Über), Abo-Button, ehrliche Hinweise bei Quell-
 * limits.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  function render(container, ctx) {
    var id = ctx.params.id;
    var tab = (ctx.query && ctx.query.tab) || 'videos';
    if (!id) { YU.router.navigate('home'); return; }

    container.innerHTML = '<div class="page-enter">' + ui.loadingBlock('Kanal wird geladen…') + '</div>';

    Promise.all([
      YU.api.getChannel(id).catch(function (e) { return null; }),
      tab === 'videos' ? YU.api.getChannelVideos(id, 24).catch(function () { return null; }) : Promise.resolve(null),
      YU.reco.isSubscribed(id)
    ]).then(function (res) {
      var ch = res[0];
      var videos = res[1];
      var isSub = res[2];

      if (!ch && !videos) {
        container.innerHTML = ui.emptyState(
          ui.icons.warn, 'Kanal nicht verfügbar',
          'Die Datenquelle hat diesen Kanal nicht liefern können. Das liegt an den Grenzen ' +
          'der keyless-Instanzen (Kanal-Metadaten/Videos sind dort nur teilweise verfügbar).',
          '<a class="btn btn--ghost" href="https://www.youtube.com/channel/' + esc(id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>'
        );
        return;
      }

      ch = ch || { id: id, name: '(Kanal)', subscribers: 0 };

      var banner = ch.banner
        ? '<img alt="" src="' + esc(ch.banner) + '" />'
        : '';

      container.innerHTML =
        '<div class="page-enter">' +
          '<div class="channel-head">' +
            '<div class="channel-banner">' + banner + '</div>' +
            '<div class="channel-info">' +
              (ch.avatar
                ? '<img class="c-avatar" alt="" src="' + esc(ch.avatar) + '" />'
                : '<div class="c-avatar" style="display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:var(--dim);background:var(--card-2)">' +
                  esc(fmt.initial(ch.name)) + '</div>') +
              '<div class="c-text">' +
                '<h1>' + esc(ch.name) + (ch.verified ? '<span title="Verifiziert" style="color:var(--accent)">✓</span>' : '') + '</h1>' +
                '<p class="c-meta">' +
                  (ch.subscribers ? esc(fmt.subsLabel(ch.subscribers)) + ' ·' : '') +
                  (videos && videos.length ? videos.length + '+ Videos verfügbar ·' : '') +
                  ' Quelle: ' + esc(ch.source === 'official' ? 'offizielle API' : 'Piped (keyless)') +
                '</p>' +
                (ch.description ? '<p class="c-desc">' + esc(ch.description) + '</p>' : '') +
              '</div>' +
            '</div>' +
            '<div class="channel-actions">' +
              '<button class="btn' + (isSub ? ' btn--ghost' : '') + '" type="button" id="ch-sub">' +
                (isSub ? 'Abonniert ✓' : 'Abonnieren') + '</button>' +
              '<a class="btn btn--ghost" href="https://www.youtube.com/channel/' + esc(id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>' +
            '</div>' +
          '</div>' +

          '<div class="tabs" role="tablist" aria-label="Kanalabschnitte">' +
            tabBtn('videos', 'Videos', tab) +
            tabBtn('playlists', 'Playlists', tab) +
            tabBtn('about', 'Über', tab) +
          '</div>' +
          '<div id="ch-body"></div>' +
        '</div>';

      // Abo
      var subBtn = container.querySelector('#ch-sub');
      subBtn.addEventListener('click', function () {
        var nowSub = subBtn.classList.contains('is-on');
        var p = nowSub ? YU.reco.unsubscribe(id) : YU.reco.trackSubscribe(ch);
        p.then(function () {
          var now = !nowSub;
          subBtn.textContent = now ? 'Abonniert ✓' : 'Abonnieren';
          subBtn.classList.toggle('is-on', now);
          ui.toast(now ? 'Kanal abonniert' : 'Abo gekündigt', now ? 'ok' : '');
        });
      });
      subBtn.classList.toggle('is-on', isSub);

      // Tabs
      container.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          YU.router.navigate('channel/' + id + '?tab=' + b.dataset.tab);
        });
      });

      var body = container.querySelector('#ch-body');

      if (tab === 'videos') {
        if (videos && videos.length) {
          body.innerHTML = '<div class="vgrid" style="margin-top:18px">' +
            videos.map(function (v) { return ui.videoCard(v); }).join('') + '</div>';
          wire(body, videos);
        } else {
          body.innerHTML = ui.emptyState(
            ui.icons.play, 'Keine Videos geladen',
            'Die keyless-Instanz konnte für diesen Kanal keine Videoliste liefern. ' +
            'Mit einem eigenen API-Schlüssel (Einstellungen) werden hier zuverlässig die neuesten Videos angezeigt.',
            '<a class="btn btn--ghost" href="https://www.youtube.com/channel/' + esc(id) + '" target="_blank" rel="noopener">Videos auf YouTube ansehen</a>'
          );
        }
      } else if (tab === 'playlists') {
        body.innerHTML = ui.loadingBlock('Playlists werden geladen…');
        loadChannelPlaylists(body, ch, id);
      } else {
        body.innerHTML =
          '<div class="panel" style="margin-top:18px;max-width:820px">' +
            '<h2>Über diesen Kanal</h2>' +
            '<p class="panel-sub">' + (ch.description ? esc(ch.description) : 'Keine Beschreibung von der Datenquelle geliefert.') + '</p>' +
            '<div class="setting-row"><div><div class="s-label">Kanal-ID</div>' +
            '<div class="s-help" style="font-family:var(--mono)">' + esc(id) + '</div></div></div>' +
            '<div class="setting-row"><div><div class="s-label">Abonnenten</div>' +
            '<div class="s-help">' + (ch.subscribers ? esc(fmt.nf.format(ch.subscribers)) : 'Von der Datenquelle nicht geliefert') + '</div></div></div>' +
            '<div class="setting-row"><div><div class="s-label">Datenquelle</div>' +
            '<div class="s-help">' + (ch.source === 'official'
              ? 'Offizielle YouTube Data API v3 (mit deinem Schlüssel)'
              : 'Öffentliche Piped-Instanz (keyless) – Angaben können unvollständig sein') + '</div></div></div>' +
          '</div>';
      }
    });
  }

  function tabBtn(id, label, active) {
    return '<button class="tab' + (id === active ? ' is-active' : '') + '" type="button" role="tab" ' +
      'aria-selected="' + (id === active) + '" data-tab="' + id + '">' + esc(label) + '</button>';
  }

  function loadChannelPlaylists(body, ch, channelId) {
    // Uploads-Playlist (UU… statt UC…) enthält alle eigenen Videos:
    // über die Playlist-Metadaten-Quelle abfragen.
    var uploadsId = channelId ? 'UU' + channelId.slice(2) : '';
    YU.api.getPlaylist(uploadsId).then(function (pl) {
      var localPls = [];
      return YU.store.listPlaylists().then(function (mine) {
        // Kanal-Playlists von YouTube sind keyless meist ohne Items → ehrlich anzeigen
        var items = pl.videos || [];
        if (items.length) {
          body.innerHTML = '<div class="section-head"><h2>Playlist: ' + esc(pl.name) + '</h2>' +
            '<span class="section-note">' + items.length + ' Videos geladen</span></div>' +
            '<div class="rowlist">' + items.map(function (v) { return ui.listRow(v); }).join('') + '</div>';
          body.querySelectorAll('.vrow[data-video]').forEach(function (row) {
            row.addEventListener('click', function () { YU.router.navigate('watch/' + row.dataset.video); });
          });
        } else {
          body.innerHTML = '<div class="note-card" style="margin-top:18px">' + ui.icons.warn +
            '<div><b>Playlists dieses Kanals sind mit der keyless-Quelle nicht ladbar.</b><br>' +
            'Die Instanzen liefern hier nur Metadaten (Name, Anzahl), aber keine Einzelvideos. ' +
            'Eigene lokale Playlists findest du unter <a href="#/playlists" style="color:var(--accent)">Playlists</a>.</div></div>' +
            '<div class="section-head"><h2>Deine lokalen Playlists</h2></div>';
          if (mine.length) {
            var wrap = document.createElement('div');
            wrap.className = 'entity-grid';
            body.appendChild(wrap);
            mine.forEach(function (p) {
              var el = document.createElement('article');
              el.className = 'entity-card';
              el.tabIndex = 0;
              el.innerHTML = '<div class="ph sq">' + esc(fmt.initial(p.name)) + '</div>' +
                '<h3>' + esc(p.name) + '</h3><p>Lokal gespeichert</p>';
              el.addEventListener('click', function () { YU.router.navigate('playlists/' + p.id); });
              wrap.appendChild(el);
            });
          }
        }
      });
    }).catch(function () {
      body.innerHTML = '<div class="note-card" style="margin-top:18px">' + ui.icons.warn +
        '<div>Die Playlists dieses Kanals konnten nicht geladen werden. ' +
        'Auf YouTube sind sie über den Link oben erreichbar.</div></div>';
    });
  }

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

  YU.pages = YU.pages || {};
  YU.pages.channel = { render: render };
})(window.YU = window.YU || {});
