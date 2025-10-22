// BlockBlast-inspired prototype
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const startBtn = document.getElementById('start');

// logical size
const W = 900, H = 560;
function resize(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
window.addEventListener('resize', ()=>{ requestAnimationFrame(resize); });
resize();

// Game state
let paddle = {w:120, h:16, x: W/2 - 120/2, y: H - 48, speed: 640};
let ball = {x: W/2, y: H - 64, r:9, vx:0, vy:0, stuck:true};
let bricks = [];
let rows = 5, cols = 10;
let score = 0, lives = 3, level = 1;
let playing = false;
let last = performance.now();

// power-ups
const powerUps = []; // {x,y,type,vy}

function buildLevel(l){
  bricks = [];
  const padding = 8;
  const areaW = W - 160; // margins
  const brickW = (areaW - (cols-1)*padding) / cols;
  const brickH = 28;
  const startX = 80;
  const startY = 60;
  for(let r=0;r<rows + Math.floor((l-1)/2);r++){ 
    for(let c=0;c<cols;c++){ 
      const b = {
        x: startX + c*(brickW+padding),
        y: startY + r*(brickH+padding),
        w: brickW, h: brickH,
        hp: 1 + Math.floor(r/2),
        maxHp: 1 + Math.floor(r/2),
        worth: (r+1)*10
      };
      bricks.push(b);
    }
  }
}

function resetBallAndPaddle(){
  paddle.x = W/2 - paddle.w/2;
  paddle.y = H - 48;
  ball.x = W/2;
  ball.y = paddle.y - 12;
  ball.vx = 0; ball.vy = 0; ball.stuck = true;
}

function startLevel(){
  buildLevel(level);
  resetBallAndPaddle();
  updateHUD();
}

function updateHUD(){ scoreEl.textContent = 'Score: ' + score; livesEl.textContent = 'Lives: ' + lives; levelEl.textContent = 'Level: ' + level; }

// Input
const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key] = true; if(e.key === ' '){ if(ball.stuck){ // launch with angle based on random
    const ang = (Math.random()*Math.PI/3) - Math.PI/6; ball.vx = 360*Math.cos(ang); ball.vy = -360*Math.sin(ang); ball.stuck = false; }
  }
});
window.addEventListener('keyup', e=>{ keys[e.key] = false; });

// Mouse / touch for paddle
let pointerActive = false;
canvas.addEventListener('mousemove', e=>{
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (W / rect.width);
  paddle.x = clamp(x - paddle.w/2, 16, W - paddle.w - 16);
  if(ball.stuck) { ball.x = paddle.x + paddle.w/2; }
});
canvas.addEventListener('touchmove', e=>{ e.preventDefault(); const t = e.touches[0]; const rect = canvas.getBoundingClientRect(); const x = (t.clientX-rect.left)*(W/rect.width); paddle.x = clamp(x - paddle.w/2, 16, W - paddle.w - 16); if(ball.stuck) ball.x = paddle.x + paddle.w/2; }, {passive:false});

// clamp
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// collisions
function rectCircleCollide(rx,ry,rw,rh, cx,cy,cr){
  const closestX = clamp(cx, rx, rx+rw);
  const closestY = clamp(cy, ry, ry+rh);
  const dx = cx - closestX; const dy = cy - closestY;
  return (dx*dx + dy*dy) <= cr*cr;
}

// game loop
function step(now){
  const dt = Math.min(0.03, (now - last)/1000); last = now;
  if(playing){
    // input move paddle
    const move = ((keys['ArrowLeft']||keys['a']||keys['A'])? -1:0) + ((keys['ArrowRight']||keys['d']||keys['D'])? 1:0);
    paddle.x += move * paddle.speed * dt;
    paddle.x = clamp(paddle.x, 16, W - paddle.w - 16);
    if(ball.stuck){ ball.x = paddle.x + paddle.w/2; }

    // move ball
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;

    // wall collisions
    if(ball.x - ball.r < 0){ ball.x = ball.r; ball.vx = -ball.vx; }
    if(ball.x + ball.r > W){ ball.x = W - ball.r; ball.vx = -ball.vx; }
    if(ball.y - ball.r < 0){ ball.y = ball.r; ball.vy = -ball.vy; }

    // paddle collisions
    if(rectCircleCollide(paddle.x, paddle.y, paddle.w, paddle.h, ball.x, ball.y, ball.r) && ball.vy > 0){
      // compute hit point
      const rel = (ball.x - (paddle.x + paddle.w/2)) / (paddle.w/2);
      const bounce = rel * Math.PI/3; // max 60deg
      const speed = Math.hypot(ball.vx, ball.vy) * 1.02; // slight accel
      ball.vx = speed * Math.sin(bounce);
      ball.vy = -Math.abs(speed * Math.cos(bounce));
      // small tweak to avoid sticking
      ball.y = paddle.y - ball.r - 0.1;
      // spawn small particle or sound placeholder (omitted)
    }

    // brick collisions
    for(let i=bricks.length-1;i>=0;i--){
      const b = bricks[i];
      if(rectCircleCollide(b.x, b.y, b.w, b.h, ball.x, ball.y, ball.r)){
        // determine side collision
        const prevX = ball.x - ball.vx * dt;
        const prevY = ball.y - ball.vy * dt;
        let collidedVert = prevY <= b.y || prevY >= b.y + b.h;
        if(collidedVert) ball.vy = -ball.vy; else ball.vx = -ball.vx;
        // damage
        b.hp -= 1;
        if(b.hp <= 0){ bricks.splice(i,1); score += b.worth; // chance powerup
          if(Math.random() < 0.12){ spawnPowerUp(b.x+b.w/2, b.y+b.h/2); }
        }
        break; // handle one brick per frame
      }
    }

    // power-up falling
    for(let i=powerUps.length-1;i>=0;i--){
      const p = powerUps[i]; p.y += p.vy * dt;
      if(rectCircleCollide(paddle.x, paddle.y, paddle.w, paddle.h, p.x, p.y, 10)){ 
        applyPowerUp(p.type); powerUps.splice(i,1);
      } else if(p.y > H + 40) powerUps.splice(i,1);
    }

    // scoring / lose life
    if(ball.y - ball.r > H){ lives -= 1; if(lives <= 0){ playing = false; alert('Game Over — Score: '+score); } else { resetBallAndPaddle(); } updateHUD(); }

    // win level
    if(bricks.length === 0){ level += 1; startLevel(); }
  }
  render();
  requestAnimationFrame(step);
}

// power-ups
function spawnPowerUp(x,y){ const types = ['multiball','bigpaddle','slowball']; const type = types[Math.floor(Math.random()*types.length)]; powerUps.push({x,y,type,vy:120}); }
function applyPowerUp(type){ if(type==='multiball'){ // add two extra balls with slight variance
    for(let i=0;i<2;i++){ const ang = (Math.random()*Math.PI/2) - Math.PI/4; const speed = Math.hypot(ball.vx,ball.vy)||360; // create new ball
      const nb = {x: ball.x, y: ball.y, r: ball.r, vx: speed*Math.cos(ang)*(i?1:-1), vy: -Math.abs(speed*Math.sin(ang))}; // push into global single ball (prototype supports single active ball only for simplicity)
      // to keep prototype manageable we'll simply adjust main ball
      ball.vx += nb.vx*0.2; ball.vy += nb.vy*0.2;
    }
  } else if(type==='bigpaddle'){ paddle.w = Math.min(W-32, paddle.w * 1.5); setTimeout(()=>{ paddle.w = 120; }, 15000); } else if(type==='slowball'){ ball.vx *= 0.7; ball.vy *= 0.7; setTimeout(()=>{ /* no revert for prototype */ }, 8000); } }

// render
function render(){
  // clear in logical coords
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // scale to logical size
  const scaleX = canvas.width / devicePixelRatio / W;
  const scaleY = canvas.height / devicePixelRatio / H;
  ctx.save();
  ctx.scale(scaleX, scaleY);

  // background gradient
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#081428'); g.addColorStop(1,'#051624');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // bricks
  for(const b of bricks){
    const t = b.hp / b.maxHp;
    ctx.fillStyle = `hsl(${30 + (1-t)*120}, 80%, ${40 + t*30}%)`;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6);
    // hp text
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.font = '12px system-ui'; ctx.fillText(b.hp, b.x + 6, b.y + 18);
  }

  // paddle
  ctx.fillStyle = '#7dd3fc'; roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 8);

  // ball
  ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2); ctx.fill();

  // powerups
  for(const p of powerUps){ ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='#041017'; ctx.fillText(p.type[0].toUpperCase(), p.x-4, p.y+4); }

  ctx.restore();
}

function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); ctx.fill(); }

startBtn.addEventListener('click', ()=>{ playing = true; score = 0; lives = 3; level = 1; startLevel(); updateHUD(); });

// initialize
startLevel(); updateHUD(); requestAnimationFrame(step);

// helper to set canvas CSS size on load
(function initCanvasSize(){ const rect = canvas.getBoundingClientRect(); if(rect.width === 0){ canvas.style.width = '100%'; canvas.style.height = '560px'; }
  resize(); })();
