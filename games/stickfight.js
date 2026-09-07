module.exports = {
    name: "Stick Fight",
    id: "stickfight",
    description: "Combat de stickman en solo contre une IA, avec difficulté, rounds et pouvoirs spéciaux.",
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">

<style>
* {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
}

html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    overscroll-behavior: none;
    font-family: Arial, sans-serif;
}

body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    touch-action: none;
}

#box {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    touch-action: none;
}

canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    -webkit-user-drag: none;
}
</style>
</head>

<body>

<div id="box">
    <canvas id="game"></canvas>
</div>

<script>
(() => {
    const box = document.getElementById("box");
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");

    let W = 360;
    let H = 560;
    let dpr = 1;

    function size() {
        const rect = box.getBoundingClientRect();

        W = Math.max(220, Math.floor(rect.width));
        H = Math.max(300, Math.floor(rect.height));

        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);

        canvas.style.width = W + "px";
        canvas.style.height = H + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* =========================
       STATE
    ========================= */

    let state = "MENU_DIFFICULTY";

    let botDifficulty = "medium";
    let roundsTotal = 3;
    let winsNeeded = 2;

    let playerWins = 0;
    let botWins = 0;
    let currentRound = 1;

    let countdownTimer = 0;
    let roundEndTimer = 0;
    let roundEndText = "";
    let matchEndText = "";

    let particles = [];
    let projectiles = [];

    let menuButtons = [];

    const GROUND_MARGIN = 0.12;

    const DIFF_SETTINGS = {
        easy: {
            speed: 2.1,
            reaction: 55,
            punchChance: 0.32,
            powerChance: 0.10,
            powerCooldown: 210,
            dodgeChance: 0.04,
            label: "FACILE"
        },
        medium: {
            speed: 2.6,
            reaction: 34,
            punchChance: 0.48,
            powerChance: 0.18,
            powerCooldown: 160,
            dodgeChance: 0.10,
            label: "MOYEN"
        },
        hard: {
            speed: 3.3,
            reaction: 17,
            punchChance: 0.62,
            powerChance: 0.28,
            powerCooldown: 120,
            dodgeChance: 0.20,
            label: "DIFFICILE"
        }
    };

    function groundY() {
        return H * (1 - GROUND_MARGIN);
    }

    /* =========================
       FIGHTERS
    ========================= */

    function makeFighter(x, color, isBot) {
        return {
            x,
            y: groundY(),
            vx: 0,
            vy: 0,
            facing: isBot ? -1 : 1,
            grounded: true,
            health: 100,
            maxHealth: 100,
            color,
            isBot,

            punchCooldown: 0,
            punchActiveTimer: 0,
            punchHasHit: false,

            powerCooldown: 0,

            hitStun: 0,
            koFlashTimer: 0,

            walkCycle: 0,

            aiIntent: {
                moveDir: 0,
                wantsPunch: false,
                wantsPower: false,
                wantsJump: false
            },
            aiReactionTimer: 0
        };
    }

    let player = null;
    let bot = null;

    /* =========================
       CONTROLS (joystick + buttons)
    ========================= */

    let joyVec = { x: 0, y: 0 };
    let joyActive = false;
    let joyJumpArmed = true;

    const pointerMap = new Map();

    function joyCenter() {
        return { x: W * 0.20, y: H * 0.80 };
    }

    function joyRadius() {
        return Math.min(W, H) * 0.14;
    }

    function punchBtn() {
        return {
            x: W * 0.86,
            y: H * 0.83,
            r: Math.min(W, H) * 0.085
        };
    }

    function powerBtn() {
        return {
            x: W * 0.68,
            y: H * 0.70,
            r: Math.min(W, H) * 0.065
        };
    }

    function dist(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;

        return Math.sqrt(dx * dx + dy * dy);
    }

    function pointInRect(px, py, r) {
        return px >= r.x && px <= r.x + r.w &&
            py >= r.y && py <= r.y + r.h;
    }

    /* =========================
       MENU BUTTON HELPERS
    ========================= */

    function drawMenuButton(x, y, w, h, label, sub) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = "#ffd23f";
        ctx.lineWidth = 2;

        roundRect(x, y, w, h, 12);

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 20px Arial";

        ctx.fillText(label, x + w / 2, y + h / 2 + (sub ? -4 : 7));

        if (sub) {
            ctx.font = "12px Arial";
            ctx.fillStyle = "#94a3b8";

            ctx.fillText(sub, x + w / 2, y + h / 2 + 16);
        }

        menuButtons.push({ x, y, w, h, label });
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /* =========================
       MATCH FLOW
    ========================= */

    function startRound() {
        player = makeFighter(W * 0.28, "#3498db", false);
        bot = makeFighter(W * 0.72, "#e74c3c", true);

        projectiles = [];
        particles = [];

        countdownTimer = 130;
        state = "COUNTDOWN";
    }

    function beginMatch() {
        winsNeeded = Math.ceil(roundsTotal / 2);
        playerWins = 0;
        botWins = 0;
        currentRound = 1;

        startRound();
    }

    function endRound(winnerIsPlayer) {
        if (state === "ROUND_END" || state === "MATCH_END") return;

        if (winnerIsPlayer) {
            playerWins++;
            roundEndText = "TU GAGNES LE ROUND " + currentRound + " !";
        } else {
            botWins++;
            roundEndText = "LE BOT GAGNE LE ROUND " + currentRound + " !";
        }

        roundEndTimer = 100;
        state = "ROUND_END";
    }

    function afterRoundEnd() {
        if (playerWins >= winsNeeded) {
            matchEndText = "VICTOIRE !";
            state = "MATCH_END";
            return;
        }

        if (botWins >= winsNeeded) {
            matchEndText = "DÉFAITE...";
            state = "MATCH_END";
            return;
        }

        currentRound++;
        startRound();
    }

    /* =========================
       PARTICLES
    ========================= */

    function spawnHitParticles(x, y) {
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 1.5 + Math.random() * 4;

            particles.push({
                x, y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 1,
                color: Math.random() < 0.5 ? "#fff" : "#ffd23f",
                size: 2 + Math.random() * 3
            });
        }
    }

    /* =========================
       COMBAT LOGIC
    ========================= */

    const PUNCH_RANGE_RATIO = 0.11;
    const PUNCH_DAMAGE = 9;
    const POWER_DAMAGE = 16;
    const PUNCH_COOLDOWN_MAX = 26;
    const PUNCH_ACTIVE_MAX = 9;

    function tryPunch(fighter) {
        if (fighter.punchCooldown > 0) return;
        if (fighter.hitStun > 0) return;

        fighter.punchCooldown = PUNCH_COOLDOWN_MAX;
        fighter.punchActiveTimer = PUNCH_ACTIVE_MAX;
        fighter.punchHasHit = false;
    }

    function tryPower(fighter) {
        if (fighter.powerCooldown > 0) return;
        if (fighter.hitStun > 0) return;

        const settings = fighter.isBot
            ? DIFF_SETTINGS[botDifficulty]
            : null;

        fighter.powerCooldown = settings
            ? settings.powerCooldown
            : 170;

        projectiles.push({
            x: fighter.x + fighter.facing * 20,
            y: groundY() - H * 0.09,
            vx: fighter.facing * (Math.min(W, H) * 0.045),
            owner: fighter.isBot ? "bot" : "player",
            radius: Math.min(W, H) * 0.028
        });
    }

    function applyDamage(target, amount, fromX) {
        target.health = Math.max(0, target.health - amount);

        target.hitStun = 14;

        const dir = target.x < fromX ? -1 : 1;

        target.vx = dir * 3.6;
        target.vy = -3;

        spawnHitParticles(target.x, groundY() - H * 0.09);
    }

    /* =========================
       UPDATE
    ========================= */

    function updateFighterPhysics(f, dt) {
        f.vy += 0.32 * dt;

        f.x += f.vx * dt;
        f.y += f.vy * dt;

        f.vx *= Math.pow(0.86, dt);

        const minX = W * 0.08;
        const maxX = W * 0.92;

        f.x = Math.max(minX, Math.min(maxX, f.x));

        if (f.y >= groundY()) {
            f.y = groundY();
            f.vy = 0;
            f.grounded = true;
        } else {
            f.grounded = false;
        }

        if (f.punchCooldown > 0) f.punchCooldown -= dt;
        if (f.punchActiveTimer > 0) f.punchActiveTimer -= dt;
        if (f.powerCooldown > 0) f.powerCooldown -= dt;
        if (f.hitStun > 0) f.hitStun -= dt;
    }

    function updatePlayerControl(dt) {
        if (player.hitStun > 0) return;

        const speed = 2.9;

        player.vx += joyVec.x * speed * 0.5 * dt;

        if (joyVec.y < -0.6 && joyJumpArmed && player.grounded) {
            player.vy = -8.2;
            player.grounded = false;
            joyJumpArmed = false;
        }

        if (joyVec.y >= -0.6) {
            joyJumpArmed = true;
        }
    }

    function updateAI(dt) {
        const settings = DIFF_SETTINGS[botDifficulty];

        bot.aiReactionTimer -= dt;

        if (bot.aiReactionTimer <= 0) {
            bot.aiReactionTimer = settings.reaction * (0.7 + Math.random() * 0.6);

            const d = bot.x - player.x;
            const adist = Math.abs(d);

            const intent = bot.aiIntent;

            intent.wantsPunch = false;
            intent.wantsPower = false;
            intent.wantsJump = false;

            if (adist < W * PUNCH_RANGE_RATIO * 1.3) {

                intent.moveDir = 0;

                if (Math.random() < settings.punchChance) {
                    intent.wantsPunch = true;
                }

                if (Math.random() < settings.dodgeChance) {
                    intent.moveDir = d > 0 ? 1 : -1;
                }

            } else if (adist < W * 0.42) {

                if (Math.random() < settings.powerChance) {
                    intent.wantsPower = true;
                    intent.moveDir = 0;
                } else {
                    intent.moveDir = d > 0 ? 1 : -1;
                }

            } else {

                intent.moveDir = d > 0 ? 1 : -1;

                if (Math.random() < settings.dodgeChance * 0.5) {
                    intent.wantsJump = true;
                }

            }

        }

        if (bot.hitStun <= 0) {

            bot.vx += bot.aiIntent.moveDir * settings.speed * 0.5 * dt;

            if (bot.aiIntent.wantsJump && bot.grounded) {
                bot.vy = -8;
                bot.grounded = false;
            }

            if (bot.aiIntent.wantsPunch) {
                tryPunch(bot);
            }

            if (bot.aiIntent.wantsPower) {
                tryPower(bot);
            }

        }
    }

    function updateFacing() {
        player.facing = bot.x >= player.x ? 1 : -1;
        bot.facing = player.x >= bot.x ? 1 : -1;
    }

    function checkPunchHit(attacker, defender) {
        if (attacker.punchActiveTimer <= 0) return;
        if (attacker.punchHasHit) return;

        const reach = W * PUNCH_RANGE_RATIO;

        const inFront =
            (attacker.facing === 1 && defender.x > attacker.x) ||
            (attacker.facing === -1 && defender.x < attacker.x);

        if (!inFront) return;

        if (Math.abs(defender.x - attacker.x) <= reach) {
            attacker.punchHasHit = true;

            applyDamage(defender, PUNCH_DAMAGE, attacker.x);
        }
    }

    function updateProjectiles(dt) {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];

            p.x += p.vx * dt;

            const target = p.owner === "player" ? bot : player;

            if (dist(p.x, p.y, target.x, groundY() - H * 0.09) < p.radius + 18) {

                applyDamage(target, POWER_DAMAGE, p.x);

                projectiles.splice(i, 1);

                continue;
            }

            if (p.x < -30 || p.x > W + 30) {
                projectiles.splice(i, 1);
            }
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];

            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vy += 0.15 * dt;
            pt.life -= 0.045 * dt;

            if (pt.life <= 0) particles.splice(i, 1);
        }
    }

    function update(dt) {
        if (state === "COUNTDOWN") {
            countdownTimer -= dt;

            if (countdownTimer <= 0) {
                state = "FIGHT";
            }

            return;
        }

        if (state === "ROUND_END") {
            roundEndTimer -= dt;

            if (roundEndTimer <= 0) {
                afterRoundEnd();
            }

            return;
        }

        if (state !== "FIGHT") return;

        updatePlayerControl(dt);
        updateAI(dt);

        updateFighterPhysics(player, dt);
        updateFighterPhysics(bot, dt);

        updateFacing();

        checkPunchHit(player, bot);
        checkPunchHit(bot, player);

        updateProjectiles(dt);
        updateParticles(dt);

        if (bot.health <= 0) {
            endRound(true);
        } else if (player.health <= 0) {
            endRound(false);
        }
    }

    /* =========================
       DRAWING
    ========================= */

    function drawStickman(f) {
        const feetY = f.y;
        const legH = H * 0.09;
        const bodyH = H * 0.11;
        const headR = H * 0.032;

        const hipY = feetY - legH;
        const shoulderY = hipY - bodyH;
        const headY = shoulderY - headR - 2;

        ctx.save();

        if (f.hitStun > 0 && Math.floor(f.hitStun / 3) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        ctx.strokeStyle = f.color;
        ctx.fillStyle = f.color;
        ctx.lineWidth = Math.max(3, H * 0.012);
        ctx.lineCap = "round";

        const legSwing = f.grounded
            ? Math.sin(f.walkCycle) * 10
            : 6;

        ctx.beginPath();
        ctx.moveTo(f.x, hipY);
        ctx.lineTo(f.x - 8 - (f.grounded ? legSwing : 0), feetY);
        ctx.moveTo(f.x, hipY);
        ctx.lineTo(f.x + 8 + (f.grounded ? legSwing : 0), feetY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(f.x, hipY);
        ctx.lineTo(f.x, shoulderY);
        ctx.stroke();

        const punching = f.punchActiveTimer > 0;

        ctx.beginPath();
        ctx.moveTo(f.x, shoulderY + 6);

        if (punching) {
            ctx.lineTo(
                f.x + f.facing * 22,
                shoulderY + 4
            );
        } else {
            ctx.lineTo(f.x - f.facing * 6, shoulderY + 16);
        }

        ctx.moveTo(f.x, shoulderY + 6);
        ctx.lineTo(f.x + f.facing * 6, shoulderY + 16);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(f.x, headY, headR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (f.grounded && Math.abs(f.vx) > 0.3) {
            f.walkCycle += 0.35;
        }
    }

    function drawProjectile(p) {
        ctx.save();

        ctx.fillStyle = "#7ef9ff";
        ctx.shadowColor = "#7ef9ff";
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawArena() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1a1a2e");
        g.addColorStop(1, "#0f0f1a");

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#25253d";
        ctx.fillRect(0, groundY(), W, H - groundY());

        ctx.strokeStyle = "#3d3d5c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groundY());
        ctx.lineTo(W, groundY());
        ctx.stroke();
    }

    function drawHealthBars() {
        const barW = W * 0.38;
        const barH = 16;

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(12, 14, barW, barH);
        ctx.fillRect(W - 12 - barW, 14, barW, barH);

        ctx.fillStyle = "#3498db";
        ctx.fillRect(12, 14, barW * (player.health / player.maxHealth), barH);

        ctx.fillStyle = "#e74c3c";
        const bw = barW * (bot.health / bot.maxHealth);
        ctx.fillRect(W - 12 - bw, 14, bw, barH);

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(12, 14, barW, barH);
        ctx.strokeRect(W - 12 - barW, 14, barW, barH);

        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Arial";
        ctx.fillText("TOI", 12, 40);

        ctx.textAlign = "right";
        ctx.fillText("BOT", W - 12, 40);

        ctx.textAlign = "center";
        ctx.font = "bold 14px Arial";
        ctx.fillStyle = "#ffd23f";
        ctx.fillText("ROUND " + currentRound, W / 2, 26);

        for (let i = 0; i < roundsTotal; i++) {
            const cx = W / 2 - (roundsTotal - 1) * 8 + i * 16;

            ctx.beginPath();
            ctx.arc(cx, 40, 5, 0, Math.PI * 2);

            if (i < playerWins) {
                ctx.fillStyle = "#3498db";
            } else if (i < playerWins + botWins && i >= roundsTotal - botWins) {
                ctx.fillStyle = "#e74c3c";
            } else {
                ctx.fillStyle = "rgba(255,255,255,0.25)";
            }

            ctx.fill();
        }
    }

    function drawJoystick() {
        const c = joyCenter();
        const r = joyRadius();

        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        const kx = c.x + joyVec.x * r * 0.6;
        const ky = c.y + joyVec.y * r * 0.6;

        ctx.beginPath();
        ctx.arc(kx, ky, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,210,63,0.85)";
        ctx.fill();
    }

    function drawActionButtons() {
        const pb = punchBtn();
        const pw = powerBtn();

        ctx.beginPath();
        ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
        ctx.fillStyle = player.punchCooldown > 0
            ? "rgba(255,255,255,0.15)"
            : "rgba(231,76,60,0.75)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = (pb.r * 1.1) + "px Arial";
        ctx.fillStyle = "#fff";
        ctx.fillText("👊", pb.x, pb.y + 2);

        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);

        const ready = player.powerCooldown <= 0;

        ctx.fillStyle = ready
            ? "rgba(126,249,255,0.8)"
            : "rgba(255,255,255,0.15)";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = (pw.r * 1.1) + "px Arial";
        ctx.fillText("⚡", pw.x, pw.y + 2);

        if (!ready) {
            const settings = DIFF_SETTINGS[botDifficulty];
            const frac = player.powerCooldown / 170;

            ctx.beginPath();
            ctx.moveTo(pw.x, pw.y);
            ctx.arc(
                pw.x, pw.y, pw.r + 5,
                -Math.PI / 2,
                -Math.PI / 2 + frac * Math.PI * 2
            );
            ctx.closePath();

            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fill();
        }

        ctx.textBaseline = "alphabetic";
    }

    function drawCountdown() {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd23f";
        ctx.font = "bold 60px Arial";

        let txt = "GO !";

        if (countdownTimer > 90) txt = "3";
        else if (countdownTimer > 50) txt = "2";
        else if (countdownTimer > 10) txt = "1";

        ctx.fillText(txt, W / 2, H / 2);
    }

    function drawRoundEnd() {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd23f";
        ctx.font = "bold 24px Arial";

        ctx.fillText(roundEndText, W / 2, H / 2);
    }

    function drawMatchEnd() {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";

        ctx.fillStyle = matchEndText === "VICTOIRE !" ? "#2ecc71" : "#e74c3c";
        ctx.font = "bold 36px Arial";
        ctx.fillText(matchEndText, W / 2, H * 0.4);

        ctx.fillStyle = "#fff";
        ctx.font = "18px Arial";
        ctx.fillText(
            playerWins + " - " + botWins,
            W / 2,
            H * 0.48
        );

        menuButtons = [];

        drawMenuButton(
            W / 2 - 90, H * 0.58, 180, 50,
            "REJOUER"
        );
    }

    function drawMenuDifficulty() {
        ctx.fillStyle = "#0d0d1a";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 28px Arial";
        ctx.fillText("STICK FIGHT", W / 2, H * 0.18);

        ctx.font = "14px Arial";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Choisis la difficulté", W / 2, H * 0.25);

        menuButtons = [];

        const bw = Math.min(240, W * 0.7);
        const bx = W / 2 - bw / 2;

        drawMenuButton(bx, H * 0.34, bw, 54, "FACILE");
        drawMenuButton(bx, H * 0.34 + 66, bw, 54, "MOYEN");
        drawMenuButton(bx, H * 0.34 + 132, bw, 54, "DIFFICILE");
    }

    function drawMenuRounds() {
        ctx.fillStyle = "#0d0d1a";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px Arial";
        ctx.fillText("STICK FIGHT", W / 2, H * 0.18);

        ctx.font = "14px Arial";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Nombre de rounds", W / 2, H * 0.25);

        menuButtons = [];

        const bw = Math.min(240, W * 0.7);
        const bx = W / 2 - bw / 2;

        drawMenuButton(bx, H * 0.34, bw, 54, "1 ROUND");
        drawMenuButton(bx, H * 0.34 + 66, bw, 54, "3 ROUNDS");
        drawMenuButton(bx, H * 0.34 + 132, bw, 54, "5 ROUNDS");
    }

    function draw() {
        if (state === "MENU_DIFFICULTY") {
            drawMenuDifficulty();
            return;
        }

        if (state === "MENU_ROUNDS") {
            drawMenuRounds();
            return;
        }

        drawArena();

        drawStickman(player);
        drawStickman(bot);

        for (const p of projectiles) drawProjectile(p);

        for (const pt of particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, pt.life);
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        drawHealthBars();

        if (state === "FIGHT") {
            drawJoystick();
            drawActionButtons();
        }

        if (state === "COUNTDOWN") drawCountdown();
        if (state === "ROUND_END") drawRoundEnd();
        if (state === "MATCH_END") drawMatchEnd();
    }

    /* =========================
       INPUT
    ========================= */

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();

        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function handleMenuTap(pos) {
        for (const b of menuButtons) {
            if (pointInRect(pos.x, pos.y, b)) {

                if (state === "MENU_DIFFICULTY") {

                    if (b.label === "FACILE") botDifficulty = "easy";
                    else if (b.label === "MOYEN") botDifficulty = "medium";
                    else botDifficulty = "hard";

                    state = "MENU_ROUNDS";

                } else if (state === "MENU_ROUNDS") {

                    if (b.label === "1 ROUND") roundsTotal = 1;
                    else if (b.label === "3 ROUNDS") roundsTotal = 3;
                    else roundsTotal = 5;

                    beginMatch();

                } else if (state === "MATCH_END") {

                    state = "MENU_DIFFICULTY";

                }

                return true;
            }
        }

        return false;
    }

    function handleDown(id, pos) {
        if (state === "MENU_DIFFICULTY" || state === "MENU_ROUNDS" || state === "MATCH_END") {
            handleMenuTap(pos);
            return;
        }

        if (state !== "FIGHT") return;

        const c = joyCenter();
        const r = joyRadius();

        if (dist(pos.x, pos.y, c.x, c.y) <= r * 1.6 && !joyActive) {
            joyActive = true;

            pointerMap.set(id, "joystick");

            updateJoystick(pos);

            return;
        }

        const pb = punchBtn();

        if (dist(pos.x, pos.y, pb.x, pb.y) <= pb.r * 1.3) {
            pointerMap.set(id, "punch");

            tryPunch(player);

            return;
        }

        const pw = powerBtn();

        if (dist(pos.x, pos.y, pw.x, pw.y) <= pw.r * 1.3) {
            pointerMap.set(id, "power");

            tryPower(player);

            return;
        }
    }

    function handleMove(id, pos) {
        const role = pointerMap.get(id);

        if (role !== "joystick") return;

        updateJoystick(pos);
    }

    function handleUp(id) {
        const role = pointerMap.get(id);

        if (role === "joystick") {
            joyActive = false;
            joyVec.x = 0;
            joyVec.y = 0;
        }

        pointerMap.delete(id);
    }

    /*
      SUPPORT_POINTER_EVENTS:
      Most modern WebViews (including recent WhatsApp in-app views)
      support the Pointer Events API. Some older Android System
      WebView builds do not handle it reliably, so we fall back
      to classic Touch Events in that case to guarantee the
      controls still work.
    */

    const SUPPORT_POINTER_EVENTS =
        typeof window.PointerEvent !== "undefined";

    function onPointerDown(e) {
        e.preventDefault();

        handleDown(e.pointerId, getPos(e));
    }

    function updateJoystick(pos) {
        const c = joyCenter();
        const r = joyRadius();

        let dx = pos.x - c.x;
        let dy = pos.y - c.y;

        const d = Math.sqrt(dx * dx + dy * dy);

        if (d > r) {
            dx = (dx / d) * r;
            dy = (dy / d) * r;
        }

        joyVec.x = dx / r;
        joyVec.y = dy / r;
    }

    function onPointerMove(e) {
        if (pointerMap.get(e.pointerId) !== "joystick") return;

        e.preventDefault();

        handleMove(e.pointerId, getPos(e));
    }

    function onPointerUp(e) {
        e.preventDefault();

        handleUp(e.pointerId);
    }

    /*
      TOUCH FALLBACK (older WebViews without full Pointer Events support)
    */

    function touchPos(touch) {
        const rect = canvas.getBoundingClientRect();

        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    function onTouchStart(e) {
        e.preventDefault();

        for (const t of e.changedTouches) {
            handleDown(t.identifier, touchPos(t));
        }
    }

    function onTouchMove(e) {
        e.preventDefault();

        for (const t of e.changedTouches) {
            handleMove(t.identifier, touchPos(t));
        }
    }

    function onTouchEnd(e) {
        e.preventDefault();

        for (const t of e.changedTouches) {
            handleUp(t.identifier);
        }
    }

    if (SUPPORT_POINTER_EVENTS) {

        canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
        canvas.addEventListener("pointermove", onPointerMove, { passive: false });
        canvas.addEventListener("pointerup", onPointerUp, { passive: false });
        canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
        canvas.addEventListener("pointerleave", onPointerUp, { passive: false });

    } else {

        canvas.addEventListener("touchstart", onTouchStart, { passive: false });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd, { passive: false });
        canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

        /* Also cover the rare case of a mouse-only WebView */
        canvas.addEventListener("mousedown", (e) => {
            handleDown("mouse", getPos(e));
        });

        window.addEventListener("mousemove", (e) => {
            handleMove("mouse", getPos(e));
        });

        window.addEventListener("mouseup", () => {
            handleUp("mouse");
        });

    }

    /* =========================
       MAIN LOOP
    ========================= */

    let lastTime = performance.now();

    function loop(now) {
        const dt = Math.min((now - lastTime) / 16.6667, 3);

        lastTime = now;

        update(dt);
        draw();

        requestAnimationFrame(loop);
    }

    window.addEventListener("resize", () => {
        size();
    });

    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            size();
        });

        observer.observe(box);
    }

    size();

    requestAnimationFrame(loop);
})();
</script>

</body>
</html>`
};
