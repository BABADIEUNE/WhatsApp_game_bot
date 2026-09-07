module.exports = {
    name: "Dino Desert Runner",
    id: "dino",
    description: "T-Rex desert endless obstacle runner with jump mechanics and day-night cycle",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#424242,#212121 60%,#111)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #212121;border-radius:22px;background:linear-gradient(105deg,#111,#333 8%,#1e1e1e 20%,#444 52%,#1e1e1e 82%,#555 94%,#111);box-shadow:inset 0 0 0 2px #aaa,inset 0 0 0 6px #212121,0 8px 0 #111,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #aaa;border-radius:12px;color:#fff;background:radial-gradient(ellipse at 50% 0,#666,#222 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #555;border-radius:8px;background:#111}
.stat{flex:1;border-right:1px solid #555;color:#ccc;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.frame{position:relative;padding:6px;border:4px solid #333;border-radius:14px;background:#f7f7f7}
.reelbox{height:190px;border:2px solid #222;border-radius:9px;background:#f7f7f7;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.btn-jump{width:100%;height:46px;margin-top:8px;border:2px solid #aaa;border-radius:12px;background:#444;color:#fff;font-weight:bold;font-size:17px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000f0}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#fff;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">DINO RUNNER</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">SPEED<b id="spd">1x</b></div><div class="stat">BEST<b id="bs">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<button id="btnJ" class="btn-jump">JUMP / TAP (SPACE)</button>
<div class="over" id="over"><div><h2>GAME OVER</h2><div id="fs" style="margin-bottom:8px"></div><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,scEl=document.getElementById("sc"),bsEl=document.getElementById("bs"),spdEl=document.getElementById("spd"),over=document.getElementById("over"),fs=document.getElementById("fs"),rb=document.getElementById("rb"),btnJ=document.getElementById("btnJ");
let W,H,dino,cacti=[],score=0,best=0,alive=false,speed=4.5,gravity=0.48;
try{best=Number(localStorage.getItem("dino_best"))||0}catch(e){}bsEl.textContent=best;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H}
function reset(){
size();dino={x:30,y:H-36,w:20,h:26,vy:0,grounded:true};cacti=[];score=0;speed=4.5;alive=true;
scEl.textContent=0;spdEl.textContent="1x";over.classList.remove("on");
}
function jump(){if(!alive)return;if(dino.grounded){dino.vy=-9.5;dino.grounded=false}}
btnJ.onclick=jump;c.onclick=jump;rb.onclick=reset;
addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();alive?jump():reset()}});
let nextCactus=0;
function update(){
if(!alive)return;
dino.vy+=gravity;dino.y+=dino.vy;
if(dino.y>=H-36){dino.y=H-36;dino.vy=0;dino.grounded=true}
score++;scEl.textContent=score;
if(score%250===0){speed+=0.3;spdEl.textContent=((speed/4.5).toFixed(1))+"x"}
if(Date.now()>nextCactus){
const h=18+Math.random()*16,w=12+Math.random()*10;
cacti.push({x:W+20,y:H-10-h,w,h});
nextCactus=Date.now()+Math.max(900,1800-score*0.6);
}
for(let i=cacti.length-1;i>=0;i--){
const k=cacti[i];k.x-=speed;
if(dino.x+dino.w-4>k.x&&dino.x+4<k.x+k.w&&dino.y+dino.h-2>k.y){
alive=false;best=Math.max(best,score);bsEl.textContent=best;fs.textContent="Score: "+score;
over.classList.add("on");try{localStorage.setItem("dino_best",best)}catch(e){}
}
if(k.x<-30)cacti.splice(i,1);
}
}
function draw(){
x.fillStyle="#f7f7f7";x.fillRect(0,0,W,H);
x.strokeStyle="#555";x.lineWidth=2;
x.beginPath();x.moveTo(0,H-10);x.lineTo(W,H-10);x.stroke();
x.fillStyle="#535353";
x.beginPath();x.roundRect(dino.x,dino.y,dino.w,dino.h,3);x.fill();
x.fillStyle="#fff";x.fillRect(dino.x+12,dino.y+4,3,3);
x.fillStyle="#388e3c";
for(const k of cacti){
x.beginPath();x.roundRect(k.x,k.y,k.w,k.h,3);x.fill();
}
}
function loop(){update();draw();requestAnimationFrame(loop)}
size();reset();loop();
})()</script></body></html>`
};
