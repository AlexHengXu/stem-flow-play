
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
  bird.f.style.transformOrigin='50% 92%';
  pagesEl.appendChild(page);
  return{page,cam,bg,glow,orbs,bird,p};
});

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
let lastParallax=0;
(function loop(now=0){requestAnimationFrame(loop);if(document.hidden||reduce||now-lastParallax<33)return;lastParallax=now;px+=(tx-px)*.05;py+=(ty-py)*.05;
  const b=built[cur];if(b&&!reduce){b.bg.style.translate=`${-px*4}px ${-py*3}px`;b.orbs.forEach(o=>o.L.style.translate=`${px*5}px ${py*4}px`);b.bird.L.style.translate=`${px*8}px ${py*6}px`}
})();

/* drifting motes of light */
const ctx=$('#spark').getContext('2d');
const motes=Array.from({length:22},()=>({x:Math.random()*1536,y:Math.random()*740,r:1+Math.random()*2.4,v:.12+Math.random()*.25,ph:Math.random()*6.28,s:.6+Math.random()*1.2}));
let lastMotes=0;
(function draw(t){requestAnimationFrame(draw);if(document.hidden||reduce||t-lastMotes<33)return;lastMotes=t;ctx.clearRect(0,0,1536,1024);
  if(!reduce)for(const m of motes){m.y-=m.v;m.x+=Math.sin(t/2400+m.ph)*.15;if(m.y<-10){m.y=760;m.x=Math.random()*1536}
    const a=.25+.55*(.5+.5*Math.sin(t/700*m.s+m.ph));const g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*4);
    g.addColorStop(0,`rgba(255,250,225,${a})`);g.addColorStop(1,'rgba(255,240,200,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(m.x,m.y,m.r*4,0,7);ctx.fill()}
})(0);

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

  next.bird.L.animate([{opacity:0,transform:'translateY(-26px)'},{opacity:1,transform:'translateY(-8px)',offset:.35},{opacity:1,transform:'translateY(5px)',offset:.7},{opacity:1,transform:'translateY(0)'}],{duration:900,delay:dB,easing:'cubic-bezier(.3,.7,.3,1)',fill:'backwards'});
  next.orbs.forEach((o,i)=>o.L.animate([{opacity:0,transform:'translateY(22px) scale(.86)'},{opacity:1,offset:.35},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:950,delay:d0-60+i*130,easing:POP,fill:'backwards'}));
  if(next.glow)next.glow.animate([{opacity:0},{opacity:.6}],{duration:900,delay:d0+120,fill:'backwards'});
  setTimeout(()=>{if(!ended && built[cur]===next)startIdle(next)},dB+900);
  if(first)dialog.animate([{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'translateY(0)'}],{duration:800,delay:700,easing:POP,fill:'forwards'});
    setTimeout(()=>{textEl.getAnimations().forEach(a=>a.cancel());if(!first)$('#tag').animate([{transform:'scale(.86)'},{transform:'scale(1.06)',offset:.6},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});setText(next.p.text);busy=false;type(showNext)},first?1250:dB+640);
}
function advance(){
  if(ended||busy)return;
  if(typing){finishTyping();return}
  if(cur<built.length-1)go(cur+1);else finish();
}
function finish(){
  if(ended)return;
  ended=true;stopIdle();clearInterval(typing);
  location.replace('index.html?flowie=done');
}
function skip(e){e.stopPropagation();if(ended)return;finishTyping();finish()}
$('#viewport').addEventListener('click',advance);
startBtn.addEventListener('click',e=>{e.stopPropagation();finish()});
$('#skip').addEventListener('click',skip);
addEventListener('keydown',e=>{
  if(e.target instanceof HTMLButtonElement && [' ','Enter'].includes(e.key))return;
  if([' ','Enter','ArrowRight'].includes(e.key)){e.preventDefault();advance()}
  else if(e.key==='ArrowLeft'&&!busy&&!ended&&cur>0){finishTyping();go(cur-1)}
  else if(e.key==='Escape')skip(e);
});
Promise.all(built.flatMap(b=>[b.bg,b.bird.f.querySelector('img'),...b.orbs.map(o=>o.L.querySelector('img'))]).map(i=>i.decode().catch(()=>{}))).then(()=>document.fonts.ready).then(()=>go(0));
