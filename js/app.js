/* ============================================================
 * YouTube Ultra – App-Bootstrap
 * Startet alle Module, verdrahtet Topbar (Suche, Vorschläge,
 * Sprachsuche, Benachrichtigungen, Profil, „Video erstellen“),
 * Sidebar, Statusanzeige der Datenquelle und Router.
 * ============================================================ */
(function (YU) {
  'use strict';

  var fmt = YU.fmt;
  var ui = YU.ui;
  function esc(s) { return fmt.esc(s); }

  /* ================= Sidebar ================= */
  function initSidebar() {
    var btn = document.getElementById('btn-sidebar');
    var scrim = document.getElementById('sidebar-scrim');

    function isMobile() { return window.matchMedia('(max-width: 900px)').matches; }

    btn.addEventListener('click', function () {
      if (isMobile()) {
        var open = document.body.classList.toggle('sidebar-open');
        scrim.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
      } else {
        var collapsed = document.body.classList.toggle('sidebar-collapsed');
        YU.settings.set('sidebarCollapsed', collapsed);
        btn.setAttribute('aria-expanded', String(!collapsed));
      }
    });

    scrim.addEventListener('click', function () {
      document.body.classList.remove('sidebar-open');
      scrim.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });

    // Sidebar bei Navigation auf Mobil schließen
    document.querySelectorAll('.sidebar .side-link, .bottomnav .bottomnav__link').forEach(function (a) {
      a.addEventListener('click', function () {
        if (isMobile()) {
          document.body.classList.remove('sidebar-open');
          scrim.hidden = true;
        }
      });
    });

    // Bei Größenwechsel Mobil/Desktop aufräumen
    var mq = window.matchMedia('(max-width: 900px)');
    var onChange = function () {
      document.body.classList.remove('sidebar-open');
      scrim.hidden = true;
      if (!mq.matches && YU.settings.get('sidebarCollapsed')) {
        document.body.classList.add('sidebar-collapsed');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ================= Suche ================= */
  var suggestTimer = null;
  var suggestItems = [];
  var suggestActive = -1;

  function initSearch() {
    var form = document.getElementById('search-form');
    var input = document.getElementById('search-input');
    var clear = document.getElementById('btn-clear-search');
    var list = document.getElementById('suggest-list');
    var back = document.getElementById('btn-back-search');

    function closeSuggest() {
      list.hidden = true;
      list.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      suggestItems = [];
      suggestActive = -1;
    }

    function openSuggest(items, fromHistory) {
      if (!items.length) { closeSuggest(); return; }
      suggestItems = items;
      suggestActive = -1;
      list.innerHTML = items.map(function (t, i) {
        return '<li role="option" id="sg-' + i + '" data-term="' + esc(t) + '">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">' +
          (fromHistory
            ? '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
            : '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>') +
          '</svg><span class="suggest__term">' + esc(t) + '</span>' +
          (fromHistory ? '<span class="suggest__meta">Verlauf</span>' : '') +
          '</li>';
      }).join('');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');

      list.querySelectorAll('li').forEach(function (li) {
        li.addEventListener('mousedown', function (e) {
          e.preventDefault();
          input.value = li.dataset.term;
          closeSuggest();
          doSearch(li.dataset.term);
        });
      });
    }

    function fetchSuggestions() {
      var q = input.value.trim();
      if (q.length < 2) {
        // Ohne Eingabe: letzte Suchbegriffe anbieten
        YU.store.listSearchHistory().then(function (rows) {
          if (document.activeElement !== input || rows.length === 0) return;
          if (!list.hidden && suggestItems.length) return;
          openSuggest(rows.slice(0, 8).map(function (r) { return r.term; }), true);
        }).catch(function () {});
        return;
      }
      YU.api.suggest(q).then(function (items) {
        if (document.activeElement !== input || input.value.trim() !== q) return;
        openSuggest((items || []).slice(0, 10), false);
      }).catch(function () { closeSuggest(); });
    }

    function doSearch(term) {
      var q = (term !== undefined ? term : input.value).trim();
      if (!q) { ui.toast('Bitte einen Suchbegriff eingeben', 'err'); input.focus(); return; }
      closeSuggest();
      input.blur();
      YU.reco.trackSearch(q);
      YU.router.navigate('search?q=' + encodeURIComponent(q));
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      doSearch();
    });

    input.addEventListener('input', function () {
      clear.hidden = !input.value;
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(fetchSuggestions, 220);
    });

    input.addEventListener('focus', function () {
      fetchSuggestions();
    });

    input.addEventListener('keydown', function (e) {
      if (list.hidden || !suggestItems.length) {
        if (e.key === 'Escape') { input.blur(); }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        suggestActive += (e.key === 'ArrowDown' ? 1 : -1);
        if (suggestActive < 0) suggestActive = suggestItems.length - 1;
        if (suggestActive >= suggestItems.length) suggestActive = 0;
        list.querySelectorAll('li').forEach(function (li, i) {
          li.classList.toggle('is-active', i === suggestActive);
          if (i === suggestActive) li.scrollIntoView({ block: 'nearest' });
        });
        input.setAttribute('aria-activedescendant', 'sg-' + suggestActive);
      } else if (e.key === 'Enter' && suggestActive >= 0) {
        e.preventDefault();
        input.value = suggestItems[suggestActive];
        closeSuggest();
        doSearch(input.value);
      } else if (e.key === 'Escape') {
        closeSuggest();
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(closeSuggest, 120);
    });

    clear.addEventListener('click', function () {
      input.value = '';
      clear.hidden = true;
      closeSuggest();
      input.focus();
    });

    back.addEventListener('click', function () {
      if (window.history.length > 1) window.history.back();
      else YU.router.navigate('home');
    });

    initVoiceSearch();
  }

  /* ================= Sprachsuche (nur mit Zustimmung) ================= */
  function initVoiceSearch() {
    var btn = document.getElementById('btn-mic');
    var input = document.getElementById('search-input');
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      btn.hidden = false; // sichtbar, aber ehrlich erklärend
      btn.title = 'Sprachsuche ist in diesem Browser nicht verfügbar';
      btn.addEventListener('click', function () {
        ui.toast('Sprachsuche wird von diesem Browser nicht unterstützt.', 'err');
      });
      return;
    }

    btn.hidden = false;
    var rec = null;
    var listening = false;

    btn.addEventListener('click', function () {
      if (listening && rec) { rec.stop(); return; }

      // Explizite Zustimmung: Hinweis vor der Browser-Erlaubnis
      ui.openModal({
        title: 'Sprachsuche starten?',
        desc: 'Der Browser fragt gleich nach dem Mikrofonzugriff. Deine Sprache wird dabei an ' +
          'Google/Browser-Dienst übertragen (der Anbieter der Spracherkennung). ' +
          'Die App selbst speichert nichts davon.',
        input: false,
        confirmLabel: 'Mikrofon erlauben',
        cancelLabel: 'Abbrechen'
      }).then(function (ok) {
        if (!ok) return;
        try {
          rec = new SR();
          rec.lang = 'de-DE';
          rec.interimResults = false;
          rec.maxAlternatives = 1;

          rec.onstart = function () {
            listening = true;
            btn.classList.add('is-listening');
            btn.setAttribute('aria-label', 'Sprachsuche läuft – klicken zum Stoppen');
            ui.toast('Ich höre zu…');
          };
          rec.onresult = function (e) {
            var text = e.results[0][0].transcript;
            input.value = text;
            YU.reco.trackSearch(text);
            YU.router.navigate('search?q=' + encodeURIComponent(text));
          };
          rec.onerror = function (e) {
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
              ui.toast('Mikrofonzugriff abgelehnt – kein Problem, du kannst tippen.', 'err');
            } else if (e.error !== 'aborted') {
              ui.toast('Sprachsuche fehlgeschlagen (' + e.error + ')', 'err');
            }
          };
          rec.onend = function () {
            listening = false;
            btn.classList.remove('is-listening');
            btn.setAttribute('aria-label', 'Sprachsuche');
          };
          rec.start(); // löst die Browser-Erlaubnisfrage aus
        } catch (err) {
          ui.toast('Sprachsuche konnte nicht gestartet werden', 'err');
        }
      });
    });
  }

  /* ================= Benachrichtigungen ================= */
  function buildNotifications(panel) {
    panel.innerHTML = '<div class="popover__title">Benachrichtigungen</div>' +
      '<div class="popover__note">Lokale Hinweise aus deinen Daten – keine Server-Pushes ' +
      '(die App hat keinen eigenen Server).</div>';

    YU.store.listSubs().then(function (subs) {
      if (!subs.length) {
        var none = document.createElement('div');
        none.className = 'popover__note';
        none.textContent = 'Keine Abos – sobald du Kanäle abonnierst, erscheinen hier deren neueste Videos.';
        panel.appendChild(none);
        return;
      }
      // Neueste Videos der abonnierten Kanäle (max. 3 Kanäle für Tempo)
      var top = subs.slice(0, 3);
      var wrap = document.createElement('div');
      wrap.innerHTML = '<div class="popover__title">Neu von deinen Abos</div>';
      panel.appendChild(wrap);

      top.forEach(function (s) {
        YU.api.getChannelVideos(s.channelId, 2).then(function (vids) {
          vids.slice(0, 2).forEach(function (v) {
            var el = document.createElement('div');
            el.className = 'notif-item';
            el.innerHTML =
              (v.thumbnail ? '<img alt="" loading="lazy" src="' + esc(v.thumbnail) + '" />' : '<img alt="" />') +
              '<div style="min-width:0"><div class="n-title">' + esc(v.title) + '</div>' +
              '<div class="n-meta">' + esc(v.channelName) + ' · ' + esc(fmt.relTime(v.uploaded)) + '</div></div>';
            el.addEventListener('click', function () {
              ui.closePopovers();
              YU.router.navigate('watch/' + v.id);
            });
            wrap.appendChild(el);
          });
        }).catch(function () { /* Kanal nicht abrufbar – still überspringen */ });
      });

      var foot = document.createElement('div');
      foot.className = 'popover__note';
      foot.innerHTML = '<a href="#/subs" style="color:var(--accent)">Alle Abos ansehen →</a>';
      foot.addEventListener('click', function () { ui.closePopovers(); });
      panel.appendChild(foot);

      var dot = document.getElementById('notif-dot');
      if (dot) dot.hidden = false;
    }).catch(function () {});
  }

  /* ================= Profil-Popover ================= */
  function buildProfile(panel) {
    panel.innerHTML =
      '<div class="popover__title">Profil</div>' +
      '<div class="popover__note">Es gibt kein Online-Konto – diese App läuft vollständig lokal. ' +
      'Deine Daten liegen nur in diesem Browser.</div>' +
      '<div class="popover__sep"></div>' +
      '<button class="popover__item" type="button" data-go="#/mine">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" stroke="none"/></svg>' +
        'Meine Videos</button>' +
      '<button class="popover__item" type="button" data-go="#/history">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>' +
        'Verlauf</button>' +
      '<button class="popover__item" type="button" data-go="#/playlists">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="16" cy="19" r="2.2"/></svg>' +
        'Playlists</button>' +
      '<div class="popover__sep"></div>' +
      '<button class="popover__item" type="button" data-go="#/settings">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5"/></svg>' +
        'Einstellungen</button>' +
      '<div class="popover__sep"></div>' +
      '<button class="popover__item popover__item--danger" type="button" id="prof-wipe">' +
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"/></svg>' +
        'Alle Daten löschen</button>';

    panel.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.closePopovers();
        window.location.hash = b.dataset.go;
      });
    });
    panel.querySelector('#prof-wipe').addEventListener('click', function () {
      ui.closePopovers();
      ui.confirmModal('Alle Daten löschen?',
        'Verlauf, Playlists, Likes, Abos und Empfehlungs-Signale werden entfernt, ' +
        'Einstellungen zurückgesetzt.', 'Alles löschen').then(function (ok) {
        if (!ok) return;
        YU.db.wipeAll().then(function () {
          YU.settings.reset();
          YU.reco.invalidate();
          ui.toast('Alle Daten gelöscht', 'ok');
          YU.router.refresh();
        });
      });
    });
  }

  /* ================= „Video erstellen“ ================= */
  function initCreate() {
    var btn = document.getElementById('btn-create');
    btn.addEventListener('click', function () {
      ui.openModal({
        title: 'Video erstellen',
        desc: 'Diese App hat bewusst keinen Server und keine Google-Anmeldung – ' +
          'das Hochladen von Videos ist deshalb hier nicht möglich. Auf YouTube kannst du ' +
          'direkt hochladen:',
        input: false,
        confirmLabel: 'YouTube Studio öffnen',
        cancelLabel: 'Zurück'
      }).then(function (ok) {
        if (ok) window.open('https://studio.youtube.com/', '_blank', 'noopener');
      });
    });
  }

  /* ================= Datenquellen-Status ================= */
  function initStatus() {
    var note = document.getElementById('source-note');
    YU.api.status().then(function (st) {
      if (note) {
        note.innerHTML = st.ok
          ? 'Datenquelle: <b>' + esc(st.label) + '</b><br>' + esc(st.detail)
          : '<b>Keine Datenquelle erreichbar</b>';
      }
    }).catch(function () {
      if (note) note.textContent = 'Datenquellen-Status konnte nicht geprüft werden.';
    });
  }

  /* ================= Tastatur-Navigation global ================= */
  function initKeys() {
    document.addEventListener('keydown', function (e) {
      // "/" fokussiert die Suche (wie YouTube)
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        var input = document.getElementById('search-input');
        if (input) { input.focus(); input.select(); }
      }
    });
  }

  /* ================= Start ================= */
  function boot() {
    YU.settings.applyDom();
    if (YU.settings.get('sidebarCollapsed') && !window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('sidebar-collapsed');
    }

    initSidebar();
    initSearch();
    initCreate();
    initKeys();

    // Popover-Verdrahtung
    var notifBtn = document.getElementById('btn-notifications');
    var notifPanel = document.getElementById('notif-panel');
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      ui.togglePopover(notifBtn, 'notif-panel', function (panel) { buildNotifications(panel); });
    });
    var profBtn = document.getElementById('btn-profile');
    profBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      ui.togglePopover(profBtn, 'profile-panel', function (panel) { buildProfile(panel); });
    });

    if (YU.glow && YU.glow.init) YU.glow.init();

    // Speicher-Art frühzeitig prüfen (file:// → localStorage-Fallback,
    // damit nichts ewig auf IndexedDB wartet)
    if (YU.db && YU.db.modeAsync) {
      YU.db.modeAsync().then(function (m) {
        if (m === 'ls' && window.console && console.info) {
          console.info('[YU] IndexedDB nicht verfügbar – nutze localStorage als Speicher (typisch bei file://-Öffnung).');
        }
      });
    }

    YU.router.init();
    initStatus();

    // Datenquelle bei Änderung des API-Schlüssels neu prüfen
    YU.settings.onChange(function () {
      // Statusanzeige wird beim nächsten Seitenaufruf/Einstellungsbesuch aktualisiert
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.YU = window.YU || {});
