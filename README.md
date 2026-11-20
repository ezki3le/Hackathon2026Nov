# Arcy / Sound radar

Démo locale du challenge 09. L’équipe peut la lancer avec Python 3 et un navigateur récent. Les quatre extraits, les résultats du CNN, les cartes de contribution et les fonds IGN de Verdun sont inclus.

## Lancer la démo

Depuis la racine du dépôt, exécuter :

```sh
python -m http.server 8749 --bind 127.0.0.1 --directory arcy-ecoute
```

Selon l’installation, utiliser `python3` ou `py -3` à la place de `python`. Ouvrir [la station dans le navigateur](http://127.0.0.1:8749/). Le serveur HTTP local permet au navigateur d’analyser le son pendant la lecture. Arrêter le serveur avec Ctrl+C.

## Parcours de présentation

1. Cliquer sur le spectrogramme pour lancer un extrait de cinq secondes. Un second clic met en pause. Le trait blanc suit la lecture et l’ambre indique les bandes les plus intenses.
2. À la fin, le voyant indique la classe prédite. Le calque violet montre les contributions positives au score de cette classe sur le spectrogramme présenté au modèle.
3. Ouvrir la carte de l’événement dans le journal pour comparer la prédiction, l’annotation et la décision de vérification vidéo. Les badges A1, A2 et A3 rejouent le même enregistrement avec trois niveaux simulés.
4. Choisir **Extrait suivant** pour poursuivre. Le troisième extrait, `c5_0025`, montre une erreur de classification que l’équipe peut expliquer au public.

## Repères pour reprendre le projet

- `index.html` et `style.css` définissent l’interface.
- `spectrum.js` pilote la lecture, le spectrogramme calculé dans le navigateur et le calque de contribution.
- `app.js` relie les extraits, les voyants, la carte et le journal.
- `clip-results.js` contient les sorties précalculées de MobileNetV3-Small sur les quatre clips de validation, le seuil vidéo et l’empreinte de l’export ONNX utilisé. Le navigateur lit ces sorties à la fin de chaque extrait.
- `assets/` contient les WAV, les PNG log-mel d’entrée du modèle, les calques `*-cam.png`, le logo et la cartographie. Les stations et leurs jauges sont simulées. Les clips proviennent du kit du challenge.
