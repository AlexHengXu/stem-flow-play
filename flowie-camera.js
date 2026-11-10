/* Adapted from flowy-camera-animated-v3.html. Uses the game's sole camera stream. */
(() => {
 if(new URLSearchParams(location.search).get('lesson')!=='1')return;
 window.StemCameraGate={pending:true,skipPractice:false};
 document.body.classList.add('camera-gate-pending');
 const gate=document.createElement('section');gate.id='flowieCameraGate';
 gate.setAttribute('aria-label','Enable camera');
 gate.innerHTML=`<div class="camera-screen"><h1 class="camera-sr">Let's make music.</h1><img class="camera-design" src="camera-welcome.png" alt="Camera, Practice, Play. Turn on your camera to begin."><canvas class="camera-art" width="1672" height="941" aria-hidden="true"></canvas><button class="camera-hotspot camera-enable" aria-label="Enable camera"></button><button class="camera-hotspot camera-skip" aria-label="Already played? Skip practice"></button></div><p class="camera-feedback" role="status"></p>`;
 document.body.append(gate);
 const enable=gate.querySelector('.camera-enable'),skip=gate.querySelector('.camera-skip'),feedback=gate.querySelector('.camera-feedback');
 let busy=false;
 async function proceed(skipPractice){
   if(busy)return;busy=true;enable.disabled=skip.disabled=true;
   enable.setAttribute('aria-busy','true');feedback.textContent='Waiting for camera permission and loading hand tracking…';
   try{
     await enableCameraAndAudio();
     if(!state.cameraReady||!state.modelReady){feedback.textContent=menuHint.textContent;return;}
     window.StemCameraGate.skipPractice=skipPractice;
     document.getElementById(skipPractice?'sessionMix':'sessionIntro').checked=true;
     selectedSession=skipPractice?'mix':'intro';
     startButton.textContent=skipPractice?'Start playing':'Begin tutorial';
     window.StemCameraGate.pending=false;gate.hidden=true;
     document.body.classList.remove('camera-gate-pending');window.StemTutorialRefresh?.();
     startButton.focus();
   }catch(error){feedback.textContent='Camera setup could not finish. Please try again.';}
   finally{busy=false;enable.disabled=skip.disabled=false;enable.removeAttribute('aria-busy');}
 }
 enable.onclick=()=>proceed(false);skip.onclick=()=>proceed(true);
(async function animateArtwork(){
 // Sharp version: Flowie comes from a 2x, cleanly cut image and the canvas renders at screen resolution
 // (the old canvas was half resolution, which is why the bird looked blurry).
 const design=gate.querySelector('.camera-design');await design.decode();
 const load=src=>new Promise((ok,bad)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=bad;im.src=src;});
 const [bird,headMark,wingMark]=await Promise.all(['camera-bird.png','camera-mark-head.png','camera-mark-wing.png'].map(load));
 const canvas=gate.querySelector('.camera-art'),ctx=canvas.getContext('2d');
 const BX=150,BY=250,BWID=540,BHT=485;
 let K=0;function fit(){const k=Math.min(2.5,Math.max(1,(canvas.getBoundingClientRect().width*(devicePixelRatio||1))/1672));
   if(Math.abs(k-K)>.05){K=k;canvas.width=Math.round(1672*K);canvas.height=Math.round(941*K);ctx.imageSmoothingQuality='high';}}
 // card surface under the character (same idea as before: blend the clean card colour across the area)
 const source=document.createElement('canvas');source.width=1672;source.height=941;const sc=source.getContext('2d');sc.drawImage(design,0,0,1672,941);
 const patch=document.createElement('canvas');patch.width=540;patch.height=485;const pc=patch.getContext('2d'),patchPixels=pc.createImageData(540,485),original=sc.getImageData(0,0,1672,941).data;
 for(let y=0;y<485;y++)for(let x=0;x<540;x++){
  const a=((y+250)*1672+150)*4,b=((y+250)*1672+680)*4,k=(y*540+x)*4,t=x/539;
  for(let c=0;c<3;c++)patchPixels.data[k+c]=original[a+c]*(1-t)+original[b+c]*t;
  patchPixels.data[k+3]=255*Math.max(0,Math.min(1,x/12,(539-x)/12,y/12,(484-y)/12));
 }
 pc.putImageData(patchPixels,0,0);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function mark(img,cx,cy,dy,scale){ctx.save();ctx.translate(cx,cy+dy);ctx.scale(scale,scale);ctx.drawImage(img,BX-cx,BY-cy,BWID,BHT);ctx.restore();}
 let lastFrame=0;
 function frame(now){
  if(gate.hidden)return;
  if(document.hidden||now-lastFrame<33){requestAnimationFrame(frame);return;}lastFrame=now;fit();
  const t=now/1000,bob=reduce?0:Math.sin(t*2*Math.PI/3.6)*7;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(K,0,0,K,0,0);
  ctx.drawImage(patch,0,0,530,485,150,250,530,485); /* stop before the button (x=683) so its edge never moves */
  ctx.fillStyle='rgba(128,184,205,.29)';ctx.beginPath();ctx.ellipse(392,705,180-bob*1.2,23-bob*.15,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(bird,BX,BY+bob,BWID,BHT);
  const pulse=reduce?0:Math.sin(t*2*Math.PI/1.9);
  mark(headMark,219,332,bob*.4-pulse*2,1+pulse*.035);mark(wingMark,536,313,bob*.4+pulse*2,1-pulse*.04);
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
})().catch(()=>{gate.querySelector('.camera-art').hidden=true;});

})();
