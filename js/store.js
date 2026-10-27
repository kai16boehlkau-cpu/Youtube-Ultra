/* ============================================================
 * YouTube Ultra – Store
 * Verwaltung der lokalen Listen: Später ansehen, eigene
 * Playlists, Likes, Abos, Verlauf (Lese-/Schreibzugriffe).
 * ============================================================ */
(function (YU) {
  'use strict';

  function videoToRecord(video, extra) {
    var rec = {
      videoId: video.id,
      title: video.title || '',
      channelName: video.channelName || '',
      channelId: video.channelId || '',
      thumbnail: video.thumbnail || '',
      duration: video.duration || 0,
      addedAt: Date.now()
    };
    if (extra) Object.keys(extra).forEach(function (k) { rec[k] = extra[k]; });
    return rec;
  }

  var store = {
    /* ---------- Später ansehen ---------- */
    addLater: function (video) {
      return YU.db.put('watchLater', videoToRecord(video));
    },
    removeLater: function (videoId) {
      return YU.db.del('watchLater', videoId);
    },
    hasLater: function (videoId) {
      return YU.db.get('watchLater', videoId).then(function (r) { return !!r; }).catch(function () { return false; }); },
    listLater: function () {
      return YU.db.all('watchLater').then(function (rows) {
        return rows.sort(function (a, b) { return b.addedAt - a.addedAt; });
      }).catch(function () { return []; });
    },

    /* ---------- Playlists (eigene, lokal) ---------- */
    createPlaylist: function (name) {
      var pl = {
        id: 'pl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        name: (name || 'Neue Playlist').slice(0, 80),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      return YU.db.put('playlists', pl).then(function () { return pl; });
    },
    renamePlaylist: function (id, name) {
      return YU.db.get('playlists', id).then(function (pl) {
        if (!pl) throw new Error('Playlist nicht gefunden');
        pl.name = (name || pl.name).slice(0, 80);
        pl.updatedAt = Date.now();
        return YU.db.put('playlists', pl).then(function () { return pl; });
      });
    },
    deletePlaylist: function (id) {
      return YU.db.where('playlistItems', 'playlistId', id).then(function (items) {
        return Promise.all(items.map(function (it) {
          return YU.db.del('playlistItems', it.uid);
        }));
      }).then(function () {
        return YU.db.del('playlists', id);
      });
    },
    listPlaylists: function () {
      return YU.db.all('playlists').then(function (rows) {
        return rows.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      }).catch(function () { return []; });
    },
    getPlaylist: function (id) {
      return YU.db.get('playlists', id).catch(function () { return null; });
    },
    playlistItems: function (playlistId) {
      return YU.db.where('playlistItems', 'playlistId', playlistId).then(function (rows) {
        return rows.sort(function (a, b) { return a.order - b.order; });
      }).catch(function () { return []; });
    },
    addToPlaylist: function (playlistId, video) {
      return store.playlistItems(playlistId).then(function (items) {
        var dup = items.filter(function (i) { return i.videoId === video.id; })[0];
        if (dup) return { duplicate: true };
        var item = videoToRecord(video, {
          uid: playlistId + '::' + video.id,
          playlistId: playlistId,
          order: items.length
        });
        return YU.db.put('playlistItems', item).then(function () {
          return YU.db.get('playlists', playlistId).then(function (pl) {
            if (pl) { pl.updatedAt = Date.now(); return YU.db.put('playlists', pl); }
          });
        }).then(function () { return { duplicate: false }; });
      });
    },
    removeFromPlaylist: function (playlistId, videoId) {
      return YU.db.del('playlistItems', playlistId + '::' + videoId);
    },
    /** Eintrag in der Playlist verschieben (delta = -1/+1) */
    movePlaylistItem: function (playlistId, videoId, delta) {
      return store.playlistItems(playlistId).then(function (items) {
        var idx = items.findIndex(function (i) { return i.videoId === videoId; });
        if (idx < 0) return;
        var target = idx + delta;
        if (target < 0 || target >= items.length) return;
        var tmp = items[idx];
        items[idx] = items[target];
        items[target] = tmp;
        return Promise.all(items.map(function (it, i) {
          it.order = i;
          return YU.db.put('playlistItems', it);
        }));
      });
    },

    /* ---------- Likes ---------- */
    listLiked: function () {
      return YU.db.all('liked').then(function (rows) {
        return rows.sort(function (a, b) { return b.likedAt - a.likedAt; });
      }).catch(function () { return []; });
    },

    /* ---------- Abos ---------- */
    listSubs: function () {
      return YU.db.all('subs').then(function (rows) {
        return rows.sort(function (a, b) { return b.subscribedAt - a.subscribedAt; });
      }).catch(function () { return []; });
    },

    /* ---------- Verlauf ---------- */
    listHistory: function () {
      return YU.db.all('history').then(function (rows) {
        return rows.sort(function (a, b) { return b.watchedAt - a.watchedAt; });
      }).catch(function () { return []; });
    },
    removeHistory: function (videoId) {
      return YU.db.del('history', videoId);
    },
    clearHistory: function () {
      return YU.db.clear('history');
    },
    getHistoryEntry: function (videoId) {
      return YU.db.get('history', videoId).catch(function () { return null; });
    },

    /* ---------- Suche ---------- */
    listSearchHistory: function () {
      return YU.db.all('searchHistory').then(function (rows) {
        return rows.sort(function (a, b) { return b.ts - a.ts; });
      }).catch(function () { return []; });
    },
    removeSearchTerm: function (term) {
      return YU.db.del('searchHistory', term);
    },
    clearSearchHistory: function () {
      return YU.db.clear('searchHistory');
    },

    /* ---------- Zuletzt gesehen (für Startseite/Abos) ---------- */
    recentlyWatched: function (n) {
      return store.listHistory().then(function (rows) { return rows.slice(0, n || 12); });
    }
  };

  YU.store = store;
})(window.YU = window.YU || {});
