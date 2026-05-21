// ============================================================
//  utils/inventory.js
//  Rôle : toutes les opérations sur les données d'inventaire.
//         Lire, écrire, filtrer — sans jamais construire
//         de chemin manuellement (on importe pathHelper).
// ============================================================

// Module built-in pour lire et écrire des fichiers
const fs = require('fs');

// On importe nos chemins centralisés — jamais './inventory.json' en dur ici !
const { INVENTORY_PATH } = require('./pathhelper');


// ============================================================
//  readItems(callback)
// ============================================================
// Lit le fichier inventory.json de façon ASYNCHRONE.
//
// "Asynchrone" signifie que Node.js ne BLOQUE PAS en attendant
// que le disque réponde. Il lance la lecture, continue à exécuter
// d'autres choses, puis appelle notre callback quand c'est prêt.
//
// Pattern callback classique Node.js : callback(erreur, données)
//   - Si tout va bien  : callback(null, items)
//   - Si erreur        : callback(err, null)
// ============================================================
function readItems(callback) {
  // fs.readFile lit le fichier en entier en mémoire
  // 'utf8' → on veut du texte, pas un Buffer binaire
  fs.readFile(INVENTORY_PATH, 'utf8', function(err, data) {
    // Si Node.js n'a pas pu lire le fichier (permissions, inexistant...)
    if (err) {
      return callback(err, null);
    }

    // Le fichier est une chaîne JSON → on la transforme en objet JS
    try {
      const parsed = JSON.parse(data);
      // On renvoie le tableau d'articles (pas l'objet entier)
      callback(null, parsed.items);
    } catch (parseError) {
      // Le fichier existe mais contient du JSON invalide
      callback(parseError, null);
    }
  });
}


// ============================================================
//  writeItems(items, callback)
// ============================================================
// Écrit un tableau d'articles dans inventory.json.
// Remplace tout le contenu existant.
//
// items    → tableau JS d'articles
// callback → appelé avec (err) quand l'écriture est terminée
// ============================================================
function writeItems(items, callback) {
  // On reconstruit l'objet complet { items: [...] }
  const data = JSON.stringify({ items: items }, null, 2);
  //                                              ^^^^^^
  //                              null = pas de remplaçant
  //                              2    = indentation de 2 espaces (lisible)

  // fs.writeFile ÉCRASE le fichier entier
  fs.writeFile(INVENTORY_PATH, data, 'utf8', function(err) {
    callback(err); // err sera null si tout s'est bien passé
  });
}


// ============================================================
//  filterByCategory(items, category)
// ============================================================
// Filtre PUREMENT en mémoire — pas de lecture de fichier ici.
// Cette fonction est SYNCHRONE et pure :
//   - Même entrée → toujours même sortie
//   - Ne modifie pas le tableau original (Array.filter retourne un nouveau tableau)
//
// Exemple :
//   filterByCategory(items, 'grains') → [{ id:2, name:'Rice', ... }]
// ============================================================
function filterByCategory(items, category) {
  // On compare en minuscules pour être insensible à la casse
  // 'Grains', 'GRAINS', 'grains' → tous trouvés
  return items.filter(function(item) {
    return item.category.toLowerCase() === category.toLowerCase();
  });
}


// ============================================================
//  module.exports — ce qu'on rend PUBLIC
// ============================================================
// Les trois fonctions ci-dessus sont exportées → utilisables ailleurs.
// Si on avait des fonctions "privées" (helpers internes), on ne les
// mettrait PAS dans module.exports — elles resteraient invisibles
// depuis l'extérieur du module. C'est l'encapsulation en CommonJS.
// ============================================================
module.exports = { readItems, writeItems, filterByCategory };
