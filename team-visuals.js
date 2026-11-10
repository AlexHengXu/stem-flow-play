// Stem Flow · FX bank 2 (Chorus, Tremolo, Distortion, Beat Repeat) — the approved v5 studies.
// Coloured by the instrument (same colours as the first interface and Reverb/Delay/Filter),
// drawn on black at full size, then turned into light-only alpha exactly like the first FX bank,
// with a small lift so the light still reads over the half-transparent camera picture.
(()=>{
const PALS={
 vocals:{body:[255,214,60],hi:[255,236,140],deep:[190,140,20],wh:[255,246,210]},
 bass:{body:[63,167,255],hi:[138,210,246],deep:[24,80,190],wh:[210,236,255]},
 drums:{body:[196,206,226],hi:[230,236,250],deep:[96,106,130],wh:[246,248,255]},
 other:{body:[176,140,255],hi:[212,192,255],deep:[92,60,190],wh:[240,232,255]}};
function makeSet(PAL){
// ===== Stem Flow · Tremolo & Distortion v2 (always alive, glow + music dust) =====
const TAU=Math.PI*2;
const rgbaC=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.max(0,Math.min(1,a))})`;
const mixC=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
const WH=[255,255,255];
const glowCache={};
function glowSprite(col){const id=col.join();if(glowCache[id])return glowCache[id];const s=document.createElement('canvas');s.width=s.height=64;
  const g=s.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,rgbaC(mixC(col,WH,.55),1));gr.addColorStop(.3,rgbaC(col,.42));gr.addColorStop(1,rgbaC(col,0));
  g.fillStyle=gr;g.fillRect(0,0,64,64);return glowCache[id]=s;}
function orbG(c,x,y,r,col,al){if(al<=.004||r<=.5)return;c.globalAlpha=Math.min(1,al);c.drawImage(glowSprite(col),x-r,y-r,2*r,2*r);c.globalAlpha=1;}
function noteG(c,x,y,s,col,a,beam,rot){if(a<.01)return;c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=rgbaC(col,a);c.strokeStyle=rgbaC(col,a);c.lineWidth=Math.max(1.2,s*.11);
  const head=(hx,hy)=>{c.beginPath();c.ellipse(hx,hy,s*.27,s*.19,-.45,0,TAU);c.fill();};
  const stem=(sx,sy)=>{c.beginPath();c.moveTo(sx,sy);c.lineTo(sx,sy-s*.95);c.stroke();};
  if(beam){head(-s*.32,s*.42);head(s*.32,s*.3);stem(-s*.08,s*.38);stem(s*.56,s*.26);c.lineWidth=Math.max(1.4,s*.16);c.beginPath();c.moveTo(-s*.08,-s*.57);c.lineTo(s*.56,-s*.69);c.stroke();}
  else{head(0,s*.4);stem(s*.24,s*.36);c.beginPath();c.moveTo(s*.24,-s*.59);c.quadraticCurveTo(s*.62,-s*.35,s*.5,-s*.05);c.stroke();}c.restore();}
function sparkleG(c,x,y,L,col,al){if(al<.01)return;c.lineWidth=1.2;
  [[1,0],[0,1]].forEach(([dx,dy])=>{const gr=c.createLinearGradient(x-dx*L,y-dy*L,x+dx*L,y+dy*L);gr.addColorStop(0,rgbaC(col,0));gr.addColorStop(.5,rgbaC(mixC(col,WH,.75),al));gr.addColorStop(1,rgbaC(col,0));
    c.strokeStyle=gr;c.beginPath();c.moveTo(x-dx*L,y-dy*L);c.lineTo(x+dx*L,y+dy*L);c.stroke();});orbG(c,x,y,L*.7,col,.55*al);}

// --- music dust: notes, star sparkles, glow specks (the shared Stem Flow standard) ---
function makeDust(){return{list:[],acc:0};}
function stepDust(D,dt,rate,spawn){D.acc+=rate*dt;while(D.acc>=1){D.acc-=1;D.list.push(spawn());}
  for(const p of D.list){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}D.list=D.list.filter(p=>p.age<p.life);}
function drawDust(c,D,t,cols,gain,warpX){
  for(const p of D.list){const q=p.age/p.life,fade=Math.min(1,q*4)*Math.pow(1-q,1.2),tw=.62+.38*Math.sin(t*2.2+p.tw);
    const al=Math.min(1,fade*tw*gain),col=cols[p.ci%cols.length],x=p.x+(warpX?warpX(p.x,p.y):0),y=p.y;
    if(p.type==='note'){orbG(c,x,y,p.s*1.7,col,.45*al);noteG(c,x,y,p.s,mixC(col,WH,.55),al,p.beam,Math.sin(t*.6+p.tw)*.2);}
    else if(p.type==='star'){const k=Math.pow(Math.abs(Math.sin(t*1.6+p.tw)),3);sparkleG(c,x,y,p.s*(.6+.8*k),col,al*(.5+.5*k));}
    else if(p.type==='streak'){const L=p.s*(1+Math.abs(p.vx)*.04),dir=Math.sign(p.vx);const gr=c.createLinearGradient(x-dir*L,y,x,y);gr.addColorStop(0,rgbaC(col,0));gr.addColorStop(1,rgbaC(mixC(col,WH,.7),al));
      c.strokeStyle=gr;c.lineWidth=1.3;c.beginPath();c.moveTo(x-dir*L,y);c.lineTo(x,y);c.stroke();orbG(c,x,y,5,col,.6*al);}
    else{orbG(c,x,y,p.s*2.4,col,.6*al);c.fillStyle=rgbaC(mixC(col,WH,.7),al);c.beginPath();c.arc(x,y,p.s*.45,0,TAU);c.fill();}}}
function inDisc(R){const r=Math.sqrt(Math.random())*R,th=Math.random()*TAU;return[Math.cos(th)*r,Math.sin(th)*r];}

// ================= TREMOLO =================
const TV=PAL.body;
const TR={dust:makeDust(),t:null};
function sm(a,b,x){const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);}
function stringY(y,x,a,t){
  const on=sm(0,.06,a);
  const extent=.12+.95*a,active=1-sm(extent-.26,extent,Math.abs(y));
  const width=.25+.85*a,env=Math.exp(-Math.pow(x/width,4)*1.6);
  const cycles=1+2.4*a,phase=x*Math.PI*cycles-t*(1.4+2.2*a);
  const wave=Math.sin(phase),pointed=(2/Math.PI)*Math.asin(wave),shape=wave*(1-a*.5)+pointed*a*.5;
  const amp=(.035+.105*a)*(.9+.1*Math.sin(t*(.8+1.4*a)));          // the size of the shake wobbles too
  const idle=.0045*Math.sin(x*3.1+t*.9+y*4)+.0025*Math.sin(x*7.3-t*1.3+y*9); // always breathing a little
  return y+on*amp*active*env*shape+idle;
}
function drawTremolo(c,a,t){
  const R=254,dt=TR.t===null?0:Math.max(0,Math.min(.05,t-TR.t));TR.t=t;
  c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();c.globalCompositeOperation='lighter';
  const rate=1+2.6*a,pulse=.5+.5*Math.sin(t*rate);
  // room glow: breathes on its own, swells with the wobble as the effect grows
  orbG(c,0,0,R*(.6+.55*a),TV,.10+.04*Math.sin(t*.8)+a*(.16+.16*pulse));
  for(let i=0;i<4;i++){const ang=t*.07+i*1.7,rr=R*(.38+.14*Math.sin(t*.13+i));orbG(c,Math.cos(ang)*rr,Math.sin(ang)*rr*.7,R*.5,TV,.045+.05*a);}
  const N=17,depth=.1+.28*a,beads=[];
  for(let j=0;j<N;j++){const base=-.97+j*1.94/16,dist=Math.abs(base);
    const b=1-depth*(.5+.5*Math.cos(t*rate-dist*3));                 // volume wobble ripples outward
    const pts=[];for(let k=0;k<=140;k++){const x=-1+k/70;pts.push([x*R,stringY(base,x,a,t)*R]);}
    const path=()=>{c.beginPath();pts.forEach((p,k)=>k?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));};
    path();c.strokeStyle=rgbaC(TV,(.10+.14*a)*b);c.lineWidth=8+6*a;c.stroke();
    c.strokeStyle=rgbaC(TV,(.42+.2*a)*b);c.lineWidth=3.4;c.stroke();
    // a slow glint slides along every string, even at 0%
    const sx=Math.sin(t*.45+j*.37)*1.15,gr=c.createLinearGradient(-R,0,R,0),core=.5+.32*b;
    const st=(p,al)=>gr.addColorStop(Math.max(0,Math.min(1,(p+1)/2)),rgbaC(WH,al));
    st(-1,core);if(sx-.3>-1)st(sx-.3,core);st(sx,1);if(sx+.3<1)st(sx+.3,core);st(1,core);
    c.strokeStyle=gr;c.lineWidth=1.5+.7*a;c.stroke();
    orbG(c,sx*R,stringY(base,sx,a,t)*R,16,TV,.35);
    if(a>.08)for(let k=2;k<139;k++){const d0=pts[k][1]-base*R,dm=pts[k-1][1]-base*R,dp=pts[k+1][1]-base*R;
      if(Math.abs(d0)>4&&Math.abs(d0)>=Math.abs(dm)&&Math.abs(d0)>=Math.abs(dp))beads.push([pts[k][0],pts[k][1],Math.min(1,Math.abs(d0)/(R*.1))*b]);}
  }
  // light beads riding the wave crests
  for(const [x,y,k] of beads){orbG(c,x,y,7+12*a,TV,.3*k+.12*k*pulse);c.fillStyle=rgbaC(WH,.55*k);c.beginPath();c.arc(x,y,1.3+1.2*a,0,TAU);c.fill();}
  stepDust(TR.dust,dt,2.4+12*a,()=>{const [x,y]=inDisc(R*.95),r=Math.random();
    return{x,y,vx:(Math.random()-.5)*14,vy:-5-8*Math.random(),age:0,life:2.2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.7?0:1,
      type:r<.12+.22*a?'note':r<.32+.18*a?'star':'dot',s:r<.34?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
  drawDust(c,TR.dust,t,[TV,mixC(TV,WH,.5)],.8+.5*a);
  c.restore();
}

// low-resolution layer for wide, soft glow strokes: they look the same blurred-up, but cost a fraction to draw
const LOW={};
function lowLayer(id,K=.4){let o=LOW[id];if(!o){const cv=document.createElement('canvas');cv.width=cv.height=Math.round(512*K);o=LOW[id]={cv,g:cv.getContext('2d'),K};}
  const g=o.g;g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,o.cv.width,o.cv.height);g.setTransform(o.K,0,0,o.K,o.K*256,o.K*256);return o;}
function blitLow(c,o,op){c.save();c.globalAlpha=1;c.globalCompositeOperation=op;c.imageSmoothingEnabled=true;c.drawImage(o.cv,-256,-256,512,512);c.restore();}
// ================= DISTORTION v5: soft "bleeding" signal ribbons; every % step visible; smooth motion =================
const DC=PAL.body,DV=PAL.hi;
const DS={dust:makeDust(),t:null,ev:{last:0,next:0,events:[]}};
const dsm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// occasional extra tears only above ~45%, with soft in/out (no snapping)
function updateGlitchEvents(t,a){const g=DS.ev,rand=(lo,hi)=>lo+Math.random()*(hi-lo),k=Math.max(0,(a-.45)/.55);
 if(t<g.last){g.events=[];g.next=t;}g.last=t;g.events=g.events.filter(e=>t<e.start+e.life);
 if(k<=0){g.events=[];g.next=t;return[];}
 if(t>=g.next){const w=rand(.05,.1+.12*k);g.events.push({start:t,life:rand(1.2,2.6),y:rand(-.8,.75-w),w,shift:rand(.08,.18+.12*k)*(Math.random()<.5?-1:1),focus:rand(-.7,.7),bend:rand(-.15,.15)});
   g.next=t+rand(.6,1.6)/(.5+1.5*k);}
 return g.events.map(e=>{const age=t-e.start,gain=dsm(0,.45,age)*(1-dsm(e.life-.6,e.life,age));return{...e,power:gain*k};});}
function drawDistortion(c,a,t){
 const R=254,dt=DS.t===null?0:Math.max(0,Math.min(.08,t-DS.t));DS.t=t;
 const hash=n=>{const v=Math.sin(n*127.1+41.7)*43758.5453;return v-Math.floor(v);};
 const faults=updateGlitchEvents(t,a);
 // standing ribbons: band i fades in at its own level, so 15% (one gentle bend) and 28% (two, deeper) look clearly different
 const rib=[];for(let i=0;i<6;i++){const str=dsm(0,1,a*6.5-i*1.05);if(str<=0)continue;
   const dir=i%2?1:-1;rib.push({str,dir,c:[0,-.38,.36,-.68,.66,.05][i]+.06*Math.sin(t*.22+i*1.9),w:.07+.11*a+.02*Math.sin(t*.37+i),
     amp:str*(.025+.3*Math.pow(a,1.15))*(.82+.18*Math.sin(t*.55+i*2.1))*dir,focus:.55*Math.sin(t*.17+i*2.4)});}
 function warp(y,x){let shift=.0035*Math.sin(y*2.2+t*.7+x*1.4),tear=0;
   for(const r of rib){const u=(y-r.c+r.w)/(2*r.w);if(u<=0||u>=1)continue;const prof=Math.pow(Math.sin(Math.PI*u),1.3);
     const local=.4+.85*Math.exp(-Math.pow((x-r.focus)/.5,2));                 // the whole band bends together, deeper near its focus
     shift+=r.amp*prof*local;tear=Math.max(tear,r.str*prof);}
   for(const f of faults){const u=(y-f.y)/f.w;if(u<=0||u>=1)continue;const prof=Math.pow(Math.sin(Math.PI*u),1.2),local=.4+.8*Math.exp(-Math.pow((x-f.focus)/.55,2));
     shift+=f.power*(f.shift*prof*local+Math.sin(u*Math.PI*1.6)*f.bend*local*.6);tear=Math.max(tear,f.power*prof);}
   return{shift,tear};}
 c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();
 c.globalCompositeOperation='lighter';orbG(c,0,0,R*1.05,DC,.025+.015*Math.sin(t*.7)+.025*a);
 const scanY=((t*.3)%2.8)-1.4;
 const B={},bucket=(key,style,lw,al)=>B[key]||(B[key]={p:new Path2D(),style,lw,al});
 const add=(path,P,keep)=>{let pen=false;for(let k=1;k<P.length;k++){const p=P[k],q=P[k-1];if(!keep(p,q)){pen=false;continue;}if(!pen){path.moveTo(q.x,q.y);pen=true;}path.lineTo(p.x,p.y);}};
 const vCol=rgbaC(mixC(PAL.hi,WH,.25*a),1),cCol=rgbaC(mixC(PAL.body,PAL.hi,.45*a),1);
 const torn=(p)=>p.tear>.12,calm=(p)=>p.tear<=.12;
 for(let j=0;j<96;j++){
  const x=-1.08+j*2.16/95,seed=hash(j+20),violet=Math.sin(j*.62)>.15,lv=Math.min(2,Math.floor(seed*3));
  const cls=violet?'v':seed>.8?'p':'c',core=cls==='v'?vCol:cls==='p'?rgbaC(PAL.wh,1):cCol,glowC=violet?rgbaC(PAL.hi,1):rgbaC(PAL.body,1);
  const P=[],G=[];
  for(let k=0;k<=76;k++){const y=-1.02+k*2.04/76,w=warp(y,x),fr=(violet?1:-1)*(.003*a+.03*a*w.tear)*R;
    P.push({x:(x+w.shift)*R,y:y*R,tear:w.tear,yy:y});G.push({x:(x+w.shift)*R+fr,y:y*R,tear:w.tear});}
  add(bucket('g0'+glowC,glowC,3+3*a,.035+.05*a).p,G,()=>true);                 // faint glow on every filament
  add(bucket('gt'+glowC,glowC,6+8*a,.07+.13*a).p,G,torn);                     // thick colour that bleeds where it tears
  const base=Math.min(1,.26+(lv+.5)/3*.32+a*.3),lw=.7+(lv+.5)/3*.5+a*.35;
  add(bucket('cc'+cls+lv,core,lw,base).p,P,calm);
  add(bucket('ct'+cls+lv,core,lw*1.15,Math.min(1,base*1.1)).p,P,torn);
  add(bucket('sc'+cls,core,lw+.3,.16+.14*seed).p,P,p=>Math.abs(p.yy-scanY)<.07&&seed>.45);
  add(bucket('hw',rgbaC(PAL.wh,1),1.1,.35+.3*a).p,P,(p,q)=>p.tear>.55&&Math.abs(p.x-q.x)>Math.abs(p.y-q.y)*.9);   // light catching the sharpest bends
 }
 // the glow is drawn small and blurred up: colours melt into each other along the tears
 const lo=lowLayer('dist',.3);lo.g.globalCompositeOperation='lighter';
 for(const k in B){if(k[0]!=='g')continue;const b=B[k];lo.g.globalAlpha=b.al;lo.g.strokeStyle=b.style;lo.g.lineWidth=b.lw;lo.g.stroke(b.p);}
 c.save();c.globalCompositeOperation='lighter';c.filter=`blur(${5+5*a}px)`;c.drawImage(lo.cv,-256,-256,512,512);c.filter='none';c.restore();
 c.globalCompositeOperation='source-over';
 for(const k in B){if(k[0]==='g')continue;const b=B[k];c.globalAlpha=b.al;c.strokeStyle=b.style;c.lineWidth=b.lw;c.stroke(b.p);}
 c.globalAlpha=1;c.globalCompositeOperation='lighter';
 stepDust(DS.dust,dt,2.2+9*a,()=>{const [x,y]=inDisc(R*.95),q=Math.random();
   return{x,y,vx:(Math.random()-.5)*12,vy:-5-9*Math.random(),age:0,life:2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.5?0:1,
     type:q<.14+.22*a?'note':q<.34+.18*a?'star':'dot',s:q<.36?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
 drawDust(c,DS.dust,t,[DC,DV],.8+.5*a,(x,y)=>warp(y/R,x/R).shift*R);
 c.restore();
}

// ================= shared bits for Chorus / Beat Repeat =================
const CP=PAL.body,CB=PAL.hi,CSV=PAL.body;
function blobG(c,x,y,r,col,a){if(a<=0)return;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rgbaC(col,a));gr.addColorStop(1,rgbaC(col,0));c.fillStyle=gr;c.fillRect(x-r,y-r,2*r,2*r);}
function glowLine(c,pts,col,w,a=1,blur=14,close=false,halo=null){if(a<=.003)return;a=Math.min(1,a*1.35);
  const p=new Path2D();pts.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1]));if(close)p.closePath();
  const h=halo||c,k=blur/18;h.lineCap=c.lineCap='round';h.lineJoin=c.lineJoin='round';
  h.strokeStyle=rgbaC(col,.07*a);h.lineWidth=w*(6+4*k);h.stroke(p);
  h.strokeStyle=rgbaC(col,.22*a);h.lineWidth=w*3.2;h.stroke(p);
  c.strokeStyle=rgbaC(col,.75*a);c.lineWidth=w*1.3;c.stroke(p);
  c.strokeStyle=rgbaC(mixC(col,WH,.6),.95*a);c.lineWidth=Math.max(.9,w*.5);c.stroke(p);}
function hazeG(c,R,col,a,t){blobG(c,0,0,R*1.02,col,.34*a*(.92+.08*Math.sin(t*.7)));blobG(c,0,0,R*.5,mixC(col,WH,.35),.2*a);
  for(let i=0;i<9;i++){const an=i*2.39+t*.035*(i%2?1:-1),rr=R*(.2+.6*((i*.618)%1));blobG(c,Math.cos(an)*rr,Math.sin(an)*rr,R*(.22+.1*Math.sin(t*.4+i)),col,.13*a);}}

// ================= CHORUS (woven aurora rings — the chosen look, now moving) =================
const CH={dust:makeDust(),t:null};
function drawChorus(c,a,t){
  const R=254,k0=R/250,dt=CH.t===null?0:Math.max(0,Math.min(.05,t-CH.t));CH.t=t;if(a<=.004){return;}
  c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();c.globalCompositeOperation='lighter';
  const cols=[CP,mixC(CP,PAL.deep,.3),mixC(CP,WH,.4),CB,mixC(CB,WH,.5)];const lo=lowLayer('chorus',.35);lo.g.globalCompositeOperation='lighter';hazeG(lo.g,R,mixC(CP,CB,.4),a,t);
  const cores=[];
  const n=Math.max(1,Math.round(1+7*a));
  for(let L2=0;L2<3;L2++){const r0=R*(.36+L2*.245),spin=t*.06*(L2%2?-1:1);
    for(let i=0;i<n;i++){const ph=i/n*TAU,k=3+L2,amp=k0*(6+22*a)*(1-L2*.15)*(.88+.12*Math.sin(t*.5+i+L2));
      const pts=[];for(let s=0;s<=200;s++){const th=s/200*TAU;const rr=r0+amp*Math.sin(th*k+ph+t*.6)+amp*.4*Math.sin(th*(k+2)-ph-t*.35);pts.push([Math.cos(th+spin)*rr,Math.sin(th+spin)*rr]);}
      const shimmer=.85+.15*Math.sin(t*1.1+i*1.3+L2);
      cores.push([pts,cols[(i+L2)%cols.length],1.2+1.2*a,(.25+.55*a)*(1-L2*.15)*shimmer,18+10*a]);}}
  // halos go to the low-res layer first, then the sharp cores on top
  for(const q of cores){const p=new Path2D();q[0].forEach((z,i)=>i?p.lineTo(z[0],z[1]):p.moveTo(z[0],z[1]));p.closePath();const al=Math.min(1,q[3]*1.35),kk=q[4]/18;
    lo.g.strokeStyle=rgbaC(q[1],.07*al);lo.g.lineWidth=q[2]*(6+4*kk);lo.g.stroke(p);lo.g.strokeStyle=rgbaC(q[1],.22*al);lo.g.lineWidth=q[2]*3.2;lo.g.stroke(p);}
  blitLow(c,lo,'lighter');
  for(const q of cores){const p=new Path2D();q[0].forEach((z,i)=>i?p.lineTo(z[0],z[1]):p.moveTo(z[0],z[1]));p.closePath();const al=Math.min(1,q[3]*1.35);c.lineCap='round';c.lineJoin='round';
    c.strokeStyle=rgbaC(q[1],.75*al);c.lineWidth=q[2]*1.3;c.stroke(p);c.strokeStyle=rgbaC(mixC(q[1],WH,.6),.95*al);c.lineWidth=Math.max(.9,q[2]*.5);c.stroke(p);}
  c.shadowBlur=0;
  stepDust(CH.dust,dt,2+10*a,()=>{const [x,y]=inDisc(R*.95),q=Math.random(),th=Math.atan2(y,x);
    return{x,y,vx:-Math.sin(th)*10,vy:Math.cos(th)*10-4,age:0,life:2.2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.6?0:1,
      type:q<.14+.2*a?'note':q<.32+.18*a?'star':'dot',s:q<.34?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
  drawDust(c,CH.dust,t,[mixC(CP,WH,.4),mixC(CB,WH,.3)],.75+.5*a);
  c.restore();
}

// ================= BEAT REPEAT (waveform bursts copied round the ring; now 3 rings at the top) =================
const BR={dust:makeDust(),t:null};
const BCOL=PAL.body;
const burstBars=(()=>{let s=11;const r=()=>{s=(s*16807)%2147483647;return s/2147483647;};const o=[];for(let i=0;i<30;i++)o.push(.35+.65*r());return o;})();
function drawStutter(c,a,t){
  const R=254,dt=BR.t===null?0:Math.max(0,Math.min(.05,t-BR.t));BR.t=t;if(a<=.004)return;
  c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();c.globalCompositeOperation='lighter';
  const beat=.75+1.1*a,bp=(t*beat)%1,thump=Math.exp(-bp*5);        // a soft pulse on every repeat
  hazeG(c,R,mixC(BCOL,CP,.3),a*.9*(.85+.15*thump),t);
  // outer and middle rings from the start, a third (inner) ring joins from ~55%
  const rings=[{r:.85,on:1,reps:Math.round(5+8*a),h:1,dir:1},{r:.58,on:1,reps:Math.round(3+7*a),h:.85,dir:-1},{r:.31,on:dsm(.5,.8,a),reps:Math.round(2+4*a),h:.7,dir:1}];
  rings.forEach((g2,ri)=>{if(g2.on<=0)return;const rr=R*g2.r,spacing=TAU/g2.reps,span=spacing*.7,H=R*(.032+.026*a)*g2.h*(ri===2?.85:1);
    const rot=t*.05*g2.dir+ri*.4,head=(t*(.35+.5*a)*g2.dir)%TAU;            // a playhead walks the ring; each copy lights as it passes
    for(let i=0;i<g2.reps;i++){const th0=rot+i*spacing;
      let d=((th0-head)*g2.dir)%TAU;if(d<0)d+=TAU;const lit=Math.exp(-d*1.6);            // fresh copy bright, older copies fade like echoes
      const al=g2.on*(.55+.4*a)*(.5+.5*lit)*(.92+.08*thump),grow=1+.18*lit*thump;
      const cx=Math.cos(th0)*rr,cy=Math.sin(th0)*rr;orbG(c,cx,cy,H*2.6,BCOL,.4*al);
      c.strokeStyle=rgbaC(mixC(BCOL,WH,.35+.3*lit),al);c.lineCap='round';c.lineWidth=1.3+.4*a;c.beginPath();
      const nb=burstBars.length;for(let b=0;b<nb;b++){const u=b/(nb-1),th=th0-span/2+u*span,env=Math.pow(Math.sin(Math.PI*u),1.5),h=H*env*burstBars[b]*grow;
        const ca=Math.cos(th),sa=Math.sin(th);c.moveTo(ca*(rr-h),sa*(rr-h));c.lineTo(ca*(rr+h),sa*(rr+h));}
      const core=c.strokeStyle;c.strokeStyle=rgbaC(BCOL,.28*al);c.lineWidth=5+2*a;c.stroke();c.strokeStyle=rgbaC(BCOL,.5*al);c.lineWidth=2.6+a;c.stroke();
      c.strokeStyle=core;c.lineWidth=1.3+.4*a;c.stroke();}
  });
  stepDust(BR.dust,dt,2+9*a,()=>{const [x,y]=inDisc(R*.95),q=Math.random();
    return{x,y,vx:(Math.random()-.5)*12,vy:-5-8*Math.random(),age:0,life:2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.6?0:1,
      type:q<.14+.2*a?'note':q<.32+.18*a?'star':'dot',s:q<.34?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
  drawDust(c,BR.dust,t,[BCOL,mixC(BCOL,WH,.5)],.75+.5*a);
  c.restore();
}
return{chorus:drawChorus,tremolo:drawTremolo,distortion:drawDistortion,beat_repeat:drawStutter};
}
// black -> transparent: alpha = brightest channel (light only), with a gentle lift for the camera background
const LIGHT=(()=>{const c=document.createElement('canvas');c.width=c.height=512;
 const gl=c.getContext('webgl',{premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false,alpha:true});let ok=!!gl,tex,uK,uL;
 if(ok){try{const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
  const pr=gl.createProgram();
  gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float k;uniform vec2 L;void main(){vec3 c=clamp(texture2D(t,v).rgb*L.x,0.,1.);c=pow(c,vec3(L.y))*k;gl_FragColor=vec4(c,max(c.r,max(c.g,c.b)));}'));
  gl.linkProgram(pr);gl.useProgram(pr);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.viewport(0,0,512,512);uK=gl.getUniformLocation(pr,'k');uL=gl.getUniformLocation(pr,'L');}catch(e){console.error(e);ok=false;}}
 return{run(src,fade,lift){if(!ok)return null;gl.uniform1f(uK,fade);gl.uniform2f(uL,lift[0],lift[1]);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
   gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return c;}};})();
const KINDS=['chorus','tremolo','distortion','beat_repeat'];
// [gain, gamma]: lifts faint glow so it survives the camera; Distortion keeps more contrast (its many lines already add up)
const LIFT={chorus:[1.3,.78],tremolo:[1.3,.78],beat_repeat:[1.3,.78],distortion:[1.08,.92]};
const instances=new Map();
window.StemTeamVisuals={
 has:kind=>KINDS.includes(kind),
 draw(ctx,slot,kind,stem,amount,dt){
  if(!KINDS.includes(kind))return false;
  let e=instances.get(slot);
  if(!e||e.kind!==kind||e.stem!==stem){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
   e={kind,stem,time:0,draw:makeSet(PALS[stem]||PALS.other)[kind],canvas,context:canvas.getContext('2d')};instances.set(slot,e);
  }
  e.time+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
  const a=Math.max(0,Math.min(1,Number.isFinite(amount)?amount:0)),w=e.context;
  w.setTransform(1,0,0,1,0,0);w.globalAlpha=1;w.globalCompositeOperation='source-over';w.filter='none';w.fillStyle='#000';w.fillRect(0,0,512,512);
  w.save();try{e.draw(w,a,e.time);}finally{w.restore();}
  const lit=LIGHT.run(e.canvas,1,LIFT[kind]);
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.drawImage(lit||e.canvas,0,0,512,512);ctx.restore();
  return true;
 },
 reset(){instances.clear();}
};
})();
