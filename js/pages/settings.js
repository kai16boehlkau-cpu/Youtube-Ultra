/* ============================================================
 * YouTube Ultra – Einstellungen
 * Design, Animationen, Verlauf, Datenschutz, Personalisierung,
 * optionale API-Konfiguration, Datenexport/-löschung.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  var ACCENTS = [
    { v: '', label: 'Standard (Schwarzblau)' },
    { v: '#4f8cff', label: 'Blau' },
    { v: '#7c5cff', label: 'Violett' },
    { v: '#2dd4bf', label: 'Türkis' },
    { v: '#4ade80', label: 'Grün' },
    { v: '#ff6b6b', label: 'Koralle' },
    { v: '#f59e0b', label: 'Bernstein' }
  ];

  function toggle(id, checked, label, help) {
    return '<div class="setting-row">' +
      '<div><div class="s-label">' + esc(label) + '</div>' +
      (help ? '<div class="s-help">' + esc(help) + '</div>' : '') + '</div>' +
      '<label class="switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') +
      ' aria-label="' + esc(label) + '" /><span class="track"></span></label>' +
      '</div>';
  }

  function render(container) {
    var s = YU.settings.all();

    container.innerHTML =
      '<div class="page-enter">' +
        '<div class="page-head"><div>' +
          '<h1 class="page-title">Einstellungen</h1>' +
          '<p class="page-sub">Alles wird lokal in diesem Browser gespeichert – kein Konto, kein Server.</p>' +
        '</div></div>' +

        '<div class="settings-grid">' +

          /* ---- Design ---- */
          '<section class="panel"><h2>Design</h2>' +
            '<p class="panel-sub">Akzentfarbe und Darstellung der Oberfläche.</p>' +
            '<div class="setting-row"><div><div class="s-label">Akzentfarbe</div>' +
              '<div class="s-help">Standard bleibt das Schwarzblau-Design.</div></div></div>' +
            '<div class="accent-swatches" style="padding:8px 0 14px">' +
              ACCENTS.map(function (a) {
                var color = a.v || '#050810';
                return '<button class="swatch' + ((s.accent || '') === a.v ? ' is-active' : '') + '" type="button" ' +
                  'data-accent="' + esc(a.v) + '" title="' + esc(a.label) + '" aria-label="' + esc(a.label) + '" ' +
                  'style="background:' + (a.v ? 'linear-gradient(135deg,' + a.v + ',' + a.v + 'aa)' :
                    'linear-gradient(135deg,#0b1220,#16305f)') + '"></button>';
              }).join('') +
            '</div>' +
            toggle('set-glow', s.glowEnabled, 'Maus-Lichtschein',
              'Weiches blaues Glühen, das der Maus folgt. Auf Touch-Geräten statisch und dezent.') +
            toggle('set-glow-strong', (s.glowIntensity || 1) > 1, 'Lichtschein etwas stärker',
              'Erhöht die Sichtbarkeit des Scheins.') +
            toggle('set-reasons', s.showReasons, 'Empfehlungs-Gründe anzeigen',
              'Zeigt Hinweise wie „Passt zu deinen Interessen“ unter Videos.') +
          '</section>' +

          /* ---- Animationen ---- */
          '<section class="panel"><h2>Animationen</h2>' +
            '<p class="panel-sub">Bewegungen und Übergänge in der Oberfläche.</p>' +
            toggle('set-motion', s.reducedMotion, 'Animationen reduzieren',
              'Deaktiviert fast alle Bewegungen. Die Systemeinstellung „Bewegung reduzieren“ wird automatisch übernommen.') +
            '<div class="setting-row"><div><div class="s-label">Vorschau</div>' +
            '<div class="s-help">Der Lichtschein pausiert sofort bei aktivierter Einstellung.</div></div></div>' +
          '</section>' +

          /* ---- Personalisierung ---- */
          '<section class="panel"><h2>Personalisierung</h2>' +
            '<p class="panel-sub">Lokale Empfehlungen: Interessens-Scores aus Klicks, Watch-Time, Likes, Abos und Suchen. ' +
            'Ohne Daten zeigt die Startseite eine neutrale Mischung.</p>' +
            toggle('set-personalization', s.personalization, 'Personalisierung aktiv',
              'Aus: es wird nicht gespeichert und eine neutrale Mischung angezeigt.') +
            '<div class="setting-row"><div><div class="s-label">Empfehlungen zurücksetzen</div>' +
              '<div class="s-help">Löscht alle lokalen Empfehlungs-Signale (Verlauf/Playlists bleiben erhalten).</div></div>' +
              '<button class="btn btn--soft btn--sm" type="button" id="set-reset-reco">Zurücksetzen</button></div>' +
            '<div class="setting-row"><div><div class="s-label">Ausgeblendete Kanäle</div>' +
              '<div class="s-help" id="hidden-count">Wird gezählt…</div></div>' +
              '<button class="btn btn--soft btn--sm" type="button" id="set-unhide">Alle freigeben</button></div>' +
          '</section>' +

          /* ---- Verlauf ---- */
          '<section class="panel"><h2>Verlauf</h2>' +
            '<p class="panel-sub">Wiedergaben werden lokal gespeichert (max. ' + YU.config.historyMax +
            ' Einträge) und speisen die Empfehlungen.</p>' +
            toggle('set-history', s.historyEnabled, 'Verlauf aufzeichnen',
              'Aus: neue Wiedergaben werden nicht gespeichert.') +
            toggle('set-searchhistory', s.searchHistoryEnabled, 'Suchverlauf speichern',
              'Für Vorschläge aus deinen letzten Suchen.') +
            '<div class="setting-row"><div><div class="s-label">Verlauf löschen</div>' +
              '<div class="s-help">Entfernt alle Wiedergaben und Fortschritte von diesem Gerät.</div></div>' +
              '<button class="btn btn--danger btn--sm" type="button" id="set-clear-history">Löschen</button></div>' +
          '</section>' +

          /* ---- Datenschutz ---- */
          '<section class="panel"><h2>Datenschutz & Daten</h2>' +
            '<p class="panel-sub">Was liegt wo? <b>LocalStorage:</b> nur diese Einstellungen (inkl. optionalem API-Schlüssel). ' +
            '<b>IndexedDB:</b> Verlauf, Playlists, Likes, Abos, Suchbegriffe, Empfehlungs-Signale. ' +
            'Nichts davon verlässt dein Gerät – es gibt keinen eigenen Server der App.</p>' +
            '<div class="setting-row"><div><div class="s-label">Meine Daten exportieren</div>' +
              '<div class="s-help">JSON-Datei mit allen lokal gespeicherten Daten.</div></div>' +
              '<button class="btn btn--soft btn--sm" type="button" id="set-export">Exportieren</button></div>' +
            '<div class="setting-row"><div><div class="s-label">Alle Daten löschen</div>' +
              '<div class="s-help">Entfernt IndexedDB-Inhalte und setzt Einstellungen zurück.</div></div>' +
              '<button class="btn btn--danger btn--sm" type="button" id="set-wipe">Alles löschen</button></div>' +
          '</section>' +

          /* ---- API & Datenquellen ---- */
          '<section class="panel"><h2>API & Datenquellen</h2>' +
            '<p class="panel-sub">Standard: keyless-Modus über öffentliche, CORS-fähige Piped-Instanzen ' +
            '(kein Schlüssel nötig, begrenzte Stabilität/Reichweite). Optional: eigener Schlüssel der ' +
            'offiziellen YouTube Data API v3 – <b>bleibt ausschließlich lokal</b> in deinem Browser.</p>' +
            '<div class="setting-row"><div style="flex:1"><div class="s-label">Eigener YouTube-API-Schlüssel</div>' +
              '<div class="s-help">Google Cloud Console → YouTube Data API v3 aktivieren → Schlüssel kopieren. ' +
              'Wird nie an Dritte weitergegeben, nur an googleapis.com gesendet. Quota-Hinweis: Suchen kosten ' +
              '100 Einheiten je Anfrage (Standard-Kontingent 10.000/Tag).</div></div></div>' +
            '<div style="display:flex;gap:9px;padding-top:8px;flex-wrap:wrap">' +
              '<input class="field" id="set-apikey" type="password" style="flex:1;min-width:200px" ' +
                'placeholder="AIza…" value="' + esc(s.apiKey || '') + '" autocomplete="off" spellcheck="false" ' +
                'aria-label="YouTube-API-Schlüssel" />' +
              '<button class="btn" type="button" id="set-apikey-save">Speichern</button>' +
              '<button class="btn btn--ghost" type="button" id="set-apikey-clear">Entfernen</button>' +
            '</div>' +
            '<div class="setting-row" style="margin-top:14px"><div><div class="s-label">Datenquellen-Status</div>' +
              '<div class="s-help" id="src-status">Wird geprüft…</div></div>' +
              '<button class="btn btn--soft btn--sm" type="button" id="src-test">Prüfen</button></div>' +
            '<div class="setting-row"><div><div class="s-label">Quota (seit App-Start)</div>' +
              '<div class="s-help" id="quota-line">Nur relevant mit eigenem Schlüssel.</div></div></div>' +
          '</section>' +

          /* ---- Über ---- */
          '<section class="panel"><h2>Über & Grenzen</h2>' +
            '<p class="panel-sub">YouTube Ultra ist eine reine HTML/CSS/JS-App ohne Backend. ' +
            'Wiedergabe über den <b>offiziellen YouTube-IFrame-Player</b> (von YouTube gestellt). ' +
            'Wer die Einbettung eines Videos deaktiviert, sieht einen klaren Hinweis mit „Auf YouTube öffnen“. ' +
            'Kommentare, Live-Daten und Uploads sind bewusst nicht enthalten (kein eigener Server, keine Anmeldung). ' +
            'Es werden keine Werbung eingeblendet und keine YouTube-Bedingungen umgangen – ' +
            'die App greift nur auf öffentlich erreichbare, CORS-fähige Endpunkte zu.</p>' +
            '<div class="setting-row"><div><div class="s-label">Version</div>' +
              '<div class="s-help">YouTube Ultra · statische HTML-App · 1.0</div></div></div>' +
          '</section>' +

        '</div>' +
      '</div>';

    wire(container);
  }

  function wire(container) {
    /* Design */
    container.querySelectorAll('[data-accent]').forEach(function (b) {
      b.addEventListener('click', function () {
        YU.settings.set('accent', b.dataset.accent);
        container.querySelectorAll('[data-accent]').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        ui.toast('Akzentfarbe gespeichert', 'ok');
      });
    });

    bindToggle(container, 'set-glow', 'glowEnabled');
    bindToggle(container, 'set-reasons', 'showReasons');
    bindToggle(container, 'set-motion', 'reducedMotion');
    bindToggle(container, 'set-personalization', 'personalization', function () {
      YU.reco.invalidate();
    });
    bindToggle(container, 'set-history', 'historyEnabled');
    bindToggle(container, 'set-searchhistory', 'searchHistoryEnabled');

    var glowStrong = container.querySelector('#set-glow-strong');
    glowStrong.checked = (YU.settings.get('glowIntensity') || 1) > 1;
    glowStrong.addEventListener('change', function () {
      YU.settings.set('glowIntensity', glowStrong.checked ? 1.4 : 1);
      YU.settings.applyDom();
    });

    /* Personalisierung */
    container.querySelector('#set-reset-reco').addEventListener('click', function () {
      ui.confirmModal('Empfehlungen zurücksetzen?',
        'Alle Signale für die lokalen Empfehlungen werden gelöscht. Verlauf, Playlists, Likes und Abos bleiben erhalten.',
        'Zurücksetzen').then(function (ok) {
        if (!ok) return;
        YU.reco.reset().then(function () {
          ui.toast('Empfehlungen zurückgesetzt', 'ok');
          updateHiddenCount(container);
        });
      });
    });

    container.querySelector('#set-unhide').addEventListener('click', function () {
      YU.db.clear('hiddenChannels').then(function () {
        YU.reco.invalidate();
        ui.toast('Alle Kanäle wieder freigegeben', 'ok');
        updateHiddenCount(container);
      });
    });
    updateHiddenCount(container);

    /* Verlauf */
    container.querySelector('#set-clear-history').addEventListener('click', function () {
      ui.confirmModal('Verlauf löschen?',
        'Alle Wiedergaben und Fortschritte werden von diesem Gerät entfernt.', 'Löschen')
        .then(function (ok) {
          if (!ok) return;
          YU.store.clearHistory().then(function () { ui.toast('Verlauf gelöscht', 'ok'); });
        });
    });

    /* Datenschutz */
    container.querySelector('#set-export').addEventListener('click', function () {
      ui.toast('Export wird vorbereitet…');
      Promise.all([
        YU.db.exportAll(),
        Promise.resolve({ settings: YU.settings.all() })
      ]).then(function (res) {
        var data = res[0];
        data.settings = res[1].settings;
        if (data.settings.apiKey) data.settings.apiKey = '***';
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'youtube-ultra-daten-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        ui.toast('Export heruntergeladen', 'ok');
      }).catch(function () {
        ui.toast('Export fehlgeschlagen', 'err');
      });
    });

    container.querySelector('#set-wipe').addEventListener('click', function () {
      ui.confirmModal('Wirklich ALLE Daten löschen?',
        'Verlauf, Playlists, Likes, Abos, Suchverlauf und Empfehlungs-Signale werden entfernt, ' +
        'Einstellungen zurückgesetzt. Das lässt sich nicht rückgängig machen.', 'Alles löschen')
        .then(function (ok) {
          if (!ok) return;
          YU.db.wipeAll().then(function () {
            YU.settings.reset();
            YU.reco.invalidate();
            ui.toast('Alle Daten gelöscht', 'ok');
            YU.router.refresh();
          }).catch(function () {
            ui.toast('Löschen fehlgeschlagen', 'err');
          });
        });
    });

    /* API-Schlüssel */
    container.querySelector('#set-apikey-save').addEventListener('click', function () {
      var val = container.querySelector('#set-apikey').value.trim();
      if (!val) { ui.toast('Kein Schlüssel eingegeben', 'err'); return; }
      if (!/^AIza[\w-]{20,}$/.test(val)) {
        ui.toast('Das sieht nicht nach einem YouTube-API-Schlüssel aus (beginnt mit „AIza“).', 'err');
        return;
      }
      YU.settings.set('apiKey', val);
      ui.toast('Schlüssel lokal gespeichert', 'ok');
      testSources(container);
    });
    container.querySelector('#set-apikey-clear').addEventListener('click', function () {
      YU.settings.set('apiKey', '');
      container.querySelector('#set-apikey').value = '';
      ui.toast('Schlüssel entfernt – keyless-Modus aktiv');
      testSources(container);
    });

    container.querySelector('#src-test').addEventListener('click', function () { testSources(container); });
    testSources(container);

    var quota = container.querySelector('#quota-line');
    if (YU.api.mode() === 'official') {
      quota.textContent = YU.api.quotaUsed() + ' Einheiten seit App-Start (Schätzwert, nur dieser Tab).';
    }
  }

  function bindToggle(container, id, key, after) {
    var el = container.querySelector('#' + id);
    if (!el) return;
    el.addEventListener('change', function () {
      YU.settings.set(key, el.checked);
      if (after) after(el.checked);
    });
  }

  function updateHiddenCount(container) {
    var el = container.querySelector('#hidden-count');
    if (!el) return;
    YU.db.all('hiddenChannels').then(function (rows) {
      el.textContent = rows.length
        ? rows.length + ' Kanal/Kanäle werden nicht empfohlen'
        : 'Keine Kanäle ausgeblendet';
    }).catch(function () { el.textContent = 'Nicht verfügbar'; });
  }

  function testSources(container) {
    var el = container.querySelector('#src-status');
    if (!el) return;
    el.textContent = 'Verbindung wird geprüft…';
    YU.api.status().then(function (st) {
      el.innerHTML = (st.ok ? '<b style="color:var(--ok)">✓ </b>' : '<b style="color:var(--danger)">✗ </b>') +
        esc(st.label) + ' – ' + esc(st.detail);
      var note = document.getElementById('source-note');
      if (note) {
        note.innerHTML = st.ok
          ? 'Datenquelle: <b>' + esc(st.label) + '</b>'
          : '<b>Keine Datenquelle erreichbar</b> – Inhalte ggf. nicht ladbar.';
      }
    }).catch(function () {
      el.textContent = 'Prüfung fehlgeschlagen (Netzwerk?).';
    });
  }

  YU.pages = YU.pages || {};
  YU.pages.settings = { render: render };
})(window.YU = window.YU || {});
