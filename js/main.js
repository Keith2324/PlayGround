import { InputManager } from './input.js';
import { Sfx } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './render.js';

const canvas = document.getElementById('game');
const input = new InputManager();
const sfx = new Sfx();
const game = new Game({ sfx, input });
const renderer = new Renderer(canvas);

input.attachTouch();

const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  results: document.getElementById('screen-results'),
};
const body = document.body;
const muteChip = document.getElementById('mute-chip');

function initAudio() {
  sfx.init();
}
input.onFirstGesture = initAudio;
window.addEventListener('pointerdown', initAudio);
window.addEventListener('keydown', initAudio);

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

function hideScreens() {
  for (const el of Object.values(screens)) el.classList.add('hidden');
}

/* ------------------------------------------------------------
   Title / difficulty
   ------------------------------------------------------------ */
const diffButtons = [...document.querySelectorAll('#difficulty button')];
function setDifficulty(d) {
  game.difficulty = d;
  for (const b of diffButtons) b.classList.toggle('active', b.dataset.diff === d);
}
for (const b of diffButtons) {
  b.addEventListener('click', () => {
    sfx.ui();
    setDifficulty(b.dataset.diff);
  });
}

function startGame() {
  initAudio();
  sfx.ui();
  sfx.startMusic();
  hideScreens();
  body.classList.add('playing');
  game.onMatchEnd = onMatchEnd;
  game.startMatch(game.difficulty);
}

function onMatchEnd(playerWon) {
  sfx.stopMusic();
  body.classList.remove('playing');
  const title = document.getElementById('results-title');
  title.textContent = playerWon ? 'YOU WIN' : 'YOU LOSE';
  title.classList.toggle('lose', !playerWon);
  document.getElementById('results-kicker').textContent =
    playerWon ? 'SUNSET CLAIMED' : 'MATCH COMPLETE';
  document.getElementById('results-score').textContent = `${game.player.wins} — ${game.cpu.wins}`;
  document.getElementById('results-sub').textContent = playerWon
    ? 'REN falls to the crimson wind. The rooftop belongs to KAZE.'
    : 'REN takes the sunset. Rise again, KAZE.';
  showScreen('results');
}

function goToTitle() {
  sfx.ui();
  sfx.stopMusic();
  hideScreens();
  body.classList.remove('playing');
  game.toTitle();
  showScreen('title');
}

/* ------------------------------------------------------------
   Buttons
   ------------------------------------------------------------ */
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-rematch').addEventListener('click', startGame);
document.getElementById('btn-title').addEventListener('click', goToTitle);
document.getElementById('btn-resume').addEventListener('click', () => togglePause());
document.getElementById('btn-restart').addEventListener('click', () => {
  sfx.ui();
  hideScreens();
  body.classList.add('playing');
  game.paused = false;
  game.startMatch(game.difficulty);
});
document.getElementById('btn-quit').addEventListener('click', goToTitle);

function togglePause() {
  if (game.state === 'title' || game.state === 'matchEnd') return;
  if (game.paused) {
    game.resume();
    hideScreens();
  } else if (game.pause()) {
    sfx.ui();
    showScreen('pause');
  }
}

function toggleMute() {
  const muted = sfx.toggle();
  muteChip.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
}
muteChip.addEventListener('click', (e) => {
  e.stopPropagation();
  initAudio();
  toggleMute();
});

/* ------------------------------------------------------------
   Keyboard shortcuts (menus)
   ------------------------------------------------------------ */
window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (code === 'KeyM') {
    toggleMute();
    return;
  }
  if (code === 'KeyP' || code === 'Escape') {
    if (!screens.title.classList.contains('hidden')) return;
    if (!screens.results.classList.contains('hidden')) return;
    e.preventDefault();
    togglePause();
    return;
  }
  if (code === 'Enter' || code === 'Space') {
    if (!screens.title.classList.contains('hidden')) {
      e.preventDefault();
      startGame();
    } else if (!screens.results.classList.contains('hidden')) {
      e.preventDefault();
      startGame();
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state !== 'title' && game.state !== 'matchEnd' && !game.paused) {
    if (game.pause()) showScreen('pause');
  }
});

/* ------------------------------------------------------------
   Loop
   ------------------------------------------------------------ */
window.addEventListener('resize', () => renderer.resize());
if (window.ResizeObserver) {
  new ResizeObserver(() => renderer.resize()).observe(canvas.parentElement);
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 20) {
    game.step(STEP, input);
    input.clearPressed();
    acc -= STEP;
    steps += 1;
  }
  if (steps === 20) acc = 0;
  renderer.render(game, Math.min(dt, 0.05));
  requestAnimationFrame(frame);
}

async function boot() {
  try {
    await Promise.all([
      document.fonts.load('400 64px "Bebas Neue"'),
      document.fonts.load('600 16px "Rajdhani"'),
      document.fonts.load('700 16px "Rajdhani"'),
    ]);
  } catch (e) { /* fonts are a nice-to-have */ }
  renderer.resize();
  showScreen('title');
  requestAnimationFrame(frame);
}

boot();

// expose for automated checks
window.__neonFist = { game, renderer, sfx, input };
