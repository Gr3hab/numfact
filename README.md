# NUMIGMA → CIPHRO

NUMIGMA heißt seit November 2026 **CIPHRO** und liegt unter **https://ciphro.eu** (Repository [`Gr3hab/ciphro`](https://github.com/Gr3hab/ciphro), dort auch der ganze Verlauf).

Diese alte Adresse `https://gr3hab.github.io/numfact/` leitet nur noch weiter, damit alte Links (WhatsApp & Co.) und gespeicherte Spielstände nicht verloren gehen.

## Was hier passiert

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Leitet nach `https://ciphro.eu/` weiter, mit denselben Angaben (`?n=…&m=…&lang=…`) |
| `en/index.html` | Dasselbe nach `https://ciphro.eu/en/` |
| `404.html` | Jede andere Adresse unter `/numfact/` landet ebenfalls bei ciphro.eu (`/en/…` auf Englisch) |
| `sw.js` | Ersetzt die alte Offline-Hilfe: löscht deren Zwischenspeicher (`numigma-…`) und meldet sich ab |
| `og*.png`, `icon*.png` | Bleiben für früher geteilte Vorschauen und Home-Bildschirm-Apps |
| `_dev/` | Tests der Weiterleitung (für GitHub Pages unsichtbar) |

**Spielstand:** Der Browser speichert pro Adresse. Die Weiterleitung liest deshalb den Spielstand dieser Adresse (`numfact.v2`) und gibt ihn im Anker mit: `#import=<Base64url von JSON>`. Der Anker wird nie an einen Server geschickt. ciphro.eu übernimmt den Stand, entfernt den Anker sofort und sagt einmal „NUMIGMA heißt jetzt CIPHRO. Dein Spielstand ist mitgekommen.“ Ohne Spielstand heißt der Anker `#moved`. Der Spielstand bleibt hier außerdem liegen, ein zweiter Besuch schadet nicht.

**Linkvorschau:** Die Seiten hier zeigen schon Namen, Text und Bild von CIPHRO (Bilder von ciphro.eu), damit neu geteilte alte Links richtig aussehen.

## Tests

```
cd _dev && npm install && npm test
```

Mit `CIPHRO_DIR=/pfad/zu/ciphro npm test` läuft zusätzlich der ganze Umzug mit dem echten neuen Spiel.

## Reihenfolge beim Umstellen

1. `Gr3hab/ciphro` ist unter https://ciphro.eu live (Pages, eigene Domain, HTTPS).
2. Erst dann diese Weiterleitung nach `main` mergen.
