const SCREEN_SIZE = 800;
const SQUARE_BLOCK_SIZE = 40;
const FPS = 60;
const MOVE_INTERVAL_MS = Math.round(1000 / (FPS / 6));

const COLORS = {
  apple: '#ff0000',
  snake: '#00ff00',
  wall: '#c8c8c8',
  bg: '#000000',
  white: '#ffffff'
};

const TRANSLATIONS = {
  en: {
    game_title: 'Classic Snake',
    menu_title: 'SNAKE',
    play_button: 'PLAY',
    quit_button: 'QUIT',
    continue_button: 'CONTINUE',
    score: 'Score: {score}',
    game_over: 'GAME OVER!',
    restart_prompt: 'Press R to Restart or Q to Quit',
    controls: 'Controls: Arrow Keys or WASD',
    lang_english: 'English',
    lang_lithuanian: 'Lietuvių',
    restart_button: 'Restart',
    quit_to_menu_button: 'Quit to Menu',
    paused: 'PAUSED'
  },
  lt: {
    game_title: 'Klasikinė gyvatėlė',
    menu_title: 'GYVATĖLĖ',
    play_button: 'ŽAISTI',
    quit_button: 'IŠEITI',
    continue_button: 'TĘSTI',
    score: 'Taškai: {score}',
    game_over: 'ŽAIDIMAS BAIGTAS!',
    restart_prompt: 'Spauskite R - pradėti iš naujo, Q - išeiti',
    controls: 'Valdymas: Rodyklės arba WASD',
    lang_english: 'English',
    lang_lithuanian: 'Lietuvių',
    restart_button: 'Pradėti iš naujo',
    quit_to_menu_button: 'Grįžti į meniu',
    paused: 'PAUZE'
  }
};

class Localization {
  constructor() { this.current = 'en'; }
  t(key, params = {}){
    const text = TRANSLATIONS[this.current][key] || key;
    return text.replace(/\{(\w+)}/g, (_, k) => params[k] ?? '');
  }
  set(lang){ if(TRANSLATIONS[lang]) this.current = lang; }
}
const loc = new Localization();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const gameOverDiv = document.getElementById('game-over');
const scoreEl = document.getElementById('score');
const pausedEl = document.getElementById('paused');
const menuTitle = document.getElementById('menu-title');
const controlsText = document.getElementById('controls-text');

let moveTimer = null;
let renderTimer = null;
let running = false;
let paused = false;
let snake = null;
let apple = null;
let wall = null;
let score = 0;

function gridRandomCell() {
  const gridW = SCREEN_SIZE / SQUARE_BLOCK_SIZE;
  const x = (1 + Math.floor(Math.random() * (gridW - 2))) * SQUARE_BLOCK_SIZE;
  const y = (1 + Math.floor(Math.random() * (gridW - 2))) * SQUARE_BLOCK_SIZE;
  return [x, y];
}

class Block {
  constructor(pos = [0,0], color = COLORS.bg){ this.pos = pos.slice(); this.color = color; }
  draw(){ ctx.fillStyle = this.color; ctx.fillRect(this.pos[0], this.pos[1], SQUARE_BLOCK_SIZE, SQUARE_BLOCK_SIZE); }
}

class Apple extends Block{
  constructor(){ super([0,0], COLORS.apple); this.randomize(); }
  randomize(excludePositions = []){
    let tries = 0;
    while(true){
      const pos = gridRandomCell();
      const key = pos.join(',');
      if(!excludePositions.includes(key)){ this.pos = pos; return; }
      if(++tries > 1000) { this.pos = pos; return; }
    }
  }
}

class Wall {
  constructor(){ this.segments = [];
    const gridW = SCREEN_SIZE / SQUARE_BLOCK_SIZE;
    for(let x=0;x<gridW;x++){
      this.segments.push(new Block([x*SQUARE_BLOCK_SIZE,0], COLORS.wall));
      this.segments.push(new Block([x*SQUARE_BLOCK_SIZE,(gridW-1)*SQUARE_BLOCK_SIZE], COLORS.wall));
    }
    for(let y=1;y<gridW-1;y++){
      this.segments.push(new Block([0,y*SQUARE_BLOCK_SIZE], COLORS.wall));
      this.segments.push(new Block([(gridW-1)*SQUARE_BLOCK_SIZE,y*SQUARE_BLOCK_SIZE], COLORS.wall));
    }
  }
  draw(){ this.segments.forEach(s=>s.draw()); }
  checkCollision(headPos){
    for(const s of this.segments){ if(s.pos[0]===headPos[0] && s.pos[1]===headPos[1]) return true; }
    return false;
  }
}

class Snake {
  constructor(){
    this.direction = 'right';
    this.segments = [];
    const start_x = SQUARE_BLOCK_SIZE * 5;
    const start_y = SQUARE_BLOCK_SIZE * 5;
    this.segments.push(new Block([start_x, start_y], COLORS.snake));
    this.segments.push(new Block([start_x - SQUARE_BLOCK_SIZE, start_y], COLORS.snake));
    this.tailLastPos = this.segments[this.segments.length-1].pos.slice();
  }
  setDir(newDir){ const opposites = {right:'left', left:'right', up:'down', down:'up'}; if(opposites[this.direction]!==newDir) this.direction=newDir; }
  move(){
    const head = this.segments[0];
    const newHeadPos = head.pos.slice();
    if(this.direction==='up') newHeadPos[1] -= SQUARE_BLOCK_SIZE;
    else if(this.direction==='down') newHeadPos[1] += SQUARE_BLOCK_SIZE;
    else if(this.direction==='left') newHeadPos[0] -= SQUARE_BLOCK_SIZE;
    else if(this.direction==='right') newHeadPos[0] += SQUARE_BLOCK_SIZE;

    this.tailLastPos = this.segments[this.segments.length-1].pos.slice();
    for(let i=this.segments.length-1;i>0;i--){ this.segments[i].pos = this.segments[i-1].pos.slice(); }
    this.segments[0].pos = newHeadPos;
  }
  addSegment(){ this.segments.push(new Block(this.tailLastPos.slice(), COLORS.snake)); }
  draw(){ this.segments.forEach(s=>s.draw()); }
  checkSelfCollision(){ const head = this.segments[0].pos; for(let i=1;i<this.segments.length;i++){ if(this.segments[i].pos[0]===head[0] && this.segments[i].pos[1]===head[1]) return true; } return false; }
}

function startGame(){
  menu.classList.add('hidden');
  gameOverDiv.classList.add('hidden');
  score = 0; updateScore();
  snake = new Snake();
  wall = new Wall();
  apple = new Apple();
  apple.randomize(getSnakePositions());
  running = true; paused = false; pausedEl.classList.add('hidden');
  if(moveTimer) clearInterval(moveTimer);
  moveTimer = setInterval(()=>{ if(running && !paused) gameTick(); }, MOVE_INTERVAL_MS);
  if(!renderTimer) renderLoop();
}

function quitToMenu(){
  running = false; paused = false;
  if(moveTimer) { clearInterval(moveTimer); moveTimer=null; }
  menu.classList.remove('hidden');
  gameOverDiv.classList.add('hidden');
}

function gameOver(){
  running = false; if(moveTimer){ clearInterval(moveTimer); moveTimer=null; }
  gameOverDiv.classList.remove('hidden');
  const goText = document.getElementById('game-over-text');
  goText.textContent = loc.t('game_over');
  document.getElementById('restart-prompt').textContent = loc.t('restart_prompt');
  const restartBtn = document.getElementById('restart-btn');
  const quitToMenuBtn = document.getElementById('quit-to-menu-btn');
  if(restartBtn) restartBtn.textContent = loc.t('restart_button');
  if(quitToMenuBtn) quitToMenuBtn.textContent = loc.t('quit_to_menu_button');
}

function getSnakePositions() {
  return snake.segments.map(s=>s.pos.join(','));
}

function gameTick(){
  snake.move();
  const headPos = snake.segments[0].pos;
  if(headPos[0]===apple.pos[0] && headPos[1]===apple.pos[1]){ snake.addSegment(); score++; updateScore(); apple.randomize(getSnakePositions()); }
  if(snake.checkSelfCollision() || wall.checkCollision(headPos)){
    gameOver();
  }
}

function updateScore() {
  scoreEl.textContent = loc.t('score', {score});
}

function renderLoop(){
  render();
  requestAnimationFrame(renderLoop);
}

function render(){
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0,0,SCREEN_SIZE,SCREEN_SIZE);
  wall.draw(); apple.draw(); snake.draw();
  if(paused) pausedEl.classList.remove('hidden'); else pausedEl.classList.add('hidden');
}

window.addEventListener('keydown', (e)=>{
  if(!running){
    if(e.key.toLowerCase()==='r'){ startGame(); }
    if(e.key.toLowerCase()==='q'){ quitToMenu(); }
    return;
  }
  if(e.key === 'Escape'){ paused = !paused; render(); e.preventDefault(); }
  if(!paused){
    if(e.key === 'ArrowUp' || e.key.toLowerCase()==='w') { snake.setDir('up'); e.preventDefault(); }
    if(e.key === 'ArrowDown' || e.key.toLowerCase()==='s') { snake.setDir('down'); e.preventDefault(); }
    if(e.key === 'ArrowLeft' || e.key.toLowerCase()==='a') { snake.setDir('left'); e.preventDefault(); }
    if(e.key === 'ArrowRight' || e.key.toLowerCase()==='d') { snake.setDir('right'); e.preventDefault(); }
  }
  if(e.key.toLowerCase()==='r'){ startGame(); }
  if(e.key.toLowerCase()==='q'){ quitToMenu(); }
});

document.getElementById('play-btn').addEventListener('click', ()=>{ startGame(); });
document.getElementById('quit-btn').addEventListener('click', ()=>{ window.close(); });

document.querySelectorAll('#lang-buttons button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    loc.set(btn.getAttribute('data-lang'));
    updateLocaleTexts();
  });
});

function updateLocaleTexts(){
  document.documentElement.lang = loc.current;
  document.title = loc.t('game_title');
  menuTitle.textContent = loc.t('menu_title');
  document.getElementById('play-btn').textContent = loc.t('play_button');
  document.getElementById('quit-btn').textContent = loc.t('quit_button');
  controlsText.textContent = loc.t('controls');
  document.querySelectorAll('#lang-buttons button').forEach(btn=>{
    const code = btn.getAttribute('data-lang');
    const key = code === 'en' ? 'lang_english' : ('lang_' + (code === 'lt' ? 'lithuanian' : code));
    btn.textContent = loc.t(key);
  });
  const restartBtn = document.getElementById('restart-btn');
  const quitToMenuBtn = document.getElementById('quit-to-menu-btn');
  if(restartBtn) restartBtn.textContent = loc.t('restart_button');
  if(quitToMenuBtn) quitToMenuBtn.textContent = loc.t('quit_to_menu_button');
  if(pausedEl) pausedEl.textContent = loc.t('paused');
  updateScore();
}

document.getElementById('restart-btn').addEventListener('click', ()=>{ startGame(); });
document.getElementById('quit-to-menu-btn').addEventListener('click', ()=>{ quitToMenu(); });

updateLocaleTexts();

canvas.width = SCREEN_SIZE; canvas.height = SCREEN_SIZE;

try{ window.__TEST__ = { startGame, gameOver, quitToMenu, loc }; } catch(e){}

