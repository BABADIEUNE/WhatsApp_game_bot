module.exports = {
    name: "Cyber Snake",
    id: "snake",
    description: "Classic neon grid snake game with food, speed ramp-up, and touch D-Pad controls",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#1b4332,#081c15 60%,#020b08)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #081c15;border-radius:22px;background:linear-gradient(105deg,#03120c,#1b4332 8%,#082318 20%,#2d6a4f 52%,#082318 82%,#40916c 94%,#03120c);box-shadow:inset 0 0 0 2px #52b788,inset 0 0 0 6px #081c15,inset 0 20px 35px #74c69d22,0 8px 0 #020b08,0 14px 24px #000c;touch-action:none}
.machine:before{content:"";position:absolute;inset:6px;border:2px solid #52b788;border-radius:18px;pointer-events:none;box-shadow:inset 0 0 11px #74c69d}
.lights{height:8px;margin:0 12px 6px;border:2px solid #081c15;border-radius:8px;background:repeating-radial-gradient(circle at 6px 50%,#d8f3dc 0 2px,#52b788 3px 5px,#081c15 6px 12px);box-shadow:0 0 12px #52b788;animation:lights .55s steps(2) infinite}
.title{padding:8px 4px 6px;border:2px solid #52b788;border-radius:12px;color:#d8f3dc;background:radial-gradient(ellipse at 50% 0,#52b788,#081c15 70%);box-shadow:inset 0 0 0 3px #082318,inset 0 -11px 18px #000d,0 4px 0 #020b08;text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px;text-shadow:0 2px #020b08}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #40916c;border-radius:8px;background:linear-gradient(#03120c,#020b08);box-shadow:inset 0 0 9px #000,0 3px 0 #082318}
.stat{flex:1;border-right:1px solid #40916c;color:#95d5b2;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#d8f3dc;font-size:14px;text-shadow:0 0 6px #74c69d}
.frame{position:relative;padding:6px;border:4px solid #2d6a4f;border-radius:14px;background:linear-gradient(90deg,#03120c,#52b788 5%,#082318 10%,#082318 90%,#52b788 95%,#03120c);box-shadow:inset 0 0 0 3px #020b08,0 4px 0 #020b08,0 8px 15px #000b}
.reelbox{height:190px;border:3px solid #020b08;border-radius:9px;background:#081c15;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.message{height:28px;margin:6px 2px 4px;display:grid;place-items:center;border:2px solid #40916c;border-radius:8px;color:#d8f3dc;background:#03120c;text-align:center;font:bold 12px monospace}
.dpad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;width:180px;margin:4px auto;touch-action:none}
.dpad button{height:36px;border:2px solid #52b788;border-radius:8px;background:#1b4332;color:#d8f3dc;font-weight:bold;font-size:14px;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#d8f3dc;background:#020b08f0}.over.on{display:grid}
.over button{padding:0 22px;height:42px;margin-top:10px;background:#52b788;color:#020b08;border:none;border-radius:10px;font-weight:bold}
@keyframes lights{50%{filter:brightness(1.8)}}
</style></head><body>
<div class="machine">
<div class="lights"></div>
<div class="title">CYBER SNAKE</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">LENGTH<b id="len">3</b></div><div class="stat">BEST<b id="bs">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="message" id="msg">USE D-PAD OR SWIPE</div>
<div class="dpad">
<div></div><button id="up">▲</button><div></div>
<button id="left">◀</button><button id="down">▼</button><button id="right">▶</button>
</div>
<div class="over" id="over"><div><h2>GAME OVER</h2><div id="fs" style="font-size:15px;margin-bottom:6px"></div><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,rb=document.getElementById("rb"),over=document.getElementById("over"),msg=document.getElementById("msg"),scEl=document.getElementById("sc"),lenEl=document.getElementById("len"),bsEl=document.getElementById("bs"),fs=document.getElementById("fs");
const btnU=document.getElementById("up"),btnD=document.getElementById("down"),btnL=document.getElementById("left"),btnR=document.getElementById("right");
let W,H,cols=20,rows=15,gridSize,snake=[],dir={x:1,y:0},nextDir={x:1,y:0},food={x:10,y:7},score=0,best=0,alive=false,lastTick=0,tickInterval=110;
try{best=Number(localStorage.getItem("snake_best"))||0}catch(e){}bsEl.textContent=best;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H;gridSize=Math.min(W/cols,H/rows)}
function spawnFood(){let ok=false;while(!ok){food={x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)};ok=!snake.some(s=>s.x===food.x&&s.y===food.y)}}
function reset(){size();snake=[{x:5,y:7},{x:4,y:7},{x:3,y:7}];dir={x:1,y:0};nextDir={x:1,y:0};score=0;alive=true;scEl.textContent=0;lenEl.textContent=3;over.classList.remove("on");spawnFood()}
function die(){if(!alive)return;alive=false;best=Math.max(best,score);bsEl.textContent=best;fs.textContent="Score: "+score;over.classList.add("on");try{localStorage.setItem("snake_best",best)}catch(e){}}
function setDir(dx,dy){if(dir.x+dx!==0||dir.y+dy!==0){nextDir={x:dx,y:dy}}}
btnU.addEventListener("pointerdown",e=>{e.preventDefault();setDir(0,-1)});
btnD.addEventListener("pointerdown",e=>{e.preventDefault();setDir(0,1)});
btnL.addEventListener("pointerdown",e=>{e.preventDefault();setDir(-1,0)});
btnR.addEventListener("pointerdown",e=>{e.preventDefault();setDir(1,0)});
rb.addEventListener("pointerdown",e=>{e.preventDefault();reset()});
let touchStartX=0,touchStartY=0;
c.addEventListener("touchstart",e=>{touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY},{passive:true});
c.addEventListener("touchend",e=>{
const dx=e.changedTouches[0].clientX-touchStartX,dy=e.changedTouches[0].clientY-touchStartY;
if(Math.abs(dx)>Math.abs(dy)){setDir(dx>0?1:-1,0)}else{setDir(0,dy>0?1:-1)}
},{passive:true});
addEventListener("keydown",e=>{
if(e.code==="ArrowUp"||e.code==="KeyW")setDir(0,-1);
if(e.code==="ArrowDown"||e.code==="KeyS")setDir(0,1);
if(e.code==="ArrowLeft"||e.code==="KeyA")setDir(-1,0);
if(e.code==="ArrowRight"||e.code==="KeyD")setDir(1,0);
});
function update(){
dir=nextDir;
const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
if(head.x<0||head.x>=cols||head.y<0||head.y>=rows||snake.some(s=>s.x===head.x&&s.y===head.y)){die();return}
snake.unshift(head);
if(head.x===food.x&&head.y===food.y){score+=10;scEl.textContent=score;lenEl.textContent=snake.length;spawnFood()}
else{snake.pop()}
}
function draw(){
x.fillStyle="#081c15";x.fillRect(0,0,W,H);
x.strokeStyle="#1b4332";x.lineWidth=0.5;
for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)x.strokeRect(i*gridSize,j*gridSize,gridSize,gridSize);
x.fillStyle="#ff4081";x.beginPath();x.arc((food.x+0.5)*gridSize,(food.y+0.5)*gridSize,gridSize*0.42,0,Math.PI*2);x.fill();
snake.forEach((s,i)=>{
x.fillStyle=i===0?"#74c69d":"#52b788";
x.beginPath();x.roundRect(s.x*gridSize+1,s.y*gridSize+1,gridSize-2,gridSize-2,4);x.fill();
});
}
function loop(t){if(alive&&t-lastTick>tickInterval){lastTick=t;update()}draw();requestAnimationFrame(loop)}
size();reset();requestAnimationFrame(loop);
})()</script></body></html>`
};
