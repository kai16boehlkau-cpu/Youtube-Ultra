/* ============================================================
 * YouTube Ultra – Persistenz (IndexedDB + localStorage-Fallback)
 *
 * • Normal: IndexedDB (http/https, große Datenmengen).
 * • Fallback: localStorage – z. B. beim Öffnen als file://,
 *   wo IndexedDB in Chrome/Edge blockiert wird. Ohne diesen
 *   Fallback würde die App auf Datei-Öffnung ewig „laden“.
 * • Beide Wege liefern dieselbe Oberfläche (YU.db.*).
 * • Datenminimierung: History-/Event-Caps.
 * ============================================================ */
(function (YU) {
  'use strict';

  var dbPromise = null;
  var mode = 'idb';          // 'idb' | 'ls' | 'memory'
  var memFallback = {};      // wenn weder IDB noch localStorage nutzbar

  var OPEN_TIMEOUT_MS = 3000;

  function lsKey(store) { return 'yu.data.' + store; }

  /* ---------- localStorage-Zwischenschicht ---------- */
  function lsLoad(store) {
    try {
      var raw = localStorage.getItem(lsKey(store));
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return memFallback[store] || []; }
  }

  function lsSave(store, rows) {
    memFallback[store] = rows;
    try { localStorage.setItem(lsKey(store), JSON.stringify(rows)); }
    catch (e) { /* Quota überschritten → nur in memory */ }
  }

  function nextUid(store, rows) {
    var max = 0;
    rows.forEach(function (r) { if (typeof r.uid === 'number' && r.uid > max) max = r.uid; });
    return max + 1;
  }

  /* ---------- IndexedDB öffnen (mit Timeout!) ---------- */
  function openIdb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        mode = 'ls';
        reject(new Error('IndexedDB nicht verfügbar (Timeout)'));
      }, OPEN_TIMEOUT_MS);

      var req;
      try {
        req = indexedDB.open(YU.config.dbName, 1);
      } catch (e) {
        clearTimeout(timer);
        if (!settled) { settled = true; mode = 'ls'; reject(e); }
        return;
      }

      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('history')) {
          var h = db.createObjectStore('history', { keyPath: 'id' });
          h.createIndex('watchedAt', 'watchedAt');
        }
        if (!db.objectStoreNames.contains('playlists')) {
          var p = db.createObjectStore('playlists', { keyPath: 'id' });
          p.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('playlistItems')) {
          var pi = db.createObjectStore('playlistItems', { keyPath: 'uid' });
          pi.createIndex('playlistId', 'playlistId');
          pi.createIndex('order', 'order');
        }
        if (!db.objectStoreNames.contains('watchLater')) {
          db.createObjectStore('watchLater', { keyPath: 'videoId' });
        }
        if (!db.objectStoreNames.contains('liked')) {
          db.createObjectStore('liked', { keyPath: 'videoId' });
        }
        if (!db.objectStoreNames.contains('subs')) {
          db.createObjectStore('subs', { keyPath: 'channelId' });
        }
        if (!db.objectStoreNames.contains('events')) {
          var ev = db.createObjectStore('events', { keyPath: 'uid', autoIncrement: true });
          ev.createIndex('ts', 'ts');
        }
        if (!db.objectStoreNames.contains('hidden')) {
          db.createObjectStore('hidden', { keyPath: 'videoId' });
        }
        if (!db.objectStoreNames.contains('hiddenChannels')) {
          db.createObjectStore('hiddenChannels', { keyPath: 'channelId' });
        }
        if (!db.objectStoreNames.contains('searchHistory')) {
          db.createObjectStore('searchHistory', { keyPath: 'term' });
        }
      };
      req.onsuccess = function () {
        if (settled) { try { req.result.close(); } catch (e) {} return; }
        settled = true;
        clearTimeout(timer);
        mode = 'idb';
        resolve(req.result);
      };
      req.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        mode = 'ls';
        reject(req.error || new Error('IndexedDB open fehlgeschlagen'));
      };
      req.onblocked = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        mode = 'ls';
        reject(new Error('IndexedDB blockiert'));
      };
    });
    return dbPromise;
  }

  /* Prüft Verfügbarkeit: hängt nie ewig */
  function ensureMode() {
    if (mode !== 'idb' && dbPromise) return Promise.resolve(mode);
    return openIdb().then(function () { return mode; })
      .catch(function () { return mode; });
  }

  function keyOf(store, key) {
    // Schlüssel-Erkennung je Store (einfach & robust)
    var map = {
      history: 'id', playlists: 'id', playlistItems: 'uid',
      watchLater: 'videoId', liked: 'videoId', subs: 'channelId',
      hidden: 'videoId', hiddenChannels: 'channelId', searchHistory: 'term'
    };
    return map[store] || 'id';
  }

  /* ---------- localStorage-Operationen (gleiche API) ---------- */
  function lsAll(store) { return Promise.resolve(lsLoad(store)); }

  function lsGet(store, key) {
    var k = keyOf(store, key);
    var rows = lsLoad(store);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][k] === key) return Promise.resolve(rows[i]);
    }
    return Promise.resolve(undefined);
  }

  function lsPut(store, value) {
    var k = keyOf(store);
    var rows = lsLoad(store);
    if (store === 'events' && (value.uid === undefined || value.uid === null)) {
      value = Object.assign({}, value, { uid: nextUid(store, rows) });
    }
    var key = value[k];
    var idx = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][k] === key) { idx = i; break; }
    }
    if (idx >= 0) rows[idx] = value; else rows.push(value);
    lsSave(store, rows);
    return Promise.resolve(value);
  }

  function lsDel(store, key) {
    var k = keyOf(store, key);
    var rows = lsLoad(store).filter(function (r) { return r[k] !== key; });
    lsSave(store, rows);
    return Promise.resolve();
  }

  function lsClear(store) {
    lsSave(store, []);
    return Promise.resolve();
  }

  function lsCount(store) { return Promise.resolve(lsLoad(store).length); }

  function lsWhere(store, index, value) {
    var rows = lsLoad(store).filter(function (r) { return r[index] === value; });
    return Promise.resolve(rows);
  }

  /* ---------- Öffentliche, ortalende API ---------- */
  function withStore(store, mode2, idbFn, lsFn) {
    return ensureMode().then(function (m) {
      if (m === 'idb') {
        return idbFn();
      }
      return lsFn();
    });
  }

  function idbTx(store, modeName, fn) {
    return openIdb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, modeName);
        var s = t.objectStore(store);
        var out;
        try { out = fn(s); } catch (e) { reject(e); return; }
        t.oncomplete = function () {
          resolve(out && out.result !== undefined ? out.result : out);
        };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transaktion abgebrochen')); };
      });
    });
  }

  function reqP(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  var STORES = ['history', 'playlists', 'playlistItems', 'watchLater', 'liked',
    'subs', 'events', 'hidden', 'hiddenChannels', 'searchHistory'];

  var db = {
    /** 'idb' | 'ls' (Fallback, z. B. file://) */
    mode: function () { return mode; },

    modeAsync: function () { return ensureMode(); },

    open: function () { return openIdb(); },

    all: function (store) {
      return withStore(store, null,
        function () { return idbTx(store, 'readonly', function (s) { return s.getAll(); }); },
        function () { return lsAll(store); });
    },

    get: function (store, key) {
      return withStore(store, null,
        function () {
          return openIdb().then(function (db) {
            return reqP(db.transaction(store, 'readonly').objectStore(store).get(key));
          });
        },
        function () { return lsGet(store, key); });
    },

    put: function (store, value) {
      return withStore(store, null,
        function () { return idbTx(store, 'readwrite', function (s) { return s.put(value); }); },
        function () { return lsPut(store, value); });
    },

    putAll: function (store, values) {
      return withStore(store, null,
        function () {
          return idbTx(store, 'readwrite', function (s) {
            values.forEach(function (v) { s.put(v); });
          });
        },
        function () {
          var rows = lsLoad(store);
          var k = keyOf(store);
          values.forEach(function (v) {
            var idx = -1;
            for (var i = 0; i < rows.length; i++) if (rows[i][k] === v[k]) { idx = i; break; }
            if (idx >= 0) rows[idx] = v; else rows.push(v);
          });
          lsSave(store, rows);
          return Promise.resolve();
        });
    },

    del: function (store, key) {
      return withStore(store, null,
        function () { return idbTx(store, 'readwrite', function (s) { return s.delete(key); }); },
        function () { return lsDel(store, key); });
    },

    clear: function (store) {
      return withStore(store, null,
        function () { return idbTx(store, 'readwrite', function (s) { return s.clear(); }); },
        function () { return lsClear(store); });
    },

    count: function (store) {
      return withStore(store, null,
        function () { return idbTx(store, 'readonly', function (s) { return s.count(); }); },
        function () { return lsCount(store); });
    },

    /** Nach Index/Property suchen: where(store, 'playlistId', value) */
    where: function (store, index, value) {
      return withStore(store, null,
        function () {
          return openIdb().then(function (db) {
            var t = db.transaction(store, 'readonly');
            return reqP(t.objectStore(store).index(index).getAll(value));
          });
        },
        function () { return lsWhere(store, index, value); });
    },

    /** Verlauf auf Höchstzahl begrenzen (Datenminimierung) */
    trimHistory: function (max) {
      return db.all('history').then(function (all) {
        if (all.length <= max) return;
        all.sort(function (a, b) { return b.watchedAt - a.watchedAt; });
        var excess = all.slice(max);
        return Promise.all(excess.map(function (e) { return db.del('history', e.id); }));
      });
    },

    /** Event-Cap (Datenminimierung) */
    trimEvents: function (max) {
      return db.all('events').then(function (all) {
        if (all.length <= max) return;
        all.sort(function (a, b) { return a.ts - b.ts; });
        var excess = all.slice(0, all.length - max);
        return Promise.all(excess.map(function (e) { return db.del('events', e.uid); }));
      });
    },

    /** Alle Stores leeren („Alle Daten löschen“) */
    wipeAll: function () {
      return Promise.all(STORES.map(function (s) { return db.clear(s); }));
    },

    /** Export aller Daten als JSON-fähiges Objekt (Datenschutz-Export) */
    exportAll: function () {
      var out = { exportedAt: new Date().toISOString(), app: 'YouTube Ultra', storageMode: mode, stores: {} };
      return Promise.all(STORES.map(function (s) {
        return db.all(s).then(function (rows) { out.stores[s] = rows; });
      })).then(function () { return out; });
    }
  };

  YU.db = db;
})(window.YU = window.YU || {});
