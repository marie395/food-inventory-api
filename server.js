// ============================================================
//  server.js  —  Point d'entrée de l'application
//  Serveur HTTP brut Node.js, sans aucun framework.
//
//  Routes implémentées :
//    GET  /                    → statut du serveur
//    GET  /items               → tous les articles (+ filtre ?category=)
//    GET  /items/:id           → un article par son id  [BONUS]
//    POST /items               → ajouter un article
//    DELETE /items/:id         → supprimer un article   [BONUS]
//    GET  /logs                → contenu de app.log     [BONUS]
//    *                         → 404
// ============================================================

const http = require('http');   // Module built-in : créer un serveur TCP/HTTP
const fs   = require('fs');     // Module built-in : fichiers

// Nos modules maison
const { LOG_PATH }                            = require('./utils/pathhelper');
const { readItems, writeItems, filterByCategory } = require('./utils/inventory');


// ── Constantes ───────────────────────────────────────────────
const PORT       = 3000;
const START_TIME = Date.now();  // Horodatage du démarrage du serveur


// ============================================================
//  HELPER — logRequest(method, url, status)
// ============================================================
// Appelé après chaque requête pour écrire une ligne dans app.log.
// fs.appendFile AJOUTE à la fin du fichier sans l'écraser.
// Si le fichier n'existe pas, Node.js le crée automatiquement.
// ============================================================
function logRequest(method, url, status) {
  const line = `[${new Date().toISOString()}] ${method} ${url} → ${status}\n`;

  // Pas besoin d'attendre la fin de l'écriture du log pour continuer
  // → on ignore volontairement l'erreur éventuelle (log non critique)
  fs.appendFile(LOG_PATH, line, 'utf8', function(err) {
    if (err) console.error('Erreur écriture log :', err.message);
  });
}


// ============================================================
//  HELPER — sendJSON(res, statusCode, data)
// ============================================================
// Raccourci pour envoyer une réponse JSON propre.
// ============================================================
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}


// ============================================================
//  HELPER — parseBody(req, callback)
// ============================================================
// Le body d'une requête POST arrive en MORCEAUX (chunks) sur
// le réseau. Il faut écouter l'événement 'data' pour accumuler
// chaque morceau, puis 'end' pour savoir quand c'est fini.
//
// C'est la mécanique basse niveau qu'Express cache pour nous.
// ============================================================
function parseBody(req, callback) {
  let body = '';

  // Chaque fois qu'un morceau de données arrive :
  req.on('data', function(chunk) {
    body += chunk.toString(); // chunk est un Buffer → on le convertit en string
  });

  // Quand tous les morceaux sont arrivés :
  req.on('end', function() {
    try {
      const parsed = JSON.parse(body);
      callback(null, parsed);
    } catch (e) {
      callback(new Error('Body JSON invalide'), null);
    }
  });
}


// ============================================================
//  SERVEUR HTTP
// ============================================================
// http.createServer(handler) crée un serveur.
// Le handler est appelé à CHAQUE requête entrante avec :
//   req → IncomingMessage : tout sur la requête (méthode, URL, headers, body...)
//   res → ServerResponse  : on l'utilise pour écrire la réponse
// ============================================================
const server = http.createServer(function(req, res) {

  // On découpe l'URL pour séparer le chemin des query params
  // Exemple : '/items?category=grains'
  //   urlObj.pathname = '/items'
  //   urlObj.searchParams.get('category') = 'grains'
  const urlObj   = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;
  const method   = req.method;


  // ──────────────────────────────────────────────────────────
  //  Route : GET /
  //  Retourne le statut général du serveur
  // ──────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/') {
    const responseData = {
      status   : 'OK',
      uptime   : ((Date.now() - START_TIME) / 1000).toFixed(2) + 's',
      timestamp: new Date().toISOString(),
      message  : 'Food Inventory API — Node.js pur, sans framework'
    };

    sendJSON(res, 200, responseData);
    logRequest(method, pathname, 200);
    return; // Important : stoppe le handler ici
  }


  // ──────────────────────────────────────────────────────────
  //  Route : GET /items  ou  GET /items?category=xxx
  // ──────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/items') {

    // ── DÉMONSTRATION EVENT LOOP ──────────────────────────
    // Ce console.log s'exécute IMMÉDIATEMENT, AVANT que Node.js
    // ait fini de lire le fichier.
    //
    // Pourquoi ? Parce que fs.readFile est ASYNCHRONE :
    //   1. Node.js demande à l'OS de lire le fichier
    //   2. Node.js NE BLOQUE PAS — il continue à la ligne suivante
    //   3. "reading..." s'affiche tout de suite dans la console
    //   4. Plus tard (quelques ms), l'OS répond avec le contenu
    //   5. Node.js exécute le callback → les données sont disponibles
    //
    // C'est l'Event Loop : Node.js ne reste jamais "bloqué" à attendre.
    // Il gère d'autres requêtes pendant que le disque travaille.
    // ─────────────────────────────────────────────────────
    console.log('reading...'); // ← s'affiche AVANT le callback

    readItems(function(err, items) {
      // ↑ Ce callback est exécuté APRÈS que le fichier a été lu
      // (quelques millisecondes plus tard dans l'Event Loop)

      if (err) {
        sendJSON(res, 500, { error: 'Impossible de lire l\'inventaire' });
        logRequest(method, req.url, 500);
        return;
      }

      // Filtre optionnel par catégorie : GET /items?category=grains
      const category = urlObj.searchParams.get('category');
      const result   = category ? filterByCategory(items, category) : items;

      sendJSON(res, 200, { items: result, count: result.length });
      logRequest(method, req.url, 200);
    });

    return;
  }


  // ──────────────────────────────────────────────────────────
  //  [BONUS] Route : GET /items/:id
  //  Exemple : GET /items/2 → retourne l'article id=2
  // ──────────────────────────────────────────────────────────
  const matchSingleItem = pathname.match(/^\/items\/(\d+)$/);

  if (method === 'GET' && matchSingleItem) {
    const id = parseInt(matchSingleItem[1], 10); // Extrait le chiffre de l'URL

    readItems(function(err, items) {
      if (err) {
        sendJSON(res, 500, { error: 'Erreur lecture inventaire' });
        logRequest(method, pathname, 500);
        return;
      }

      const item = items.find(function(i) { return i.id === id; });

      if (!item) {
        sendJSON(res, 404, { error: `Article id=${id} introuvable` });
        logRequest(method, pathname, 404);
        return;
      }

      sendJSON(res, 200, item);
      logRequest(method, pathname, 200);
    });

    return;
  }


  // ──────────────────────────────────────────────────────────
  //  Route : POST /items
  //  Ajoute un nouvel article à l'inventaire
  //
  //  Body attendu (JSON) :
  //  {
  //    "name": "Maize",
  //    "category": "grains",
  //    "quantity": 100,
  //    "unit": "kg",
  //    "price": 400
  //  }
  //
  //  Pipeline asynchrone enchaîné :
  //    parseBody → readItems → [validation] → writeItems → réponse
  //
  //  Difficulté principale : chaque opération async doit s'imbriquer
  //  dans le callback de la précédente (callback hell).
  //  C'est exactement pour ça qu'ont été inventées les Promises/async-await !
  // ──────────────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/items') {

    // Étape 1 : lire et parser le body de la requête
    parseBody(req, function(parseErr, body) {
      if (parseErr) {
        sendJSON(res, 400, { error: parseErr.message });
        logRequest(method, pathname, 400);
        return;
      }

      // Validation basique — tous les champs requis doivent être présents
      if (!body.name || !body.category || body.quantity == null || !body.unit || body.price == null) {
        sendJSON(res, 400, {
          error : 'Champs requis manquants',
          requis: ['name', 'category', 'quantity', 'unit', 'price']
        });
        logRequest(method, pathname, 400);
        return;
      }

      // Étape 2 : lire les articles existants
      readItems(function(readErr, items) {
        if (readErr) {
          sendJSON(res, 500, { error: 'Erreur lecture inventaire' });
          logRequest(method, pathname, 500);
          return;
        }

        // Créer le nouvel article avec un id auto-incrémenté
        const maxId  = items.reduce(function(max, i) { return Math.max(max, i.id); }, 0);
        const newItem = {
          id      : maxId + 1,
          name    : body.name,
          category: body.category,
          quantity: Number(body.quantity),
          unit    : body.unit,
          price   : Number(body.price)
        };

        items.push(newItem); // Ajouter au tableau en mémoire

        // Étape 3 : réécrire le fichier avec le tableau mis à jour
        writeItems(items, function(writeErr) {
          if (writeErr) {
            sendJSON(res, 500, { error: 'Erreur écriture inventaire' });
            logRequest(method, pathname, 500);
            return;
          }

          // 201 Created = article créé avec succès
          sendJSON(res, 201, { message: 'Article créé', item: newItem });
          logRequest(method, pathname, 201);
        });
      });
    });

    return;
  }


  // ──────────────────────────────────────────────────────────
  //  [BONUS] Route : DELETE /items/:id
  //  Supprime un article par son id
  // ──────────────────────────────────────────────────────────
  const matchDelete = pathname.match(/^\/items\/(\d+)$/);

  if (method === 'DELETE' && matchDelete) {
    const id = parseInt(matchDelete[1], 10);

    readItems(function(err, items) {
      if (err) {
        sendJSON(res, 500, { error: 'Erreur lecture inventaire' });
        logRequest(method, pathname, 500);
        return;
      }

      const index = items.findIndex(function(i) { return i.id === id; });

      if (index === -1) {
        sendJSON(res, 404, { error: `Article id=${id} introuvable` });
        logRequest(method, pathname, 404);
        return;
      }

      // Retire l'article du tableau (splice modifie en place et retourne les éléments retirés)
      const deleted = items.splice(index, 1)[0];

      writeItems(items, function(writeErr) {
        if (writeErr) {
          sendJSON(res, 500, { error: 'Erreur écriture inventaire' });
          logRequest(method, pathname, 500);
          return;
        }

        sendJSON(res, 200, { message: 'Article supprimé', item: deleted });
        logRequest(method, pathname, 200);
      });
    });

    return;
  }


  // ──────────────────────────────────────────────────────────
  //  [BONUS] Route : GET /logs
  //  Retourne le contenu de app.log comme tableau de lignes
  // ──────────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/logs') {
    fs.readFile(LOG_PATH, 'utf8', function(err, data) {
      if (err) {
        // Si le fichier log n'existe pas encore (aucune requête avant celle-ci)
        sendJSON(res, 200, { logs: [] });
        logRequest(method, pathname, 200);
        return;
      }

      // Découper par lignes, filtrer les lignes vides
      const lines = data.split('\n').filter(function(l) { return l.trim() !== ''; });
      sendJSON(res, 200, { logs: lines, count: lines.length });
      logRequest(method, pathname, 200);
    });

    return;
  }


  // ──────────────────────────────────────────────────────────
  //  Route 404 — toute URL non reconnue
  // ──────────────────────────────────────────────────────────
  sendJSON(res, 404, {
    error : 'Route introuvable',
    routes: [
      'GET  /',
      'GET  /items',
      'GET  /items?category=<cat>',
      'GET  /items/:id',
      'POST /items',
      'DELETE /items/:id',
      'GET  /logs'
    ]
  });
  logRequest(method, pathname, 404);
});


// ============================================================
//  Démarrage du serveur
// ============================================================
server.listen(PORT, function() {
  console.log(`✅  Food Inventory API démarrée sur http://localhost:${PORT}`);
  console.log(`📁  Logs écrits dans app.log`);
  console.log(`⏰  Démarrée à ${new Date().toISOString()}\n`);

  // Écrire la première ligne dans app.log au démarrage
  fs.appendFile(LOG_PATH, `[${new Date().toISOString()}] SERVER STARTED on port ${PORT}\n`, 'utf8', function() {});
});







{/* Pourquoi utiliser path.join(__dirname, "inventory.json") ?

Parce qu'il construit un chemin compatible avec tous les systèmes d'exploitation (Windows, Linux, macOS). __dirname garantit également que le fichier sera trouvé même si l'application est lancée depuis un autre dossier.

2. Qu'est-ce que module.exports ?

module.exports permet d'exporter des fonctions ou variables d'un module afin qu'elles puissent être utilisées dans d'autres fichiers via require(). Les fonctions non exportées restent privées au module et ne sont pas accessibles depuis l'extérieur.

3. Combien d'opérations asynchrones dans POST /items ?

Trois opérations principales :

Réception du body (req.on("data"))
Lecture du fichier (fs.readFile)
Écriture du fichier (fs.writeFile)

La difficulté principale est la gestion de l'enchaînement des callbacks et des erreurs à chaque étape.
*/}