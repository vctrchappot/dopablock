<img src="assets/icon.svg" width="64" height="64" alt="">

# Dopablock

Screen-Time-Kontrolle für Chrome: Webseiten **und einzelne Bereiche** davon messen, begrenzen oder sperren – z. B. nur den TikTok-FYP, Instagram Reels, YouTube Shorts oder Snapchat Spotlight. Alles läuft lokal, es werden keine Daten gesendet.

## Installieren

1. `chrome://extensions` öffnen und oben rechts den **Entwicklermodus** einschalten.
2. **Entpackte Erweiterung laden** → diesen Ordner (`dopablock`) auswählen.
3. Beim ersten Start öffnet sich die Übersicht. Unter **Regeln** pro Bereich *Messen*, *Limit* oder *Sperren* wählen.

Funktioniert in Chrome ab Version 110 sowie Edge/Brave und anderen Chromium-Browsern. Es gibt keinen Build-Schritt.

## Funktionen

| Modus | Wirkung |
| --- | --- |
| **Messen** | Zählt nur die Zeit (Tag, Stunde, Bereich). |
| **Limit** | Tagesbudget in Minuten; danach ist der Bereich bis Mitternacht gesperrt. |
| **Sperren** | Bereich ist immer zu. |

- **Bereiche statt ganzer Seiten:** vorgefertigte Regeln für TikTok (FYP, Following, Explore, LIVE, Einzelvideos), Instagram (Reels, Feed, Explore, Stories), YouTube (Shorts inkl. Regalen/Tab, Startseite, Vorschläge, Kommentare), Snapchat (Spotlight, Discover), Facebook, X, Reddit, LinkedIn, Twitch, Netflix.
- **Eigene Regeln** für beliebige Seiten und Unterseiten, mit Ausnahmen und optionalen CSS-Selektoren zum Ausblenden von Elementen.
- **Zeitpläne** pro Regel (Tage + Uhrzeit, auch über Mitternacht), z. B. „Mo–Fr 09:00–17:00“.
- **Selbstkontrolle:** Overrides erst nach einer „Durchatmen“-Wartezeit, globale Pause (5–60 Min.), *Strikter Modus* ohne Overrides.
- **Übersicht** mit Tageszeit pro Stunde, letzten 7 Tagen und den größten Zeitfressern; Zeit der Erweiterung im Toolbar-Badge.
- Hell/Dunkel, Deutsch/Englisch, Backup-Export/-Import.

### Seitenmuster (eigene Regeln)

| Muster | Trifft |
| --- | --- |
| `/*` | die ganze Seite |
| `/shorts/*` | `/shorts` und alles darunter |
| `/` | nur die Startseite |
| `/explore*` | alles, was mit `/explore` beginnt |
| `re:^/(reels?)(/\|$)` | regulärer Ausdruck auf den Pfad |

Domains schließen Subdomains ein (`youtube.com` → `m.youtube.com`).

## Grenzen

- Das ist ein Selbstkontroll-Werkzeug, kein Kinderschutz: Wer die Erweiterung deaktiviert oder einen anderen Browser nutzt, umgeht sie.
- Die Sperre ist ein Overlay mit pausierten Medien. Die Seite lädt im Hintergrund weiter.
- Die Selektoren für ausgeblendete Elemente (z. B. YouTube-Shorts-Regale) hängen vom Seitenaufbau ab; große Plattformen ändern den gelegentlich. Die Pfad-Sperren sind davon unabhängig.
- Die Erweiterung braucht Zugriff auf alle Webseiten, weil sie die aktuelle Adresse mit deinen Regeln vergleicht und bei Treffern eingreift.

## Entwicklung

```
manifest.json          Manifest V3
src/lib/               presets.js (Katalog) · engine.js (Matching, Limits, Zeitpläne) · i18n.js
src/content/           content.js (Zeiterfassung, Ausblenden) · overlay.js (Sperrseite)
src/background.js      Service Worker (Nutzungsdaten, Overrides, Badge)
src/popup/, src/options/, src/ui/   Oberfläche
tools/make-icons.js    erzeugt icons/*.png ohne Abhängigkeiten
```

Tests (Node ≥ 20, keine Abhängigkeiten):

```
node --test "tests/*.test.js"
```
