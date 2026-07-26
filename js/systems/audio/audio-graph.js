import { OdysseyConfig } from '../../config/odyssey-config.js';
import { BUS } from './mix.js';

// The node graph.
//
//   one-shots ──▶ sfx ────┐
//   ambient   ──▶ ambient ┼──▶ duck ──▶ master ──▶ limiter ──▶ destination
//   spatial   ──▶ panner ─┘
//
// The three stages after the buses exist separately on purpose. Master is the
// user's volume, duck is what a warp pulls down, and the engine rides the sfx
// bus. They used to be one gain, so a mouse move would immediately undo the
// duck a jump had just applied.
export class AudioGraph {
  #ctx;
  #master;
  #duck;
  #limiter;
  #buses;
  #panner;
  #voices = new Set();

  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('AudioContext unsupported');
    this.#ctx = new Ctx();

    // A limiter, not an effect: overlapping one-shots on top of the ambient
    // bed can sum past unity, and without this that clips audibly.
    const lim = OdysseyConfig.audio.limiter;
    this.#limiter = this.#ctx.createDynamicsCompressor();
    this.#limiter.threshold.value = lim.thresholdDb;
    this.#limiter.knee.value = lim.kneeDb;
    this.#limiter.ratio.value = lim.ratio;
    this.#limiter.attack.value = lim.attackSec;
    this.#limiter.release.value = lim.releaseSec;
    this.#limiter.connect(this.#ctx.destination);

    this.#master = this.#gain(OdysseyConfig.audio.masterVolume);
    this.#master.connect(this.#limiter);

    this.#duck = this.#gain(1);
    this.#duck.connect(this.#master);

    this.#panner = this.#ctx.createPanner();
    this.#panner.panningModel = 'HRTF';
    this.#panner.distanceModel = 'inverse';
    this.#panner.refDistance = 1;
    this.#panner.maxDistance = 10000;
    this.#panner.rolloffFactor = 1;
    this.#panner.connect(this.#duck);

    this.#buses = {
      [BUS.sfx]: this.#gain(1),
      [BUS.ambient]: this.#gain(1),
      [BUS.spatial]: this.#panner,
    };
    this.#buses[BUS.sfx].connect(this.#duck);
    this.#buses[BUS.ambient].connect(this.#duck);
  }

  get ctx() { return this.#ctx; }
  get state() { return this.#ctx.state; }

  resume() { return this.#ctx.resume(); }

  #gain(value) {
    const node = this.#ctx.createGain();
    node.gain.value = value;
    return node;
  }

  #ramp(param, value, timeConstant) {
    param.setTargetAtTime(value, this.#ctx.currentTime, Math.max(0.001, timeConstant));
  }

  setMasterVolume(value, timeConstant = 0.08) {
    this.#ramp(this.#master.gain, value, timeConstant);
  }

  // Pulls everything down for the length of a jump without touching the
  // user's own volume, so the two can no longer fight.
  setDuck(amount, timeConstant = 0.5) {
    this.#ramp(this.#duck.gain, amount, timeConstant);
  }

  // The engine rides the sfx bus alone; ambience underneath is unaffected.
  setSfxGain(value, timeConstant = 0.12) {
    this.#ramp(this.#buses[BUS.sfx].gain, value, timeConstant);
  }

  updateSpatialPosition(x, y) {
    const px = (x / window.innerWidth) * 2 - 1;
    const py = -(y / window.innerHeight) * 2 + 1;
    // Older WebKit exposes only the deprecated setPosition(), with no
    // positionX/Y/Z AudioParams to ramp.
    if (!this.#panner.positionX) {
      this.#panner.setPosition?.(px, py, 0.5);
      return;
    }
    const t = this.#ctx.currentTime;
    this.#panner.positionX.setTargetAtTime(px, t, 0.1);
    this.#panner.positionY.setTargetAtTime(py, t, 0.1);
    this.#panner.positionZ.setTargetAtTime(0.5, t, 0.1);
  }

  get voiceCount() { return this.#voices.size; }

  // The limiter stops a pile-up from clipping, but nothing stopped it from
  // costing CPU: a burst of interaction could leave dozens of sources being
  // summed. Past the cap the oldest one-shot is retired first.
  #enforceVoiceCap() {
    const cap = OdysseyConfig.audio.maxVoices;
    while (this.#voices.size >= cap) {
      const oldest = this.#voices.values().next().value;
      if (!oldest) return;
      this.#voices.delete(oldest);
      oldest.stop(OdysseyConfig.audio.stealFadeSec);
    }
  }

  // Starts one voice. Returns a handle whose stop() fades out rather than
  // cutting, because stopping a loop outright is an audible click.
  play(buffer, voice) {
    const now = this.#ctx.currentTime;
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = voice.loop;
    source.playbackRate.value = voice.playbackRate;
    if (source.detune) source.detune.value = voice.detune;

    const gain = this.#ctx.createGain();
    if (voice.fade > 0) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(voice.gain, now + voice.fade);
    } else {
      gain.gain.setValueAtTime(voice.gain, now);
    }

    source.connect(gain);
    gain.connect(this.#buses[voice.bus] ?? this.#buses[BUS.sfx]);
    source.start(now);

    // Every voice used to leave its gain node wired to the bus forever. At one
    // hover sample per 100ms that is ten dead nodes a second, all still being
    // summed by the audio thread.
    let handle;
    const release = () => {
      source.disconnect();
      gain.disconnect();
      this.#voices.delete(handle);
    };
    source.onended = release;

    handle = {
      stop: (fade = OdysseyConfig.audio.stopFadeSec) => {
        const t = this.#ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fade);
        try {
          source.stop(t + fade);
        } catch {
          release(); // already stopped
        }
      },
    };

    // Loops are held by the caller and stopped deliberately, so only one-shots
    // take part in the cap.
    if (!voice.loop) {
      this.#enforceVoiceCap();
      this.#voices.add(handle);
    }
    return handle;
  }
}
