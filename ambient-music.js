/* One background player per document. It never connects to the recording mix. */
(() => {
  const player=new Audio('flowie-background.mp3');
  player.id='ambientMusic';player.hidden=true;document.body.append(player);
  player.loop=true;player.preload='metadata';player.volume=.16;
  let stage='welcome',muted=false,unlocked=false;
  try{muted=sessionStorage.getItem('stem-ambient-muted')==='1';}catch{}
  const control=document.createElement('button');control.id='ambientMusicToggle';control.type='button';
  Object.assign(control.style,{position:'fixed',right:'16px',bottom:'16px',zIndex:'170',padding:'8px 12px',borderRadius:'20px',border:'1px solid #779494',background:'rgba(12,25,31,.8)',color:'#e5f5f4',font:'13px system-ui',cursor:'pointer'});
  document.body.append(control);
  function update(){
    control.hidden=stage!=='welcome';
    control.textContent=muted?'Music off':'Music on';control.setAttribute('aria-label',muted?'Turn background music on':'Turn background music off');
    control.setAttribute('aria-pressed',String(!muted));
    player.volume=.16;
    if(muted||document.hidden||stage!=='welcome'){player.pause();return;}
    if(unlocked)player.play().catch(()=>{});
  }
  function unlock(){unlocked=true;update();}
  control.onclick=()=>{muted=!muted;try{sessionStorage.setItem('stem-ambient-muted',muted?'1':'0')}catch{}unlock();};
  document.addEventListener('pointerdown',unlock,{once:true});
  document.addEventListener('keydown',unlock,{once:true});
  player.addEventListener('loadedmetadata',()=>{try{const time=Number(sessionStorage.getItem('stem-ambient-time'));if(Number.isFinite(time)&&Number.isFinite(player.duration)&&player.duration>0)player.currentTime=time%player.duration;}catch{}});
  window.addEventListener('pagehide',()=>{try{sessionStorage.setItem('stem-ambient-time',String(player.currentTime))}catch{}player.pause();});
  document.addEventListener('visibilitychange',update);
  window.StemAmbient={setStage(next){stage=next;update();}};
  update();
})();
