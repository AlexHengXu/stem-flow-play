/* Optional local diagnostics. Press P; no data is uploaded. */
(() => {
  let raf=0;
  let enabled=false,previous=0,lastReport=0,trackingTarget=null;
  let frames=[],renderMs=0,renderCalls=0,trackingMs=0,trackingCalls=0;
  const panel=document.createElement('pre');
  panel.hidden=true;panel.setAttribute('aria-label','Performance diagnostics');
  panel.style.cssText='position:fixed;bottom:12px;left:12px;z-index:10000;margin:0;padding:12px;border-radius:8px;background:rgba(0,0,0,.85);color:#fff;font:12px/1.5 monospace;pointer-events:none';
  document.body.append(panel);
  function reset(){frames=[];renderMs=renderCalls=trackingMs=trackingCalls=0;}
  const originalMaterials=renderMaterials,originalZone=renderZone;
  renderMaterials=function(...args){if(!enabled)return originalMaterials(...args);const t=performance.now();try{return originalMaterials(...args);}finally{renderMs+=performance.now()-t;renderCalls++;}};
  renderZone=function(...args){if(!enabled)return originalZone(...args);const t=performance.now();try{return originalZone(...args);}finally{renderMs+=performance.now()-t;renderCalls++;}};
  function observeTracking(){
    if(!hands || trackingTarget===hands)return;
    trackingTarget=hands;const target=hands,send=target.send;
    target.send=function(...args){
      if(!enabled)return send.apply(this,args);
      const t=performance.now();
      const done=()=>{if(enabled){trackingMs+=performance.now()-t;trackingCalls++;}};
      try{const result=send.apply(this,args);Promise.resolve(result).then(done,done);return result;}catch(error){done();throw error;}
    };
  }
  function tick(now){
    if(!enabled)return;
    if(document.hidden){previous=0;reset();raf=requestAnimationFrame(tick);return;}
    if(previous)frames.push(now-previous);previous=now;
    if(now-lastReport>=1000){
      observeTracking();
      const sorted=frames.slice().sort((a,b)=>a-b),sum=frames.reduce((a,b)=>a+b,0);
      const fps=sum?frames.length*1000/sum:0,p95=sorted[Math.floor(sorted.length*.95)]||0;
      panel.textContent=`PERFORMANCE · P to close\nDisplay callbacks: ${fps.toFixed(1)}/s · p95 ${p95.toFixed(0)} ms\nVisual JS: ${renderMs.toFixed(0)} ms / interval (${renderCalls} calls)\nTracking latency: ${trackingCalls?(trackingMs/trackingCalls).toFixed(0)+' ms':'waiting'}\nMode: ${state.phase} / ${state.mode}\nTracking includes async wait; GPU cost is not included.`;
      reset();lastReport=now;
    }
    raf=requestAnimationFrame(tick);
  }
  window.addEventListener('keydown',event=>{
    if(event.code!=='KeyP'||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.target instanceof Element&&(event.target.matches('input,select,textarea')||event.target.isContentEditable))return;
    enabled=!enabled;panel.hidden=!enabled;
    if(!enabled){cancelAnimationFrame(raf);raf=0;}
    if(enabled){reset();previous=0;lastReport=performance.now();panel.textContent='PERFORMANCE · measuring…';observeTracking();raf=requestAnimationFrame(tick);}
  });
})();
