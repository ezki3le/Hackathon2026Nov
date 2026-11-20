const $ = id => document.getElementById(id);
const clips = [
  {id:'c5_0021',label:'Mécanique'},
  {id:'c5_0006',label:'Drone'},
  {id:'c5_0025',label:'Ambiance'},
  {id:'c5_0033',label:'Explosion'}
];
const stations = [
  {name:'A1',quality:'Fort',bars:'▂▄▆█',x:65,y:36},
  {name:'A2',quality:'Moyen',bars:'▂▄▆',x:48,y:73},
  {name:'A3',quality:'Fort',bars:'▂▄▆█',x:23,y:32}
];
let station = 0, round = 0, points = 0, answered = false;
function log(message){
  const item=document.createElement('li');
  const time=document.createElement('time');
  time.textContent=new Date().toLocaleTimeString('fr-FR');
  item.append(time,document.createTextNode(message));
  $('log').prepend(item);
}
function selectStation(index){
  station=index;
  for(const container of [$('pins'),$('receivers')]){
    [...container.children].forEach((button,i)=>{
      button.classList.toggle('active',i===index);
      button.setAttribute('aria-pressed',String(i===index));
    });
  }
}
stations.forEach((s,i)=>{
  const pin=document.createElement('button');
  pin.className='pin';pin.textContent=s.name;
  pin.style.left=s.x+'%';pin.style.top=s.y+'%';
  pin.setAttribute('aria-label','Sélectionner le récepteur fictif '+s.name);
  const rx=document.createElement('button');rx.className='rx';
  rx.innerHTML='<b>'+s.name+'</b><span>Récepteur</span><small>'+s.bars+' · Signal '+s.quality.toLowerCase()+'</small>';
  for(const b of [pin,rx]) b.onclick=()=>{selectStation(i);log(s.name+' sélectionné pour l’écoute.');};
  $('pins').append(pin);$('receivers').append(rx);
});
const classes=['Drone','Mécanique','Explosion','Ambiance'];
for(const label of classes){
  const button=document.createElement('button');button.textContent=label;
  button.onclick=()=>{
    if(answered)return;
    answered=true;
    const reference=clips[round].label;
    const correct=label===reference;
    if(correct)points++;
    $('score').textContent=points+' / '+(round+1);
    $('result').textContent=correct?'Bonne écoute !':'Réponse vérifiée';
    $('detail').textContent='Ton choix : '+label+'. Annotation du clip : '+reference+'.';
    button.classList.add('chosen');
    for(const choice of $('choices').children)choice.disabled=true;
    $('next').hidden=false;
    $('next').textContent=round===clips.length-1?'Rejouer':'Extrait suivant';
    log(stations[station].name+' · '+clips[round].id+' · '+reference+' · '+(correct?'réponse juste':'réponse corrigée'));
  };
  $('choices').append(button);
}
function showClip(){
  answered=false;
  $('player').src='assets/'+clips[round].id+'.wav';
  $('round').textContent=(round+1)+' / '+clips.length;
  $('clip').textContent=clips[round].id+' · 5 secondes';
  $('result').textContent='À toi d’écouter';
  $('detail').textContent='Écoute l’extrait puis choisis une classe sonore.';
  $('next').hidden=true;
  for(const b of $('choices').children){b.disabled=false;b.classList.remove('chosen');}
}
$('next').onclick=()=>{
  round=(round+1)%clips.length;
  if(round===0){points=0;$('score').textContent='0 / 0';log('Nouvelle partie.');}
  showClip();
};
$('layer').onclick=()=>{
  const plan=$('map').classList.toggle('plan');
  $('layer').textContent=plan?'Vue aérienne':'Vue plan';
  $('credit').textContent=plan?'Plan IGN · Géoplateforme':'Orthophotographie © IGN · Géoplateforme';
};
selectStation(0);showClip();log('Session ouverte · 3 récepteurs simulés.');

