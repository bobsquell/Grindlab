# GrindLab pour Android (APK)

Budget, revenus, épargne, garde-robe. Simulateur local : tes données restent sur le téléphone.

> Simulation basée sur des hypothèses modifiables. Ni conseil financier, ni prévision.

Le projet enveloppe l'app web dans une app Android avec Capacitor. L'APK se compile automatiquement
sur GitHub : rien à installer sur ton ordinateur.

## Obtenir l'APK (5 minutes)

1. Crée un dépôt GitHub (privé ou public) et pousse ce dossier dedans, branche `main`.
2. Sur GitHub : onglet **Actions** > **Build APK** > **Run workflow** (il se lance aussi à chaque push).
3. Quand le travail est vert (3 à 6 minutes), ouvre l'exécution et télécharge l'artefact
   **GrindLab-apk** (un zip qui contient `app-debug.apk`).
4. Envoie `app-debug.apk` sur ton téléphone (câble, Drive, mail).

## Installer sur le téléphone

1. Ouvre le fichier APK.
2. Android demande d'autoriser l'installation depuis cette source : accepte pour cette fois seulement.
3. Si Play Protect avertit que l'app est inconnue, choisis « Installer quand même » : c'est normal,
   l'APK est signé avec une clé de debug, pas publié sur le Play Store.

## Remarques

- C'est un APK **debug** : parfait pour un usage perso, pas pour le Play Store. Pour publier, il faut
  une clé de signature de release (`./gradlew bundleRelease` avec un keystore).
- Le workflow n'a pas été exécuté avant livraison (pas de SDK Android là où il a été écrit). S'il
  échoue, ouvre le journal de l'étape rouge : l'erreur est presque toujours explicite.
- iPhone : pas d'APK. Utilise la version web installable (« Sur l'écran d'accueil »).

## Mettre à jour l'app

Modifie les fichiers web (`app.js`, `logic.js`, `styles.css`, `index.html`), pousse sur `main` : un
nouvel APK est compilé. Pour l'installer par-dessus l'ancien, garde le même `appId` (`com.grindlab.app`).

## Compiler en local (optionnel)

Il faut Node 20, JDK 17 et le SDK Android (ou Android Studio) :

```bash
npm install
npm run build:web
npx cap add android
pip install pillow && python scripts/apply_icons.py android/app/src/main/res
npx cap sync android
cd android && ./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

## Fichiers

```
index.html, app.js, logic.js, styles.css   l'application
manifest.webmanifest, sw.js, icons/        version web installable (PWA)
capacitor.config.json                      identifiant et nom de l'app Android
scripts/copy-web.js                        prépare le dossier www/
scripts/apply_icons.py                     met les icônes GrindLab dans le projet Android
.github/workflows/build-apk.yml            compilation automatique de l'APK
tests/logic.test.js                        tests de la logique
```
