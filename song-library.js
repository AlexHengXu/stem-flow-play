/* STEM_SONG_LIBRARY_START */
const embeddedLibraryAudio = {"hot-mess": {"vocals": "hot-mess-vocals.mp3", "bass": "hot-mess-bass.mp3", "drums": "hot-mess-drums.mp3", "other": "hot-mess-other.mp3"}, "red-light-green-light": {"vocals": "red-light-green-light-vocals.mp3", "bass": "red-light-green-light-bass.mp3", "drums": "red-light-green-light-drums.mp3", "other": "red-light-green-light-other.mp3"}};
const songLibrary = Object.freeze([
  {id:'hot-mess', title:'Hot Mess', bpm:108},
  {id:'red-light-green-light', title:'Red Light Green Light', bpm:136},
  {id:'lifesaver', title:'Lifesaver', bpm:120}
]);
let selectedSong = songLibrary[0];
let songReady = false;
let songLoadController = null;
const songSelect = document.getElementById('songSelect');
const songStatus = document.getElementById('songStatus');
const retrySong = document.getElementById('retrySong');

function songSource(song, track) {
  return embeddedLibraryAudio[song.id]?.[track.key] || embeddedAudio[track.file];
}

function waitForSongStem(player, source, signal) {
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      player.removeEventListener('canplaythrough', ready);
      player.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const ready = () => { clean(); resolve(); };
    const failed = () => { clean(); reject(new Error('Audio file could not be loaded')); };
    const aborted = () => { clean(); reject(new Error('Song selection changed')); };
    const timer = setTimeout(failed, 60000);
    player.addEventListener('canplaythrough', ready);
    player.addEventListener('error', failed);
    signal.addEventListener('abort', aborted, {once:true});
    player.src = source;
    player.load();
    if(signal.aborted)aborted();
    else if(player.readyState >= 4)ready();
  });
}

async function loadSelectedSong() {
  songLoadController?.abort();
  const controller = new AbortController();
  songLoadController = controller;
  songReady = false;
  startButton.disabled = true;
  retrySong.hidden = true;
  songStatus.textContent = `Loading ${selectedSong.title}...`;
  if(!audioContext)setupAudio();
  stopAll();
  resetMixState();
  stemDecodeJobs.clear();
  for(const node of Object.values(graph))node.effects.buffer = null;
  // These BPMs are provisional signal-analysis estimates, not verified beat grids.
  window.StemFX.setBpm(selectedSong.bpm);
  try {
    await Promise.all(tracks.map(track => waitForSongStem(players[track.key], songSource(selectedSong, track), controller.signal)));
    if(controller.signal.aborted)return false;
    for(const player of Object.values(players))player.currentTime = 0;
    songReady = true;
    songStatus.textContent = `${selectedSong.title} · Four stems ready`;
    startButton.disabled = !(state.cameraReady && state.modelReady);
    return true;
  } catch(error) {
    if(controller.signal.aborted)return false;
    controller.abort();
    songStatus.textContent = 'Audio unavailable. Please retry or reopen this file.';
    retrySong.hidden = false;
    return false;
  }
}

async function selectSong(id) {
  if(!['setup','ready'].includes(state.phase))throw new Error('Choose a song before starting the session');
  const song = songLibrary.find(item => item.id === id);
  if(!song)throw new RangeError('Unknown song');
  selectedSong = song;
  state.events = [];
  state.recording = false;
  state.playback = false;
  state.playbackIndex = 0;
  songSelect.value = song.id;
  return loadSelectedSong();
}
songSelect.addEventListener('change', () => {
  selectSong(songSelect.value).catch(error => { songSelect.value = selectedSong.id; songStatus.textContent = error.message; });
});
retrySong.addEventListener('click', () => loadSelectedSong());
window.StemLibrary = Object.freeze({
  list:() => songLibrary.map(({id,title,bpm}) => ({id,title,bpm,bpmVerified:false})),
  select:selectSong,
  status:() => ({id:selectedSong.id,title:selectedSong.title,ready:songReady})
});

/* STEM_SONG_LIBRARY_END */
