module.exports = {
    name: "Fruit Ninja",
    id: "ninja",
    description: "Tranche les fruits qui volent avec ton doigt sans toucher les bombes.",
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
    background: #0a0a0a;
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
    touch-action: none;
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
    let H = 480;
    let dpr = 1;

    let state = "READY";

    let score = 0;
    let combo = 0;
    let comboTimer = 0;
    let lives = 3;

    let best = 0;

    try {
        best = Number(localStorage.getItem("ninja_best")) || 0;
    } catch (e) {}

    let objects = [];
    let particles = [];

    let trail = [];
    let pointerDown = false;

    let spawnTimer = 0;
    let spawnInterval = 55;
    let difficultyTimer = 0;

    const GRAVITY = 0.32;

    const FRUIT_TYPES = [
        { color: "#e74c3c", inner: "#c0392b", name: "pomme" },
        { color: "#f1c40f", inner: "#e67e22", name: "citron" },
        { color: "#2ecc71", inner: "#27ae60", name: "pomme verte" },
        { color: "#e67e22", inner: "#d35400", name: "orange" },
        { color: "#9b59b6", inner: "#8e44ad", name: "prune" }
    ];

    function size() {
        const rect = box.getBoundingClientRect();

        W = Math.max(160, Math.floor(rect.width));
        H = Math.max(220, Math.floor(rect.height));

        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);

        canvas.style.width = W + "px";
        canvas.style.height = H + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resetGame() {
        score = 0;
        combo = 0;
        comboTimer = 0;
        lives = 3;

        objects = [];
        particles = [];
        trail = [];

        spawnTimer = 0;
        spawnInterval = 55;
        difficultyTimer = 0;

        state = "PLAYING";
    }

    function spawnObject() {
        const isBomb = Math.random() < 0.14;

        const x = W * (0.18 + Math.random() * 0.64);

        const vy = -(H * 0.016 + Math.random() * H * 0.006);

        const vx = (Math.random() - 0.5) * 3.2;

        if (isBomb) {

            objects.push({
                type: "bomb",
                x,
                y: H + 30,
                vx,
                vy,
                radius: 22,
                rotation: 0,
                rotSpeed: (Math.random() - 0.5) * 0.12,
                sliced: false
            });

        } else {

            const ft = FRUIT_TYPES[
                Math.floor(Math.random() * FRUIT_TYPES.length)
            ];

            objects.push({
                type: "fruit",
                fruitType: ft,
                x,
                y: H + 30,
                vx,
                vy,
                radius: 24,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.1,
                sliced: false
            });

        }
    }

    function spawnJuice(x, y, color) {
        for (let i = 0; i < 10; i++) {

            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 1,
                color,
                size: 2 + Math.random() * 3,
                life: 1
            });

        }
    }

    function spawnExplosion(x, y) {
        for (let i = 0; i < 26; i++) {

            const a = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;

            particles.push({
                x,
                y,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed,
                color: Math.random() < 0.5 ? "#ff9f1c" : "#e74c3c",
                size: 3 + Math.random() * 4,
                life: 1
            });

        }
    }

    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;

        const lenSq = dx * dx + dy * dy;

        let t = lenSq === 0 ? 0 :
            ((px - ax) * dx + (py - ay) * dy) / lenSq;

        t = Math.max(0, Math.min(1, t));

        const cx = ax + t * dx;
        const cy = ay + t * dy;

        const ddx = px - cx;
        const ddy = py - cy;

        return Math.sqrt(ddx * ddx + ddy * ddy);
    }

    function checkSlices() {
        if (trail.length < 2) return;

        const a = trail[trail.length - 2];
        const b = trail[trail.length - 1];

        for (const obj of objects) {

            if (obj.sliced) continue;

            const d = distToSegment(
                obj.x, obj.y,
                a.x, a.y,
                b.x, b.y
            );

            if (d < obj.radius + 6) {

                obj.sliced = true;

                if (obj.type === "bomb") {

                    spawnExplosion(obj.x, obj.y);

                    lives = 0;
                    triggerGameOver("BOOM !");

                } else {

                    spawnJuice(
                        obj.x, obj.y,
                        obj.fruitType.color
                    );

                    combo++;
                    comboTimer = 45;

                    const points = combo >= 3 ? 3 : 1;

                    score += points;

                }

            }

        }

    }

    function triggerGameOver(reason) {
        if (state === "OVER") return;

        state = "OVER";

        if (score > best) {

            best = score;

            try {
                localStorage.setItem(
                    "ninja_best",
                    String(best)
                );
            } catch (e) {}

        }
    }

    function missFruit() {
        lives--;

        if (lives <= 0) {

            triggerGameOver("PERDU !");

        }
    }

    function update(dt) {
        if (comboTimer > 0) {
            comboTimer -= dt;

            if (comboTimer <= 0) {
                combo = 0;
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {

            const p = particles[i];

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.15 * dt;
            p.life -= 0.03 * dt;

            if (p.life <= 0) {
                particles.splice(i, 1);
            }

        }

        if (state !== "PLAYING") return;

        difficultyTimer += dt;

        if (difficultyTimer > 300) {
            difficultyTimer = 0;

            spawnInterval = Math.max(28, spawnInterval - 4);
        }

        spawnTimer += dt;

        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;

            spawnObject();

            if (Math.random() < 0.18) {
                spawnObject();
            }
        }

        for (let i = objects.length - 1; i >= 0; i--) {

            const o = objects[i];

            o.vy += GRAVITY * dt;

            o.x += o.vx * dt;
            o.y += o.vy * dt;

            o.rotation += o.rotSpeed * dt;

            if (o.sliced) {

                o.y += 6 * dt;
                o.x += o.vx * dt;

                if (o.y > H + 60) {
                    objects.splice(i, 1);
                }

                continue;

            }

            if (o.y > H + 60) {

                objects.splice(i, 1);

                if (o.type === "fruit") {
                    missFruit();
                }

            }

        }

    }

    function drawFruit(o) {
        ctx.save();

        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation);

        if (o.sliced) {
            ctx.globalAlpha = 0.85;
        }

        ctx.fillStyle = o.fruitType.color;

        ctx.beginPath();
        ctx.arc(0, 0, o.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = o.fruitType.inner;

        ctx.beginPath();
        ctx.arc(0, 0, o.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawBomb(o) {
        ctx.save();

        ctx.translate(o.x, o.y);
        ctx.rotate(o.rotation);

        ctx.fillStyle = "#1c1c1c";

        ctx.beginPath();
        ctx.arc(0, 0, o.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#555";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.strokeStyle = "#f39c12";
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(-2, -o.radius);
        ctx.lineTo(6, -o.radius - 10);
        ctx.stroke();

        ctx.fillStyle = "#ff9f1c";

        ctx.beginPath();
        ctx.arc(6, -o.radius - 12, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawTrail() {
        if (trail.length < 2) return;

        ctx.save();

        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 1; i < trail.length; i++) {

            const alpha = i / trail.length;

            ctx.strokeStyle =
                "rgba(255,255,255," + (alpha * 0.9) + ")";

            ctx.lineWidth = 2 + alpha * 6;

            ctx.beginPath();
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();

        }

        ctx.restore();
    }

    function drawUI() {
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px Arial";

        ctx.fillText("Score : " + score, 12, 28);

        ctx.textAlign = "right";
        ctx.fillText("Best : " + best, W - 12, 28);

        ctx.textAlign = "left";

        for (let i = 0; i < 3; i++) {

            ctx.fillStyle = i < lives ? "#e74c3c" : "rgba(255,255,255,0.25)";

            ctx.beginPath();
            ctx.arc(20 + i * 22, 52, 7, 0, Math.PI * 2);
            ctx.fill();

        }

        if (combo >= 2) {

            ctx.textAlign = "center";
            ctx.fillStyle = "#ffd23f";
            ctx.font = "bold 20px Arial";

            ctx.fillText(
                "COMBO x" + combo,
                W / 2,
                45
            );

        }
    }

    function drawOverlay() {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";

        if (state === "READY") {

            ctx.font = "bold 30px Arial";
            ctx.fillText("FRUIT NINJA", W / 2, H * 0.4);

            ctx.font = "16px Arial";
            ctx.fillText(
                "Glisse le doigt pour trancher",
                W / 2,
                H * 0.48
            );

            ctx.fillText(
                "Évite les bombes !",
                W / 2,
                H * 0.54
            );

            ctx.font = "bold 15px Arial";
            ctx.fillStyle = "#ffd23f";

            ctx.fillText(
                "Touche l'écran pour commencer",
                W / 2,
                H * 0.64
            );

        } else if (state === "OVER") {

            ctx.font = "bold 30px Arial";
            ctx.fillStyle = "#e74c3c";
            ctx.fillText("GAME OVER", W / 2, H * 0.38);

            ctx.font = "bold 20px Arial";
            ctx.fillStyle = "#fff";

            ctx.fillText(
                "Score : " + score,
                W / 2,
                H * 0.47
            );

            ctx.fillStyle = "#ffd23f";

            ctx.fillText(
                "Best : " + best,
                W / 2,
                H * 0.54
            );

            ctx.font = "15px Arial";
            ctx.fillStyle = "#fff";

            ctx.fillText(
                "Touche l'écran pour rejouer",
                W / 2,
                H * 0.64
            );

        }
    }

    function draw() {
        ctx.fillStyle = "#0d1b2a";
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#1b3a5c";

        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(
                (W / 5) * (i + 1),
                H * 0.15 + (i % 2) * 20,
                30,
                0, Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();

        for (const o of objects) {

            if (o.type === "bomb") {
                drawBomb(o);
            } else {
                drawFruit(o);
            }

        }

        for (const p of particles) {

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

        }

        drawTrail();
        drawUI();

        if (state !== "PLAYING") {
            drawOverlay();
        }
    }

    let lastTime = performance.now();

    function loop(now) {
        const dt = Math.min((now - lastTime) / 16.6667, 3);

        lastTime = now;

        update(dt);
        draw();

        requestAnimationFrame(loop);
    }

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();

        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function onPointerDown(e) {
        e.preventDefault();

        if (state !== "PLAYING") {

            resetGame();

            return;
        }

        pointerDown = true;

        const pos = getPos(e);

        trail = [pos];
    }

    function onPointerMove(e) {
        if (!pointerDown) return;

        e.preventDefault();

        const pos = getPos(e);

        trail.push(pos);

        if (trail.length > 14) {
            trail.shift();
        }

        checkSlices();
    }

    function onPointerUp(e) {
        pointerDown = false;

        trail = [];
    }

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
    canvas.addEventListener("pointerleave", onPointerUp, { passive: false });

    window.addEventListener("resize", () => {
        size();
        draw();
    });

    if (typeof ResizeObserver !== "undefined") {

        const observer = new ResizeObserver(() => {
            size();
            draw();
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
