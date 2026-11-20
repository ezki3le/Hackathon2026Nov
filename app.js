const $ = id => document.getElementById(id);
const clips = [
  {id:'c5_0021',label:'Mécanique'},
  {id:'c5_0006',label:'Drone'},
  {id:'c5_0025',label:'Ambiance'},
  {id:'c5_0033',label:'Explosion'}
];
const stations = [
  {name:'A1',signal:4,wifi:4,x:65,y:40},
  {name:'A2',signal:2,wifi:3,x:48,y:65},
  {name:'A3',signal:1,wifi:2,x:29,y:38}
];
let station = 0, round = 0;

let reportShown = false;
let previewPlayer = null;
const classNames = {
  drone_buzz: 'Drone',
  vehicle_mechanical: 'Mécanique',
  explosion: 'Explosion',
  ambient_outdoor: 'Ambiance'
};
const percent = new Intl.NumberFormat('fr-FR', {style: 'percent', maximumFractionDigits: 1});

function showPrediction(soundClass) {
  document.querySelectorAll('.lamp').forEach(lamp => {
    const active = lamp.dataset.sound === soundClass;
    lamp.classList.toggle('lit', active);
    lamp.setAttribute('aria-label', classNames[lamp.dataset.sound] + (active ? ' · allumé' : ' · éteint'));
    lamp.setAttribute('role', 'img');
  });
}

function reportClip() {
  if (reportShown) return;
  const clip = clips[round];
  const report = clipResults.clips[clip.id];
  if (!report) {
    log(clip.id + ' · résultat du CNN indisponible');
    return;
  }
  reportShown = true;
  showPrediction(report.soundClass);
  const name = classNames[report.soundClass];
  const wake = report.wakeScore >= clipResults.wakeThreshold;
  addResultCard(clip, report, name, wake);
  $('next').hidden = false;
  $('next').textContent = round === clips.length - 1 ? 'Rejouer' : 'Extrait suivant';
}
$('player').addEventListener('ended', reportClip);
function addResultCard(clip, report, name, wake) {
  const eventId = 'event-' + clip.id;
  if (document.getElementById(eventId)) return;
  const item = document.createElement('li');
  item.id = eventId;
  item.className = 'result-card';
  const details = document.createElement('details');
  details.innerHTML = `
    <summary>
      <span class="result-heading"><strong>${name}</strong><small>${clip.id} · ${new Date().toLocaleTimeString('fr-FR')}</small></span>
      <span class="review-state">${wake ? 'Vidéo demandée' : 'Vidéo en veille'}</span>
    </summary>
    <div class="result-body">
      <dl>
        <dt>Classe du CNN</dt><dd>${name}</dd>
        <dt>Annotation du clip</dt><dd>${clip.label}</dd>
        <dt>Score vidéo / seuil</dt><dd>${percent.format(report.wakeScore)} / ${percent.format(clipResults.wakeThreshold)}</dd>
        <dt>Source</dt><dd>1 extrait mono · 5 s</dd>
      </dl>
      <figure><img src="assets/${clip.id}.png" alt="Spectrogramme log-mel analysé par le CNN" width="100" height="100"></figure>
    </div>`;
  const badges = document.createElement('div');
  badges.className = 'event-stations';
  const legend = document.createElement('small');
  legend.textContent = 'Écoutes simulées';
  const panel = document.createElement('div');
  panel.className = 'station-panel';
  panel.id = eventId + '-station';
  panel.hidden = true;
  const line = document.createElement('p');
  const preview = document.createElement('audio');
  preview.controls = true;
  preview.preload = 'none';
  preview.src = 'assets/' + clip.id + '.wav';
  preview.addEventListener('play', () => {
    if (previewPlayer && previewPlayer !== preview) previewPlayer.pause();
    $('player').pause();
    previewPlayer = preview;
  });
  panel.append(line, preview);
  for (const antenna of stations) {
    const button = document.createElement('button');
    button.className = 'station-badge';
    button.textContent = antenna.name;
    button.setAttribute('aria-label', 'Écoute simulée ' + antenna.name + ' · ' + clip.id);
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    button.onclick = () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      preview.pause();
      for (const badge of badges.querySelectorAll('button')) {
        badge.setAttribute('aria-expanded', String(open && badge === button));
      }
      panel.hidden = !open;
      if (!open) return;
      preview.currentTime = 0;
      preview.volume = antenna.signal / 4;
      preview.setAttribute('aria-label', 'Réécouter ' + clip.id + ' pour ' + antenna.name);
      line.textContent = antenna.name + ' · Niveau sonore ' + antenna.signal +
        '/4 · Wi-Fi ' + antenna.wifi + '/4 · Même extrait, volume simulé.';
    };
    badges.append(button);
  }
  badges.append(legend);
  item.append(details, badges, panel);
  $('log').prepend(item);
}

function log(message) {
  const item = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('fr-FR');
  item.append(time, document.createTextNode(message));
  $('log').prepend(item);
}

$('player').addEventListener('play', () => previewPlayer?.pause());
function updateStationStatus() {
  const player = $('player');
  document.querySelectorAll('.station-status').forEach((badge, i) => {
    const active = i === station;
    const playing = active && !player.paused && !player.ended;
    badge.dataset.state = playing ? 'playing' : active ? 'selected' : 'idle';
    badge.textContent = playing ? 'Écoute' : active ? 'Sélection' : 'Dispo';
  });
}
function selectStation(index){
  station=index;
  for(const container of [$('pins'),$('receivers')]){
    container.querySelectorAll('button').forEach((button,i)=>{
      button.classList.toggle('active',i===index);
      button.setAttribute('aria-pressed',String(i===index));
    });
  }
  updateStationStatus();
}
for (const event of ['playing', 'pause', 'ended', 'emptied']) {
  $('player').addEventListener(event, updateStationStatus);
}
stations.forEach((s,i)=>{
  const pin=document.createElement('button');
  pin.className='pin';pin.textContent=s.name;
  pin.style.left=s.x+'%';pin.style.top=s.y+'%';
  pin.title = 'Antenne ' + s.name;
  pin.setAttribute('aria-label','Sélectionner '+pin.title);
  const rx=document.createElement('button');rx.className='rx';
  rx.title = pin.title + ' · Niveau sonore ' + s.signal + '/4 · Wi-Fi ' + s.wifi + '/4 (simulation)';
  rx.setAttribute('aria-label', rx.title);
  rx.innerHTML = `<b>${s.name}</b>
    <svg class="wifi" data-level="${s.wifi}" viewBox="0 0 24 20" aria-hidden="true">
      <circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/>
      <path d="M8.4 12.4a5.1 5.1 0 0 1 7.2 0"/>
      <path d="M5.3 9a9.6 9.6 0 0 1 13.4 0"/>
      <path d="M2 5.6a14.2 14.2 0 0 1 20 0"/>
    </svg>
    <span class="gauge" data-level="${s.signal}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  for (const indicator of rx.querySelectorAll('[data-level]')) {
    [...indicator.children].slice(0, Number(indicator.dataset.level))
      .forEach(part => part.classList.add('lit'));
  }
  for(const b of [pin,rx]) b.onclick=()=>{selectStation(i);log(s.name+' sélectionné pour l’écoute.');};
  const group = document.createElement('div');
  group.className = 'station-group';
  const badge = document.createElement('span');
  badge.className = 'station-status';
  badge.id = 'status-' + s.name;
  rx.setAttribute('aria-describedby', badge.id);
  group.append(rx, badge);
  $('pins').append(pin);$('receivers').append(group);
});
function showClip(){
  showPrediction(null);
  reportShown=false;
  previewPlayer?.pause();
  document.getElementById('spectrum').src='assets/'+clips[round].id+'.png';
  $('player').src='assets/'+clips[round].id+'.wav';
  $('player').dispatchEvent(new Event('clipchange'));
  $('round').textContent=(round+1)+' / '+clips.length;
  $('next').hidden=true;
}
$('next').onclick=()=>{
  round=(round+1)%clips.length;
  showClip();
};
$('layer').onclick=()=>{
  const plan=$('map').classList.toggle('plan');
  $('layer').textContent=plan?'Vue aérienne':'Vue plan';
  $('credit').textContent=plan?'Plan IGN · Géoplateforme':'Orthophotographie © IGN · Géoplateforme';
};
let mapZoom = 1.5;
function setZoom(value) {
  mapZoom = Math.max(1, Math.min(2, value));
  $('map').style.setProperty('--zoom', mapZoom);
  $('zoom-level').value = mapZoom.toLocaleString('fr-FR') + '×';
  $('zoom-out').disabled = mapZoom === 1;
  $('zoom-in').disabled = mapZoom === 2;
}
$('zoom-in').onclick = () => setZoom(mapZoom + 0.25);
$('zoom-out').onclick = () => setZoom(mapZoom - 0.25);
setZoom(mapZoom);
selectStation(0);showClip();log('Session ouverte · 3 récepteurs simulés.');
