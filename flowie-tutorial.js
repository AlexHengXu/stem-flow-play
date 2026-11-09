/* Visual template: il2527, bird-gesture-practice-compatible.html (ae31f1f).
   The game remains the sole owner of camera, gesture recognition and audio. */
(() => {
  const preview=document.body.dataset.tutorialPreview==='true';
  const shell=document.createElement('section');shell.id='flowieTutorial';shell.hidden=true;
  shell.setAttribute('aria-label','Flowie gesture tutorial');
  shell.innerHTML='<div class="tutorial-card-art"><canvas aria-hidden="true"></canvas><div class="tutorial-gestures"></div><output class="tutorial-value" aria-live="polite"></output><p class="tutorial-feedback" role="status"></p></div>';
  document.body.append(shell);
  const card=shell.firstElementChild,canvas=card.querySelector('canvas'),ctx=canvas.getContext('2d');
  canvas.width=1660;canvas.height=948;
  const value=card.querySelector('output'),feedback=card.querySelector('p'),sprites=card.querySelector('.tutorial-gestures');
  const rects=[[[645,616,112,112,'thumb'],[828,616,195,112,'thumb']],[[238,204,150,128,'pinch']],[[303,214,99,108,'thumb']],[[235,214,167,125,'pinch']],[[233,615,166,136,'pinch']],[[1266,215,139,121,'pinch']],[[1238,590,119,133,'thumb']],[[668,605,162,139,'pinch'],[846,591,141,153,'thumb']]];
  const titles=['Show your hand','Vocal volume','Open effects','Try Reverb','Try Delay','Try Filter','Leave effects','Ready to remix'];
  const images=new Map();let shown=-1,loaded=-1,previewPage=0;
  function imageAt(page){
    if(!images.has(page)){const im=new Image();im.src=`tutorial-${page}.png`;images.set(page,im);im.onload=()=>{if(shown===page)paint(page)};im.onerror=()=>{feedback.textContent='Tutorial artwork could not load. Reload to retry.'};}
    return images.get(page);
  }
  // Remove only the white matte connected to the sprite edge. Enclosed white
  // highlights remain intact. Runs on page changes, never in an animation loop.
  function cutout(im,x,y,w,h){
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const cx=c.getContext('2d');cx.drawImage(im,x,y,w,h,0,0,w,h);
    const pixels=cx.getImageData(0,0,w,h),d=pixels.data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let read=0,write=0;
    function visit(i){if(i<0||i>=w*h||seen[i])return;seen[i]=1;const k=i*4;
      if(Math.min(d[k],d[k+1],d[k+2])<210)return;queue[write++]=i;d[k+3]=0;}
    for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}
    for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
    while(read<write){const i=queue[read++];if(i%w)visit(i-1);if(i%w<w-1)visit(i+1);visit(i-w);visit(i+w)}
    cx.putImageData(pixels,0,0);return c;
  }
  function paint(page){
    const im=imageAt(page);if(!im.complete||!im.naturalWidth)return;
    loaded=page;ctx.drawImage(im,0,0,1660,948);
    const bird=cutout(im,580,230,500,390);
    // Replace the prototype's painted button with the actual gated game control.
    ctx.fillStyle='#fff';ctx.fillRect(1405,840,255,65);ctx.fillRect(1380,910,280,38);
    sprites.replaceChildren();
    for(const [x,y,w,h,kind] of rects[page]){
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(cutout(im,x,y,w,h),0,0);
      c.className=`tutorial-gesture ${kind}`;
      Object.assign(c.style,{left:`${x/16.6}%`,top:`${y/9.48}%`,width:`${w/16.6}%`,height:`${h/9.48}%`});
      ctx.fillRect(x,y,w,h);sprites.append(c);
    }
    ctx.fillRect(580,230,500,390);
    // Match the game's #03050b background; make baked labels readable on dark.
    const art=ctx.getImageData(0,0,1660,948),d=art.data;
    for(let k=0;k<d.length;k+=4){
      const ink=1-(d[k]*.2126+d[k+1]*.7152+d[k+2]*.0722)/255;
      d[k]=3+ink*218;d[k+1]=5+ink*233;d[k+2]=11+ink*235;
    }
    ctx.putImageData(art,0,0);ctx.drawImage(bird,580,230);
    canvas.setAttribute('aria-label',titles[page]);
  }
  let next,pause;
  if(!preview){
    next=document.getElementById('introNext');pause=document.getElementById('introPause');card.append(next,pause);
    const skip=document.createElement('button');skip.className='tutorial-skip';skip.textContent='Skip tutorial';
    skip.onclick=()=>{if(state.phase==='join'){selectedSession='mix';sync();return;}if(intro.active){if(state.phase==='intro')pauseGame();skipIntroAll();sync()}};card.append(skip);
  }else{
    const nav=document.createElement('nav');nav.className='tutorial-preview-nav';
    nav.innerHTML='<label>Preview step <select aria-label="Preview step"></select></label><a href="index.html?flowie=done">Try with camera</a>';
    document.body.append(nav);const select=nav.querySelector('select');
    titles.forEach((t,i)=>select.add(new Option(`${i}. ${t}`,i)));
    select.onchange=()=>{previewPage=+select.value;sync()};
  }
  function text(el,s){if(el.textContent!==s)el.textContent=s;}
  function sync(){
    const joining=!preview&&state.phase==='join'&&selectedSession==='intro';
    const active=preview||joining||(intro.active&&state.phase==='intro');
    shell.hidden=!active;document.body.classList.toggle('flowie-tutorial',active);
    if(!active)return;
    const page=preview?previewPage:joining?0:intro.step+1;
    if(shown!==page){shown=page;loaded=-1;paint(page);}
    else if(loaded!==page)paint(page);
    if(preview){value.hidden=true;text(feedback,'Choose a step below. Select Try with camera for live gesture practice.');return;}
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
  setInterval(()=>{if(!document.hidden)sync()},100);
  sync();
})();
