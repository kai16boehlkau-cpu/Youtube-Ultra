/* ============================================================
 * YouTube Ultra – Lokale Empfehlungslogik
 *
 * • Läuft vollständig im Browser (IndexedDB-Events).
 * • Signale: Klicks, Watch-Time, Abschlüsse, Suchen, Abos,
 *   Likes, Ausblenden (positiv/negativ).
 * • Interessens-Scores aus mehreren Signalen + Recency +
 *   Themenähnlichkeit + Kanalpräferenz + Diversität.
 * • Kein Video dominiert; neutrale Mischung ohne Daten.
 * • Rücksetzen / Pause jederzeit über die Einstellungen.
 * ============================================================ */
(function (YU) {
  'use strict';

  var cfg = YU.config;

  /* ---------- Themen-Erkennung ---------- */
  function topicsOf(text) {
    var lower = (text || '').toLowerCase();
    var out = {};
    cfg.topics.forEach(function (t) {
      var s = 0;
      t.kw.forEach(function (k) { if (lower.indexOf(k) !== -1) s++; });
      if (s > 0) out[t.id] = s;
    });
    return out;
  }

  /* ---------- Events ---------- */
  function logEvent(ev) {
    if (!YU.settings.get('personalization')) return Promise.resolve();
    ev.ts = Date.now();
    return YU.db.put('events', ev)
      .then(function () { return YU.db.trimEvents(cfg.eventsMax); })
      .catch(function () { /* Datenbank nicht verfügbar – still ignorieren */ });
  }

  /* ---------- Interessens-Scores berechnen ---------- */
  var scoreCache = null; // {at, scores}
  var HALF_LIFE_MS = 14 * 24 * 3600 * 1000; // 14 Tage Halbwertszeit

  function computeScores(force) {
    if (!force && scoreCache && Date.now() - scoreCache.at < 60000) {
      return Promise.resolve(scoreCache.scores);
    }
    return YU.db.all('events').then(function (events) {
      var topics = {}, channels = {}, total = 0;
      var now = Date.now();

      events.forEach(function (ev) {
        var weight = eventWeight(ev);
        if (!weight) return;
        // Recency: jüngere Signale zählen stärker
        var age = now - (ev.ts || 0);
        var recency = Math.pow(0.5, age / HALF_LIFE_MS);
        var w = weight * recency;
        total++;

        if (ev.topics) {
          Object.keys(ev.topics).forEach(function (t) {
            topics[t] = (topics[t] || 0) + w * Math.min(3, ev.topics[t]);
          });
        }
        if (ev.channelId) {
          channels[ev.channelId] = (channels[ev.channelId] || 0) + w;
        }
      });

      // Abos geben dauerhaften Kanalbonus
      return YU.db.all('subs').then(function (subs) {
        subs.forEach(function (s) {
          channels[s.channelId] = (channels[s.channelId] || 0) + 6;
        });
        // Likes verstärken auch Themen des Videos
        return YU.db.all('liked').then(function (likes) {
          likes.forEach(function (l) {
            var tp = l.topics || topicsOf((l.title || '') + ' ' + (l.channelName || ''));
            Object.keys(tp).forEach(function (t) {
              topics[t] = (topics[t] || 0) + 3 * Math.min(3, tp[t]);
            });
            if (l.channelId) channels[l.channelId] = (channels[l.channelId] || 0) + 3;
          });

          // Negativsignale
          return YU.db.all('hiddenChannels').then(function (hc) {
            hc.forEach(function (h) { channels[h.channelId] = -100; });
            return YU.db.all('hidden').then(function (hv) {
              hv.forEach(function (h) {
                var tp = h.topics || topicsOf(h.title || '');
                Object.keys(tp).forEach(function (t) {
                  topics[t] = (topics[t] || 0) - 4;
                });
                if (h.channelId) channels[h.channelId] = (channels[h.channelId] || 0) - 8;
              });

              var scores = { topics: topics, channels: channels, total: total };
              scoreCache = { at: Date.now(), scores: scores };
              return scores;
            });
          });
        });
      });
    }).catch(function () {
      return { topics: {}, channels: {}, total: 0 };
    });
  }

  function eventWeight(ev) {
    switch (ev.type) {
      case 'watch': return 2;
      case 'watchTime': return Math.min(6, 1 + (ev.seconds || 0) / 60); // bis ~6
      case 'complete': return 4;
      case 'search': return 1.5;
      case 'subscribe': return 5;
      case 'like': return 4;
      case 'hide': return -3;
      case 'hideChannel': return -6;
      default: return 0;
    }
  }

  function invalidate() { scoreCache = null; }

  /* ---------- Bewertung eines Videos ---------- */
  function scoreVideo(video, scores) {
    if (!video) return { score: 0, reason: '' };
    var tp = topicsOf((video.title || '') + ' ' + (video.channelName || '') + ' ' + (video.description || ''));
    var score = 0;
    var bestTopic = null, bestTopicVal = 0;

    Object.keys(tp).forEach(function (t) {
      var s = (scores.topics[t] || 0) * Math.min(3, tp[t]);
      score += s;
      if (s > bestTopicVal) { bestTopicVal = s; bestTopic = t; }
    });

    var chScore = video.channelId ? (scores.channels[video.channelId] || 0) : 0;
    score += chScore;

    // Recency-Bonus (frischere Videos leicht bevorzugen)
    if (video.uploaded) {
      var ageDays = (Date.now() - video.uploaded) / 86400000;
      if (ageDays >= 0 && ageDays < 7) score += 2;
      else if (ageDays >= 0 && ageDays < 30) score += 1;
      else if (ageDays > 400) score -= 0.5;
    }

    var reason = '';
    if (chScore >= 3 && chScore >= bestTopicVal) reason = 'Weil du ' + (video.channelName || 'diesen Kanal') + ' ansiehst';
    else if (bestTopic && bestTopicVal > 0) {
      var t = cfg.topics.filter(function (x) { return x.id === bestTopic; })[0];
      reason = 'Passt zu deinen Interessen' + (t ? ': ' + t.label : '');
    }

    return { score: score, reason: reason };
  }

  /* ---------- Feed personalisieren ---------- */
  /**
   * @param {Video[]} candidates
   * @param {{exclude?:string[], limit?:number, personalize?:boolean}} [opts]
   * @returns {Promise<Video[]>}
   */
  function rankFeed(candidates, opts) {
    opts = opts || {};
    var limit = opts.limit || 30;
    var exclude = opts.exclude || [];
    var personalize = opts.personalize !== false && YU.settings.get('personalization');

    return Promise.all([
      personalize ? computeScores() : Promise.resolve({ topics: {}, channels: {}, total: 0 }),
      YU.db.all('hidden').catch(function () { return []; }),
      YU.db.all('hiddenChannels').catch(function () { return []; }),
      YU.db.all('history').catch(function () { return []; })
    ]).then(function (res) {
      var scores = res[0];
      var hiddenIds = {};
      res[1].forEach(function (h) { hiddenIds[h.videoId] = 1; });
      var hiddenCh = {};
      res[2].forEach(function (h) { hiddenCh[h.channelId] = 1; });
      var seenIds = {};
      res[3].forEach(function (h) { seenIds[h.id] = 1; });

      var pool = candidates.filter(function (v) {
        if (!v || !v.id || v.id.indexOf('demo-') === 0) return false;
        if (exclude.indexOf(v.id) !== -1) return false;
        if (hiddenIds[v.id]) return false;
        if (v.channelId && hiddenCh[v.channelId]) return false;
        return true;
      });

      // Deduplizieren
      pool = YU.fmt.uniq(pool, function (v) { return v.id; });

      pool.forEach(function (v) {
        var r = personalize ? scoreVideo(v, scores) : { score: 0, reason: '' };
        v.__score = r.score;
        v.reason = personalize && r.reason && YU.settings.get('showReasons') ? r.reason : '';
        v.__seen = seenIds[v.id] ? 1 : 0;
      });

      if (personalize && scores.total > 0) {
        pool.sort(function (a, b) {
          // Leichter Nachteil für schon Gesehenes, aber nicht Ausschluss
          var sa = a.__score - a.__seen * 1.5;
          var sb = b.__score - b.__seen * 1.5;
          if (sb !== sa) return sb - sa;
          return (b.uploaded || 0) - (a.uploaded || 0);
        });
      } else {
        // Neutrale Mischung: Relevanz der Quelle + etwas Zufall für Vielfalt
        pool.forEach(function (v, i) { v.__score = pool.length - i + Math.random() * 6; });
        pool.sort(function (a, b) { return b.__score - a.__score; });
      }

      // Diversität: kein Kanal > ~25 % in den ersten Plätzen
      var out = [], chCount = {}, topicCount = {};
      var i = 0;
      while (out.length < limit && i < pool.length * 2 && i < pool.length + 60) {
        var picked = null;
        // Fenster durchgehen und das erste Candidate nehmen, das die Quoten nicht sprengt
        for (var j = i; j < Math.min(pool.length, i + 12); j++) {
          var v = pool[j];
          if (!v) continue;
          var cc = v.channelId || v.channelName;
          var tps = Object.keys(topicsOf(v.title || ''));
          var topicMax = tps.some(function (t) { return (topicCount[t] || 0) >= Math.max(3, Math.ceil(limit * 0.35)); });
          if ((chCount[cc] || 0) >= Math.max(2, Math.ceil(limit * 0.28)) || topicMax) continue;
          picked = v;
          pool.splice(j, 1);
          break;
        }
        if (!picked) {
          // Quoten erzwungen: einfach das nächste beste nehmen
          picked = pool.shift();
          if (!picked) break;
        }
        out.push(picked);
        var cck = picked.channelId || picked.channelName;
        chCount[cck] = (chCount[cck] || 0) + 1;
        Object.keys(topicsOf(picked.title || '')).forEach(function (t) {
          topicCount[t] = (topicCount[t] || 0) + 1;
        });
        i = 0; // Fenster neu starten
      }
      return out;
    });
  }

  /* ---------- Sammeln eines neutralen/normalen Feeds ---------- */
  /**
   * Baut den Startseite-Feed: mischt thematische Queries,
   * personalisiert wenn möglich, sonst neutrale Mischung.
   * @param {{query?:string|null, recent?:boolean, limit?:number}} [opts]
   * @returns {Promise<{videos:Video[], personalized:boolean}>}
   */
  function feed(opts) {
    opts = opts || {};
    var personalize = YU.settings.get('personalization') && opts.query == null && !opts.recent;

    var queries;
    if (opts.query) {
      queries = [opts.query];
    } else if (opts.recent) {
      queries = cfg.recentQueries.slice();
    } else {
      // Eigene Interessen als Such-Queries nutzen (personalisiert)
      queries = cfg.defaultFeedQueries.slice();
    }

    var searches = queries.map(function (q) {
      return YU.api.search(q, { maxResults: 20 }).catch(function () { return null; });
    });

    return Promise.all(searches).then(function (results) {
      var all = [];
      results.forEach(function (r) {
        if (r && r.videos) all = all.concat(r.videos);
      });
      all = YU.fmt.uniq(all, function (v) { return v.id; });

      if (!all.length) {
        var err = new Error('Keine Videos von den Datenquellen erhalten.');
        err.empty = true;
        throw err;
      }
      // Interessens-Queries einmischen (personalisierte Suche)
      if (personalize) {
        return computeScores().then(function (scores) {
          var top = Object.keys(scores.topics)
            .sort(function (a, b) { return scores.topics[b] - scores.topics[a]; })
            .slice(0, 2)
            .map(function (t) {
              var topic = cfg.topics.filter(function (x) { return x.id === t; })[0];
              return topic ? topic.label.toLowerCase() + ' deutsch' : null;
            })
            .filter(Boolean);
          if (!top.length) return all;
          return Promise.all(top.map(function (q) {
            return YU.api.search(q, { maxResults: 15 }).catch(function () { return null; });
          })).then(function (extra) {
            extra.forEach(function (r) { if (r && r.videos) all = all.concat(r.videos); });
            return YU.fmt.uniq(all, function (v) { return v.id; });
          });
        });
      }
      return all;
    }).then(function (all) {
      return rankFeed(all, { limit: opts.limit || 40 }).then(function (videos) {
        return { videos: videos, personalized: personalize && YU.settings.get('personalization') };
      });
    });
  }

  /* ---------- Aktionen aus der UI ---------- */
  function trackWatchStart(video) {
    if (!video || video.id.indexOf('demo-') === 0) return Promise.resolve();
    var tp = topicsOf((video.title || '') + ' ' + (video.channelName || ''));
    var p = [];

    if (YU.settings.get('historyEnabled')) {
      var entry = {
        id: video.id,
        title: video.title,
        channelName: video.channelName,
        channelId: video.channelId || '',
        thumbnail: video.thumbnail,
        duration: video.duration || 0,
        watchedAt: Date.now(),
        progress: 0,
        watchSeconds: 0,
        completed: false
      };
      p.push(YU.db.put('history', entry).then(function () {
        return YU.db.trimHistory(cfg.historyMax);
      }).catch(function () {}));
    }

    p.push(logEvent({ type: 'watch', videoId: video.id, title: video.title, channelId: video.channelId, channelName: video.channelName, topics: tp }));
    return Promise.all(p).catch(function () {});
  }

  function trackWatchTime(video, seconds) {
    if (!video || !seconds || seconds < 5) return Promise.resolve();
    var tp = topicsOf((video.title || '') + ' ' + (video.channelName || ''));
    var p = [
      logEvent({ type: 'watchTime', videoId: video.id, title: video.title, channelId: video.channelId, channelName: video.channelName, topics: tp, seconds: Math.round(seconds) })
    ];
    if (YU.settings.get('historyEnabled')) {
      p.push(YU.db.get('history', video.id).then(function (row) {
        if (!row) return;
        row.watchSeconds = (row.watchSeconds || 0) + Math.round(seconds);
        row.watchedAt = Date.now();
        return YU.db.put('history', row);
      }).catch(function () {}));
    }
    invalidate();
    return Promise.all(p).catch(function () {});
  }

  function trackProgress(video, seconds, completed) {
    if (!video || !YU.settings.get('historyEnabled')) return Promise.resolve();
    return YU.db.get('history', video.id).then(function (row) {
      if (!row) return;
      row.progress = Math.round(seconds || 0);
      if (completed) row.completed = true;
      row.watchedAt = Date.now();
      return YU.db.put('history', row);
    }).catch(function () {});
  }

  function trackComplete(video) {
    if (!video || video.id.indexOf('demo-') === 0) return Promise.resolve();
    var tp = topicsOf((video.title || '') + ' ' + (video.channelName || ''));
    invalidate();
    return Promise.all([
      logEvent({ type: 'complete', videoId: video.id, title: video.title, channelId: video.channelId, channelName: video.channelName, topics: tp }),
      trackProgress(video, video.duration || 0, true)
    ]).catch(function () {});
  }

  function trackSearch(term) {
    if (!term || !YU.settings.get('searchHistoryEnabled')) return Promise.resolve();
    var p = [
      logEvent({ type: 'search', title: term, topics: topicsOf(term) }),
      YU.db.put('searchHistory', { term: term, ts: Date.now() }).catch(function () {})
    ];
    invalidate();
    return Promise.all(p).catch(function () {});
  }

  function trackSubscribe(channel) {
    if (!channel || !channel.id) return Promise.resolve();
    invalidate();
    return Promise.all([
      YU.db.put('subs', {
        channelId: channel.id, name: channel.name || '', avatar: channel.avatar || '',
        subscribedAt: Date.now()
      }).catch(function () {}),
      logEvent({ type: 'subscribe', channelId: channel.id, channelName: channel.name })
    ]).catch(function () {});
  }

  function unsubscribe(channelId) {
    invalidate();
    return YU.db.del('subs', channelId).catch(function () {});
  }

  function isSubscribed(channelId) {
    if (!channelId) return Promise.resolve(false);
    return YU.db.get('subs', channelId).then(function (r) { return !!r; }).catch(function () { return false; });
  }

  function trackLike(video) {
    if (!video || video.id.indexOf('demo-') === 0) return Promise.resolve();
    var tp = topicsOf((video.title || '') + ' ' + (video.channelName || ''));
    invalidate();
    return Promise.all([
      YU.db.put('liked', {
        videoId: video.id, title: video.title, channelName: video.channelName,
        channelId: video.channelId || '', thumbnail: video.thumbnail,
        duration: video.duration || 0, likedAt: Date.now(), topics: tp
      }).catch(function () {}),
      logEvent({ type: 'like', videoId: video.id, channelId: video.channelId, channelName: video.channelName, topics: tp })
    ]).catch(function () {});
  }

  function unlike(videoId) {
    invalidate();
    return YU.db.del('liked', videoId).catch(function () {});
  }

  function isLiked(videoId) {
    if (!videoId) return Promise.resolve(false);
    return YU.db.get('liked', videoId).then(function (r) { return !!r; }).catch(function () { return false; });
  }

  function hideVideo(video) {
    if (!video) return Promise.resolve();
    invalidate();
    return Promise.all([
      YU.db.put('hidden', {
        videoId: video.id, title: video.title || '',
        channelId: video.channelId || '',
        topics: topicsOf((video.title || '') + ' ' + (video.channelName || '')),
        hiddenAt: Date.now()
      }).catch(function () {}),
      logEvent({ type: 'hide', videoId: video.id, channelId: video.channelId, topics: topicsOf(video.title || '') })
    ]).catch(function () {});
  }

  function hideChannel(channelId, channelName) {
    if (!channelId) return Promise.resolve();
    invalidate();
    return Promise.all([
      YU.db.put('hiddenChannels', { channelId: channelId, name: channelName || '', hiddenAt: Date.now() }).catch(function () {}),
      logEvent({ type: 'hideChannel', channelId: channelId, channelName: channelName })
    ]).catch(function () {});
  }

  function unhideChannel(channelId) {
    invalidate();
    return YU.db.del('hiddenChannels', channelId).catch(function () {});
  }

  /** Empfehlungen vollständig zurücksetzen */
  function reset() {
    invalidate();
    return Promise.all([
      YU.db.clear('events'),
      YU.db.clear('hidden'),
      YU.db.clear('hiddenChannels')
    ]).catch(function () {});
  }

  YU.reco = {
    topicsOf: topicsOf,
    logEvent: logEvent,
    computeScores: computeScores,
    scoreVideo: scoreVideo,
    rankFeed: rankFeed,
    feed: feed,
    invalidate: invalidate,
    trackWatchStart: trackWatchStart,
    trackWatchTime: trackWatchTime,
    trackProgress: trackProgress,
    trackComplete: trackComplete,
    trackSearch: trackSearch,
    trackSubscribe: trackSubscribe,
    unsubscribe: unsubscribe,
    isSubscribed: isSubscribed,
    trackLike: trackLike,
    unlike: unlike,
    isLiked: isLiked,
    hideVideo: hideVideo,
    hideChannel: hideChannel,
    unhideChannel: unhideChannel,
    reset: reset
  };
})(window.YU = window.YU || {});
