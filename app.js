
    const tracks = [
      { key: "vocals", label: "Vocals", file: "vocals.mp3", hue: 288 },
      { key: "bass", label: "Bass", file: "bass.mp3", hue: 205 },
      { key: "drums", label: "Drums", file: "drums.mp3", hue: 185 },
      { key: "other", label: "Other", file: "other.mp3", hue: 265 }
    ];

    const embeddedAudio = {"bass.mp3": "demo-bass.mp3", "drums.mp3": "demo-drums.mp3", "other.mp3": "demo-other.mp3", "vocals.mp3": "demo-vocals.mp3"};
    const effectNames = ["Reverb", "Delay", "Filter", "Quit"];
    const effectKeys = ["reverb", "delay", "filter", "quit"];
    const effectHues = [265, 185, 52, 0];

    const state = {
      selected: 0,
      mode: "tracks",
      effectTrack: 0,
      selectedEffect: 0,
      volumes: [0.8, 0.8, 0.8, 0.8],
      reverb: [0, 0, 0, 0],
      delay: [0, 0, 0, 0],
      filter: [0, 0, 0, 0],
      fadeActive: [false, false, false, false],
      fadeTargets: [0.8, 0.8, 0.8, 0.8],
      recording: false,
      playback: false,
      events: [],
      recordStart: 0,
      playbackStart: 0,
      playbackIndex: 0,
      lastVolumeRecord: 0,
      lastSwitch: 0,
      lastEffectRecord: 0,
      lastEffectSwitch: 0,
      lastFade: 0,
      highStart: 0,
      lowStart: 0,
      openStart: 0,
      openReady: true,
      thumbStart: [0, 0, 0, 0],
      thumbReady: [true, true, true, true],
      phase: "setup",
      joinStart: 0,
      startOpenStart: 0,
      cameraReady: false,
      modelReady: false,
      handReady: false,
      recordPerformance: false,
      performanceRecording: false,
      recordingPaused: false
    };

    let audioContext;
    let recordingDestination;
    let cameraStream;
    let mediaRecorder;
    let mediaChunks = [];
    let hands;
    let lastVideoTime = -1;
    const players = {};
    const graph = {};

    const preflight = document.getElementById("preflight");
    const video = document.getElementById("camera");
    const core = document.getElementById("core");
    const trackName = document.getElementById("trackName");
    const trackMeta = document.getElementById("trackMeta");
    const stateLine = document.getElementById("stateLine");
    const gestureLine = document.getElementById("gestureLine");
    const recordLine = document.getElementById("recordLine");
    const handDots = [document.getElementById("handDot1"), document.getElementById("handDot2")];
    const cameraStatus = document.getElementById("cameraStatus");
    const modelStatus = document.getElementById("modelStatus");
    const handsStatus = document.getElementById("handsStatus");
    const poseStatus = document.getElementById("poseStatus");
    const enableButton = document.getElementById("enableButton");
    const startButton = document.getElementById("startButton");
    const recordToggle = document.getElementById("recordToggle");
    const recordingTypes = [
      'video/mp4;codecs="avc1.424028,mp4a.40.2"',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    const supportedRecordingTypes = typeof MediaRecorder === "undefined" ? [] :
      recordingTypes.filter(type => MediaRecorder.isTypeSupported(type));
    const recordFormatHint = document.getElementById("recordFormatHint");
    recordFormatHint.textContent = supportedRecordingTypes[0]?.startsWith("video/mp4")
      ? "Recording format: MP4"
      : supportedRecordingTypes.length
        ? "Recording format: WebM. MP4 recording is unavailable in this browser."
        : "Video recording is unavailable in this browser.";
    recordToggle.disabled = !supportedRecordingTypes.length;
    const pauseOverlay = document.getElementById("pauseOverlay");
    const endingOverlay = document.getElementById("endingOverlay");
    const endingMessage = document.getElementById("endingMessage");
    const continueButton = document.getElementById("continueButton");
    const restartButton = document.getElementById("restartButton");
    const endButton = document.getElementById("endButton");
    const endingRestartButton = document.getElementById("endingRestartButton");
    const closeButton = document.getElementById("closeButton");
    const helpButton = document.getElementById("helpButton");
    const helpOverlay = document.getElementById("helpOverlay");
    const helpQuitButton = document.getElementById("helpQuitButton");
    const handPrompt = document.getElementById("handPrompt");
    document.getElementById("helpGuide").append(
      document.getElementById("helpGuideTemplate").content.cloneNode(true)
    );

    function openHelp() {
      if (state.phase !== "mix") return;
      pauseGame();
      hideOverlay(pauseOverlay);
      state.phase = "help";
      helpOverlay.inert = false;
      showOverlay(helpOverlay);
      handDots.forEach(dot => { dot.style.opacity = 0; });
      helpQuitButton.focus();
    }

    function closeHelp() {
      if (state.phase !== "help") return;
      hideOverlay(helpOverlay);
      helpOverlay.inert = true;
      state.phase = "paused";
      resumeGame();
      helpButton.focus();
    }
    // Recording code is kept dormant for a later version; UI bindings are disabled in this build.
    const saveButton = null;
    const loadButton = null;
    const loadInput = null;
    const menuHint = document.getElementById("menuHint");

    function createReverbImpulse(duration = 3.1, decay = 2.15) {
      const sampleRate = audioContext.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const impulse = audioContext.createBuffer(2, length, sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const t = i / length;
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        }
      }

      return impulse;
    }

    function setupAudio() {
      if(audioContext)return;
      audioContext = new AudioContext();
      recordingDestination = audioContext.createMediaStreamDestination();
      const reverbImpulse = createReverbImpulse();

      for (const track of tracks) {
        const player = new Audio();
        player.loop = true;
        player.preload = "auto";

        const source = audioContext.createMediaElementSource(player);
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        const delay = audioContext.createDelay(1.2);
        const feedback = audioContext.createGain();
        const delayWet = audioContext.createGain();
        const reverb = audioContext.createConvolver();
        const reverbWet = audioContext.createGain();

        filter.type = "lowpass";
        filter.frequency.value = 20000;
        filter.Q.value = 1.2;
        gain.gain.value = 0.8;
        delay.delayTime.value = 0.28;
        feedback.gain.value = 0;
        delayWet.gain.value = 0;
        reverb.buffer = reverbImpulse;
        reverbWet.gain.value = 0;

        // A read-only pre-effect tap keeps each material tied to its own stem.
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        const visualSamples = new Float32Array(analyser.fftSize);
        source.connect(analyser);
        const effects=new StemEffectRack(audioContext,{bass:track.key==='bass',bpm:stemEffectsBpm});
        source.connect(effects.input);
        effects.output.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        gain.connect(recordingDestination);
        gain.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(delayWet);
        delayWet.connect(audioContext.destination);
        delayWet.connect(recordingDestination);
        gain.connect(reverb);
        reverb.connect(reverbWet);
        reverbWet.connect(audioContext.destination);
        reverbWet.connect(recordingDestination);

        players[track.key] = player;
        graph[track.key] = { filter, gain, delay, feedback, delayWet, reverb, reverbWet, analyser, visualSamples, effects };
      }
    }

    function playAll() {
      syncStemEffects();
      audioContext.resume();
      Object.values(players).forEach(player => player.play().catch(() => {}));
      stateLine.textContent = "Playing";
    }

    function pauseAll() {
      stopStemRepeats();
      Object.values(players).forEach(player => player.pause());
      stateLine.textContent = "Paused";
    }

    function stopAll() {
      stopStemRepeats();
      Object.values(players).forEach(player => player.pause());
      stateLine.textContent = "Stopped";
    }

    function resetMixState() {
      for(const node of Object.values(graph))node.effects?.clear();
      for(const key of STEM_NEW_EFFECTS)state[key]=tracks.map(()=>0);
      state.selected = 0;
      state.mode = "tracks";
      state.effectTrack = 0;
      state.selectedEffect = 0;
      tracks.forEach((_, index) => {
        setVolume(index, 0.8, false);
        applyEffect(index, "reverb", 0, false);
        applyEffect(index, "delay", 0, false);
        applyEffect(index, "filter", 0, false);
        state.fadeActive[index] = false;
        state.fadeTargets[index] = 0.8;
      });
      setSelected(0, false);
    }

    function showOverlay(overlay) {
      overlay.classList.add("visible");
      overlay.setAttribute("aria-hidden", "false");
    }

    function hideOverlay(overlay) {
      overlay.classList.remove("visible");
      overlay.setAttribute("aria-hidden", "true");
    }

    function startPerformanceRecording() {
      if (!state.recordPerformance || !cameraStream || !recordingDestination || typeof MediaRecorder === "undefined") return;
      const tracksForRecording = [
        ...cameraStream.getVideoTracks(),
        ...recordingDestination.stream.getAudioTracks()
      ];
      if (!tracksForRecording.length) return;

      const chunks = [];
      mediaChunks = chunks;
      const stream = new MediaStream(tracksForRecording);
      let recorder;
      for (const mimeType of supportedRecordingTypes) {
        try {
          recorder = new MediaRecorder(stream, { mimeType });
          recorder.start(1000);
          break;
        } catch (error) {
          recorder = null;
        }
      }
      if (!recorder) {
        state.recordPerformance = false;
        recordToggle.checked = false;
        recordFormatHint.textContent = "Recording could not start. You can still play without recording.";
        alert("Recording could not start. This session will not be recorded.");
        return;
      }
      const recordingType = recorder.mimeType.split(";")[0];
      const extension = recordingType === "video/mp4" ? "mp4" : "webm";
      recordFormatHint.textContent = `Recording format: ${extension.toUpperCase()}`;
      recorder.shouldSave = true;
      mediaRecorder = recorder;
      recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (!recorder.shouldSave || !chunks.length) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || recordingType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        link.href = url;
        link.download = `stem-flow-performance-${stamp}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        mediaChunks = [];
      };
      state.performanceRecording = true;
      state.recordingPaused = false;
    }

    function pausePerformanceRecording() {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.pause();
        state.recordingPaused = true;
      }
    }

    function resumePerformanceRecording() {
      if (mediaRecorder && mediaRecorder.state === "paused") {
        mediaRecorder.resume();
        state.recordingPaused = false;
      }
    }

    function stopPerformanceRecording(save = true) {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.shouldSave = save;
        mediaRecorder.stop();
      }
      state.performanceRecording = false;
      state.recordingPaused = false;
    }

    function startMixer() {
      if (state.phase !== "setup" && state.phase !== "join") return;
      if (!audioContext) return;

      state.recordPerformance = recordToggle.checked;
      state.phase = "mix";
      preflight.classList.add("hidden");
      hideOverlay(pauseOverlay);
      hideOverlay(endingOverlay);
      document.getElementById("instruction").textContent = "Main: pinch volume · thumbs up opens effects · Space pauses · M clears all effects";
      restartAll();
      startPerformanceRecording();
      updateUI();
    }

    function pauseGame() {
      if (state.phase !== "mix" && state.phase !== "intro") return;
      pausedFrom=state.phase;
      state.phase = "paused";
      resetGestureControls();introRender();
      document.getElementById('skipStepButton').hidden=pausedFrom!=='intro';
      document.getElementById('skipIntroButton').hidden=pausedFrom!=='intro';
      restartButton.hidden=endButton.hidden=pausedFrom==='intro';
      document.getElementById('pauseDescription').textContent=pausedFrom==='intro'?'Take your time. Continue practicing, skip this step, or go straight to the song.':'Continue, restart the song, or end this run.';
      pauseAll();
      pausePerformanceRecording();
      showOverlay(pauseOverlay);
      document.getElementById("instruction").textContent = "Paused";
      updateUI();
    }

    function resumeGame() {
      if (state.phase !== "paused") return;
      state.phase = pausedFrom;
      hideOverlay(pauseOverlay);
      resetGestureControls();introRender();
      playAll();
      resumePerformanceRecording();
      document.getElementById("instruction").textContent = intro.active ? `Intro: ${introSteps[intro.step][0]} · Space pauses` : "Main: pinch volume · thumbs up opens effects · Space pauses · M clears all effects";
      updateUI();
    }

    function restartGame() {
      hideOverlay(pauseOverlay);
      hideOverlay(endingOverlay);
      stopPerformanceRecording(false);
      resetMixState();
      Object.values(players).forEach(player => { player.currentTime = 0; });
      state.phase = "mix";
      playAll();
      startPerformanceRecording();
      document.getElementById("instruction").textContent = "Main: pinch volume · thumbs up opens effects · Space pauses · M clears all effects";
      updateUI();
    }

    function endGame() {
      hideOverlay(pauseOverlay);
      state.phase = "ended";
      stopAll();
      stopPerformanceRecording();
      const savedFormat = mediaRecorder?.mimeType.startsWith("video/mp4") ? "MP4" : "WebM";
      endingMessage.textContent = state.recordPerformance ? `Session ended. If recording was active, a ${savedFormat} file will download automatically.` : "Session ended. Restart or close this page.";
      showOverlay(endingOverlay);
      document.getElementById("instruction").textContent = "Finished";
      updateUI();
    }

    function updateDiagnostics(handCount = 0, poseText = "none") {
      state.cameraReady = video.readyState >= 2;
      state.modelReady = Boolean(hands);
      state.handReady = handCount > 0;
      handPrompt.hidden = state.phase !== "join";
      cameraStatus.textContent = state.cameraReady ? "ready" : "waiting";
      modelStatus.textContent = state.modelReady ? "loaded" : "waiting";
      if (handsStatus) handsStatus.textContent = String(handCount);
      if (poseStatus) poseStatus.textContent = poseText;
      startButton.disabled = !(state.cameraReady && state.modelReady && songReady);

      if (state.phase === "setup") {
        menuHint.textContent = "Allow camera access, choose Intro or Play song, then press Start.";
      } else if (state.phase === "ready") {
        menuHint.textContent = "Camera ready. Choose your session and press Start.";
      } else if (state.phase === "join" && state.handReady) {
        menuHint.textContent = "Keep your hand visible for 3 seconds to begin.";
      } else if (state.phase === "join") {
        menuHint.textContent = "Camera is ready. Show one hand to confirm tracking.";
      }
    }

    function restartAll() {
      stopStemRepeats();
      Object.values(players).forEach(player => {
        player.currentTime = 0;
        player.play().catch(() => {});
      });
      syncStemEffects();
    }

    function setSelected(index, record = true) {
      state.selected = (index + tracks.length) % tracks.length;
      if (record) recordEvent("select", state.selected, 0);
      updateUI();
    }

    function setVolume(index, value, record = true) {
      const volume = Math.max(0, Math.min(1, value));
      state.volumes[index] = volume;
      state.fadeActive[index] = false;
      graph[tracks[index].key].gain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.04);
      if (record && performance.now() - state.lastVolumeRecord > 80) {
        state.lastVolumeRecord = performance.now();
        recordEvent("volume", index, volume);
      }
      updateUI();
    }

    function fadeTo(index, target, record = true) {
      const nextTarget = Math.max(0, Math.min(1, target));

      if (state.fadeActive[index] && Math.abs(state.fadeTargets[index] - nextTarget) < 0.001) {
        state.fadeActive[index] = false;
        if (record) recordEvent("fadeStop", index, state.volumes[index]);
        updateUI();
        return;
      }

      state.fadeTargets[index] = nextTarget;
      state.fadeActive[index] = true;
      if (record) recordEvent("fade", index, target);
      updateUI();
    }

    function updateFades(dt = 1 / 60) {
      const fadeSpeed = 0.75;

      tracks.forEach((track, index) => {
        if (!state.fadeActive[index]) return;

        const current = state.volumes[index];
        const target = state.fadeTargets[index];
        const step = fadeSpeed * dt;
        const direction = target > current ? 1 : -1;
        const next = Math.abs(target - current) <= step ? target : current + step * direction;

        state.volumes[index] = Math.max(0, Math.min(1, next));
        graph[track.key].gain.gain.setTargetAtTime(state.volumes[index], audioContext.currentTime, 0.035);

        if (Math.abs(state.volumes[index] - target) < 0.001) {
          state.fadeActive[index] = false;
        }
      });
    }

    function applyEffect(index, effect, value, record = true) {
      if(!Number.isInteger(index)||!tracks[index]||!Number.isFinite(value))return;
      if(!['reverb','delay','filter',...STEM_NEW_EFFECTS].includes(effect))return;
      const amount = Math.max(0, Math.min(1, value));
      const nodes = graph[tracks[index].key];
      if(!nodes)return;
      if(STEM_NEW_EFFECTS.includes(effect)){
        if(!state[effect])state[effect]=tracks.map(()=>0);
        state[effect][index]=nodes.effects.set(effect,amount);
      }

      if (effect === "reverb") {
        state.reverb[index] = amount;
        nodes.reverbWet.gain.setTargetAtTime(amount * 0.98, audioContext.currentTime, 0.08);
      }

      if (effect === "delay") {
        state.delay[index] = amount;
        nodes.feedback.gain.setTargetAtTime(amount * 0.58, audioContext.currentTime, 0.08);
        nodes.delayWet.gain.setTargetAtTime(amount * 0.62, audioContext.currentTime, 0.08);
        nodes.delay.delayTime.setTargetAtTime(0.16 + amount * 0.34, audioContext.currentTime, 0.08);
      }

      if (effect === "filter") {
        state.filter[index] = amount;
        const frequency = 20000 - amount * 18850;
        nodes.filter.frequency.setTargetAtTime(Math.max(180, frequency), audioContext.currentTime, 0.1);
        nodes.filter.Q.setTargetAtTime(1.2 + amount * 8, audioContext.currentTime, 0.1);
      }

      if (record && performance.now() - state.lastEffectRecord > 90) {
        state.lastEffectRecord = performance.now();
        recordEvent("effect", index, { effect, value: amount });
      }

      updateUI();
    }

    function clearEffects(record = true) {
      stopStemRepeats();
      tracks.forEach((_, index) => {
        applyEffect(index, "reverb", 0, false);
        applyEffect(index, "delay", 0, false);
        applyEffect(index, "filter", 0, false);
        for(const key of STEM_NEW_EFFECTS)applyEffect(index,key,0,false);
      });
      if (record) recordEvent("clearEffects", 0, 0);
      updateUI();
    }

    function recordEvent(type, index, value) {
      if (!state.recording || state.playback) return;
      state.events.push({
        t: performance.now() - state.recordStart,
        type,
        index,
        value
      });
    }

    function remixPayload() {
      return {
        app: "Stem Flow",
        version: 1,
        savedAt: new Date().toISOString(),
        song: selectedSong.title,
        songId: selectedSong.id,
        bpm: stemEffectsBpm,
        tracks: tracks.map(track => track.key),
        events: state.events
      };
    }

    function saveRecording() {
      if (!state.events.length) {
        menuHint.textContent = "No recording yet. Press R to record a remix first.";
        return;
      }

      const json = JSON.stringify(remixPayload(), null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      link.href = url;
      link.download = `hand-remix-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      menuHint.textContent = `Saved ${state.events.length} remix events as JSON.`;
      updateUI();
    }

    function normalizeLoadedEvents(payload) {
      const incoming = Array.isArray(payload) ? payload : payload?.events;
      if (!Array.isArray(incoming)) throw new Error("Recording file does not contain events.");

      return incoming
        .filter(event => event && Number.isFinite(event.t) && typeof event.type === "string")
        .map(event => ({
          t: Math.max(0, Number(event.t)),
          type: event.type,
          index: Number.isFinite(event.index) ? Math.max(0, Math.min(tracks.length - 1, Math.round(event.index))) : 0,
          value: event.value
        }))
        .sort((a, b) => a.t - b.t);
    }

    function loadRecordingFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          if ((payload.songId && payload.songId !== selectedSong.id) || (!payload.songId && payload.song && payload.song !== selectedSong.title)) {
            throw new Error('Select the recording\'s song before loading this remix.');
          }
          state.events = normalizeLoadedEvents(payload);
          state.recording = false;
          state.playback = false;
          state.playbackIndex = 0;
          menuHint.textContent = `Loaded ${state.events.length} remix events. Press P to play.`;
        } catch (error) {
          menuHint.textContent = error.message || "Could not load that recording JSON.";
        }
        loadInput.value = "";
        updateUI();
      };
      reader.readAsText(file);
    }

    function toggleRecording() {
      state.recording = !state.recording;
      if (state.recording) {
        state.events = [];
        state.recordStart = performance.now();
        state.playback = false;
      }
      updateUI();
    }

    function playRecording() {
      if (!state.events.length) return;
      state.playback = true;
      state.recording = false;
      state.playbackStart = performance.now();
      state.playbackIndex = 0;
      restartAll();
      tracks.forEach((_, index) => {
        setVolume(index, 0.8, false);
        applyEffect(index, "reverb", 0, false);
        applyEffect(index, "delay", 0, false);
        applyEffect(index, "filter", 0, false);
        state.fadeActive[index] = false;
      });
      setSelected(0, false);
      updateUI();
    }

    function applyRecordedEvent(event) {
      if (event.type === "select") setSelected(event.index, false);
      if (event.type === "volume") setVolume(event.index, event.value, false);
      if (event.type === "fade") fadeTo(event.index, event.value, false);
      if (event.type === "fadeStop") state.fadeActive[event.index] = false;
      if (event.type === "effect") applyEffect(event.index, event.value.effect, event.value.value, false);
      if (event.type === "clearEffects") clearEffects(false);
    }

    function updatePlayback() {
      if (!state.playback) return;
      const elapsed = performance.now() - state.playbackStart;
      while (state.playbackIndex < state.events.length && state.events[state.playbackIndex].t <= elapsed) {
        applyRecordedEvent(state.events[state.playbackIndex]);
        state.playbackIndex++;
      }
      if (state.playbackIndex >= state.events.length) state.playback = false;
      updateUI();
    }

    const FILTER_STYLE='C';
    // ===== Visual renderer v2 =====
    // Visual-only. Gesture state and the audio graph remain the source of truth.
    // Main page: each stem grows organically (no hard circle). FX page: four separate
    // zones, each effect reshapes the same instrument material in its own way.

    const stemMotion=Object.fromEntries(tracks.map(track=>[track.key,{time:0,mainTime:0,level:0,previous:0,beat:0,active:false,lastHit:-1,hits:0}]));
    function updateStemMotion(dt,now) {
      tracks.forEach((track,index)=>{
        const motion=stemMotion[track.key],nodes=graph[track.key];
        let rms=0;
        if(nodes?.analyser && !players[track.key]?.paused && state.volumes[index]>0){
          nodes.analyser.getFloatTimeDomainData(nodes.visualSamples);
          for(const value of nodes.visualSamples)rms+=value*value;
          rms=Math.sqrt(rms/nodes.visualSamples.length);
        }
        const target=Math.min(1,rms*12);
        motion.level+=(target-motion.level)*(1-Math.exp(-dt/(target>motion.level?.025:.12)));
        motion.beat*=Math.exp(-dt/.11);
        // Onsets: drums trigger sound-wave rings, bass triggers water ripples.
        if((track.key==='drums'||track.key==='bass') && rms>.007 && rms>motion.previous*1.35+.003 && now-motion.lastHit>(track.key==='drums'?.09:.28)){
          motion.beat=Math.min(1,.35+rms*9);motion.lastHit=now;motion.hits++;
        }
        motion.previous=rms;
        // Always alive: a slow idle drift, sped up by the stem's real loudness.
        motion.time+=dt*(.35+motion.level*1.6);
        // Main-page material only moves while its stem is sounding (as in the main-page design).
        motion.active=rms>(motion.active?.0025:.005);
        if(motion.active)motion.mainTime+=dt*(.25+motion.level*1.8);
      });
    }

    const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    const materialSources = {"vocals": "vocals.png", "drums": "drums.png", "bass": "bass.png", "other": "other.png"};
    // ---- Main page (from Stem_Flow_Circle_FX_Delay_Echoes) ----
    const liveTextures = {};
    const liveTextureTicks = {};
    const rawTextures = {};
    const sparklePoints = [];
    let materialTime = 0;
    let lastMaterialTick = 0;
    function movingSparkle(p,time) {
      const angle=Math.atan2(p.y-256,p.x-256)+time*(.10+.025*Math.sin(p.phase));
      const radius=Math.hypot(p.x-256,p.y-256)+Math.sin(time*.9+p.phase)*7;
      return {x:256+Math.cos(angle)*radius,y:256+Math.sin(angle)*radius,
        light:Math.pow((Math.sin(time*p.speed+p.phase)+1)/2,3)};
    }
    const polarCache={};
    function flowReferenceTexture(key,time,c,source){
      let cache=polarCache[key];
      if(!cache){
        const tile=document.createElement('canvas');tile.width=tile.height=320;
        cache=polarCache[key]={tile,ctx:tile.getContext('2d'),pixels:source.getContext('2d').getImageData(0,0,512,512).data};
        cache.image=cache.ctx.createImageData(320,320);
      }
      const data=cache.image.data,src=cache.pixels;
      for(let y=0;y<320;y++)for(let x=0;x<320;x++){
        const dx=(x-159.5)*1.6,dy=(y-159.5)*1.6,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
        let sx,sy;
        if(key==='vocals'){
          sx=((angle/Math.PI/2+.5)*512+10*Math.sin(r*.035-time*1.7)+512)%512;
          sy=((256-r)*2+time*42+5120)%512;
        }else{
          const spin=angle-time*.7-(1-Math.min(1,r/256))*2.2;
          sx=256+Math.cos(spin)*r*.95;sy=256+Math.sin(spin)*r*.95;
        }
        const ix=Math.max(0,Math.min(511,Math.floor(sx))),iy=Math.max(0,Math.min(511,Math.floor(sy)));
        const from=(iy*512+ix)*4,to=(y*320+x)*4;
        data[to]=src[from];data[to+1]=src[from+1];data[to+2]=src[from+2];data[to+3]=r>255?0:255;
      }
      cache.ctx.putImageData(cache.image,0,0);c.drawImage(cache.tile,0,0,512,512);
    }
    function animateMaterial(key, time, full=false) {
      const ck=full?key+'|full':key;
      const motion=stemMotion[key];
      time=motion.mainTime;
      const tick=`${Math.floor(time*30)}:${Math.round(motion.beat*60)}`;
      if(liveTextures[ck] && liveTextureTicks[ck]===tick)return liveTextures[ck];
      liveTextureTicks[ck]=tick;
      const surface = liveTextures[ck] || (liveTextures[ck] = document.createElement('canvas'));
      if (surface.width !== 512) surface.width = surface.height = 512;
      const c = surface.getContext('2d');
      c.clearRect(0,0,512,512);
      const source = rawTextures[key];
      if (key === 'vocals' || key === 'bass') {
        flowReferenceTexture(key,time,c,source);
      } else if (key === 'drums') {
        const beat=stemMotion.drums.beat;
        const scale=1+beat*.038;
        c.save();c.translate(256,256);c.scale(scale,scale);
        c.globalAlpha=.86+beat*.14;c.drawImage(source,-256,-256);c.restore();
        c.globalCompositeOperation='screen';c.strokeStyle=`rgba(235,246,255,${beat*.3})`;c.lineWidth=2;
        for(let r=45;r<250;r+=30){c.beginPath();c.arc(256,256,r+beat*3,0,Math.PI*2);c.stroke();}
        for(let wave=0;wave<3;wave++){
          const progress=(time*1.8+wave/3)%1,r=35+progress*205;
          c.strokeStyle=`rgba(240,247,255,${beat*(1-progress)*.55})`;c.lineWidth=2+(1-progress)*4;
          c.beginPath();c.arc(256,256,r,0,Math.PI*2);c.stroke();
        }
      } else {
        // Keep every dot in the original dense field visible beneath the moving sparks.
        c.save();
        c.translate(256,256);c.rotate(time*.10);
        c.globalAlpha=.78;
        c.drawImage(source,-256,-256);
        c.restore();
        // Brighter drifting highlights add twinkle without thinning the base field.
        c.globalCompositeOperation='screen';
        for(const p of sparklePoints){
          const {x,y,light}=movingSparkle(p,time);
          c.fillStyle=`rgba(${light>.65 ? '246,240,255' : '167,128,238'},${.06+light*.94})`;
          c.shadowColor='#bda4ff';c.shadowBlur=light*13;
          c.beginPath();c.arc(x,y,.65+light*1.65,0,Math.PI*2);c.fill();
        }
        c.shadowBlur=0;
      }
      c.globalAlpha=1;c.globalCompositeOperation='destination-in';
      const edge=full?c.createRadialGradient(256,256,248,256,256,256):c.createRadialGradient(256,256,key==='drums'?205:155,256,256,251);
      edge.addColorStop(0,'white');edge.addColorStop(1,'transparent');
      c.fillStyle=edge;c.fillRect(0,0,512,512);
      c.globalCompositeOperation='source-over';
      return surface;
    }
    const materialImages = {};
    const materialSurfaces = {};
    const materialRenderCache = [];
    const materialViews = tracks.map(track => {
      const orb = document.getElementById(`orb-${track.key}`);
      const canvas = document.createElement('canvas');
      canvas.className = 'material-canvas';
      canvas.width = canvas.height = 512;
      canvas.setAttribute('aria-hidden', 'true');
      orb.prepend(canvas);
      return { orb, canvas, ctx: canvas.getContext('2d') };
    });
    for (const [key, source] of Object.entries(materialSources)) {
      const img = new Image();
      materialImages[key] = img;
      img.onload = () => {
        const surface = document.createElement('canvas');
        surface.width = surface.height = 512;
        const ctx = surface.getContext('2d');
        // Inscribed crop excludes the reference images' corner UI badges.
        ctx.beginPath(); ctx.arc(256, 256, 250, 0, Math.PI * 2); ctx.clip();
        const side = Math.min(img.width, img.height) * (key === "bass" ? .86 : 1);
        const sx = key === "bass" ? 0 : (img.width-side)/2;
        const sy = key === "bass" ? 0 : (img.height-side)/2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
        const raw = document.createElement('canvas');
        raw.width = raw.height = 512;
        raw.getContext('2d').drawImage(img,sx,sy,side,side,0,0,512,512);
        if(key === 'vocals') {
          // Blend the tile ends so upward flow loops without a hard horizontal seam.
          const rc=raw.getContext('2d'), tile=rc.getImageData(0,0,512,512);
          for(let x=0;x<512;x++)for(let channel=0;channel<3;channel++){
            const seam=(tile.data[x*4+channel]+tile.data[(511*512+x)*4+channel])/2;
            for(let row=0;row<64;row++){
              const blend=(1-row/64)**2;
              for(const y of [row,511-row]){
                const offset=(y*512+x)*4+channel;
                tile.data[offset]=tile.data[offset]*(1-blend)+seam*blend;
              }
            }
          }
          // Map luminance to embers, orange flame, and pale yellow hot cores.
          for(let i=0;i<tile.data.length;i+=4){
            const l=tile.data[i]/255;
            tile.data[i]=Math.min(255,l*650);
            tile.data[i+1]=Math.max(0,Math.min(255,(l-.22)*400));
            tile.data[i+2]=Math.max(0,Math.min(210,(l-.65)*580));
          }
          rc.putImageData(tile,0,0);
          ctx.clearRect(0,0,512,512);ctx.drawImage(raw,0,0);
        }
        rawTextures[key] = raw;
        if(key === 'other') {
          const pixels=raw.getContext('2d').getImageData(0,0,512,512).data;
          for(let y=10;y<502;y+=4)for(let x=10;x<502;x+=4){
            const i=(y*512+x)*4;
            if(pixels[i]+pixels[i+1]+pixels[i+2]>420 && Math.hypot(x-256,y-256)<235)
              sparklePoints.push({x,y,phase:x*.37+y*.81,speed:1.5+(x%11)*.18});
          }
        }
        ctx.globalCompositeOperation = 'destination-in';
        const edge = ctx.createRadialGradient(256,256,220,256,256,252);
        edge.addColorStop(0,'#fff'); edge.addColorStop(1,'transparent');
        ctx.fillStyle = edge; ctx.fillRect(0,0,512,512);
        materialSurfaces[key] = surface;
        renderMaterials();
      };
      img.src = source;
    }

    // Silver grain used to paint the drum sound waves (tiles seamlessly).
    const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=192;
    {
      const g=grainCanvas.getContext('2d'),d=g.createImageData(192,192);
      for(let i=0;i<d.data.length;i+=4){
        const v=Math.random()<.42?140+Math.random()*115:30+Math.random()*50;
        d.data[i]=v*.96;d.data[i+1]=v*.98;d.data[i+2]=v;d.data[i+3]=255;
      }
      g.putImageData(d,0,0);
    }

    // Star field for "Other": ordered so stars appear gradually as volume rises.
    const starPoints=Array.from({length:560},()=>({
      rr:Math.pow(Math.random(),.7),ang:Math.random()*Math.PI*2,ph:Math.random()*20,
      sp:1.2+Math.random()*2.6,sz:.7+Math.random()*1.7,order:Math.random()
    }));

    const ZONES=[{x:.23,y:.25},{x:.23,y:.75},{x:.77,y:.25},{x:.77,y:.75}];
    const TINT={vocals:'255,146,52',bass:'96,192,255',drums:'214,222,236',other:'186,150,255'};
    const makeCanvas=n=>{const c=document.createElement('canvas');c.width=c.height=n;return c;};
    const slots=[0,1,2,3].map(()=>({
      layer:makeCanvas(512),frame:makeCanvas(512),tex:makeCanvas(512),mask:makeCanvas(128),blur:makeCanvas(96),tmp:makeCanvas(512),
      shown:0,fx:0,parts:[],rings:[],fxParts:[],acc:0,fxAcc:0,clock:0,lastHits:0,lastRing:0,lastDrop:0,lastWave:0,wallFlash:0,waves:[],key:null,kind:null
    }));
    const clamp01=v=>Math.max(0,Math.min(1,v));
    const smooth=(a,b,v)=>{const x=clamp01((v-a)/(b-a));return x*x*(3-2*x);};
    function glowDot(c,x,y,r,rgb,a){
      if(a<=.003)return;
      c.fillStyle=`rgba(${rgb},${a*.16})`;c.beginPath();c.arc(x,y,r*2.8,0,Math.PI*2);c.fill();
      c.fillStyle=`rgba(${rgb},${a})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    }
    function stepParticles(list,dt){
      for(let i=list.length-1;i>=0;i--){
        const p=list[i];p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        if(p.drag){p.vx*=Math.exp(-dt*p.drag);p.vy*=Math.exp(-dt*p.drag);}
        if(p.life>=p.max)list.splice(i,1);
      }
    }
    function spawn(slot,field,rate,dt,make){
      slot[field]+=rate*dt;
      while(slot[field]>=1){slot[field]--;make();}
    }

    // Animated (unmasked) instrument texture.
    function flowTexture(slot,key,t){
      const c=slot.tex.getContext('2d');
      c.globalCompositeOperation='source-over';c.globalAlpha=1;c.filter='none';
      c.clearRect(0,0,512,512);
      const src=rawTextures[key];
      if(!src)return slot.tex;
      if(key==='vocals'){
        // Rising, independently swaying strips make tongues of flame climb and curl.
        for(let y=0;y<512;y+=4){
          const rise=(y+t*70)%512;
          const sway=Math.sin(y*.025-t*2.4)*9+Math.sin(y*.061+t*1.6)*3;
          const take=Math.min(4,512-rise);
          c.drawImage(src,0,rise,512,take,sway-16,y,544,take+.4);
          if(take<4)c.drawImage(src,0,0,512,4-take,sway-16,y+take,544,4-take);
        }
      } else if(key==='bass'){
        for(let y=0;y<512;y+=4){
          const curl=Math.sin(y*.021-t*1.2)*15+Math.sin(y*.009+t*.7)*8;
          const sy=(y+t*9)%508;
          c.drawImage(src,0,sy,512,4,-24+curl,y,560,4.6);
        }
        // A second, counter-moving layer gives a shimmering water surface.
        c.globalCompositeOperation='screen';c.globalAlpha=.42;
        c.save();c.translate(256,256);c.rotate(Math.PI+Math.sin(t*.3)*.25);
        c.drawImage(src,-300+Math.sin(t*.5)*20,-300,600,600);c.restore();
        c.globalCompositeOperation='source-over';c.globalAlpha=1;
      } else {
        c.drawImage(src,0,0);
      }
      return slot.tex;
    }
    function applyMask(slot){
      const c=slot.tex.getContext('2d');
      c.globalCompositeOperation='destination-in';c.globalAlpha=1;
      c.drawImage(slot.mask,0,0,512,512);
      c.globalCompositeOperation='source-over';
    }
    function maskCtx(slot){
      const m=slot.mask.getContext('2d');
      m.setTransform(1,0,0,1,0,0);m.filter='none';m.globalCompositeOperation='source-over';m.globalAlpha=1;
      m.clearRect(0,0,128,128);m.setTransform(.25,0,0,.25,0,0);
      return m;
    }

    // ---- Vocals: a fire that grows from a few flickers to a lush blaze ----
    function drawFlame(L,slot,amt,t,dt,motion,mods){
      const presence=smooth(0,.06,amt);
      const baseY=398,bed=50+amt*250,n=Math.round(2+amt*7);
      const hMul=mods.height??1;
      const m=maskCtx(slot);m.filter='blur(1.5px)';
      const tips=[];
      if(presence>0){
        for(let i=0;i<n;i++){
          const u=n===1?.5:i/(n-1),hf=1-Math.abs(u-.5)*1.15;
          const x=256+(u-.5)*bed+Math.sin(t*.9+i*3.1)*6;
          const flick=.78+.2*Math.sin(t*7.3+i*2.1)+.12*Math.sin(t*12.7+i*5.3)*(.4+motion.level);
          const H=(30+amt*300)*(.42+.58*hf)*flick*hMul;
          const W=(18+amt*42)*(.7+.3*hf);
          const sway=Math.sin(t*2.3+i*1.7)*W*.6;
          const g=m.createLinearGradient(0,baseY,0,baseY-H);
          g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.55,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');
          m.fillStyle=g;m.beginPath();
          m.moveTo(x-W,baseY+10);
          m.bezierCurveTo(x-W*1.05,baseY-H*.35,x+sway-W*.35,baseY-H*.7,x+sway,baseY-H);
          m.bezierCurveTo(x+sway+W*.35,baseY-H*.7,x+W*1.05,baseY-H*.35,x+W,baseY+10);
          m.closePath();m.fill();
          tips.push({x,H,W});
        }
        const bedG=m.createRadialGradient(256,baseY,0,256,baseY,bed*.7+20);
        bedG.addColorStop(0,'rgba(255,255,255,.85)');bedG.addColorStop(1,'rgba(255,255,255,0)');
        m.fillStyle=bedG;m.beginPath();m.ellipse(256,baseY,bed*.7+20,26+amt*20,0,0,Math.PI*2);m.fill();
      }
      flowTexture(slot,'vocals',t);applyMask(slot);
      if(mods.tint){const c=slot.tex.getContext('2d');c.globalCompositeOperation='source-atop';c.fillStyle=mods.tint;c.fillRect(0,0,512,512);c.globalCompositeOperation='source-over';}
      L.globalAlpha=.82*presence;L.drawImage(slot.tex,0,0);L.globalAlpha=1;
      // Warm glow at the base of the fire.
      L.globalCompositeOperation='lighter';
      const gr=Math.min(150,bed*.55+40),gy=baseY-50;
      const glow=L.createRadialGradient(256,gy,0,256,gy,gr);
      glow.addColorStop(0,`rgba(255,120,30,${.22*amt*(mods.glow??1)})`);glow.addColorStop(1,'rgba(255,80,20,0)');
      L.fillStyle=glow;L.beginPath();L.arc(256,gy,gr,0,Math.PI*2);L.fill();
      // Embers rise from the flame tips.
      const rate=amt*(5+16*motion.level+6*amt)*(mods.emberRate??1);
      spawn(slot,'acc',tips.length?rate:0,dt,()=>{
        const tip=tips[Math.floor(Math.random()*tips.length)];
        slot.parts.push({x:tip.x+(Math.random()-.5)*tip.W,y:baseY-tip.H*(.4+Math.random()*.5),
          vx:(Math.random()-.5)*22,vy:-(40+Math.random()*60)*(mods.emberSpeed??1),life:0,
          max:(1+Math.random()*1.4)*(mods.emberLife??1),r:.8+Math.random()*1.6});
      });
      stepParticles(slot.parts,dt);
      for(const p of slot.parts){
        p.vx+=Math.sin(t*3+p.y*.05)*12*dt;
        const k=1-p.life/p.max;
        glowDot(L,p.x,p.y,p.r,k>.5?'255,214,140':'255,130,50',k*.9);
      }
      L.globalCompositeOperation='source-over';
    }

    // ---- Bass: water that fills from a small rippling pool to a wide one ----
    function drawWater(L,slot,amt,t,dt,motion,mods){
      const presence=smooth(0,.05,amt);
      const R=(16+amt*218)*(mods.spread??1);
      flowTexture(slot,'bass',t);
      // Ripples: on bass hits, in delay rhythm, or a gentle idle ripple.
      const tc=slot.tex.getContext('2d');
      const hit=motion.hits!==slot.lastHits;slot.lastHits=motion.hits;
      const every=mods.dropEvery??2.4;
      if(presence>0 && (hit || slot.clock-slot.lastDrop>every)){
        slot.lastDrop=slot.clock;
        const a=Math.random()*Math.PI*2,d=Math.random()*R*.45;
        slot.rings.push({x:256+Math.cos(a)*d,y:256+Math.sin(a)*d,r:2,life:0,max:(1.8+amt)*(mods.rippleLife??1),s:hit?1:.6});
      }
      for(let i=slot.rings.length-1;i>=0;i--){
        const q=slot.rings[i];q.life+=dt;q.r+=dt*(70+amt*40)*(mods.rippleSpeed??1);
        if(q.life>q.max){slot.rings.splice(i,1);continue;}
        const k=1-q.life/q.max;
        tc.globalCompositeOperation='lighter';
        for(const [f,w] of [[1,3.2],[.72,1.8],[.5,1.1]]){
          tc.strokeStyle=`rgba(170,225,255,${k*.42*q.s})`;tc.lineWidth=w;
          tc.beginPath();tc.ellipse(q.x,q.y,q.r*f,q.r*f*.86,0,0,Math.PI*2);tc.stroke();
        }
        tc.globalCompositeOperation='source-over';
      }
      // Irregular, softly breathing shoreline (no circle edge).
      const m=maskCtx(slot);m.filter='blur(2.5px)';
      if(presence>0){
        const g=m.createRadialGradient(256,256,0,256,256,R*1.12);
        g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.62,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');
        m.fillStyle=g;m.beginPath();
        for(let i=0;i<=72;i++){
          const th=i/72*Math.PI*2;
          const r=R*(1+.11*Math.sin(3*th+t*.9)+.07*Math.sin(5*th-t*1.3)+.04*Math.sin(9*th+t*2.1)+.05*motion.beat*Math.sin(7*th));
          const x=256+Math.cos(th)*r,y=256+Math.sin(th)*r*.9;
          i?m.lineTo(x,y):m.moveTo(x,y);
        }
        m.closePath();m.fill();
      }
      applyMask(slot);
      if(mods.tint){tc.globalCompositeOperation='source-atop';tc.fillStyle=mods.tint;tc.fillRect(0,0,512,512);tc.globalCompositeOperation='source-over';}
      // More water = deeper, more opaque; a little water stays light and clear.
      L.globalAlpha=(.4+.48*amt)*presence;L.drawImage(slot.tex,0,0);L.globalAlpha=1;
      // Light glints dancing on the surface.
      L.globalCompositeOperation='lighter';
      spawn(slot,'acc',presence*(2+amt*7)*(mods.glintRate??1),dt,()=>{
        const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*R*.8;
        slot.parts.push({x:256+Math.cos(a)*d,y:256+Math.sin(a)*d*.9,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,life:0,max:.7+Math.random()*1.1,r:.8+Math.random()*1.3});
      });
      stepParticles(slot.parts,dt);
      for(const p of slot.parts){const k=Math.sin(Math.PI*p.life/p.max);glowDot(L,p.x,p.y,p.r,'210,240,255',k*.85*(mods.glint??1));}
      L.globalCompositeOperation='source-over';
    }

    // ---- Drums: dark-silver sound waves that pulse out on every hit ----
    let grainPattern=null;
    function drawDrums(L,slot,amt,t,dt,motion,mods){
      const presence=smooth(0,.05,amt);
      const coreR=(10+amt*44)*(mods.core??1)+motion.beat*10*amt;
      const hit=motion.hits!==slot.lastHits;slot.lastHits=motion.hits;
      const strength=hit?Math.max(.55,motion.beat):.45;
      if(presence>0 && (hit || slot.clock-slot.lastRing>(mods.idleGap??1.05))){
        slot.lastRing=slot.clock;
        const echoes=mods.echoes??0,gap=mods.echoGap??.3;
        for(let k=0;k<=echoes;k++){
          slot.rings.push({r:coreR*.8,delay:k*gap,v:(170+90*strength)*(mods.ringSpeed??1),
            max:Math.min(244,coreR+(25+amt*170)*(mods.reach??1)),w:(4+9*strength)*(mods.thick??1),a:(.55+.45*strength)*Math.pow(.62,k)});
        }
      }
      // Dark smoky core with silver grain, pulsing with the kick.
      const s=coreR*2.6;
      if(presence>0){
        const dark=L.createRadialGradient(256,256,0,256,256,coreR*1.9);
        dark.addColorStop(0,`rgba(6,8,12,${.62*presence})`);dark.addColorStop(1,'rgba(6,8,12,0)');
        L.fillStyle=dark;L.fillRect(0,0,512,512);
        if(rawTextures.drums){
          const c=slot.tmp.getContext('2d');c.globalCompositeOperation='source-over';c.clearRect(0,0,512,512);
          c.save();c.translate(256,256);c.rotate(t*.15);c.drawImage(rawTextures.drums,-s/2,-s/2,s,s);c.restore();
          c.globalCompositeOperation='destination-in';
          const g=c.createRadialGradient(256,256,0,256,256,s/2);
          g.addColorStop(0,'#fff');g.addColorStop(.55,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');
          c.fillStyle=g;c.fillRect(0,0,512,512);c.globalCompositeOperation='source-over';
          L.globalCompositeOperation='lighter';L.globalAlpha=(.55+motion.beat*.45)*presence*(mods.bright??1);
          L.drawImage(slot.tmp,0,0);L.globalAlpha=1;L.globalCompositeOperation='source-over';
        }
      }
      if(!grainPattern)grainPattern=L.createPattern(grainCanvas,'repeat');
      for(let i=slot.rings.length-1;i>=0;i--){
        const q=slot.rings[i];
        if(q.delay>0){q.delay-=dt;continue;}
        q.r+=q.v*dt;
        if(q.r>=q.max){slot.rings.splice(i,1);continue;}
        const p=(q.r-coreR*.8)/Math.max(1,q.max-coreR*.8);
        const a=q.a*Math.pow(1-p,1.25)*Math.min(1,p/.06)*(mods.bright??1);
        const w=q.w*(1+p*(mods.spreadW??.6));
        // Black smoky band underneath...
        L.globalCompositeOperation='source-over';
        L.strokeStyle=`rgba(5,7,11,${a*.5})`;L.lineWidth=w*2.4;
        L.beginPath();L.arc(256,256,q.r,0,Math.PI*2);L.stroke();
        // ...silver grain on top, with a bright leading edge.
        L.globalCompositeOperation='lighter';
        L.globalAlpha=Math.min(1,a*.95);L.strokeStyle=grainPattern;L.lineWidth=w;
        L.beginPath();L.arc(256,256,q.r,0,Math.PI*2);L.stroke();L.globalAlpha=1;
        L.strokeStyle=`rgba(232,238,248,${a*.6*(mods.edge??1)})`;L.lineWidth=1.3;
        L.beginPath();L.arc(256,256,q.r+w*.45,0,Math.PI*2);L.stroke();
      }
      L.globalCompositeOperation='source-over';
    }

    // ---- Other: a swirling star cloud that thickens and spreads with volume ----
    function drawStars(L,slot,amt,t,dt,motion,mods){
      const spread=(26+amt*200)*(mods.spread??1);
      L.globalCompositeOperation='lighter';
      const neb=L.createRadialGradient(256,256,0,256,256,spread*1.15);
      neb.addColorStop(0,`rgba(150,110,255,${.2*amt*(mods.nebula??1)})`);
      neb.addColorStop(.5,`rgba(120,80,230,${.08*amt*(mods.nebula??1)})`);neb.addColorStop(1,'rgba(100,70,220,0)');
      L.fillStyle=neb;L.fillRect(0,0,512,512);
      const tw0=mods.twinkle??1,trail=mods.trail??0,dim=mods.dim??1;
      for(const p of starPoints){
        const vis=clamp01((amt*1.05-p.order)/.08);
        if(!vis)continue;
        const ang=p.ang+t*.2*(1-p.rr*.55)*(mods.rot??1);
        const r=p.rr*spread*(1+.04*Math.sin(t*.8+p.ph));
        const x=256+Math.cos(ang)*r,y=256+Math.sin(ang)*r*.84;
        const tw=Math.pow((Math.sin(t*p.sp+p.ph)+1)/2,3)*tw0;
        const a=vis*(.28+.72*tw)*(1-p.rr*.35)*dim;
        const rgb=tw>.55?'246,240,255':'176,140,248';
        if(trail>0){
          L.strokeStyle=`rgba(${rgb},${a*.35})`;L.lineWidth=p.sz*.8;
          L.beginPath();L.ellipse(256,256,Math.max(.1,r),Math.max(.1,r*.84),0,ang-trail*(1-p.rr*.3),ang);L.stroke();
        }
        glowDot(L,x,y,p.sz*(.8+tw*.7),rgb,a);
      }
      L.globalCompositeOperation='source-over';
    }

    const instrumentDrawers={vocals:drawFlame,bass:drawWater,drums:drawDrums,other:drawStars};

    // Effect-specific instrument tweaks (shared language across all four instruments).
    function effectMods(key,kind,a,P){
      const m={};
      if(kind==='reverb'){
        if(key==='vocals'){m.emberLife=1+1.6*a;m.emberSpeed=.6;m.glow=1+1.5*a;}
        if(key==='bass'){m.spread=1+.25*a;m.rippleLife=1+1.5*a;m.rippleSpeed=.7;}
        if(key==='drums'){m.thick=1+2.2*a;m.ringSpeed=1-.45*a;m.reach=1+.5*a;m.spreadW=.6+2*a;m.edge=1-.6*a;}
        if(key==='other'){m.nebula=1+3*a;m.spread=1+.2*a;}
      }
      if(kind==='delay'){
        const n=a<.02?0:1+Math.round(a*3);
        if(key==='vocals'){m.emberRate=1+a;}
        if(key==='bass'){m.dropEvery=P;}
        if(key==='drums'){m.echoes=n;m.echoGap=P;m.idleGap=Math.max(1.05,P*(n+1));}
        if(key==='other'){m.trail=.15+.75*a;}
      }
      if(kind==='filter'){
        if(key==='vocals'){m.height=1-.5*a;m.emberRate=1-.8*a;m.tint=`rgba(90,8,0,${.5*a})`;}
        if(key==='bass'){m.tint=`rgba(2,10,30,${.55*a})`;m.glint=1-.85*a;m.rippleSpeed=1-.4*a;}
        if(key==='drums'){m.ringSpeed=1-.55*a;m.thick=1+1.3*a;m.reach=1-.45*a;m.edge=1-.8*a;m.bright=1-.45*a;}
        if(key==='other'){m.twinkle=1-.85*a;m.spread=1-.35*a;m.dim=1-.45*a;m.rot=1-.6*a;}
      }
      return m;
    }

    // Each circle is its own little screen: everything is composed inside a
    // 512px frame, softly faded before the rim, then drawn exactly over the orb.
    const orbEls=tracks.map(track=>document.getElementById(`orb-${track.key}`));
    let dst=null;
    function softCircle(c,inner=212,outer=250){
      c.globalCompositeOperation='destination-in';c.globalAlpha=1;c.filter='none';
      const g=c.createRadialGradient(256,256,inner,256,256,outer);
      g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g;c.fillRect(0,0,512,512);c.globalCompositeOperation='source-over';
    }
    function drawLayer(src,alpha,scale=1,filter='none'){
      if(alpha<=.003)return;
      dst.filter=filter;dst.globalAlpha=Math.min(1,alpha);
      dst.drawImage(src,256-256*scale,256-256*scale,512*scale,512*scale);
      dst.globalAlpha=1;dst.filter='none';
    }
    function ringStroke(c,r,w,rgb,a){
      if(a<=.003||r<=0)return;
      c.strokeStyle=`rgba(${rgb},${Math.min(1,a)})`;c.lineWidth=w;
      c.beginPath();c.arc(256,256,r,0,Math.PI*2);c.stroke();
    }

    // Delay base: the instrument's full material, growing from the centre with strength.
    // 0% shows nothing; 100% covers the whole circle right up to its rim.
    function drawDelayBase(L,key,a){
      const R=Math.sqrt(a)*262;
      if(R<1)return;
      L.drawImage(fxMaterial(key),256-R,256-R,2*R,2*R);
      const b=smooth(.85,1,a);
      L.globalCompositeOperation='destination-in';
      const g=L.createRadialGradient(256,256,R*(.72+.25*b),256,256,Math.max(1,R*(.98+.02*b)));
      g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');
      L.fillStyle=g;L.fillRect(0,0,512,512);L.globalCompositeOperation='source-over';
    }

    // Material for effect pages. 'other' uses the see-through star layers (no dark disc).
    let fxStarCv=null,fxStarAt=-1;
    function fxMaterial(key){
      if(key==='vocals'||key==='bass')return approvedFxMaterial(key);
      if(key!=='other')return animateMaterial(key,null,true);
      const tex=getStarTex();if(!tex)return animateMaterial(key,null,true);
      const now=performance.now();
      if(fxStarCv&&now-fxStarAt<30)return fxStarCv;
      fxStarAt=now;fxStarCv=fxStarCv||makeCanvas(512);
      const c=fxStarCv.getContext('2d'),t=now/1000;
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,512,512);c.globalCompositeOperation='lighter';
      for(const [s,rot,al] of [[1.06,-t*.045,.55],[.96,t*.07+1,.7],[.86,t*.12+2,1]]){
        c.save();c.translate(256,256);c.rotate(rot);c.globalAlpha=al;c.drawImage(tex,-256*s,-256*s,512*s,512*s);c.restore();
      }
      c.globalAlpha=1;c.globalCompositeOperation='source-over';
      return fxStarCv;
    }
    function drawFullBase(L,key){
      L.drawImage(fxMaterial(key),-6,-6,524,524);
    }

    // ---- Fire (style A) for the vocals effect pages ----
    // Same flame field as the main page, rendered into a zone's 512px layer (rim = 256).
    function fireField(fs,target,lvl,beat,N,minInterval){
      const lum=getFireLum();if(!lum)return null;
      const now=performance.now()/1000,dt=fs.fl?Math.min(.6,now-fs.fl):0;
      if(fs.cv&&minInterval>0&&now-(fs.lastCalc||0)<minInterval)return fs.cv;   // ~30 fps is plenty
      fs.fl=now;fs.lastCalc=now;
      fs.ft=(fs.ft||0)+dt*(.85+.9*lvl+.4*beat);
      fs.Ra=fs.Ra??target;fs.Ra+=(target-fs.Ra)*(1-Math.exp(-dt/.25));
      const Ra=Math.max(.001,fs.Ra),t=fs.ft;
      if(!fs.cv||fs.N!==N){fs.N=N;fs.cv=makeCanvas(N);fs.img=fs.cv.getContext('2d').createImageData(N,N);}
      const d=fs.img.data;d.fill(0);
      const maxR=Math.min(FEXT,Ra*1.75);
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){
        const dx=(x-N/2+.5)/(N/2)*FEXT,dy=(y-N/2+.5)/(N/2)*FEXT,r=Math.hypot(dx,dy);
        if(r>maxR)continue;
        const cx=dx/(r||1),cy=dy/(r||1);
        const n=fbm3(cx*1.8+5,cy*1.8,r*2.6-t*1.3),tg=fbm3(cx*4.5,cy*4.5+9,r*4.2-t*2.2);
        const f=(1-r/Ra)+(n-.5)*.85+(tg-.5)*.55*Math.min(1,r/Ra);
        if(f<-.02)continue;
        const al=sm3(-.02,.32,f),h=sm3(-.1,1,f),th=Math.atan2(dy,dx);
        const sx=((th/Math.PI/2+.5)*256+6*Math.sin(r*9-t*1.7)+2560)%256|0,v=(((1-r)*256+t*40)%512+512)%512,sy=(v<256?v:511-v)|0;
        const L=lum[sy*256+sx];firePal(h*(.75+.45*L),fireRGB);
        const o=(y*N+x)*4;d[o]=fireRGB[0];d[o+1]=fireRGB[1];d[o+2]=fireRGB[2];d[o+3]=Math.min(255,al*255*(.8+.3*L));
      }
      fs.cv.getContext('2d').putImageData(fs.img,0,0);
      return fs.cv;
    }
    function fireBlit(c,cv,bloom=true){
      if(!cv)return;
      const S=FEXT*256;c.imageSmoothingQuality='high';
      if(bloom){c.globalCompositeOperation='lighter';c.filter='blur(9px)';c.globalAlpha=.5;c.drawImage(cv,256-S,256-S,2*S,2*S);
        c.filter='none';c.globalAlpha=1;c.globalCompositeOperation='source-over';}
      c.drawImage(cv,256-S,256-S,2*S,2*S);
    }
    // Fire base for an effect zone. cover: 0..1 (how far the fire reaches; 1 = fills the circle).
    function drawFireFx(L,slot,cover,motion,immediate,underglow=true){
      const fs=slot.fire||(slot.fire={});
      const cv=fireField(fs,1.75*Math.pow(cover,.75),motion.level,motion.beat,84,immediate?0:1/24);
      // Deep ember glow underneath so a full-strength circle has no gaps.
      const fill=underglow?sm3(.7,1,cover):0;
      if(fill>0){const g=L.createRadialGradient(256,256,0,256,256,262);
        g.addColorStop(0,`rgba(255,120,30,${.8*fill})`);g.addColorStop(1,`rgba(150,25,0,${.85*fill})`);
        L.fillStyle=g;L.fillRect(0,0,512,512);}
      fireBlit(L,cv);
    }


// ===== New Reverb visual (approved "Redrawn 1 · Woven"): drawn by code, coloured per instrument =====
const NFX_REVERB=(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
// ===== Reverb base picture, redrawn by code at 2048px (no photo) =====
// Same layout as the approved picture: dark centre, faint inner rings, a ring of square
// beads (~.40), thin bright rings, a wide glowing band of wispy light strands (.50-.72),
// an outer ring (~.77), scattered specks and a fine dotted rim (~.97).
// v: 1 faithful, 2 finer & crisper, 3 softer & glowier.
const RPAL={b:{deep:[18,58,125],body:[58,142,212],hi:[138,210,246],wh:[200,234,252]},
            g:{deep:[130,84,6],body:[236,172,38],hi:[255,218,112],wh:[255,238,196]}};
function genRev(v,colKey){
  const N=2048,H=N/2,P=RPAL[colKey],TAU=Math.PI*2;
  let seed=4242+v*31;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const GAIN=1.45;const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.max(0,Math.min(1,a))})`;const ga=a=>Math.min(1,a*GAIN);
  const mixc=(a,b,k)=>a.map((x,i)=>x+(b[i]-x)*k);
  const mk=()=>{const c=document.createElement('canvas');c.width=c.height=N;return c;};
  const crisp=mk(),g=crisp.getContext('2d');g.lineCap='round';g.globalCompositeOperation='lighter';
  const fine=v===2?.8:v===3?1.15:1;                    // line weight
  // brightness around the ring: brighter on the left and lower right, like the original
  const br=th=>{const a=.5+.5*Math.cos(th-Math.PI),b=.5+.5*Math.cos(th-.9);return .35+.45*Math.pow(a,1.5)+.35*Math.pow(b,2);};
  const circle=(cx,cy,r,w,col,al,seg=1)=>{if(seg<=1){g.strokeStyle=rgba(col,ga(al));g.lineWidth=w;g.beginPath();g.arc(H+cx*H,H+cy*H,r*H,0,TAU);g.stroke();return;}
    for(let i=0;i<seg;i++){const a0=i/seg*TAU,a1=(i+1.02)/seg*TAU;g.strokeStyle=rgba(col,ga(al*br((a0+a1)/2)));g.lineWidth=w;g.beginPath();g.arc(H+cx*H,H+cy*H,r*H,a0,a1);g.stroke();}};
  const dashRing=(r,n,duty,w,col,al)=>{for(let i=0;i<n;i++){const a0=i/n*TAU,a1=a0+duty*TAU/n;g.strokeStyle=rgba(col,ga(al*br((a0+a1)/2)));g.lineWidth=w;g.beginPath();g.arc(H,H,r*H,a0,a1);g.stroke();}};
  const dots=(r,n,sz,col,al,skip=0)=>{for(let i=0;i<n;i++){if(rnd()<skip)continue;const th=(i+.5)/n*TAU;g.fillStyle=rgba(col,ga(al*br(th)));g.beginPath();g.arc(H+Math.cos(th)*r*H,H+Math.sin(th)*r*H,sz,0,TAU);g.fill();}};
  const bead=(th,r,lr,lt,col,al)=>{const x=H+Math.cos(th)*r*H,y=H+Math.sin(th)*r*H;g.save();g.translate(x,y);g.rotate(th);g.fillStyle=rgba(col,al);
    g.beginPath();g.roundRect(-lr/2,-lt/2,lr,lt,Math.min(lr,lt)*.25);g.fill();g.restore();};
  const arc=(cx,cy,r,a0,len,w,col,al)=>{const n=Math.max(8,Math.round(len*60));for(let i=0;i<n;i++){const t0=a0+len*i/n,t1=a0+len*(i+1.05)/n,f=Math.sin(Math.PI*(i+.5)/n);
    g.strokeStyle=rgba(col,ga(al*Math.pow(f,.6)*br((t0+t1)/2)));g.lineWidth=w;g.beginPath();g.arc(H+cx*H,H+cy*H,r*H,t0,t1);g.stroke();}};
  const mid=mixc(P.body,P.hi,.45);
  // inner rings: thin lines, a fine dotted ring, a ring of small square beads (~.40)
  for(const [r,w,al] of [[.262,1.6,.16],[.29,2.2,.22],[.318,1.4,.2],[.37,2.6,.22]])circle(0,0,r,w*fine,mixc(P.deep,P.body,.6),al,64);
  dots(.344,320,1.6*fine,P.body,.45,.1);
  for(let i=0;i<200;i++){if(rnd()<.12)continue;const th=(i+.5)/200*TAU;bead(th,.402,11*fine,8*fine,mid,.8*br(th)*(.7+.3*rnd()));}
  circle(0,0,.428,1.6*fine,P.body,.4,64);
  dashRing(.468,140,.55,3*fine,mid,.55);
  circle(0,0,.498,2*fine,mid,.5,64);
  // a ring of larger beads, bright only where the ring is lit
  for(let i=0;i<120;i++){const th=(i+.5)/120*TAU,b=br(th);if(b<.55||rnd()<.25)continue;bead(th,.565,16*fine,10*fine,mixc(P.body,P.hi,.7),.95*b);}
  // the glowing band: soft light strands
  const strands=v===2?150:v===3?110:130;
  for(let i=0;i<strands;i++){const r0=.5+.26*Math.pow(rnd(),.9),cx=(rnd()-.5)*.03,cy=(rnd()-.5)*.03,a0=rnd()*TAU,len=.4+rnd()*2,k=2+Math.floor(rnd()*4),ph=rnd()*TAU;
    const al=.03+.09*rnd()*br(a0+len/2),col=mixc(P.body,P.hi,rnd()*.6);g.strokeStyle=rgba(col,ga(al*1.3));g.lineWidth=(1.2+2.4*rnd())*fine;g.beginPath();
    for(let j=0;j<=40;j++){const th=a0+len*j/40,r=r0+.008*Math.sin(k*th+ph),x=H+(cx+Math.cos(th)*r)*H,y=H+(cy+Math.sin(th)*r)*H;j?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
  // crisp orbit rings, some off-centre so they cross each other
  for(const [r,cx,cy,w,al] of [[.6,0,0,2.4,.55],[.635,0,0,1.4,.35],[.68,0,0,2,.45],[.745,0,0,1.6,.35]])circle(cx,cy,r,w*fine,mid,al,128);
  for(const [r,cx,cy,a0,len,w,al] of [[.66,.06,.03,3.6,2.6,2.4,.55],[.7,-.05,.04,5.2,2.4,2,.5],[.62,.04,-.06,.6,2.2,2,.45],[.74,-.03,-.05,2.0,2.8,1.8,.42],[.58,-.06,.02,1.2,2,1.8,.4],[.79,.04,.02,4.2,2.2,1.6,.32]])
    arc(cx,cy,r,a0,len,w*1.3*fine,mixc(P.body,P.hi,.6),al*1.35);
  // outer ring and faint outer arcs
  circle(0,0,.78,2.6*fine,mixc(P.body,P.hi,.3),.4,96);circle(0,0,.815,1.2*fine,P.body,.2,64);
  dashRing(.85,90,.35,2*fine,P.body,.22);
  for(let i=0;i<40;i++){const r0=.8+.1*rnd(),a0=rnd()*TAU,len=.3+rnd()*1.2;g.strokeStyle=rgba(P.body,.04+.08*rnd()*br(a0+len/2));g.lineWidth=(.8+1.2*rnd())*fine;g.beginPath();g.arc(H,H,r0*H,a0,a0+len);g.stroke();}
  // faint spokes (like the crosshair line in the original) and short radial ticks
  for(const th of [0,Math.PI,Math.PI*.5,Math.PI*1.5,.8,3.9]){const gr=g.createLinearGradient(H+Math.cos(th)*.3*H,H+Math.sin(th)*.3*H,H+Math.cos(th)*.92*H,H+Math.sin(th)*.92*H);
    gr.addColorStop(0,rgba(P.body,0));gr.addColorStop(.4,rgba(P.body,.16));gr.addColorStop(1,rgba(P.body,0));g.strokeStyle=gr;g.lineWidth=1.3*fine;g.beginPath();
    g.moveTo(H+Math.cos(th)*.3*H,H+Math.sin(th)*.3*H);g.lineTo(H+Math.cos(th)*.92*H,H+Math.sin(th)*.92*H);g.stroke();}
  for(let i=0;i<46;i++){const r=.45+.38*rnd(),th=rnd()*TAU,L=.012+.035*rnd();g.strokeStyle=rgba(mid,.25+.3*rnd());g.lineWidth=1.3*fine;g.beginPath();
    g.moveTo(H+Math.cos(th)*r*H,H+Math.sin(th)*r*H);g.lineTo(H+Math.cos(th)*(r+L)*H,H+Math.sin(th)*(r+L)*H);g.stroke();}
  // specks
  for(let i=0;i<650;i++){const r=.38+.55*Math.pow(rnd(),1.2),th=rnd()*TAU;g.fillStyle=rgba(mixc(P.body,P.wh,rnd()*.6),(.15+.5*rnd())*(.4+.6*br(th)));
    g.beginPath();g.arc(H+Math.cos(th)*r*H,H+Math.sin(th)*r*H,(.8+1.6*rnd()*rnd())*fine,0,TAU);g.fill();}
  // fine dotted rim
  dots(.968,300,1.8*fine,mixc(P.body,P.wh,.4),.55);
  // compose: soft haze + wide glow + tight glow + crisp detail
  const out=mk(),o=out.getContext('2d');o.fillStyle='#000';o.fillRect(0,0,N,N);o.globalCompositeOperation='lighter';
  const hzk=(v===2?.7:v===3?1.35:1)*1.45;
  for(const [r,s,al,col] of [[.63,.13,.30,P.deep],[.6,.06,.16,P.body],[.41,.035,.10,P.body],[.78,.05,.10,P.deep],[.32,.06,.07,P.deep]]){
    const gr=o.createRadialGradient(H,H,Math.max(0,r-3*s)*H,H,H,(r+3*s)*H),n=12;for(let i=0;i<=n;i++){const x=i/n,rr=r-3*s+6*s*x;gr.addColorStop(x,rgba(col,al*hzk*Math.exp(-Math.pow((rr-r)/s,2))));}
    o.fillStyle=gr;o.fillRect(0,0,N,N);}
  for(let i=0;i<10;i++){const th=i/10*TAU+.2,b=br(th),x=H+Math.cos(th)*.6*H,y=H+Math.sin(th)*.6*H,R=.26*H,gr=o.createRadialGradient(x,y,0,x,y,R);   // uneven brightness
    gr.addColorStop(0,rgba(P.body,.10*b*b*hzk));gr.addColorStop(1,rgba(P.body,0));o.fillStyle=gr;o.fillRect(x-R,y-R,2*R,2*R);}
  const blurOf=f=>{let src=crisp,s=N;const st=[];while(s>N/f){s/=2;const c=document.createElement('canvas');c.width=c.height=s;c.getContext('2d').drawImage(src,0,0,s,s);src=c;st.push(c);}
    for(let i=st.length-2;i>=0;i--){const c=st[i],cg=c.getContext('2d');cg.clearRect(0,0,c.width,c.width);cg.drawImage(st[i+1],0,0,c.width,c.width);}return st[0];};
  o.imageSmoothingQuality='high';
  const wide=blurOf(32),tight=blurOf(8),gw=v===2?.9:v===3?1.9:1.4,gt=v===2?.7:v===3?1.1:.95;
  o.globalAlpha=gw;o.drawImage(wide,0,0,N,N);o.globalAlpha=gt;o.drawImage(tight,0,0,N,N);o.globalAlpha=1;o.drawImage(crisp,0,0);
  o.globalCompositeOperation='source-over';
  // clean dark centre
  const hole=o.createRadialGradient(H,H,0,H,H,.3*H);hole.addColorStop(0,'rgba(0,0,0,1)');hole.addColorStop(.75,'rgba(0,0,0,1)');hole.addColorStop(1,'rgba(0,0,0,0)');o.fillStyle=hole;o.fillRect(0,0,N,N);
  return out;
}

RPAL.y={deep:[150,118,10],body:[248,212,58],hi:[255,236,140],wh:[255,246,200]};
RPAL.v={deep:[58,64,80],body:[168,178,198],hi:[226,232,246],wh:[246,248,255]};
RPAL.p={deep:[58,34,128],body:[150,118,240],hi:[206,186,255],wh:[240,232,255]};
function genRevW(v,colKey){
  // Redrawn 1 layout, but every line is drawn like the original: soft strands that are not
  // perfect circles, a little off-centre so they fork, cross and merge, fading in and out.
  const N=2048,H=N/2,P=RPAL[colKey],TAU=Math.PI*2;
  let seed=4242+v*31;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const GAIN=1.45;const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.max(0,Math.min(1,a))})`;const ga=a=>Math.min(1,a*GAIN);
  const mixc=(a,b,k)=>a.map((x,i)=>x+(b[i]-x)*k);
  const mk=()=>{const c=document.createElement('canvas');c.width=c.height=N;return c;};
  const crisp=mk(),g=crisp.getContext('2d');g.lineCap='round';g.globalCompositeOperation='lighter';
  const fine=v===2?.8:v===3?1.15:1;                    // line weight
  // brightness around the ring: brighter on the left and lower right, like the original
  const br=th=>{const a=.5+.5*Math.cos(th-Math.PI),b=.5+.5*Math.cos(th-.9);return .35+.45*Math.pow(a,1.5)+.35*Math.pow(b,2);};
  const strand=(R,e,phi,cx,cy,w0,col,al,a0=0,len=TAU)=>{const k1=2+Math.floor(rnd()*3),k2=3+Math.floor(rnd()*4),s1=rnd()*TAU,s2=rnd()*TAU,ph=rnd()*TAU,wob=.003+.003*rnd();
    const rr=th=>R*(1+e*Math.cos(th-phi))+wob*Math.sin(3*th+ph);
    const vis=th=>{const x=.5+.5*Math.sin(k1*th+s1)*Math.cos(k2*th+s2)+.25*Math.sin(th+s2);return Math.max(0,Math.min(1,(x-.15)/.55));};
    const n=Math.max(24,Math.round(len*60));
    for(const [wm,am] of [[5,.07],[2.4,.2],[1,.8]]){g.lineWidth=w0*wm;for(let i=0;i<n;i++){const t0=a0+len*i/n,t1=a0+len*(i+1.1)/n,tm=(t0+t1)/2,
      ends=len<TAU-.01?Math.pow(Math.sin(Math.PI*(i+.5)/n),.6):1,a=ga(al)*am*vis(tm)*br(tm)*ends;if(a<.004)continue;g.strokeStyle=rgba(col,a);g.beginPath();
      g.moveTo(H+(cx+Math.cos(t0)*rr(t0))*H,H+(cy+Math.sin(t0)*rr(t0))*H);g.lineTo(H+(cx+Math.cos(t1)*rr(t1))*H,H+(cy+Math.sin(t1)*rr(t1))*H);g.stroke();}}};
  // a "circle" becomes a small braid of 2-3 strands that drift apart and cross
  const circle=(cx,cy,r,w,col,al)=>{const n=2+(rnd()<.4?1:0);for(let j=0;j<n;j++)strand(r+(rnd()-.5)*.008,.006+.02*rnd()*(r/.6),rnd()*TAU,cx,cy,w*(.7+.5*rnd()),col,al*(.75+.4*rnd()));};
  const dashRing=(r,n,duty,w,col,al)=>{for(let i=0;i<n;i++){const a0=i/n*TAU,a1=a0+duty*TAU/n,rr=r+.004*Math.sin(a0*2+1);for(const [wm,am] of [[3,.15],[1,.85]]){g.strokeStyle=rgba(col,ga(al*am*br((a0+a1)/2)));g.lineWidth=w*wm;g.beginPath();g.arc(H,H,rr*H,a0,a1);g.stroke();}}};
  const dots=(r,n,sz,col,al,skip=0)=>{for(let i=0;i<n;i++){if(rnd()<skip)continue;const th=(i+.5)/n*TAU;g.fillStyle=rgba(col,ga(al*br(th)));g.beginPath();g.arc(H+Math.cos(th)*r*H,H+Math.sin(th)*r*H,sz,0,TAU);g.fill();}};
  const bead=(th,r,lr,lt,col,al)=>{const rr=r+.003*Math.sin(th*2+1),x=H+Math.cos(th)*rr*H,y=H+Math.sin(th)*rr*H,s=(lr+lt)/4,gr=g.createRadialGradient(x,y,0,x,y,s*2.3);
    gr.addColorStop(0,rgba(mixc(col,P.wh,.3),Math.min(1,al)));gr.addColorStop(.45,rgba(col,al*.5));gr.addColorStop(1,rgba(col,0));g.fillStyle=gr;g.fillRect(x-s*2.3,y-s*2.3,s*4.6,s*4.6);};
  const arc=(cx,cy,r,a0,len,w,col,al)=>strand(r,.01+.015*rnd(),rnd()*TAU,cx,cy,w,col,al,a0,len);
  const mid=mixc(P.body,P.hi,.45);
  // inner rings: thin lines, a fine dotted ring, a ring of small square beads (~.40)
  for(const [r,w,al] of [[.262,1.6,.16],[.29,2.2,.22],[.318,1.4,.2],[.37,2.6,.22]])circle(0,0,r,w*fine,mixc(P.deep,P.body,.6),al,64);
  dots(.344,320,1.6*fine,P.body,.45,.1);
  for(let i=0;i<200;i++){if(rnd()<.12)continue;const th=(i+.5)/200*TAU;bead(th,.402,11*fine,8*fine,mid,.8*br(th)*(.7+.3*rnd()));}
  circle(0,0,.428,1.6*fine,P.body,.4,64);
  dashRing(.468,140,.55,3*fine,mid,.55);
  circle(0,0,.498,2*fine,mid,.5,64);
  // a ring of larger beads, bright only where the ring is lit
  for(let i=0;i<120;i++){const th=(i+.5)/120*TAU,b=br(th);if(b<.55||rnd()<.25)continue;bead(th,.565,16*fine,10*fine,mixc(P.body,P.hi,.7),.95*b);}
  // the glowing band: soft light strands
  const strands=v===2?150:v===3?110:130;
  for(let i=0;i<strands;i++){const r0=.5+.26*Math.pow(rnd(),.9),cx=(rnd()-.5)*.03,cy=(rnd()-.5)*.03,a0=rnd()*TAU,len=.4+rnd()*2,k=2+Math.floor(rnd()*4),ph=rnd()*TAU;
    const al=.03+.09*rnd()*br(a0+len/2),col=mixc(P.body,P.hi,rnd()*.6);g.strokeStyle=rgba(col,ga(al*1.3));g.lineWidth=(1.2+2.4*rnd())*fine;g.beginPath();
    for(let j=0;j<=40;j++){const th=a0+len*j/40,r=r0+.008*Math.sin(k*th+ph),x=H+(cx+Math.cos(th)*r)*H,y=H+(cy+Math.sin(th)*r)*H;j?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
  // crisp orbit rings, some off-centre so they cross each other
  for(const [r,cx,cy,w,al] of [[.6,0,0,2.4,.55],[.635,0,0,1.4,.35],[.68,0,0,2,.45],[.745,0,0,1.6,.35]])circle(cx,cy,r,w*fine,mid,al,128);
  for(const [r,cx,cy,a0,len,w,al] of [[.66,.06,.03,3.6,2.6,2.4,.55],[.7,-.05,.04,5.2,2.4,2,.5],[.62,.04,-.06,.6,2.2,2,.45],[.74,-.03,-.05,2.0,2.8,1.8,.42],[.58,-.06,.02,1.2,2,1.8,.4],[.79,.04,.02,4.2,2.2,1.6,.32]])
    arc(cx,cy,r,a0,len,w*1.3*fine,mixc(P.body,P.hi,.6),al*1.35);
  // outer ring and faint outer arcs
  circle(0,0,.78,2.6*fine,mixc(P.body,P.hi,.3),.4,96);circle(0,0,.815,1.2*fine,P.body,.2,64);
  dashRing(.85,90,.35,2*fine,P.body,.22);
  for(let i=0;i<40;i++){const r0=.8+.1*rnd(),a0=rnd()*TAU,len=.3+rnd()*1.2;g.strokeStyle=rgba(P.body,.04+.08*rnd()*br(a0+len/2));g.lineWidth=(.8+1.2*rnd())*fine;g.beginPath();g.arc(H,H,r0*H,a0,a0+len);g.stroke();}
  // faint spokes (like the crosshair line in the original) and short radial ticks
  for(const th of [0,Math.PI,Math.PI*.5,Math.PI*1.5,.8,3.9]){const gr=g.createLinearGradient(H+Math.cos(th)*.3*H,H+Math.sin(th)*.3*H,H+Math.cos(th)*.92*H,H+Math.sin(th)*.92*H);
    gr.addColorStop(0,rgba(P.body,0));gr.addColorStop(.4,rgba(P.body,.16));gr.addColorStop(1,rgba(P.body,0));g.strokeStyle=gr;g.lineWidth=1.3*fine;g.beginPath();
    g.moveTo(H+Math.cos(th)*.3*H,H+Math.sin(th)*.3*H);g.lineTo(H+Math.cos(th)*.92*H,H+Math.sin(th)*.92*H);g.stroke();}
  for(let i=0;i<46;i++){const r=.45+.38*rnd(),th=rnd()*TAU,L=.012+.035*rnd();g.strokeStyle=rgba(mid,.25+.3*rnd());g.lineWidth=1.3*fine;g.beginPath();
    g.moveTo(H+Math.cos(th)*r*H,H+Math.sin(th)*r*H);g.lineTo(H+Math.cos(th)*(r+L)*H,H+Math.sin(th)*(r+L)*H);g.stroke();}
  // specks
  for(let i=0;i<650;i++){const r=.38+.55*Math.pow(rnd(),1.2),th=rnd()*TAU;g.fillStyle=rgba(mixc(P.body,P.wh,rnd()*.6),(.15+.5*rnd())*(.4+.6*br(th)));
    g.beginPath();g.arc(H+Math.cos(th)*r*H,H+Math.sin(th)*r*H,(.8+1.6*rnd()*rnd())*fine,0,TAU);g.fill();}
  // fine dotted rim
  dots(.968,300,1.8*fine,mixc(P.body,P.wh,.4),.55);
  // compose: soft haze + wide glow + tight glow + crisp detail
  const out=mk(),o=out.getContext('2d');o.fillStyle='#000';o.fillRect(0,0,N,N);o.globalCompositeOperation='lighter';
  const hzk=(v===2?.7:v===3?1.35:1)*1.45;
  for(const [r,s,al,col] of [[.63,.13,.30,P.deep],[.6,.06,.16,P.body],[.41,.035,.10,P.body],[.78,.05,.10,P.deep],[.32,.06,.07,P.deep]]){
    const gr=o.createRadialGradient(H,H,Math.max(0,r-3*s)*H,H,H,(r+3*s)*H),n=12;for(let i=0;i<=n;i++){const x=i/n,rr=r-3*s+6*s*x;gr.addColorStop(x,rgba(col,al*hzk*Math.exp(-Math.pow((rr-r)/s,2))));}
    o.fillStyle=gr;o.fillRect(0,0,N,N);}
  for(let i=0;i<10;i++){const th=i/10*TAU+.2,b=br(th),x=H+Math.cos(th)*.6*H,y=H+Math.sin(th)*.6*H,R=.26*H,gr=o.createRadialGradient(x,y,0,x,y,R);   // uneven brightness
    gr.addColorStop(0,rgba(P.body,.10*b*b*hzk));gr.addColorStop(1,rgba(P.body,0));o.fillStyle=gr;o.fillRect(x-R,y-R,2*R,2*R);}
  const blurOf=f=>{let src=crisp,s=N;const st=[];while(s>N/f){s/=2;const c=document.createElement('canvas');c.width=c.height=s;c.getContext('2d').drawImage(src,0,0,s,s);src=c;st.push(c);}
    for(let i=st.length-2;i>=0;i--){const c=st[i],cg=c.getContext('2d');cg.clearRect(0,0,c.width,c.width);cg.drawImage(st[i+1],0,0,c.width,c.width);}return st[0];};
  o.imageSmoothingQuality='high';
  const wide=blurOf(32),tight=blurOf(8),gw=v===2?.9:v===3?1.9:1.4,gt=v===2?.7:v===3?1.1:.95;
  o.globalAlpha=gw;o.drawImage(wide,0,0,N,N);o.globalAlpha=gt;o.drawImage(tight,0,0,N,N);o.globalAlpha=1;o.drawImage(crisp,0,0);
  o.globalCompositeOperation='source-over';
  // clean dark centre
  const hole=o.createRadialGradient(H,H,0,H,H,.3*H);hole.addColorStop(0,'rgba(0,0,0,1)');hole.addColorStop(.75,'rgba(0,0,0,1)');hole.addColorStop(1,'rgba(0,0,0,0)');o.fillStyle=hole;o.fillRect(0,0,N,N);
  return out;
}


// ===== Match the light distribution of the original picture =====
// The motion lights the picture by multiplying it, so if any ring is brighter in the base picture
// than in the original, it stays bright all the time. Here every redrawn picture is brought to the
// original's brightness ring by ring (average and highlights), so light flows exactly like the original.
const ORIG_STATS={"B": [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.01, 0.11, 0.09, 0.02, 0.01, 0.13, 0.37, 1.8, 4.25, 8.97, 13.73, 18.22, 24.68, 30.11, 40.38, 50.76, 44.82, 48.48, 79.53, 80.39, 65.61, 57.04, 51.71, 52.18, 62.81, 87.77, 118.76, 111.78, 97.32, 106.44, 113.37, 128.61, 146.86, 128.68, 106.1, 86.56, 72.45, 60.62, 53.38, 54.68, 55.93, 65.45, 62.82, 47.55, 36.05, 27.23, 21.03, 16.98, 13.54, 11.52, 7.9, 9.02, 7.65, 9.92, 3.48, 2.01, 1.2, 0.64], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 3.0, 3.0, 1.0, 1.0, 3.0, 5.0, 9.0, 11.0, 22.0, 25.0, 34.0, 38.0, 61.0, 89.0, 91.0, 65.0, 90.0, 164.8, 144.0, 106.0, 90.0, 76.0, 82.0, 116.0, 155.0, 220.0, 235.2, 179.0, 161.0, 204.0, 216.0, 221.0, 195.0, 159.0, 132.0, 113.0, 93.0, 76.0, 100.0, 110.2, 122.0, 117.0, 96.0, 65.0, 45.0, 34.0, 26.0, 25.0, 28.0, 14.0, 41.0, 39.0, 48.0, 24.0, 6.0, 4.0, 3.0]], "G": [[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.03, 0.14, 0.04, 0.07, 0.1, 0.26, 0.58, 1.82, 3.67, 8.87, 13.85, 18.28, 24.81, 30.24, 40.32, 51.0, 44.8, 48.66, 79.68, 80.61, 65.74, 57.19, 51.79, 52.21, 62.97, 87.85, 118.89, 111.99, 97.49, 106.61, 113.7, 128.79, 147.2, 128.93, 106.37, 86.69, 72.59, 60.79, 53.53, 54.97, 56.09, 65.55, 62.91, 47.71, 36.14, 27.43, 21.08, 16.92, 13.53, 11.55, 7.57, 8.64, 7.06, 9.69, 2.99, 1.87, 1.38, 0.93], [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0, 1.0, 1.0, 2.0, 4.0, 8.0, 11.0, 22.0, 25.0, 35.0, 39.0, 63.2, 92.2, 93.0, 67.0, 91.0, 166.8, 146.9, 106.0, 91.0, 77.0, 82.1, 117.0, 156.0, 220.0, 237.0, 179.1, 160.0, 204.0, 218.0, 224.0, 198.0, 160.0, 134.0, 117.0, 94.0, 77.0, 103.0, 111.0, 124.0, 118.0, 97.0, 66.0, 46.0, 35.0, 29.0, 30.0, 34.0, 14.0, 55.0, 52.0, 65.0, 26.0, 5.0, 4.0, 3.0]]};
function matchOrig(cv,colKey){
  const N=cv.width,H=N/2,g=cv.getContext('2d'),im=g.getImageData(0,0,N,N),d=im.data,NB=64,[om,op]=ORIG_STATS.B;
  const binOf=new Float32Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){binOf[y*N+x]=Math.hypot(x-H+.5,y-H+.5)/H/1.05*NB;}
  for(let pass=0;pass<3;pass++){
    const sum=new Float64Array(NB),cnt=new Float64Array(NB),hist=[...Array(NB)].map(()=>new Uint32Array(256));
    for(let i=0,p=0;p<N*N;p+=3,i=p*4){const b=Math.floor(binOf[p]);if(b>=NB)continue;const m=Math.max(d[i],d[i+1],d[i+2]);sum[b]+=m;cnt[b]++;hist[b][m]++;}
    const gain=new Float32Array(NB),lim=new Float32Array(NB);
    for(let b=0;b<NB;b++){const mean=cnt[b]?sum[b]/cnt[b]:0;let acc=0,q=255;const tgt=cnt[b]*.99;for(let v=0;v<256;v++){acc+=hist[b][v];if(acc>=tgt){q=v;break;}}
      gain[b]=mean>.5?Math.max(.15,Math.min(3,om[b]/mean)):1;lim[b]=Math.max(4,op[b]*1.04);}
    for(let p=0;p<N*N;p++){const i=p*4,f=binOf[p];if(f>=NB-1)continue;const b0=Math.floor(f),t=f-b0,b1=Math.min(NB-1,b0+1);
      const gn=gain[b0]+(gain[b1]-gain[b0])*t,L=lim[b0]+(lim[b1]-lim[b0])*t,m=Math.max(d[i],d[i+1],d[i+2]);if(m<1)continue;
      let m1=m*gn;const k0=L*.65;if(m1>k0)m1=k0+(L-k0)*Math.tanh((m1-k0)/(L-k0));const s=m1/m;
      let R0=d[i]*s,G0=d[i+1]*s,B0=d[i+2]*s;
      if(colKey==='b'){G0=Math.min(G0,B0*.86);R0=Math.min(R0,B0*.68);}else if(colKey==='g'){G0=Math.min(G0,R0*.9);B0=Math.min(B0,R0*.6);}else if(colKey==='y'){G0=Math.min(G0,R0*.92);B0=Math.min(B0,R0*.45);}else if(colKey==='p'){G0=Math.min(G0,B0*.78);R0=Math.min(R0,B0*.95);}   // keep the hue: no teal/green drift
      d[i]=Math.min(255,R0);d[i+1]=Math.min(255,G0);d[i+2]=Math.min(255,B0);}
  }
  g.putImageData(im,0,0);return cv;
}

const VS=`attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const FS=`precision highp float;
varying vec2 v;
uniform sampler2D T;uniform float uT,uA;uniform vec3 uTint;
uniform vec4 uP[10];   // birth time, strength, active, sustain
uniform vec4 uQ[10];   // origin x, origin y, direction, direction bias
uniform vec4 uR[10];   // speed factor, width factor
const float HOLE=.30,OUTER=.98;
vec3 tex(float r,float th){vec2 q=vec2(cos(th),sin(th))*r*.5+.5;
  if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)return vec3(0.);return texture2D(T,vec2(q.x,1.-q.y)).rgb;}
// The rings of the picture are separate layers: each turns at its own slow pace (depth).
float layerTurn(float r,float t){
  float w1=smoothstep(.48,.44,r),w3=smoothstep(.68,.72,r),w2=1.-w1-w3;
  return t*(.022*w1-.014*w2+.009*w3)+.02*sin(t*.07)*w2;
}
void main(){
  vec2 p=v*2.-1.;float r=length(p),th=atan(p.y,p.x),a=uA;
  float reach=HOLE+(OUTER+.05-HOLE)*pow(a,.8);
  float room=smoothstep(reach+.16,reach-.12,r+.03*sin(th*3.+uT*.25)+.02*sin(th*7.-uT*.4));
  float tau=.4+2.4*a;                                      // how long each ring keeps sounding
  float sp0=.36-.1*a;
  float E=0.,H=0.,disp=0.;                                 // E: all sound energy, H: fresh wave fronts only
  for(int i=0;i<10;i++){
    vec4 P=uP[i];if(P.z<.5)continue;
    vec4 Q=uQ[i];vec4 Rr=uR[i];
    float age=uT-P.x,s=P.y,sp=sp0*Rr.x;
    vec2 q=p-Q.xy;float rq=length(q),tq=atan(q.y,q.x);    // each note starts a little off-centre
    float dirw=1.+Q.w*cos(tq-Q.z);                         // and carries more to one side
    float f=HOLE*.85+sp*age+.025*sin(tq*2.+P.x)*min(age,1.); // fronts are never perfect circles
    float alive=smoothstep(reach+.1,reach-.04,f);
    float d=rq-f,w=(.004+.006*a)*Rr.y;
    float pk=exp(-d*d/w)*dirw;
    disp+=s*pk*alive*(.004+.006*a)*sin(d*26./Rr.y);
    E+=s*pk*alive*1.5;H+=s*pk*alive;
    float since=age-(rq-HOLE*.85)/sp;
    if(since>0.){float ring=exp(-since/(tau*(.7+.6*P.w)))*(.72+.28*cos(since*2.4+r*10.))*(.75+.25*dirw);
      E+=s*ring*room*(.18+.32*a);disp+=s*ring*room*.0015*a*sin(since*1.8+th*2.);}
    float back=age-(reach-HOLE*.85)/sp;
    if(back>0.&&a>.05){float f2=reach-sp*.8*back,d2=rq-f2,pk2=exp(-d2*d2/(w*1.6));
      float k=s*.55*a*exp(-back/tau)*(1.+Q.w*cos(tq-Q.z-3.1416));E+=k*pk2;disp+=k*pk2*.005*sin(d2*26.);}
  }
  float body=smoothstep(HOLE-.02,HOLE+.18,r);
  float Ec=E/(1.+.6*E),Hc=H/(1.+H);
  // slow layer: the whole chamber breathes very gently
  disp+=body*((.0012+.0024*a)*sin(4.*th+uT*.22+r*9.)*(.6+.4*Ec)+.0007*a*sin(7.*th-uT*.3+r*18.));
  float th2=th+layerTurn(r,uT)+.006*sin(uT*.15+r*7.)*(.4+a);
  float rr=r-disp;
  vec3 col=tex(rr,th2);
  vec3 wash=vec3(0.);float ws=0.;float k=.002+.0075*a;
  for(int j=1;j<=12;j++){float fj=float(j),wj=exp(-fj*(.42-.2*a));wash+=tex(rr*(1.-fj*k),th2+fj*.002)*wj;ws+=wj;}
  wash/=ws;
  vec3 ghost=tex(rr*.93,th2+.01)*.55+tex(rr*.86,th2-.015)*.3;
  float dry=.07+.05*a;
  float wet=room*(.22+.3*a)+Ec*(.45+.45*a);
  vec3 o=col*(dry+wet)+wash*room*(.06+.36*a)*(.5+Ec)+ghost*room*a*(.12+.25*Ec);
  o+=uTint*(Ec*room*.06*(.4+a)+room*.03*a*a);
  o=1.-exp(-o*1.15);
  // tone, same hue only: fresh wave fronts read lighter and a touch airier,
  // the lingering tail reads deeper and richer, quiet areas sink into shadow
  float lum=dot(o,vec3(.299,.587,.114));
  float sat=1.12-.32*Hc;
  o=mix(vec3(lum),o,sat);
  o*=.9+.28*Hc;
  o=pow(max(o,0.),vec3(1.06-.12*Ec));
  float vig=smoothstep(1.45,.8,r);
  gl_FragColor=vec4(o*vig,1.);
}`;

function makeGL(cv,img,tint){
  const gl=cv.getContext('webgl',{premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl)return null;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  const U=n=>gl.getUniformLocation(pr,n);
  return {gl,uT:U('uT'),uA:U('uA'),uTint:U('uTint'),uP:U('uP'),uQ:U('uQ'),uR:U('uR'),tint:tint.map(x=>x/255)};
}

// The source is a singing line, not a metronome: phrases of notes with uneven gaps,
// strong and soft notes, some held, rests between phrases, each phrase leaning a different way.
const pulses=[];const seq={next:0,left:0,base:.7,dir:0};
function emit(t,a){
  if(t<seq.next)return false;
  if(seq.left<=0){seq.left=4+Math.floor(Math.random()*5);seq.base=.55+Math.random()*.3;seq.dir=Math.random()*Math.PI*2;
    seq.next=t+.9+Math.random()*1.5;return false;}                          // a breath between phrases
  seq.left--;
  const held=Math.random()<.22,last=seq.left===0;
  const s=Math.min(1.15,seq.base*(.75+Math.random()*.5)*(last?1.25:1));
  seq.base=Math.min(1,seq.base+.04);                                       // phrases swell a little
  pulses.push({t,s,held,ox:(Math.random()-.5)*.08,oy:(Math.random()-.5)*.08,dir:seq.dir+(Math.random()-.5)*1.1,
    bias:.2+Math.random()*.35,spd:held?.72:.85+Math.random()*.35,wid:held?1.8:.8+Math.random()*.5});
  seq.dir+=(Math.random()-.5)*.7;
  seq.next=t+(held?.95+Math.random()*.6:[.32,.45,.6,.78][Math.floor(Math.random()*4)]*(1+Math.random()*.2));
  while(pulses.length>10)pulses.shift();
  return s>.85;
}


// ===== Floating light motes =====
// Soft glowing specks, little music notes and tiny sparkles drift up out of the rings where the
// sound passes, sway slowly, twinkle and fade, like drifting light in a quiet hall. More reverb = more of them.
const motes=[];let moteAcc=0;
const GLYPHS=['♪','♫','♩','♬'];
function spawnMote(a,near){
  const HOLEr=.30,reach=.30+(.98+.05-.30)*Math.pow(a,.8);
  let r=HOLEr+.04+Math.random()*Math.max(.02,reach-HOLEr-.04),th=Math.random()*Math.PI*2;
  if(near){r=near.r+(Math.random()-.5)*.05;th=near.th+(Math.random()-.5)*.9;}
  const kind=Math.random(),type=kind<.58?'dot':kind<.85?'note':'star';
  motes.push({x:Math.cos(th)*r,y:Math.sin(th)*r,vx:0,vy:-.015-Math.random()*.02,
    age:0,life:4+Math.random()*4,size:type==='dot'?.007+Math.random()*.011:.036+Math.random()*.022,type,
    glyph:GLYPHS[Math.floor(Math.random()*GLYPHS.length)],sway:Math.random()*6.28,swaySp:.35+Math.random()*.4,
    rot:(Math.random()-.5)*.5,tw:Math.random()*6.28,glow:0,depth:Math.random()});
}
// Motes ride a slow swirling current inside the chamber and get nudged by every passing wave.
function updateMotes(dt,a,strong,t){
  const sp0=.36-.1*a;
  if(!reduce.matches){
    moteAcc+=dt*(a<=.01?0:2+16*a);
    while(moteAcc>=1){moteAcc--;if(motes.length<150)spawnMote(a);}
    if(strong&&a>.01){const p=pulses[pulses.length-1];   // a small flurry lifts off where the strong note leans
      for(let i=0;i<Math.round(3+7*a);i++)spawnMote(a,{r:.36+Math.random()*.25,th:p.dir});}
  }
  for(let i=motes.length-1;i>=0;i--){const m=motes[i];m.age+=dt;
    if(m.age>=m.life){motes.splice(i,1);continue;}
    const r=Math.hypot(m.x,m.y)||1e-4,ux=m.x/r,uy=m.y/r;
    // swirl: closer motes circle a little faster (depth), all drift slowly upward
    const om=(.05+.07*(1-m.depth))*(r<.6?1:.7);
    let vx=-uy*om*r+Math.sin(m.sway+m.age*m.swaySp)*.008,vy=ux*om*r+m.vy;
    // passing wave fronts give a soft outward push and a glint
    for(const p of pulses){const age=t-p.t;if(age<0)continue;
      const f=.30*.85+sp0*p.spd*age,dx=m.x-p.ox,dy=m.y-p.oy,dr=Math.hypot(dx,dy)-f;
      if(Math.abs(dr)<.05){const k=(1-Math.abs(dr)/.05)*p.s;m.vx+=ux*k*.18*dt*8;m.vy+=uy*k*.18*dt*8;m.glow=Math.max(m.glow,k);}}
    m.vx*=Math.exp(-dt*1.6);m.vy+=(-.02-m.vy)*(1-Math.exp(-dt*.8));
    m.x+=(vx+m.vx)*dt;m.y+=(vy)*dt;m.glow*=Math.exp(-dt*2.2);
  }
}
function drawMotes(cv,tint,a){
  const S=cv.width,g=cv.getContext('2d'),h=S/2;
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,S,S);g.globalCompositeOperation='lighter';
  const col=(al,k=0)=>`rgba(${Math.round(tint[0]+(255-tint[0])*k)},${Math.round(tint[1]+(255-tint[1])*k)},${Math.round(tint[2]+(255-tint[2])*k)},${al})`;
  for(const m of motes){
    const p=m.age/m.life,fade=Math.min(1,p*4)*Math.pow(1-p,1.4);
    const tw=.65+.35*Math.sin(m.tw+m.age*1.6);           // slow, gentle twinkle
    const edge=1-Math.max(0,Math.min(1,(Math.hypot(m.x,m.y)-.92)/.12));
    const al=edge*Math.min(1,fade*(tw+m.glow*.8)*(.5+.5*Math.min(1,a*1.5))*(.7+.3*(1-m.depth)));
    if(al<.01)continue;
    const x=h+m.x*h,y=h+m.y*h,s=m.size*h*(.75+.45*(1-m.depth))*(1+.25*m.glow);
    // soft halo
    const R=s*(m.type==='dot'?4:2.2),gr=g.createRadialGradient(x,y,0,x,y,R);
    gr.addColorStop(0,col(al*.55,.3));gr.addColorStop(1,col(0));
    g.fillStyle=gr;g.beginPath();g.arc(x,y,R,0,Math.PI*2);g.fill();
    if(m.type==='dot'){g.fillStyle=col(al,.75);g.beginPath();g.arc(x,y,s*.6,0,Math.PI*2);g.fill();}
    else if(m.type==='note'){
      g.save();g.translate(x,y);g.rotate(m.rot+Math.sin(m.sway+m.age*.6)*.15);
      // drawn as a shape, so it looks the same on every computer
      const an=Math.min(1,al*1.5);g.shadowColor=col(an,.3);g.shadowBlur=s*1.1;g.fillStyle=col(an,.85);g.strokeStyle=col(an,.85);g.lineWidth=Math.max(1.4,s*.11);
      const head=(hx,hy)=>{g.beginPath();g.ellipse(hx,hy,s*.27,s*.19,-.45,0,Math.PI*2);g.fill();};
      const stem=(sx,sy)=>{g.beginPath();g.moveTo(sx,sy);g.lineTo(sx,sy-s*.95);g.stroke();};
      if(m.glyph==='♫'||m.glyph==='♬'){head(-s*.32,s*.42);head(s*.32,s*.3);stem(-s*.08,s*.38);stem(s*.56,s*.26);
        g.lineWidth=Math.max(1.5,s*.16);g.beginPath();g.moveTo(-s*.08,-s*.57);g.lineTo(s*.56,-s*.69);g.stroke();}
      else{head(0,s*.4);stem(s*.24,s*.36);g.beginPath();g.moveTo(s*.24,-s*.59);g.quadraticCurveTo(s*.62,-s*.35,s*.5,-s*.05);g.stroke();}
      g.restore();
    } else {
      // four-point sparkle
      const L=s*.9;g.strokeStyle=col(al,.85);g.lineWidth=Math.max(1,s*.08);g.beginPath();
      g.moveTo(x-L,y);g.lineTo(x+L,y);g.moveTo(x,y-L);g.lineTo(x,y+L);g.stroke();
      g.fillStyle=col(al,.9);g.beginPath();g.arc(x,y,s*.14,0,Math.PI*2);g.fill();
    }
  }
  g.globalCompositeOperation='source-over';
}
const TINTS={y:[255,222,70],g:[242,182,50],b:[63,167,255],v:[214,222,236],p:[186,150,255]};
const tex={};let gc=null,G=null,cur=null,wet=0,clock=0,mc=null,out=null;
function texFor(k){if(tex[k])return tex[k];const big=genRevW(1,k),c=document.createElement('canvas');c.width=c.height=1024;
  const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(big,0,0,1024,1024);return tex[k]=matchOrig(c,k);}
function render(k,target,dt){
  if(!gc){gc=document.createElement('canvas');gc.width=gc.height=256;mc=document.createElement('canvas');mc.width=mc.height=512;out=document.createElement('canvas');out.width=out.height=512;}
  if(!G){try{G=makeGL(gc,texFor(k),TINTS[k]);cur=k;}catch(e){console.error(e);return null;}if(!G)return null;}
  if(cur!==k){const gl=G.gl;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,texFor(k));gl.generateMipmap(gl.TEXTURE_2D);G.tint=TINTS[k].map(x=>x/255);cur=k;}
  clock+=dt;const tau=target>wet?.3:1.0;wet+=(target-wet)*(1-Math.exp(-dt/tau));
  const strong=!reduce.matches&&emit(clock,wet);updateMotes(dt,wet,strong,clock);
  const arr=new Float32Array(40),aq=new Float32Array(40),ar=new Float32Array(40);
  pulses.forEach((p,i)=>{arr.set([p.t,p.s,1,p.held?1:0],i*4);aq.set([p.ox,p.oy,p.dir,p.bias],i*4);ar.set([p.spd,p.wid,0,0],i*4);});
  const gl=G.gl;gl.viewport(0,0,gc.width,gc.height);gl.uniform1f(G.uT,clock);gl.uniform1f(G.uA,wet);gl.uniform3fv(G.uTint,G.tint);gl.uniform4fv(G.uP,arr);gl.uniform4fv(G.uQ,aq);gl.uniform4fv(G.uR,ar);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  drawMotes(mc,TINTS[k],wet);
  const o=out.getContext('2d');o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation='source-over';o.clearRect(0,0,512,512);
  o.drawImage(gc,0,0,512,512);o.globalCompositeOperation='lighter';o.drawImage(mc,0,0);o.globalCompositeOperation='source-over';
  return out;
}
return {render,prepare:texFor};
})();

// ===== New Delay visual (approved "Aurora Band"): drawn by code, coloured per instrument =====
const NFX_DELAY=(()=>{
// ===== Base pictures for the delay rings (drawn by code at 2048px, no photos) =====
// Every variant puts its rings on the same radii the motion uses (.40 .54 .67 .81, dotted rim .962),
// and every ring is a circle-shaped sound wave: nothing points outward from the centre.
const RINGS=[.40,.54,.67,.81];
const PALS={b:{body:[70,160,255],core:[200,236,255],deep:[18,70,200],rim:[210,230,255]},
            g:{body:[255,184,60],core:[255,240,200],deep:[190,110,10],rim:[255,236,205]}};
function makeBaseA(variant,colKey){
  const N=2048,H=N/2,pal=PALS[colKey];
  let seed=1234+(variant===4?3:variant)*977;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mixc=(a,b,k)=>a.map((v,i)=>Math.round(v+(b[i]-v)*k));
  const crisp=document.createElement('canvas');crisp.width=crisp.height=N;const g=crisp.getContext('2d');
  g.lineCap='round';g.lineJoin='round';
  // a clean sound wave around each ring: a steady carrier whose loudness swells and fades (envelope).
  // Same wavelength on every ring; the envelope of ring k is the same sound, shifted a little (its echo).
  const M=1800,TAU=Math.PI*2;
  const ea=[rnd()*TAU,rnd()*TAU,rnd()*TAU];
  const envAt=th=>{const v=.5+.5*(.55*Math.sin(2*th+ea[0])+.3*Math.sin(3*th+ea[1])+.15*Math.sin(5*th+ea[2]));return .04+.96*Math.pow(v,2.2);};
  const Fk=RINGS.map(R=>Math.round(15*R/.40));
  const Wk=(k,th,ph=0)=>{const e=envAt(th-k*.45);return e*Math.sin(Fk[k]*th+ph+k*1.3);};
  const env=new Float32Array(M);
  const P=(r,th)=>[H+Math.cos(th)*r*H,H+Math.sin(th)*r*H];
  const strokeRing=(fn,width,col,al)=>{g.strokeStyle=rgba(col,al);g.lineWidth=width;g.beginPath();
    for(let i=0;i<=M;i++){const th=i/M*TAU,[x,y]=P(fn(th),th);i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.stroke();};
  const decay=k=>[1,.82,.66,.52][k];          // each repeat a little quieter (feedback)
  const amp=.022;
  // loudness at each point of each ring: a smooth phrase envelope with a little fine texture.
  // Ring k carries the same sound as ring 0, shifted by a fixed step and quieter: that is the delay.
  const level=(k,th,j=1)=>{const e=envAt(th-k*.45),f=.7+.3*Math.sin(23*th+k)*Math.sin(11*th+2);return Math.max(.06,Math.min(1,.08+.92*Math.pow(e,.7)*f*j));};
  const capsule=(th,r0,r1,w,col,al)=>{const [x0,y0]=P(r0,th),[x1,y1]=P(r1,th);g.strokeStyle=rgba(col,al);g.lineWidth=w;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();};
  const block=(th,r,len,wid,col,al)=>{const [x,y]=P(r+len/2,th);g.save();g.translate(x,y);g.rotate(th);g.fillStyle=rgba(col,al);
    const L=len*H,Wd=wid,rr=Math.min(2.5,Wd/3);g.beginPath();g.roundRect(-L/2,-Wd/2,L,Wd,rr);g.fill();g.restore();};
  if(variant===1){            // Echo bars: a small equaliser standing on each ring, each ring a quieter copy
    RINGS.forEach((R,k)=>{const d=decay(k),n=Math.round(96*R/.40);
      strokeRing(()=>R-.007,1.6,pal.body,.3);
      for(let i=0;i<n;i++){const th=(i+.5)/n*TAU,h=level(k,th,.88+.24*rnd()),top=R+.006+.085*h*(.55+.45*d);
        capsule(th,R,top,10,mixc(pal.body,pal.core,.15+.35*h),(.35+.65*h)*(.55+.45*d));
        if(h>.45)capsule(th,top,top+.0005,10,pal.core,.7*h*d);}});
  }else if(variant===2){      // Mirrored bars: the bars grow both ways from the ring, like a stereo meter
    RINGS.forEach((R,k)=>{const d=decay(k),n=Math.round(110*R/.40);
      for(let i=0;i<n;i++){const th=(i+.5)/n*TAU,h=level(k,th,.88+.24*rnd()),A=.005+.048*h*(.55+.45*d);
        capsule(th,R-A,R+A,8,mixc(pal.body,pal.core,.1+.4*h),(.3+.7*h)*(.55+.45*d));}});
  }else if(variant===3){      // LED meter: each column is a stack of small blocks; lit blocks show the level
    RINGS.forEach((R,k)=>{const d=decay(k),n=Math.round(84*R/.40),nb=6,bl=.0105,gap=.0045;
      for(let i=0;i<n;i++){const th=(i+.5)/n*TAU,h=level(k,th,.9+.2*rnd()),lit=Math.max(1,Math.round(h*nb*(.6+.4*d)));
        for(let b=0;b<nb;b++){const r=R-.018+b*(bl+gap),on=b<lit,top=b===lit-1;
          block(th,r,bl,13,on?mixc(pal.body,pal.core,top?.6:.1+.06*b):pal.body,on?(top?1:.6+.07*b)*(.65+.35*d):.09);}}});
  }else if(variant===4){      // Dot-matrix wave: dots sized by the loudness at that point
    RINGS.forEach((R,k)=>{const d=decay(k),n=Math.round(300*R/.40);
      for(let j=0;j<n;j++){const th=j/n*TAU,a=Math.min(1,Math.abs(Wk(k,th))*1.1);
        for(const row of [-1,0,1]){const rr=R+row*.011,s=(row?1.1:1.6)+(row?3:5.5)*a*d;
          if(row&&a<.3)continue;const [x,y]=P(rr,th);g.fillStyle=rgba(mixc(pal.body,pal.core,.25+.5*a),(.4+.6*a)*(.6+.4*d)*(row?.65:1));
          g.beginPath();g.arc(x,y,s,0,TAU);g.fill();}}});
  }else if(variant===5){      // Audio-editor waveform: dense hairlines, mirrored, bent around each ring
    RINGS.forEach((R,k)=>{const d=decay(k),n=Math.round(640*R/.40);
      for(let i=0;i<n;i++){const th=(i+.5)/n*TAU,e=envAt(th-k*.45),t=.5+.5*Math.abs(Math.sin(97*th+k)*Math.sin(41*th+1)),
        A=.002+.048*(.06+.94*e)*t*(.55+.45*d);
        capsule(th,R-A,R+A,1.6,mixc(pal.body,pal.core,.15+.4*e),(.35+.65*e)*(.6+.4*d));}
      strokeRing(()=>R,1,pal.core,.25*d);});
  }else if(variant===6){      // Stardust: a soft cloud of fine particles hugging each ring, wider where it is loud
    RINGS.forEach((R,k)=>{const d=decay(k),cnt=Math.round(6500*R/.40*(.6+.4*d));
      for(let i=0;i<cnt;i++){const th=rnd()*TAU,e=envAt(th-k*.45),u=Math.max(1e-6,rnd()),z=Math.sqrt(-2*Math.log(u))*Math.cos(TAU*rnd());
        const r=R+z*(.003+.024*e),al=Math.min(1,(.35+.8*e)*(1-Math.min(1,Math.abs(z)/2.6))*(.6+.4*d)),[x,y]=P(r,th);
        g.fillStyle=rgba(mixc(pal.body,pal.core,.2+.5*e*(1-Math.min(1,Math.abs(z)/2))),al);g.beginPath();g.arc(x,y,.7+1.5*rnd()*(1-Math.min(1,Math.abs(z)/3)),0,TAU);g.fill();}
      for(let i=0;i<60;i++){const th=rnd()*TAU,e=envAt(th-k*.45);if(e<.35)continue;const [x,y]=P(R+(rnd()-.5)*.02*e,th);
        g.fillStyle=rgba(pal.core,.9*d);g.beginPath();g.arc(x,y,2.4+2*rnd(),0,TAU);g.fill();}});
  }else if(variant===7){      // Beat dashes: one rhythm, repeated on every ring a step later and quieter
    const pat=[[3,1],[1,1],[1,1],[2,2],[1,1],[4,1],[1,3]],reps=4,unit=TAU/(23*reps);
    RINGS.forEach((R,k)=>{const d=decay(k);let a0=k*5*unit;
      for(let rep=0;rep<reps;rep++)for(const [len,gp] of pat){const th0=a0,th1=a0+len*unit-unit*.25,mid=(th0+th1)/2,e=.35+.65*envAt(mid);
        g.strokeStyle=rgba(mixc(pal.body,pal.core,.15+.45*e),(.35+.65*e)*(.5+.5*d));g.lineWidth=(4+5*len/4)*(.6+.4*d);
        g.beginPath();g.arc(H,H,R*H,th0,th1);g.stroke();a0+=(len+gp)*unit;}
      strokeRing(()=>R,1,pal.body,.15);});
  }else if(variant===8){      // Aurora band: a soft, wide ribbon of light that swells with the sound (no hard edges)
    RINGS.forEach((R,k)=>{const d=decay(k);
      for(let j=-10;j<=10;j++){const o=j/10,al=.16*Math.exp(-o*o*2.2)*(.6+.4*d);
        strokeRing(th=>R+.01*d*Wk(k,th)+o*(.008+.045*envAt(th-k*.45)),4.5,mixc(pal.body,pal.core,.2*(1-Math.abs(o))),al);}
      strokeRing(th=>R+.01*d*Wk(k,th),1.2,pal.core,.35*d);});
  }
  // dotted rim (same in all)
  for(let i=0;i<260;i++){const th=i/260*TAU,[x,y]=P(.962,th);g.fillStyle=rgba(pal.rim,.8);g.beginPath();g.arc(x,y,2.3,0,TAU);g.fill();}
  // compose: faint haze + wide glow + tight glow + crisp lines
  const cv=document.createElement('canvas');cv.width=cv.height=N;const o=cv.getContext('2d');o.fillStyle='#000';o.fillRect(0,0,N,N);
  const hz=o.createRadialGradient(H,H,.3*H,H,H,.9*H);hz.addColorStop(0,rgba(pal.deep,0));hz.addColorStop(.15,rgba(pal.deep,.12));hz.addColorStop(.6,rgba(pal.deep,.05));hz.addColorStop(1,rgba(pal.deep,0));
  o.fillStyle=hz;o.fillRect(0,0,N,N);
  const blurOf=f=>{let src=crisp,s=N;const st=[];while(s>N/f){s/=2;const c=document.createElement('canvas');c.width=c.height=s;c.getContext('2d').drawImage(src,0,0,s,s);src=c;st.push(c);}
    for(let i=st.length-2;i>=0;i--){const c=st[i],cg=c.getContext('2d');cg.clearRect(0,0,c.width,c.width);cg.drawImage(st[i+1],0,0,c.width,c.width);}return st[0];};
  o.globalCompositeOperation='lighter';o.imageSmoothingQuality='high';
  const wide=blurOf(32);o.globalAlpha=.8;o.drawImage(wide,0,0,N,N);o.globalAlpha=1;
  const tight=blurOf(8);o.drawImage(tight,0,0,N,N);
  o.drawImage(crisp,0,0);o.globalCompositeOperation='source-over';
  return cv;
}

PALS.y={body:[255,222,70],core:[255,246,190],deep:[170,130,10],rim:[255,240,190]};
PALS.v={body:[200,208,226],core:[246,248,255],deep:[64,72,92],rim:[236,240,250]};
PALS.p={body:[165,135,255],core:[236,228,255],deep:[66,40,160],rim:[230,220,255]};
PALS.g={body:[255,184,60],core:[255,240,200],deep:[190,110,10],rim:[255,236,205]};
const SPEC={
  A:{inner:.46,hole:.36,rings:[.66,.80,.95]},
  B:{inner:.40,hole:.30,rings:[.55,.69,.81,.97]},
  E:{inner:.40,hole:.30,rings:[.54,.67,.81,.965]}
};

const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const mk=()=>document.createElement('canvas');
const smooth=(a,b,v)=>{const x=Math.max(0,Math.min(1,(v-a)/(b-a)));return x*x*(3-2*x);};
const ease=x=>1-Math.pow(1-x,3);
// ===== Delay, rendered on the graphics card =====
// Same 0-100% logic as before: a springy light front follows the slider and each ring bangs on
// when it is reached; 85-100% builds to full power. New: the rings are jelly. Every ignition and
// every delayed repeat kicks a ring outward and it wobbles back (QQ bounce); repeats travel as
// a glowing packet from ring to ring instead of blinking; motes bounce outward on springs.
const VS=`attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const FS=`precision highp float;
varying vec2 v;
uniform sampler2D T;uniform float uT,uA,uDrive,uN;uniform vec3 uTint;
uniform float uRad[5],uEdge[6],uE[5],uF[5],uEc[5],uBump[5];
uniform vec4 uPk[8];      // travelling repeats: radius, strength, width, -
uniform vec4 uSh[6];      // shock rings: radius, strength, age, -
uniform vec2 uFront;      // light front: radius, speed
uniform float uCore;uniform float uRot[5];
vec3 tex(float r,float th){vec2 q=vec2(cos(th),sin(th))*r*.5+.5;
  if(q.x<0.||q.y<0.||q.x>1.||q.y>1.)return vec3(0.);return texture2D(T,vec2(q.x,1.-q.y)).rgb;}
float band(float r,int k){float a=uEdge[0],b=uEdge[1];
  for(int i=0;i<5;i++){if(i==k){a=uEdge[i];b=uEdge[i+1];}}
  float f=.035;return (k==0?1.:smoothstep(a-f,a+f,r))*smoothstep(b+f,b-f,r);}
void main(){
  vec2 p=v*2.-1.;float r=length(p),th=atan(p.y,p.x);
  // jelly: each ring is pushed out by its own spring, with a soft wobble around the circle
  float disp=0.,lit=0.,fl=0.,ec=0.,rot=0.;
  for(int k=0;k<5;k++){if(float(k)>=uN)break;
    float w=band(r,k);
    disp+=w*uBump[k]*(1.+.25*sin(3.*th+uT*.3+float(k)*1.7));
    float br=1.+.05*sin(uT*.5+float(k)*2.1)+.025*sin(uT*.21+float(k)*4.3);
    lit+=w*uE[k]*br;fl+=w*uF[k];ec+=w*uEc[k];rot+=w*uRot[k];}
  // delay waves: narrow, clear pulses that bend the picture as they pass (no drawn line)
  float wv=0.;
  for(int i=0;i<8;i++){vec4 P=uPk[i];if(P.y<=0.)continue;float d=r-P.x;float g=exp(-d*d/P.z);
    disp+=P.y*g*.009;wv+=P.y*g;}
  float rr=r/(1.+disp);
  float tr=th+rot;vec3 col=tex(rr,tr);
  // soft glow: a few radial taps around the sample
  vec3 glow=vec3(0.);
  for(int j=-3;j<=3;j++){float fj=float(j);glow+=tex(rr*(1.+fj*(.006+.004*uDrive)),tr+fj*.004);}
  glow/=7.;
  float lum=dot(col,vec3(.299,.587,.114));
  vec3 dorm=mix(vec3(lum),col,.35)*.55*(.13+.03*sin(uT*.4));
  float on=lit*(.85+.25*uDrive)+ec*.8;
  lit*=mix(uCore,1.,smoothstep(uRad[0]+.02,uRad[0]+.12,r));
  vec3 o=dorm*(1.-min(1.,lit))+col*on+glow*(on*.5+fl*1.1+ec*.5)*(1.+.25*uDrive);
  o+=mix(col,vec3(lum),.55)*fl*.7;                                   // white-hot flash at ignition
  // repeats travelling between rings
  // where a wave passes, the picture itself lights up a little (light carried by the sound)
  o+=col*wv*.9+glow*wv*.55+uTint*wv*(.05+.22*(1.-smoothstep(uRad[0]-.12,uRad[0]-.02,r)));
  // light front while dragging
  if(uFront.y>.03){float d=r-uFront.x;o+=uTint*min(.5,uFront.y*.35)*exp(-d*d/.0016);}
  // faint shock rings after a bang
  for(int i=0;i<6;i++){vec4 S=uSh[i];if(S.y<=0.)continue;float d=r-S.x;float w=.00006+.0012*S.z;
    o+=uTint*S.y*exp(-d*d/w)*.5;}
  // outer halo when the last ring is lit, ambient room light
  float last=uE[4]*step(4.5,uN)+uE[3]*step(uN,4.5);
  float ro=uRad[4]*step(4.5,uN)+uRad[3]*step(uN,4.5);
  float dh=r-ro;o+=uTint*last*(.22+.18*uDrive)*exp(-dh*dh/(.0016+.0012*uDrive));
  o+=uTint*(lit/uN)*(.035+.035*uDrive)*smoothstep(1.05,.3,r);
  o=1.-exp(-o*1.25);
  gl_FragColor=vec4(o*smoothstep(1.45,.75,r),1.);
}`;
function uploadTex(G,img){const gl=G.gl;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);gl.generateMipmap(gl.TEXTURE_2D);}
function makeGL(cv,img){
  const gl=cv.getContext('webgl',{antialias:false,preserveDrawingBuffer:true});if(!gl)return null;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);gl.useProgram(pr);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);
  for(const [k,vv] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,vv);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  uploadTex({gl},img);
  const U={};for(const n of ['uT','uA','uDrive','uN','uTint','uRad','uEdge','uE','uF','uEc','uBump','uPk','uSh','uFront','uCore','uRot'])U[n]=gl.getUniformLocation(pr,n);
  return {gl,U};
}
const tints={};
function tintOf(id,img){if(tints[id])return tints[id];
  const c=mk();c.width=c.height=64;const g=c.getContext('2d');g.drawImage(img,0,0,64,64);
  const d=g.getImageData(0,0,64,64).data;let r=0,gg=0,b=0,w=0;
  for(let i=0;i<d.length;i+=4){const m=Math.max(d[i],d[i+1],d[i+2]);if(m<90)continue;r+=d[i]*m;gg+=d[i+1]*m;b+=d[i+2]*m;w+=m;}
  return tints[id]=[r/w/255,gg/w/255,b/w/255];}

// ---------- shared music: phrases of notes; each note is repeated outward ring by ring ----------
const notes=[];const seqD={next:.4,left:0,base:.7};
function emitNote(t,a){
  if(a<=.005||t<seqD.next)return;
  if(seqD.left<=0){seqD.left=3+Math.floor(Math.random()*5);seqD.base=.55+Math.random()*.35;seqD.next=t+1.1+Math.random()*1.6;return;}
  seqD.left--;
  notes.push({t,s:Math.min(1,seqD.base*(.7+Math.random()*.5)*(seqD.left===0?1.2:1))});
  seqD.next=t+[.38,.5,.65,.85][Math.floor(Math.random()*4)]*(1+Math.random()*.25);
  while(notes.length&&t-notes[0].t>8)notes.shift();
}
const stepOf=a=>(.16+.34*a)*1.6;      // time for a repeat to travel one ring (follows the delay time)

// ---------- per panel state ----------
const PANELS=['A1','A2','A3','A4','A5','A6','B1','B2','B3','B5','B6','B7','B8'];
const P={};
function panelState(pid){
  if(P[pid])return P[pid];
  const sp=SPEC.E,radii=[sp.inner,...sp.rings],edges=[0];
  for(let i=0;i<radii.length-1;i++)edges.push((radii[i]+radii[i+1])/2);edges.push(1.08);
  return P[pid]={radii,edges,hole:sp.hole,n:radii.length,front:{r:null,v:0},full:false,
    ring:radii.map(()=>({on:false,e:0,v:0,flash:0,bump:0,bv:0,arrived:{}})),shocks:[],gl:null};
}
const PRE=.6;
function reachOf(a,radii,hole){const n=radii.length;if(a<=.004)return hole-.04;
  const x=Math.min(n-1e-6,a*(n+PRE)-PRE);
  if(x<0)return hole+(radii[0]-.002-hole)*((x+PRE)/PRE);
  const k=Math.floor(x),f=x-k,r0=radii[k]+.004,r1=k+1<n?radii[k+1]-.004:radii[k]+.07;return r0+(r1-r0)*f;}

function stepPanel(S,a,t,dt){
  const {radii,n,front:F,ring,shocks}=S,still=reduce.matches;
  const ar=Math.min(1,a/.85),goal=reachOf(ar,radii,S.hole);
  if(F.r===null)F.r=goal;
  if(still){F.r=goal;F.v=0;}else{for(let i=0,h=dt/4;i<4;i++){const acc=90*(goal-F.r)-13*F.v;F.v=Math.max(-1.6,Math.min(1.6,F.v+acc*h));F.r+=F.v*h;}}
  const kick=(k,s)=>{ring[k].bv+=s;};
  for(let k=0;k<n;k++){const s=ring[k];
    if(!s.on&&F.r>=radii[k]){s.on=true;s.flash=.3;kick(k,.35);shocks.push({r:radii[k],t0:t,s:.5});}
    else if(s.on&&F.r<radii[k]-.015)s.on=false;}
  if(a>=.97&&!S.full){S.full=true;ring.forEach((s,k)=>s.flashAt=t+k*.05);}
  if(a<.9)S.full=false;
  ring.forEach((s,k)=>{if(s.flashAt&&t>=s.flashAt){s.flashAt=0;if(s.on){s.flash=Math.max(s.flash,.75);s.v+=3.5;kick(k,.4);shocks.push({r:radii[k],t0:t,s:.8});}}});
  // delay waves: each note sends a clear pulse out from the centre, followed by its repeats
  const step=stepOf(a),fb=.42+.45*a,packets=[],speed=.3,limit=F.r+.05;
  for(const nt of notes){
    for(let j=0;j<4;j++){
      const str=nt.s*Math.pow(fb,j);if(str<.06)break;
      const age=t-(nt.t+j*step*.62);if(age<0)continue;
      const r=.1+speed*age;if(r>limit+.04)continue;
      const fade=Math.min(1,age*4)*(1-smooth(limit-.08,limit+.04,r));
      if(fade>.01)packets.push([r,str*fade*(.6+.3*Math.min(1,a*2)),.0007+.0005*a,0]);
      for(let k=0;k<n;k++){const key=nt.t+':'+j;
        if(ring[k].on&&r>=radii[k]&&!ring[k].arrived[key]){ring[k].arrived[key]=t;kick(k,.1*str);}}
    }
  }
  S.echo=ring.map((s,k)=>{let e=0;for(const nt of notes){const x=t-(nt.t+k*step);if(x<0||x>1.2)continue;e+=nt.s*Math.pow(fb,k)*Math.min(1,x*14)*Math.exp(-x/.3);}return s.on?e:0;});
  for(const s of ring){
    if(s.on){for(let i=0,h=dt/3;i<3;i++){const acc=55*(1-s.e)-10.5*s.v;s.v+=acc*h;s.e+=s.v*h;}}else{s.v=0;s.e+=(0-s.e)*(1-Math.exp(-dt/.25));}
    s.flash*=Math.exp(-dt/.24);
    // jelly spring for the ring's size: low damping = QQ bounce
    for(let i=0,h=dt/3;i<3;i++){const acc=-55*s.bump-8.5*s.bv;s.bv+=acc*h;s.bump+=s.bv*h;}
    if(still){s.e=s.on?1:0;s.flash=0;s.bump=0;s.bv=0;}
    for(const key in s.arrived)if(t-s.arrived[key]>9)delete s.arrived[key];
  }
  while(shocks.length&&t-shocks[0].t0>.7)shocks.shift();
  S.packets=packets.slice(-8);S.drive=smooth(.8,1,a);
}

// ---------- bouncy echo motes ----------
// Each mote springs outward one step per delay time (overshoots and settles: QQ bounce),
// squashes and stretches with its speed, and is followed by fading copies of where it was
// a delay time ago, two delay times ago... (visual echoes that move smoothly with it).
const dmotes=[];let dAcc=0;
function spawnD(){
  const th=Math.random()*Math.PI*2,r=.42+Math.random()*.38,k=Math.random();
  const type=k<.42?'dot':k<.66?'dash':k<.86?'note':'ring';
  dmotes.push({th,r,v:0,target:r,next:0,age:0,life:3.2+Math.random()*2.5,hist:[],type,beam:Math.random()<.5,
    size:type==='note'?.04+Math.random()*.02:type==='dash'?.036+Math.random()*.016:.011+Math.random()*.012,
    drift:(Math.random()-.5)*.1,depth:Math.random(),tw:Math.random()*6.28,phase:Math.random()});
}
function updateD(dt,a,t){
  const step=stepOf(a);
  if(!reduce.matches){dAcc+=dt*(a<=.01?0:2+13*a);while(dAcc>=1){dAcc--;if(dmotes.length<90)spawnD();}}
  for(let i=dmotes.length-1;i>=0;i--){const m=dmotes[i];m.age+=dt;
    if(m.age>=m.life||m.r>1.05){dmotes.splice(i,1);continue;}
    m.next-=dt;if(m.next<=0){m.target+=.04+.03*a;m.next=step*(.9+.2*m.phase);}
    for(let j=0,h=dt/3;j<3;j++){const acc=45*(m.target-m.r)-9*m.v;m.v+=acc*h;m.r+=m.v*h;}
    m.th+=m.drift*dt;
    m.hist.unshift({r:m.r,th:m.th,t});while(m.hist.length&&t-m.hist[m.hist.length-1].t>step*3.2)m.hist.pop();
  }
}
const sprites={};
function glowSprite(c){const id=c.join(',');if(sprites[id])return sprites[id];
  const s=mk();s.width=s.height=64;const g=s.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  const R=Math.round(c[0]*255),G=Math.round(c[1]*255),B=Math.round(c[2]*255);
  gr.addColorStop(0,`rgba(${Math.round(R*.7+77)},${Math.round(G*.7+77)},${Math.round(B*.7+77)},1)`);gr.addColorStop(.35,`rgba(${R},${G},${B},.35)`);gr.addColorStop(1,`rgba(${R},${G},${B},0)`);
  g.fillStyle=gr;g.fillRect(0,0,64,64);return sprites[id]=s;}
const moteLayers={};
function moteLayer(c,a,t,frame){const id=c.join(',');let o=moteLayers[id];
  if(!o){o=moteLayers[id]={cv:mk(),f:-1};o.cv.width=o.cv.height=512;}
  if(o.f===frame)return o.cv;o.f=frame;
  // same drawing as before (600-unit layout), rendered at 2x for sharper notes
  const S=600,h=S/2,g=o.cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,512,512);g.setTransform(512/600,0,0,512/600,0,0);g.globalCompositeOperation='lighter';
  const R=Math.round(c[0]*255),G=Math.round(c[1]*255),B=Math.round(c[2]*255);
  const col=(al,k=0)=>`rgba(${Math.round(R+(255-R)*k)},${Math.round(G+(255-G)*k)},${Math.round(B+(255-B)*k)},${al})`;
  const step=stepOf(a);
  const draw=(m,r,th,al,scale,vel)=>{
    if(al<.01)return;
    const x=h+Math.cos(th)*r*h,y=h+Math.sin(th)*r*h,s=m.size*h*scale*(.75+.45*(1-m.depth));
    const st=Math.min(.3,Math.abs(vel)*1.4),sx=1+st,sy=1/Math.sqrt(sx);       // squash & stretch along the motion
    const Rg=s*(m.type==='dot'?4.2:2.4);g.globalAlpha=Math.min(1,al*.7);g.drawImage(glowSprite(c),x-Rg,y-Rg,2*Rg,2*Rg);g.globalAlpha=1;
    g.save();g.translate(x,y);g.rotate(th);g.scale(sx,sy);g.rotate(-th);
    if(m.type==='dot'){g.fillStyle=col(al,.75);g.beginPath();g.arc(0,0,s*.6,0,Math.PI*2);g.fill();}
    else if(m.type==='dash'){g.rotate(th+Math.PI/2);g.fillStyle=col(al,.6);g.fillRect(-s*.5,-s*.09,s,s*.18);}
    else if(m.type==='ring'){g.strokeStyle=col(al,.6);g.lineWidth=Math.max(1,s*.25);g.beginPath();g.arc(0,0,s*(1+.5*Math.max(0,vel)*6),0,Math.PI*2);g.stroke();}
    else{const an=Math.min(1,al*1.4);g.rotate(Math.sin(m.tw+t*.5)*.15);g.fillStyle=col(an,.85);g.strokeStyle=col(an,.85);g.lineWidth=Math.max(1.4,s*.11);
      const head=(hx,hy)=>{g.beginPath();g.ellipse(hx,hy,s*.27,s*.19,-.45,0,Math.PI*2);g.fill();};
      const stem=(sx2,sy2)=>{g.beginPath();g.moveTo(sx2,sy2);g.lineTo(sx2,sy2-s*.95);g.stroke();};
      if(m.beam){head(-s*.32,s*.42);head(s*.32,s*.3);stem(-s*.08,s*.38);stem(s*.56,s*.26);g.lineWidth=Math.max(1.5,s*.16);g.beginPath();g.moveTo(-s*.08,-s*.57);g.lineTo(s*.56,-s*.69);g.stroke();}
      else{head(0,s*.4);stem(s*.24,s*.36);g.beginPath();g.moveTo(s*.24,-s*.59);g.quadraticCurveTo(s*.62,-s*.35,s*.5,-s*.05);g.stroke();}}
    g.restore();
  };
  for(const m of dmotes){
    const p=m.age/m.life,fade=Math.min(1,p*5)*Math.pow(1-p,1.3)*(1-Math.max(0,Math.min(1,(m.r-.9)/.12)));
    const base=Math.min(1,1.45*fade*(.7+.3*Math.sin(m.tw+t*1.4))*(.55+.45*Math.min(1,a*1.4))*(.7+.3*(1-m.depth)));
    // echoes: where the mote was one, two, three delay times ago
    for(let e=3;e>=1;e--){const want=t-step*e*.55;let q=null;for(const hh of m.hist){if(hh.t<=want){q=hh;break;}}
      if(q)draw(m,q.r,q.th,base*Math.pow(.42,e),1-.1*e,0);}
    draw(m,m.r,m.th,base,1,m.v);
  }
  g.globalCompositeOperation='source-over';
  return o.cv;
}


const tex={};let gc=null,G=null,cur=null,val=0,clock=0,frameNo=0,out=null;
function texFor(k){return tex[k]||(tex[k]=makeBaseA(8,k));}
function render(k,target,dt){
  if(!gc){gc=document.createElement('canvas');gc.width=gc.height=256;out=document.createElement('canvas');out.width=out.height=512;}
  if(!G){try{G=makeGL(gc,texFor(k));cur=k;}catch(e){console.error(e);return null;}if(!G)return null;}
  if(cur!==k){uploadTex(G,texFor(k));cur=k;}
  clock+=dt;frameNo++;val+=(target-val)*(1-Math.exp(-dt/.05));
  if(!reduce.matches)emitNote(clock,val);updateD(dt,val,clock);
  const S=panelState('A2');stepPanel(S,val,clock,dt);
  const {gl,U}=G,tint=PALS[k].body.map(v=>v/255),pad=(arr,len)=>{const o=new Float32Array(len);o.set(arr.slice(0,len));return o;};
  gl.viewport(0,0,gc.width,gc.height);
  gl.uniform1f(U.uT,clock);gl.uniform1f(U.uA,val);gl.uniform1f(U.uDrive,S.drive);gl.uniform1f(U.uN,S.n);gl.uniform3fv(U.uTint,tint);
  gl.uniform1fv(U.uRad,pad(S.radii,5));gl.uniform1fv(U.uEdge,pad(S.edges,6));
  gl.uniform1fv(U.uE,pad(S.ring.map((s,i)=>Math.max(0,s.e)*.85*(.75+.25*smooth(i/S.n,(i+1)/S.n,Math.min(1,val/.85)))),5));
  gl.uniform1fv(U.uF,pad(S.ring.map(s=>s.flash),5));gl.uniform1fv(U.uEc,pad(S.echo,5));
  gl.uniform1fv(U.uBump,pad(S.ring.map(s=>s.bump*.05),5));
  const pk=new Float32Array(32);S.packets.forEach((q,i)=>pk.set(q,i*4));gl.uniform4fv(U.uPk,pk);
  const sh=new Float32Array(24);S.shocks.slice(-6).forEach((q,i)=>{const p=(clock-q.t0)/.7;sh.set([q.r+.06*ease(p),(1-p)*(1-p)*.3*q.s,p,0],i*4);});gl.uniform4fv(U.uSh,sh);
  gl.uniform2f(U.uFront,S.front.r,Math.abs(S.front.v)*.5);gl.uniform1f(U.uCore,.78);
  gl.uniform1fv(U.uRot,new Float32Array(5));
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  const o=out.getContext('2d');o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation='source-over';o.clearRect(0,0,512,512);
  o.drawImage(gc,0,0,512,512);o.drawImage(moteLayer(tint,val,clock,frameNo),0,0,512,512);
  return out;
}
return {render,prepare:texFor};
})();

// ===== New Filter visual (approved "Underwater"): drawn by code, coloured per instrument =====
const NFX_FILTER=(()=>{
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const PAL={b:{body:[63,167,255],core:[210,238,255],deep:[18,62,160],grey:[120,134,152]},
           g:{body:[242,182,50],core:[255,241,206],deep:[140,84,8],grey:[150,140,124]},
           y:{body:[255,222,70],core:[255,246,200],deep:[150,115,10],grey:[150,146,120]},
           v:{body:[205,212,228],core:[246,248,255],deep:[60,66,82],grey:[128,132,140]},
           p:{body:[176,146,255],core:[238,230,255],deep:[64,38,150],grey:[132,126,150]}};
let colKey='b';
// ---------- helpers ----------
const TAU=Math.PI*2;
const mkc=s=>{const c=document.createElement('canvas');c.width=c.height=s;return c;};
const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${Math.max(0,Math.min(1,a))})`;
const mixc=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let seed=1;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const sprites={};
function orbSprite(c){const id=c.join();if(sprites[id])return sprites[id];const s=mkc(64),g=s.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,rgba(mixc(c,[255,255,255],.45),1));gr.addColorStop(.3,rgba(c,.45));gr.addColorStop(1,rgba(c,0));g.fillStyle=gr;g.fillRect(0,0,64,64);return sprites[id]=s;}
function orb(g,x,y,R,c,a){if(a<=.003)return;g.globalAlpha=Math.min(1,a);g.drawImage(orbSprite(c),x-R,y-R,2*R,2*R);g.globalAlpha=1;}
function dot(g,x,y,r,c,a){g.fillStyle=rgba(c,a);g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}
function sparkle(g,x,y,L,c,a,u){g.strokeStyle=rgba(c,a);g.lineWidth=1.1*u;g.beginPath();g.moveTo(x-L,y);g.lineTo(x+L,y);g.moveTo(x,y-L);g.lineTo(x,y+L);g.stroke();dot(g,x,y,1.4*u,c,a);}
function note(g,x,y,s,c,a,beam,rot){if(a<.01)return;g.save();g.translate(x,y);g.rotate(rot);g.fillStyle=rgba(c,a);g.strokeStyle=rgba(c,a);g.lineWidth=Math.max(1.2,s*.11);
  const head=(hx,hy)=>{g.beginPath();g.ellipse(hx,hy,s*.27,s*.19,-.45,0,TAU);g.fill();};
  const stem=(sx,sy)=>{g.beginPath();g.moveTo(sx,sy);g.lineTo(sx,sy-s*.95);g.stroke();};
  if(beam){head(-s*.32,s*.42);head(s*.32,s*.3);stem(-s*.08,s*.38);stem(s*.56,s*.26);g.lineWidth=Math.max(1.4,s*.16);g.beginPath();g.moveTo(-s*.08,-s*.57);g.lineTo(s*.56,-s*.69);g.stroke();}
  else{head(0,s*.4);stem(s*.24,s*.36);g.beginPath();g.moveTo(s*.24,-s*.59);g.quadraticCurveTo(s*.62,-s*.35,s*.5,-s*.05);g.stroke();}g.restore();}

// ---------- the music: phrases of notes ----------
const seq={next:.6,left:0,base:.7};let beat=0;const events=[];
function music(t,dt){beat*=Math.exp(-dt/.45);events.length=0;if(reduce.matches||t<seq.next)return;
  if(seq.left<=0){seq.left=3+Math.floor(Math.random()*5);seq.base=.55+Math.random()*.35;seq.next=t+1.1+Math.random()*1.5;return;}
  seq.left--;const s=Math.min(1,seq.base*(.7+Math.random()*.5));beat=Math.max(beat,s);events.push(s);
  seq.next=t+[.42,.55,.7,.9][Math.floor(Math.random()*4)]*(1+Math.random()*.25);}

// ---------- the shared "sound field" (used by 1, 5, 6): silky ribbons, specks, glows, sparkles, notes ----------
const field={specks:[],orbs:[],sparks:[],notes:[],ribs:[[.30,.034,6.1,13,.0],[.56,.045,4.6,11,1.3],[.79,.03,7.2,15,2.6]]};
seed=11;
for(let i=0;i<190;i++){const near=i<130,rb=field.ribs[i%3];field.specks.push({x:rnd(),y:near?rb[0]+(rnd()+rnd()+rnd()-1.5)*.05:rnd(),r:.6+rnd()*rnd()*2.4,a:.25+.7*rnd(),ph:rnd()*TAU,vx:(rnd()-.4)*.006});}
for(let i=0;i<14;i++)field.orbs.push({x:rnd(),y:.1+rnd()*.8,R:.012+rnd()*.016,ph:rnd()*TAU});
for(let i=0;i<16;i++)field.sparks.push({x:.08+rnd()*.84,y:.08+rnd()*.84,L:.006+rnd()*.008,ph:rnd()*TAU,sp:.4+rnd()*.6});
function fieldStep(t,dt){
  for(const p of field.specks){p.x+=p.vx*dt;if(p.x>1.02)p.x-=1.04;if(p.x<-.02)p.x+=1.04;}
  for(const s of events){for(let i=0;i<2;i++)field.notes.push({x:.18+Math.random()*.64,y:.35+Math.random()*.5,vy:-.018-Math.random()*.015,age:0,life:4+Math.random()*2,s:.026+Math.random()*.014,beam:Math.random()<.4,rot:(Math.random()-.5)*.5,sw:Math.random()*TAU});}
  for(let i=field.notes.length-1;i>=0;i--){const n=field.notes[i];n.age+=dt;n.y+=n.vy*dt;n.x+=Math.sin(n.sw+n.age*.7)*.004*dt;if(n.age>n.life)field.notes.splice(i,1);}
}
const ribY=(rb,x,t,S)=>{const [by,A,f1,f2,ph]=rb;return (by+A*(1+.3*beat)*(Math.sin(x*f1+ph+t*.22)+.45*Math.sin(x*f2+ph*2-t*.31)))*S;};
// muff=0 crisp, 1 muffled (grey, dim, no sparkle). frozen time is passed in as t for the frost.
function drawField(g,S,t,P,muff){const u=S/640,body=muff?mixc(P.body,P.grey,.7):P.body,core=muff?mixc(P.core,P.grey,.65):P.core,k=muff?.42:1,step=muff?14:8;
  g.lineWidth=1.25*u;
  field.ribs.forEach((rb,ri)=>{for(let s=-6;s<=6;s++){const al=.2*Math.exp(-s*s/14)*k*(1+.4*beat),c=mixc(body,core,Math.exp(-s*s/4)*.6);g.strokeStyle=rgba(c,al);g.beginPath();
    for(let px=-10*u;px<=S+10*u;px+=step*u){const x=px/S,y=ribY(rb,x,t,S)+s*2.1*u*(1+.5*Math.sin(x*6+ri+s*.2+t*.2));px<=-10*u?g.moveTo(px,y):g.lineTo(px,y);}g.stroke();}});
  for(const p of field.specks){const tw=.65+.35*Math.sin(p.ph+t*(muff?.3:1.1));dot(g,p.x*S,p.y*S,p.r*u,mixc(body,core,.4),p.a*tw*k);}
  for(const o of field.orbs)orb(g,o.x*S,o.y*S,o.R*S*(1+.12*Math.sin(t*.5+o.ph)),body,(.35+.15*Math.sin(t*.4+o.ph))*k);
  if(!muff)for(const s of field.sparks){const tw=Math.max(0,Math.sin(s.ph+t*s.sp));sparkle(g,s.x*S,s.y*S,s.L*S*(.6+.4*tw),core,.85*tw,u);}
  for(const n of field.notes){const p=n.age/n.life,al=Math.min(1,p*5)*Math.pow(1-p,1.2)*(muff?.4:.9);note(g,n.x*S,n.y*S,n.s*S,muff?mixc(core,P.grey,.3):mixc(body,core,.75),al,n.beam,n.rot+Math.sin(n.sw+n.age*.6)*.12);}
}

const geo=S=>({cx:S/2,cy:S/2,R:S*.49});
const ends=a=>sm(0,.03,a)*sm(1,.97,a);
function shaftSprite(p,S,P){const key='sh'+colKey;if(p.cache[key])return p.cache[key];const c=mkc(Math.round(S/2)),g=c.getContext('2d'),w=c.width;
  g.filter=`blur(${Math.round(w*.02)}px)`;const gr=g.createLinearGradient(0,0,0,w);gr.addColorStop(0,rgba(P.body,.5));gr.addColorStop(1,rgba(P.body,0));g.fillStyle=gr;
  g.beginPath();g.moveTo(w*.42,0);g.lineTo(w*.5,0);g.lineTo(w*.62,w);g.lineTo(w*.48,w);g.closePath();g.fill();g.filter='none';return p.cache[key]=c;}
function idea6(p,g,S,t,a,P,dt){const u=S/640,{cx,cy,R}=geo(S),e=ends(a);drawField(g,S,t,P,0);
  const lvl=cy+R+6*u-(2*R+12*u)*a*1.03,surf=x=>lvl+(10*Math.sin(x/S*7.5+1+t*1.0)+5*Math.sin(x/S*19+2-t*1.4))*u*e;
  if(a>.003){const m=p.muf,mg=m.getContext('2d'),mw=m.width;mg.setTransform(1,0,0,1,0,0);mg.globalCompositeOperation='source-over';mg.fillStyle='#000';mg.fillRect(0,0,mw,mw);
    mg.globalCompositeOperation='lighter';drawField(mg,mw,t*.45,P,1);
    g.save();g.beginPath();if(a<.995){g.moveTo(-5,S+5);for(let x=-5;x<=S+5;x+=6*u)g.lineTo(x,surf(x));g.lineTo(S+5,S+5);g.closePath();}else g.rect(0,0,S,S);g.clip();
    g.globalCompositeOperation='source-over';g.fillStyle='#000';g.fillRect(0,0,S,S);g.globalCompositeOperation='lighter';
    const top=Math.max(0,Math.floor((lvl-30*u)/(S/mw))),step=2;
    for(let y=top;y<mw;y+=step){const off=(5*Math.sin(y*.09+t*1.2)+2.5*Math.sin(y*.21-t*.9))*(S/mw)*.9;g.drawImage(m,0,y,mw,step,off,y*S/mw,S,step*S/mw+1);}
    // caustic light net, shafts, depth
    g.lineWidth=1.1*u;for(let k=0;k<44;k++){const x0=((k*.173)%1)*S,y0=Math.max(lvl,0)+((k*.389)%1)*(S-Math.max(lvl,0)),L=(40+30*((k*.7)%1))*u,ph=t*.8+k;
      g.strokeStyle=rgba(P.body,(.07+.06*Math.sin(ph*.7))*1.5);g.beginPath();for(let j=0;j<=L;j+=5*u){const x=x0+j+Math.sin(ph*.3)*8*u,y=y0+8*u*Math.sin(j/u*.08+ph);j?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
    const sh=shaftSprite(p,S,P);for(let k=0;k<4;k++){const x=(.12+.24*k+.03*Math.sin(t*.25+k*1.7))*S;g.globalAlpha=(.32+.12*Math.sin(t*.4+k))*1.5;g.drawImage(sh,x-S*.25,Math.max(lvl,0)-4*u,S*.5,S);}g.globalAlpha=1;
    g.globalCompositeOperation='source-over';const dp=g.createLinearGradient(0,Math.max(lvl,0),0,S);dp.addColorStop(0,'rgba(0,0,0,0)');dp.addColorStop(1,'rgba(0,0,0,.45)');g.fillStyle=dp;g.fillRect(0,0,S,S);
    // water body: a faint layer of the instrument colour below the surface (light, not darkness)
    g.globalCompositeOperation='lighter';{const wb=g.createLinearGradient(0,Math.max(lvl,0),0,S);wb.addColorStop(0,rgba(P.body,.05));wb.addColorStop(1,rgba(P.body,.09));g.fillStyle=wb;g.fillRect(0,0,S,S);}g.globalCompositeOperation='source-over';
    g.restore();g.globalCompositeOperation='lighter';
    if(!reduce.matches){p.acc+=dt*(3+9*a);while(p.acc>=1){p.acc--;const x=.08+Math.random()*.84,y=.96-Math.random()*.08;if(y*S>surf(x*S)+20*u)p.parts.push({x,y,r:(2.5+Math.random()*6)*u/S,v:.05+Math.random()*.05,sw:Math.random()*TAU,age:0});}}
  }
  for(let k=p.parts.length-1;k>=0;k--){const q=p.parts[k];q.age+=dt;const x=q.x*S+Math.sin(q.sw+q.age*2.2)*4*u,sy=surf(x);
    if(q.pop===undefined){q.y-=q.v*dt;if(q.y*S<=sy+2*u||a>.995&&q.y<.05)q.pop=q.age;}
    if(q.pop!==undefined){const kk=(q.age-q.pop)/.6;if(kk>1){p.parts.splice(k,1);continue;}g.strokeStyle=rgba(P.core,.5*(1-kk));g.lineWidth=1*u;g.beginPath();g.ellipse(x,sy,(q.r*S)*(1+3*kk),(q.r*S)*(1+3*kk)*.3,0,0,TAU);g.stroke();continue;}
    const y=q.y*S,r=q.r*S;g.strokeStyle=rgba(P.core,.45);g.lineWidth=1*u;g.beginPath();g.arc(x,y,r,0,TAU);g.stroke();dot(g,x-r*.35,y-r*.35,r*.22,P.core,.6);}
  if(e>0){for(const [w,al,c] of [[16,.07,P.body],[5,.28,P.body],[1.7,.9,P.core]]){g.strokeStyle=rgba(c,al*e);g.lineWidth=w*u;g.beginPath();for(let x=-5;x<=S+5;x+=4*u){x<=-5?g.moveTo(x,surf(x)):g.lineTo(x,surf(x));}g.stroke();}}
}

const S=320,p={i:5,S,crisp:mkc(S),muf:mkc(Math.round(S/3)),small:mkc(Math.round(S/4)),parts:[],acc:0,cache:{}};
let val=0,clock=0;const out=mkc(S);
function render(k,target,dt){
  colKey=k;const P=PAL[k];clock+=dt;val+=(target-val)*(1-Math.exp(-dt/.15));const a=Math.abs(val-target)<.0005?target:val;
  music(clock,dt);fieldStep(clock,dt);
  const {cx,cy,R}=geo(S),c=p.crisp,g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.fillStyle='#000';g.fillRect(0,0,S,S);
  const bgG=g.createRadialGradient(cx,cy*1.1,0,cx,cy*1.1,R*1.5);bgG.addColorStop(0,rgba(P.deep,.16));bgG.addColorStop(1,rgba(P.deep,0));g.fillStyle=bgG;g.fillRect(0,0,S,S);
  g.globalCompositeOperation='lighter';idea6(p,g,S,clock,a,P,dt);g.globalCompositeOperation='source-over';g.globalAlpha=1;
  const sm2=p.small,sg=sm2.getContext('2d'),sw=sm2.width;sg.globalCompositeOperation='source-over';sg.filter='blur(3px)';sg.clearRect(0,0,sw,sw);sg.drawImage(c,0,0,sw,sw);sg.filter='none';
  const o=out.getContext('2d');o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation='source-over';o.clearRect(0,0,S,S);o.drawImage(c,0,0);
  o.globalCompositeOperation='lighter';o.globalAlpha=.75;o.drawImage(sm2,0,0,S,S);o.globalAlpha=1;o.globalCompositeOperation='source-over';
  return out;
}
return {render,prepare:()=>{}};
})();

// ===== First interface (approved 2026-10-13): Vocals (original shape, V5 light), Bass ribbons,
// Other nebula, Drums (chrome sound waves that settle into the metal disc). Drawn by code,
// transparent background (black = nothing, the orb's screen blend keeps the game background).
const FUI=(()=>{
let vol=0,mus=null;
function setup(){const S=384,c=document.createElement('canvas');c.width=c.height=S;return {c,g:c.getContext('2d'),S};}
function clear(g,S){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.filter='none';g.clearRect(0,0,S,S);}
function rim(){} function label(){}
const TAU=Math.PI*2;
const hash=n=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);};
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// ---------- "music dust" for the first interface: soft beat dots and tiny sound arcs ----------
// (different from the effect pages, which use notes and sparkles)
function beatDust(o,s,col,reachR){o.parts=o.parts||[];const n=Math.round(3+6*s*vol);
  for(let i=0;i<n;i++){const th=Math.random()*TAU;o.parts.push({th,r:reachR*(.75+.3*Math.random()),v:.12+.25*Math.random()*s,age:0,life:.9+.9*Math.random(),
    type:Math.random()<.35?'arc':'dot',sz:.6+Math.random(),len:.12+.2*Math.random()});}}
function drawDust(o,dt,col){const g=o.g,S=o.S,u=S/640,cx=S/2,R=S*.4;if(!o.parts)return;g.save();g.globalCompositeOperation='lighter';
  for(let i=o.parts.length-1;i>=0;i--){const p=o.parts[i];p.age+=dt;p.r+=p.v*dt;p.v*=Math.exp(-dt*1.2);if(p.age>p.life||p.r>1.22){o.parts.splice(i,1);continue;}
    const k=Math.min(1,p.age*8)*Math.pow(1-p.age/p.life,1.4)*(.5+.5*vol);
    if(p.type==='dot'){const x=cx+Math.cos(p.th)*p.r*R,y=cx+Math.sin(p.th)*p.r*R,s2=p.sz*2.2*u,gr=g.createRadialGradient(x,y,0,x,y,s2*4);
      gr.addColorStop(0,`rgba(255,255,255,${.85*k})`);gr.addColorStop(.25,`rgba(${col},${.45*k})`);gr.addColorStop(1,`rgba(${col},0)`);g.fillStyle=gr;g.fillRect(x-s2*4,y-s2*4,s2*8,s2*8);}
    else{g.strokeStyle=`rgba(${col},${.7*k})`;g.lineWidth=1.3*u;g.lineCap='round';g.beginPath();g.arc(cx,cx,p.r*R,p.th-p.len/2,p.th+p.len/2);g.stroke();}}
  g.restore();}

// ---------- VOCALS: LED-dot level ring, four outline shapes ----------
const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const yl=(k,a)=>{const w=Math.min(1,Math.max(0,k-1));return `rgba(255,${Math.round(228+24*w)},${Math.round(92+150*w)},${Math.max(0,Math.min(1,a*Math.min(1,k)))})`;};
const VN=112;
// ---------- VOCALS (original geometry from the game's drawGoldenVocalMain, new colour) ----------
const VO=[1].map(m=>({...setup('vo'+m),m,R:0,glow:document.createElement('canvas')}));
function drawVocalsOrig(V,dt){const {g,S}=V,u=S/640,cx=S/2;clear(g,S);
  const limit=S*.4*1.2,target=limit*Math.pow(vol,.48)*.94;V.R+=(target-V.R)*(1-Math.exp(-dt/.15));const R=V.R,t=V.t=(V.t||0)+dt*(.25+.5*1.8*mus.voice);
  V.lv=V.lv||new Float32Array(112);V.pk=V.pk||new Float32Array(112);V.pkT=V.pkT||new Float32Array(112);V.ring=V.ring||[];
  for(let i=0;i<112;i++){const phase=seed(i+1)*TAU;
    const wave=.5+.26*Math.sin(t*(1.1+seed(i+12)*1.6)+phase)+.16*Math.sin(t*(2.2+seed(i+73)*1.9)+phase*2.3)+.08*Math.sin(t*.8+phase*3.1);
    const tg=Math.min(14.6,6+wave*8+mus.voice*.6+2.2*mus.syl*(.6+.4*seed(i+9)));const up=tg>V.lv[i];V.lv[i]+=(tg-V.lv[i])*(1-Math.exp(-dt/(up?.045:.26)));
    if(V.lv[i]>=V.pk[i]){V.pk[i]=V.lv[i];V.pkT[i]=mus.t;}else if(mus.t-V.pkT[i]>.45)V.pk[i]=Math.max(V.lv[i],V.pk[i]-dt*7);}
  if(R>1&&vol>.003){const inner=R*.44,step=R*.038,G=V.glow;if(G.width!==S/2){G.width=G.height=S/2;}const gg=G.getContext('2d');gg.setTransform(1,0,0,1,0,0);gg.clearRect(0,0,S/2,S/2);gg.setTransform(.5,0,0,.5,0,0);
    if(mus.accent>.98&&!V.fired){V.ring.push({p:0});V.fired=1;}if(mus.accent<.9)V.fired=0;
    const sweep=mus.t*.45;
    V.rot=(V.rot||0)+dt*.1;
    for(let i=0;i<112;i++){const count=V.lv[i],ang=i*TAU/112+V.rot,top=Math.floor(count-.001),pk=Math.floor(V.pk[i]-.001),sw=Math.pow(.5+.5*Math.cos(ang-sweep),10)*.55,lvl=count/14.6;
      g.save();g.translate(cx,cx);g.rotate(ang);
      gg.save();gg.translate(cx,cx);gg.rotate(ang);
      for(let j=0;j<15;j++){const rr=inner+j*step,w=rr*TAU/112*.65,h=step*.72;
        let on=Math.max(0,Math.min(1,count-j));if(j===pk&&j>=count-1)on=Math.max(on,.8);
        if(!on){g.fillStyle='rgba(255,236,150,.04)';g.fillRect(rr,-w/2,h,w);continue;}
        let wv=0;for(const q of V.ring){const d=j/15-q.p;wv+=Math.exp(-d*d*120)*(1-q.p);}
        const k=.78+.22*(j/15)+sw+wv*1.2+(j===top?.35:0),a=on*(.62+.38*lvl)*(.7+.3*vol),col=yl(k,a);
        g.fillStyle=col;g.fillRect(rr,-w/2,h,w);
        gg.fillStyle=col;gg.fillRect(rr-h*.2,-w*.7,h*1.4,w*1.4);}
      gg.restore();g.restore();}
    for(const q of V.ring)q.p+=dt*1.1;V.ring=V.ring.filter(q=>q.p<1.2);
    g.save();g.globalCompositeOperation='lighter';g.filter=`blur(${10*u}px)`;g.globalAlpha=.5;g.drawImage(G,0,0,S,S);g.filter=`blur(${3*u}px)`;g.globalAlpha=.28;g.drawImage(G,0,0,S,S);g.restore();}
  if(mus.sylN!==V.lastSyl){V.lastSyl=mus.sylN;if(vol>.02&&Math.random()<.7)beatDust(V,mus.syl*.7,'255,236,140',(R/(S*.4))*.95);}
  drawDust(V,dt,'255,236,140');
  rim(g,S);label(g,S,'VOCALS');}

// ---------- DRUMS: the original metal disc, redrawn by code (WebGL) so every ring can grow on its own ----------
const DRUM_FS=`precision highp float;varying vec2 v;uniform float uT,uV,uK,uSpr;uniform vec4 uH[8];uniform float uOff[8];uniform float uRot;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float sm(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
const float RC=.22,RW=(1.-.22)/6.;   // centre plate + 6 terraces, as in the original
float ringQ(float x){return x<RC?x/RC*.999:1.+(x-RC)/RW;}
float ringR(float k){return k<.5?RC*.5:RC+(k-.5)*RW;}
void main(){
  vec2 p0=(v*2.-1.)/.8,p=mat2(cos(uRot),-sin(uRot),sin(uRot),cos(uRot))*p0;float r=length(p),th=atan(p.y,p.x);
  vec2 gv=p*.4+.5;   // grain turns with the disc
  float reach=.1+1.0*pow(uV,.7);                      // how far the disc has grown
  float rs=r,gain=1.,extra=0.,flash=0.,reveal=0.,waveL=0.;
  for(int i=0;i<8;i++){vec4 H=uH[i];if(H.y<=0.)continue;float age=H.x,s=H.y;flash+=s*exp(-age/.16);
    if(uK<2.5){float pr=1.-pow(1.-min(1.,age/.42),2.4),x=r-pr*reach*1.02,env=exp(-x*x*260.)*s*(1.-pr*.6);rs-=env*.035;gain+=env*1.6;
      if(age>.4){float y=r-(reach+(age-.42)*.9);extra+=exp(-y*y*300.)*s*max(0.,1.-(age-.42)/.9);}}
    else if(uK<3.5){for(int k=0;k<8;k++){float tk=age-float(k)*.045;if(tk<0.)continue;float e=exp(-tk/.12)*min(1.,tk*40.)*s,x=r-ringR(float(k))+.03;gain+=e*1.4*exp(-x*x*500.);}}
    else if(uK<4.5){float y=r-(reach+age*.55);extra+=exp(-y*y*90.)*s*exp(-age*2.2)*.9*step(reach-.05,r);}
    else if(uK<5.5){float k=floor(ringQ(r)),tk=age-k*.05;if(tk>0.)rs-=.022*s*sin(min(tk*22.,3.1416))*exp(-tk*5.);}
    else if(uK<6.5){float pr=age/.55;if(pr<1.){float band=sm(pr*reach-.3,pr*reach,r)*sm(pr*reach+.02,pr*reach-.02,r);gain+=band*s*.9*(.5+.5*sin(r*90.-age*40.))*(1.-pr);}}
    else if(uK<7.5){for(int j=1;j<=3;j++){float y=r-(reach+age*(.25+.12*float(j)));extra+=exp(-y*y*400.)*s*exp(-age*2.5)*(1./float(j));}}
    else if(uK<9.5){float x=r-min(age*.9,1.)*reach,env=exp(-x*x*40.)*s*exp(-age*2.6)*step(r,reach);gain+=env*.45;}
    else {float hard=uK>10.5?1.35:1.;float pr=1.-pow(1.-min(1.,age/.42),2.2),front=pr*(1.06+.08*uV),x=r-front;
      float crest=exp(-x*x*(110./hard))*s*(1.-.45*pr)*hard;                                      // the BOOM light wave (just past the disc, no further)
      float after=step(r,front)*exp(-(front-r)*2.4)*exp(-age*3.4)*s*hard;                           // the metal it lit stays visible for a moment
      reveal+=after*1.5+crest*.8;waveL+=crest;}
  }
  if(uK>3.5&&uK<4.5)rs=rs/(1.+.03*uSpr*sin(3.1416*min(r,1.)));
  float lift=0.;
  if(uK>7.5){float kk=floor(ringQ(r));float off=0.;for(int i=0;i<8;i++){if(float(i)==kk)off=uOff[i];}
    rs=r-off;lift=off;}
  // ---- the disc: 6 metal terraces + a centre plate, light from the sides, sand-blasted grain
  float q=ringQ(rs),k=floor(q),f=fract(q);
  float band=k<.5?sm(1.,.96,f):sm(.0,.05,f)*sm(1.,.95,f)*pow(f,.25+.2*k);   // like the original: dark at the inner step, brightening to the outer lip   // sharp dark step, bright lip, long fade into the dark
  float side=pow(abs(cos(th)),4.),light=.15+.85*side;
  float plate=.1+.8*exp(-pow(sin(th)*rs/RC*2.8,2.));if(k<.5)light=plate;float centre=1.;
  float grain=.5+.7*(.6*hash(floor(gv*700.))+.4*hash(floor(gv*350.)+7.));
  float metal=1.25*band*light*centre*grain*(1.-.42*pow(min(rs,1.),2.))*(1.+clamp(lift*12.,-.45,1.1));
  float crest=exp(-pow((f-.62)/.3,2.))*(k<.5?.6:1.)*(.25+.75*side);   // a soft, wide silver wave (no hard line)       // the bright inner lip of each terrace
  // ---- growth: rings appear from the centre; at first only a silver light-wave (the lip), then they fill to solid metal
  float ringPos=ringR(k);
  float appear=sm(ringPos-.02,ringPos+.06,reach)*step(r,1.02);
  float fill=sm(.0,1.,(uV*1.25-ringPos*.55-.12)/.55);
  float val=mix(crest*.9*grain,metal,fill)*appear;
  if(uK>12.5){
    float reach=.24+.84*pow(uV,.8),solid=pow(sm(.5,1.,uV),1.3);
    float hit=0.;for(int i=0;i<8;i++){vec4 H=uH[i];if(H.y<=0.)continue;hit+=H.y*exp(-H.x/.55);}
    float rr=r*(1.+.05*uSpr);                                            // the whole plate sinks and springs back (physical)
    float kq=(3.2+2.*uV)*6.2832/max(reach,.2);           // big rings: ~3 across a small wave, ~5 across the full disc
    float ph=kq*rr-uT*1.6;                                                // ripples flowing slowly outward
    float env=sm(reach+.02,reach*.55,rr);
    float slope=(.85+.15*uV)*(1.+.8*hit)*cos(ph)*env,crest=sin(ph);
    vec2 dir=vec2(cos(th),sin(th)),Ld=normalize(vec2(-.75,.55));
    float ld=dot(dir,Ld)*slope;
    float shade=.06+.5*pow(.5+.5*clamp(ld,-1.,1.),1.6)+.08*(.5+.5*crest);
    float spec=pow(max(0.,ld),8.)*1.1+pow(max(0.,crest),24.)*.3*(.4+.6*abs(dot(dir,Ld)));     // glossy chrome highlights + thin bright crests
    float chrome=max(0.,shade+spec)*env*(.75+.25*(1.-rr));
    float echo=0.;for(int i=0;i<8;i++){vec4 H=uH[i];if(H.y<=0.)continue;float a=H.x,y=r-(reach+.02+min(a,.6)*.22);
      echo+=exp(-y*y*900.)*H.y*max(0.,1.-a/.6)*.9;}                  // a short echo ring past the edge
    val=mix(chrome,metal*sm(1.03,.97,rr),solid)+echo*.5*(.6+.4*side);   // at 100% only the disc remains: the sound waves are fully absorbed
  } else if(uK>11.5){
    float reach=.22+.86*pow(uV,.8);                                    // how far the sound travels
    float solid=pow(sm(.45,1.,uV),1.4);                                 // only near 100% does it become a solid disc
    float w=0.;
    for(int j=0;j<4;j++){float ph=fract(uT*.55+float(j)*.25),fr=ph*reach,y=r-fr;   // a steady stream of sound waves from the centre
      w+=exp(-y*y/(.0011+.003*uV))*pow(1.-ph,1.3)*min(1.,ph*8.);}
    for(int i=0;i<8;i++){vec4 H=uH[i];if(H.y<=0.)continue;float a=H.x,fr=(1.-pow(1.-min(1.,a/.9),1.6))*reach*1.08,y=r-fr;   // each BOOM: a stronger wave travelling further
      w+=exp(-y*y/(.0022+.004*uV))*H.y*1.4*max(0.,1.-a/.95);}
    float wave=w*(.55+.45*grain)*(.35+.65*side+.25*(1.-step(.5,k)));     // the waves carry the metal's grain and side light
    float disc=sm(reach+.04,reach-.06,r);
    val=metal*solid*disc+wave*(.55+.6*metal/(1.25*light+.01))*(1.-.45*solid)*sm(1.08,.98,r)*.9;
  } else if(uK>9.5){float solid=pow(uV,1.35),vis=clamp(solid+(1.-solid)*reveal,0.,1.4);
    float disc=sm(1.03,.97,r);
    val=metal*vis*disc*(1.+.5*waveL)+waveL*.55*(.5+.5*grain)*(.4+.6*side)*sm(1.16,1.0,r)+.1*exp(-r*r*40.)*(1.-solid)*step(.003,uV);}
  float edge=sm(reach+.02,reach-.04,r);                                      // soft growing edge
  if(uK<9.5)val=val*edge*gain*(1.+.5*flash*(1.-fill));else if(uK<11.5)val*=1.+.3*flash;
  if(uK<9.5){val+=extra*(.5+.5*grain)*.8*(.35+.65*uV);
  val+=.25*exp(-r*r*60.)*(1.-sm(.0,.3,uV))*step(.003,uV);}                    // a soft glint before anything has grown
  vec3 col=val*vec3(.95,.97,1.04);
  col=clamp(col,0.,1.);gl_FragColor=vec4(col,max(col.r,max(col.g,col.b)));}`;
const DGL=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const gl=c.getContext('webgl',{preserveDrawingBuffer:true,antialias:false});
  const sh=(t,src)=>{const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
  const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,DRUM_FS));gl.linkProgram(pr);gl.useProgram(pr);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const U={};for(const n of ['uT','uV','uK','uSpr','uH','uOff','uRot'])U[n]=gl.getUniformLocation(pr,n);return {c,gl,U};})();
function makeDrum(id,kind){return {...setup(id),kind,hits:[],lastHits:0,spr:0,sv:0,parts:[],ro:new Float32Array(8),rv:new Float32Array(8),kicks:[]};}
const DR=[13].map(k=>makeDrum('d'+k,k));
function drawDrum(D,dt){const g=D.g,S=D.S;clear(g,S);
  if(mus.hits!==D.lastHits&&(D.kind!==13||mus.lastHit.s>=.55)){D.lastHits=mus.hits;const s=mus.lastHit.s*(.5+.5*vol);D.hits.push({t:0,s});D.sv+=(D.kind===13?-3.2:5.5)*s;
    if(vol>.02)beatDust(D,s,'226,232,246',.1+1.0*Math.pow(vol,.7));}
  for(const h of D.hits)h.t+=dt;D.hits=D.hits.filter(h=>h.t<1.8).slice(-8);
  for(let k=0,h=dt/4;k<4;k++){D.sv+=(-(D.kind===13?150:260)*D.spr-(D.kind===13?6.5:13)*D.sv)*h;D.spr+=D.sv*h;}
  if(mus.hits!==D.lastHits)D.lastHits=mus.hits;
  if(D.kind>=8&&D.kind<13){const hard=D.kind===11?1.4:1,amp=(.012+.03*vol)*hard;
    if(D.hits.length&&D.hits[D.hits.length-1].t===0){const s=D.hits[D.hits.length-1].s;
      for(let k=0;k<7;k++)D.kicks.push({at:mus.t+k*.045,k,v:(k===0?-1.4:1)*(1-k*.06)*s*amp*28});}
    for(let i=D.kicks.length-1;i>=0;i--){const q=D.kicks[i];if(mus.t>=q.at){D.rv[q.k]+=q.v;D.kicks.splice(i,1);}}
    const K=300,C=10;
    for(let s2=0,h=dt/4;s2<4;s2++)for(let k=0;k<8;k++){const idle=.0025*(.4+vol)*Math.sin(mus.t*2.1-k*.7)+.0012*Math.sin(mus.t*3.7+k*1.3);   // breathing even without a beat
      D.rv[k]+=(-K*(D.ro[k]-idle)-C*D.rv[k])*h;D.ro[k]+=D.rv[k]*h;}}
  if(vol>.003){const {gl,U,c}=DGL;gl.viewport(0,0,c.width,c.height);
    const H=new Float32Array(32);D.hits.forEach((h,i)=>H.set([h.t,h.s,0,0],i*4));
    gl.uniform1f(U.uT,mus.t);gl.uniform1f(U.uV,vol);gl.uniform1f(U.uK,D.kind);gl.uniform1f(U.uSpr,D.spr);gl.uniform4fv(U.uH,H);gl.uniform1fv(U.uOff,D.ro);D.rot=(D.rot||0)-dt*.1;gl.uniform1f(U.uRot,D.rot);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    g.globalCompositeOperation='lighter';g.imageSmoothingQuality='high';g.drawImage(c,0,0,S,S);
    g.filter=`blur(${(S/110).toFixed(1)}px)`;g.globalAlpha=.18+.4*(1-vol);g.drawImage(c,0,0,S,S);g.filter='none';g.globalAlpha=1;g.globalCompositeOperation='source-over';}
  drawDust(D,dt,'226,232,246');
  rim(g,S);label(g,S,'DRUMS');}

// ---------- BASS: three translucent silk ribbons ----------
const B={...setup('cb'),R:0};
function ribbonStrokes(g,P,width,alpha,u,interior=false){
  const buckets=Array.from({length:8},()=>new Path2D());
  for(let q=0;q<P.length-1;q++){
    const dep=.4+.6*(P[q][2]*.5+.5),bucket=Math.min(7,Math.floor((dep-.4)/.6*8));
    buckets[bucket].moveTo(P[q][0],P[q][1]);buckets[bucket].lineTo(P[q+1][0],P[q+1][1]);
  }
  g.lineWidth=width*u;
  buckets.forEach((path,i)=>{const dep=.4+.6*(i+.5)/8;
    g.strokeStyle=interior?`rgba(90,190,255,${alpha*dep})`:`rgba(${Math.round(120+110*dep)},${Math.round(210+40*dep)},255,${alpha*dep})`;
    g.stroke(path);
  });
}
function drawBass(dt){const {g,S}=B,u=S/640;clear(g,S);const t=mus.t*.8,lv=.35+.4*mus.bass;
  const R=S*.4*1.0;
  if(vol>.003){g.save();g.translate(S/2,S/2);g.globalCompositeOperation='lighter';const k=Math.pow(vol,.8),amp=.35+.75*vol;
    const path=(fam,u2)=>{const ph=fam*TAU/3,pts=[];for(let q=0;q<=128;q++){const a=q/128*TAU,fold=Math.sin(a*3-t*1.05+ph+u2*.6),swell=Math.sin(a*5+t*.71+ph*.65);
      const r=R*(.6+u2*(.1+.16*vol)+((.066+.03*lv)*fold+.028*swell+.022*Math.sin(a*2-t*.43+u2*3+ph))*amp);pts.push([Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*3-t*1.05+ph)]);}return pts;};
    for(let fam=0;fam<3;fam++){const fa=sm(fam*.22,fam*.22+.34,vol);if(fa<=0)continue;const k=Math.pow(vol,.6)*fa;const A=path(fam,0),Bp=path(fam,1);
      for(let q=0;q<A.length-1;q++){const dep=.4+.6*(A[q][2]*.5+.5);
        const gr=g.createLinearGradient(A[q][0],A[q][1],Bp[q][0],Bp[q][1]);gr.addColorStop(0,`rgba(120,210,255,${.5*dep*k})`);gr.addColorStop(.14,`rgba(30,140,255,${.15*dep*k})`);gr.addColorStop(.5,`rgba(20,110,240,${.06*dep*k})`);gr.addColorStop(.86,`rgba(30,140,255,${.15*dep*k})`);gr.addColorStop(1,`rgba(150,225,255,${.55*dep*k})`);
        g.fillStyle=gr;g.beginPath();g.moveTo(A[q][0],A[q][1]);g.lineTo(A[q+1][0],A[q+1][1]);g.lineTo(Bp[q+1][0],Bp[q+1][1]);g.lineTo(Bp[q][0],Bp[q][1]);g.closePath();g.fill();}
      for(const P of [A,Bp])for(const [w,al] of [[6,.06],[1.3,.8]])ribbonStrokes(g,P,w,al*k,u);
      for(let line=1;line<6;line++)ribbonStrokes(g,path(fam,line/6),.8,.11*k,u,true);}
    for(let m=0;m<20;m++){const f=hash(m*9.1),an=m/20*TAU+f+mus.t*(.04+.04*f),rr=R*(.62+.24*f),x=Math.cos(an)*rr,y=Math.sin(an)*rr,s=(2.5+3.5*f)*u,tw=.5+.5*Math.sin(mus.t*1.2+m*2.1);
      const gr=g.createRadialGradient(x,y,0,x,y,s*4);gr.addColorStop(0,`rgba(220,245,255,${.75*tw*k})`);gr.addColorStop(.3,`rgba(80,180,255,${.2*tw*k})`);gr.addColorStop(1,'rgba(80,180,255,0)');g.fillStyle=gr;g.fillRect(x-s*4,y-s*4,s*8,s*8);}
    g.restore();}
  if(mus.bassHits!==B.lb){B.lb=mus.bassHits;if(vol>.02)beatDust(B,.9,'120,200,255',.85);}
  drawDust(B,dt,'120,200,255');
  rim(g,S);label(g,S,'BASS');}

// ---------- OTHER: layered stardust nebula with depth ----------
const O=(()=>{const o=setup('co'),layers=[];
  for(const [n,sz,al,sp] of [[2600,.7,.35,.03],[1200,1.1,.6,.06],[240,1.7,.9,.11]]){const pts=[];for(let i=0;i<n;i++){const r=Math.pow(Math.random(),.5),a=Math.random()*TAU;
    const cl=.6+.4*Math.sin(a*3+r*7)*Math.sin(a*5-r*4);if(Math.random()>.35+.65*cl){i--;continue;}pts.push([a,r,sz*(.6+.8*Math.random()),Math.random()*TAU]);}layers.push({pts,al,sp});}
  const clouds=Array.from({length:14},(_,i)=>({a:i/14*TAU+Math.random(),d:.1+Math.random()*.62,s:.45+Math.random()*.35,ph:Math.random()*10,c:['150,105,255','95,120,255','205,140,255','120,90,230'][i%4]}));
  const flares=Array.from({length:8},()=>({a:Math.random()*TAU,d:Math.sqrt(Math.random())*.8,ph:Math.random()*10,sp:.5+Math.random()}));
  return {...o,layers,clouds,flares,R:0};})();
function drawOther(dt){const {g,S}=O,u=S/640,cx=S/2,t=mus.t;clear(g,S);
  const R=S*.4*1.02;
  if(vol>.003){g.globalCompositeOperation='lighter';
    {const h=g.createRadialGradient(cx,cx,0,cx,cx,R);h.addColorStop(0,`rgba(120,90,230,${.16*vol})`);h.addColorStop(.75,`rgba(110,80,220,${.12*vol})`);h.addColorStop(1,'rgba(100,70,210,0)');g.fillStyle=h;g.fillRect(0,0,S,S);}
    for(const c of O.clouds){const an=c.a+t*.05,x=cx+Math.cos(an)*c.d*R,y=cx+Math.sin(an)*c.d*R*.92,r=c.s*R*1.25*(1+.12*Math.sin(t*.5+c.ph)),al=.26*vol*(.75+.25*Math.sin(t*.8+c.ph));
      const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(${c.c},${al})`);gr.addColorStop(1,`rgba(${c.c},0)`);g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}
    for(const L of O.layers){
      if(!L.sprites){
        // Bake every star once; only four twinkle layers rotate each frame.
        L.sprites=Array.from({length:4},()=>{const c=document.createElement('canvas');c.width=c.height=S/2;return c;});
        for(const [a,r,sz,ph] of L.pts){const edge=1-sm(.86,1.0,r);if(edge<=0)continue;
          const bucket=Math.min(3,Math.floor(ph/TAU*4)),sg=L.sprites[bucket].getContext('2d');
          const x=(cx+Math.cos(a)*r*R)/2,y=(cx+Math.sin(a)*r*R)/2;
          sg.fillStyle=`rgba(${220+Math.round(25*Math.sin(ph))},212,255,${L.al*edge})`;
          sg.beginPath();sg.arc(x,y,sz*u/2,0,TAU);sg.fill();
        }
      }
      g.save();g.translate(cx,cx);g.rotate(t*L.sp);
      L.sprites.forEach((sprite,i)=>{const tw=.65+.35*Math.sin(t*1.3+(i+.5)*TAU/4);
        g.globalAlpha=tw*(.35+.65*vol)*(.25+.75*vol);g.drawImage(sprite,-cx,-cx,S,S);
      });g.restore();
    }
    for(const f of O.flares){const k=Math.pow(Math.max(0,Math.sin(t*f.sp+f.ph)),8)*vol;if(k<.02)continue;const an=f.a+t*.07,x=cx+Math.cos(an)*f.d*R,y=cx+Math.sin(an)*f.d*R,Lr=(8+14*k)*u;
      for(const [dx,dy] of [[1,0],[0,1]]){const gr=g.createLinearGradient(x-dx*Lr,y-dy*Lr,x+dx*Lr,y+dy*Lr);gr.addColorStop(0,'rgba(220,200,255,0)');gr.addColorStop(.5,`rgba(250,245,255,${.9*k})`);gr.addColorStop(1,'rgba(220,200,255,0)');
        g.strokeStyle=gr;g.lineWidth=1.2*u;g.beginPath();g.moveTo(x-dx*Lr,y-dy*Lr);g.lineTo(x+dx*Lr,y+dy*Lr);g.stroke();}}
    g.globalCompositeOperation='source-over';}
  if(mus.sylN!==O.ls&&mus.sylN%2===0){O.ls=mus.sylN;if(vol>.02){beatDust(O,.6,'200,180,255',.5+.4*Math.random());for(const p of O.parts.slice(-6))p.type='arc';}}
  drawDust(O,dt,'200,180,255');
  rim(g,S);label(g,S,'OTHER');}

// live music -> the same signals the previews used
const MUS={};
function musFor(key,motion,dt){const m=MUS[key]||(MUS[key]={t:0,hits:0,lastHit:{s:1},voice:0,accent:0,bass:0,syl:0,sylN:0,bassHits:0,prev:0,lastSyl:-9,lastAcc:-9,lastBoom:-9,mh:motion.hits});
  m.t+=dt;m.syl*=Math.exp(-dt/.18);m.accent*=Math.exp(-dt/.5);m.bass*=Math.exp(-dt/.6);
  const lv=Math.min(1,motion.level*1.25);m.voice=lv;
  if(lv>m.prev+.035&&m.t-m.lastSyl>.2){m.syl=.6+.4*Math.min(1,lv*1.5);m.sylN++;m.lastSyl=m.t;}
  if(lv>.55&&lv>m.prev&&m.t-m.lastAcc>1.6){m.accent=1;m.lastAcc=m.t;}
  m.prev+=(lv-m.prev)*Math.min(1,dt/.08);
  if(motion.hits!==m.mh){m.mh=motion.hits;
    if(key==='drums'){if(m.t-m.lastBoom>.42){m.lastBoom=m.t;m.hits++;m.lastHit={s:Math.max(.6,Math.min(1,motion.beat+.2))};}}
    else if(key==='bass'){m.bass=1;m.bassHits++;}}
  return m;}
let lastNow=0;const lastT={};
function render(key,amount,motion){const now=performance.now()/1000,dt=Math.max(0,Math.min(.05,now-(lastT[key]??now)));lastT[key]=now;
  vol=Math.max(0,Math.min(1,amount));mus=musFor(key,motion,dt);
  if(key==='vocals'){drawVocalsOrig(VO[0],dt);return VO[0].c;}
  if(key==='bass'){drawBass(dt);return B.c;}
  if(key==='other'){drawOther(dt);return O.c;}
  drawDrum(DR[0],dt);return DR[0].c;}
return {render};
})();

    // ===== Second interface: approved visuals, linked to the instrument by COLOUR only =====
    // (same colour as the instrument on the first interface; gestures and values unchanged)
    const NFX_PAL={vocals:'y',bass:'b',drums:'v',other:'p'};
    // First-interface visuals live on a square canvas; fade their outer glow out in a
    // circle so the canvas edge never shows as a square (e.g. over the camera image).
    const FUI_MASK={};
    function fuiRoundMask(key,cv){const W=cv.width;let m=FUI_MASK[key];
      if(!m||m.c.width!==W){const c=document.createElement('canvas');c.width=c.height=W;m=FUI_MASK[key]={c,g:c.getContext('2d')};}
      const g=m.g,h=W/2,k=W/640;g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,W,W);g.drawImage(cv,0,0);
      g.globalCompositeOperation='destination-in';const gr=g.createRadialGradient(h,h,262*k,h,h,316*k);
      gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,W,W);g.globalCompositeOperation='source-over';return m.c;}
    const NFX_MOD={reverb:NFX_REVERB,delay:NFX_DELAY,filter:NFX_FILTER};
    // Effect visuals are drawn on black; turn that black into transparency so the
    // circle shows the game's own background (only light is added, never a dark fill).
    const NFX_ALPHA=(()=>{const c=document.createElement('canvas');c.width=c.height=512;
      const gl=c.getContext('webgl',{premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false,alpha:true});
      let ok=!!gl,tex,uK;
      if(ok){try{const sh=(t,src)=>{const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
        const pr=gl.createProgram();
        gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'));
        gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float k;void main(){vec3 c=clamp(texture2D(t,v).rgb,0.,1.)*k;gl_FragColor=vec4(c,max(c.r,max(c.g,c.b)));}'));
        gl.linkProgram(pr);gl.useProgram(pr);
        const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
        const loc=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
        tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
        for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.viewport(0,0,512,512);uK=gl.getUniformLocation(pr,'k');}catch(e){console.error(e);ok=false;}}
      const c2=document.createElement('canvas');c2.width=c2.height=512;const g2=c2.getContext('2d',{willReadFrequently:true});
      return {run(src,fade){fade=fade??1;
        if(ok){gl.uniform1f(uK,fade);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);return c;}
        g2.clearRect(0,0,512,512);g2.globalAlpha=1;g2.fillStyle='#000';g2.fillRect(0,0,512,512);g2.globalAlpha=fade;g2.drawImage(src,0,0,512,512);g2.globalAlpha=1;const im=g2.getImageData(0,0,512,512),d=im.data;
        for(let i=0;i<d.length;i+=4){const m=Math.max(d[i],d[i+1],d[i+2]);if(m===0){d[i+3]=0;continue;}const k=255/m;d[i]=Math.min(255,d[i]*k);d[i+1]=Math.min(255,d[i+1]*k);d[i+2]=Math.min(255,d[i+2]*k);d[i+3]=m;}
        g2.putImageData(im,0,0);return c2;}};})();
    let fxVisualPreparation = null;
    function prepareFxVisuals() {
      if (fxVisualPreparation) return fxVisualPreparation;
      fxVisualPreparation = (async () => {
        const jobs=[];
        for(const k of ['y','b','v','p'])jobs.push(()=>NFX_DELAY.prepare(k),()=>NFX_REVERB.prepare(k));
        for(let i=0;i<jobs.length;i++){
          menuHint.textContent=`Preparing effect visuals ${i+1}/${jobs.length}...`;
          // Let loading feedback paint; never generate these textures during join.
          await new Promise(resolve=>setTimeout(resolve,30));
          try { jobs[i](); } catch(error) { console.warn('Visual preparation failed',error); }
        }
      })();
      return fxVisualPreparation;
    }

    function renderZone(i,key,kind,target,dt){
      const slot=slots[i];
      if(slot.key!==key||slot.kind!==kind){
        slot.key=key;slot.kind=kind;slot.parts=[];slot.rings=[];slot.fxParts=[];slot.waves=[];
        slot.acc=slot.fxAcc=0;slot.wallFlash=0;slot.clear=null;slot.drops=null;slot.echoes=[];slot.fire=null;slot.fireEcho=null;slot.dEchoes=null;slot.echoPool=null;slot.fmask=null;slot.flen=null;slot.persist=null;slot.snaps=null;slot.lastSnap=-9;slot.clear=null;slot.drops=null;slot.lastHits=stemMotion[key].hits;
      }
      slot.clock+=dt;
      const box=orbEls[i].getBoundingClientRect();
      if(kind==='quit'||!box.width)return;
      const motion=stemMotion[key],t=motion.time;
      const L=slot.layer.getContext('2d');
      L.setTransform(1,0,0,1,0,0);L.globalAlpha=1;L.globalCompositeOperation='source-over';L.filter='none';
      L.clearRect(0,0,512,512);
      const F=slot.frame.getContext('2d');
      F.setTransform(1,0,0,1,0,0);F.globalAlpha=1;F.globalCompositeOperation='source-over';F.filter='none';
      F.clearRect(0,0,512,512);
      dst=F;
      // Eased amounts so growth always looks organic.
      slot.shown+=(target-slot.shown)*(1-Math.exp(-dt/.2));
      const a=slot.shown;
      const tint=key==='vocals'?'255,210,30':key==='bass'?'60,185,255':TINT[key];

      if(kind==='volume'){
        instrumentDrawers[key](L,slot,a,t,dt,motion,{});
        drawLayer(slot.layer,.95);
      } else if(NFX_MOD[kind]){
        // Do not animate invisible FX. Preserve the eased fade-out.
        const fade=Math.min(1,a/.08),fk=fade*fade*(3-2*fade);
        const cv=fk>.002 ? NFX_MOD[kind].render(NFX_PAL[key],clamp01(target),Math.min(.1,dt)) : null;
        if(cv&&fk>.002){const cvA=NFX_ALPHA.run(cv,fk);F.imageSmoothingQuality='high';F.globalCompositeOperation='source-over';F.drawImage(cvA,0,0,512,512);}
      } else {
        // FX screens: the instrument stays visible at 0%, then each effect reshapes it.
        const P=.16+a*.34; // same timing as the audio delay line
        // Delay in steps: the instrument only advances on each delay beat (stop-motion).
        const delayStep=kind==='delay'&&a>.02;
        let ticked=false;
        if(!delayStep||slot.clock-(slot.lastSnap??-9)>=P){
          const stepDt=delayStep?Math.min(.6,slot.clock-(slot.lastSnap??-9)):dt;
          if(kind==='filter')drawFullBase(L,key);
          else drawDelayBase(L,key,a);
          ticked=true;
        }
        const fx=slot.fxParts;

        if(kind==='reverb'){
          // REVERB = frosted glass. 0% is clear glass (dry); more reverb fogs it up (wet).
          // Droplets run down and wipe clear streaks that slowly fog over again (the reverb tail).
          if(!slot.clear){slot.clear=makeCanvas(512);slot.haze=makeCanvas(512);slot.drops=[];}
          const f=Math.min(1,a*(1+.07*Math.sin(t*.55)));
          const C=slot.clear.getContext('2d');
          const tau=.5+3.5*a,keep=Math.exp(-dt/tau);
          C.globalCompositeOperation='destination-out';C.fillStyle=`rgba(0,0,0,${1-keep})`;C.fillRect(0,0,512,512);
          C.globalCompositeOperation='source-over';
          if(a>.05)spawn(slot,'fxAcc',.35+.9*a,dt,()=>{
            slot.drops.push({x:90+Math.random()*332,y:40+Math.random()*120,vy:0,r:4+Math.random()*4,life:0,max:4+Math.random()*3,stick:0});
          });
          const beat=motion.beat*(key==='drums'?1:.3);
          for(let d=slot.drops.length-1;d>=0;d--){
            const q=slot.drops[d];q.life+=dt;
            // Stick-slip motion like real condensation: pause, then slide.
            q.stick-=dt;
            if(q.stick<=0){q.vy=40+Math.random()*90;if(Math.random()<.04*60*dt)q.stick=.15+Math.random()*.5;}
            const px=q.x,py=q.y;
            if(q.stick<=0){q.y+=q.vy*dt;q.x+=Math.sin(q.y*.05+q.r)*.4;}
            const jx=Math.sin(slot.clock*40+q.r)*beat*2.5;
            C.strokeStyle='rgba(255,255,255,1)';C.lineCap='round';C.lineWidth=q.r*2.1;
            C.beginPath();C.moveTo(px+jx,py);C.lineTo(q.x+jx,q.y+.01);C.stroke();
            q.jx=jx;
            if(q.y>480||q.life>q.max)slot.drops.splice(d,1);
          }
          // Fogged view: heavily blurred material behind milky glass.
          drawLayer(slot.layer,(.25+.75*f),1.04,`blur(${(4+16*f).toFixed(1)}px) brightness(${(1+.25*f).toFixed(2)})`);
          drawLayer(slot.layer,1-.92*f);
          // Milky frost, wiped away where droplets have run.
          if(!grainPattern)grainPattern=F.createPattern(grainCanvas,'repeat');
          const H=slot.haze.getContext('2d');
          H.globalCompositeOperation='source-over';H.clearRect(0,0,512,512);
          H.fillStyle=`rgba(205,215,228,${.13*f})`;H.fillRect(0,0,512,512);
          if(grainPattern){H.globalAlpha=.06*f;H.fillStyle=grainPattern;H.fillRect(0,0,512,512);H.globalAlpha=1;}
          H.fillStyle=`rgba(${tint},${(.06+.18*beat)*f})`;H.fillRect(0,0,512,512);
          H.globalCompositeOperation='destination-out';H.globalAlpha=.6;H.drawImage(slot.clear,0,0);H.globalAlpha=1;
          drawLayer(slot.haze,1);
          // Sharp material visible through the clear streaks.
          const T=slot.tmp.getContext('2d');
          T.globalCompositeOperation='source-over';T.globalAlpha=1;T.filter='none';T.clearRect(0,0,512,512);
          T.drawImage(slot.layer,0,0);T.globalCompositeOperation='destination-in';T.drawImage(slot.clear,0,0);
          T.globalCompositeOperation='source-over';
          drawLayer(slot.tmp,f);
          // The droplets themselves: small glossy beads lit by the instrument's colour.
          for(const q of slot.drops){
            const x=q.x+(q.jx||0),y=q.y;
            const g=F.createRadialGradient(x-q.r*.3,y-q.r*.35,0,x,y,q.r*1.3);
            g.addColorStop(0,`rgba(255,255,255,${.9*f})`);g.addColorStop(.35,`rgba(${tint},${.6*f})`);g.addColorStop(1,`rgba(${tint},0)`);
            F.fillStyle=g;F.beginPath();F.arc(x,y,q.r*1.3,0,Math.PI*2);F.fill();
          }
        } else if(kind==='delay'){
          // DELAY = stop-motion with after-images. One full pattern fills the circle; it moves
          // in steps on every delay beat (step length = delay time) and each old frame lingers
          // as a fading after-image (how many linger = feedback, each one fainter).
          if(!slot.snaps)slot.snaps=[0,1,2,3,4].map(()=>makeCanvas(512));
          if(!delayStep){
            drawLayer(slot.layer,.95);
          } else {
            if(ticked){
              slot.lastSnap=slot.clock;slot.flash=1;
              const oldest=slot.snaps.pop(),oc=oldest.getContext('2d');
              oc.clearRect(0,0,512,512);oc.drawImage(slot.layer,0,0);slot.snaps.unshift(oldest);
            }
            slot.flash=(slot.flash??0)*Math.exp(-dt*7);
            // Echo pulses: on every delay beat a ring of the material travels out to the rim.
            if(ticked)(slot.echoes||(slot.echoes=[])).push({life:0});
            const r0=Math.sqrt(a)*262*.55,T=P*3;
            const E=slot.tmp.getContext('2d');
            for(let e=slot.echoes.length-1;e>=0;e--){
              const q=slot.echoes[e];q.life+=dt;const p=q.life/T;
              if(p>=1){slot.echoes.splice(e,1);continue;}
              const r=r0+(258-r0)*p,wd=16+14*a;
              E.globalCompositeOperation='source-over';E.globalAlpha=1;E.filter='none';E.clearRect(0,0,512,512);
              E.drawImage(fxMaterial(key),-6,-6,524,524);
              E.globalCompositeOperation='destination-in';
              const g=E.createRadialGradient(256,256,Math.max(0,r-wd),256,256,r+wd);
              g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');
              E.fillStyle=g;E.fillRect(0,0,512,512);E.globalCompositeOperation='source-over';
              F.globalCompositeOperation='lighter';drawLayer(slot.tmp,(1-p)*(.75-.35*a));F.globalCompositeOperation='source-over';
            }
            const n=1+Math.round(a*3);
            for(let k=n;k>=1;k--){
              drawLayer(slot.snaps[k],.55*Math.pow(.62,k-1)*(.5+.5*a),1+.035*k*(.5+a),`blur(${(k*.8).toFixed(1)}px)`);
            }
            drawLayer(slot.snaps[0],.4+.55*a,1+.03*slot.flash,`brightness(${(1+.35*slot.flash).toFixed(2)})`);
          }
        } else if(kind==='filter'){
          // FILTER — style chosen by FILTER_STYLE ('C' smoke curtain / 'D' light-thread curtain).
          // 0% = nothing, 100% = the whole circle covered by the muffled (grey, dim, soft) sound.
          const ft=slot.clock,FMN=96,UR=250;
          if(!slot.fmask){slot.fmask=makeCanvas(FMN);slot.fimg=slot.fmask.getContext('2d').createImageData(FMN,FMN);}
          const md=slot.fimg.data,full=smooth(.95,1,a);
          const T=slot.tmp.getContext('2d');
          T.setTransform(1,0,0,1,0,0);T.globalCompositeOperation='source-over';T.globalAlpha=1;
          T.filter=`blur(${(1.8+2*a).toFixed(1)}px)`;
          T.clearRect(0,0,512,512);T.drawImage(slot.layer,0,0);T.filter='none';
          if(FILTER_STYLE==='C'){
            const edgeY=u=>-1.1+a*2.45+(fbm3(u*1.8,ft*.35,2)-.5)*.5;
            for(let y=0;y<FMN;y++)for(let x=0;x<FMN;x++){
              const u=((x+.5)/FMN*512-256)/UR,v=((y+.5)/FMN*512-256)/UR,n=fbm3(u*3,v*3-ft*.6,5);
              const e=edgeY(u),vv=v+(n-.5)*.35,al=vv<e-.12?1:vv>e+.12?0:smooth(e+.12,e-.12,vv);
              md[(y*FMN+x)*4+3]=255*Math.max(al,full);
            }
          } else {
            const n=34,lane=FMN/n;
            for(let i=0;i<n;i++){
              const len=Math.min(2.3,a*2.5*(.75+.4*fbm3(i/(n-1)*4,ft*.5,3)));
              slot.flen=slot.flen||[];slot.flen[i]=len;
              for(let y=0;y<FMN;y++){
                const v=((y+.5)/FMN*512-256)/UR,vy=smooth(-1.1+len+.02,-1.1+len-.1,v);
                for(let x=0;x<FMN;x++){
                  const u=((x+.5)/FMN*512-256)/UR,cx=(i/(n-1))*2.2-1.1,w=.032+.02*a;
                  if(Math.abs(u-cx)>.07)continue;
                  const l=Math.min(1,smooth(w+.03,w-.01,Math.abs(u-cx))+smooth(.9,1,a));
                  const o=(y*FMN+x)*4+3;md[o]=Math.max(md[o],255*Math.max(l*vy,full));
                }
              }
            }
            if(full>0)for(let o=3;o<md.length;o+=4)md[o]=Math.max(md[o],255*full);
          }
          slot.fmask.getContext('2d').putImageData(slot.fimg,0,0);
          for(let o=3;o<md.length;o+=4)md[o]=0;
          T.globalCompositeOperation='destination-in';T.imageSmoothingQuality='high';T.drawImage(slot.fmask,0,0,512,512);
          T.globalCompositeOperation='source-over';
          drawLayer(slot.tmp,1);
          F.globalCompositeOperation='lighter';
          if(a>.02&&a<.99){
            if(FILTER_STYLE==='C'){
              const edgeY=u=>-1.1+a*2.45+(fbm3(u*1.8,ft*.35,2)-.5)*.5;
              // Soft smoke wisps rolling along the front.
              for(let i=0;i<9;i++){const u=-1+i/4,x=256+u*UR*.95+Math.sin(ft+i)*12,y=256+edgeY(u)*UR;
                const g=F.createRadialGradient(x,y,0,x,y,48);g.addColorStop(0,'rgba(190,200,215,.16)');g.addColorStop(1,'rgba(190,200,215,0)');
                F.fillStyle=g;F.beginPath();F.arc(x,y,48,0,Math.PI*2);F.fill();}
              // Embers drifting down out of the smoke.
              spawn(slot,'fxAcc',a*14,dt,()=>{const u=Math.random()*2-1;
                fx.push({x:256+u*UR,y:256+edgeY(u)*UR,vx:(Math.random()-.5)*6,vy:14+Math.random()*22,life:0,max:1.4+Math.random()*1.6,r:1+Math.random()*1.4});});
            } else {
              // Each thread: a faint line with a twinkling bead at its tip.
              const n=34;
              for(let i=0;i<n;i++){const cx=256+((i/(n-1))*2.2-1.1)*UR,y=256+(-1.1+slot.flen[i])*UR,tw=.6+.4*Math.sin(ft*4+i*1.7);
                F.strokeStyle=`rgba(${tint},${.2*tw})`;F.lineWidth=1.4;F.beginPath();F.moveTo(cx,0);F.lineTo(cx,y);F.stroke();
                glowDot(F,cx,y,2.6,tint,.85*tw);glowDot(F,cx,y,1.2,'255,255,255',.7*tw);}
            }
          }
          stepParticles(fx,dt);
          for(const p of fx){const k=Math.sin(Math.PI*p.life/p.max);glowDot(F,p.x,p.y,p.r,tint,k*.6);}
          F.globalCompositeOperation='source-over';
        }
      }

      softCircle(F,250,258);
      if(!NFX_MOD[kind] && kind==='reverb' && slot.wallFlash>.01){
        // The room's wall lights up where the waves hit it (still inside the circle).
        F.globalCompositeOperation='lighter';
        ringStroke(F,236,18,tint,slot.wallFlash*.16*a);
        ringStroke(F,244,3,tint,slot.wallFlash*.55*a);
        F.globalCompositeOperation='source-over';
      }
      const output=materialViews[i].ctx;
      output.setTransform(1,0,0,1,0,0);
      output.clearRect(0,0,512,512);
      output.drawImage(slot.frame,0,0,512,512);
    }

    let lastVisualTick=null,visualBatch=0;
    const lastZoneTick=[null,null,null,null];
    function visualTick(now){
      requestAnimationFrame(visualTick);
      if(document.hidden || !['mix','intro'].includes(state.phase)){
        lastVisualTick=null;lastZoneTick.fill(null);return;
      }
      // Two orbs per display callback: each orb still targets 30 Hz on a 60 Hz display.
      // Retain each orb's last frame instead of rebuilding a full-screen composite.
      if(lastVisualTick!==null && now-lastVisualTick<1000/60-.5)return;
      const elapsed=lastVisualTick===null?1000/60:Math.min(now-lastVisualTick,100);
      lastVisualTick=now;
      const dt=elapsed/1000*(motionPreference.matches?.25:1);
      updateStemMotion(dt,now/1000);materialTime+=dt;
      const indices=visualBatch++%2 ? [1,3] : [0,2];
      if(state.mode!=='effects'){renderMaterials(indices);return;}
      renderMaterials();
      for(const i of indices){
        const kind=effectKeys[i],key=tracks[state.effectTrack].key;
        const visualKind={chorus:'reverb',tremolo:'delay',distortion:'filter',beat_repeat:'delay'}[kind] || kind;
        const zoneDt=lastZoneTick[i]===null?1/30:Math.min(.1,(now-lastZoneTick[i])/1000);
        lastZoneTick[i]=now;
        renderZone(i,key,visualKind,fxAmount(kind,state.effectTrack),zoneDt);
      }
    }
    requestAnimationFrame(visualTick);


    // ===== Main page v11 =====
    // Size logic is the v9 main page (grows with volume, may overflow the rim near 100%,
    // stops before neighbouring zones). On top of it each stem gets its own living effect.
    // Units: orb box = 0..512, centre 256, rim 256.
    const SPAN=760,OFF=124,SC=512/SPAN;                 // work canvases cover units -124..636
    const mainWork=[0,1,2,3].map(()=>({W:makeCanvas(512),M:makeCanvas(256),rings:[],parts:[],ripples:[],flares:[],
      last:-1,lastHits:0,acc:0,emit:0,lastRipple:0}));
    function workCtx(cv,px){const c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';
      c.globalAlpha=1;c.filter='none';c.clearRect(0,0,cv.width,cv.height);c.setTransform(SC*px,0,0,SC*px,OFF*SC*px,OFF*SC*px);return c;}
    function maskInto(W,M){W.save();W.setTransform(1,0,0,1,0,0);W.globalCompositeOperation='destination-in';W.drawImage(M.canvas,0,0,512,512);W.restore();W.globalCompositeOperation='source-over';}
    function v9Radius(amount,box,centerBox){
      const cx=box.left+box.width/2,cy=box.top+box.height/2;
      const left=cx<innerWidth/2?0:innerWidth/2,top=cy<innerHeight/2?0:innerHeight/2;
      const coreDistance=Math.hypot(cx-centerBox.left-centerBox.width/2,cy-centerBox.top-centerBox.height/2);
      const maxPixels=Math.max(0,Math.min(cx-left,left+innerWidth/2-cx,cy-top,top+innerHeight/2-cy,
        coreDistance-Math.max(centerBox.width,centerBox.height)/2-14)-2);
      const limit=maxPixels*512/box.width;
      const nearFull=Math.max(0,Math.min(1,(amount-.15)/.65)),overflow=nearFull*nearFull*(3-2*nearFull);
      return {radius:Math.min(256*amount*(1+overflow),limit*256/251),limit};
    }

    // Star texture with its dark background turned transparent (no black disc).
    let starAlphaTex=null;
    function getStarTex(){
      if(starAlphaTex||!rawTextures.other)return starAlphaTex;
      const c=makeCanvas(512),g=c.getContext('2d');g.drawImage(rawTextures.other,0,0);
      const img=g.getImageData(0,0,512,512),d=img.data;
      for(let i=0;i<d.length;i+=4){
        const m=Math.max(d[i],d[i+1],d[i+2]),al=clamp01((m-38)/150);
        d[i]=Math.min(255,d[i]*1.15+10);d[i+1]=Math.min(255,d[i+1]*1.1+6);d[i+2]=Math.min(255,d[i+2]*1.12+18);d[i+3]=al*255;
      }
      g.putImageData(img,0,0);
      // Round off the square image so rotation never shows corners.
      g.globalCompositeOperation='destination-in';
      const e=g.createRadialGradient(256,256,200,256,256,250);e.addColorStop(0,'#fff');e.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=e;g.fillRect(0,0,512,512);
      starAlphaTex=c;return c;
    }

    // ---- Fire: a molten core that keeps launching rings of flame outward, like ripples of fire ----
    function drawFireMain(ctx,st,a,R,t,dt,lvl,beat){
      const rate=(1.4+2.6*lvl+1.2*beat)*(.45+1.05*a);
      st.emit+=dt*rate;
      while(st.emit>=1){st.emit--;st.rings.push({p:0,n:7+Math.floor(Math.random()*7),ph:Math.random()*6.283,
        spin:(Math.random()-.5)*1.2,life:1.15+.55*a+Math.random()*.3,k:.75+.35*Math.random()});}
      const W=workCtx(st.W,1);
      W.drawImage(animateMaterial('vocals',null,true),256-380,256-380,760,760);
      const M=workCtx(st.M,.5);M.filter='blur(1.2px)';
      const core=Math.max(4,R*.17*(1+.35*lvl+.25*beat));
      const fireRing=(r,th,n,ph,alpha,inner)=>{
        M.fillStyle=`rgba(255,255,255,${alpha})`;M.beginPath();
        for(let i=0;i<=120;i++){
          const q=i/120*Math.PI*2;
          const lick=Math.pow(Math.max(0,Math.sin(n*q+ph+t*2.2)),5)*(.55+.45*Math.sin(3*q-t*2.7+ph));
          const ro=r+th*.5+th*1.35*lick+th*.16*Math.sin(7*q+t*4.1+ph);
          i?M.lineTo(256+Math.cos(q)*ro,256+Math.sin(q)*ro):M.moveTo(256+Math.cos(q)*ro,256+Math.sin(q)*ro);
        }
        M.closePath();
        if(inner){
          for(let i=120;i>=0;i--){
            const q=i/120*Math.PI*2,ri=Math.max(0,r-th*.5*(1+.3*Math.sin(5*q+ph-t*1.7)));
            i===120?M.moveTo(256+Math.cos(q)*ri,256+Math.sin(q)*ri):M.lineTo(256+Math.cos(q)*ri,256+Math.sin(q)*ri);
          }
          M.closePath();M.fill('evenodd');
        } else M.fill();
      };
      // Rings: born at the core, racing outward, thickening and burning out.
      for(let i=st.rings.length-1;i>=0;i--){
        const q=st.rings[i];q.p+=dt/q.life;q.ph+=q.spin*dt;
        if(q.p>=1){st.rings.splice(i,1);continue;}
        const ease=1-Math.pow(1-q.p,2.1);
        const r=core*.9+(R*1.02-core*.9)*ease;
        const th=(8+R*.13)*(.45+q.p*.95)*q.k;
        const alpha=Math.pow(1-q.p,1.25)*Math.min(1,q.p*7)*(.6+.4*a);
        fireRing(r,th,q.n,q.ph,alpha,true);
      }
      fireRing(core*.55,core*.9,9,t*1.9,1,false);   // the molten heart
      maskInto(W,M);
      // Heat haze behind, then a soft bloom pass and the sharp flames on top (depth).
      ctx.globalCompositeOperation='lighter';
      const heat=ctx.createRadialGradient(256,256,0,256,256,Math.max(1,R*1.05));
      heat.addColorStop(0,`rgba(255,120,30,${.28*a})`);heat.addColorStop(.6,`rgba(255,70,10,${.1*a})`);heat.addColorStop(1,'rgba(255,60,0,0)');
      ctx.fillStyle=heat;ctx.beginPath();ctx.arc(256,256,Math.max(1,R*1.05),0,Math.PI*2);ctx.fill();
      ctx.filter='blur(7px)';ctx.globalAlpha=.75;ctx.drawImage(st.W,-OFF,-OFF,SPAN,SPAN);
      ctx.filter='none';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      ctx.drawImage(st.W,-OFF,-OFF,SPAN,SPAN);
      ctx.globalCompositeOperation='lighter';
      const hot=ctx.createRadialGradient(256,256,0,256,256,core*1.4);
      hot.addColorStop(0,`rgba(255,240,200,${.55*a})`);hot.addColorStop(1,'rgba(255,200,120,0)');
      ctx.fillStyle=hot;ctx.beginPath();ctx.arc(256,256,core*1.4,0,Math.PI*2);ctx.fill();
      // Embers thrown off the ring fronts, swirling as they fly.
      spawn(st,'acc',a*(10+26*lvl),dt,()=>{
        const ring=st.rings[Math.floor(Math.random()*st.rings.length)];
        const rr=ring?core+(R-core)*(1-Math.pow(1-ring.p,2.1)):core;
        const th=Math.random()*Math.PI*2,sp=45+Math.random()*70;
        st.parts.push({x:256+Math.cos(th)*rr,y:256+Math.sin(th)*rr,vx:Math.cos(th)*sp-Math.sin(th)*sp*.35,vy:Math.sin(th)*sp+Math.cos(th)*sp*.35,
          life:0,max:.5+Math.random()*.9,r:.9+Math.random()*1.9});
      });
      stepParticles(st.parts,dt);
      for(const p of st.parts){if(Math.hypot(p.x-256,p.y-256)>R*1.15+10)continue;const k=1-p.life/p.max;glowDot(ctx,p.x,p.y,p.r,k>.5?'255,226,160':'255,130,50',k);}
      ctx.globalCompositeOperation='source-over';
    }

    // ---- Stars: a living nebula with depth ----
    const gasClouds=Array.from({length:8},(_,i)=>({ang:i/8*Math.PI*2+Math.random(),dist:.15+Math.random()*.55,size:.35+Math.random()*.3,
      ph:Math.random()*10,col:['150,105,255','95,120,255','205,140,255','120,90,230'][i%4]}));
    const edgePuffs=Array.from({length:18},(_,i)=>({ang:i/18*Math.PI*2,dist:.62+Math.random()*.22,size:.2+Math.random()*.16,ph:Math.random()*10}));
    function drawNebulaMain(ctx,st,a,R,t,dt,lvl,beat){
      const tex=getStarTex();
      if(!tex)return;
      const breath=1+.035*Math.sin(t*.9)+.03*lvl;
      // Coloured gas drifting slowly behind the stars.
      ctx.globalCompositeOperation='lighter';
      for(const g of gasClouds){
        const an=g.ang+t*.06,d=g.dist*R,x=256+Math.cos(an)*d,y=256+Math.sin(an)*d*.92,r=Math.max(1,g.size*R*(1+.12*Math.sin(t*.5+g.ph)));
        const al=(.07+.13*a)*(.75+.25*Math.sin(t*.8+g.ph));
        const gr=ctx.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(${g.col},${al})`);gr.addColorStop(1,`rgba(${g.col},0)`);
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      }
      // Three star layers at different depths, turning at different speeds (parallax).
      const W=workCtx(st.W,1);
      const layer=(scale,rot,alpha,blur)=>{
        W.save();W.translate(256,256);W.rotate(rot);W.globalAlpha=alpha;W.filter=blur?`blur(${blur}px)`:'none';
        const s=R*scale;W.drawImage(tex,-s,-s,2*s,2*s);W.restore();
      };
      W.globalCompositeOperation='lighter';
      layer(1.08*breath,-t*.045,.5,1.2);
      layer(.96,t*.07+1,.65,.4);
      layer(.84/breath,t*.13+2,.95,0);
      W.globalCompositeOperation='source-over';W.filter='none';W.globalAlpha=1;
      // Cloudy, irregular edge: a soft body plus drifting puffs around the rim.
      const M=workCtx(st.M,.5);M.filter='blur(2px)';
      const body=M.createRadialGradient(256,256,R*.35,256,256,R*.9);
      body.addColorStop(0,'rgba(255,255,255,1)');body.addColorStop(1,'rgba(255,255,255,0)');
      M.fillStyle=body;M.beginPath();M.arc(256,256,R*.9,0,Math.PI*2);M.fill();
      for(const p of edgePuffs){
        const an=p.ang+t*.09+.2*Math.sin(t*.4+p.ph),d=p.dist*R*(1+.06*Math.sin(t*.7+p.ph));
        const x=256+Math.cos(an)*d,y=256+Math.sin(an)*d,r=Math.max(1,p.size*R*(1+.25*Math.sin(t*.6+p.ph*2)));
        const gr=M.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(1,'rgba(255,255,255,0)');
        M.fillStyle=gr;M.beginPath();M.arc(x,y,r,0,Math.PI*2);M.fill();
      }
      maskInto(W,M);
      ctx.drawImage(st.W,-OFF,-OFF,SPAN,SPAN);
      // A few bright stars flare and twinkle with cross-shaped glints.
      while(st.flares.length<6+Math.round(a*8))st.flares.push({an:Math.random()*Math.PI*2,d:Math.sqrt(Math.random())*.8,ph:Math.random()*10,sp:.6+Math.random()*1.4,s:.6+Math.random()*.8});
      for(const f of st.flares){
        const k=Math.pow(Math.max(0,Math.sin(t*f.sp+f.ph)),6);
        if(k<.02)continue;
        const an=f.an+t*.07,x=256+Math.cos(an)*f.d*R,y=256+Math.sin(an)*f.d*R,L=(6+14*f.s)*k*(.6+.4*a);
        for(const [dx,dy] of [[1,0],[0,1]]){
          const g=ctx.createLinearGradient(x-dx*L,y-dy*L,x+dx*L,y+dy*L);
          g.addColorStop(0,'rgba(220,200,255,0)');g.addColorStop(.5,`rgba(250,245,255,${.9*k})`);g.addColorStop(1,'rgba(220,200,255,0)');
          ctx.strokeStyle=g;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-dx*L,y-dy*L);ctx.lineTo(x+dx*L,y+dy*L);ctx.stroke();
        }
        glowDot(ctx,x,y,1.4+1.6*k,'245,240,255',k);
      }
      ctx.globalCompositeOperation='source-over';
    }

    // ---- Water: the v9 whirlpool + surface ripples (no drops) ----
    function drawWaterMain(ctx,st,a,R,clipR,t,dt,motion){
      ctx.save();ctx.beginPath();ctx.arc(256,256,clipR,0,Math.PI*2);ctx.clip();
      ctx.drawImage(animateMaterial('bass',materialTime),256-R,256-R,R*2,R*2);
      const hit=motion.hits!==st.lastHits;st.lastHits=motion.hits;
      if(hit||t-st.lastRipple>.55+Math.random()*.5){
        st.lastRipple=t;const an=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*R*.72;
        st.ripples.push({x:256+Math.cos(an)*d,y:256+Math.sin(an)*d,r:1,life:0,max:1.5+Math.random()*.8,s:hit?1:.7,sz:.6+Math.random()*.6});
      }
      for(let i=st.ripples.length-1;i>=0;i--){
        const q=st.ripples[i];q.life+=dt;q.r+=dt*(26+30*q.sz)*(1-q.life/q.max*.5);
        if(q.life>q.max){st.ripples.splice(i,1);continue;}
        const k=Math.pow(1-q.life/q.max,1.3)*q.s;
        for(const f of [1,.7,.45]){
          const rr=q.r*f;
          // A dark trough just inside a bright crest reads as a real water surface.
          ctx.globalCompositeOperation='source-over';
          ctx.strokeStyle=`rgba(0,25,55,${k*.28*f})`;ctx.lineWidth=2.2;
          ctx.beginPath();ctx.ellipse(q.x,q.y+1,Math.max(.1,rr-1.6),Math.max(.1,(rr-1.6)*.88),0,0,Math.PI*2);ctx.stroke();
          ctx.globalCompositeOperation='lighter';
          ctx.strokeStyle=`rgba(200,240,255,${k*.5*f})`;ctx.lineWidth=1.3;
          ctx.beginPath();ctx.ellipse(q.x,q.y,Math.max(.1,rr),Math.max(.1,rr*.88),0,0,Math.PI*2);ctx.stroke();
        }
      }
      ctx.globalCompositeOperation='source-over';ctx.restore();
    }

    // ---- Fire (style A): soft flames streaming outward from the centre ----
    // A flowing noise field, so it is always burning (even when nothing changes)
    // and grows by letting the flames reach further, never by zooming an image.
    const NP=new Uint8Array(512);{const p=[...Array(256).keys()];let s=7;for(let i=255;i>0;i--){s=(s*16807)%2147483647;const j=s%(i+1);[p[i],p[j]]=[p[j],p[i]];}for(let i=0;i<512;i++)NP[i]=p[i&255];}
    const nFade=t=>t*t*t*(t*(t*6-15)+10),nLerp=(a,b,t)=>a+(b-a)*t;
    function nGrad(h,x,y,z){const u=h<8?x:y,v=h<4?y:h===12||h===14?x:z;return((h&1)?-u:u)+((h&2)?-v:v);}
    function noise3(x,y,z){const X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255;x-=Math.floor(x);y-=Math.floor(y);z-=Math.floor(z);
      const u=nFade(x),v=nFade(y),w=nFade(z),A=NP[X]+Y,AA=NP[A]+Z,AB=NP[A+1]+Z,B=NP[X+1]+Y,BA=NP[B]+Z,BB=NP[B+1]+Z;
      return nLerp(nLerp(nLerp(nGrad(NP[AA]&15,x,y,z),nGrad(NP[BA]&15,x-1,y,z),u),nLerp(nGrad(NP[AB]&15,x,y-1,z),nGrad(NP[BB]&15,x-1,y-1,z),u),v),
        nLerp(nLerp(nGrad(NP[AA+1]&15,x,y,z-1),nGrad(NP[BA+1]&15,x-1,y,z-1),u),nLerp(nGrad(NP[AB+1]&15,x,y-1,z-1),nGrad(NP[BB+1]&15,x-1,y-1,z-1),u),v),w)*.5+.5;}
    const fbm3=(x,y,z)=>noise3(x,y,z)*.55+noise3(x*2.1,y*2.1,z*2.1)*.3+noise3(x*4.3,y*4.3,z*4.3)*.15;
    function firePal(h,out){h=h<0?0:h>1?1:h;
      if(h<.35){const k=h/.35;out[0]=140+90*k;out[1]=15+35*k;out[2]=0;}
      else if(h<.65){const k=(h-.35)/.3;out[0]=230+25*k;out[1]=50+90*k;out[2]=5+10*k;}
      else if(h<.88){const k=(h-.65)/.23;out[0]=255;out[1]=140+80*k;out[2]=15+70*k;}
      else{const k=(h-.88)/.12;out[0]=255;out[1]=220+30*k;out[2]=85+130*k;}}
    let fireLum=null;
    function getFireLum(){
      if(fireLum||!rawTextures.vocals)return fireLum;
      const c=makeCanvas(256),g=c.getContext('2d');g.drawImage(rawTextures.vocals,0,0,256,256);
      const d=g.getImageData(0,0,256,256).data;fireLum=new Float32Array(256*256);
      for(let i=0;i<fireLum.length;i++){const R=d[i*4],G=d[i*4+1];fireLum[i]=G>0?Math.min(1,G/400+.22):R/650;}
      return fireLum;
    }
    const FN=104,FEXT=1.42,fireRGB=[0,0,0];
    function drawFireA(ctx,st,a,limit,lvl,beat){
      const lum=getFireLum();if(!lum)return;
      const now=performance.now()/1000,dt=st.fl?Math.min(.1,now-st.fl):0;st.fl=now;
      st.ft=(st.ft||0)+dt*(.85+.9*lvl+.4*beat);              // always burning; faster when singing
      const target=Math.min(1.3*Math.pow(a,.75),limit/256/1.2);
      st.Ra=st.Ra??target;st.Ra+=(target-st.Ra)*(1-Math.exp(-dt/.25)); // flames reach out / pull back smoothly
      const Ra=Math.max(.001,st.Ra),t=st.ft;
      if(!st.fireCv){st.fireCv=makeCanvas(FN);st.fireImg=st.fireCv.getContext('2d').createImageData(FN,FN);}
      const d=st.fireImg.data;d.fill(0);
      const maxR=Math.min(FEXT,Ra*1.75);
      for(let y=0;y<FN;y++)for(let x=0;x<FN;x++){
        const dx=(x-FN/2+.5)/(FN/2)*FEXT,dy=(y-FN/2+.5)/(FN/2)*FEXT,r=Math.hypot(dx,dy);
        if(r>maxR)continue;
        const cx=dx/(r||1),cy=dy/(r||1);
        const n=fbm3(cx*1.8+5,cy*1.8,r*2.6-t*1.3),tg=fbm3(cx*4.5,cy*4.5+9,r*4.2-t*2.2);
        const f=(1-r/Ra)+(n-.5)*.85+(tg-.5)*.55*Math.min(1,r/Ra);
        if(f<-.02)continue;
        const al=sm3(-.02,.32,f),h=sm3(-.1,1,f);
        const th=Math.atan2(dy,dx);
        const sx=((th/Math.PI/2+.5)*256+6*Math.sin(r*9-t*1.7)+2560)%256|0,v=(((1-r)*256+t*40)%512+512)%512,sy=(v<256?v:511-v)|0;
        const L=lum[sy*256+sx];
        firePal(h*(.75+.45*L),fireRGB);
        const o=(y*FN+x)*4;d[o]=fireRGB[0];d[o+1]=fireRGB[1];d[o+2]=fireRGB[2];d[o+3]=Math.min(255,al*255*(.8+.3*L));
      }
      st.fireCv.getContext('2d').putImageData(st.fireImg,0,0);
      const S=FEXT*256;
      ctx.imageSmoothingQuality='high';
      ctx.globalCompositeOperation='lighter';ctx.filter='blur(13px)';ctx.globalAlpha=.55;
      ctx.drawImage(st.fireCv,256-S,256-S,2*S,2*S);
      ctx.filter='none';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      ctx.drawImage(st.fireCv,256-S,256-S,2*S,2*S);
    }
    function sm3(a,b,v){const x=v<a?0:v>b?1:(v-a)/(b-a);return x*x*(3-2*x);}

    // ---- Drums (main page): elastic sound waves ----
    // Every hit kicks a spring: the body bounces outward like a drum skin and a wave of the
    // silver material rolls out past its edge. Volume sets how far the waves travel and how
    // much of the circle the body fills (nearly all of it at 100%), but the edge never stops moving.
    function drawDrumsMain(ctx,st,a,R,_t,_dt,motion){
      // Own real-time clock: the drum keeps breathing and sending waves even when silent.
      const now=performance.now()/1000,dt=st.rl?Math.min(.1,now-st.rl):0;st.rl=now;st.rt=(st.rt||0)+dt;const t=st.rt;
      const hit=motion.hits!==st.lastHits;st.lastHits=motion.hits;
      st.spr=st.spr||0;st.vel=st.vel||0;st.waves=st.waves||[];
      if(hit){st.vel+=2.4+2.2*motion.beat;st.ph=Math.random()*6.283;st.waves.push({p:0,life:.85+.3*Math.random(),s:.75+.25*motion.beat});st.lastWave=t;}
      else if(t-(st.lastWave??-9)>.6){st.lastWave=t;st.vel+=1.1;st.waves.push({p:0,life:1,s:.55});}
      for(let i=0,h=dt/4;i<4;i++){const acc=-170*st.spr-7.5*st.vel;st.vel+=acc*h;st.spr+=st.vel*h;}   // damped spring
      const spr=st.spr;
      // Material: the silver rings, turning slowly, breathing with the spring.
      const W=workCtx(st.W,1);
      W.save();W.translate(256,256);W.rotate(t*.04);const sc=1+.08*spr;W.scale(sc,sc);
      const ms=Math.max(R*1.05,110);W.drawImage(animateMaterial('drums',null,true),-ms,-ms,2*ms,2*ms);W.restore();
      // Mask: a jelly-like body + rolling wave rings.
      const M=workCtx(st.M,.5);M.filter='blur(1.5px)';
      const Rf=R*(.45+.4*a)*(1+.07*spr),ph=st.ph||0;
      M.beginPath();
      for(let i=0;i<=96;i++){
        const q=i/96*Math.PI*2,r=Rf*(1+.035*spr*Math.sin(4*q+ph)+.02*spr*Math.sin(7*q-ph)+.012*Math.sin(5*q+t*1.3));
        i?M.lineTo(256+Math.cos(q)*r,256+Math.sin(q)*r):M.moveTo(256+Math.cos(q)*r,256+Math.sin(q)*r);
      }
      M.closePath();
      const bg=M.createRadialGradient(256,256,0,256,256,Rf*1.06);
      bg.addColorStop(0,'rgba(255,255,255,1)');bg.addColorStop(.86,'rgba(255,255,255,1)');bg.addColorStop(1,'rgba(255,255,255,0)');
      M.fillStyle=bg;M.fill();
      const Rmax=R*(.8+.2*a);
      const crest=[];
      for(let i=st.waves.length-1;i>=0;i--){
        const q=st.waves[i];q.p+=dt/q.life;
        if(q.p>=1){st.waves.splice(i,1);continue;}
        const p=q.p,e=1-Math.pow(1-p,3)+.1*Math.sin(p*Math.PI*3)*(1-p);  // springy ease
        const r=Rf*.15+(Rmax-Rf*.15)*e,th=(9+R*.07)*(1-.45*p)*q.s,al=Math.pow(1-p,1.3)*(.8+.2*a);
        M.strokeStyle=`rgba(255,255,255,${al})`;M.lineWidth=th;M.beginPath();M.arc(256,256,r,0,Math.PI*2);M.stroke();
        crest.push([r,th,al]);
      }
      maskInto(W,M);
      ctx.drawImage(st.W,-OFF,-OFF,SPAN,SPAN);
      // Bright crests on the waves and a short flash at the centre on each hit.
      ctx.globalCompositeOperation='lighter';
      for(const [r,th,al] of crest){
        // A bright band rolls through the drum, with a crisp crest on its leading edge.
        ctx.strokeStyle=`rgba(225,232,248,${al*.22})`;ctx.lineWidth=th*1.3;ctx.beginPath();ctx.arc(256,256,r,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle=`rgba(240,245,255,${al*.75})`;ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(256,256,r+th*.4,0,Math.PI*2);ctx.stroke();
      }
      const fl=Math.max(0,Math.min(1,motion.beat));
      if(fl>.05){const g=ctx.createRadialGradient(256,256,0,256,256,Rf*.6);g.addColorStop(0,`rgba(235,242,255,${.35*fl*a})`);g.addColorStop(1,'rgba(235,242,255,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(256,256,Rf*.6,0,Math.PI*2);ctx.fill();}
      ctx.globalCompositeOperation='source-over';
    }

    // Approved 2026-10-12: first-interface materials only; FX keeps its own renderers.
    function approvedRingRadius(st,amount,limit){
      const now=materialTime,dt=st.approvedLast===undefined?0:Math.max(0,Math.min(.1,now-st.approvedLast));
      st.approvedLast=now;
      const target=limit*Math.pow(amount,.48)*.94;
      st.approvedRadius=st.approvedRadius===undefined?target:st.approvedRadius+(target-st.approvedRadius)*(1-Math.exp(-dt/.15));
      return Math.min(limit*.94,st.approvedRadius);
    }
    function drawGoldenVocalMain(ctx,st,amount,limit,motion){
      const R=approvedRingRadius(st,amount,limit),t=materialTime;
      if(R<1)return;
      const seed=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
      const inner=R*.44,step=R*.038,tiles=[];
      for(let i=0;i<112;i++){
        const phase=seed(i+1)*Math.PI*2;
        const wave=.5+.26*Math.sin(t*(1.1+seed(i+12)*1.6)+phase)
          +.16*Math.sin(t*(2.2+seed(i+73)*1.9)+phase*2.3)+.08*Math.sin(t*.8+phase*3.1);
        const count=Math.min(14.6,6+wave*8+motion.level*.6);
        for(let j=0;j<15;j++){
          const alpha=clamp01(count-j);if(!alpha)continue;
          const r=inner+j*step;
          tiles.push({angle:i*Math.PI*2/112,r,w:r*Math.PI*2/112*.65,h:step*.72,alpha});
        }
      }
      ctx.save();ctx.translate(256,256);
      for(let pass=0;pass<2;pass++){
        ctx.shadowColor='#ffb000';ctx.shadowBlur=pass===0?R*.045:0;
        ctx.fillStyle=pass===0?'#ffbc00':'#ffdc25';
        for(const p of tiles){
          ctx.save();ctx.rotate(p.angle);ctx.globalAlpha=p.alpha*(pass===0?.48:1);
          ctx.fillRect(p.r,-p.w/2,p.h,p.w);ctx.restore();
        }
      }
      ctx.restore();
    }
    function drawBlueWaveMain(ctx,st,amount,limit,motion){
      const R=approvedRingRadius(st,amount,limit),t=materialTime*.8;
      if(R<1)return;
      ctx.save();ctx.translate(256,256);ctx.globalCompositeOperation="lighter";
      // Interwoven filaments form ONE annulus. Crests deform; no emitted ripple copies.
      for(let family=0;family<3;family++){
        const ph=family*Math.PI*2/3;
        for(let line=0;line<24;line++){
          const u=line/23;
          ctx.beginPath();
          for(let k=0;k<=200;k++){
            const a=k/200*Math.PI*2;
            const fold=Math.sin(a*3-t*1.05+ph+u*.6);
            const swell=Math.sin(a*5+t*.71+ph*.65);
            const r=R*(.63+u*.19+(.066+.016*motion.level)*fold+.028*swell+.022*Math.sin(a*2-t*.43+u*3+ph));
            const x=Math.cos(a)*r,y=Math.sin(a)*r;
            k?ctx.lineTo(x,y):ctx.moveTo(x,y);
          }
          ctx.closePath();
          const edge=Math.pow(Math.abs(u-.5)*2,5);
          ctx.strokeStyle=`rgba(${Math.round(24+edge*112)},${Math.round(134+edge*85)},255,${.48+edge*.35})`;
          ctx.lineWidth=R*(.0032+edge*.002);
          ctx.shadowColor='#009dff';ctx.shadowBlur=edge>.7?R*.025:0;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const approvedFxTextures={};
    function approvedFxMaterial(key){
      const tick=Math.floor(materialTime*30);
      let entry=approvedFxTextures[key];
      if(!entry)entry=approvedFxTextures[key]={canvas:makeCanvas(512),tick:-1};
      if(entry.tick!==tick){
        entry.tick=tick;
        const c=entry.canvas.getContext('2d');c.clearRect(0,0,512,512);
        const draw=key==='vocals'?drawGoldenVocalMain:drawBlueWaveMain;
        draw(c,{},1,258,stemMotion[key]);
      }
      return entry.canvas;
    }

    function drawMainOrb(ctx,index,key,amount,box,centerBox){
      const st=mainWork[index],motion=stemMotion[key];
      const t=motion.mainTime,dt=st.last<0?0:Math.min(.1,Math.max(0,t-st.last));st.last=t;
      const {radius,limit}=v9Radius(amount,box,centerBox);
      const clipR=Math.min(limit,radius*251/256);
      if(radius<1)return;
      {const cv=FUI.render(key,amount,motion);const cm=fuiRoundMask(key,cv);ctx.imageSmoothingQuality='high';ctx.drawImage(cm,256-320,256-320,640,640);return;}
      if(key==='vocals')drawGoldenVocalMain(ctx,st,amount,limit,motion);
      else if(key==='bass')drawBlueWaveMain(ctx,st,amount,limit,motion);
      else if(key==='other')drawNebulaMain(ctx,st,amount,Math.min(radius,clipR),t,dt,motion.level,motion.beat);
      else if(key==='bass')drawWaterMain(ctx,st,amount,radius,clipR,t,dt,motion);
      else {
        drawDrumsMain(ctx,st,amount,Math.min(radius,clipR),t,dt,motion);
      }
    }

    function renderMaterials(indices=null) {
      document.body.classList.remove("fx-full");
      const centerBox=core.getBoundingClientRect();
      // Read layout as one batch before writing canvas and accessible labels.
      const boxes=materialViews.map(({orb})=>orb.getBoundingClientRect());
      materialViews.forEach(({orb, ctx}, index) => {
        if(indices && !indices.includes(index))return;
        const fx = state.mode === 'effects';
        const kind = fx ? effectKeys[index] : 'volume';
        const track = tracks[fx ? state.effectTrack : index];
        const amount = kind === 'quit' ? 0 : Math.max(0, Math.min(1,
          fx ? fxAmount(kind,state.effectTrack) : state.volumes[index]));
        const tick = kind === 'volume' && amount > 0 ? Math.floor(materialTime*30) : 0;
        const box=boxes[index];
        const signature = `${track.key}:${kind}:${amount}:${tick}:${innerWidth}:${innerHeight}:${centerBox.width}`;
        const texture = materialSurfaces[track.key];
        const previous=materialRenderCache[index];
        if (previous?.signature === signature && previous?.texture === texture) return;
        materialRenderCache[index] = { signature, texture, kind, key:track.key };
        const displayLevel=String(Math.round(amount*100));
        if(orb.dataset.material!==track.key || orb.dataset.effect!==kind || orb.dataset.level!==displayLevel){
          orb.dataset.material=track.key;orb.dataset.effect=kind;orb.dataset.level=displayLevel;
          orb.setAttribute('aria-label',kind==='quit'?'Quit effects, thumbs up to return':`${track.label} ${kind}, ${displayLevel} percent`);
        }
        // A parameter change must not blank a retained FX frame while its next batch waits.
        if(kind!=='volume' && kind!=='quit' && previous?.kind===kind && previous?.key===track.key)return;
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,1024,1024);
        if(kind==='volume' && amount===0 && (track.key==='vocals'||track.key==='bass')){mainWork[index].approvedRadius=0;mainWork[index].approvedLast=materialTime;}
        if (!texture || kind !== 'volume' || amount === 0) return;
        // Canvas is twice the orb: orb units 0..512 sit in the middle (256 = circle rim).
        ctx.setTransform(.5,0,0,.5,128,128);
        drawMainOrb(ctx,index,track.key,amount,box,centerBox);
      });
    }

    let uiUpdatePending=false;
    function updateUI() {
      if(uiUpdatePending)return;
      uiUpdatePending=true;
      requestAnimationFrame(()=>{uiUpdatePending=false;paintUI();});
    }
    function paintUI() {
      handPrompt.hidden = state.phase !== "join";
      helpButton.hidden = state.phase !== "mix";
      const current = tracks[state.selected];
      const volume = state.volumes[state.selected];
      document.body.classList.toggle("recording-active", state.recording);
      document.body.classList.toggle("echo", state.delay[state.selected] > 0.04);
      document.body.classList.toggle("filtering", state.filter[state.selected] > 0.04);
      document.body.style.setProperty("--hue", current.hue);
      core.style.setProperty("--hue", current.hue);
      core.style.setProperty("--amount", volume);
      core.style.transform = `scale(${0.92 + volume * 0.16})`;
      trackName.textContent = state.mode === "effects" ? `${tracks[state.effectTrack].label} FX` : current.label;
      const fadeStatus = state.fadeActive[state.selected] ? " · Fading" : "";
      if (state.mode === "effects") {
        const effectKey = effectKeys[state.selectedEffect];
        const amount = fxAmount(effectKey,state.effectTrack);
        trackMeta.textContent = `${effectNames[state.selectedEffect]} · ${effectKey === "quit" ? "Thumbs up to exit" : effectKey === 'beat_repeat' ? (amount ? 'Repeating' : 'Ready') : `${Math.round(amount * 100)}%`} · ${fxBank ? 'New FX' : 'Original FX'}`;
      } else {
        const active = [
          state.reverb[state.selected] > 0.04 ? `R ${Math.round(state.reverb[state.selected] * 100)}%` : "",
          state.delay[state.selected] > 0.04 ? `D ${Math.round(state.delay[state.selected] * 100)}%` : "",
          state.filter[state.selected] > 0.04 ? `F ${Math.round(state.filter[state.selected] * 100)}%` : ""
        ].filter(Boolean).join(" · ") || "FX Off";
        trackMeta.textContent = `Volume ${Math.round(volume * 100)}% · ${active}${fadeStatus}`;
      }

      tracks.forEach((track, index) => {
        const orb = document.getElementById(`orb-${track.key}`);
        orb.classList.remove("quit");

        if (state.mode === "effects") {
          const effectKey = effectKeys[index];
          const isQuit = effectKey === "quit";
          const amount = fxAmount(effectKey,state.effectTrack);
          orb.classList.toggle("selected", index === state.selectedEffect);
          orb.classList.toggle("quit", isQuit);
          orb.style.setProperty("--hue", isQuit ? 0 : tracks[state.effectTrack].hue);
          orb.style.setProperty("--amount", isQuit ? 0.35 : amount);
          orb.querySelector("h2").textContent = effectNames[index];
          orb.querySelector("p").textContent = isQuit ? "Exit" : effectKey==='beat_repeat' ? (amount?'Repeating':'Ready') : `${Math.round(amount * 100)}%`;
          orb.querySelector("small").textContent = isQuit ? "Thumbs up to return" : effectKey==='beat_repeat' ? 'Pinch to repeat · Thumbs up to exit' : fxBank ? tracks[state.effectTrack].label : `${tracks[state.effectTrack].label} · ${["Woven echoes", "Aurora echo bands", "Sinking underwater"][index]}`;
        } else {
          orb.classList.toggle("selected", index === state.selected);
          orb.style.setProperty("--hue", track.hue);
          orb.style.setProperty("--amount", state.volumes[index]);
          const effects = [
            state.reverb[index] > 0.04 ? " R" : "",
            state.delay[index] > 0.04 ? " D" : "",
            state.filter[index] > 0.04 ? " F" : ""
          ].join("");
          orb.querySelector("h2").textContent = track.label;
          orb.querySelector("p").textContent = `${Math.round(state.volumes[index] * 100)}%${effects}`;
          orb.querySelector("small").textContent = "Volume";
        }
      });

      recordLine.textContent = state.performanceRecording
        ? (state.recordingPaused ? "Recording Paused" : "Recording On")
        : state.recordPerformance
          ? "Recording Ready"
          : "Recording Off";

      // Active canvases are rendered only by visualTick, not every gesture update.
      if(!['mix','intro'].includes(state.phase))renderMaterials();
      if (saveButton) saveButton.disabled = !state.events.length;
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    function fingerExtended(landmarks, tip, pip) {
      return landmarks[tip].y < landmarks[pip].y;
    }

    function readGesture(landmarks) {
      const indexTip = landmarks[8];
      const thumbTip = landmarks[4];
      const thumbIp = landmarks[3];
      const palm = landmarks[9];
      const handX = indexTip.x;
      const screenX = 1 - handX;
      const handY = 1 - indexTip.y;
      const palmX = 1 - palm.x;
      const palmY = 1 - palm.y;
      const markerScreenX = screenX;
      const markerScreenTop = indexTip.y;
      const palmSize = Math.max(.015, Math.hypot(landmarks[5].x-landmarks[17].x,landmarks[5].y-landmarks[17].y));
      const pinchRatio = Math.hypot(indexTip.x-thumbTip.x,indexTip.y-thumbTip.y) / palmSize;
      const pinch = pinchRatio < .30;
      // Reserve the space around a thumb/index pinch before deciding it is a
      // thumbs-up. This keeps a pinch from beginning a mode-switch candidate
      // while its distance is still settling between camera frames.
      const pinchCandidate = pinchRatio < .46;
      let extended = 0;
      if (fingerExtended(landmarks, 8, 6)) extended++;
      if (fingerExtended(landmarks, 12, 10)) extended++;
      if (fingerExtended(landmarks, 16, 14)) extended++;
      if (fingerExtended(landmarks, 20, 18)) extended++;
      const open = extended >= 3 && !pinch;
      const fingersCurled = [[8,6],[12,10],[16,14],[20,18]].every(([tip,pip]) =>
        landmarks[tip].y >= landmarks[pip].y - palmSize*.08
      );
      const thumbRaised = thumbTip.y < thumbIp.y - palmSize*.18;
      const thumbSeparated = pinchRatio > .62;
      // Thumbs-up: thumb clearly raised, all four other fingers curled, and
      // the thumb/index pair clearly separated. Pinch always has priority.
      const thumbUp = !pinchCandidate && thumbRaised && fingersCurled && thumbSeparated;
      return { handX, screenX, handY, palmX, palmY, markerScreenX, markerScreenTop, pinchRatio, pinch, pinchCandidate, open, thumbUp };
    }

    function getZoneTrackIndex(gesture) {
      const isLeft = gesture.screenX < 0.5;
      const isTop = gesture.handY > 0.5;

      if (isLeft && isTop) return 0;
      if (isLeft && !isTop) return 1;
      if (!isLeft && isTop) return 2;
      return 3;
    }

    function getEffectIndexInZone(gesture) {
      const localX = gesture.screenX < 0.5
        ? gesture.screenX / 0.5
        : (gesture.screenX - 0.5) / 0.5;

      return localX < 0.35 ? 0 : 1;
    }

    function getVolumeInZone(gesture) {
      const isTop = gesture.handY > 0.5;
      const localY = isTop
        ? (gesture.handY - 0.5) / 0.5
        : gesture.handY / 0.5;

      return Math.max(0, Math.min(1, localY));
    }

    function enterEffectMode(trackIndex) {
      setFxBank(0);
      effectExitHands.forEach(hand => { hand.ready = false; hand.since = null; });
      state.mode = "effects";
      state.effectTrack = trackIndex;
      state.selected = trackIndex;
      state.selectedEffect = 0;
      document.getElementById("instruction").textContent = "Effects: pinch up/down · J switches FX · bottom-right thumbs up exits · M clears all";
      updateUI();
    }

    function exitEffectMode() {
      setFxBank(0);
      state.mode = "tracks";
      state.thumbReady.fill(false);
      state.thumbStart.fill(0);
      document.getElementById("instruction").textContent = "Main: pinch volume · thumbs up opens effects · M clears all effects";
      updateUI();
    }

    const effectExitHands = Array.from({ length: 2 }, () => ({ ready: false, since: null }));

    function handleGesture(gesture, handNumber = 0) {
      const now = performance.now();
      const handDot = handDots[handNumber];
      if (handDot) {
        handDot.style.opacity = 1;
        handDot.style.left = `${gesture.markerScreenX * 100}%`;
        handDot.style.top = `${gesture.markerScreenTop * 100}%`;
        handDot.classList.toggle("pinching", gesture.pinch);
        handDot.classList.toggle("openhand", gesture.open);
        handDot.classList.toggle("thumbup", gesture.thumbUp);
      }

      if (state.playback) return;

      const zoneIndex = getZoneTrackIndex(gesture);

      if (state.mode === "effects") {
        state.selectedEffect = zoneIndex;
        const effectKey = effectKeys[zoneIndex];
        gestureLine.textContent = `Hand ${handNumber + 1}: ${tracks[state.effectTrack].label} FX · ${effectNames[zoneIndex]} · Pinch ${gesture.pinch ? "On" : "Off"}`;

        const exitHand = effectExitHands[handNumber];
        if (!gesture.thumbUp) { exitHand.ready = true; exitHand.since = null; }
        if (effectKey === "quit" && gesture.thumbUp && exitHand.ready) {
          if (exitHand.since === null) exitHand.since = now;
          if (now - exitHand.since > 360) {
            exitEffectMode();
          }
        } else {
          exitHand.since = null;
        }
        if (gesture.pinch && effectKey !== "quit") {
          applyEffect(state.effectTrack, effectKey, getVolumeInZone(gesture));
        }

        return;
      }

      const trackIndex = zoneIndex;

      if (state.selected !== trackIndex) setSelected(trackIndex);

      gestureLine.textContent = `Hand ${handNumber + 1}: ${tracks[trackIndex].label} · Pinch ${gesture.pinch ? "On" : "Off"} · Thumb ${gesture.thumbUp ? "Up" : "Off"}`;

      if (gesture.thumbUp) {
        if (!state.thumbStart[trackIndex]) state.thumbStart[trackIndex] = now;
        if (state.thumbReady[trackIndex] && now - state.thumbStart[trackIndex] > 360) {
          enterEffectMode(trackIndex);
          state.thumbReady[trackIndex] = false;
          return;
        }
      } else {
        state.thumbStart[trackIndex] = 0;
        state.thumbReady[trackIndex] = true;
      }

      if (gesture.pinch) {
        setVolume(trackIndex, getVolumeInZone(gesture));
        return;
      }

      if (gesture.handY > 0.88) {
        if (!state.highStart) state.highStart = now;
        if (now - state.highStart > 420 && now - state.lastFade > 800) {
          fadeTo(trackIndex, 1);
          state.highStart = 0;
          state.lastFade = now;
        }
      } else {
        state.highStart = 0;
      }

      if (gesture.handY < 0.12) {
        if (!state.lowStart) state.lowStart = now;
        if (now - state.lowStart > 420 && now - state.lastFade > 800) {
          fadeTo(trackIndex, 0);
          state.lowStart = 0;
          state.lastFade = now;
        }
      } else {
        state.lowStart = 0;
      }
    }

    function handleStartGesture(gestures) {
      const now = performance.now();
      const instruction = document.getElementById("instruction");

      if (state.phase === "mix") {
        updateDiagnostics(gestures.length, `${gestures.length} hand${gestures.length > 1 ? "s" : ""}`);
        return true;
      }

      const first = gestures[0];

      if (state.phase === "join") {
        stateLine.textContent = "Press Start Game";
        return false;
      }

      return false;
    }

    function onResults(results) {
      if (document.hidden || state.phase === "paused" || state.phase === "ended" || state.phase === "help") return;
      if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
        processStableResults([],performance.now());
        handPrompt.textContent = "Show your hand for 3 seconds to start";
        stateLine.textContent = state.phase === "mix" ? "Show one or two hands" : "Show one hand";
        gestureLine.textContent = "Move into a quadrant";
        handDots.forEach(dot => { dot.style.opacity = 0; });
        updateDiagnostics(0, "none");
        return;
      }

      const gestures = results.multiHandLandmarks.slice(0, 2)
        .filter(points => points.length === 21 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
        .map(readGesture);
      const poseText = gestures.map((gesture, index) => {
        if (gesture.thumbUp) return `H${index + 1} thumb`;
        if (gesture.open) return `H${index + 1} open`;
        if (gesture.pinch) return `H${index + 1} pinch`;
        return `H${index + 1} neutral`;
      }).join(" · ");
      updateDiagnostics(gestures.length, poseText);

      stateLine.textContent = `${gestures.length} hand${gestures.length > 1 ? "s" : ""} connected`;
      processStableResults(gestures,performance.now());
    }

    let trackingBusy=false,lastTrackingAt=-Infinity,lastControlAt=null;
    function frame(now) {
      requestAnimationFrame(frame);
      const dt=lastControlAt===null?1/60:Math.min(.1,Math.max(0,(now-lastControlAt)/1000));
      lastControlAt=now;
      if(document.hidden){lastControlAt=null;return;}
      updateJoinCountdown(now);
      if(state.phase==='mix'){
        const fading=state.fadeActive.some(Boolean);
        updateFades(dt);updatePlayback();
        if(fading)updateUI();
      }
      if(!['ready','join','mix','intro'].includes(state.phase) || trackingBusy || now-lastTrackingAt<1000/30)return;
      if(video.readyState<2 || video.currentTime===lastVideoTime)return;
      lastVideoTime=video.currentTime;lastTrackingAt=now;trackingBusy=true;
      // One inference in flight. Never await it on the control/display loop.
      try {
        Promise.resolve(hands.send({image:video})).catch(trackingFailed).finally(()=>{trackingBusy=false;});
      } catch(error){trackingBusy=false;trackingFailed(error);}
    }
    function trackingFailed(error){
      resetGestureControls();
      stateLine.textContent='Tracking interrupted. Reconnecting...';
      console.warn('Tracking frame failed',error);
    }

    let cameraSetupBusy = false;
    async function enableCameraAndAudio() {
      if (cameraSetupBusy || state.cameraReady) return;
      cameraSetupBusy = true;
      enableButton.hidden = true;
      enableButton.disabled = true;
      enableButton.textContent = "Loading";
      menuHint.textContent = "Requesting camera permission and loading hand tracking.";
      try {
        menuHint.textContent='Requesting camera permission and loading hand tracking.';
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        cameraStream = stream;
        video.srcObject = stream;
        await video.play();
        cameraStatus.textContent = "ready";
        // Audio activation belongs to the user's Start click, not page load.
        setupAudio();
        if (!songReady) await loadSelectedSong();
        await prepareFxVisuals();

        hands = new Hands({
          locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: .5,
          minTrackingConfidence: .5
        });
        hands.onResults(onResults);
        modelStatus.textContent = "loaded";
        state.phase = "ready";
        stateLine.textContent = "Camera ready";
        enableButton.textContent = "Camera Enabled";
        menuHint.textContent = "Camera is ready. Show one hand to confirm tracking.";
        updateUI();
        updateDiagnostics(0, "none");
        requestAnimationFrame(frame);
      } catch (error) {
        stateLine.textContent = "Camera permission unavailable";
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        video.srcObject = null;
        hands = null;
        state.cameraReady = false;
        state.modelReady = false;
        startButton.disabled = true;
        enableButton.hidden = false;
        enableButton.disabled = false;
        enableButton.textContent = "Retry Camera";
        menuHint.textContent = "Camera setup failed. Check browser permission and connection, then retry.";
        console.warn("Camera setup failed", error);
      } finally {
        cameraSetupBusy = false;
      }
    }

    /* STEM_INTRO_CONTROLS */
// Pure temporal tracking, shared by the single-file game and synthetic tests.
class StemGestureGate {
  constructor() { this.slots = [null, null]; this.presentSince = null; this.lastFrame = null; }
  reset() { this.slots = [null, null]; this.presentSince = null; this.lastFrame = null; }
  update(input, now) {
    if (this.lastFrame !== null && now - this.lastFrame > 900) this.reset();
    this.lastFrame = now;
    const valid = input.filter(g => [g.screenX,g.handY,g.palmX,g.palmY,g.pinchRatio].every(Number.isFinite));
    if (!valid.length) { this.reset(); return []; }
    if (this.presentSince === null) this.presentSince = now;
    const remaining = new Set([0,1]), matches = new Map();
    // Match all existing hands before assigning new slots; detection order may change.
    const pairs = [];
    valid.forEach((g,i) => this.slots.forEach((s,j) => {
      if (s) pairs.push({i,j,d:Math.hypot(g.palmX-s.palmX,g.palmY-s.palmY)});
    }));
    pairs.sort((a,b) => a.d-b.d).forEach(p => {
      if (p.d < .28 && !matches.has(p.i) && remaining.has(p.j)) { matches.set(p.i,p.j); remaining.delete(p.j); }
    });
    valid.forEach((g,i) => { if (!matches.has(i) && remaining.size) { const j=remaining.values().next().value; matches.set(i,j); remaining.delete(j); this.slots[j]=null; } });
    remaining.forEach(j => { this.slots[j]=null; });
    return valid.slice(0,2).map((g,i) => {
      const id=matches.get(i), old=this.slots[id];
      const s=old || {pinch:false,pending:null,thumbSince:null,thumbLatched:true,zone:null,last:now};
      const dt=Math.max(0,now-s.last), alpha=old?1-Math.exp(-dt/65):1;
      s.x=old?s.x+(g.screenX-s.x)*alpha:g.screenX;
      s.y=old?s.y+(g.handY-s.y)*alpha:g.handY;
      const want=g.pinchRatio < (s.pinch?.43:.30);
      if (want===s.pinch) s.pending=null;
      else if (s.pending===null) s.pending=now;
      else if (now-s.pending>=90) { s.pinch=want; s.pending=null; }
      if (!g.thumbUp || s.pinch) { s.thumbSince=null; s.thumbLatched=false; }
      let thumbFire=false;
      if (g.thumbUp && !s.pinch && !s.thumbLatched) {
        if (s.thumbSince===null) s.thumbSince=now;
        if (now-s.thumbSince>=450) { thumbFire=true; s.thumbLatched=true; }
      }
      let left=s.zone===null?s.x<.5:[0,1].includes(s.zone);
      let top=s.zone===null?s.y>.5:[0,2].includes(s.zone);
      if (s.x<.46) left=true; else if(s.x>.54) left=false;
      if (s.y<.46) top=false; else if(s.y>.54) top=true;
      s.zone=left?(top?0:1):(top?2:3);
      Object.assign(s,{last:now,palmX:g.palmX,palmY:g.palmY}); this.slots[id]=s;
      return {...g,id,screenX:s.x,handY:s.y,markerScreenX:s.x,markerScreenTop:1-s.y,pinch:s.pinch,thumbFire,zone:s.zone};
    });
  }
  ready(now) { return this.presentSince!==null && now-this.presentSince>=3000; }
}

const gestureGate = new StemGestureGate();
const introSteps = [
  ['Vocal volume','In the top-left Vocal area, pinch thumb and index finger. Keep pinching and move up or down. Release to keep the level.','Adjust the volume, then pinch Next.'],
  ['Open effects','Release your fingers. In the top-left Vocal area, give a thumbs-up and hold briefly.','Open Vocal FX, then pinch Next.'],
  ['Try Reverb','Pinch in the top-left Reverb area and move up or down. Listen to the space around the voice.','Change Reverb, then pinch Next.'],
  ['Try Delay','Pinch in the bottom-left Delay area and move up or down. Listen for repeated echoes.','Change Delay, then pinch Next.'],
  ['Try Filter','Pinch in the top-right Filter area and move up or down. Listen to the voice become brighter or softer.','Change Filter, then pinch Next.'],
  ['Leave effects','In the bottom-right Quit area, give a thumbs-up. Pinching does not exit effects.','Return to tracks, then pinch Next.'],
  ['Ready to remix','All four tracks are yours. Pinch to mix volume. Thumbs-up opens FX. Space pauses. M clears effects.','Pinch Start remix when you are ready.']
];
const intro = {active:false,step:0,done:false,nextSince:null,nextOwner:null,nextArmed:false,min:.55,max:.55};
let selectedSession='intro', pausedFrom='mix';
let dragOwner=null, gestureModeAt=0, joinFrameAt=0;
const dragHands=[null,null];
const fadeHands=[null,null];
function resetGestureControls() { releaseGestureRepeat(); gestureGate.reset(); dragHands.fill(null); fadeHands.fill(null); dragOwner=null; intro.nextSince=null; intro.nextOwner=null; intro.nextArmed=false; }
function introRender() {
  const panel=document.getElementById('introPanel'), next=document.getElementById('introNext');
  panel.hidden=next.hidden=!intro.active || state.phase==='paused';
  document.body.classList.toggle('intro-active',intro.active);
  document.body.classList.toggle('intro-volume',intro.active && [0,1,6].includes(intro.step));
  if(!intro.active || state.phase==='paused')return;
  next.hidden=intro.step===5&&!intro.done;
  document.getElementById('introCount').textContent=`PRACTICE ${intro.step+1} / ${introSteps.length} · VOCAL ONLY`;
  document.getElementById('introTitle').textContent=introSteps[intro.step][0];
  document.getElementById('instruction').textContent=`Intro: ${introSteps[intro.step][0]} · Space pauses`;
  document.getElementById('introText').textContent=introSteps[intro.step][1];
  const practice=[0,2,3,4].includes(intro.step);
  document.getElementById('introStatus').textContent=intro.done?'Nice! Keep experimenting, or continue.':practice?`Practice ${Math.min(100,Math.round((intro.max-intro.min)/.08*100))}% · ${introSteps[intro.step][2]}`:introSteps[intro.step][2];
  const thumb=[1,5].includes(intro.step), image=document.getElementById('introGesture');
  image.textContent=thumb?'👍':'🤏';image.setAttribute('aria-label',thumb?'Thumb pointing up, other fingers curled':'Thumb and index finger pinched together');
  document.getElementById('introMotion').textContent=thumb?'Hold briefly':intro.step===6?'Pinch Start remix':'Pinch + move up / down';
  next.disabled=!intro.done; next.textContent=intro.step===6?'Start remix':'Next';
}
function beginIntro() {
  if (!audioContext || !state.cameraReady || !state.modelReady || !state.handReady) return;
  preflight.classList.add('hidden'); handPrompt.hidden=true;
  state.phase='intro'; intro.active=true; intro.step=0; intro.done=false;
  resetMixState(); tracks.forEach((_,i)=>setVolume(i,i===0?.55:0,false));
  resetGestureControls(); restartAll(); introRender();
  prepareIntroStep();
}
function armSelectedSession() {
  if(!['setup','ready','join'].includes(state.phase)||!audioContext||!state.cameraReady||!state.modelReady||!songReady)return;
  selectedSession=document.getElementById('sessionIntro').checked?'intro':'mix';
  resetGestureControls(); state.phase='join'; preflight.classList.add('hidden');
  handPrompt.textContent='Show your hand for 3 seconds to start';handPrompt.hidden=false;
}
function prepareIntroStep() {
  clearEffects(false); setVolume(0,.55,false);
  state.mode=intro.step>=2&&intro.step<=5?'effects':'tracks';state.effectTrack=0;
  state.selectedEffect=Math.min(3,Math.max(0,intro.step-2));
  const key={2:'reverb',3:'delay',4:'filter'}[intro.step];
  if(key)applyEffect(0,key,.5,false);
  intro.min=intro.max=key ? .5 : .55;
  intro.done=intro.step===6;resetGestureControls();introRender();updateUI();
}
function finishIntro() {
  intro.active=false;hideOverlay(pauseOverlay);introRender();resetGestureControls();resetMixState();
  state.phase='join';startMixer();
}
function advanceIntro() {
  if (!intro.active || !intro.done) return;
  if(intro.step===6){
    finishIntro();return;
  }
  intro.step++; intro.done=intro.step===6;
  prepareIntroStep();
}
function skipIntroStep() {
  if(!intro.active||state.phase!=='paused')return;
  if(intro.step===6){finishIntro();return;}
  intro.step++;state.phase='intro';hideOverlay(pauseOverlay);prepareIntroStep();playAll();
}
function skipIntroAll() { if(intro.active&&state.phase==='paused')finishIntro(); }
function completeIntro() { if(intro.active&&!intro.done){intro.done=true;introRender();} }
function gestureNext(g,now) {
  if(!intro.active)return false;
  if(g.thumbUp)return false;
  const box=document.getElementById('introNext').getBoundingClientRect();
  const inside=g.screenX*innerWidth>=box.left && g.screenX*innerWidth<=box.right && (1-g.handY)*innerHeight>=box.top && (1-g.handY)*innerHeight<=box.bottom;
  if(inside && !g.pinch) intro.nextArmed=true;
  if(!inside || !g.pinch || !intro.done || !intro.nextArmed){
    if(intro.nextOwner===g.id){intro.nextOwner=null;intro.nextSince=null;}
    document.getElementById('introNext').style.setProperty('--hold','0%');
    return inside;
  }
  if(intro.nextOwner===null){intro.nextOwner=g.id;intro.nextSince=now;}
  if(intro.nextOwner===g.id){
    const p=Math.min(1,(now-intro.nextSince)/650);
    document.getElementById('introNext').style.setProperty('--hold',`${p*100}%`);
    if(p===1)advanceIntro();
  }
  return true;
}
function routeStableGesture(g,now) {
  const dot=handDots[g.id];
  dot.style.opacity=1;dot.style.left=`${g.markerScreenX*100}%`;dot.style.top=`${g.markerScreenTop*100}%`;
  dot.classList.toggle('pinching',g.pinch);dot.classList.toggle('thumbup',g.thumbUp);
  if(gestureNext(g,now)){dragHands[g.id]=null;if(dragOwner===g.id)dragOwner=null;return;}
  if(now-gestureModeAt<600 || state.playback)return;
  const fx=state.mode==='effects', zone=g.zone, key=fx?effectKeys[zone]:'volume';
  const heldDrag=dragOwner===null?null:dragHands[dragOwner];
  const displayZone=heldDrag?effectKeys.indexOf(heldDrag.key):zone;
  if(fx && displayZone>=0 && state.selectedEffect!==displayZone){state.selectedEffect=displayZone;updateUI();}
  if(g.thumbFire && dragOwner===null){
    if(fx && (key==='quit'||key==='beat_repeat') && (!intro.active||intro.step===5)){
      exitEffectMode();gestureModeAt=now;
      if(intro.active)completeIntro();return;
    }
    if(!fx && (!intro.active||(intro.step===1&&zone===0))){
      enterEffectMode(zone);gestureModeAt=now;
      if(intro.active)completeIntro();return;
    }
  }
  if(!g.pinch){
    if(gestureRepeat?.hand===g.id){releaseGestureRepeat();updateUI();}
    dragHands[g.id]=null;if(dragOwner===g.id)dragOwner=null;
    const target=g.handY>.88?1:g.handY<.12?0:null;
    if(!intro.active && !fx && g.open && target!==null){
      const f=fadeHands[g.id];
      if(!f||f.zone!==zone||f.target!==target)fadeHands[g.id]={zone,target,since:now,fired:false};
      else if(!f.fired&&now-f.since>=700){fadeTo(zone,target);f.fired=true;}
    }else fadeHands[g.id]=null;
    return;
  }
  fadeHands[g.id]=null;
  if(dragOwner!==null && dragOwner!==g.id)return;
  if(!dragHands[g.id]){
    if(key==='quit')return;
    if(intro.active){
      const expected=[0,-1,0,1,2,-1,-1][intro.step];
      if(zone!==expected)return;
    }
    const track=fx?state.effectTrack:zone;
    dragOwner=g.id;dragHands[g.id]={track,key,y:g.handY,value:key==='volume'?state.volumes[track]:fxAmount(key,track),distance:0};
    if(key==='beat_repeat')startGestureRepeat(g.id,track);
  }
  if(dragHands[g.id].key==='beat_repeat')return;
  const d=dragHands[g.id], amount=Math.max(0,Math.min(1,d.value+(g.handY-d.y)*2.5));
  // Re-anchor each frame so reversing at either limit responds immediately.
  d.value=amount;d.y=g.handY;
  if(d.key==='volume'){setSelected(d.track,false);setVolume(d.track,amount,false);}
  else applyEffect(d.track,d.key,amount,false);
  if(intro.active){intro.min=Math.min(intro.min,amount);intro.max=Math.max(intro.max,amount);if(intro.max-intro.min>=.08)completeIntro();else introRender();}
}
function updateJoinCountdown(now) {
  if(state.phase!=='join')return;
  const since=gestureGate.presentSince;
  let text='Show your hand for 3 seconds to start';
  if(since!==null && now-joinFrameAt<=900){
    // Brief interpolation makes display smooth, but stale detection never starts play.
    const displayNow=Math.min(now,joinFrameAt+250);
    const seconds=Math.max(0,3-(displayNow-since)/1000);
    text=seconds>0?`Hand detected · starting in ${seconds.toFixed(1)}s`:'Hand detected · confirming...';
  }
  if(handPrompt.textContent!==text)handPrompt.textContent=text;
}
function processStableResults(gestures,now) {
  joinFrameAt=now;
  if(!['join','mix','intro'].includes(state.phase)){resetGestureControls();return;}
  const stable=gestureGate.update(gestures,now);
  handDots.forEach(dot=>{dot.style.opacity=0;});
  const ids=new Set(stable.map(g=>g.id));
  if(gestureRepeat && !ids.has(gestureRepeat.hand)){releaseGestureRepeat();updateUI();}
  dragHands.forEach((_,id)=>{if(!ids.has(id)){dragHands[id]=null;fadeHands[id]=null;if(dragOwner===id)dragOwner=null;}});
  if(intro.nextOwner!==null&&!ids.has(intro.nextOwner)){intro.nextOwner=null;intro.nextSince=null;intro.nextArmed=false;}
  if(!stable.length){intro.nextArmed=false;return;}
  if(fxBankAwaitRelease){
    // A freshly reset debounce gate reports false even if fingers are closed.
    if(stable.some(g=>g.pinch || g.pinchRatio<.43))return;
    fxBankAwaitRelease=false;
  }
  if(state.phase==='join'){
    updateJoinCountdown(now);
    if(gestureGate.ready(now)){
      if(selectedSession==='intro')beginIntro();
      else {resetGestureControls();resetMixState();startMixer();}
    }return;
  }
  if(state.phase!=='mix' && state.phase!=='intro')return;
  stable.forEach(g=>routeStableGesture(g,now));
}

/* END_STEM_INTRO_CONTROLS */
    enableButton.onclick = enableCameraAndAudio;
    startButton.onclick = async () => {
      if (!audioContext || startButton.disabled) return;
      startButton.disabled = true;
      try {
        await audioContext.resume();
        armSelectedSession();
      } catch (error) {
        menuHint.textContent = "Audio could not start. Press Start to try again.";
      } finally {
        startButton.disabled = !(state.cameraReady && state.modelReady && songReady);
      }
    };
    window.addEventListener('load', () => enableCameraAndAudio(), { once: true });
    document.getElementById('introPause').onclick = pauseGame;
    document.getElementById('skipStepButton').onclick = skipIntroStep;
    document.getElementById('skipIntroButton').onclick = skipIntroAll;
    document.getElementById('introNext').onclick = advanceIntro;
    recordToggle.onchange = () => {
      state.recordPerformance = recordToggle.checked;
      updateUI();
    };
    continueButton.onclick = resumeGame;
    helpButton.onclick = openHelp;
    helpQuitButton.onclick = closeHelp;
    restartButton.onclick = restartGame;
    endButton.onclick = endGame;
    endingRestartButton.onclick = restartGame;
    closeButton.onclick = () => {
      window.close();
      endingMessage.textContent = "If the browser does not close this tab automatically, you can close it manually.";
    };
    if (saveButton) saveButton.onclick = saveRecording;
    if (loadButton && loadInput) loadButton.onclick = () => loadInput.click();
    if (loadInput) loadInput.onchange = event => loadRecordingFile(event.target.files[0]);

    window.addEventListener("keydown", event => {
      if(event.code === 'Space' && event.repeat){event.preventDefault();return;}
      if (state.phase === "intro") { if(event.code === 'Space'){event.preventDefault();if(!event.repeat)pauseGame();} return; }
      if (state.phase === "help") {
        if (event.code === "Escape") closeHelp();
        if (event.code === "Space") event.preventDefault();
        return;
      }
      if (!audioContext || state.playback) return;
      if (state.phase === "paused" && event.code !== "Space") return;
      if (state.phase === "ended") return;
      if (event.key === "1") setSelected(0);
      if (event.key === "2") setSelected(1);
      if (event.key === "3") setSelected(2);
      if (event.key === "4") setSelected(3);
      if (event.key.toLowerCase() === "q") fadeTo(state.selected, 0);
      if (event.key.toLowerCase() === "e") fadeTo(state.selected, 1);
      if (event.key.toLowerCase() === "m") clearEffects();
      // Recording shortcuts are disabled in this build; functions remain below for future versions.
      if (event.key.toLowerCase() === "s" && state.phase === 'ready') armSelectedSession();
      if (event.code === "Space") {
        event.preventDefault();
        state.phase === "paused" ? resumeGame() : pauseGame();
      }
    });
