require("dotenv").config();

const path = require("path");
const readline = require("readline");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    fetchLatestWaWebVersion,
    DisconnectReason,
    delay
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");

const { createServer } = require("./server");

const PREFIX = process.env.PREFIX || "!";
const BASE_URL = process.env.BASE_URL;
const PORT = process.env.PORT || 3000;
const PHONE_NUMBER = (process.env.PHONE_NUMBER || "").replace(/[^0-9]/g, "");

if (!BASE_URL) {
    console.error(
        "[config] ERREUR : la variable BASE_URL n'est pas définie dans .env\n" +
        "         C'est l'URL publique (ex: via ngrok ou ton hébergeur) où\n" +
        "         ce serveur est joignable. Sans ça, les liens envoyés dans\n" +
        "         WhatsApp ne s'ouvriront pas correctement."
    );
    process.exit(1);
}

const AUTH_DIR = path.join(__dirname, "auth_info");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function startBot() {
    const { app, getGames, reloadGames } = createServer();

    app.listen(PORT, () => {
        console.log(`[server] Serveur de jeux lancé sur le port ${PORT}`);
        console.log(`[server] URL publique configurée : ${BASE_URL}`);
    });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    /*
      IMPORTANT (bug connu Baileys #2679) : fetchLatestBaileysVersion() peut
      renvoyer une version de "WhatsApp Web" périmée tout en annonçant
      isLatest: true, ce qui fait échouer le pairing avec "Couldn't link
      device" côté téléphone. fetchLatestWaWebVersion() renvoie la vraie
      version actuelle. On l'utilise en priorité, avec repli si absente
      (versions plus anciennes de la lib).
    */

    let version;

    try {
        if (typeof fetchLatestWaWebVersion === "function") {
            ({ version } = await fetchLatestWaWebVersion());
        } else {
            ({ version } = await fetchLatestBaileysVersion());
        }
    } catch (e) {
        console.error(
            "[version] Erreur lors de la récupération de la version, " +
            "repli sur fetchLatestBaileysVersion :",
            e.message
        );
        ({ version } = await fetchLatestBaileysVersion());
    }

    console.log("[version] Version WhatsApp Web utilisée :", version);

    const LOG_LEVEL = process.env.LOG_LEVEL || "silent";

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: LOG_LEVEL }),
        browser: ["Game Bot", "Chrome", "1.0.0"]
    });

    /* =========================
       CONNEXION PAR PAIRING CODE
    ========================= */

    if (!sock.authState.creds.registered) {

        let phone = PHONE_NUMBER;

        if (!phone) {
            phone = (await ask(
                "Entre ton numéro WhatsApp au format international, sans + (ex: 33612345678) : "
            )).replace(/[^0-9]/g, "");
        }

        await delay(1500);

        try {
            const code = await sock.requestPairingCode(phone);

            console.log("\n==================================");
            console.log(" CODE DE JUMELAGE (PAIRING CODE) :");
            console.log(" " + code);
            console.log("==================================");
            console.log(
                "Sur ton téléphone : WhatsApp > Paramètres > Appareils liés\n" +
                "> Lier un appareil > \"Lier avec un numéro de téléphone à la place\"\n" +
                "puis entre ce code.\n"
            );
        } catch (e) {
            console.error("[pairing] Erreur lors de la demande du code :", e);
        }
    }

    /* =========================
       ÉVÉNEMENTS DE CONNEXION
    ========================= */

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("[connexion] Bot connecté avec succès à WhatsApp !");
        }

        if (connection === "close") {
            const statusCode =
                lastDisconnect &&
                lastDisconnect.error instanceof Boom
                    ? lastDisconnect.error.output.statusCode
                    : null;

            const loggedOut = statusCode === DisconnectReason.loggedOut;

            console.log(
                "[connexion] Fermée. Code :",
                statusCode,
                "| déconnecté définitivement :",
                loggedOut
            );

            if (!loggedOut) {
                startBot();
            } else {
                console.log(
                    "[connexion] Session invalidée. Supprime le dossier " +
                    "auth_info/ et relance le bot pour un nouveau pairing code."
                );
            }
        }
    });

    sock.ev.on("creds.update", saveCreds);

    /* =========================
       GESTION DES COMMANDES
    ========================= */

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        const msg = messages[0];

        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        const text = (
            msg.message.conversation ||
            (msg.message.extendedTextMessage &&
                msg.message.extendedTextMessage.text) ||
            ""
        ).trim();

        if (!text.startsWith(PREFIX)) return;

        const commandBody = text.slice(PREFIX.length).trim().toLowerCase();
        const [command] = commandBody.split(/\s+/);

        const games = getGames();

        /* Commande liste des jeux */
        if (command === "jeux" || command === "games" || command === "menu") {
            const list = Array.from(games.values())
                .map((g) => `• ${PREFIX}${g.id} — ${g.name}`)
                .join("\n");

            await sock.sendMessage(jid, {
                text: `🎮 *Jeux disponibles*\n\n${list}\n\nTape une commande pour recevoir le lien du jeu.`
            });

            return;
        }

        /* Commande d'aide */
        if (command === "help" || command === "aide") {
            await sock.sendMessage(jid, {
                text:
                    `🎮 *Bot de mini-jeux*\n\n` +
                    `Tape *${PREFIX}jeux* pour voir la liste complète.\n` +
                    `Tape *${PREFIX}<nomdujeu>* pour recevoir le lien d'un jeu ` +
                    `(ex: *${PREFIX}flappy*, *${PREFIX}snake*...).`
            });

            return;
        }

        /* Commande correspondant à un jeu précis */
        const game = games.get(command);

        if (!game) return;

        const url = `${BASE_URL.replace(/\/$/, "")}/game/${game.id}`;

        await sock.sendMessage(jid, {
            text: `🎮 *${game.name}*\n${game.description || "Tape sur la carte pour jouer 👇"}`,
            contextInfo: {
                externalAdReply: {
                    title: game.name,
                    body: "Tape pour jouer",
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    showAdAttribution: false,
                    sourceUrl: url
                }
            }
        });
    });

    return sock;
}

startBot().catch((e) => {
    console.error("[fatal] Erreur au démarrage du bot :", e);
    process.exit(1);
});
