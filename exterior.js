const scenes=[...document.querySelectorAll('.scene')];
const dtmf=document.getElementById('audioDtmf');
const clickAudio=document.getElementById('audioClick');
const staticAudio=document.getElementById('audioStatic');
const whiteBurn=document.getElementById('whiteBurn');
const signalSweep=document.getElementById('signalSweep');
const flashBoost=document.getElementById('flashBoost');
const zappingVideo=document.getElementById('zappingVideo');
const zappingFallback=document.getElementById('zappingFallback');
const zappingScreen=document.getElementById('zappingScreen');
const hudChannel=document.getElementById('hudChannel');
const liveLabel=document.getElementById('liveLabel');
const hudClock=document.getElementById('hudClock');
const hudSubline=document.getElementById('hudSubline');
const signalQuality=document.getElementById('signalQuality');
const hudStation=document.getElementById('hudStation');
const introLines=[...document.querySelectorAll('.intro-line')];
const musicFade=document.getElementById('musicFade');

const CONFIG={
  audio:{
    introStartAt:0,
    revealAt:49.08,
    titleHoldMs:1100,
    burstHoldMs:12000,
    endIntroAt:76.0,
    volume:0.95,
    clickVolume:0.2,
    staticVolume:0.14,
    fadeOutMs:3200,
    clipVolume:0.33,
  },
  zapping:{
    blackoutMin:520,
    blackoutMax:1180,
    lockPause:2400,
    channels:[
      {label:'CH 02', quality:'débil', sub:'búsqueda', hint:'sintonizando…', mode:'static', hold:[2400,3400]},
      {label:'CH 05', quality:'media', sub:'clip perdido', hint:'interferencia…', mode:'video', hold:[2600,3600]},
      {label:'CH 08', quality:'inestable', sub:'barras', hint:'casi fija…', mode:'bars', hold:[2200,3000]},
      {label:'CH 11', quality:'débil', sub:'cinta vieja', hint:'todavía no…', mode:'video', hold:[2600,3600]},
      {label:'CH 04', quality:'muy débil', sub:'ruido', hint:'sigue buscando…', mode:'static', hold:[2500,3600]},
      {label:'CH 09', quality:'media', sub:'cinta perdida', hint:'casi…', mode:'video', hold:[2800,3900]},
      {label:'CH 22', quality:'fija', sub:'canal correcto', hint:'señal encontrada', mode:'lock', hold:[3400,4600]}
    ],
    videoCandidates:Array.from({length:20},(_,i)=>`./assets/videos/clip${String(i+1).padStart(2,'0')}.mp4`)
  }
};


function showScene(id){
  scenes.forEach(s=>{s.classList.remove('active','analog-enter','analog-ghost');});
  const next=document.getElementById(id);
  if(next){ next.classList.add('active','analog-enter'); setTimeout(()=>next.classList.add('analog-ghost'),40); }
  signalSweep.classList.remove('run'); void signalSweep.offsetWidth; signalSweep.classList.add('run');
  if(id==='scene-speech' && typeof resetSpeechSlides==='function') resetSpeechSlides();
}
function wait(ms){return new Promise(r=>setTimeout(r,ms));}

async function stopAllForHijack(){
  try{
    runIntroSequence.locked=false;
  }catch(e){}
  try{
    dtmf.pause();
    dtmf.currentTime=0;
    dtmf.volume=CONFIG.audio.volume;
  }catch(e){}
  try{
    staticAudio.pause();
    staticAudio.currentTime=0;
  }catch(e){}
  try{
    clickAudio.pause();
    clickAudio.currentTime=0;
  }catch(e){}
  try{
    zappingVideo.pause();
    zappingVideo.currentTime=0;
    zappingVideo.removeAttribute('src');
    zappingVideo.load();
  }catch(e){}
  try{
    musicFade.classList.remove('on');
    whiteBurn.classList.remove('active','intense');
    flashBoost?.classList.remove('active');
    document.body.classList.remove('party-mode','zapping-live');
    document.querySelector('.burst-wrap')?.classList.remove('live');
  }catch(e){}
  try{
    resetHijackSequence();
  }catch(e){}
  await wait(20);
}

function rand(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function setHudChannel(text){hudChannel.textContent=text; liveLabel.textContent=text.toLowerCase();}
function updateClock(){
  const now=new Date();
  hudClock.textContent=now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateClock,1000); updateClock();

function makeBeepWav({freq=900,duration=0.05,vol=0.35,rate=44100}={}){
  const samples=Math.floor(duration*rate); const buffer=new ArrayBuffer(44+samples*2); const view=new DataView(buffer);
  const writeStr=(o,s)=>[...s].forEach((c,i)=>view.setUint8(o+i,c.charCodeAt(0)));
  writeStr(0,'RIFF'); view.setUint32(4,36+samples*2,true); writeStr(8,'WAVE'); writeStr(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,rate,true); view.setUint32(28,rate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); writeStr(36,'data'); view.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i++){
    const t=i/rate; const env=Math.min(1,i/(samples*0.08))*Math.min(1,(samples-i)/(samples*0.25));
    const s=Math.sin(2*Math.PI*freq*t)*vol*env + Math.sin(2*Math.PI*(freq*1.95)*t)*vol*0.2*env;
    view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*32767,true);
  }
  return URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
}
clickAudio.src=makeBeepWav({freq:1120,duration:0.05,vol:0.25});
staticAudio.src=makeBeepWav({freq:78,duration:0.4,vol:0.18});


/* === hijack webaudio === */
let hijackAudioCtx=null;
let hijackHumOsc=null;
let hijackHumGain=null;
function ensureHijackAudio(){
  if(!hijackAudioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    hijackAudioCtx = new Ctx();
  }
  if(hijackAudioCtx.state === 'suspended') hijackAudioCtx.resume();
  return hijackAudioCtx;
}
function stopHijackHum(){
  if(hijackHumGain && hijackAudioCtx){
    hijackHumGain.gain.cancelScheduledValues(hijackAudioCtx.currentTime);
    hijackHumGain.gain.setTargetAtTime(0.0001, hijackAudioCtx.currentTime, 0.06);
  }
  if(hijackHumOsc){
    const osc=hijackHumOsc; hijackHumOsc=null;
    setTimeout(()=>{ try{osc.stop();}catch(_e){} }, 180);
  }
  hijackHumGain=null;
}
function startHijackHum(){
  const ctx=ensureHijackAudio();
  if(!ctx || hijackHumOsc) return;
  hijackHumOsc=ctx.createOscillator();
  hijackHumGain=ctx.createGain();
  const wobble=ctx.createOscillator();
  const wobbleGain=ctx.createGain();
  hijackHumOsc.type='sawtooth';
  hijackHumOsc.frequency.value=46;
  wobble.type='sine'; wobble.frequency.value=0.8; wobbleGain.gain.value=2.5;
  wobble.connect(wobbleGain).connect(hijackHumOsc.frequency);
  hijackHumGain.gain.value=0.0001;
  hijackHumOsc.connect(hijackHumGain).connect(ctx.destination);
  hijackHumOsc.start(); wobble.start();
  hijackHumGain.gain.setTargetAtTime(0.028, ctx.currentTime, 0.2);
  hijackHumOsc._wobble=wobble; hijackHumOsc._wobbleGain=wobbleGain;
}
function hijackBeep(freq=440,duration=0.12,type='square',volume=0.03,when=0){
  const ctx=ensureHijackAudio(); if(!ctx) return;
  const osc=ctx.createOscillator(); const gain=ctx.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq, ctx.currentTime+when);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime+when);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime+when+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+when+duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime+when); osc.stop(ctx.currentTime+when+duration+0.03);
}
function hijackNoiseBurst(duration=0.18, volume=0.05, when=0){
  const ctx=ensureHijackAudio(); if(!ctx) return;
  const buffer=ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate*duration)), ctx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
  const src=ctx.createBufferSource();
  const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=1800; filter.Q.value=0.8;
  const gain=ctx.createGain();
  gain.gain.setValueAtTime(0.0001, ctx.currentTime+when);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime+when+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+when+duration);
  src.buffer=buffer; src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime+when); src.stop(ctx.currentTime+when+duration+0.03);
}


let cachedVideos=null;
async function getExistingVideoList(){
  if(cachedVideos) return cachedVideos;
  const existing=[];
  for(const src of CONFIG.zapping.videoCandidates){
    try{
      const res=await fetch(src,{method:'HEAD'});
      if(res.ok) existing.push(src);
    }catch(_e){}
  }
  cachedVideos=existing;
  return existing;
}

async function playClick(){
  try{clickAudio.currentTime=0; clickAudio.volume=CONFIG.audio.clickVolume; await clickAudio.play();}catch(_e){}
}
async function playStatic(){
  try{staticAudio.currentTime=0; staticAudio.loop=true; staticAudio.volume=CONFIG.audio.staticVolume; await staticAudio.play();}catch(_e){}
}
function stopStatic(){try{staticAudio.pause(); staticAudio.currentTime=0;}catch(_e){}}

function setZappingMode(mode){
  zappingScreen.classList.remove('mode-static','mode-video','mode-bars','mode-lock','pause-black');
  zappingScreen.classList.add(`mode-${mode}`);
}

async function fadeAudio(audio,target=0,duration=1200){
  const start=audio.volume; const t0=performance.now();
  return new Promise(resolve=>{
    function step(t){
      const p=Math.min(1,(t-t0)/duration);
      audio.volume=start+(target-start)*p;
      if(p<1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

function safePauseVideo(){
  try{zappingVideo.pause(); zappingVideo.muted=true; zappingVideo.volume=0;}catch(_e){}
  zappingVideo.classList.remove('active');
  zappingVideo.removeAttribute('src');
  zappingVideo.load();
}

async function loadVideo(src){
  return new Promise(resolve=>{
    let done=false;
    const cleanup=()=>{
      zappingVideo.oncanplay=null;
      zappingVideo.onerror=null;
    };
    const finish=(ok)=>{
      if(done) return;
      done=true;
      cleanup();
      resolve(ok);
    };
    zappingVideo.oncanplay=()=>finish(true);
    zappingVideo.onerror=()=>finish(false);
    zappingVideo.src=src;
    zappingVideo.load();
    setTimeout(()=>finish(false),1800);
  });
}

async function showChannel(step, videoSrc){
  setHudChannel(step.label);
  if(hudStation) hudStation.textContent=step.station;
  hudSubline.textContent=step.name;
  signalQuality.textContent=step.audio;
  signalSweep.classList.remove('run'); void signalSweep.offsetWidth; signalSweep.classList.add('run');
  document.body.classList.add('zapping-live');
  zappingScreen.classList.add('pause-black');
  await playClick();
  await wait(rand(CONFIG.zapping.blackoutMin, CONFIG.zapping.blackoutMax));
  setZappingMode(step.mode);

  let usedVideo=false;
  if((step.mode==='video' || step.mode==='lock') && videoSrc){
    safePauseVideo();
    const ok=await loadVideo(videoSrc);
    if(ok){
      zappingVideo.classList.add('active');
      zappingFallback.classList.remove('active');
      zappingVideo.currentTime=0;
      zappingVideo.muted=false;
      zappingVideo.volume=CONFIG.audio.clipVolume;
      try{ await zappingVideo.play(); usedVideo=true; }catch(_e){ usedVideo=false; }
    }
  }

  if(!usedVideo){
    safePauseVideo();
    zappingVideo.classList.remove('active');
    zappingFallback.classList.add('active');
    if(step.mode==='video' || step.mode==='lock') setZappingMode('static');
  }

  zappingScreen.classList.remove('pause-black');
  setTimeout(()=>document.body.classList.remove('zapping-live'), 420);
}

async function runZapping(){
  showScene('scene-zapping');
    const videos=await getExistingVideoList();
  let videoIndex=0;
  await playStatic();

  for(let i=0;i<CONFIG.zapping.channels.length;i++){
    const step=CONFIG.zapping.channels[i];
    const src=(step.mode==='video' || step.mode==='lock') && videos.length ? videos[videoIndex++ % videos.length] : null;
    await showChannel(step, src);

    if(i===CONFIG.zapping.channels.length-1){
      await fadeAudio(staticAudio,0,700);
      stopStatic();
      await fadeAudio(zappingVideo,0,240).catch(()=>{});
      safePauseVideo();
      zappingFallback.classList.remove('active');
      await wait(CONFIG.zapping.lockPause);
    }else{
      await wait(rand(...step.hold));
    }
  }
}

async function startDtmf(){
  try{
    dtmf.currentTime=CONFIG.audio.introStartAt;
    dtmf.volume=CONFIG.audio.volume;
    await dtmf.play();
  }catch(_e){}
}

function clearIntro(){introLines.forEach(l=>l.classList.remove('show','fade')); musicFade.classList.remove('on');}

function populateBurstParticles(){
  const host=document.getElementById('burstParticles');
  if(!host || host.dataset.ready) return;
  host.dataset.ready='1';
  for(let i=0;i<56;i++){
    const el=document.createElement('i');
    el.style.left=`${Math.random()*100}%`;
    el.style.top=`${-10-Math.random()*40}vh`;
    el.style.height=`${10+Math.random()*24}px`;
    el.style.width=`${4+Math.random()*5}px`;
    el.style.animationDuration=`${4.5+Math.random()*4.5}s`;
    el.style.animationDelay=`${-Math.random()*6}s`;
    el.style.opacity=`${0.35+Math.random()*0.5}`;
    el.style.transform=`rotate(${Math.random()*90}deg)`;
    host.appendChild(el);
  }
}

async function runIntroSequence(){
  populateBurstParticles();
  if(runIntroSequence.locked) return;
  runIntroSequence.locked=true;
  try{
    await runZapping();
    showScene('scene-intro');
    clearIntro();
    await wait(380);
    await startDtmf();

    const schedule=[
      {at:17.0, idx:0},
      {at:21.0, idx:1},
      {at:25.0, idx:2},
      {at:29.0, idx:3},
      {at:33.4, idx:4},
      {at:38.0, idx:5},
      {at:42.8, idx:6},
      {at:47.0, idx:7},
    ];
    let shown=-1;
    function setIntroState(current){
      introLines.forEach((line, idx)=>{
        line.classList.remove('show','fade');
        if(idx===current) line.classList.add('show');
        else if(idx===current-1) line.classList.add('fade');
      });
    }
    while(dtmf.currentTime < CONFIG.audio.revealAt - 0.05){
      const t=dtmf.currentTime;
      for(let i=0;i<schedule.length;i++){
        if(i>shown && t>=schedule[i].at){
          setIntroState(i);
          shown=i;
        }
      }
      if(t > CONFIG.audio.revealAt - 3.6) musicFade.classList.add('on');
      await wait(35);
    }

    whiteBurn.classList.add('active','intense');
    flashBoost?.classList.add('active');
    await wait(380);
    whiteBurn.classList.remove('active','intense');
    flashBoost?.classList.remove('active');
    showScene('scene-burst');
    document.querySelector('.burst-wrap')?.classList.add('live');
    document.body.classList.add('party-mode');
    await wait(CONFIG.audio.burstHoldMs);
    await fadeAudio(dtmf,0,CONFIG.audio.fadeOutMs);
    dtmf.pause();
    dtmf.currentTime=0;
    dtmf.volume=CONFIG.audio.volume;
    document.querySelector('.burst-wrap')?.classList.remove('live');
    document.body.classList.remove('party-mode');
    await wait(220);
    showScene('scene-speech');
  } finally {
    runIntroSequence.locked=false;
  }
}
runIntroSequence.locked=false;


function captureCurrentSceneForHijack(){
  const active=document.querySelector('.scene.active:not(#scene-hijack)');
  if(!active || !integratedHijack.capturedFrame) return;
  const clone=active.cloneNode(true);
  clone.classList.remove('active','analog-enter','analog-ghost');
  clone.classList.add('captured-scene');
  integratedHijack.capturedFrame.innerHTML='';
  integratedHijack.capturedFrame.appendChild(clone);
}

async function triggerHijack(){
  integratedHijack.previousSceneId = document.querySelector('.scene.active:not(#scene-hijack)')?.id || 'scene-speech';
  captureCurrentSceneForHijack();
  await stopAllForHijack();
  clearHijackTimers();
  ensureHijackAudio();
  runIntegratedHijack();
}

document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(key==='1') showScene('scene-standby');
  if(key==='2') runIntroSequence();
  if(key==='3') showScene('scene-speech');
  if(key==='4' || key==='g') triggerHijack();
});

function fitIntroLines(){
  const smallScreen = window.innerWidth < 780;
  introLines.forEach(line=>{
    line.style.fontSize='';
    let size = smallScreen ? 30 : 58;
    const min = smallScreen ? 20 : 28;
    line.style.fontSize = size + 'px';
    while(line.scrollWidth > line.clientWidth + 2 && size > min){
      size -= 1;
      line.style.fontSize = size + 'px';
    }
  });
}
window.addEventListener('resize', fitIntroLines);
window.addEventListener('load', fitIntroLines);
fitIntroLines();


/* === speech deck controls restored === */
const speechSlides = Array.from(document.querySelectorAll('#scene-speech .speech-slide'));
const speechCounter = document.getElementById('speechCounter');
const speechPrevBtn = document.getElementById('speechPrevBtn');
const speechNextBtn = document.getElementById('speechNextBtn');
let speechIndex = 0;
function renderSpeechSlide(index){
  if(!speechSlides.length) return;
  speechIndex = Math.max(0, Math.min(index, speechSlides.length - 1));
  speechSlides.forEach((slide,i)=>slide.classList.toggle('active', i===speechIndex));
  if(speechCounter) speechCounter.textContent = `Slide ${speechIndex + 1} / ${speechSlides.length}`;
  if(speechPrevBtn) speechPrevBtn.disabled = speechIndex === 0;
  if(speechNextBtn) speechNextBtn.disabled = speechIndex === speechSlides.length - 1;
}
function resetSpeechSlides(){ renderSpeechSlide(0); }
if(speechPrevBtn) speechPrevBtn.addEventListener('click', ()=>renderSpeechSlide(speechIndex - 1));
if(speechNextBtn) speechNextBtn.addEventListener('click', ()=>renderSpeechSlide(speechIndex + 1));
document.addEventListener('keydown',e=>{
  if(!document.getElementById('scene-speech')?.classList.contains('active')) return;
  if(e.key === 'ArrowRight' || e.key === ' '){ e.preventDefault(); renderSpeechSlide(speechIndex + 1); }
  if(e.key === 'ArrowLeft'){ e.preventDefault(); renderSpeechSlide(speechIndex - 1); }
});
resetSpeechSlides();

/* === integrated illegal hijack v16 === */
const integratedHijack={
  root: document.getElementById('scene-hijack'),
  previousSceneId: null,
  presentation: document.getElementById('hijackPresentation'),
  capturedFrame: document.getElementById('hijackCapturedFrame'),
  system: document.getElementById('hijackSystem'),
  portal: document.getElementById('hijackPortal'),
  reveal: document.getElementById('hijackReveal'),
  progress: document.getElementById('hijackProgress'),
  fx: {
    bars: document.getElementById('hijackBars'),
    bloom: document.getElementById('hijackBloom'),
    noise: document.getElementById('hijackNoise'),
    scan: document.getElementById('hijackScan'),
    tear: document.getElementById('hijackTear'),
    rgbA: document.getElementById('hijackRgbA'),
    rgbB: document.getElementById('hijackRgbB'),
    rgbC: document.getElementById('hijackRgbC'),
    whiteHit: document.getElementById('hijackWhiteHit'),
    fracture: document.getElementById('hijackFracture'),
    blackout: document.getElementById('hijackBlackout'),
    collapse: document.getElementById('hijackCollapse')
  }
};
let integratedHijackTimers=[];
function clearHijackTimers(){ integratedHijackTimers.forEach(clearTimeout); integratedHijackTimers=[]; }
function hijackFxOn(names){ names.forEach(n=>integratedHijack.fx[n]?.classList.add('on')); }
function hijackFxOff(names){ names.forEach(n=>integratedHijack.fx[n]?.classList.remove('on')); }
function hijackFxOffAll(){ Object.values(integratedHijack.fx).forEach(el=>el?.classList.remove('on')); }
function resetHijackSequence(){
  clearHijackTimers();
  hijackFxOffAll();
  stopHijackHum();
  const root=integratedHijack.root, p=integratedHijack.presentation, s=integratedHijack.system, po=integratedHijack.portal, r=integratedHijack.reveal, prog=integratedHijack.progress;
  root?.classList.remove('active','overlay-active');
  if(p){ p.style.opacity='1'; p.style.transform='none'; p.style.filter='none'; p.classList.remove('crash'); }
  if(integratedHijack.capturedFrame){ integratedHijack.capturedFrame.innerHTML=''; }
  s?.classList.remove('show');
  po?.classList.remove('show');
  r?.classList.remove('show');
  if(prog){ prog.style.animation='none'; prog.style.transition='width 1.8s linear'; prog.style.width='0'; void prog.offsetWidth; }
}
function runIntegratedHijack(){
  resetHijackSequence();
  const root=integratedHijack.root, p=integratedHijack.presentation, s=integratedHijack.system, po=integratedHijack.portal, r=integratedHijack.reveal, prog=integratedHijack.progress;
  root?.classList.add('active','overlay-active');
  document.body.classList.add('zapping-live');
  startHijackHum();
  hijackFxOn(['noise','scan']);
  hijackNoiseBurst(0.12,0.07,0);
  hijackBeep(150,0.08,'square',0.035,0.02);
  integratedHijackTimers.push(setTimeout(()=>{
    hijackFxOn(['bars','rgbA','rgbB','whiteHit','tear']);
    hijackNoiseBurst(0.24,0.09,0);
    hijackBeep(92,0.12,'sawtooth',0.05,0.01);
    hijackBeep(70,0.16,'square',0.04,0.1);
  },120));
  integratedHijackTimers.push(setTimeout(()=>{
    if(p) p.classList.add('crash');
    hijackFxOn(['fracture','collapse','blackout','rgbC','bloom']);
    hijackNoiseBurst(0.32,0.11,0);
    hijackBeep(58,0.26,'sawtooth',0.055,0);
  },520));
  integratedHijackTimers.push(setTimeout(()=>{
    s?.classList.add('show');
    if(prog){ prog.style.width='0'; void prog.offsetWidth; prog.style.width='100%'; }
    hijackFxOff(['fracture','whiteHit']);
    hijackBeep(680,0.07,'square',0.024,0);
    hijackBeep(530,0.07,'square',0.024,0.10);
    hijackBeep(860,0.08,'triangle',0.018,0.20);
  },1080));
  integratedHijackTimers.push(setTimeout(()=>{
    hijackBeep(620,0.06,'square',0.018,0);
    hijackBeep(920,0.08,'triangle',0.016,0.07);
  },2200));
  integratedHijackTimers.push(setTimeout(()=>{
    po?.classList.add('show');
    hijackNoiseBurst(0.18,0.05,0);
    hijackBeep(196,0.22,'sawtooth',0.03,0);
  },3800));
  integratedHijackTimers.push(setTimeout(()=>{
    r?.classList.add('show');
    hijackFxOffAll();
    hijackBeep(250,0.14,'square',0.026,0);
    hijackBeep(302,0.14,'square',0.024,0.12);
    hijackBeep(356,0.2,'sawtooth',0.022,0.26);
    stopHijackHum();
  },5400));
}
