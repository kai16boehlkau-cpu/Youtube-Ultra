/* ============================================================
 * YouTube Ultra – Datenmodell (JSDoc-Typen)
 * Einheitliche Typen für alle Module. Quellen: Piped-API
 * (keyless), offizielle YouTube Data API v3 (optional),
 * oEmbed (Fallback) – niemals erfundene Daten.
 * ============================================================ */

/**
 * @typedef {Object} Video
 * @property {string} id            YouTube-Video-ID (z. B. „dQw4w9WgXcQ“)
 * @property {string} title         Titel laut Quelle
 * @property {string} thumbnail     Thumbnail-URL (groß, 16:9)
 * @property {string} channelName   Kanalname
 * @property {string} channelId     Kanal-ID (UC…), falls bekannt
 * @property {string} [channelAvatar] Avatar-URL, falls bekannt
 * @property {boolean} [verified]   Kanal verifiziert
 * @property {number} duration      Dauer in Sekunden (0 = unbekannt)
 * @property {number} views         Aufrufe (0 = unbekannt)
 * @property {number} uploaded      Upload-Zeitpunkt in ms seit 1970 (0 = unbekannt)
 * @property {string} [uploadedLabel] Relatives Datum der Quelle („vor 2 Tagen“)
 * @property {string} [description] Beschreibung (Kurzform), wenn vorhanden
 * @property {string} [category]    YouTube-Kategorie, wenn vorhanden
 * @property {string} [source]      Herkunft: 'piped' | 'official' | 'oembed' | 'demo'
 * @property {string} [reason]      Grund für die Empfehlung (Anzeige)
 */

/**
 * @typedef {Object} Channel
 * @property {string} id
 * @property {string} name
 * @property {string} [avatar]
 * @property {string} [banner]
 * @property {string} [description]
 * @property {number} [subscribers] Anzahl Abonnenten (0 = unbekannt)
 * @property {boolean} [verified]
 * @property {string} [source]
 */

/**
 * @typedef {Object} Playlist
 * @property {string} id
 * @property {string} name
 * @property {string} [uploader]
 * @property {string} [uploaderId]
 * @property {string} [thumbnail]
 * @property {number} [videoCount]
 * @property {Video[]} [videos]     Items (kann leer sein – siehe Cap-Hinweis)
 * @property {boolean} [itemsAvailable] false = Inhalte nicht ladbar (ehrlicher Hinweis)
 * @property {string} [source]
 */

/**
 * @typedef {Object} WatchHistoryEntry
 * @property {string} id            = videoId (eindeutig, kein Doppel-Eintrag)
 * @property {string} title
 * @property {string} channelName
 * @property {string} channelId
 * @property {string} thumbnail
 * @property {number} duration      Sekunden
 * @property {number} watchedAt     ms seit 1970 (wird bei Wiederholung aktualisiert)
 * @property {number} progress      Sekunden (Wiedergabeposition)
 * @property {number} watchSeconds  Gesamtbetrachtungszeit in Sekunden
 * @property {boolean} completed    zu >90 % gesehen
 */

/**
 * @typedef {Object} UserPreference
 * @property {boolean} glowEnabled          Mauslichtschein
 * @property {boolean} reducedMotion        Animationen reduzieren
 * @property {string}  accent               Akzentfarbe (CSS-Farbe), Standard Schwarzblau-Design
 * @property {boolean} historyEnabled       Verlauf aufzeichnen
 * @property {boolean} personalization      Personalisierung aktiv
 * @property {string}  apiKey               Optionaler offizieller API-Schlüssel (lokal!)
 * @property {boolean} sidebarCollapsed     Sidebar eingeklappt
 * @property {string}  dataSourcesNote      Letzter bekannter Datenquellen-Status
 */

/**
 * @typedef {Object} RecommendationEvent
 * @property {number} ts            ms seit 1970
 * @property {string} type          'watch' | 'watchTime' | 'complete' | 'search' |
 *                                  'subscribe' | 'like' | 'hide' | 'hideChannel'
 * @property {string} [videoId]
 * @property {string} [title]
 * @property {string} [channelId]
 * @property {string} [channelName]
 * @property {string[]} [topics]    Erkannte Themen-Grobscores
 * @property {number} [seconds]     Für 'watchTime'
 */

/**
 * @typedef {Object} InterestScores
 * @property {Object<string,number>} topics   Thema → Score
 * @property {Object<string,number>} channels Kanal-ID → Score
 * @property {number} total                   Anzahl berücksichtigter Signale
 */

/**
 * @typedef {Object} SearchResult
 * @property {Video[]} videos
 * @property {import('./types.js').Channel[]} [channels]
 * @property {import('./types.js').Playlist[]} [playlists]
 * @property {string|null} [nextPage]  Token für die nächste Seite
 * @property {string} source
 */

window.YU = window.YU || {};
window.YU.types = true;
