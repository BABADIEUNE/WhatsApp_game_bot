const express = require("express");
const fs = require("fs");
const path = require("path");

const GAMES_DIR = path.join(__dirname, "games");

/*
  Charge tous les fichiers de jeux (module.exports = { name, id, description, html })
  présents dans /games et les indexe par leur "id".
*/
function loadGames() {
    const games = new Map();

    const files = fs
        .readdirSync(GAMES_DIR)
        .filter((f) => f.endsWith(".js"));

    for (const file of files) {
        const fullPath = path.join(GAMES_DIR, file);

        try {
            delete require.cache[require.resolve(fullPath)];

            const game = require(fullPath);

            if (!game || !game.id || !game.html) {
                console.warn(
                    "[games] Fichier ignoré (format invalide) :",
                    file
                );
                continue;
            }

            games.set(game.id, game);

            console.log(
                "[games] Chargé :",
                game.id,
                "->",
                game.name
            );

        } catch (e) {
            console.error(
                "[games] Erreur en chargeant",
                file,
                ":",
                e.message
            );
        }
    }

    return games;
}

function createServer() {
    const app = express();

    let games = loadGames();

    app.get("/game/:id", (req, res) => {
        const game = games.get(req.params.id);

        if (!game) {
            res.status(404).send("Jeu introuvable.");
            return;
        }

        res.set("Content-Type", "text/html; charset=utf-8");
        res.send(game.html);
    });

    /* Petite page d'accueil pour vérifier que le serveur tourne */
    app.get("/", (req, res) => {
        const list = Array.from(games.values())
            .map((g) => `<li><a href="/game/${g.id}">${g.name}</a></li>`)
            .join("");

        res.send(`
            <h1>WhatsApp Game Bot - Serveur de jeux</h1>
            <p>${games.size} jeu(x) chargé(s) :</p>
            <ul>${list}</ul>
        `);
    });

    return { app, getGames: () => games, reloadGames: () => { games = loadGames(); } };
}

module.exports = { createServer, loadGames, GAMES_DIR };
