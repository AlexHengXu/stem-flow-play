/* Recording starts only from this explicit pause-menu action. */
(() => {
  const panel=document.getElementById('recordingSettings');
  const start=document.getElementById('startRecordingButton');
  const stop=document.getElementById('stopRecordingButton');
  let busy=false;
  let captureId=null;
  try {
    if(navigator.mediaDevices?.setCaptureHandleConfig){
      const id=crypto.randomUUID();
      navigator.mediaDevices.setCaptureHandleConfig({handle:id,permittedOrigins:[location.origin]});
      captureId=id;
    }
  } catch (_) { /* Older browsers still support manual screen selection. */ }
  function validateStream(stream){
    const track=stream.getVideoTracks()[0];
    if(captureId && typeof track?.getCaptureHandle==='function' && track.getCaptureHandle()?.handle!==captureId){
      const error=new Error('Select this Stem Flow game tab, not another tab, window or screen.');
      error.name='WrongCaptureTarget';throw error;
    }
  }
  function waitForGamePaint(){
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Return to the game tab before recording.')),3000);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve();}));
    });
  }
  function refresh(){
    const eligible=state.phase==='paused'&&pausedFrom==='mix';
    panel.hidden=!eligible;
    const active=!!mediaRecorder&&mediaRecorder.state!=='inactive';
    start.hidden=active;stop.hidden=!active;
    start.disabled=busy||recordToggle.disabled||!eligible||!!mediaRecorder;
    stop.disabled=busy;
    start.textContent=busy?'Preparing game recording…':'Start recording & continue';
  }
  start.onclick=async()=>{
    if(busy||state.phase!=='paused'||pausedFrom!=='mix'||recordToggle.disabled||mediaRecorder)return;
    busy=true;recordToggle.checked=true;refresh();
    try{
      await prepareScreenRecording();
      // User may continue, restart or end while the system picker is open.
      if(state.phase!=='paused'||pausedFrom!=='mix'){
        releaseScreenCapture();recordToggle.checked=false;return;
      }
      await audioContext.resume();
      if(state.phase!=='paused'||pausedFrom!=='mix'){
        releaseScreenCapture();recordToggle.checked=false;return;
      }
      state.recordPerformance=true;
      resumeGame();
      // Do not encode the pause/help surface left in the compositor by the picker.
      await waitForGamePaint();
      if(state.phase!=='mix'){
        state.recordPerformance=false;releaseScreenCapture();recordToggle.checked=false;return;
      }
      startPerformanceRecording();
      if(!mediaRecorder||mediaRecorder.state!=='recording'){
        state.recordPerformance=false;recordToggle.checked=false;
        releaseScreenCapture();pauseGame();
      }
    }catch(error){
      releaseScreenCapture();recordToggle.checked=false;state.recordPerformance=false;
      recordFormatHint.textContent=error.name==='NotAllowedError'
        ?'Screen sharing was cancelled. Recording has not started; you can try again.'
        :error.name==='WrongCaptureTarget'?error.message:'Recording could not start. Return to the game tab and try again.';
      if(state.phase==='mix')pauseGame();
    }finally{busy=false;refresh();updateUI();}
  };
  stop.onclick=()=>{
    if(busy)return;
    stopPerformanceRecording(true);recordToggle.checked=false;state.recordPerformance=false;
    recordFormatHint.textContent='Saving your MP4 recording…';refresh();updateUI();
  };
  window.StemRecordingControls={refresh,validateStream};refresh();
})();
