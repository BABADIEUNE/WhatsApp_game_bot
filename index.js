require("dotenv").config();

const path = require("path");
const readline = require("readline");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    delay,
    proto,
    generateWAMessageFromContent,
    isJidGroup
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");

const { createServer } = require("./server");

const PREFIX = process.env.PREFIX || "!";
const BASE_URL = process.env.BASE_URL;
const PORT = process.env.PORT || 3000;
const PHONE_NUMBER = (process.env.PHONE_NUMBER || "").replace(/[^0-9]/g, "");
const MENU_PAGE_SIZE = 6;

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

function jsonButton(name, params) {
    return {
        name,
        buttonParamsJson: JSON.stringify(params)
    };
}

/**
 * Envoie un vrai message WhatsApp Native Flow avec generateWAMessageFromContent.
 *
 * Important : WhatsApp ne permet pas d'exécuter arbitrairement du HTML/JavaScript
 * directement dans une bulle de chat. Ici, l'interactivité native est utilisée
 * pour le menu, les réponses rapides et les boutons qui ouvrent le jeu HTML5.
 */
function buildMixedNativeFlowBizNode() {
    return {
        tag: "biz",
        attrs: {
            actual_actors: "2",
            host_storage: "2",
            privacy_mode_ts: (Math.floor(Date.now() / 1000) - 77980457).toString()
        },
        content: [
            {
                tag: "interactive",
                attrs: { type: "native_flow", v: "1" },
                content: [
                    {
                        tag: "native_flow",
                        attrs: { v: "9", name: "mixed" }
                    }
                ]
            },
            {
                tag: "quality_control",
                attrs: { source_type: "third_party" }
            }
        ]
    };
}

async function sendInteractiveMessage(sock, jid, { title, body, footer, buttons, quoted }) {
    try {
        const nativeFlowButtons = buttons.map((button) =>
            proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create(button)
        );

        const interactive = proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({
                text: body || ""
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
                text: footer || ""
            }),
            header: proto.Message.InteractiveMessage.Header.create({
                title: title || "",
                hasMediaAttachment: false
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: nativeFlowButtons,
                messageParamsJson: "{}",
                messageVersion: 1
            })
        });

        const generated = generateWAMessageFromContent(
            jid,
            { interactiveMessage: interactive },
            {
                quoted,
                userJid: sock.user?.id
            }
        );

        const bizNode = buildMixedNativeFlowBizNode();
        const botNode = { tag: "bot", attrs: { biz_bot: "1" } };
        const additionalNodes = isJidGroup(jid)
            ? [bizNode]
            : [botNode, bizNode];

        await sock.relayMessage(jid, generated.message, {
            messageId: generated.key.id,
            additionalNodes
        });

        return true;
    } catch (error) {
        console.error("[interactive] Impossible d'envoyer le message interactif :", error);
        return false;
    }
}

function getButtonId(msg) {
    const nativeFlow = msg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage;

    if (nativeFlow?.paramsJson) {
        try {
            const params = JSON.parse(nativeFlow.paramsJson);
            return params.id || params.selected_id || params.selected_row_id || params.row_id || null;
        } catch (_) {}
    }

    const buttonResponse = msg?.message?.buttonsResponseMessage;
    if (buttonResponse?.selectedButtonId) return buttonResponse.selectedButtonId;

    const templateResponse = msg?.message?.templateButtonReplyMessage;
    if (templateResponse?.selectedId) return templateResponse.selectedId;

    return null;
}

async function sendGameCard(sock, jid, game, quoted) {
    const url = `${BASE_URL.replace(/\/$/, "")}/game/${game.id}`;

    const sent = await sendInteractiveMessage(sock, jid, {
        title: `🎮 ${game.name}`,
        body: `${game.description || "Un mini-jeu HTML5."}\n\nChoisis une action ci-dessous 👇`,
        footer: "WhatsApp Game Bot",
        quoted,
        buttons: [
            jsonButton("cta_url", {
                display_text: "▶️ JOUER",
                url,
                merchant_url: url
            }),
            jsonButton("quick_reply", {
                display_text: "🎮 AUTRES JEUX",
                id: "games_menu"
            }),
            jsonButton("quick_reply", {
                display_text: "ℹ️ AIDE",
                id: "help_menu"
            })
        ]
    });

    // Fallback volontaire : si WhatsApp/Baileys refuse le Native Flow,
    // le bot continue de fonctionner avec un message classique + aperçu URL.
    if (!sent) {
        await sock.sendMessage(jid, {
            text: `🎮 *${game.name}*\n${game.description || ""}\n\n▶️ Jouer : ${url}`,
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
        }, { quoted });
    }
}

async function sendGamesMenu(sock, jid, games, quoted, page = 0) {
    const allGames = Array.from(games.values());
    const totalPages = Math.max(1, Math.ceil(allGames.length / MENU_PAGE_SIZE));
    const safePage = Math.min(Math.max(Number(page) || 0, 0), totalPages - 1);
    const start = safePage * MENU_PAGE_SIZE;
    const visibleGames = allGames.slice(start, start + MENU_PAGE_SIZE);

    const rows = visibleGames.map((game) => ({
        header: "🎮",
        title: game.name,
        description: game.description || `Jouer à ${game.name}`,
        id: `game:${game.id}`
    }));

    const buttons = [
        jsonButton("single_select", {
            title: `🎮 CHOISIR UN JEU (${safePage + 1}/${totalPages})`,
            sections: [
                {
                    title: `Mini-jeux ${start + 1}-${Math.min(start + MENU_PAGE_SIZE, allGames.length)}`,
                    rows
                }
            ]
        })
    ];

    if (safePage > 0) {
        buttons.push(jsonButton("quick_reply", {
            display_text: "⬅️ PRÉCÉDENT",
            id: `games_page:${safePage - 1}`
        }));
    }

    if (safePage < totalPages - 1) {
        buttons.push(jsonButton("quick_reply", {
            display_text: "➡️ SUIVANT",
            id: `games_page:${safePage + 1}`
        }));
    }

    buttons.push(jsonButton("quick_reply", {
        display_text: "ℹ️ AIDE",
        id: "help_menu"
    }));

    const sent = await sendInteractiveMessage(sock, jid, {
        title: "🎮 MINI-JEUX",
        body: `Il y a ${games.size} jeu(x) disponible(s).\nPage ${safePage + 1}/${totalPages}.\n\nChoisis ton jeu 👇`,
        footer: "WhatsApp Game Bot",
        quoted,
        buttons
    });

    if (!sent) {
        const list = allGames
            .map((g) => `• ${PREFIX}${g.id} — ${g.name}`)
            .join("\n");

        await sock.sendMessage(jid, {
            text: `🎮 *Jeux disponibles*\n\n${list}\n\nTape une commande pour jouer.`
        }, { quoted });
    }
}

async function sendHelp(sock, jid, quoted) {
    await sendInteractiveMessage(sock, jid, {
        title: "ℹ️ AIDE",
        body:
            `🎮 *Bot de mini-jeux*\n\n` +
            `• ${PREFIX}jeux — ouvrir le menu interactif\n` +
            `• ${PREFIX}<jeu> — ouvrir directement un jeu\n\n` +
            `Tu peux aussi utiliser les boutons directement dans WhatsApp.`,
        footer: "WhatsApp Game Bot",
        quoted,
        buttons: [
            jsonButton("quick_reply", {
                display_text: "🎮 OUVRIR LES JEUX",
                id: "games_menu"
            })
        ]
    });
}

async function startBot() {
    const { app, getGames } = createServer();

    app.listen(PORT, () => {
        console.log(`[server] Serveur de jeux lancé sur le port ${PORT}`);
        console.log(`[server] URL publique configurée : ${BASE_URL}`);
    });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const LOG_LEVEL = process.env.LOG_LEVEL || "silent";

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: LOG_LEVEL }),
        browser: ["Game Bot", "Chrome", "1.0.0"]
    });

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

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue;

                const jid = msg.key.remoteJid;
                const buttonId = getButtonId(msg);

                // Réponses aux boutons Native Flow.
                if (buttonId) {
                    const games = getGames();

                    if (buttonId === "games_menu") {
                        await sendGamesMenu(sock, jid, games, msg, 0);
                        continue;
                    }

                    if (buttonId.startsWith("games_page:")) {
                        const page = Number(buttonId.slice("games_page:".length));
                        await sendGamesMenu(sock, jid, games, msg, page);
                        continue;
                    }

                    if (buttonId === "help_menu") {
                        await sendHelp(sock, jid, msg);
                        continue;
                    }

                    if (buttonId.startsWith("game:")) {
                        const gameId = buttonId.slice("game:".length).toLowerCase();
                        const game = games.get(gameId);

                        if (game) {
                            await sendGameCard(sock, jid, game, msg);
                        } else {
                            await sendGamesMenu(sock, jid, games, msg);
                        }

                        continue;
                    }
                }

                const text = (
                    msg.message.conversation ||
                    (msg.message.extendedTextMessage &&
                        msg.message.extendedTextMessage.text) ||
                    ""
                ).trim();

                if (!text.startsWith(PREFIX)) continue;

                const commandBody = text.slice(PREFIX.length).trim().toLowerCase();
                const [command] = commandBody.split(/\s+/);
                const games = getGames();

                if (command === "jeux" || command === "games" || command === "menu") {
                    await sendGamesMenu(sock, jid, games, msg);
                    continue;
                }

                if (command === "help" || command === "aide") {
                    await sendHelp(sock, jid, msg);
                    continue;
                }

                const game = games.get(command);
                if (!game) continue;

                await sendGameCard(sock, jid, game, msg);
            } catch (error) {
                console.error("[messages] Erreur lors du traitement d'un message :", error);
            }
        }
    });

    return sock;
}

startBot().catch((e) => {
    console.error("[fatal] Erreur au démarrage du bot :", e);
    process.exit(1);
});
