/* Audio analysis uses only the playing exercise clip. */
const player = document.getElementById('player');
const canvas = document.getElementById('live');
const supplied = document.getElementById('spectrum');
const label = document.getElementById('plot-label');
const brush = canvas.getContext('2d');
let context, analyser, values, frame;
let lastColumn = -1;
const plotControl = document.getElementById('plot-control');
const playTag = document.getElementById('play-tag');
const playTime = document.getElementById('play-time');
const playhead = plotControl.querySelector('.playhead');
const overlay = document.getElementById('cam-overlay');
const camToggle = document.getElementById('cam-toggle');

function showModelView(enabled) {
  const clip = clips[round];
  canvas.hidden = true;
  supplied.hidden = false;
  overlay.hidden = !enabled;
  camToggle.setAttribute('aria-pressed', String(enabled));
  label.classList.remove('energy-key');
  label.classList.toggle('cam-key', enabled);
  label.textContent = enabled
    ? 'Contribution positive · ' + classNames[clipResults.clips[clip.id].soundClass]
    : 'Spectrogramme du kit';
}

camToggle.addEventListener('click', () => showModelView(overlay.hidden));
player.addEventListener('ended', () => {
  const clip = clips[round];
  if (!clipResults.clips[clip.id]) return;
  overlay.src = 'assets/' + clip.id + '-cam.png';
  camToggle.hidden = false;
  showModelView(true);
});
function positionPlayhead() {
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;
  playhead.style.left = (progress * 100) + '%';
  playhead.hidden = progress <= 0;
}

function updateControl() {
  const playing = !player.paused && !player.ended;
  const action = playing ? 'Pause' : player.ended ? 'Réécouter' : player.currentTime ? 'Reprendre' : 'Lire';
  playTag.textContent = action;
  plotControl.dataset.playing = String(playing);
  positionPlayhead();
  plotControl.setAttribute('aria-label', playing ? 'Mettre en pause' : action + ' l’extrait');
  const seconds = Math.floor(player.currentTime || 0);
  const duration = Number.isFinite(player.duration) ? Math.round(player.duration) : 5;
  playTime.textContent = '0:' + String(seconds).padStart(2, '0') + ' / 0:' + String(duration).padStart(2, '0');
}

plotControl.addEventListener('click', async () => {
  if (!player.paused) {
    player.pause();
    return;
  }
  try {
    await player.play();
  } catch (error) {
    if (error.name !== 'AbortError') label.textContent = 'Lecture indisponible';
  }
});
for (const event of ['loadstart', 'loadedmetadata', 'play', 'pause', 'timeupdate', 'ended']) {
  player.addEventListener(event, updateControl);
}
updateControl();

function resetPlot() {
  cancelAnimationFrame(frame);
  lastColumn = -1;
  brush.fillStyle = '#080b0e';
  brush.fillRect(0, 0, canvas.width, canvas.height);
  canvas.hidden = true;
  supplied.hidden = false;
  overlay.hidden = true;
  camToggle.hidden = true;
  camToggle.setAttribute('aria-pressed', 'false');
  label.classList.remove('energy-key', 'cam-key');
  label.textContent = 'Spectrogramme du kit';
}

function drawSpectrum() {
  if (player.paused) return;
  if (!Number.isFinite(player.duration)) {
    frame = requestAnimationFrame(drawSpectrum);
    return;
  }
  analyser.getByteFrequencyData(values);
  positionPlayhead();
  const topBin = Math.min(values.length - 1, Math.round(8000 * analyser.fftSize / context.sampleRate));
  let peak = 0;
  for (let i = 0; i <= topBin; i++) peak = Math.max(peak, values[i]);
  // Byte bins span the configured dB range. Mark bands within 8 dB of
  // this frame's peak only when the peak is above the noise floor.
  const dbPerStep = (analyser.maxDecibels - analyser.minDecibels) / 255;
  const peakDb = analyser.minDecibels + peak * dbPerStep;
  const x = Math.min(canvas.width - 1, Math.floor(canvas.width * player.currentTime / player.duration));
  if (x < lastColumn) resetPlot();
  const start = lastColumn < 0 ? x : lastColumn;
  for (let y = 0; y < canvas.height; y++) {
    const hz = 8000 * (1 - y / canvas.height);
    const index = Math.min(values.length - 1, Math.round(hz * analyser.fftSize / context.sampleRate));
    const value = values[index] / 255;
    const strong = peakDb > -65 && values[index] >= peak - 8 / dbPerStep;
    brush.fillStyle = strong ? '#ffce77' : 'rgb(' + [8+154*value,11+198*value,14+164*value].map(Math.round).join(',') + ')';
    brush.fillRect(start, y, x - start + 1, 1);
  }
  lastColumn = x;
  supplied.hidden = true;
  canvas.hidden = false;
  if (!label.classList.contains('energy-key')) {
    label.classList.add('energy-key');
    label.textContent = 'Bandes les plus intenses · 0–8 kHz';
  }
  frame = requestAnimationFrame(drawSpectrum);
}

player.addEventListener('clipchange', resetPlot);
player.addEventListener('loadstart', resetPlot);
player.addEventListener('seeking', () => { lastColumn = -1; });
player.addEventListener('pause', () => cancelAnimationFrame(frame));
player.addEventListener('playing', async () => {
  if (!camToggle.hidden) resetPlot();
  if (location.protocol === 'file:' || !window.AudioContext) return;
  if (!context) {
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0;
    values = new Uint8Array(analyser.frequencyBinCount);
    context.createMediaElementSource(player).connect(analyser);
    analyser.connect(context.destination);
  }
  await context.resume();
  cancelAnimationFrame(frame);
  if (!player.paused) drawSpectrum();
});
