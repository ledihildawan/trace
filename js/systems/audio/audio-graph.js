import { OdysseyConfig } from '../../config/odyssey-config.js';
import { SPATIAL_KEYS } from './asset-manifest.js';

// The Web Audio node graph: a master gain, an HRTF panner for the sounds
// that should follow the pointer, and a factory for one-shot sources.
export class AudioGraph {
  #ctx = null;
  #master = null;
  #panner = null;

  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('AudioContext unsupported');
    this.#ctx = new Ctx();
    this.#master = this.#ctx.createGain();
    this.#master.gain.value = OdysseyConfig.audio.masterVolume;
    this.#panner = this.#ctx.createPanner();
    this.#panner.panningModel = 'HRTF';
    this.#panner.distanceModel = 'inverse';
    this.#panner.refDistance = 1;
    this.#panner.maxDistance = 10000;
    this.#panner.rolloffFactor = 1;
    this.#panner.connect(this.#master);
    this.#master.connect(this.#ctx.destination);
  }

  get ctx() { return this.#ctx; }
  get master() { return this.#master; }
  get panner() { return this.#panner; }

  resume() { return this.#ctx.resume(); }

  setMasterVolume(value, timeConstant = 0.08) {
    if (!this.#master) return;
    this.#master.gain.setTargetAtTime(value, this.#ctx.currentTime, timeConstant);
  }

  updateSpatialPosition(x, y) {
    if (!this.#panner) return;
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

  spawnSource(buffer, options = {}) {
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.#ctx.createGain();
    gain.gain.value = options.volume ?? 1.0;
    source.playbackRate.value = options.playbackRate || 1.0;
    source.connect(gain);
    if (options.spatial !== false && SPATIAL_KEYS.has(options.key)) {
      gain.connect(this.#panner);
    } else {
      gain.connect(this.#master);
    }
    source.loop = Boolean(options.loop);
    source.start(0);
    return source;
  }
}
