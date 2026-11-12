/* Recording starts only from this explicit pause-menu action. */
(() => {
  const panel=document.getElementById('recordingSettings');
  const start=document.getElementById('startRecordingButton');
  const stop=document.getElementById('stopRecordingButton');
  let busy=false;
  function refresh(){
    const eligible=state.phase==='paused'&&pausedFrom==='mix';
    panel.hidden=!eligible;
    const active=!!mediaRecorder&&mediaRecorder.state!=='inactive';
    start.hidden=active;stop.hidden=!active;
    start.disabled=busy||recordToggle.disabled||!eligible||!!mediaRecorder;
    stop.disabled=busy;
    start.textContent=busy?'Choose a screen…':'Start recording & continue';
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
      startPerformanceRecording();
      if(!mediaRecorder||mediaRecorder.state!=='recording'){
        state.recordPerformance=false;recordToggle.checked=false;
        releaseScreenCapture();pauseGame();
      }
    }catch(error){
      releaseScreenCapture();recordToggle.checked=false;state.recordPerformance=false;
      recordFormatHint.textContent=error.name==='NotAllowedError'
        ?'Screen sharing was cancelled. Recording has not started; you can try again.'
        :'Recording could not start. Please try again.';
    }finally{busy=false;refresh();updateUI();}
  };
  stop.onclick=()=>{
    if(busy)return;
    stopPerformanceRecording(true);recordToggle.checked=false;state.recordPerformance=false;
    recordFormatHint.textContent='Saving your MP4 recording…';refresh();updateUI();
  };
  window.StemRecordingControls={refresh};refresh();
})();
