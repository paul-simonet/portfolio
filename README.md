# Portfolio · Paul Simonet

Mon portfolio d'élève-ingénieur (ESILV × Institute for Future Technologies) : biomatériaux en mycélium, capteurs et prototypage.

**En ligne : [portfolio-paul-simonet.vercel.app](https://portfolio-paul-simonet.vercel.app/)**

## Le site

Un site statique écrit à la main, en HTML, CSS et JavaScript, sans framework ni étape de build.

- `index.html` : la page entière (styles, contenu et script principal).
- `intro.js` : l'entrée animée en 3D (forêt → champignon → mycélium), avec Three.js chargé depuis un CDN. Elle est sautée si le navigateur ne gère pas WebGL, si WebGL est rendu par le processeur faute de vrai GPU (c'est le cas des robots de test comme PageSpeed Insights), ou si l'option « réduire les animations » est activée. Un petit script dans le `<head>` de `index.html` prend cette décision avant le premier affichage.
- `fonts/` : les polices (Bricolage Grotesque, Instrument Sans, IBM Plex Mono), copiées depuis Google Fonts et servies par le site pour ne pas bloquer l'affichage. `vercel.json` les met en cache pour un an.
- `assets/` : les photos des projets.
- `cv.pdf`, `cv-en.pdf` : mon CV en français et en anglais.

## Le lancer en local

Ouvrir `index.html` dans un navigateur, ou servir le dossier avec n'importe quel serveur statique :

```sh
npx serve .
```
