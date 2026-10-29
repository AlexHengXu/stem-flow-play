/* STEM_FX_TEST_PANEL_START */
// Reuse the existing four FX zones; only their effect assignments change.
let fxBank = 0;
let gestureRepeat = null;
let fxBankAwaitRelease = false;
const fxBanks = [
  {names:['Reverb','Delay','Filter','Quit'],keys:['reverb','delay','filter','quit']},
  {names:['Chorus','Tremolo','Distortion','Beat Repeat'],keys:['chorus','tremolo','distortion','beat_repeat']}
];
function fxAmount(key, index) {
  if(key==='quit')return 0;
  if(key==='beat_repeat')return graph[tracks[index].key]?.effects?.repeat ? 1 : 0;
  return state[key]?.[index] || 0;
}
function releaseGestureRepeat() {
  if(!gestureRepeat)return;
  const {track}=gestureRepeat;
  gestureRepeat=null;
  graph[tracks[track].key]?.effects?.release();
}
function setFxBank(bank) {
  releaseGestureRepeat();
  fxBank=bank;
  effectNames.splice(0,4,...fxBanks[bank].names);
  effectKeys.splice(0,4,...fxBanks[bank].keys);
  state.selectedEffect=0;
}
function toggleFxBank() {
  if(state.mode!=='effects' || state.phase!=='mix' || intro.active)return false;
  setFxBank(1-fxBank);
  resetGestureControls();
  fxBankAwaitRelease=true;
  gestureModeAt=performance.now();
  updateUI();
  return true;
}
function startGestureRepeat(hand,track) {
  if(gestureRepeat)return;
  const held={hand,track};
  gestureRepeat=held;
  window.StemFX.trigger(track).then(()=>updateUI()).catch(error=>{
    if(gestureRepeat===held){releaseGestureRepeat();stateLine.textContent='Beat Repeat: '+error.message;updateUI();}
  });
}
window.addEventListener('keydown',event=>{
  if(event.code!=='KeyJ' || event.repeat || event.ctrlKey || event.metaKey || event.altKey)return;
  if(event.target instanceof Element && (event.target.matches('input,select,textarea') || event.target.isContentEditable))return;
  if(toggleFxBank())event.preventDefault();
});
window.addEventListener('blur',releaseGestureRepeat);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseGestureRepeat();});

/* STEM_FX_TEST_PANEL_END */
