/* Visual template: il2527, bird-gesture-practice-compatible.html (ae31f1f).
   The game remains the sole owner of camera, gesture recognition and audio. */
(() => {
  const preview=document.body.dataset.tutorialPreview==='true';
  const onboarding=!preview&&new URLSearchParams(location.search).get('lesson')==='1';
  const shell=document.createElement('section');shell.id='flowieTutorial';shell.hidden=true;
  shell.setAttribute('aria-label','Flowie gesture tutorial');
  shell.innerHTML='<div class="tutorial-card-art"><canvas aria-hidden="true"></canvas><div class="tutorial-gestures"></div><output class="tutorial-value" aria-live="polite"></output><p class="tutorial-feedback" role="status"></p></div>';
  document.body.append(shell);
  const card=shell.firstElementChild,canvas=card.querySelector('canvas'),ctx=canvas.getContext('2d');
  canvas.width=1660;canvas.height=948;
  const value=card.querySelector('output'),feedback=card.querySelector('p'),sprites=card.querySelector('.tutorial-gestures');
  const rects=[[[645,616,112,112,'thumb'],[828,616,195,112,'thumb']],[[238,204,150,128,'pinch']],[[303,214,99,108,'thumb']],[[235,214,167,125,'pinch']],[[233,615,166,136,'pinch']],[[1266,215,139,121,'pinch']],[[1238,590,119,133,'thumb']],[[668,605,162,139,'pinch'],[846,591,141,153,'thumb']]];
  const titles=['Show your hand','Vocal volume','Open effects','Try Reverb','Try Delay','Try Filter','Leave effects','Ready to remix'];
  // Clean, pre-cut artwork (no white matte): a light UI layer for the dark game,
  // a looping Flowie clip with real alpha, and separate hand sprites.
  // Bird and hands share one clock (the clip's own time), so they always move together.
  const OX=548,OY=218,BW=560,BH=400,LOOP=4800,BEAT=2400;
  const images=new Map();let shown=-1,loaded=-1,previewPage=0;
  // Flowie is a 60-frame sprite atlas (WebP with alpha) drawn on a canvas: works the same in Chrome, Safari, Firefox and Edge.
  const FW=700,FH=500,FRAMES=60,COLS=10;
  const bird=document.createElement('canvas');bird.className='tutorial-bird';bird.width=FW;bird.height=FH+60;bird.setAttribute('aria-hidden','true');
  const bctx=bird.getContext('2d');let atlas=null,atlasPage=-1;const atlases=new Map();
  // blink: same eyes, colours and timing as the approved prototype (about every 6 s)
  const EYES=[[[786,351,22,28],[850,326,18,25]],[[779,326,15,24],[844,355,23,28]],[[813,316,17,22]],[[802,327,18,25],[859,351,23,28]],[],[[840,323,16,22]],[],[]];
  function blink(P,now,fy){if(still)return;const ph=now%5900;if(ph<3500||ph>3720||Math.sin((ph-3500)/220*Math.PI)<.6)return;const k=FW/BW;
    for(const [x,y,rx,ry] of EYES[P]||[]){const cx=(x-OX)*k,cy=30+(y-OY+fy)*k;bctx.save();bctx.beginPath();bctx.ellipse(cx,cy,(rx+2)*k,(ry+2)*k,0,0,Math.PI*2);bctx.clip();
      const px=bctx.getImageData(Math.round(cx),Math.round(cy-(ry+7)*k),1,1).data;bctx.fillStyle=px[3]>200?`rgb(${px[0]},${px[1]},${px[2]})`:'#d4fa12';   /* eyelid = the face colour just above the eye */bctx.fillRect(cx-(rx+3)*k,cy-(ry+3)*k,(rx*2+6)*k,(ry*2+6)*k);bctx.beginPath();bctx.moveTo(cx-rx*.65*k,cy);bctx.quadraticCurveTo(cx,cy-ry*.35*k,cx+rx*.65*k,cy);
      bctx.lineWidth=4*k;bctx.strokeStyle='#1c0865';bctx.lineCap='round';bctx.stroke();bctx.restore();}}
  function atlasFor(page){if(!atlases.has(page)){const im=new Image();im.decoding='async';im.src=(n=>`${n}`)(`tutorial-bird-${page}.webp`);atlases.set(page,im);}return atlases.get(page);}
  Object.assign(bird.style,{left:`${OX/16.6}%`,top:`${(OY-30*BW/FW)/9.48}%`,width:`${BW/16.6}%`,height:`${((FH+60)*BW/FW)/9.48}%`});
  card.insertBefore(bird,sprites);
  function imageAt(page){
    if(!images.has(page)){const im=new Image();im.src=(n=>`${n}`)(`tutorial-ui-${page}.png`);images.set(page,im);im.onload=()=>{if(shown===page)paint(page)};im.onerror=()=>{feedback.textContent='Tutorial artwork could not load. Reload to retry.'};}
    return images.get(page);
  }
  let hands=[];
  function paint(page){
    const im=imageAt(page);if(!im.complete||!im.naturalWidth)return;
    loaded=page;ctx.clearRect(0,0,1660,948);ctx.drawImage(im,0,0,1660,948);
    if(page===0&&onboarding)ctx.clearRect(540,760,570,140);
    atlas=atlasFor(page);atlasPage=page;atlasFor((page+1)%8);
    for(const k of [...atlases.keys()])if(k!==page&&k!==(page+1)%8)atlases.delete(k);   // keep memory low
    sprites.replaceChildren();hands=[];
    rects[page].forEach(([x,y,w,h,kind],k)=>{
      const g=new Image();g.src=(n=>`${n}`)(`tutorial-hand-${page}-${k}.png`);g.alt='';g.className=`tutorial-gesture ${kind}`;
      Object.assign(g.style,{left:`${x/16.6}%`,top:`${y/9.48}%`,width:`${w/16.6}%`,height:`${h/9.48}%`});
      sprites.append(g);hands.push({el:g,kind,h});
    });
    canvas.setAttribute('aria-label',titles[page]);
  }
  // same motion curves as the approved prototype (bird-gesture-practice v15)
  const ease=x=>x*x*(3-2*x);
  const pinchY=ms=>-Math.cos((ms%BEAT)/BEAT*Math.PI*2);
  function likePress(ms){const p=ms%BEAT;if(p<220)return ease(p/220);if(p<460)return 1-1.3*ease((p-220)/240);if(p<700)return -.3+.3*ease((p-460)/240);return 0;}
  const startPulse=ms=>.5-.5*Math.cos(ms/BEAT*Math.PI*2);
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastMove=0;
  function moveHands(now){
    if(!document.hidden&&!shell.hidden&&now-lastMove>40){lastMove=now;
      const ms=now%LOOP;
      if(atlas&&atlas.complete&&atlas.naturalWidth){const f=still?0:Math.floor((now%BEAT)/BEAT*FRAMES)%FRAMES;
        let fy=still?0:Math.sin(ms/LOOP*Math.PI*2)*2;const P=atlasPage;
        if(!still&&[1,3,4,5,7].includes(P))fy+=pinchY(ms-120)*5;if(!still&&[2,6,7].includes(P))fy+=likePress(ms-60)*5;
        bctx.clearRect(0,0,FW,FH+60);bctx.drawImage(atlas,(f%COLS)*FW,Math.floor(f/COLS)*FH,FW,FH,0,30+fy*FW/BW,FW,FH);blink(P,now,fy);}
      for(const g of hands){let t='';
        if(still){}else if(shown===0)t=`scale(${1+.1*startPulse(ms)})`;
        else if(g.kind==='pinch')t=`translateY(${pinchY(ms)*22/g.h*100}%)`;
        else{const p=likePress(ms);t=`translateY(${8*p/g.h*100}%) scale(${1-.1*p})`;}
        g.el.style.transform=t;}}
    requestAnimationFrame(moveHands);
  }
  requestAnimationFrame(moveHands);
  let next,pause,welcome;
  if(onboarding){
    document.getElementById('sessionIntro').checked=true;
    welcome=document.createElement('div');welcome.className='tutorial-welcome';
    for(const id of ['songSelect','startButton','enableButton','retrySong'])welcome.append(document.getElementById(id));
    card.append(welcome);
    const heading=document.createElement('h1');heading.className='tutorial-song-title';heading.textContent='Choose your song';card.append(heading);
    document.getElementById('startButton').textContent='Begin tutorial';
  }
  if(!preview){
    next=document.getElementById('introNext');pause=document.getElementById('introPause');card.append(next,pause);
    const skip=document.createElement('button');skip.className='tutorial-skip';if(onboarding)skip.hidden=true;skip.textContent='Skip tutorial';
    skip.onclick=()=>{if(state.phase==='join'){selectedSession='mix';sync();return;}if(intro.active){if(state.phase==='intro')pauseGame();skipIntroAll();sync()}};card.append(skip);
  }else{
    const nav=document.createElement('nav');nav.className='tutorial-preview-nav';
    nav.innerHTML='<label>Preview step <select aria-label="Preview step"></select></label><a href="index.html?flowie=done&lesson=1">Try with camera</a>';
    document.body.append(nav);const select=nav.querySelector('select');
    titles.forEach((t,i)=>select.add(new Option(`${i}. ${t}`,i)));
    select.onchange=()=>{previewPage=+select.value;sync()};
  }
  function text(el,s){if(el.textContent!==s)el.textContent=s;}
  function sync(){
    const joining=!preview&&state.phase==='join'&&selectedSession==='intro';
    const preparing=onboarding&&['setup','ready'].includes(state.phase);
    const active=(preview||preparing||joining||(intro.active&&state.phase==='intro'))&&!window.StemCameraGate?.pending;
    if(welcome)welcome.hidden=!preparing;
    shell.classList.toggle("choosing-song",preparing);
    shell.hidden=!active;document.body.classList.toggle('flowie-tutorial',active);
    if(!active)return;
    const page=preview?previewPage:(preparing||joining)?0:intro.step+1;
    if(shown!==page){shown=page;loaded=-1;paint(page);}
    else if(loaded!==page)paint(page);
    if(preview){value.hidden=true;text(feedback,'Choose a step below. Select Try with camera for live gesture practice.');return;}
    if(preparing){next.hidden=true;pause.hidden=true;value.hidden=true;
      text(feedback,startButton.disabled?menuHint.textContent+' '+songStatus.textContent:(window.StemCameraGate?.skipPractice?'Choose a song, then Start playing.':'Choose a song, then Begin tutorial.'));return;}
    if(joining){next.hidden=true;pause.hidden=true;value.hidden=true;text(feedback,handPrompt.textContent);return;}
    pause.hidden=false;value.hidden=false;
    const key={2:'reverb',3:'delay',4:'filter'}[intro.step];
    const amount=key?fxAmount(key,0):state.volumes[0];
    text(value,[0,2,3,4].includes(intro.step)?`${key?key[0].toUpperCase()+key.slice(1):'Volume'} ${Math.round(amount*100)}%`:intro.done?'Complete ✓':'Thumbs up');
    value.dataset.zone=intro.step===3?'bottom-left':intro.step===4?'top-right':intro.step===5?'bottom-right':'top-left';
    value.hidden=intro.step===6;
    text(feedback,intro.done?'Nice! Release your fingers, then pinch Next — or click it.':document.getElementById('introStatus').textContent);
    if(intro.step===6)text(feedback,'Ready! Click Start remix, or release then pinch over it.');
  }
  // DOM updates only, 10Hz; no second inference, audio engine or canvas animation loop.
  window.StemTutorialRefresh=sync;
  setInterval(()=>{if(!document.hidden)sync()},100);
  sync();
})();
