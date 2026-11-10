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
 const design=gate.querySelector('.camera-design');await design.decode();
 const canvas=gate.querySelector('.camera-art'),ctx=canvas.getContext('2d');
 canvas.width=836;canvas.height=471;ctx.setTransform(.5,0,0,.5,0,0);
 const source=document.createElement('canvas');source.width=1672;source.height=941;const sc=source.getContext('2d');sc.drawImage(design,0,0,1672,941);
 const box={x:165,y:260,w:515,h:470};
 const cut=document.createElement('canvas');cut.width=box.w;cut.height=box.h;const cc=cut.getContext('2d');cc.drawImage(source,box.x,box.y,box.w,box.h,0,0,box.w,box.h);
 const pixels=cc.getImageData(0,0,box.w,box.h),data=pixels.data,visited=new Uint8Array(box.w*box.h),queue=new Int32Array(box.w*box.h);let start=0,end=0;
 function visit(k){if(k<0||k>=visited.length||visited[k])return;const q=k*4,lo=Math.min(data[q],data[q+1],data[q+2]),hi=Math.max(data[q],data[q+1],data[q+2]);if(!(lo>190&&hi-lo<65||lo>150&&hi-lo<20))return;visited[k]=1;queue[end++]=k;}
 for(let x=0;x<box.w;x++){visit(x);visit((box.h-1)*box.w+x);}for(let y=0;y<box.h;y++){visit(y*box.w);visit(y*box.w+box.w-1);}
 while(start<end){const k=queue[start++],x=k%box.w;if(x)visit(k-1);if(x<box.w-1)visit(k+1);if(k>=box.w)visit(k-box.w);if(k<(box.h-1)*box.w)visit(k+box.w);}
 for(let k=0;k<visited.length;k++)if(visited[k])data[k*4+3]=0;cc.putImageData(pixels,0,0);
 function take(x,y,w,h,segments){
  const layer=document.createElement('canvas');layer.width=w;layer.height=h;const lc=layer.getContext('2d');lc.drawImage(cut,x-box.x,y-box.y,w,h,0,0,w,h);
  if(segments){
   const mask=document.createElement('canvas');mask.width=box.w;mask.height=box.h;const mc=mask.getContext('2d');mc.strokeStyle='white';mc.lineWidth=18;mc.lineCap='round';
   for(const [ax,ay,bx,by] of segments){mc.beginPath();mc.moveTo(ax-box.x,ay-box.y);mc.lineTo(bx-box.x,by-box.y);mc.stroke();}
   lc.globalCompositeOperation='destination-in';lc.drawImage(mask,x-box.x,y-box.y,w,h,0,0,w,h);lc.globalCompositeOperation='source-over';
   cc.save();cc.globalCompositeOperation='destination-out';cc.drawImage(mask,0,0);cc.restore();
  }else cc.clearRect(x-box.x,y-box.y,w,h);
  return {image:layer,x,y,w,h};
 }
 // Follow the three blue strokes precisely; the adjacent purple crest stays entirely on the bird.
 const head=take(178,280,82,105,[[233,294,249,319],[202,324,230,340],[189,365,220,369]]),wing=take(500,281,72,64);
 const patch=document.createElement('canvas');patch.width=540;patch.height=485;const pc=patch.getContext('2d'),patchPixels=pc.createImageData(540,485),original=sc.getImageData(0,0,1672,941).data;
 for(let y=0;y<485;y++)for(let x=0;x<540;x++){
  const a=((y+250)*1672+150)*4,b=((y+250)*1672+680)*4,k=(y*540+x)*4,t=x/539;
  for(let c=0;c<3;c++)patchPixels.data[k+c]=original[a+c]*(1-t)+original[b+c]*t;
  patchPixels.data[k+3]=255*Math.max(0,Math.min(1,x/12,(539-x)/12,y/12,(484-y)/12));
 }
 pc.putImageData(patchPixels,0,0);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function mark(layer,dy,scale){ctx.save();ctx.translate(layer.x+layer.w/2,layer.y+layer.h/2+dy);ctx.scale(scale,scale);ctx.drawImage(layer.image,-layer.w/2,-layer.h/2);ctx.restore();}
 let lastFrame=0;
 function frame(now){
  if(gate.hidden)return;
  if(document.hidden||now-lastFrame<33){requestAnimationFrame(frame);return;}lastFrame=now;
  const t=now/1000,bob=reduce?0:Math.sin(t*2*Math.PI/3.6)*7;
  ctx.clearRect(0,0,1672,941);
  // Replace only the empty card surface underneath the original character.
  ctx.drawImage(patch,150,250);
  ctx.fillStyle='rgba(128,184,205,.29)';ctx.beginPath();ctx.ellipse(392,705,180,23,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(cut,box.x,box.y+bob);
  const pulse=reduce?0:Math.sin(t*2*Math.PI/1.9);mark(head,bob*.4-pulse*2,1+pulse*.035);mark(wing,bob*.4+pulse*2,1-pulse*.04);
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
})().catch(()=>{gate.querySelector('.camera-art').hidden=true;});

})();
