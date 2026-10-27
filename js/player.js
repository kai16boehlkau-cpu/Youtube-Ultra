/* ============================================================
 * YouTube Ultra – Player
 * Offizieller YouTube IFrame Player API ( eingebettet, von
 * YouTube gestellt). Ehrliche Fehlerbehandlung: schlägt die
 * Einbettung fehl (Rechte, Alter, Deaktivierung), zeigt die App
 * einen klaren Hinweis + „Auf YouTube öffnen“.
 * Verfolgt Wiedergabeposition & Betrachtungszeit lokal.
 * ============================================================ */
(function (YU) {
  'use strict';

  var apiPromise = null;
  var player = null;
  var currentVideo = null;   // Video-Objekt
  var state = {
    playing: false,
    lastTick: 0,
    accumulated: 0,          // gesammelte Wiedergabesekunden dieser Sitzung
    position: 0,
    duration: 0,
    completed: false
  };
  var tickTimer = null;
  var onEndedCb = null;
  var errorCb = null;

  /* ---------- IFrame API laden ---------- */
  function loadApi() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      if (window.YT && window.YT.Player) { resolve(window.YT); return; }
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') { try { prev(); } catch (e) {} }
        resolve(window.YT);
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function () { reject(new Error('IFrame-API konnte nicht geladen werden')); };
      document.head.appendChild(s);
      // Timeout-Fallback
      setTimeout(function () {
        if (window.YT && window.YT.Player) resolve(window.YT);
        else reject(new Error('IFrame-API Timeout'));
      }, 12000);
    });
    return apiPromise;
  }

  /* ---------- Watch-Time-Sammlung ---------- */
  function startTicking() {
    stopTicking();
    state.lastTick = Date.now();
    tickTimer = setInterval(function () {
      if (!state.playing || !currentVideo) { state.lastTick = Date.now(); return; }
      var now = Date.now();
      var dt = (now - state.lastTick) / 1000;
      state.lastTick = now;
      if (dt > 0 && dt < 5) {
        state.accumulated += dt;
        // Position grob mitschreiben
        try {
          if (player && player.getCurrentTime) state.position = player.getCurrentTime() || state.position;
          if (player && player.getDuration) state.duration = player.getDuration() || state.duration;
        } catch (e) {}
        // Fortschritt regelmäßig persistieren (alle ~10 s)
        if (Math.floor(state.accumulated) % 10 === 0) {
          YU.reco.trackProgress(currentVideo, state.position, false);
        }
      }
    }, 1000);
  }

  function stopTicking() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  function flush() {
    if (!currentVideo) return;
    if (state.accumulated >= 5) {
      YU.reco.trackWatchTime(currentVideo, state.accumulated);
      state.accumulated = 0;
    }
    YU.reco.trackProgress(currentVideo, state.position, state.completed);
  }

  /* ---------- Player erstellen/zerstören ---------- */
  /**
   * @param {string} containerId
   * @param {Video} video
   * @param {{onEnded?:Function, onError?:Function, startSeconds?:number}} [opts]
   */
  function mount(containerId, video, opts) {
    opts = opts || {};
    unmount();
    currentVideo = video;
    state = { playing: false, lastTick: 0, accumulated: 0, position: 0, duration: video.duration || 0, completed: false };
    onEndedCb = opts.onEnded || null;
    errorCb = opts.onError || null;

    if (!video || !video.id || video.id.indexOf('demo-') === 0) {
      if (errorCb) errorCb({ code: 'demo', message: 'Beispieldaten können nicht abgespielt werden.' });
      return Promise.resolve(null);
    }

    // file:// (Doppelklick): kein Origin -> YouTube lehnt Einbettung mit Code 153 ab.
    // Statt eines garantierten Fehlers zeigen wir den klaren Server-Hinweis.
    if (YU.isFile && YU.isFile()) {
      if (errorCb) errorCb({ code: 'fileorigin', message: 'fileorigin' });
      return Promise.resolve(null);
    }

    var container = document.getElementById(containerId);
    if (!container) return Promise.reject(new Error('Kein Player-Container gefunden'));

    return loadApi().then(function (YT) {
      return new Promise(function (resolve) {
        player = new YT.Player(containerId, {
          videoId: video.id,
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            start: Math.max(0, Math.floor(opts.startSeconds || 0))
          },
          events: {
            onReady: function () {
              try {
                var d = player.getDuration();
                if (d) state.duration = d;
              } catch (e) {}
              startTicking();
              resolve(player);
            },
            onStateChange: function (e) {
              try {
                var YTns = window.YT;
                if (e.data === YTns.PlayerState.PLAYING) {
                  state.playing = true;
                  state.lastTick = Date.now();
                } else if (e.data === YTns.PlayerState.PAUSED || e.data === YTns.PlayerState.BUFFERING) {
                  if (state.playing) flush();
                  state.playing = false;
                } else if (e.data === YTns.PlayerState.ENDED) {
                  state.playing = false;
                  state.completed = true;
                  if (currentVideo) YU.reco.trackComplete(currentVideo);
                  stopTicking();
                  if (onEndedCb) onEndedCb(currentVideo);
                }
              } catch (err) { /* Player-Garantien beachten */ }
            },
            onError: function (e) {
              state.playing = false;
              stopTicking();
              var codes = {
                2: 'Die Video-ID ist ungültig.',
                5: 'Der HTML5-Player kann dieses Video nicht abspielen.',
                100: 'Das Video wurde entfernt oder ist privat.',
                101: 'Der Eigentümer hat die Einbettung des Videos nicht erlaubt.',
                150: 'Der Eigentümer hat die Einbettung des Videos nicht erlaubt.'
              };
              var msg = codes[e.data] || 'Das Video konnte nicht eingebettet werden (Code ' + e.data + ').';
              if (errorCb) errorCb({ code: e.data, message: msg });
            }
          },
          height: '100%',
          width: '100%'
        });
      });
    });
  }

  function unmount() {
    flush();
    stopTicking();
    if (player) {
      try { player.destroy(); } catch (e) {}
      player = null;
    }
    currentVideo = null;
    onEndedCb = null;
    errorCb = null;
    state.playing = false;
  }

  function getPosition() {
    try { return player && player.getCurrentTime ? player.getCurrentTime() : state.position; }
    catch (e) { return state.position; }
  }

  function getDuration() {
    try { return player && player.getDuration ? player.getDuration() : state.duration; }
    catch (e) { return state.duration; }
  }

  YU.player = {
    mount: mount,
    unmount: unmount,
    getPosition: getPosition,
    getDuration: getDuration,
    loadApi: loadApi,
    isMounted: function () { return !!player; }
  };
})(window.YU = window.YU || {});
