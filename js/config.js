/* ============================================================
 * YouTube Ultra – Konfiguration
 * Keine API-Schlüssel gehören in den Client-Code.
 * Option: window.YU_CONFIG ÜBER diesen Datei-Header setzen
 * (z. B. durch ein Build-/Deployment-Skript), z. B.:
 *   window.YU_CONFIG = { apiKey: "DEIN_OFFIZIELLER_YOUTUBE_API_KEY" };
 * Alternativ: Schlüssel in der App unter „Einstellungen → API“
 * eingeben (wird nur lokal im Browser gespeichert).
 * ============================================================ */
(function (global) {
  'use strict';

  var CONFIG = {
    /** Optionaler offizieller YouTube-Data-API-v3-Schlüssel (leer = keyless-Modus) */
    apiKey: (global.YU_CONFIG && global.YU_CONFIG.apiKey) || '',

    /**
     * Piped-API-Instanzen (keyless, CORS-fähig).
     * caps markiert, welche Endpunkte die Instanz zuverlässig liefert.
     * Reihenfolge = Priorität; Failover pro Endpunkt.
     */
    instances: [
      {
        id: 'private.coffee',
        base: 'https://api.piped.private.coffee',
        caps: { search: true, suggestions: true, streams: true, channelMeta: true, channelVideos: false, playlistMeta: true, playlistItems: false }
      },
      {
        id: 'ducks.party',
        base: 'https://pipedapi.ducks.party',
        caps: { search: true, suggestions: true, streams: false, channelMeta: true, channelVideos: true, playlistMeta: true, playlistItems: false }
      }
    ],

    /** Request-Timeout in ms */
    timeout: 10000,
    /** Instanz nach Fehler so lange pausieren */
    cooldownMs: 90 * 1000,

    /** Startseite-Filterchips. query=null → personalisierte Mischung („Alle“). */
    chips: [
      { id: 'all', label: 'Alle', query: null },
      { id: 'gaming', label: 'Gaming', query: 'gaming beste spiele' },
      { id: 'music', label: 'Musik', query: 'musik neu 2026' },
      { id: 'minecraft', label: 'Minecraft', query: 'minecraft deutsch' },
      { id: 'tech', label: 'Technologie', query: 'technologie deutsch' },
      { id: 'nature', label: 'Natur', query: 'natur doku deutsch' },
      { id: 'recent', label: 'Kürzlich hochgeladen', query: null, recent: true }
    ],

    /** Themengebiete für die lokale Empfehlungslogik (Keyword-Regeln) */
    topics: [
      { id: 'minecraft', label: 'Minecraft', kw: ['minecraft', 'creeper', 'survival island', 'blockwelt'] },
      { id: 'gaming', label: 'Gaming', kw: ['gaming', 'gameplay', 'spiel', 'fortnite', 'roblox', 'valorant', 'gta', 'call of duty', 'warzone', 'lol ', 'league of legends', 'elden ring', 'speedrun', 'noob vs pro', 'walkthrough', 'let´s play', 'lets play', 'stream', 'twitch'] },
      { id: 'music', label: 'Musik', kw: ['musik', 'song', 'music', 'offizielles video', 'official video', 'lyrics', 'lyric', 'remix', 'album', 'cover', 'live ', 'rap', 'hip hop', 'pop'] },
      { id: 'tech', label: 'Technologie', kw: ['technik', 'technologie', 'tech', 'computer', 'pc ', 'hardware', 'software', 'smartphone', 'android', 'apple', 'ki ', 'künstliche intelligenz', 'ai ', 'programming', 'programmierung', 'coding', 'review', 'test'] },
      { id: 'nature', label: 'Natur', kw: ['natur', 'tiere', 'doku', 'dokumentation', 'erde', 'weltraum', 'universum', 'wald', 'ozean', 'berge', 'wissenschaft', 'nasa', 'space', 'planet', 'naturpark'] },
      { id: 'sport', label: 'Sport', kw: ['sport', 'fußball', 'fussball', 'bundesliga', 'champions league', 'formel 1', 'motorsport', 'training', 'fitness', 'boxen', 'tennis'] },
      { id: 'news', label: 'Nachrichten', kw: ['nachrichten', 'news', 'tagesschau', 'politik', 'wirtschaft', 'journal', 'reportage', 'dokus'] },
      { id: 'food', label: 'Kochen', kw: ['kochen', 'rezept', 'backen', 'grillen', 'food', 'küche', 'kueche'] },
      { id: 'film', label: 'Film & Serie', kw: ['trailer', 'film', 'serie', 'movie', 'cinema', 'kinostart', 'review film', 'kurzfilm'] }
    ],

    /** Start-Queries für eine neutrale Mischung ohne Nutzungsdaten */
    defaultFeedQueries: ['gaming deutsch', 'musik neu', 'doku deutsch', 'technik deutsch', 'natur doku'],

    /** Empfohlene/Standard-Queries für „Neue Videos“ */
    recentQueries: ['neu youtube deutsch', 'gerade hochgeladen deutsch', 'neueste videos'],

    /** Maximal gleichzeitige Kanal-Abrufe (Abos/Feed) */
    parallelChannels: 6,

    /** Verlaufshöchstzahl + Event-Cap (Datenminimierung) */
    historyMax: 400,
    eventsMax: 1500,

    /** Speicher-Präfixe */
    dbName: 'youtube-ultra',
    settingsKey: 'yu.settings.v1'
  };

  global.YU_CONFIG = global.YU_CONFIG || {};
  Object.keys(CONFIG).forEach(function (k) {
    if (global.YU_CONFIG[k] === undefined) global.YU_CONFIG[k] = CONFIG[k];
  });
  global.YU = global.YU || {};
  global.YU.config = global.YU_CONFIG;

  /** true, wenn die App per Doppelklick (file://) läuft. Dann fehlt dem
   *  Browser ein Origin/Referer und die YouTube-Einbettung wird mit
   *  Code 153 abgelehnt – Abspielen ist nur über einen lokalen Server möglich. */
  global.YU.isFile = function () {
    try { return location.protocol === 'file:'; } catch (e) { return false; }
  };
})(window);
