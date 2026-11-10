
const PAGES=[{"bg": "4eac3ae026f7.jpeg", "bird": {"src": "45093234d612.webp", "x": 691, "y": 107, "w": 582, "h": 607, "wings": [{"px": 242.0, "py": 330.0, "L": 449.22365523024206, "sgn": 1}], "wt": "e747daecaaf6.png"}, "orbs": [], "text": ["Hi! I\u2019m your little music guide\u2014Flowie!", "The God of Music sent me here on a special mission."], "motion": {"bob": 7, "rot": 1.0, "dur": 3.4, "glow": [678, 312, 130]}}, {"bg": "95fc08ffe570.jpeg", "bird": {"src": "4e3b3df9eab7.webp", "x": 195, "y": 156, "w": 686, "h": 502, "wings": [{"px": 425.0, "py": 300.0, "L": 436.9886648255842, "sgn": -1}, {"px": 335.0, "py": 242.0, "L": 463.4453919928755, "sgn": 1}], "wt": "50d2b6294ee3.png"}, "orbs": [{"src": "44f277406fca.webp", "x": 667, "y": 22, "w": 222, "h": 224}, {"src": "550dad696267.webp", "x": 881, "y": 167, "w": 308, "h": 311}, {"src": "1eb6628a2090.webp", "x": 1153, "y": 426, "w": 254, "h": 257}], "text": ["There are so many sounds tucked inside a song\u2014voices,", "drums, bass, and more.", "My mission is to collect these musical elements!"], "motion": {"bob": 11, "rot": 1.6, "dur": 2.5, "glow": null}}, {"bg": "64ea89a232f4.jpeg", "bird": {"src": "2acbbfaa0ceb.webp", "x": 44, "y": -33, "w": 663, "h": 696, "wings": [{"px": 428.0, "py": 422.0, "L": 522.5349728258046, "sgn": -1}, {"px": 337.0, "py": 426.0, "L": 538.2549548173104, "sgn": 1}], "wt": "f3d704c1ca39.png"}, "orbs": [{"src": "ae41a15860ce.webp", "x": 798, "y": 164, "w": 287, "h": 290}, {"src": "0532530e92a6.webp", "x": 1121, "y": 100, "w": 193, "h": 195}, {"src": "ec5627b38485.webp", "x": 1094, "y": 338, "w": 234, "h": 236}], "text": ["Then comes my favorite part: mixing!", "Add a splash of effects and make the song your own."], "motion": {"bob": 6, "rot": 1.4, "dur": 1.9, "glow": null}}, {"bg": "ac42962dded8.jpeg", "bird": {"src": "2669d8090b35.webp", "x": 201, "y": 42, "w": 639, "h": 635, "wings": [{"px": 353.0, "py": 362.0, "L": 433.96573455060786, "sgn": -1}], "wt": "ad7bad28f08f.png"}, "orbs": [{"src": "7e7ea56314f7.webp", "x": 1047, "y": 339, "w": 160, "h": 162}, {"src": "337bcf44a4ed.webp", "x": 1294, "y": 251, "w": 119, "h": 121}], "text": ["But every little bird needs a partner.", "Will you be my partner on this musical mission?", "Let\u2019s begin!"], "motion": {"bob": 7, "rot": 0.9, "dur": 3.2, "glow": [1173, 206, 170]}}];
const $=s=>document.querySelector(s);
const scene=$('#scene'),pagesEl=$('#pages'),textEl=$('#text'),nextEl=$('#next'),startBtn=$('#start'),dialog=$('#dialog');
const EASE='cubic-bezier(.22,.8,.24,1)',POP='cubic-bezier(.34,1.38,.52,1)';
let cur=-1,busy=false,ended=false;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* fit the 1536x1024 card into any window */
function fit(){const s=Math.min(innerWidth*0.94/1536,innerHeight*0.94/1024);scene.style.transform=`translate(-50%,-50%) scale(${s})`}
addEventListener('resize',fit);fit();

/* build pages */
const built=PAGES.map((p,k)=>{
  const page=document.createElement('div');page.className='page';
  const cam=document.createElement('div');cam.className='cam';page.appendChild(cam);
  const bg=new Image();bg.src=p.bg;bg.className='bg';cam.appendChild(bg);
  let glow=null;
  if(p.motion.glow){const[x,y,r]=p.motion.glow;glow=document.createElement('div');glow.className='glow';Object.assign(glow.style,{left:x-r+'px',top:y-r+'px',width:2*r+'px',height:2*r+'px'});cam.appendChild(glow)}
  const mk=(o,cls)=>{const L=document.createElement('div');L.className='layer '+cls;Object.assign(L.style,{left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px'});
    const f=document.createElement('div');f.className='float';const im=new Image();im.src=o.src;f.appendChild(im);L.appendChild(f);cam.appendChild(L);return{L,f,o}};
  const orbs=p.orbs.map(o=>mk(o,'orb'));
  const bird=mk(p.bird,'bird');
  {const src=bird.f.querySelector('img');src.style.display='none';const cv=document.createElement('canvas');cv.width=p.bird.w;cv.height=p.bird.h;Object.assign(cv.style,{position:'absolute',left:0,top:0,width:'100%',height:'100%'});bird.f.style.position='relative';bird.f.appendChild(cv);
   const wt=new Image();wt.src=p.bird.wt;if(p.bird.ov){const ov=new Image();ov.src=p.bird.ov;bird.ov=ov}bird.pageIndex=k;bird.src=src;bird.wt=wt;bird.cv=cv;bird.ctx=cv.getContext('2d');bird.mesh=null;bird.stamp=-1;bird.landT=Infinity;bird.body=src}
  bird.f.style.transformOrigin='50% 92%';
  pagesEl.appendChild(page);
  return{page,cam,bg,glow,orbs,bird,p};
});

/* wing poses: s in [-1,1], 0 = the original drawing */
const bump=(c,a,d,n)=>{const u=(c-a)/d;return u<0||u>1?0:Math.sin(u*Math.PI*2*n)*Math.sin(u*Math.PI)};
/* wing drive per page, -1..1 (same smooth bend-and-follow-through method as the gesture tutorial) */
const sm3=x=>x*x*(3-2*x);
const WING=[
  ms=>Math.sin(ms/2400*Math.PI*2),                                  /* page 1: slow wave toward the God of Music */
  ms=>Math.sin(ms/1300*Math.PI*2),                                  /* page 2: gentle wingbeats */
  ms=>{const p=((ms%2600)+2600)%2600;let d=0;if(p<300)d=sm3(p/300);else if(p<620)d=1-sm3((p-300)/320);else if(p<920)d=sm3((p-620)/300);else if(p<1240)d=1-sm3((p-920)/320);return -d},  /* page 3: two baton strokes, each dipping down and rising back to the drawn pose, then rest */
  ms=>{const p=((ms%3600)+3600)%3600;return p<2000?Math.sin(p/1000*Math.PI*2)*Math.sin(p/2000*Math.PI):0}];  /* page 4: beckons twice, then rests */
const AMP=[.10,.07,.075,.10];
// Remove only the connected pale matte in the sky gap between scene-2 head and left wing.
// Dark contour strokes form the boundary; enclosed feather colors are never flood-filled.
function clearScene2SkyGap(canvas){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,image=ctx.getImageData(0,0,w,h),data=image.data;
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);let start=0,end=0;
 function visit(x,y){
  if(x<220||x>343||y<135||y>264)return;const k=y*w+x;if(visited[k])return;
  const q=k*4,lo=Math.min(data[q],data[q+1],data[q+2]),hi=Math.max(data[q],data[q+1],data[q+2]);
  if(data[q+3]&&!(lo>185&&hi-lo<75))return;
  visited[k]=1;queue[end++]=k;
 }
 visit(245,180);
 while(start<end){const k=queue[start++],x=k%w,y=Math.floor(k/w);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
 for(let k=0;k<visited.length;k++)if(visited[k])data[k*4+3]=0;
 ctx.putImageData(image,0,0);
}
// Trim only the pale fringe above the original upper wing ink, never interior feather paint.
function trimOuterWingMatte(canvas){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,image=ctx.getImageData(0,0,w,h),p=image.data;
 const edge=[[180,108],[190,113],[200,120],[210,131],[220,144],[230,160],[240,178],[250,196],[260,212],[270,223],[280,231],[290,237],[300,242],[310,246],[320,249],[330,252],[340,254],[349,256]];
 for(let x=180;x<=349;x++){
  let j=0;while(j<edge.length-2&&x>edge[j+1][0])j++;
  const a=edge[j],b=edge[j+1],guess=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);let boundary=guess;
  for(let y=Math.max(0,Math.floor(guess-6));y<=Math.ceil(guess+7);y++){const q=(y*w+x)*4;if(p[q+3]>100&&p[q]<80&&p[q+1]<80&&p[q+2]<155){boundary=y;break;}}
  for(let y=Math.max(0,Math.floor(boundary-10));y<boundary;y++){const q=(y*w+x)*4,lo=Math.min(p[q],p[q+1],p[q+2]),hi=Math.max(p[q],p[q+1],p[q+2]);if(lo>185&&hi-lo<75)p[q+3]=0;}
 }
 ctx.putImageData(image,0,0);
}
// Normalize the existing tail outline to one stroke width, without inventing new curves.
function evenTailInk(canvas){
 const ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,canvas.width,canvas.height),p=image.data,original=new Uint8ClampedArray(p),W=canvas.width;
 const left=100,top=298,w=190,h=110,ink=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=((y+top)*W+x+left)*4;ink[y*w+x]=original[q+3]>100&&original[q]<90&&original[q+1]<90&&original[q+2]<150?1:0;}
 const thin=new Uint8Array(ink);
 for(let pass=0;pass<80;pass++){
  let changed=false;
  for(let step=0;step<2;step++){
   const remove=[];
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const k=y*w+x;if(!thin[k])continue;const n=[thin[k-w],thin[k-w+1],thin[k+1],thin[k+w+1],thin[k+w],thin[k+w-1],thin[k-1],thin[k-w-1]];
    const count=n.reduce((a,b)=>a+b,0);if(count<2||count>6)continue;let transitions=0;for(let j=0;j<8;j++)if(!n[j]&&n[(j+1)%8])transitions++;
    if(transitions!==1)continue;
    if(step===0?(n[0]*n[2]*n[4]||n[2]*n[4]*n[6]):(n[0]*n[2]*n[6]||n[0]*n[4]*n[6]))continue;
    remove.push(k);
   }
   for(const k of remove)thin[k]=0;if(remove.length)changed=true;
  }
  if(!changed)break;
 }
 // Replace only excess old ink with the closest original feather fill.
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(ink[y*w+x]){
  const q=((y+top)*W+x+left)*4;let found=false;
  for(let r=1;r<=7&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h||ink[ny*w+nx])continue;
   const n=((ny+top)*W+nx+left)*4;if(original[n+3]<200)continue;
   p[q]=original[n];p[q+1]=original[n+1];p[q+2]=original[n+2];found=true;break;
  }
 }
 // A constant 4.4 px diameter gives every feather the same black outline.
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(thin[y*w+x])for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
  const distance=Math.hypot(dx,dy),a=Math.max(0,Math.min(1,2.7-distance));if(!a)continue;
  const q=((y+dy+top)*W+x+dx+left)*4;if(original[q+3]<60)continue;
  p[q]=p[q]*(1-a)+15*a;p[q+1]=p[q+1]*(1-a)+12*a;p[q+2]=p[q+2]*(1-a)+31*a;
 }
 ctx.putImageData(image,0,0);
}
function prepMesh(bd){if(bd.mesh)return bd.mesh;const w=bd.cv.width,h=bd.cv.height,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
  x.drawImage(bd.src,0,0,w,h);
  if(bd.pageIndex===1)clearScene2SkyGap(c);
  // Repair the clipped uppermost feather in scene 2 before deformation.
  if(bd.pageIndex===1){
    x.save();const fill=x.createLinearGradient(545,210,578,166);fill.addColorStop(0,'#bcf6ed');fill.addColorStop(1,'#ffff83');
    x.fillStyle=fill;x.beginPath();x.moveTo(545,190);x.lineTo(563,175);x.quadraticCurveTo(580,163,580,168);x.quadraticCurveTo(580,178,558,196);x.lineTo(538,211);x.closePath();x.fill();
    x.beginPath();x.moveTo(548,187);x.quadraticCurveTo(580,162,580,168);x.quadraticCurveTo(581,178,558,196);x.quadraticCurveTo(553,200,548,203);
    x.lineCap='round';x.lineJoin='round';x.strokeStyle='#160d48';x.lineWidth=4.6;x.stroke();x.restore();
  }
  // Scene 2 left wing is a real independent sprite; rear tail stays in the fixed body.
  if(bd.pageIndex===1){
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;const mc=mask.getContext('2d');
    const wingPath=new Path2D();wingPath.moveTo(349,254);wingPath.lineTo(267,218);
    wingPath.bezierCurveTo(232,146,196,93,160,102);wingPath.bezierCurveTo(137,107,139,133,157,154);
    wingPath.bezierCurveTo(112,126,86,143,103,174);wingPath.quadraticCurveTo(112,188,133,201);
    wingPath.bezierCurveTo(81,180,67,202,83,228);wingPath.quadraticCurveTo(103,253,151,259);
    wingPath.bezierCurveTo(110,253,111,278,135,285);wingPath.quadraticCurveTo(161,296,192,283);
    wingPath.bezierCurveTo(164,302,181,319,207,309);wingPath.quadraticCurveTo(229,301,244,285);
    wingPath.bezierCurveTo(220,306,239,320,263,305);wingPath.quadraticCurveTo(296,284,320,278);wingPath.lineTo(349,275);wingPath.closePath();
    mc.fillStyle='white';mc.fill(wingPath);
    // Keep the lowest head feather and its full antialiased ink edge on the stationary body.
    mc.save();mc.globalCompositeOperation='destination-out';mc.beginPath();mc.moveTo(250,130);mc.lineTo(430,130);mc.lineTo(430,280);mc.lineTo(350,260);mc.quadraticCurveTo(338,255,328,247);mc.quadraticCurveTo(316,246,313,232);mc.quadraticCurveTo(308,228,300,224);mc.quadraticCurveTo(286,228,280,216);mc.lineTo(250,190);mc.closePath();mc.fill();mc.restore();
    const wing=document.createElement('canvas');wing.width=w;wing.height=h;const wc=wing.getContext('2d');wc.drawImage(bd.src,0,0,w,h);wc.globalCompositeOperation='destination-in';wc.drawImage(mask,0,0);wc.globalCompositeOperation='source-over';
    // Ink follows the exposed lower feather edge on the moving sprite itself.
    wc.save();wc.beginPath();wc.moveTo(151,259);wc.bezierCurveTo(110,253,111,278,135,285);wc.quadraticCurveTo(161,296,192,283);wc.bezierCurveTo(164,302,181,319,207,309);wc.quadraticCurveTo(229,301,244,285);wc.bezierCurveTo(220,306,239,320,263,305);wc.quadraticCurveTo(296,284,320,278);wc.strokeStyle='#1a1146';wc.lineWidth=3.8;wc.lineCap='round';wc.lineJoin='round';wc.stroke();wc.restore();
    // The original textured wing root overlaps beneath the fixed torso; no flat-color plug.
    x.save();x.globalCompositeOperation='destination-out';x.drawImage(mask,0,0);x.restore();
    // Clear the entire old wing footprint, including its pale matte outside the moving silhouette.
    x.save();x.globalCompositeOperation='destination-out';x.beginPath();[[0,0],[235,0],[235,170],[285,236],[332,260],[318,300],[280,325],[170,325],[170,305],[0,305]].forEach((p,j)=>j?x.lineTo(...p):x.moveTo(...p));x.closePath();x.fill();x.restore();
    x.save();x.globalCompositeOperation='destination-out';x.beginPath();x.moveTo(173,283);x.lineTo(309,277);x.lineTo(300,334);x.lineTo(170,333);x.closePath();x.fill();x.restore();
    // Restore the entire original torso silhouette, including the upper shoulder notch.
    x.save();x.beginPath();x.moveTo(335,253);x.bezierCurveTo(321,263,315,281,298,295);x.quadraticCurveTo(281,314,269,330);x.bezierCurveTo(255,345,278,357,307,359);x.bezierCurveTo(350,367,402,344,420,318);x.quadraticCurveTo(432,291,426,260);x.closePath();x.clip();x.drawImage(bd.src,0,0,w,h);x.restore();
    // Restore every original lime torso pixel and its ink edge, independent of the cut polygon.
    const originalCanvas=document.createElement('canvas');originalCanvas.width=w;originalCanvas.height=h;const oc=originalCanvas.getContext('2d');oc.drawImage(bd.src,0,0,w,h);const original=oc.getImageData(0,0,w,h),current=x.getImageData(0,0,w,h),bodyMask=new Uint8Array(w*h);
    for(let py=248;py<372;py++)for(let px=260;px<445;px++){const k=(py*w+px)*4;if(original.data[k]>130&&original.data[k+1]>145&&original.data[k+2]<150){for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)if(dx*dx+dy*dy<=16)bodyMask[(py+dy)*w+px+dx]=1;}}
    for(let k=0;k<bodyMask.length;k++)if(bodyMask[k])for(let ch=0;ch<4;ch++)current.data[k*4+ch]=original.data[k*4+ch];x.putImageData(current,0,0);
    // Slightly broaden the torso, tapering back to its original attachment at neck and legs.
    const torsoCanvas=document.createElement('canvas');torsoCanvas.width=w;torsoCanvas.height=h;const torsoCtx=torsoCanvas.getContext('2d');
    torsoCtx.save();torsoCtx.beginPath();torsoCtx.moveTo(335,253);torsoCtx.bezierCurveTo(321,263,315,281,298,295);torsoCtx.quadraticCurveTo(281,314,269,330);torsoCtx.bezierCurveTo(255,345,278,357,307,359);torsoCtx.bezierCurveTo(350,367,402,344,420,318);torsoCtx.quadraticCurveTo(432,291,426,260);torsoCtx.closePath();torsoCtx.clip();torsoCtx.drawImage(bd.src,0,0,w,h);torsoCtx.restore();
    for(let row=254;row<369;row++){
      const t=(row-254)/115,scale=1+.12*Math.sin(t*Math.PI)**2;
      x.drawImage(torsoCanvas,250,row,195,1,350+(250-350)*scale,row,195*scale,1);
    }
    const fixed=document.createElement('canvas');fixed.width=w;fixed.height=h;const tc=fixed.getContext('2d');
    const tail=new Path2D();tail.moveTo(282,322);tail.bezierCurveTo(231,328,189,309,137,307);tail.bezierCurveTo(105,304,107,338,133,345);tail.bezierCurveTo(108,350,117,383,146,380);tail.bezierCurveTo(135,396,162,404,187,391);tail.bezierCurveTo(233,377,271,354,286,335);tail.closePath();
    tc.save();tc.clip(tail);tc.drawImage(bd.src,0,0,w,h);tc.restore();
    evenTailInk(fixed);
    // Match the uppermost tail feather's upper rim to the other 4.4 px tail outlines.
    tc.save();tc.beginPath();tc.moveTo(132,312);
    tc.bezierCurveTo(142,302,159,307,174,311.5);
    tc.bezierCurveTo(193,316,207,316.5,221,318.5);
    tc.bezierCurveTo(239,321,253,323,267,323);
    tc.strokeStyle='#0f0c1f';tc.lineWidth=4.4;tc.lineCap='round';tc.lineJoin='round';tc.stroke();tc.restore();
    bd.fixedTail=fixed;
    trimOuterWingMatte(wing);
    bd.leftWing=wing;
  }
  if(bd.pageIndex===2){
    const tail=new Path2D();
    if(bd.pageIndex===1){
      tail.moveTo(270,323);tail.bezierCurveTo(222,327,174,302,136,309);tail.bezierCurveTo(107,311,111,335,139,341);tail.quadraticCurveTo(153,344,169,342);
      tail.bezierCurveTo(139,345,118,349,124,366);tail.bezierCurveTo(128,383,151,378,175,373);
      tail.bezierCurveTo(143,384,157,394,177,389);tail.bezierCurveTo(218,380,259,353,280,335);tail.closePath();
    }else{
      tail.moveTo(299,478);tail.bezierCurveTo(266,483,232,475,205,489);tail.bezierCurveTo(177,502,188,522,214,520);
      tail.bezierCurveTo(181,527,176,548,198,556);tail.quadraticCurveTo(215,561,240,548);
      tail.bezierCurveTo(213,563,219,580,240,575);tail.bezierCurveTo(274,568,304,540,320,514);tail.closePath();
    }
    const tailMask=document.createElement('canvas');tailMask.width=w;tailMask.height=h;const tm=tailMask.getContext('2d');tm.fillStyle='white';tm.fill(tail);
    // Include the tail's complete ink outline and antialiased edge in the fixed layer.
    if(bd.pageIndex===1){tm.strokeStyle='white';tm.lineWidth=10;tm.lineJoin='round';tm.lineCap='round';tm.stroke(tail);}
    const foreground=document.createElement('canvas');foreground.width=w;foreground.height=h;const fc=foreground.getContext('2d');fc.drawImage(c,0,0);fc.globalCompositeOperation='destination-in';fc.drawImage(tailMask,0,0);fc.globalCompositeOperation='source-over';
    // Extract and erase with exactly the same expanded mask: no tail ink can remain on the wing.
    x.save();x.globalCompositeOperation='destination-out';x.drawImage(tailMask,0,0);x.restore();bd.fixedTail=foreground;
  }

  if(bd.pageIndex===1)clearScene2SkyGap(c);
  const source=x.getImageData(0,0,w,h).data;x.clearRect(0,0,w,h);x.drawImage(bd.wt,0,0,w,h);const wd=x.getImageData(0,0,w,h).data;
  // Smooth supplied weight-map boundaries numerically, independent of browser filters.
  const weights=new Float32Array(w*h*2),radius=10,span=radius*2+1;
  for(let side=0;side<2;side++){
    let field=new Float32Array(w*h);for(let k=0;k<field.length;k++)field[k]=wd[k*4+side]/255;
    for(let pass=0;pass<3;pass++){
      const tmp=new Float32Array(w*h),next=new Float32Array(w*h);
      for(let y=0;y<h;y++){let sum=0;for(let x=-radius;x<=radius;x++)sum+=field[y*w+Math.max(0,Math.min(w-1,x))];for(let x=0;x<w;x++){tmp[y*w+x]=sum/span;sum+=field[y*w+Math.min(w-1,x+radius+1)]-field[y*w+Math.max(0,x-radius)];}}
      for(let x=0;x<w;x++){let sum=0;for(let y=-radius;y<=radius;y++)sum+=tmp[Math.max(0,Math.min(h-1,y))*w+x];for(let y=0;y<h;y++){next[y*w+x]=sum/span;sum+=tmp[Math.min(h-1,y+radius+1)*w+x]-tmp[Math.max(0,y-radius)*w+x];}}
      field=next;
    }
    for(let k=0;k<field.length;k++)weights[k*2+side]=field[k];
  }
  // Scene 2 uses the same intact-image deformation as the tutorial.
  // Tail ink and edge pixels remain in the original source, with zero displacement.
  if(bd.pageIndex===1){
    const polygon=[[278,326],[221,320],[175,309],[118,306],[105,333],[116,368],[158,392],[195,403],[246,381],[280,353]];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let inside=false,distance=Infinity;
      for(let j=0,l=polygon.length-1;j<polygon.length;l=j++){
        const a=polygon[j],b=polygon[l],dx=b[0]-a[0],dy=b[1]-a[1];
        if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
        distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
      }
      const t=inside?0:Math.max(0,Math.min(1,(distance-6)/26));
      const free=t*t*(3-2*t),k=(y*w+x)*2;weights[k]*=free;weights[k+1]*=free;
    }
  }
  // Scene 3: the whole right feather fan uses one rigid rotation, including its colors and outline.
  if(bd.pageIndex===2){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const tx=Math.max(0,Math.min(1,(x-403)/35)),ty=Math.max(0,Math.min(1,(y-248)/35));
      weights[(y*w+x)*2]=tx*tx*(3-2*tx)*ty*ty*(3-2*ty);
    }
  }
  if(bd.pageIndex===2){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const k=(y*w+x)*2,t=Math.max(0,Math.min(1,(337-x)/80));weights[k+1]=Math.max(weights[k+1],t*t*(3-2*t));
    }
  }
  // Tutorial-style fixed anatomy: displace one intact source image, with smooth zero-motion regions.
  if(bd.pageIndex===2){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const k=(y*w+x)*2;
      // Wand and halo follow exactly the same rotation as the wing, never a radial bend.
      const wandSide=Math.max(0,Math.min(1,(x-418)/32));
      weights[k]=Math.max(weights[k],wandSide*wandSide*(3-2*wandSide));
      const torsoDistance=Math.hypot((x-350)/82,(y-467)/112);
      const a=Math.max(0,Math.min(1,(torsoDistance-1)/.45)),torsoFree=a*a*(3-2*a);
      const footDistance=Math.hypot((x-405)/48,(y-535)/34);
      const b=Math.max(0,Math.min(1,(footDistance-1)/.7)),footFree=b*b*(3-2*b);
      const c=Math.max(0,Math.min(1,(565-y)/48)),legFree=c*c*(3-2*c);
      weights[k]*=torsoFree*footFree*legFree;weights[k+1]*=torsoFree*footFree*legFree;
    }
  }
  // Scene 3: keep the complete cheek contour outside both wing influences.
  if(bd.pageIndex===2){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const distance=Math.hypot((x-333)/104,(y-300)/86);
      const t=Math.max(0,Math.min(1,(distance-1)/.28)),free=t*t*(3-2*t),k=(y*w+x)*2;
      weights[k]*=free;weights[k+1]*=free;
    }
  }
  if(bd.pageIndex===1){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const d=Math.hypot((x-270)/87,(y-409)/41),t=Math.max(0,Math.min(1,(d-1)/.6)),free=t*t*(3-2*t),k=(y*w+x)*2;
      weights[k]*=free;weights[k+1]*=free;
    }
  }
  if(bd.pageIndex===1)for(let k=0;k<w*h;k++)weights[k*2+1]=0;
  // Let the lowest left flight feather follow the wing above the fixed foreground tail.
  if(bd.pageIndex===2)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const a=Math.max(0,Math.min(1,(304-x)/50)),b=Math.max(0,Math.min(1,(485-y)/22)),c=Math.max(0,Math.min(1,(y-400)/25));
    const flight=a*a*(3-2*a)*b*b*(3-2*b)*c*c*(3-2*c),k=(y*w+x)*2;weights[k+1]=Math.max(weights[k+1],flight);
  }
  // Scene 3 uses a single smooth, bounded deformation field for both feather ink and fill.
  if(bd.pageIndex===2){
    const head=[[207,159],[233,157],[257,192],[271,170],[292,190],[316,211],[361,219],[395,244],[413,263],[427,286],[430,317],[418,350],[394,373],[331,380],[278,376],[250,359],[239,337],[219,331],[226,310],[210,316],[215,290],[192,286],[202,269],[179,259],[170,235],[187,219]];
    const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let inside=false,distance=Infinity;
      for(let j=0,l=head.length-1;j<head.length;l=j++){
        const a=head[j],b=head[l],dx=b[0]-a[0],dy=b[1]-a[1];
        if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
        const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
        distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
      }
      const torso=ease((Math.hypot((x-350)/78,(y-465)/108)-1)/.55);
      const feet=ease((Math.hypot((x-405)/48,(y-535)/34)-1)/.7)*ease((565-y)/48);
      const k=(y*w+x)*2;
      weights[k]=ease((x-409)/28)*(inside?0:ease(distance/12))*torso*feet;
      weights[k+1]=ease((330-x)/95)*(inside?0:ease(distance/38))*torso*feet;
    }
  }
  // The three orange emphasis marks are fixed artwork, not part of either wing.
  if(bd.pageIndex===2)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const d=Math.hypot((x-382)/62,(y-172)/55),t=Math.max(0,Math.min(1,(d-1)/.3)),free=t*t*(3-2*t),k=(y*w+x)*2;weights[k]*=free;weights[k+1]*=free;
  }
  bd.mesh={source,weights,out:bd.ctx.createImageData(w,h)};return bd.mesh}
// Preserve the supplied poses and anatomy masks, but move per-pixel deformation
// to the GPU. Only the visible scene draws, at 24 fps; hidden tabs stop drawing.
function gpuBird(bd){
 if(bd.gpu!==undefined)return bd.gpu;
 const m=prepMesh(bd),w=bd.cv.width,h=bd.cv.height;
 const surface=document.createElement('canvas');surface.width=w;surface.height=h;
 const gl=surface.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});
 if(!gl)return bd.gpu=null;
 function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision highp float;
 uniform sampler2D art;uniform sampler2D weights;uniform vec2 size;uniform vec4 wing0;uniform vec4 wing1;uniform float scene;
 vec2 delta(vec2 p,vec4 t){vec2 u=p-t.zw;return vec2(t.x*u.x-t.y*u.y,t.y*u.x+t.x*u.y);}
 void main(){vec2 p=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y)-.5;vec2 s=p;
 for(int i=0;i<24;i++){
 if(scene!=2.&&i>=5)break;if(scene==2.&&p.x>=335.&&i>=10)break;
 vec2 q=clamp(s,vec2(0.),size-vec2(1.001));vec2 wt=texture2D(weights,(q+.5)/size).rg;
 vec2 target=p-delta(s,wing0)*wt.r-delta(s,wing1)*wt.g;
 float relax=scene==2.?(p.x<335.?.5:.65):1.;s=mix(s,target,relax);
 }
 if(any(lessThan(s,vec2(0.)))||any(greaterThanEqual(s,size-1.))){gl_FragColor=vec4(0.);return;}
 gl_FragColor=texture2D(art,(s+.5)/size);
 }`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const attr=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 const art=new Uint8Array(m.source.length),weights=new Uint8Array(m.source.length);
 for(let i=0;i<w*h;i++){const k=i*4,a=m.source[k+3]/255;for(let c=0;c<3;c++)art[k+c]=Math.round(m.source[k+c]*a);art[k+3]=m.source[k+3];weights[k]=Math.round(m.weights[i*2]*255);weights[k+1]=Math.round(m.weights[i*2+1]*255);weights[k+3]=255;}
 for(const [unit,name,data] of [[0,'art',art],[1,'weights',weights]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.uniform1i(gl.getUniformLocation(program,name),unit);}
 gl.uniform2f(gl.getUniformLocation(program,'size'),w,h);gl.uniform1f(gl.getUniformLocation(program,'scene'),bd.pageIndex);
 gl.viewport(0,0,w,h);
 return bd.gpu={gl,surface,uniforms:['wing0','wing1'].map(n=>gl.getUniformLocation(program,n))};
}
function drawBird(bd,ms,page){
 if(!bd.src.complete||!bd.wt.complete)return;
 const w=bd.cv.width,h=bd.cv.height;
 if(reduce||ms<0){bd.ctx.clearRect(0,0,w,h);bd.ctx.drawImage(bd.src,0,0,w,h);return;}
 let gpu;try{gpu=gpuBird(bd)}catch(e){console.warn('Flowie wing animation unavailable:',e);bd.gpu=null;gpu=null;}
 if(!gpu){bd.ctx.clearRect(0,0,w,h);bd.ctx.drawImage(bd.src,0,0,w,h);return;}
 const {gl,surface,uniforms}=gpu;if(gl.isContextLost()){bd.gpu=null;return;}
 const wings=PAGES[page].bird.wings;
 for(let side=0;side<2;side++){const g=wings[side];const angle=g?WING[page](ms)*(page===2?(side===1?0:.055):AMP[page])*g.sgn:0;gl.uniform4f(uniforms[side],Math.cos(angle)-1,Math.sin(angle),g?.px||0,g?.py||0);}
 gl.drawArrays(gl.TRIANGLE_STRIP,0,4);bd.ctx.clearRect(0,0,w,h);bd.ctx.drawImage(surface,0,0);
 if(bd.leftWing){bd.ctx.save();bd.ctx.globalCompositeOperation='destination-over';bd.ctx.translate(335,242);bd.ctx.rotate(WING[page](ms)*.075);bd.ctx.drawImage(bd.leftWing,-335,-242);bd.ctx.restore();}
 if(bd.fixedTail)bd.ctx.drawImage(bd.fixedTail,0,0);
 if(bd.ov?.complete)bd.ctx.drawImage(bd.ov,0,0,w,h);
}
let lastWingFrame=0;
(function wingLoop(now){requestAnimationFrame(wingLoop);if(document.hidden||ended||reduce||now-lastWingFrame<1000/24)return;lastWingFrame=now;
 const b=built[cur];if(b&&now>=b.bird.landT)drawBird(b.bird,now-b.bird.landT,cur);
})(0);

/* idle life: each layer breathes on its own rhythm (started after the entrance) */
const idle=[];
function startIdle(b){
  if(reduce)return;
  const m=b.p.motion;
  idle.push(b.bird.f.animate([{transform:'translateY(0) rotate(0deg)'},{transform:`translateY(${-m.bob}px) rotate(${-m.rot}deg)`}],{duration:m.dur*1000,iterations:Infinity,direction:'alternate',easing:'cubic-bezier(.45,0,.55,1)'}));
  b.orbs.forEach((o,i)=>{const d=3800+i*900,a=5+i%2*2;
    idle.push(o.f.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${i%2?-3:3}px,${-a}px) scale(1.025)`}],{duration:d,iterations:Infinity,direction:'alternate',easing:'cubic-bezier(.45,0,.55,1)',delay:-i*1300}))});
  if(b.glow)idle.push(b.glow.animate([{opacity:.45,transform:'scale(.92)'},{opacity:.95,transform:'scale(1.06)'}],{duration:2600,iterations:Infinity,direction:'alternate',easing:'ease-in-out'}));
  /* slow camera push for the whole picture */
  idle.push(b.cam.animate([{transform:'scale(1)'},{transform:'scale(1.035)'}],{duration:16000,fill:'forwards',easing:'cubic-bezier(.3,0,.4,1)'}));
}
function stopIdle(){idle.splice(0).forEach(a=>a.cancel())}

/* subtle mouse parallax: far layers move less than near ones */
let px=0,py=0,tx=0,ty=0;
addEventListener('pointermove',e=>{tx=(e.clientX/innerWidth-.5);ty=(e.clientY/innerHeight-.5)});
(function loop(){px+=(tx-px)*.05;py+=(ty-py)*.05;
  const b=built[cur];if(b&&!reduce){b.bg.style.translate=`${-px*4}px ${-py*3}px`;b.orbs.forEach(o=>o.L.style.translate=`${px*5}px ${py*4}px`);b.bird.L.style.translate=`${px*8}px ${py*6}px`}
  requestAnimationFrame(loop)})();

/* drifting motes of light */
const ctx=$('#spark').getContext('2d');
const motes=Array.from({length:22},()=>({x:Math.random()*1536,y:Math.random()*740,r:1+Math.random()*2.4,v:.12+Math.random()*.25,ph:Math.random()*6.28,s:.6+Math.random()*1.2}));
(function draw(t){ctx.clearRect(0,0,1536,1024);
  if(!reduce)for(const m of motes){m.y-=m.v;m.x+=Math.sin(t/2400+m.ph)*.15;if(m.y<-10){m.y=760;m.x=Math.random()*1536}
    const a=.25+.55*(.5+.5*Math.sin(t/700*m.s+m.ph));const g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*4);
    g.addColorStop(0,`rgba(255,250,225,${a})`);g.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(m.x,m.y,m.r*4,0,7);ctx.fill()}
  requestAnimationFrame(draw)})(0);

/* typewriter: characters ease in one by one */
let typing=null,chars=[];
function setText(lines){
  textEl.innerHTML='';chars=[];
  lines.forEach(l=>{const ln=document.createElement('span');ln.className='ln';
    for(const c of l){const s=document.createElement('span');s.className=c===' '?'sp':'ch';s.textContent=c===' '?' ':c;ln.appendChild(s);if(c!==' ')chars.push(s)}
    textEl.appendChild(ln)});
}
function type(onDone){
  let i=0;clearInterval(typing);
  typing=setInterval(()=>{if(i<chars.length){chars[i++].classList.add('on')}else{clearInterval(typing);typing=null;onDone()}},24);
}
function finishTyping(){clearInterval(typing);typing=null;chars.forEach(c=>c.classList.add('on'));showNext()}
function showNext(){
  if(cur===built.length-1){startBtn.classList.add('on')}else{nextEl.classList.add('on')}
}

/* page transition */
const dots=[...document.querySelectorAll('#dots i')];
function go(n){
  if(n<0||n>=built.length)return;
  busy=true;nextEl.classList.remove('on');startBtn.classList.remove('on');
  const prev=built[cur],next=built[n];const first=cur<0;
  $('#backdrop').style.backgroundImage=`url(${next.p.bg})`;
  if(prev){
    prev.page.animate([{opacity:1,transform:'scale(1) translateX(0)'},{opacity:0,transform:'scale(1.04) translateX(-22px)'}],{duration:700,easing:EASE,fill:'forwards'});
    textEl.animate([{opacity:1},{opacity:0}],{duration:220,fill:'forwards'});
  }
  setTimeout(()=>{stopIdle();if(prev)prev.page.style.zIndex=0},first?0:700);
  cur=n;dots.forEach((d,i)=>d.classList.toggle('on',i===n));
  const P=next.page;P.style.zIndex=1;
  P.getAnimations().forEach(a=>a.cancel());next.bird.L.getAnimations().forEach(a=>a.cancel());
  P.animate([{opacity:0,transform:'scale(1.06) translateX(26px)'},{opacity:1,transform:'scale(1) translateX(0)'}],{duration:first?1300:1000,easing:EASE,fill:'forwards',delay:first?0:120});
  next.bg.animate([{filter:'blur(7px) brightness(1.08)'},{filter:'blur(0) brightness(1)'}],{duration:1300,easing:EASE,fill:'forwards'});
  const d0=first?420:240,dB=d0+260;
  next.bird.stamp=-1;drawBird(next.bird,-1,n);next.bird.landT=performance.now()+dB+620;
  next.bird.L.animate([{opacity:0,transform:'translateY(-26px)'},{opacity:1,transform:'translateY(-8px)',offset:.35},{opacity:1,transform:'translateY(5px)',offset:.7},{opacity:1,transform:'translateY(0)'}],{duration:900,delay:dB,easing:'cubic-bezier(.3,.7,.3,1)',fill:'backwards'});
  next.orbs.forEach((o,i)=>o.L.animate([{opacity:0,transform:'translateY(22px) scale(.86)'},{opacity:1,offset:.35},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:950,delay:d0-60+i*130,easing:POP,fill:'backwards'}));
  if(next.glow)next.glow.animate([{opacity:0},{opacity:.6}],{duration:900,delay:d0+120,fill:'backwards'});
  setTimeout(()=>startIdle(next),dB+900);
  if(first)dialog.animate([{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'translateY(0)'}],{duration:800,delay:700,easing:POP,fill:'forwards'});
    setTimeout(()=>{textEl.getAnimations().forEach(a=>a.cancel());if(!first)$('#tag').animate([{transform:'scale(.86)'},{transform:'scale(1.06)',offset:.6},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});setText(next.p.text);busy=false;type(showNext)},first?1250:dB+640);
}
function advance(){
  if(ended||busy)return;
  if(typing){finishTyping();return}
  if(cur<built.length-1)go(cur+1);else finish();
}
function finish(){
  if(ended)return;ended=true;startBtn.classList.remove('on');try{stopIdle()}catch(e){}
  const b=built[cur];
  if(b)b.bird.L.animate([{transform:'translateY(0)'},{transform:'translateY(-30px)'},{transform:'translateY(0)'}],{duration:520,easing:'cubic-bezier(.3,0,.3,1)'});
  setTimeout(()=>{$('#veil').animate([{opacity:0},{opacity:1}],{duration:650,easing:'ease-in',fill:'forwards'});setTimeout(handOver,700)},380);
}
// intro done -> into the game (inside the single-file build the page hands over without reloading)
function handOver(){location.replace('index.html?flowie=done&lesson=1')}
function skip(e){e.stopPropagation();if(ended)return;finishTyping();finish()}
function replay(e){e.stopPropagation();ended=false;stopIdle();
  $('#veil').getAnimations().forEach(a=>a.cancel());$('#end').getAnimations().forEach(a=>a.cancel());$('#end').style.pointerEvents='none';
  built.forEach(b=>{b.page.getAnimations().forEach(a=>a.cancel());b.page.style.zIndex=0});
  dialog.getAnimations().forEach(a=>a.cancel());cur=-1;go(0)}
$('#viewport').addEventListener('click',advance);
startBtn.addEventListener('click',e=>{e.stopPropagation();finish()});
$('#skip').addEventListener('click',skip);

addEventListener('keydown',e=>{
  if([' ','Enter','ArrowRight'].includes(e.key)){e.preventDefault();advance()}
  else if(e.key==='ArrowLeft'&&!busy&&!ended&&cur>0){finishTyping();go(cur-1)}
  else if(e.key==='Escape')skip(e);
});
Promise.all(built.flatMap(b=>[b.bg,b.bird.body,b.bird.wt,...b.orbs.map(o=>o.L.querySelector('img'))]).map(i=>i.decode().catch(()=>{}))).then(()=>document.fonts.ready).then(()=>go(0));
