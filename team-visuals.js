// Adapted from il2527's four effect studies. Main game owns timing and camera.
(()=>{
const factories={};
factories.chorus=()=>{
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

// ================= shared bits for Chorus / Beat Repeat =================
const CP=[186,150,255],CB=[63,167,255],CSV=[214,222,236];
function blobG(c,x,y,r,col,a){if(a<=0)return;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rgbaC(col,a));gr.addColorStop(1,rgbaC(col,0));c.fillStyle=gr;c.fillRect(x-r,y-r,2*r,2*r);}
function glowLine(c,pts,col,w,a=1,blur=14,close=false){if(a<=.003)return;a=Math.min(1,a*1.35);c.lineCap='round';c.lineJoin='round';
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();
  c.shadowColor=rgbaC(col,a);c.shadowBlur=0;c.strokeStyle=rgbaC(col,.22*a);c.lineWidth=w*3.2;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(col,.75*a);c.lineWidth=w*1.3;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(mixC(col,WH,.6),.95*a);c.lineWidth=Math.max(.9,w*.5);c.stroke();}
function hazeG(c,R,col,a,t){blobG(c,0,0,R*.95,col,.34*a*(.92+.08*Math.sin(t*.7)));blobG(c,0,0,R*.5,mixC(col,WH,.35),.2*a);
  for(let i=0;i<9;i++){const an=i*2.39+t*.035*(i%2?1:-1),rr=R*(.2+.6*((i*.618)%1));blobG(c,Math.cos(an)*rr,Math.sin(an)*rr,R*(.22+.1*Math.sin(t*.4+i)),col,.13*a);}}

const dsm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// ================= CHORUS (woven aurora rings — the chosen look, now moving) =================
const CH={dust:makeDust(),t:null};
function drawChorus(c,a,t){
  const R=238,k0=R/250,dt=CH.t===null?0:Math.max(0,Math.min(.05,t-CH.t));CH.t=t;if(a<=.004){return;}
  c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();c.globalCompositeOperation='lighter';
  const cols=[CP,CB,mixC(CP,WH,.4),[120,140,255],mixC(CB,WH,.5)];hazeG(c,R,mixC(CP,CB,.4),a,t);
  const n=Math.max(1,Math.round(1+4*a));
  for(let L2=0;L2<3;L2++){const r0=R*(.32+L2*.2),spin=t*.06*(L2%2?-1:1);
    for(let i=0;i<n;i++){const ph=i/n*TAU,k=3+L2,amp=k0*(6+22*a)*(1-L2*.15)*(.88+.12*Math.sin(t*.5+i+L2));
      const pts=[];for(let s=0;s<=120;s++){const th=s/120*TAU;const rr=r0+amp*Math.sin(th*k+ph+t*.6)+amp*.4*Math.sin(th*(k+2)-ph-t*.35);pts.push([Math.cos(th+spin)*rr,Math.sin(th+spin)*rr]);}
      const shimmer=.85+.15*Math.sin(t*1.1+i*1.3+L2);
      glowLine(c,pts,cols[(i+L2)%cols.length],1.2+1.2*a,(.25+.55*a)*(1-L2*.15)*shimmer,18+10*a,true);}}
  c.shadowBlur=0;
  stepDust(CH.dust,dt,2+10*a,()=>{const [x,y]=inDisc(R*.9),q=Math.random(),th=Math.atan2(y,x);
    return{x,y,vx:-Math.sin(th)*10,vy:Math.cos(th)*10-4,age:0,life:2.2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.6?0:1,
      type:q<.14+.2*a?'note':q<.32+.18*a?'star':'dot',s:q<.34?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
  drawDust(c,CH.dust,t,[mixC(CP,WH,.4),mixC(CB,WH,.3)],.75+.5*a);
  c.restore();
}


return drawChorus;
};
factories.tremolo=()=>{
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

// ================= shared bits for Chorus / Beat Repeat =================
const CP=[186,150,255],CB=[63,167,255],CSV=[214,222,236];
function blobG(c,x,y,r,col,a){if(a<=0)return;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rgbaC(col,a));gr.addColorStop(1,rgbaC(col,0));c.fillStyle=gr;c.fillRect(x-r,y-r,2*r,2*r);}
function glowLine(c,pts,col,w,a=1,blur=14,close=false){if(a<=.003)return;a=Math.min(1,a*1.35);c.lineCap='round';c.lineJoin='round';
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();
  c.shadowColor=rgbaC(col,a);c.shadowBlur=0;c.strokeStyle=rgbaC(col,.22*a);c.lineWidth=w*3.2;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(col,.75*a);c.lineWidth=w*1.3;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(mixC(col,WH,.6),.95*a);c.lineWidth=Math.max(.9,w*.5);c.stroke();}
function hazeG(c,R,col,a,t){blobG(c,0,0,R*.95,col,.34*a*(.92+.08*Math.sin(t*.7)));blobG(c,0,0,R*.5,mixC(col,WH,.35),.2*a);
  for(let i=0;i<9;i++){const an=i*2.39+t*.035*(i%2?1:-1),rr=R*(.2+.6*((i*.618)%1));blobG(c,Math.cos(an)*rr,Math.sin(an)*rr,R*(.22+.1*Math.sin(t*.4+i)),col,.13*a);}}

const dsm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// ================= TREMOLO =================
const TV=[176,132,255];
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
  const R=238,dt=TR.t===null?0:Math.max(0,Math.min(.05,t-TR.t));TR.t=t;
  c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();c.globalCompositeOperation='lighter';
  const rate=1+2.6*a,pulse=.5+.5*Math.sin(t*rate);
  // room glow: breathes on its own, swells with the wobble as the effect grows
  orbG(c,0,0,R*(.6+.55*a),TV,.10+.04*Math.sin(t*.8)+a*(.16+.16*pulse));
  for(let i=0;i<4;i++){const ang=t*.07+i*1.7,rr=R*(.38+.14*Math.sin(t*.13+i));orbG(c,Math.cos(ang)*rr,Math.sin(ang)*rr*.7,R*.5,TV,.045+.05*a);}
  const N=17,depth=.1+.28*a,beads=[];
  for(let j=0;j<N;j++){const base=-.94+j*1.88/16,dist=Math.abs(base);
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
  stepDust(TR.dust,dt,2.4+12*a,()=>{const [x,y]=inDisc(R*.9),r=Math.random();
    return{x,y,vx:(Math.random()-.5)*14,vy:-5-8*Math.random(),age:0,life:2.2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.7?0:1,
      type:r<.12+.22*a?'note':r<.32+.18*a?'star':'dot',s:r<.34?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
  drawDust(c,TR.dust,t,[TV,mixC(TV,WH,.5)],.8+.5*a);
  c.restore();
}


return drawTremolo;
};
factories.distortion=()=>{
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

// ================= shared bits for Chorus / Beat Repeat =================
const CP=[186,150,255],CB=[63,167,255],CSV=[214,222,236];
function blobG(c,x,y,r,col,a){if(a<=0)return;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rgbaC(col,a));gr.addColorStop(1,rgbaC(col,0));c.fillStyle=gr;c.fillRect(x-r,y-r,2*r,2*r);}
function glowLine(c,pts,col,w,a=1,blur=14,close=false){if(a<=.003)return;a=Math.min(1,a*1.35);c.lineCap='round';c.lineJoin='round';
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();
  c.shadowColor=rgbaC(col,a);c.shadowBlur=0;c.strokeStyle=rgbaC(col,.22*a);c.lineWidth=w*3.2;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(col,.75*a);c.lineWidth=w*1.3;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(mixC(col,WH,.6),.95*a);c.lineWidth=Math.max(.9,w*.5);c.stroke();}
function hazeG(c,R,col,a,t){blobG(c,0,0,R*.95,col,.34*a*(.92+.08*Math.sin(t*.7)));blobG(c,0,0,R*.5,mixC(col,WH,.35),.2*a);
  for(let i=0;i<9;i++){const an=i*2.39+t*.035*(i%2?1:-1),rr=R*(.2+.6*((i*.618)%1));blobG(c,Math.cos(an)*rr,Math.sin(an)*rr,R*(.22+.1*Math.sin(t*.4+i)),col,.13*a);}}

const dsm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// ================= DISTORTION (original signal-tear look, pushed further at the top end) =================
const DC=[100,219,255],DV=[188,145,255];
const DS={dust:makeDust(),t:null,ev:{last:0,next:0,events:[]}};
function updateGlitchEvents(t,a){
 const g=DS.ev,rand=(lo,hi)=>lo+Math.random()*(hi-lo);
 if(t<g.last){g.events=[];g.next=t;}g.last=t;
 g.events=g.events.filter(e=>t<e.start+e.life);
 if(a<.005){g.events=[];g.next=t;return [];}
 if(t>=g.next){
  const hi=Math.max(0,a-.7)/.3;                                  // 70-100%: extra tears at once
  const count=1+(Math.random()<a*.8?1:0)+(a>.75&&Math.random()<(a-.75)*3?1:0)+(Math.random()<hi*.8?1:0);
  for(let n=0;n<count;n++){
   const w=rand(.035,.12+.18*a+.1*hi);g.events.push({start:t,life:rand(.23,.65+1.65*a),attack:rand(.015,.095),release:rand(.05,.32),y:rand(-.85,.8-w),w,
    shift:rand(.06,.28+.04*hi)*(Math.random()<.5?-1:1),focus:rand(-.8,.8),bend:rand(-.16,.16)*(1+1.3*hi),seed:Math.random()*5000});
  }
  g.next=t+rand(.13,.8)/(.45+a*2.8+hi*1.5);
 }
 return g.events.slice(-10).map(e=>{const age=t-e.start;
  const gain=dsm(0,e.attack,age)*(1-dsm(e.life-e.release,e.life,age));
  return {...e,power:gain*Math.pow(a,1.2),w:e.w*(.7+.3*a)};
 });
}
function drawDistortion(c,a,t){
 const R=238,dt=DS.t===null?0:Math.max(0,Math.min(.05,t-DS.t));DS.t=t;
 c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.clip();
 const hash=n=>{const v=Math.sin(n*127.1+41.7)*43758.5453;return v-Math.floor(v);};
 const faults=updateGlitchEvents(t,a),hi=Math.max(0,a-.7)/.3;
 const amp=(.65+1.2*a)*(1+.35*hi*hi);                              // how far a tear throws the lines
 function warp(y,x){let shift=.0035*Math.sin(y*2.2+t*.7+x*1.4),edge=0,gap=0;   // gentle sway: never fully still
  for(const f of faults){const u=(y-f.y)/f.w;if(u<0||u>1)continue;
   const soft=.12+.22*a,envelope=dsm(0,soft,u)*(1-dsm(1-soft*1.3,1,u));
   const local=.3+.9*Math.exp(-Math.pow((x-f.focus)/.55,2));
   shift+=f.power*amp*(f.shift*envelope+Math.sin(u*Math.PI*1.6)*f.bend*local);
   edge=Math.max(edge,f.power*Math.max(Math.exp(-Math.pow(u/.045,2)),Math.exp(-Math.pow((1-u)/.045,2)))*local);
   if(u>.955)gap=Math.max(gap,f.power*.88);
  }
  return {shift,edge,gap};
 }
 // soft coloured bloom behind every tear (glow, not white)
 c.globalCompositeOperation='lighter';
 orbG(c,0,0,R*.95,DC,.05+.025*Math.sin(t*.7)+.05*a);
 for(const f of faults){if(f.power<.04)continue;c.save();c.scale(1,.22);orbG(c,f.focus*R,(f.y+f.w/2)*R/.22,R*(.5+.4*a),f.shift>0?DV:DC,.16*f.power);c.restore();}
 c.globalCompositeOperation='source-over';
 const scanY=((t*.3)%2.8)-1.4;
 for(let j=0;j<42;j++){
  const x=-1.3+j*2.6/41,seed=hash(j+20),violet=Math.sin(j*.62)>.15;
  for(let pass=0;pass<2;pass++){
   c.shadowBlur=0;c.shadowColor=violet?'#bc91ff':'#64dbff';
   c.globalAlpha=pass===0?(.1+.3*a):(.45+.35*a);
   c.strokeStyle=violet?'#bc91ff':'#64dbff';
   c.lineWidth=pass===0?2.5:.9+a*.4;
   c.beginPath();
   for(let k=0;k<=64;k++){
    const y=-1+k/32,w=warp(y,x);
    const fringe=pass===0?(violet?1:-1)*(.003*a+.012*a*a+.012*hi):0;
    const px=(x+w.shift+fringe)*238,py=y*238;
    if(k===0||w.gap>.6)c.moveTo(px,py);else c.lineTo(px,py);
   }
   c.stroke();
  }
 }
 c.shadowBlur=0;c.shadowColor='#a88bff';
 for(let i=0;i<faults.length;i++){
  const f=faults[i];if(!f.power)continue;
  for(let j=0;j<48;j++){
   const x=(hash(j+i*137)*2-1)*238,hotspot=Math.exp(-Math.pow((x/238-f.focus)/.55,2));
   c.globalAlpha=f.power*(.15+.6*hotspot)*hash(j+f.seed);
   c.strokeStyle=j%3?'#90d9ff':'#efd6ff';c.lineWidth=.7+hotspot;
   const y=(f.y+f.w)*238+(hash(j*3+i)-.5)*3;
   c.beginPath();c.moveTo(x,y);c.lineTo(x+2+hash(j+45)*8*f.power,y);c.stroke();
  }
 }
 c.shadowBlur=0;c.globalAlpha=1;c.globalCompositeOperation='lighter';
 stepDust(DS.dust,dt,2.2+9*a,()=>{const [x,y]=inDisc(R*.9),q=Math.random();
   return{x,y,vx:(Math.random()-.5)*12,vy:-5-9*Math.random(),age:0,life:2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.5?0:1,
     type:q<.14+.22*a?'note':q<.34+.18*a?'star':'dot',s:q<.36?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
 drawDust(c,DS.dust,t,[DC,DV],.8+.5*a,(x,y)=>warp(y/R,x/R).shift*R);   // notes get torn along with the signal
 c.restore();
}


return drawDistortion;
};
factories.beat_repeat=()=>{
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

// ================= shared bits for Chorus / Beat Repeat =================
const CP=[186,150,255],CB=[63,167,255],CSV=[214,222,236];
function blobG(c,x,y,r,col,a){if(a<=0)return;const gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,rgbaC(col,a));gr.addColorStop(1,rgbaC(col,0));c.fillStyle=gr;c.fillRect(x-r,y-r,2*r,2*r);}
function glowLine(c,pts,col,w,a=1,blur=14,close=false){if(a<=.003)return;a=Math.min(1,a*1.35);c.lineCap='round';c.lineJoin='round';
  c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));if(close)c.closePath();
  c.shadowColor=rgbaC(col,a);c.shadowBlur=0;c.strokeStyle=rgbaC(col,.22*a);c.lineWidth=w*3.2;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(col,.75*a);c.lineWidth=w*1.3;c.stroke();
  c.shadowBlur=0;c.strokeStyle=rgbaC(mixC(col,WH,.6),.95*a);c.lineWidth=Math.max(.9,w*.5);c.stroke();}
function hazeG(c,R,col,a,t){blobG(c,0,0,R*.95,col,.34*a*(.92+.08*Math.sin(t*.7)));blobG(c,0,0,R*.5,mixC(col,WH,.35),.2*a);
  for(let i=0;i<9;i++){const an=i*2.39+t*.035*(i%2?1:-1),rr=R*(.2+.6*((i*.618)%1));blobG(c,Math.cos(an)*rr,Math.sin(an)*rr,R*(.22+.1*Math.sin(t*.4+i)),col,.13*a);}}

const dsm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
// ================= BEAT REPEAT (waveform bursts copied round the ring; now 3 rings at the top) =================
const BR={dust:makeDust(),t:null};
const BCOL=mixC(CSV,CP,.3);
const burstBars=(()=>{let s=11;const r=()=>{s=(s*16807)%2147483647;return s/2147483647;};const o=[];for(let i=0;i<30;i++)o.push(.35+.65*r());return o;})();
function drawStutter(c,a,t){
  const R=238,dt=BR.t===null?0:Math.max(0,Math.min(.05,t-BR.t));BR.t=t;if(a<=.004)return;
  c.save();c.translate(256,256);c.beginPath();c.arc(0,0,R,0,TAU);c.clip();c.globalCompositeOperation='lighter';
  const beat=.75+1.1*a,bp=(t*beat)%1,thump=Math.exp(-bp*5);        // a soft pulse on every repeat
  hazeG(c,R,mixC(BCOL,CP,.3),a*.9*(.85+.15*thump),t);
  // outer and middle rings from the start, a third (inner) ring joins from ~55%
  const rings=[{r:.78,on:1,reps:Math.round(4+8*a),h:1,dir:1},{r:.52,on:1,reps:Math.round(3+7*a),h:.85,dir:-1},{r:.27,on:dsm(.5,.8,a),reps:Math.round(2+4*a),h:.7,dir:1}];
  rings.forEach((g2,ri)=>{if(g2.on<=0)return;const rr=R*g2.r,spacing=TAU/g2.reps,span=spacing*.7,H=R*(.032+.026*a)*g2.h*(ri===2?.85:1);
    const rot=t*.05*g2.dir+ri*.4,head=(t*(.35+.5*a)*g2.dir)%TAU;            // a playhead walks the ring; each copy lights as it passes
    for(let i=0;i<g2.reps;i++){const th0=rot+i*spacing;
      let d=((th0-head)*g2.dir)%TAU;if(d<0)d+=TAU;const lit=Math.exp(-d*1.6);            // fresh copy bright, older copies fade like echoes
      const al=g2.on*(.55+.4*a)*(.5+.5*lit)*(.92+.08*thump),grow=1+.18*lit*thump;
      const cx=Math.cos(th0)*rr,cy=Math.sin(th0)*rr;orbG(c,cx,cy,H*2.4,BCOL,.28*al);
      c.strokeStyle=rgbaC(mixC(BCOL,WH,.35+.3*lit),al);c.lineCap='round';c.lineWidth=1.3+.4*a;c.shadowColor=rgbaC(BCOL,.9);c.shadowBlur=0;c.beginPath();
      const nb=burstBars.length;for(let b=0;b<nb;b++){const u=b/(nb-1),th=th0-span/2+u*span,env=Math.pow(Math.sin(Math.PI*u),1.5),h=H*env*burstBars[b]*grow;
        const ca=Math.cos(th),sa=Math.sin(th);c.moveTo(ca*(rr-h),sa*(rr-h));c.lineTo(ca*(rr+h),sa*(rr+h));}
      c.stroke();c.shadowBlur=0;}
  });
  stepDust(BR.dust,dt,2+9*a,()=>{const [x,y]=inDisc(R*.9),q=Math.random();
    return{x,y,vx:(Math.random()-.5)*12,vy:-5-8*Math.random(),age:0,life:2+2.4*Math.random(),tw:Math.random()*9,ci:Math.random()<.6?0:1,
      type:q<.14+.2*a?'note':q<.32+.18*a?'star':'dot',s:q<.34?11+9*Math.random():1.4+2*Math.random(),beam:Math.random()<.35};});
  drawDust(c,BR.dust,t,[BCOL,mixC(BCOL,WH,.5)],.75+.5*a);
  c.restore();
}


return drawStutter;
};
const instances=new Map();
window.StemTeamVisuals={
 has:kind=>Object.hasOwn(factories,kind),
 draw(ctx,slot,kind,stem,amount,dt){
  if(!Object.hasOwn(factories,kind))return false;
  let entry=instances.get(slot);
  if(!entry||entry.kind!==kind||entry.stem!==stem){
   entry={kind,stem,time:0,draw:factories[kind]()};instances.set(slot,entry);
  }
  entry.time+=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
  ctx.save();try{entry.draw(ctx,Math.max(0,Math.min(1,Number.isFinite(amount)?amount:0)),entry.time);}finally{ctx.restore();}
  return true;
 },
 reset(){instances.clear();}
};
})();
