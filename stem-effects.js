/* STEM_NEW_EFFECTS_START */
/* Native Web Audio effects. No UI, gesture, or animation dependencies. */
class StemEffectRack {
  constructor(context, {bass=false, bpm=120}={}) {
    this.context=context;this.bpm=bpm;this.bass=bass;this.amounts={chorus:0,tremolo:0,distortion:0};
    this.generation=0;this.repeat=null;this.buffer=null;
    const gain=value=>{const n=context.createGain();n.gain.value=value;return n;};
    this.input=gain(1);this.live=gain(1);this.bus=gain(1);this.output=gain(1);
    this.input.connect(this.live).connect(this.bus);
    this.chorusDry=gain(1);this.chorusWet=gain(0);const chorusOut=gain(1);
    this.bus.connect(this.chorusDry).connect(chorusOut);this.chorusWet.connect(chorusOut);
    this.chorusLfo=context.createOscillator();this.chorusLfo.frequency.value=.8;
    this.modulators=[];
    for(const side of [-1,1]){
      const delay=context.createDelay(.1),depth=gain(side*.002),pan=context.createStereoPanner(),level=gain(.5);
      delay.delayTime.value=side<0?.018:.026;pan.pan.value=side*.9;
      this.bus.connect(delay).connect(pan).connect(level).connect(this.chorusWet);
      this.chorusLfo.connect(depth).connect(delay.delayTime);this.modulators.push(depth);
    }
    this.chorusLfo.start();
    this.drive=gain(1);this.distDry=gain(1);this.distWet=gain(0);const distOut=gain(1);
    const high=context.createBiquadFilter();high.type='highpass';high.frequency.value=bass?70:25;high.Q.value=.707;
    this.shaper=context.createWaveShaper();this.shaper.oversample='4x';
    this.shaper.curve=Float32Array.from({length:4097},(_,i)=>Math.tanh(i/2048-1)/Math.tanh(1));
    chorusOut.connect(this.distDry).connect(distOut);
    chorusOut.connect(high).connect(this.drive).connect(this.shaper).connect(this.distWet).connect(distOut);
    this.cleanHigh=gain(0);high.connect(this.cleanHigh).connect(distOut);
    this.tremolo=gain(1);this.tremDepth=gain(0);
    distOut.connect(this.tremolo).connect(this.output);
    this.sync(0);
  }
  smooth(param,value,time=this.context.currentTime){param.setTargetAtTime(value,time,.035);}
  set(effect,amount){
    if(!Object.hasOwn(this.amounts,effect))throw new RangeError('Unknown effect: '+effect);
    if(!Number.isFinite(amount))throw new TypeError('Amount must be finite');
    const a=Math.max(0,Math.min(1,amount));this.amounts[effect]=a;
    if(effect==='chorus'){
      // A stronger wet blend and wider pitch modulation remain audible in a full mix.
      const mix=.65*Math.pow(a,.8);
      this.smooth(this.chorusDry.gain,1-mix);this.smooth(this.chorusWet.gain,mix);
      this.smooth(this.chorusLfo.frequency,.65+.7*a);
      this.modulators.forEach((depth,i)=>this.smooth(depth.gain,(i===0?-1:1)*(.002+.006*a)));
    }
    if(effect==='tremolo'){
      // Full depth reaches silence at each trough; the peak stays at unity gain.
      const depth=.5*Math.pow(a,.7);
      this.smooth(this.tremolo.gain,1-depth);this.smooth(this.tremDepth.gain,depth);
    }
    if(effect==='distortion'){
      const drive=Math.pow(10,24*a/20),mix=.8*Math.pow(a,.8);
      this.smooth(this.drive.gain,drive);this.smooth(this.distDry.gain,this.bass?1:1-mix);
      this.smooth(this.cleanHigh.gain,this.bass?-mix:0);
      this.smooth(this.distWet.gain,mix/Math.sqrt(drive));
    }
    return a;
  }
  sync(position=0){
    if(this.tremLfo){this.tremLfo.stop();this.tremLfo.disconnect();}
    const rate=this.bpm/30,phase=2*Math.PI*rate*position;
    this.tremLfo=this.context.createOscillator();this.tremLfo.frequency.value=rate;
    this.tremLfo.setPeriodicWave(this.context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));
    this.tremLfo.connect(this.tremDepth);this.tremDepth.connect(this.tremolo.gain);
    this.tremLfo.start();
  }
  setBpm(bpm,position=0){
    if(!Number.isFinite(bpm)||bpm<40||bpm>240)throw new RangeError('BPM must be 40..240');
    this.release();this.bpm=bpm;this.sync(position);
  }
  async trigger(loadBuffer,position,playing){
    if(this.repeat)return this.repeat.start;
    const token=++this.generation;
    const buffer=this.buffer || await loadBuffer();
    if(token!==this.generation)return null;
    if(!playing())throw new Error('Start playback before triggering Beat Repeat');
    this.buffer=buffer;
    const sliceSeconds=60/this.bpm/4,mediaTime=position(),now=this.context.currentTime;
    const wait=sliceSeconds-((mediaTime%sliceSeconds)+sliceSeconds)%sliceSeconds;
    const start=now+Math.max(.01,wait);
    const length=Math.max(2,Math.round(sliceSeconds*buffer.sampleRate));
    const clip=this.context.createBuffer(buffer.numberOfChannels,length,buffer.sampleRate);
    const offset=Math.floor((mediaTime+start-now-sliceSeconds)*buffer.sampleRate);
    const edge=Math.min(Math.floor(.005*buffer.sampleRate),Math.floor(length/4));
    const gateEnd=Math.floor(length*.78);
    for(let ch=0;ch<buffer.numberOfChannels;ch++){
      const input=buffer.getChannelData(ch),out=clip.getChannelData(ch);
      for(let i=0;i<length;i++){
        // Leave a short rhythmic gap so sustained stems also sound like a stutter.
        const envelope=Math.max(0,Math.min(1,i/Math.max(1,edge),(gateEnd-i)/Math.max(1,edge)));
        out[i]=input[((offset+i)%input.length+input.length)%input.length]*envelope;
      }
    }
    const source=this.context.createBufferSource(),wet=this.context.createGain();
    source.buffer=clip;source.loop=true;wet.gain.value=0;source.connect(wet).connect(this.bus);
    wet.gain.setValueAtTime(0,start);wet.gain.linearRampToValueAtTime(1,start+.005);
    this.live.gain.cancelAndHoldAtTime(now);this.live.gain.setValueAtTime(1,start);this.live.gain.linearRampToValueAtTime(0,start+.005);
    this.repeat={source,wet,start};source.start(start);return start;
  }
  release(){
    this.generation++;
    const now=this.context.currentTime;
    if(this.repeat){
      const {source,wet,start}=this.repeat;this.repeat=null;
      // Explicit anchors prevent release ramps from stretching back to the trigger ramp.
      const level=Math.max(0,Math.min(1,(now-start)/.005));
      this.live.gain.cancelScheduledValues(now);this.live.gain.setValueAtTime(1-level,now);this.live.gain.linearRampToValueAtTime(1,now+.01);
      wet.gain.cancelScheduledValues(now);wet.gain.setValueAtTime(level,now);wet.gain.linearRampToValueAtTime(0,now+.01);
      source.stop(now+.015);source.onended=()=>{source.disconnect();wet.disconnect();};
    }
  }
  clear(){this.release();for(const key of Object.keys(this.amounts))this.set(key,0);}
}

const STEM_NEW_EFFECTS=['chorus','tremolo','distortion'];
let stemEffectsBpm=120;
const stemDecodeJobs=new Map();
function stemRack(id){
  const index=typeof id==='number'?id:tracks.findIndex(t=>t.key===id);
  if(!Number.isInteger(index)||!tracks[index])throw new RangeError('Unknown stem: '+id);
  const rack=graph[tracks[index].key]?.effects;
  if(!rack)throw new Error('Enable audio first');
  return {index,key:tracks[index].key,rack};
}
async function prepareStemRepeat(id){
  const {index,key,rack}=stemRack(id);
  if(rack.buffer)return rack.buffer;
  if(!stemDecodeJobs.has(key)){
    const source=players[key].src;
    const job=fetch(source)
      .then(r=>{if(!r.ok)throw new Error('Audio loading failed');return r.arrayBuffer();})
      .then(data=>audioContext.decodeAudioData(data))
      .then(buffer=>{
        if(players[key].src!==source || stemDecodeJobs.get(key)!==job)throw new Error('Song changed during audio preparation');
        return rack.buffer=buffer;
      }).catch(error=>{if(stemDecodeJobs.get(key)===job)stemDecodeJobs.delete(key);throw error;});
    stemDecodeJobs.set(key,job);
  }
  return stemDecodeJobs.get(key);
}
function stopStemRepeats(){for(const node of Object.values(graph))node.effects?.release();}
function syncStemEffects(){for(const [key,node] of Object.entries(graph))node.effects?.sync(players[key].currentTime);}
window.StemFX=Object.freeze({
  init:async()=>{if(!audioContext)setupAudio();await audioContext.resume();if(!songReady && !await loadSelectedSong())throw new Error('Song audio is not ready');},
  set:(id,effect,amount)=>{const {index}=stemRack(id);if(!STEM_NEW_EFFECTS.includes(effect))throw new RangeError('Use trigger/release for Beat Repeat');applyEffect(index,effect,amount);},
  prepare:prepareStemRepeat,
  trigger:id=>{const {key,rack}=stemRack(id);return rack.trigger(()=>prepareStemRepeat(id),()=>players[key].currentTime,()=>!players[key].paused);},
  release:id=>stemRack(id).rack.release(),
  clear:()=>clearEffects(),
  setBpm:bpm=>{
    if(!Number.isFinite(bpm)||bpm<40||bpm>240)throw new RangeError('BPM must be 40..240');
    stemEffectsBpm=bpm;for(const [key,node] of Object.entries(graph))node.effects.setBpm(bpm,players[key].currentTime);
  },
  status:()=>({bpm:stemEffectsBpm,stems:Object.fromEntries(Object.entries(graph).map(([key,node])=>[key,{...node.effects.amounts,beat_repeat:Boolean(node.effects.repeat),repeatStart:node.effects.repeat?.start??null}]))})
});

/* STEM_NEW_EFFECTS_END */
