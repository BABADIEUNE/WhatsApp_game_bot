module.exports = {
    name: "Connect 4",
    id: "connect4",
    description: "Classic vertical 4-in-a-row checkers drop board game vs AI",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#0d47a1,#062252 60%,#000e26)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #062252;border-radius:22px;background:linear-gradient(105deg,#000e26,#0d47a1 8%,#082e6c 20%,#1565c0 52%,#082e6c 82%,#1976d2 94%,#000e26);box-shadow:inset 0 0 0 2px #90caf9,inset 0 0 0 6px #062252,0 8px 0 #000e26,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #90caf9;border-radius:12px;color:#e3f2fd;background:radial-gradient(ellipse at 50% 0,#1e88e5,#0d47a1 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.status{height:30px;display:flex;align-items:center;justify-content:center;color:#e3f2fd;font-weight:bold;font-size:14px;background:#062252;border-radius:8px;margin:8px 2px}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;width:100%;height:180px;background:#0d47a1;padding:6px;border-radius:10px;border:2px solid #90caf9}
.cell{display:flex;align-items:center;justify-content:center;background:#062252;border-radius:50%;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:inset 0 2px 4px rgba(0,0,0,0.5)}
.cell.R{background:#f44336;box-shadow:0 0 6px #f44336}
.cell.Y{background:#ffd600;box-shadow:0 0 6px #ffd600}
.reset-btn{width:100%;height:40px;margin-top:8px;border:2px solid #90caf9;border-radius:10px;background:#1565c0;color:#fff;font-weight:bold;cursor:pointer}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000eb}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#90caf9;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">CONNECT 4</div>
<div class="status" id="st">YOUR TURN (RED)</div>
<div class="grid" id="grid"></div>
<button id="rb" class="reset-btn">NEW GAME</button>
<div class="over" id="over"><div><h2 id="res">GAME OVER</h2><button id="rb2">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const rows=6,cols=7;let board=[],turn="R",gameOver=false;
const gridEl=document.getElementById("grid"),st=document.getElementById("st"),over=document.getElementById("over"),res=document.getElementById("res");
function reset(){
board=Array.from({length:rows},()=>Array(cols).fill(""));
turn="R";gameOver=false;st.textContent="YOUR TURN (RED)";over.classList.remove("on");
render();
}
function render(){
gridEl.innerHTML="";
for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
const d=document.createElement("div");
d.className="cell "+board[r][c];
d.onclick=()=>drop(c);
gridEl.appendChild(d);
}
}
function drop(col){
if(gameOver||board[0][col])return;
for(let r=rows-1;r>=0;r--){
if(!board[r][col]){board[r][col]=turn;break}
}
render();
if(checkWin(turn)){
gameOver=true;res.textContent=turn==="R"?"YOU WON!":"AI WON!";over.classList.add("on");return;
}
if(board.every(row=>row.every(c=>c))){
gameOver=true;res.textContent="IT'S A DRAW!";over.classList.add("on");return;
}
turn=turn==="R"?"Y":"R";
st.textContent=turn==="R"?"YOUR TURN (RED)":"AI THINKING...";
if(turn==="Y"&&!gameOver)setTimeout(aiTurn,350);
}
function aiTurn(){
const validCols=[];for(let c=0;c<cols;c++)if(!board[0][c])validCols.push(c);
if(!validCols.length)return;
for(const c of validCols){
let test=board.map(r=>[...r]);for(let r=rows-1;r>=0;r--)if(!test[r][c]){test[r][c]="Y";break}
if(checkWinTest(test,"Y")){drop(c);return}
}
for(const c of validCols){
let test=board.map(r=>[...r]);for(let r=rows-1;r>=0;r--)if(!test[r][c]){test[r][c]="R";break}
if(checkWinTest(test,"R")){drop(c);return}
}
drop(validCols[Math.floor(Math.random()*validCols.length)]);
}
function checkWinTest(b,p){
for(let r=0;r<rows;r++)for(let c=0;c<cols-3;c++)if(b[r][c]===p&&b[r][c+1]===p&&b[r][c+2]===p&&b[r][c+3]===p)return true;
for(let r=0;r<rows-3;r++)for(let c=0;c<cols;c++)if(b[r][c]===p&&b[r+1][c]===p&&b[r+2][c]===p&&b[r+3][c]===p)return true;
for(let r=0;r<rows-3;r++)for(let c=0;c<cols-3;c++)if(b[r][c]===p&&b[r+1][c+1]===p&&b[r+2][c+2]===p&&b[r+3][c+3]===p)return true;
for(let r=3;r<rows;r++)for(let c=0;c<cols-3;c++)if(b[r][c]===p&&b[r-1][c+1]===p&&b[r-2][c+2]===p&&b[r-3][c+3]===p)return true;
return false;
}
function checkWin(p){return checkWinTest(board,p)}
document.getElementById("rb").onclick=reset;
document.getElementById("rb2").onclick=reset;
reset();
})()</script></body></html>`
};
