// ============================================================
//  utils/pathHelper.js
//  Rôle : construire tous les chemins de fichiers du projet
//         en un seul endroit, de façon cross-platform.
// ============================================================

// `path` est un module built-in de Node.js (pas de npm requis).
// Il sait gérer les différences de séparateurs :
//   Windows  →  C:\Users\projet\inventory.json
//   Linux/Mac →  /home/user/projet/inventory.json
const path = require('path');

// ------------------------------------------------------------------
// __dirname
// ------------------------------------------------------------------
// C'est une variable MAGIQUE fournie automatiquement par Node.js
// dans chaque fichier CommonJS.
// Elle contient le chemin ABSOLU du dossier qui contient CE fichier.
//
// Exemple concret :
//   Si ce fichier est à  /home/kalvin/food-api/utils/pathHelper.js
//   alors __dirname vaut  /home/kalvin/food-api/utils
//
// POURQUOI ne pas écrire './inventory.json' directement ?
// → './inventory.json' est RELATIF au répertoire de travail actuel
//   (process.cwd()), qui change selon D'OÙ on lance `node server.js`.
//   Si on lance depuis /home, le chemin sera /home/inventory.json → ❌
//   path.join(__dirname, ...) est toujours ancré sur le fichier lui-même → ✅
// ------------------------------------------------------------------

// path.join() assemble les morceaux de chemin intelligemment :
//   - Ajoute le bon séparateur (/ ou \)
//   - Normalise les doubles slashes, les '..' etc.

// Chemin absolu vers inventory.json (à la racine du projet)
// utils/pathHelper.js est dans /utils/, donc on remonte d'un niveau avec '..'
const INVENTORY_PATH = path.join(__dirname, '..', 'inventory.json');

// Chemin absolu vers app.log (à la racine du projet)
const LOG_PATH = path.join(__dirname, '..', 'app.log');

// ------------------------------------------------------------------
// module.exports — CommonJS
// ------------------------------------------------------------------
// En CommonJS, chaque fichier est un MODULE isolé.
// Rien n'est visible de l'extérieur SAUF ce qu'on met dans module.exports.
//
// Ici on exporte un objet avec deux propriétés.
// Les autres fichiers feront :
//   const { INVENTORY_PATH, LOG_PATH } = require('./pathHelper');
// ------------------------------------------------------------------
module.exports = { INVENTORY_PATH, LOG_PATH };
