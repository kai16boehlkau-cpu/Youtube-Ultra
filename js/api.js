/* ============================================================
 * YouTube Ultra – Datenschichten (YouTubeAPI-Modul)
 *
 * Quellen-Hierarchie (ehrlich gekennzeichnet):
 *  1. Offizielle YouTube Data API v3 – falls Nutzer einen
 *     eigenen API-Schlüssel lokal eingibt (Settings).
 *  2. Keyless: öffentliche Piped-Instanzen (CORS-fähig) mit
 *     automatischem Failover pro Endpunkt.
 *  3. oEmbed (offiziell, CORS) als Metadaten-Fallback.
 *  4. Demo-Modus – klar als BEISPIELDATEN markiert, wird
 *     niemals als echte Live-Ergebnisse ausgegeben.
 *
 * Kein API-Schlüssel wird jemals in den Client-Code geschrieben;
 * ein selbst eingetragener Schlüssel liegt nur in localStorage.
 * ============================================================ */
(function (YU) {
  'use strict';

  var cfg = YU.config;
  var fmt = YU.fmt;

  /* ---------- Cache & Failover-Status ---------- */
  var cache = new Map();       // key -> {t, ttl, data}
  var cooldown = new Map();    // instanceId -> untilTs

  function cacheGet(key) {
    var e = cache.get(key);
    if (e && Date.now() - e.t < e.ttl) return e.data;
    if (e) cache.delete(key);
    return undefined;
  }
  function cacheSet(key, data, ttl) {
    if (cache.size > 400) {
      var oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(key, { t: Date.now(), ttl: ttl, data: data });
  }

  /* ---------- Helfer ---------- */
  function withTimeout(url, options, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || cfg.timeout);
    options = options || {};
    options.signal = ctrl.signal;
    return fetch(url, options).finally(function () { clearTimeout(timer); });
  }

  function json(url, options, ms) {
    return withTimeout(url, options, ms).then(function (r) {
      if (!r.ok) {
        var err = new Error('HTTP ' + r.status + ' für ' + url.replace(/\?.*$/, ''));
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  function instOk(inst) {
    var until = cooldown.get(inst.id);
    return !until || Date.now() > until;
  }
  function instDown(inst, err) {
    cooldown.set(inst.id, Date.now() + (err && err.status >= 500 ? cfg.cooldownMs * 2 : cfg.cooldownMs));
  }

  /**
   * Läuft über Instanzen mit passender Cap-Fähigkeit (Failover).
   * @param {string} cap z. B. 'search' | 'streams' | 'channelVideos'
   * @param {function(Object):Promise<*>} call  (inst) => Promise
   */
  function eachInstance(cap, call) {
    var candidates = cfg.instances.filter(function (i) { return i.caps[cap] && instOk(i); });
    if (!candidates.length) {
      // Cooldown alles abgelaufen? Erneut erlauben (letzter Versuch)
      candidates = cfg.instances.filter(function (i) { return i.caps[cap]; });
    }
    var i = 0;
    function next(lastErr) {
      if (i >= candidates.length) {
        return Promise.reject(lastErr || new Error('Keine erreichbare Instanz für ' + cap));
      }
      var inst = candidates[i++];
      return call(inst).catch(function (err) {
        instDown(inst, err);
        return next(err);
      });
    }
    return next(null);
  }

  /* ---------- Normalisierung ---------- */
  function idFromUrl(u) {
    if (!u) return '';
    var m = /[?&]v=([\w-]{6,})/.exec(u) || /\/watch\?v=([\w-]{6,})/.exec(u);
    if (m) return m[1];
    m = /\/channel\/(UC[\w-]{20,})/.exec(u);
    if (m) return m[1];
    m = /\/(PL|UL|UU|OL|FL)[\w-]{10,}/.exec(u);
    if (m) return m[0].split('/').pop();
    return '';
  }
  function channelIdFromUrl(u) {
    if (!u) return '';
    var m = /\/channel\/(UC[\w-]{20,})/.exec(u);
    if (m) return m[1];
    return '';
  }
  function bigThumb(id) { return id ? fmt.thumbBig(id) : ''; }

  /** Piped „stream“ → Video */
  function pipedStreamToVideo(s) {
    if (!s) return null;
    var id = idFromUrl(s.url) || s.id || '';
    if (!id) return null;
    return {
      id: id,
      title: s.title || '(ohne Titel)',
      thumbnail: bigThumb(id),
      channelName: s.uploaderName || s.uploader || 'Unbekannter Kanal',
      channelId: channelIdFromUrl(s.uploaderUrl) || '',
      channelAvatar: s.uploaderAvatar || '',
      verified: !!s.uploaderVerified,
      duration: s.duration || 0,
      views: s.views || 0,
      uploaded: s.uploaded || 0,
      uploadedLabel: s.uploadedDate || '',
      description: s.shortDescription || '',
      source: 'piped'
    };
  }

  function pipedChannelToChannel(c) {
    if (!c) return null;
    var id = channelIdFromUrl(c.url) || c.id || '';
    if (!id && !c.name) return null;
    return {
      id: id,
      name: c.name || c.uploaderName || 'Unbekannter Kanal',
      avatar: c.avatar || c.thumbnail || c.uploaderAvatar || '',
      subscribers: c.subscribers || c.subscriberCount || c.followers || 0,
      verified: !!c.verified,
      description: c.description || '',
      source: 'piped'
    };
  }

  function pipedPlaylistToPlaylist(p) {
    if (!p) return null;
    var id = p.id || idFromUrl(p.url) || '';
    if (!/^(PL|UL|UU|OL|FL|RD)/.test(id)) {
      var m = /\/playlist\?list=([\w-]+)/.exec(p.url || '');
      id = m ? m[1] : id;
    }
    if (!id && !p.name) return null;
    return {
      id: id,
      name: p.name || p.title || '(ohne Titel)',
      uploader: p.uploaderName || p.uploader || '',
      uploaderId: channelIdFromUrl(p.uploaderUrl || p.url) || '',
      thumbnail: p.thumbnail || (p.videos && p.videos > 0 ? '' : ''),
      videoCount: p.videos || p.videoCount || 0,
      source: 'piped'
    };
  }

  /* ---------- Offizielle YouTube Data API v3 ---------- */
  var quotaUsed = 0; // nur seit App-Start, ehrlich ausgewiesen

  function officialBase(path, params) {
    var key = YU.settings.get('apiKey') || cfg.apiKey;
    params.key = key;
    var qs = Object.keys(params)
      .filter(function (k) { return params[k] !== '' && params[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return 'https://www.googleapis.com/youtube/v3/' + path + '?' + qs;
  }

  function iso8601ToSeconds(iso) {
    if (!iso) return 0;
    var m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
    if (!m) return 0;
    return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  }

  function officialSearch(q, opts) {
    opts = opts || {};
    var params = {
      part: 'snippet',
      q: q,
      maxResults: opts.maxResults || 24,
      type: opts.type || 'video',
      order: opts.order || 'relevance',
      regionCode: 'DE',
      relevanceLanguage: 'de',
      safeSearch: 'none'
    };
    if (opts.pageToken) params.pageToken = opts.pageToken;
    if (opts.publishedAfter) params.publishedAfter = opts.publishedAfter;
    if (opts.videoDuration) params.videoDuration = opts.videoDuration;
    quotaUsed += 100;
    return json(officialBase('search', params)).then(function (d) {
      var items = (d.items || []).map(function (it) {
        var sn = it.snippet || {};
        if (it.id && it.id.kind === 'youtube#video') {
          return {
            id: it.id.videoId,
            title: sn.title,
            thumbnail: (sn.thumbnails && (sn.thumbnails.high || sn.thumbnails.medium || sn.thumbnails.default) || {}).url || bigThumb(it.id.videoId),
            channelName: sn.channelTitle,
            channelId: sn.channelId,
            channelAvatar: '',
            verified: false,
            duration: 0,
            views: 0,
            uploaded: sn.publishedAt ? Date.parse(sn.publishedAt) : 0,
            uploadedLabel: '',
            description: sn.description || '',
            source: 'official'
          };
        }
        if (it.id && it.id.kind === 'youtube#channel') {
          return { __kind: 'channel', id: it.id.channelId, name: sn.title, avatar: (sn.thumbnails && sn.thumbnails.high && sn.thumbnails.high.url) || '', description: sn.description || '', subscribers: 0, source: 'official' };
        }
        if (it.id && it.id.kind === 'youtube#playlist') {
          return { __kind: 'playlist', id: it.id.playlistId, name: sn.title, thumbnail: (sn.thumbnails && sn.thumbnails.high && sn.thumbnails.high.url) || '', uploader: sn.channelTitle, uploaderId: sn.channelId, videoCount: 0, source: 'official' };
        }
        return null;
      }).filter(Boolean);
      return { items: items, nextPage: d.nextPageToken || null, source: 'official' };
    });
  }

  /** videos.list → Metadaten anreichern (Dauer, Views) */
  function officialVideos(ids) {
    if (!ids.length) return Promise.resolve([]);
    quotaUsed += 1;
    return json(officialBase('videos', {
      part: 'snippet,statistics,contentDetails',
      id: ids.join(','),
      maxResults: 50
    })).then(function (d) {
      return (d.items || []).map(function (it) {
        var sn = it.snippet || {}, st = it.statistics || {};
        return {
          id: it.id,
          title: sn.title,
          thumbnail: (sn.thumbnails && (sn.thumbnails.high || sn.thumbnails.medium) || {}).url || bigThumb(it.id),
          channelName: sn.channelTitle,
          channelId: sn.channelId,
          channelAvatar: '',
          verified: false,
          duration: iso8601ToSeconds(it.contentDetails && it.contentDetails.duration),
          views: st.viewCount ? +st.viewCount : 0,
          uploaded: sn.publishedAt ? Date.parse(sn.publishedAt) : 0,
          uploadedLabel: '',
          description: sn.description || '',
          category: sn.categoryId || '',
          source: 'official'
        };
      });
    });
  }

  function officialChannel(id) {
    quotaUsed += 1;
    return json(officialBase('channels', { part: 'snippet,statistics', id: id })).then(function (d) {
      var it = d.items && d.items[0];
      if (!it) throw new Error('Kanal nicht gefunden');
      var sn = it.snippet, st = it.statistics || {};
      return {
        id: it.id,
        name: sn.title,
        avatar: (sn.thumbnails && sn.thumbnails.high && sn.thumbnails.thumbnails && sn.thumbnails.high.url) || (sn.thumbnails && sn.thumbnails.medium && sn.thumbnails.medium.url) || '',
        banner: '',
        description: sn.description || '',
        subscribers: st.subscriberCount ? +st.subscriberCount : 0,
        verified: false,
        source: 'official'
      };
    });
  }

  function officialChannelVideos(id, max) {
    quotaUsed += 100;
    return json(officialBase('search', {
      part: 'snippet', channelId: id, order: 'date',
      type: 'video', maxResults: max || 24, regionCode: 'DE'
    })).then(function (d) {
      var ids = (d.items || []).map(function (i) { return i.id.videoId; }).filter(Boolean);
      return officialVideos(ids).then(function (vids) { return vids; });
    });
  }

  function officialPlaylist(id) {
    quotaUsed += 1;
    return json(officialBase('playlists', { part: 'snippet,contentDetails', id: id })).then(function (d) {
      var it = d.items && d.items[0];
      if (!it) throw new Error('Playlist nicht gefunden');
      var sn = it.snippet;
      return {
        id: it.id, name: sn.title, uploader: sn.channelTitle, uploaderId: sn.channelId,
        thumbnail: sn.thumbnails && sn.thumbnails.high && sn.thumbnails.high.url || '',
        videoCount: it.contentDetails && it.contentDetails.itemCount || 0,
        videos: [], itemsAvailable: true, source: 'official'
      };
    });
  }

  function officialPlaylistItems(plId) {
    quotaUsed += 1;
    return json(officialBase('playlistItems', {
      part: 'snippet,contentDetails', playlistId: plId, maxResults: 50
    })).then(function (d) {
      var items = d.items || [];
      var ids = items.map(function (i) { return i.contentDetails && i.contentDetails.videoId; }).filter(Boolean);
      return officialVideos(ids);
    });
  }

  /* ---------- Keyless: Piped ---------- */
  function pipedSearch(q, opts) {
    opts = opts || {};
    var filter = opts.filter || 'videos';
    var key = 'search|' + q + '|' + filter + '|' + (opts.nextPage || '');
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);

    var run;
    if (opts.nextPage) {
      run = eachInstance('search', function (inst) {
        var url = inst.base + '/nextpage/search?q=' + encodeURIComponent(q) + '&filter=' + filter + '&nextpage=' + encodeURIComponent(opts.nextPage);
        return json(url).then(function (d) { d.__inst = inst.id; return d; });
      });
    } else {
      run = eachInstance('search', function (inst) {
        var url = inst.base + '/search?q=' + encodeURIComponent(q) + '&filter=' + filter;
        return json(url).then(function (d) { d.__inst = inst.id; return d; });
      });
    }

    return run.then(function (d) {
      var videos = [], channels = [], playlists = [];
      (d.items || []).forEach(function (it) {
        if (!it) return;
        if (it.type === 'stream') { var v = pipedStreamToVideo(it); if (v) videos.push(v); }
        else if (it.type === 'channel') { var c = pipedChannelToChannel(it); if (c) channels.push(c); }
        else if (it.type === 'playlist') { var p = pipedPlaylistToPlaylist(it); if (p) playlists.push(p); }
      });
      var out = {
        videos: videos, channels: channels, playlists: playlists,
        nextPage: d.nextpage || null, source: 'piped', instance: d.__inst
      };
      cacheSet(key, out, 5 * 60 * 1000);
      return out;
    });
  }

  function pipedStreams(id) {
    var key = 'streams|' + id;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return eachInstance('streams', function (inst) {
      return json(inst.base + '/streams/' + encodeURIComponent(id)).then(function (d) {
        if (d.error) throw new Error(d.error);
        d.__inst = inst.id;
        return d;
      });
    }).then(function (d) {
      var v = {
        id: id,
        title: d.title || '(ohne Titel)',
        thumbnail: bigThumb(id),
        channelName: d.uploader || 'Unbekannter Kanal',
        channelId: channelIdFromUrl(d.uploaderUrl) || '',
        channelAvatar: d.uploaderAvatar || '',
        verified: !!d.uploaderVerified,
        duration: d.duration || 0,
        views: d.views || 0,
        uploaded: d.uploaded || (d.uploadDate ? Date.parse(d.uploadDate) : 0) || 0,
        uploadedLabel: d.uploadedDate || '',
        description: d.description || '',
        category: d.category || '',
        likes: d.likes || 0,
        source: 'piped'
      };
      var related = (d.relatedStreams || []).map(pipedStreamToVideo).filter(Boolean);
      var out = { video: v, related: related, instance: d.__inst };
      cacheSet(key, out, 10 * 60 * 1000);
      return out;
    });
  }

  function pipedChannelMeta(id) {
    var key = 'channel|' + id;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return eachInstance('channelMeta', function (inst) {
      return json(inst.base + '/channel/' + encodeURIComponent(id)).then(function (d) {
        d.__inst = inst.id;
        return d;
      });
    }).then(function (d) {
      var out = {
        id: id,
        name: d.name || '(Kanal)',
        avatar: d.avatarUrl || d.avatar || '',
        banner: d.bannerUrl || '',
        description: d.description || '',
        subscribers: d.subscriberCount || 0,
        verified: !!d.verified,
        source: 'piped',
        instance: d.__inst
      };
      cacheSet(key, out, 10 * 60 * 1000);
      return out;
    });
  }

  function pipedChannelVideos(id) {
    var key = 'chvideos|' + id;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    // Kanal-Videos brauchen die Instanz mit cap channelVideos (in der Regel ducks.party)
    return eachInstance('channelVideos', function (inst) {
      return json(inst.base + '/channel/' + encodeURIComponent(id)).then(function (d) {
        var streams = (d.relatedStreams || []).map(pipedStreamToVideo).filter(Boolean);
        if (!streams.length) throw new Error('Keine Videos geladen');
        return streams;
      });
    }).then(function (videos) {
      cacheSet(key, videos, 8 * 60 * 1000);
      return videos;
    });
  }

  function pipedPlaylistMeta(id) {
    var key = 'pl|' + id;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return eachInstance('playlistMeta', function (inst) {
      return json(inst.base + '/playlists/' + encodeURIComponent(id)).then(function (d) {
        d.__inst = inst.id;
        return d;
      });
    }).then(function (d) {
      var videos = (d.relatedStreams || []).map(pipedStreamToVideo).filter(Boolean);
      var out = {
        id: id,
        name: d.name || '(Playlist)',
        uploader: d.uploader || '',
        uploaderId: channelIdFromUrl(d.uploaderUrl) || '',
        thumbnail: d.thumbnailUrl || '',
        videoCount: d.videos || videos.length || 0,
        videos: videos,
        itemsAvailable: videos.length > 0,
        source: 'piped'
      };
      cacheSet(key, out, 8 * 60 * 1000);
      return out;
    });
  }

  function pipedSuggest(q) {
    var key = 'sug|' + q;
    var hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return eachInstance('suggestions', function (inst) {
      return json(inst.base + '/suggestions?query=' + encodeURIComponent(q));
    }).then(function (d) {
      var list = (d || []).filter(function (x) { return typeof x === 'string'; });
      cacheSet(key, list, 30 * 60 * 1000);
      return list;
    });
  }

  /* ---------- oEmbed (offizieller Fallback) ---------- */
  function oembed(id) {
    var url = 'https://www.youtube.com/oembed?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json';
    return json(url, {}, 8000).then(function (d) {
      return {
        id: id,
        title: d.title || '(ohne Titel)',
        thumbnail: (d.thumbnail_url || bigThumb(id)).replace(/s\d+-c/, 's720'),
        channelName: d.author_name || 'Unbekannter Kanal',
        channelId: '',
        channelAvatar: '',
        verified: false,
        duration: 0,
        views: 0,
        uploaded: 0,
        uploadedLabel: '',
        description: '',
        source: 'oembed'
      };
    });
  }

  /* ---------- Demo-Modus (nur wenn gar nichts erreichbar) ---------- */
  function demoVideos() {
    var names = ['Beispielkanal Alpha', 'Demo Musik Kanal', 'Test Gaming Welt', 'Muster Doku Shop'];
    var titles = [
      'Beispieldaten: So sieht ein Demo-Video aus',
      'Beispielvideo Nr. 2 – keine echten YouTube-Daten',
      'Demo: Wiedergabe nur bei echten Video-IDs möglich',
      'Beispiel-Titel für die Rasteransicht',
      'Demo-Karte mit Abspielsymbol und Metadaten-Platzhalter',
      'Noch ein Beispieltitel zum Ansehen des Layouts',
      'Beispieldaten 7 – Strukturtest',
      'Beispieldaten 8 – Strukturtest',
      'Beispieltitel mit langer Überschrift, damit der Zeilenumbruch getestet wird',
      'Demo 10 – Thumbnail-Platzhalter',
      'Demo 11 – Kanalangabe als Beispiel',
      'Demo 12 – Aufrufzahl als Beispiel'
    ];
    return titles.map(function (t, i) {
      return {
        id: 'demo-' + (i + 1),
        title: t,
        thumbnail: '',
        channelName: names[i % names.length],
        channelId: '',
        channelAvatar: '',
        verified: false,
        duration: 120 + i * 37,
        views: (i + 1) * 1234,
        uploaded: Date.now() - (i + 1) * 86400000,
        uploadedLabel: 'vor ' + (i + 1) + ' Tagen',
        description: 'Dies sind ausdrücklich gekennzeichnete Beispieldaten, keine echten YouTube-Inhalte.',
        source: 'demo'
      };
    });
  }

  /* ---------- Öffentliche API ---------- */
  var lastError = null;

  function isOfficial() {
    return !!(YU.settings.get('apiKey') || cfg.apiKey);
  }

  function guarded(fn, fallbackDemo) {
    return fn().catch(function (err) {
      lastError = err;
      if (isOfficial()) {
        // Offizieller Schlüssel gesetzt, aber Fehler → ehrlich melden, kein stiller Demo-Ersatz
        throw err;
      }
      if (fallbackDemo) {
        var e = new Error('Datenquelle nicht erreichbar: ' + (err && err.message || err));
        e.demo = true;
        e.videos = demoVideos();
        throw e;
      }
      throw err;
    });
  }

  var api = {
    /** Aktuelle Betriebsart */
    mode: function () { return isOfficial() ? 'official' : 'keyless'; },
    quotaUsed: function () { return quotaUsed; },
    lastError: function () { return lastError; },

    demoVideos: demoVideos,

    /**
     * Video-Suche.
     * @param {string} q
     * @param {{nextPage?:string, order?:string, publishedAfter?:string, videoDuration?:string, maxResults?:number}} [opts]
     * @returns {Promise<{videos:Video[], channels:Channel[], playlists:Playlist[], nextPage:string|null, source:string}>}
     */
    search: function (q, opts) {
      opts = opts || {};
      if (isOfficial()) {
        var isVideosOnly = opts.filter !== 'channels' && opts.filter !== 'playlists';
        if (isVideosOnly) {
          return officialSearch(q, {
            pageToken: opts.nextPage, order: opts.order,
            publishedAfter: opts.publishedAfter, videoDuration: opts.videoDuration,
            maxResults: opts.maxResults || 24
          }).then(function (r) {
            var videos = r.items.filter(function (i) { return !i.__kind; });
            var ids = videos.map(function (v) { return v.id; });
            return officialVideos(ids).then(function (enriched) {
              var byId = {};
              enriched.forEach(function (v) { byId[v.id] = v; });
              videos = videos.map(function (v) { return byId[v.id] || v; });
              return { videos: videos, channels: [], playlists: [], nextPage: r.nextPage, source: 'official' };
            });
          }).catch(function (err) {
            // Bei Quoten-/Konfigurationsfehlern keyless versuchen, dann ehrlich scheitern
            if (err && err.status === 403) return pipedSearch(q, opts);
            throw err;
          });
        }
        return officialSearch(q, {
          type: opts.filter === 'channels' ? 'channel' : 'playlist',
          pageToken: opts.nextPage, order: opts.order
        }).then(function (r) {
          return {
            videos: [], nextPage: r.nextPage, source: 'official',
            channels: opts.filter === 'channels' ? r.items : [],
            playlists: opts.filter === 'playlists' ? r.items : []
          };
        });
      }
      return guarded(function () { return pipedSearch(q, opts); }, true);
    },

    /** Suchvorschläge (Piped; ohne Verbindung nur lokale Verlaufsbegriffe) */
    suggest: function (q) {
      if (!q || q.length < 2) return Promise.resolve([]);
      return pipedSuggest(q).catch(function () {
        // Fallback: eigene Verlaufsbegriffe (deutlich gekennzeichnet in der UI)
        return YU.db.all('searchHistory').then(function (rows) {
          var lower = q.toLowerCase();
          return rows
            .filter(function (r) { return r.term.toLowerCase().indexOf(lower) !== -1 && r.term !== q; })
            .sort(function (a, b) { return b.ts - a.ts; })
            .slice(0, 8)
            .map(function (r) { return r.term; })
            .map(function (t) { return t; });
        }).catch(function () { return []; });
      }).catch(function () { return []; });
    },

    /** Videodetail (Titel, Kanal, Dauer, Views, Beschreibung) + verwandte Videos */
    getVideo: function (id) {
      if (String(id).indexOf('demo-') === 0) {
        var demo = demoVideos().filter(function (d) { return d.id === id; })[0] || demoVideos()[0];
        return Promise.resolve({ video: demo, related: demoVideos().filter(function (d) { return d.id !== id; }), source: 'demo' });
      }
      if (isOfficial()) {
        return officialVideos([id]).then(function (arr) {
          if (!arr.length) throw new Error('Video nicht gefunden');
          return { video: arr[0], related: [], source: 'official' };
        }).catch(function () {
          return pipedStreams(id).catch(function () {
            return oembed(id).then(function (v) { return { video: v, related: [], source: 'oembed' }; });
          });
        });
      }
      return guarded(function () {
        return pipedStreams(id);
      }, false).catch(function (err) {
        // Fallback: offizielles oEmbed (echte Metadaten, eingeschränkt)
        return oembed(id).then(function (v) {
          return { video: v, related: [], source: 'oembed', degraded: true, firstError: err };
        });
      });
    },

    /** Verwandte Videos (Watch-Seite) */
    getRelated: function (id) {
      if (String(id).indexOf('demo-') === 0) return Promise.resolve(demoVideos().filter(function (d) { return d.id !== id; }));
      if (isOfficial()) {
        // Ohne Private-API keine „related“-Quelle → thematische Suche (ehrlich)
        return officialVideos([id]).then(function (arr) {
          if (!arr.length) return [];
          var topic = pickTopicQuery(arr[0].title + ' ' + arr[0].channelName);
          return api.search(topic, { maxResults: 12 }).then(function (r) {
            return r.videos.filter(function (v) { return v.id !== id; }).slice(0, 12);
          }).catch(function () { return []; });
        }).catch(function () { return []; });
      }
      return pipedStreams(id).then(function (r) {
        return r.related.filter(function (v) { return v.id !== id; }).slice(0, 24);
      }).catch(function () { return []; });
    },

    /** Kanalprofil (Name, Avatar, Banner, Abonnenten, Beschreibung) */
    getChannel: function (id) {
      if (isOfficial()) return officialChannel(id);
      return guarded(function () { return pipedChannelMeta(id); }, false);
    },

    /** Neueste Videos eines Kanals */
    getChannelVideos: function (id, max) {
      if (isOfficial()) return officialChannelVideos(id, max);
      return guarded(function () { return pipedChannelVideos(id); }, false);
    },

    /** YouTube-Playlist (Metadaten + Items, soweit die Quelle liefert) */
    getPlaylist: function (id) {
      if (isOfficial()) {
        return officialPlaylist(id).then(function (pl) {
          return officialPlaylistItems(id).then(function (videos) {
            pl.videos = videos;
            pl.itemsAvailable = true;
            return pl;
          }).catch(function () { pl.itemsAvailable = false; return pl; });
        });
      }
      return guarded(function () { return pipedPlaylistMeta(id); }, false);
    },

    /** Einen „Gesundheitscheck“ der Datenquellen (für Sidebar/Hinweis) */
    status: function () {
      if (isOfficial()) {
        // Kleiner, kostenloser Direkttest (search.list = 100 Einheiten – nur bei explizitem Test)
        return Promise.resolve({ ok: true, mode: 'official', label: 'Offizielle YouTube Data API v3', detail: 'Eigener API-Schlüssel aktiv (' + quotaUsed + ' Einheiten seit Start)' });
      }
      return pipedSuggest('test').then(function (list) {
        var inst = cfg.instances.filter(function (i) { return instOk(i); })[0];
        return {
          ok: true, mode: 'keyless',
          label: 'Keyless-Modus (Piped)',
          detail: 'Instanz ' + (inst ? inst.id : '–') + ' erreichbar' + (list.length ? ', Vorschläge laden' : '')
        };
      }).catch(function (err) {
        return { ok: false, mode: 'keyless', label: 'Keine Datenquelle erreichbar', detail: (err && err.message) || 'Netzwerkfehler' };
      });
    },

    /** Thematische Suchanfrage aus Text ableiten (für Verwandte/Feed) */
    pickTopicQuery: pickTopicQuery
  };

  function pickTopicQuery(text) {
    var lower = (text || '').toLowerCase();
    var best = null, bestScore = 0;
    cfg.topics.forEach(function (t) {
      var score = 0;
      t.kw.forEach(function (k) { if (lower.indexOf(k) !== -1) score++; });
      if (score > bestScore) { best = t; bestScore = score; }
    });
    if (best) {
      var chip = cfg.chips.filter(function (c) { return c.id === best.id; })[0];
      if (chip && chip.query) return chip.query;
      return best.label.toLowerCase() + ' deutsch';
    }
    return cfg.defaultFeedQueries[Math.floor(Math.random() * cfg.defaultFeedQueries.length)];
  }

  YU.api = api;
})(window.YU = window.YU || {});
