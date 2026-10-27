/* ============================================================
 * YouTube Ultra – Hash-Router ( funktioniert auch auf file:// )
 * Routen:
 *   #/home                 Startseite (?chip=…)
 *   #/search               Suche (?q=…&tab=…&time=…&duration=…&sort=…)
 *   #/watch/{id}           Watch-Seite
 *   #/shorts               Shorts
 *   #/subs                 Abos
 *   #/history              Verlauf
 *   #/later                Später ansehen
 *   #/liked                Gefällt mir
 *   #/playlists            Playlists (Übersicht)
 *   #/playlists/{id}       Playlist-Detail (lokal)
 *   #/ytplaylist/{id}      YouTube-Playlist (Suchergebnis)
 *   #/channel/{id}         Kanal (?tab=…)
 *   #/mine                 Meine Videos
 *   #/settings             Einstellungen
 * ============================================================ */
(function (YU) {
  'use strict';

  var ROUTES = {
    home: 'home',
    search: 'search',
    watch: 'watch',
    shorts: 'shorts',
    subs: 'subs',
    history: 'history',
    later: 'later',
    liked: 'liked',
    playlists: 'playlists',
    ytplaylist: 'ytplaylist',
    channel: 'channel',
    mine: 'mine',
    settings: 'settings'
  };

  var NAV_FOR = {
    home: 'home', shorts: 'shorts', subs: 'subs', history: 'history',
    mine: 'mine', later: 'later', playlists: 'playlists', liked: 'liked',
    settings: 'settings', search: 'search'
  };

  var currentRoute = { name: 'home', params: {}, query: {}, raw: 'home' };
  var lastRaw = null;

  /** @returns {{name:string, params:Object, query:Object, raw:string}} */
  function parse() {
    var hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) hash = 'home';
    var qIdx = hash.indexOf('?');
    var pathPart = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
    var queryStr = qIdx >= 0 ? hash.slice(qIdx + 1) : '';

    var segs = pathPart.split('/').filter(Boolean);
    var name = segs[0] || 'home';
    if (!ROUTES[name]) name = 'home';

    var params = {};
    if (name === 'watch' && segs[1]) params.id = segs[1];
    else if (name === 'channel' && segs[1]) params.id = segs[1];
    else if (name === 'ytplaylist' && segs[1]) params.id = segs[1];
    else if (name === 'playlists' && segs[1]) params.id = segs[1];

    var query = {};
    if (queryStr) {
      queryStr.split('&').forEach(function (pair) {
        if (!pair) return;
        var i = pair.indexOf('=');
        var k = i >= 0 ? pair.slice(0, i) : pair;
        var v = i >= 0 ? pair.slice(i + 1) : '';
        try { query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
        catch (e) { query[k] = v; }
      });
    }

    return { name: name, params: params, query: query, raw: pathPart + (queryStr ? '?' + queryStr : '') };
  }

  function content() {
    return document.getElementById('view-content');
  }

  function dispatch(route) {
    var el = content();
    if (!el) return;

    // Vorherige Seite aufräumen
    var prev = currentRoute;
    if (prev && YU.pages && YU.pages[prev.name] && YU.pages[prev.name].destroy) {
      try { YU.pages[prev.name].destroy(); } catch (e) {}
    }

    currentRoute = route;

    var page = YU.pages && YU.pages[route.name];
    if (!page) {
      el.innerHTML = '<div class="empty"><div class="empty__icon">?</div>' +
        '<h3>Seite nicht gefunden</h3><p>Diese Route existiert nicht.</p>' +
        '<a class="btn" href="#/home">Zur Startseite</a></div>';
      return;
    }

    // Scrollposition zurücksetzen
    var view = document.getElementById('main-view');
    if (view) view.scrollTop = 0;

    try {
      page.render(el, route);
    } catch (e) {
      el.innerHTML = '<div class="empty"><div class="empty__icon">!</div>' +
        '<h3>Ein Fehler ist aufgetreten</h3><p>' + String(e && e.message || e) + '</p>' +
        '<button class="btn" type="button" onclick="location.hash=\'#/home\'">Zur Startseite</button></div>';
      if (window.console) console.error('[YU] Render-Fehler', e);
    }

    highlightNav(route);
    updateSearchBack(route);
  }

  function highlightNav(route) {
    var navKey = NAV_FOR[route.name];
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var isActive = navKey && a.dataset.nav === navKey;
      a.classList.toggle('is-active', !!isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function updateSearchBack(route) {
    var back = document.getElementById('btn-back-search');
    if (!back) return;
    var isMobile = window.matchMedia('(max-width: 900px)').matches;
    back.hidden = !(isMobile && route.name === 'search');
  }

  function onHashChange() {
    var route = parse();
    if (route.raw === lastRaw) {
      highlightNav(route);
      return;
    }
    lastRaw = route.raw;
    dispatch(route);
  }

  function navigate(path) {
    var target = '#/' + String(path || '').replace(/^#?\/?/, '');
    if (window.location.hash === target) {
      // Gleiche Route → manuell neu rendern (z. B. Chip-Wechsel)
      lastRaw = null;
      onHashChange();
    } else {
      window.location.hash = target;
    }
  }

  function refresh() {
    lastRaw = null;
    onHashChange();
  }

  var router = {
    init: function () {
      window.addEventListener('hashchange', onHashChange);
      if (!window.location.hash) window.location.hash = '#/home';
      lastRaw = null;
      onHashChange();
    },
    navigate: navigate,
    refresh: refresh,
    current: function () { return currentRoute.raw; },
    route: function () { return currentRoute; },
    parse: parse
  };

  YU.router = router;
})(window.YU = window.YU || {});
