// Copie les fichiers web dans www/ (dossier lu par Capacitor). Icônes dans www/icons/.
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "www");
const files = ["index.html", "app.js", "logic.js", "styles.css", "manifest.webmanifest", "sw.js"];
const icons = ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "icons"), { recursive: true });
for (const f of files) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));
for (const f of icons) fs.copyFileSync(path.join(__dirname, f), path.join(out, "icons", f));
console.log("www/ prêt");
