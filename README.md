<img src="assets/icon.svg" width="64" height="64" alt="">

# Dopablock

Screen-Time-Kontrolle für Chrome: Webseiten **und einzelne Bereiche** davon messen, begrenzen oder sperren – z. B. nur den TikTok-FYP, Instagram Reels, YouTube Shorts oder Snapchat Spotlight. Alles läuft lokal, es werden keine Daten gesendet (siehe [PRIVACY.md](PRIVACY.md)).

## Installieren

1. `chrome://extensions` öffnen und oben rechts den **Entwicklermodus** einschalten.
2. **Entpackte Erweiterung laden** → diesen Ordner (`dopablock`) auswählen.
3. Beim ersten Start öffnet sich die Übersicht. Unter **Regeln** pro Bereich *Messen*, *Limit* oder *Sperren* wählen.

Chrome ab Version 110 (auch Edge/Brave und andere Chromium-Browser). Kein Build-Schritt. Firefox wird nicht unterstützt.

## Funktionen

| Modus | Wirkung |
| --- | --- |
| **Messen** | Zählt nur die Zeit (Tag, Stunde, Bereich). |
| **Limit** | Tagesbudget in Minuten; danach ist der Bereich bis Mitternacht gesperrt. |
| **Sperren** | Bereich ist immer zu. |

- **Bereiche statt ganzer Seiten:** Regeln für TikTok (FYP, Following, Explore, LIVE, Einzelvideos), Instagram (Reels, Feed, Explore, Stories), YouTube (Shorts inkl. Regalen/Tab, Startseite, Vorschläge, Kommentare), Snapchat, Facebook, X, Reddit, LinkedIn, Threads, Bluesky, Pinterest, Twitch, Netflix, Discord.
- **Gesperrt = unscharf:** Die Seite bleibt hinter einer Glas-Karte sichtbar, aber unscharf, eingefroren und stumm. Alternativ „Einfarbig“ in den Einstellungen.
- **Eigene Regeln** für beliebige Seiten und Unterseiten, mit Ausnahmen und optionalen CSS-Selektoren zum Ausblenden von Elementen.
- **URL-Tester** in der Regeln-Ansicht: Adresse einfügen und sehen, welche Regeln sie abdecken, praktisch zum Prüfen der Muster an echten Seiten.
- **Zeitpläne** pro Regel (Tage + Uhrzeit, auch über Mitternacht).
- **Fokus-Sessions** (25/50/90 Min.): Alle aktiven Regeln sind hart gesperrt, ohne Ausnahmen, unabhängig von Zeitplan und Pause.
- **Selbstkontrolle:** „Durchatmen“-Wartezeit vor Ausnahmen, globale Pause, *Strikter Modus*, optionale **PIN** (für Ausnahmen, Pause, Lockern von Regeln, Fokus beenden und die Einstellungen).
- **Statistik:** Tageszeit pro Stunde, 7-Tage-Verlauf mit Vorwochenvergleich, größte Zeitfresser, **Tagesziel mit Serie**, Zeit im Toolbar-Badge.
- **Sync (optional):** Regeln und Einstellungen über das Browser-Konto; Bildschirmzeit, Pause und Fokus bleiben lokal.
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

- Selbstkontroll-Werkzeug, kein Kinderschutz: Wer die Erweiterung deaktiviert oder einen anderen Browser nutzt, umgeht sie. Auch die PIN ist eine Bremse gegen Impulse, keine Sicherheit.
- Die Seite lädt im Hintergrund weiter. Das Overlay erscheint nach rund 70–110 ms und damit vor dem ersten Paint (gemessen in `e2e/flicker.spec.js`, auf einer schnellen lokalen Fake-Seite). Auf sehr schnellen echten Seiten oder bei langsamer Festplatte kann ein kurzer Blitz möglich sein.
- Die Selektoren fürs Ausblenden (z. B. YouTube-Shorts-Regale) hängen vom Seitenaufbau ab, den die Plattformen gelegentlich ändern. Die Pfad-Sperren sind davon unabhängig.
- Die E2E-Tests laufen gegen kontrollierte Fake-Seiten unter den echten Hostnamen. Dass die Pfadmuster auch zu den *aktuellen* echten Seiten passen, muss man gelegentlich im Browser gegenprüfen.
- Die Erweiterung braucht Zugriff auf alle Webseiten, um die Adresse lokal mit deinen Regeln zu vergleichen.

## Entwicklung

```
manifest.json          Manifest V3
src/lib/               presets.js (Katalog) · engine.js (Matching, Limits, Zeitpläne, Fokus, PIN) · i18n.js
src/content/           content.js (Zeiterfassung, Ausblenden) · overlay.js (Sperr-Karte)
src/background.js      Service Worker (Nutzungsdaten, Overrides, PIN-Check, Sync, Badge)
src/popup/, src/options/, src/ui/   Oberfläche
tests/                 Unit-Tests (node:test)
e2e/                   Browser-Tests (Playwright, lädt die echte Erweiterung)
tools/                 make-icons.js · pack.js (ZIP für den Store) · screenshots.js
store/                 Listing-Text und Screenshots
```

```
npm install
npm test                 # Unit-Tests
npx playwright install chromium
npm run test:e2e         # Browser-Tests mit geladener Erweiterung
npm run pack             # dist/dopablock-<version>.zip
npm run screenshots      # store/screenshots/*.png
```

CI läuft über die gemeinsame Pipeline `vctrchappot/ci` (`.github/workflows/ci.yml`, Ergebnis `ci / check`).

Release: Tag `vX.Y.Z` pushen (muss zur `manifest.json`-Version passen), dann hängt `.github/workflows/release.yml` das Store-ZIP an ein GitHub-Release. Änderungen stehen im [CHANGELOG](CHANGELOG.md).

## Lizenz

[MIT](LICENSE)
