module.exports = {
    name: "Knife Hit",
    id: "knife",
    description: "Lance les couteaux sur la cible sans toucher les couteaux déjà plantés.",
    html: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">

<style>
* {
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
}

html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    font-family: Arial, sans-serif;
}

body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111;
}

#box {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: manipulation;
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

    let W = 320;
    let H = 400;
    let dpr = 1;

    let rotation = 0;
    let rotSpeed = 0.035;

    let knivesInTarget = [];
    let knivesLeft = 7;
    let score = 0;
    let stage = 1;

    let flyingKnife = null;
    let alive = false;

    let flash = 0;
    let message = "";
    let messageTimer = 0;

    const TARGET_RADIUS = 42;
    const TARGET_Y_RATIO = 0.22;
    const KNIFE_COLLISION_ANGLE = 0.14;

    function normalizeAngle(angle) {
        angle %= Math.PI * 2;

        if (angle < 0) {
            angle += Math.PI * 2;
        }

        return angle;
    }

    function angleDistance(a, b) {
        let d = Math.abs(normalizeAngle(a) - normalizeAngle(b));

        if (d > Math.PI) {
            d = Math.PI * 2 - d;
        }

        return d;
    }

    function size() {
        const rect = box.getBoundingClientRect();

        W = Math.max(160, Math.floor(rect.width));
        H = Math.max(180, Math.floor(rect.height));

        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);

        canvas.style.width = W + "px";
        canvas.style.height = H + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function targetCenterY() {
        return H * TARGET_Y_RATIO;
    }

    function resetGame() {
        rotation = 0;
        knivesInTarget = [];
        knivesLeft = 7;
        score = 0;
        stage = 1;
        flyingKnife = null;
        alive = true;
        flash = 0;
        message = "";
        messageTimer = 0;
    }

    function throwKnife() {
        if (!alive) return;
        if (flyingKnife) return;
        if (knivesLeft <= 0) return;

        flyingKnife = {
            x: W / 2,
            y: H - 55,
            vy: -620
        };

        knivesLeft--;
    }

    function lose(reason) {
        alive = false;
        flyingKnife = null;

        flash = 0.35;

        message = reason || "PERDU !";
        messageTimer = 2.2;
    }

    function update(dt) {
        if (flash > 0) {
            flash -= dt;
        }

        if (messageTimer > 0) {
            messageTimer -= dt;
        }

        if (!alive) return;

        rotation += rotSpeed * dt * 60;

        if (flyingKnife) {
            flyingKnife.y += flyingKnife.vy * dt;

            const centerY = targetCenterY();

            if (flyingKnife.y <= centerY + TARGET_RADIUS + 12) {

                const hitAngle = normalizeAngle(
                    Math.PI / 2 - rotation
                );

                let collision = false;

                for (const plantedAngle of knivesInTarget) {
                    if (
                        angleDistance(hitAngle, plantedAngle)
                        < KNIFE_COLLISION_ANGLE
                    ) {
                        collision = true;
                        break;
                    }
                }

                if (collision) {
                    lose("COUTEAU TOUCHÉ !");
                    return;
                }

                knivesInTarget.push(hitAngle);
                flyingKnife = null;

                score++;

                if (knivesLeft === 0) {
                    stage++;
                    knivesLeft = Math.min(7 + stage - 1, 12);

                    rotSpeed += 0.004;

                    message = "STAGE " + stage + " !";
                    messageTimer = 1.3;
                }
            }
        }
    }

    function drawBackground() {
        ctx.fillStyle = "#171717";
        ctx.fillRect(0, 0, W, H);
    }

    function drawTarget() {
        const cx = W / 2;
        const cy = targetCenterY();

        ctx.save();

        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        ctx.beginPath();
        ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);

        ctx.fillStyle = "#c0392b";
        ctx.fill();

        ctx.lineWidth = 6;
        ctx.strokeStyle = "#eee";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, TARGET_RADIUS - 12, 0, Math.PI * 2);

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#8e241b";
        ctx.stroke();

        ctx.restore();
    }

    function drawPlantedKnives() {
        const cx = W / 2;
        const cy = targetCenterY();

        for (const angle of knivesInTarget) {
            ctx.save();

            ctx.translate(cx, cy);
            ctx.rotate(angle);

            drawKnife(0, TARGET_RADIUS + 2);

            ctx.restore();
        }
    }

    function drawKnife(x, y) {
        ctx.save();

        ctx.translate(x, y);

        ctx.fillStyle = "#eee";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(4, 0);
        ctx.lineTo(4, 30);
        ctx.lineTo(0, 40);
        ctx.lineTo(-4, 30);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#555";

        ctx.fillRect(-5, 38, 10, 18);

        ctx.restore();
    }

    function drawFlyingKnife() {
        if (!flyingKnife) return;

        ctx.save();

        ctx.translate(
            flyingKnife.x,
            flyingKnife.y
        );

        drawKnife(0, 0);

        ctx.restore();
    }

    function drawUI() {
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.font = "bold 17px Arial";

        ctx.fillText(
            "Score : " + score,
            12,
            25
        );

        ctx.textAlign = "right";

        ctx.fillText(
            "Couteaux : " + knivesLeft,
            W - 12,
            25
        );

        ctx.textAlign = "center";

        ctx.font = "bold 15px Arial";

        ctx.fillText(
            "STAGE " + stage,
            W / 2,
            H - 18
        );
    }

    function drawMessage() {
        if (alive && messageTimer <= 0) return;

        if (!alive) {
            ctx.fillStyle = "rgba(0,0,0,.55)";
            ctx.fillRect(0, 0, W, H);
        }

        ctx.textAlign = "center";

        ctx.fillStyle = "#fff";
        ctx.font = "bold 27px Arial";

        ctx.fillText(
            message || "KNIFE HIT",
            W / 2,
            H * 0.55
        );

        if (!alive) {
            ctx.font = "15px Arial";

            ctx.fillText(
                "Appuie pour recommencer",
                W / 2,
                H * 0.63
            );
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        drawBackground();
        drawTarget();
        drawPlantedKnives();
        drawFlyingKnife();
        drawUI();

        if (flash > 0) {
            ctx.fillStyle = "rgba(255,0,0," +
                Math.min(flash, 0.35) + ")";

            ctx.fillRect(0, 0, W, H);
        }

        drawMessage();
    }

    let lastTime = performance.now();

    function loop(now) {
        const dt = Math.min(
            (now - lastTime) / 1000,
            0.035
        );

        lastTime = now;

        update(dt);
        draw();

        requestAnimationFrame(loop);
    }

    function input(e) {
        if (e) e.preventDefault();

        if (!alive) {
            resetGame();
            return;
        }

        throwKnife();
    }

    canvas.addEventListener(
        "pointerdown",
        input,
        { passive: false }
    );

    document.addEventListener(
        "keydown",
        e => {
            if (e.code === "Space") {
                input(e);
            }
        }
    );

    window.addEventListener(
        "resize",
        () => {
            size();
            draw();
        }
    );

    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            size();
            draw();
        });

        observer.observe(box);
    }

    size();
    resetGame();

    requestAnimationFrame(loop);
})();
</script>

</body>
</html>`
};
