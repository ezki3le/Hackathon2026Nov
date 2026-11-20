import { drawMap, loadTerrain } from './terrain.js';

const stage = document.querySelector('.stage');
const canvas = stage.querySelector('canvas');
const ctx = canvas.getContext('2d');
const pins = stage.getElementsByClassName('pin');
const compass = stage.querySelector('.north');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const statusText = document.querySelector('#view');
const factor = document.querySelector('#factor');
const zoomOut = document.querySelector('#out');
const zoomIn = document.querySelector('#in');
const pointers = new Map();
const format = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 2});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const initialPitch = Math.PI / 4;
const minZoom = .30, maxZoom = 3;
let data, layer = document.querySelector('[data-layer][aria-pressed="true"]').dataset.layer, mode = '2';
let bearing = 0, pitch = initialPitch, zoom = 1, frame = 0;
let moving = false, settleTimer = 0, orbitBlend = 0, transition;
let autoRotate = !reducedMotion.matches, onScreen = true, rotationTimer = 0;

function syncRotation() {
  clearInterval(rotationTimer);
  rotationTimer = 0;
  if (mode !== '3' || !autoRotate || !onScreen || document.hidden) return;
  let previous = performance.now();
  rotationTimer = setInterval(() => {
    const now = performance.now();
    // One degree per second, with no catch-up after a stalled or hidden tab.
    bearing += Math.min(now - previous, 200) * Math.PI / 180000;
    previous = now;
    redraw();
  }, 100);
}

function stopRotation() {
  autoRotate = false;
  syncRotation();
}

stage.addEventListener('pointerdown', event => {
  if (mode === '3' && autoRotate && !event.target.closest('.map-controls')) stopRotation();
});
stage.addEventListener('focusin', event => {
  if (mode === '3' && autoRotate && event.target.matches('.pin')) stopRotation();
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopRotation(); });
document.addEventListener('visibilitychange', syncRotation);
new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  syncRotation();
}).observe(stage);

function render(now) {
  frame = 0;
  if (!data) return;
  if (transition) {
    const t = Math.min(1, (now - transition.start) / 280);
    orbitBlend = transition.from + (transition.to - transition.from) * t * (2 - t);
    if (t === 1) transition = null;
    else redraw();
  }
  const w = canvas.width, h = canvas.height;
  const yaw = bearing * orbitBlend;
  const tilt = pitch * orbitBlend;
  const scale = Math.max(w, h) * zoom;
  const camera = {w, h, scale, a: Math.cos(yaw), b: Math.sin(yaw), c: Math.cos(tilt), s: Math.sin(tilt)};
  drawMap(ctx, data, layer, camera, zoom);
  for (const pin of pins) {
    const u = Number(pin.dataset.u) - .5, v = Number(pin.dataset.v) - .5;
    const x = w / 2 + scale * (u * camera.a - v * camera.b);
    const y = h / 2 + scale * ((u * camera.b + v * camera.a) * camera.c - data.height(u, v) * camera.s);
    pin.style.left = x / w * 100 + '%';
    pin.style.top = 'calc(' + y / h * 100 + '% - 4px)';
    pin.style.visibility = 'visible';
  }
  compass.firstElementChild.style.transform = 'rotate(' + Math.atan2(camera.b, camera.a * camera.c) + 'rad)';
}

function redraw() {
  if (!frame) frame = requestAnimationFrame(render);
}

function resize() {
  const density = Math.min(devicePixelRatio || 1, 2, (moving ? 650 : 1100) / stage.clientWidth);
  const width = Math.round(stage.clientWidth * density), height = Math.round(stage.clientHeight * density);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  redraw();
}

function cameraMoved() {
  moving = true;
  resize();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => { moving = false; resize(); }, 170);
}

function setZoom(value) {
  if (mode === '3' && autoRotate) stopRotation();
  zoom = clamp(value, minZoom, maxZoom);
  factor.value = format.format(zoom) + '×';
  zoomOut.disabled = zoom === minZoom;
  zoomIn.disabled = zoom === maxZoom;
  cameraMoved();
}

function resetView() {
  if (mode === '3') stopRotation();
  bearing = 0;
  pitch = initialPitch;
  setZoom(1);
}
function orbit(horizontal, vertical) {
  if (autoRotate) stopRotation();
  bearing = Math.atan2(Math.sin(bearing + horizontal), Math.cos(bearing + horizontal));
  pitch = clamp(pitch + vertical, Math.PI / 12, Math.PI * .37);
  cameraMoved();
}

for (const button of document.querySelectorAll('[data-layer], [data-mode]')) {
  button.addEventListener('click', () => {
    const group = button.parentElement;
    for (const other of group.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === button));
    if (button.dataset.layer) layer = button.dataset.layer;
    else {
      if (mode === button.dataset.mode) return;
      mode = button.dataset.mode;
      autoRotate = mode === '3' && !reducedMotion.matches;
      const target = mode === '3' ? 1 : 0;
      if (reducedMotion.matches) {
        orbitBlend = target;
        transition = null;
      } else if (orbitBlend !== target) {
        transition = {from: orbitBlend, to: target, start: performance.now()};
      } else {
        transition = null;
      }
      stage.dataset.orbit = String(mode === '3');
      syncRotation();
      statusText.textContent = mode === '3' ? 'Glisser pour tourner · relief ×3' : 'Vue verticale';
    }
    redraw();
  });
}
zoomOut.onclick = () => setZoom(zoom / 1.35);
zoomIn.onclick = () => setZoom(zoom * 1.35);
compass.onclick = resetView;
canvas.onwheel = event => {
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
  setZoom(zoom * Math.exp(-clamp(event.deltaY * unit, -400, 400) * .0018));
};
canvas.onkeydown = event => {
  if (event.key === '-' || event.key === '_') zoomOut.click();
  else if (event.key === '+' || event.key === '=') zoomIn.click();
  else if (event.key === 'Home') resetView();
  else if (mode === '3' && event.key.startsWith('Arrow')) {
    const step = Math.PI / 18;
    orbit(({ArrowLeft: -step, ArrowRight: step})[event.key] || 0,
          ({ArrowUp: step, ArrowDown: -step})[event.key] || 0);
  } else return;
  event.preventDefault();
};

canvas.onpointerdown = event => {
  if (mode !== '3' || event.button !== 0) return;
  canvas.focus({preventScroll: true});
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
};
canvas.onpointermove = event => {
  const old = pointers.get(event.pointerId);
  if (!old || mode !== '3') return;
  const x = event.clientX, y = event.clientY;
  if (pointers.size === 1) {
    orbit((x - old.x) * 2 * Math.PI / stage.clientWidth, (y - old.y) * Math.PI / stage.clientHeight);
  } else if (pointers.size === 2) {
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
    const distance = Math.hypot(old.x - other.x, old.y - other.y);
    if (distance > 1) setZoom(zoom * Math.hypot(x - other.x, y - other.y) / distance);
  }
  pointers.set(event.pointerId, {x, y});
};
canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = event => pointers.delete(event.pointerId);

try {
  data = await loadTerrain();
  document.querySelectorAll('.map-controls button').forEach(button => button.disabled = false);
  statusText.textContent = 'Vue verticale';
  stage.dataset.ready = 'true';
  resize();
  new ResizeObserver(resize).observe(stage);
} catch {
  statusText.textContent = 'Chargement impossible. Rechargez la page depuis le serveur local.';
}
