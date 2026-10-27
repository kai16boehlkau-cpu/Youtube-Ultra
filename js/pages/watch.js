/* ============================================================
 * YouTube Ultra – Watch-Seite
 * Offizieller IFrame-Player, Fortschritt/Wiedergabe, Titel,
 * Metadaten, Beschreibung, Aktionen (Like, Später, Abo),
 * verwandte Videos, ehrlicher Fallback bei Einbettungs-Fehlern.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  var current = null;        // geladenes Video
  var relatedCache = [];

  function render(container, ctx) {
    var id = ctx.params.id;
    if (!id) { YU.router.navigate('home'); return; }

    container.innerHTML = '<div class="page-enter">' + ui.loadingBlock('Video wird geladen…') + '</div>';

    Promise.all([
      YU.api.getVideo(id),
      YU.store.getHistoryEntry(id).catch(function () { return null; }),
      YU.reco.isLiked(id),
      YU.reco.isSubscribed('')
    ]).then(function (res) {
      var data = res[0];
      var history = res[1];
      var liked = res[2];
      current = data.video;
      current.id = id;
      relatedCache = data.related || [];

      draw(container, current, history, liked, data);
    }).catch(function (err) {
      container.innerHTML = ui.emptyState(
        ui.icons.warn,
        'Video konnte nicht geladen werden',
        (err && err.message ? err.message + ' ' : '') +
        'Entweder ist die Datenquelle gerade nicht erreichbar, oder die Video-ID ist ungültig.',
        '<div style="display:flex;gap:10px"><button class="btn" type="button" onclick="YU.router.refresh()">Erneut versuchen</button>' +
        '<a class="btn btn--ghost" href="https://www.youtube.com/watch?v=' + esc(id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a></div>'
      );
    });
  }

  function draw(container, video, history, liked, data) {
    var isDemo = video.id.indexOf('demo-') === 0;
    var startSeconds = history && history.progress > 10 && video.duration &&
      history.progress < video.duration - 20 ? history.progress : 0;

    var subHtml = '<span class="w-subs" id="sub-count"></span>';

    container.innerHTML =
      '<div class="page-enter watch">' +
        '<div class="watch__main">' +
          '<div class="player-shell" id="player-shell">' +
            (isDemo
              ? '<div class="player-fallback"><b>Beispieldaten</b>' +
                '<p>Dies ist ein Beispiel-Eintrag ohne echte Video-ID – hier kann nichts abgespielt werden. ' +
                'Echte Videos werden über den offiziellen YouTube-Player eingebettet.</p></div>'
              : '<div id="yt-player"></div>') +
          '</div>' +

          '<h1 class="watch__title">' + esc(video.title) + '</h1>' +

          '<div class="watch__bar">' +
            '<div class="watch__channel">' +
              (video.channelAvatar
                ? '<img alt="" src="' + esc(video.channelAvatar) + '" />'
                : '<span class="ph" id="ch-ph">' + esc(fmt.initial(video.channelName)) + '</span>') +
              '<div>' +
                '<div class="w-name">' +
                  (video.channelId
                    ? '<a href="#/channel/' + esc(video.channelId) + '">' + esc(video.channelName) + '</a>'
                    : '<span>' + esc(video.channelName) + '</span>') +
                  (video.verified ? '<span title="Verifiziert">✓</span>' : '') +
                '</div>' + subHtml +
              '</div>' +
              (video.channelId ? '<button class="pill" type="button" id="btn-sub" style="margin-left:10px">Abonnieren</button>' : '') +
            '</div>' +
            '<div class="watch__actions">' +
              '<button class="pill' + (liked ? ' is-active' : '') + '" type="button" id="btn-like" aria-pressed="' + !!liked + '">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg>' +
                '<span id="like-label">' + (liked ? 'Gefällt mir' : 'Gefällt mir') + '</span></button>' +
              '<button class="pill" type="button" id="btn-later">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 1.5"/></svg>' +
                'Später ansehen</button>' +
              '<button class="pill" type="button" id="btn-share">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12v7h16v-7"/><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5"/></svg>' +
                'Teilen</button>' +
              '<button class="pill" type="button" id="btn-open-yt">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13.5V19H5V6h5.5"/></svg>' +
                'Auf YouTube</button>' +
            '</div>' +
          '</div>' +

          '<p class="watch__stats" id="watch-stats"></p>' +

          '<div class="watch__desc">' +
            '<div class="desc-meta" id="desc-meta"></div>' +
            '<div class="desc-body" id="desc-body"></div>' +
            '<button class="desc-more" type="button" id="desc-more" hidden>Mehr anzeigen</button>' +
          '</div>' +

          '<div class="section-head"><h2>Kommentare & interaktive Elemente</h2></div>' +
          '<div class="note-card">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8.5v.2"/></svg>' +
            '<div>Kommentare werden bewusst <b>nicht geladen</b>: Die keyless-Quellen liefern keine Kommentare, ' +
            'und ohne eigenen API-Schlüssel gibt es dafür keine offizielle, CORS-fähige Quelle. ' +
            'Auf YouTube findest du sie direkt über „Auf YouTube“.</div>' +
          '</div>' +
        '</div>' +

        '<aside class="watch__side">' +
          '<div class="side-title">Verwandte Videos</div>' +
          '<div id="related-list">' + ui.skeletonRows(8) + '</div>' +
          '<div class="load-more" id="related-more-wrap" hidden>' +
            '<button class="btn btn--ghost" type="button" id="related-more">Mehr verwandte Videos laden</button></div>' +
        '</aside>' +
      '</div>';

    /* ---------- Metadaten ---------- */
    var stats = container.querySelector('#watch-stats');
    var statBits = [];
    if (video.views) statBits.push(fmt.views(video.views));
    if (video.uploaded) statBits.push(fmt.relTime(video.uploaded));
    else if (video.uploadedLabel) statBits.push(video.uploadedLabel);
    if (video.likes) statBits.push(fmt.compact(video.likes) + ' Likes');
    statBits.push('Quelle: ' + sourceLabel(data.source || video.source));
    stats.innerHTML = statBits.map(esc).join(' · ') +
      (startSeconds ? ' · <span style="color:var(--accent)">Fortsetzen bei ' + esc(fmt.duration(startSeconds)) + '</span>' : '');

    var descMeta = container.querySelector('#desc-meta');
    var bits = [];
    if (video.duration) bits.push('Dauer: ' + fmt.duration(video.duration));
    if (video.category) bits.push('Kategorie: ' + video.category);
    descMeta.innerHTML = bits.map(esc).join(' · ');

    var body = container.querySelector('#desc-body');
    var text = video.description || 'Keine Beschreibung von der Datenquelle geliefert.';
    body.textContent = text;
    var moreBtn = container.querySelector('#desc-more');
    if (text.length > 280) {
      moreBtn.hidden = false;
      moreBtn.addEventListener('click', function () {
        var open = body.classList.toggle('is-open');
        moreBtn.textContent = open ? 'Weniger anzeigen' : 'Mehr anzeigen';
      });
    }

    /* ---------- Aktionen ---------- */
    var likeBtn = container.querySelector('#btn-like');
    likeBtn.addEventListener('click', function () {
      var isActive = likeBtn.classList.contains('is-active');
      var p = isActive ? YU.reco.unlike(video.id) : YU.reco.trackLike(video);
      p.then(function () {
        likeBtn.classList.toggle('is-active', !isActive);
        likeBtn.setAttribute('aria-pressed', String(!isActive));
        ui.toast(isActive ? 'Like entfernt' : 'Gefällt mir gespeichert', isActive ? '' : 'ok');
      });
    });

    var laterBtn = container.querySelector('#btn-later');
    laterBtn.addEventListener('click', function () {
      YU.store.addLater(video).then(function () {
        ui.toast('Zu „Später ansehen“ hinzugefügt', 'ok');
      }).catch(function () { ui.toast('Speichern fehlgeschlagen', 'err'); });
    });

    container.querySelector('#btn-share').addEventListener('click', function () {
      var url = 'https://www.youtube.com/watch?v=' + video.id;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          ui.toast('Link kopiert: ' + url, 'ok');
        }).catch(function () { ui.toast(url); });
      } else {
        ui.toast(url);
      }
    });

    container.querySelector('#btn-open-yt').addEventListener('click', function () {
      if (isDemo) { ui.toast('Beispieldaten haben keinen echten Link.', 'err'); return; }
      window.open('https://www.youtube.com/watch?v=' + video.id, '_blank', 'noopener');
    });

    var subBtn = container.querySelector('#btn-sub');
    if (subBtn && video.channelId) {
      YU.reco.isSubscribed(video.channelId).then(function (isSub) {
        setSubBtn(subBtn, isSub);
      });
      subBtn.addEventListener('click', function () {
        var isSub = subBtn.classList.contains('is-active');
        var p = isSub
          ? YU.reco.unsubscribe(video.channelId)
          : YU.reco.trackSubscribe({ id: video.channelId, name: video.channelName, avatar: video.channelAvatar });
        p.then(function () {
          setSubBtn(subBtn, !isSub);
          ui.toast(isSub ? 'Kanal nicht mehr abonniert' : 'Kanal abonniert', isSub ? '' : 'ok');
        });
      });
    }

    // Abonnentenanzahl (Kanal-Metadaten, wenn verfügbar)
    if (video.channelId) {
      YU.api.getChannel(video.channelId).then(function (ch) {
        var el = container.querySelector('#sub-count');
        if (el && ch && ch.subscribers) el.textContent = fmt.subsLabel(ch.subscribers);
        var ph = container.querySelector('#ch-ph');
        if (ph && ch && ch.avatar) {
          var img = document.createElement('img');
          img.alt = ''; img.src = ch.avatar;
          img.style.cssText = 'width:42px;height:42px;border-radius:50%;object-fit:cover;background:var(--card-2)';
          ph.replaceWith(img);
        }
      }).catch(function () { /* Kanal-Metadaten optional */ });
    }

    /* ---------- Verwandte Videos ---------- */
    loadRelated(container, relatedCache, video);

    /* ---------- Player ---------- */
    if (!isDemo) {
      var shell = container.querySelector('#player-shell');
      YU.player.mount('yt-player', video, {
        startSeconds: startSeconds,
        onEnded: function () {
          // Nächstes verwandtes Video automatisch starten (wie YouTube)
          var next = relatedCache.filter(function (v) { return v && v.id && v.id.indexOf('demo-') !== 0; })[0];
          if (next) {
            ui.toast('Nächstes Video: ' + next.title);
            YU.router.navigate('watch/' + next.id);
          } else {
            ui.toast('Video beendet – keine weiteren Vorschläge verfügbar.');
          }
        },
        onError: function (e) {
          showPlayerFallback(shell, video, e);
        }
      }).catch(function (err) {
        showPlayerFallback(shell, video, {
          code: 'load',
          message: 'Der offizielle YouTube-Player konnte nicht geladen werden (' +
            (err && err.message || 'unbekannter Fehler') + ').'
        });
      });
    }

    /* ---------- Verlauf: Watch-Start tracken ---------- */
    if (!isDemo) {
      YU.reco.trackWatchStart(video);
    }
  }

  function setSubBtn(btn, isSub) {
    btn.classList.toggle('is-active', isSub);
    btn.textContent = isSub ? 'Abonniert' : 'Abonnieren';
  }

  function sourceLabel(src) {
    switch (src) {
      case 'official': return 'offizielle YouTube Data API';
      case 'piped': return 'Piped (keyless)';
      case 'oembed': return 'YouTube oEmbed (eingeschränkt)';
      case 'demo': return 'BEISPIELDATEN';
      default: return src || 'unbekannt';
    }
  }

  function showPlayerFallback(shell, video, err) {
    if (!shell) return;
    var code = err && err.code;
    var message = (err && err.message) ||
      (typeof err === 'string' ? err : null) ||
      'Der Eigentümer hat die Einbettung nicht erlaubt oder das Video ist nicht verfügbar.';

    // Per Doppelklick (file://) geöffnet: Einbettung grundsätzlich nicht möglich.
    if (code === 'fileorigin') { renderFilePanel(shell, video); return; }

    shell.innerHTML = '<div class="player-fallback">' +
      '<b>Dieses Video kann hier nicht abgespielt werden</b>' +
      '<p>' + esc(message) + '</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' +
      '<a class="btn" href="https://www.youtube.com/watch?v=' + esc(video.id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>' +
      '<button class="btn btn--ghost" type="button" id="retry-embed">Erneut versuchen</button>' +
      '</div></div>';
    var retry = shell.querySelector('#retry-embed');
    if (retry) retry.addEventListener('click', function () { YU.router.refresh(); });
  }

  /** Klare, hilfreiche Anleitung, wenn die App per Doppelklick (file://) läuft
   *  und YouTube deshalb das Einbetten mit Code 153 ablehnt. */
  function renderFilePanel(shell, video) {
    var cmd = 'py -m http.server 8080';
    shell.innerHTML = '<div class="player-fallback player-fallback--file">' +
      '<b>Video-Abspielung braucht einen lokalen Server</b>' +
      '<p>Du hast die App per <b>Doppelklick</b> (<span class="yu-code">file://</span>) geöffnet. ' +
      'Ohne eine <span class="yu-code">http://</span>-Herkunft erlaubt YouTube das Einbetten aus Sicherheitsgründen nicht – ' +
      'deshalb kam <b>Code 153</b>. Suche, Thumbnails, Empfehlungen, Verlauf und Einstellungen laufen hier aber normal weiter.</p>' +
      '<p><b>So spielst du Videos ab:</b></p>' +
      '<ol>' +
        '<li>Öffne im Ordner <span class="yu-code">youtube</span> die Datei <b>start-server.bat</b> per Doppelklick – ' +
        'sie startet einen lokalen Server und öffnet die App im Browser.</li>' +
        '<li>Oder starte manuell im Terminal (im Ordner <span class="yu-code">youtube</span>) diesen Befehl und öffne danach die angezeigte Adresse:</li>' +
      '</ol>' +
      '<span class="yu-code">' + esc(cmd) + '</span>' +
      '<div class="file-actions">' +
        '<button class="btn" type="button" id="copy-cmd">Befehl kopieren</button>' +
        '<a class="btn btn--ghost" href="https://www.youtube.com/watch?v=' + esc(video.id) + '" target="_blank" rel="noopener">Auf YouTube öffnen</a>' +
      '</div>' +
    '</div>';

    var copy = shell.querySelector('#copy-cmd');
    if (copy) copy.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(function () {
          ui.toast('Befehl kopiert – füge ihn im Terminal ein.', 'ok');
        }).catch(function () { ui.toast('Kopieren blockiert – notiere: ' + cmd); });
      } else {
        ui.toast('Kopieren nicht möglich – notiere: ' + cmd);
      }
    });
  }

  function loadRelated(container, related, video) {
    var list = container.querySelector('#related-list');
    if (!list) return;

    function paint(items, rest) {
      if (!items.length) {
        // Fallback: thematische Suche, wenn die Quelle keine Verwandten liefert
        list.innerHTML = ui.emptyState(ui.icons.search, 'Keine verwandten Videos',
          'Die Datenquelle hat keine „verwandten Videos“ geliefert. Du kannst eine Suche starten:');
        return;
      }
      list.innerHTML = items.map(function (v) { return ui.miniRow(v, { reason: true }); }).join('');
      wireRelated(container, items);
      var wrap = container.querySelector('#related-more-wrap');
      if (wrap && rest && rest.length) {
        wrap.hidden = false;
        var btn = container.querySelector('#related-more');
        btn.onclick = function () {
          var all = items.concat(rest);
          list.innerHTML = all.map(function (v) { return ui.miniRow(v, { reason: true }); }).join('');
          wireRelated(container, all);
          wrap.hidden = true;
        };
      }
    }

    if (related && related.length) {
      paint(related.slice(0, 14), related.slice(14));
    } else {
      // Fallback 1: thematische Suche
      var q = YU.api.pickTopicQuery((video.title || '') + ' ' + (video.channelName || ''));
      YU.api.search(q, { maxResults: 18 }).then(function (r) {
        var vids = (r.videos || []).filter(function (v) { return v.id !== video.id; });
        paint(YU.reco ? vids.slice(0, 14) : vids.slice(0, 14), vids.slice(14));
      }).catch(function () {
        list.innerHTML = ui.emptyState(ui.icons.wifi, 'Keine Empfehlungen verfügbar',
          'Es konnten gerade keine verwandten Videos geladen werden.');
      });
    }
  }

  function wireRelated(container, items) {
    container.querySelectorAll('#related-list .mini[data-video]').forEach(function (row) {
      var v = items.filter(function (x) { return x.id === row.dataset.video; })[0];
      row.addEventListener('click', function () {
        if (!v) return;
        YU.router.navigate('watch/' + v.id);
      });
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && v) YU.router.navigate('watch/' + v.id);
      });
    });
  }

  /** Aufräumen beim Verlassen der Seite */
  function destroy() {
    YU.player.unmount();
    current = null;
    relatedCache = [];
  }

  YU.pages = YU.pages || {};
  YU.pages.watch = { render: render, destroy: destroy };
})(window.YU = window.YU || {});
