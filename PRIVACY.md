# Datenschutzerklärung / Privacy Policy – Dopablock

_Stand: 2026-11-21_

## Deutsch

**Dopablock sammelt, sendet und verkauft keine Daten.** Die Erweiterung hat keinen Server, keine Konten, keine Analyse- oder Werbe-Dienste und lädt keinen Code von außen nach.

**Was gespeichert wird (lokal im Browser, `chrome.storage`):**
- deine Regeln und Einstellungen (inkl. optional einem PIN-Hash),
- die gemessene Zeit pro Regel und Stunde sowie Zähler gestoppter Seitenaufrufe.

Es wird **kein Verlauf besuchter Adressen** gespeichert. Gezählt wird nur die Zeit auf Bereichen, für die du eine Regel angelegt hast, und nur als Sekunden pro Regel.

**Warum „Zugriff auf alle Webseiten“?** Die Erweiterung vergleicht die Adresse der aktuellen Seite lokal mit deinen Regeln und greift nur bei Treffern ein (Overlay, Ausblenden von Elementen, Zeitmessung). Auf allen anderen Seiten passiert nichts. Die Adresse verlässt dabei nie das Gerät.

**Optionale Synchronisierung:** Wenn du sie aktivierst, werden Regeln und Einstellungen (nicht die Bildschirmzeit) über `chrome.storage.sync` vom Browser-Konto des Browsers übertragen. Dafür gelten die Datenschutzbestimmungen deines Browser-Anbieters.

**Berechtigungen:** `storage` (Regeln/Statistik), `alarms` (Badge aktualisieren), `favicon` (Seiten-Icons in der Oberfläche), Host-Zugriff auf http/https-Seiten (siehe oben).

**Löschen:** Einstellungen → „Verlauf löschen“ bzw. „Alles zurücksetzen“, oder die Erweiterung entfernen.

## English

**Dopablock does not collect, transmit or sell any data.** There is no server, no account, no analytics or ads, and no remote code.

**What is stored (locally in the browser, `chrome.storage`):** your rules and settings (including an optional PIN hash), and the measured time per rule and hour plus a counter of stopped page views. **No browsing history is stored** – only seconds per rule for sections you created a rule for.

**Why "access to all websites"?** The extension compares the current page address with your rules locally and only acts on matches. The address never leaves your device.

**Optional sync:** if enabled, rules and settings (not screen time) are mirrored through `chrome.storage.sync` via your browser account, subject to your browser vendor's privacy terms.

**Permissions:** `storage`, `alarms` (badge refresh), `favicon` (site icons in the UI), host access to http/https pages (see above).

**Deleting data:** Settings → "Clear usage history" / "Reset everything", or uninstall the extension.
