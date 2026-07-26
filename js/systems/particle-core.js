import { OdysseyConfig } from '../config/odyssey-config.js';

// Shared by the main-thread engine and the OffscreenCanvas worker. Keep this
// module free of `window`/`document` — the worker imports it too.

const VERTEX_SHADER = `
  attribute vec2 a_pos;
  attribute vec2 a_vel;
  attribute float a_life;
  attribute float a_size;
  attribute vec3 a_color;
  varying float v_life;
  varying vec3 v_color;
  uniform vec2 u_res;
  void main() {
    vec2 clipSpace = (a_pos / u_res) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0, 1);
    float speed = length(a_vel);
    gl_PointSize = a_size * a_life * (1.0 + speed * 0.05);
    v_life = a_life;
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying float v_life;
  varying vec3 v_color;
  uniform float u_isLight;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    float intensity = (u_isLight > 0.5) ? 1.8 : 2.5;
    float glow = pow(1.0 - (d * 2.0), intensity);
    gl_FragColor = vec4(v_color, glow * v_life);
  }
`;

export const GL_CONTEXT_ATTRS = {
  alpha: true,
  antialias: false,
  depth: false,
  preserveDrawingBuffer: false,
};

export function computeCapacity(width, height) {
  const cfg = OdysseyConfig.particles;
  const sized = Math.floor((width * height) / cfg.maxPerAreaPx);
  return Math.max(cfg.maxBase, Math.min(cfg.maxCeiling, sized));
}

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[particles] shader compile failed', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Returns null when the program cannot be built, so callers can degrade
// instead of issuing draw calls against a broken program.
export function createParticleProgram(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[particles] program link failed', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  const buffers = {
    pos: gl.createBuffer(),
    vel: gl.createBuffer(),
    life: gl.createBuffer(),
    size: gl.createBuffer(),
    color: gl.createBuffer(),
  };
  const attrLocs = {
    a_pos: gl.getAttribLocation(program, 'a_pos'),
    a_vel: gl.getAttribLocation(program, 'a_vel'),
    a_life: gl.getAttribLocation(program, 'a_life'),
    a_size: gl.getAttribLocation(program, 'a_size'),
    a_color: gl.getAttribLocation(program, 'a_color'),
  };
  const uniformLocs = {
    isLight: gl.getUniformLocation(program, 'u_isLight'),
    res: gl.getUniformLocation(program, 'u_res'),
  };

  return {
    buffers,
    activate() {
      gl.useProgram(program);
      return uniformLocs;
    },
    upload(data, buffer, attr, size) {
      const loc = attrLocs[attr];
      if (loc === -1) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    },
  };
}

// Fixed-capacity particle store. Backing Float32Arrays are allocated once and
// reused every frame, so a full pool costs zero allocations per draw.
export class ParticlePool {
  #capacity;
  #dpr;
  #count = 0;

  // pos/vel are interleaved (x,y) because that is the layout WebGL wants;
  // life/size/color double as both simulation state and vertex data.
  #pos; #vel; #life; #decay; #size; #color;

  constructor(capacity, dpr) {
    this.#capacity = Math.max(1, capacity | 0);
    this.#dpr = dpr;

    const n = this.#capacity;
    this.#pos = new Float32Array(n * 2);
    this.#vel = new Float32Array(n * 2);
    this.#life = new Float32Array(n);
    this.#decay = new Float32Array(n);
    this.#size = new Float32Array(n);
    this.#color = new Float32Array(n * 3);
  }

  get count() { return this.#count; }

  spawn(x, y, isExhaust, primary, secondary, light) {
    const cfg = OdysseyConfig.particles;
    const emit = isExhaust ? cfg.exhaustCount : cfg.ambientCount;
    const scale = light ? cfg.contrastScaleLight : 1;
    const base = isExhaust ? primary : secondary;
    const decay = isExhaust ? cfg.exhaustDecay : cfg.ambientDecay;
    const size = (isExhaust ? cfg.exhaustSize : cfg.ambientSize) * this.#dpr;

    for (let n = 0; n < emit; n++) {
      // At capacity, overwrite slot 0 and let the next step() compact the
      // array — cheaper than shifting the whole pool on every spawn.
      const i = this.#count < this.#capacity ? this.#count++ : 0;
      const angle = Math.random() * Math.PI * 2;
      const force = isExhaust
        ? Math.random() * cfg.exhaustForceMax
        : cfg.ambientForceMin + Math.random() * (cfg.ambientForceMax - cfg.ambientForceMin);

      this.#pos[i * 2] = x * this.#dpr;
      this.#pos[i * 2 + 1] = y * this.#dpr;
      this.#vel[i * 2] = Math.cos(angle) * force * this.#dpr;
      this.#vel[i * 2 + 1] = Math.sin(angle) * force * this.#dpr;
      this.#life[i] = 1;
      this.#decay[i] = decay;
      this.#size[i] = size;
      this.#color[i * 3] = base[0] * scale;
      this.#color[i * 3 + 1] = base[1] * scale;
      this.#color[i * 3 + 2] = base[2] * scale;
    }
  }

  // Advances one frame and compacts dead particles out in the same pass, so the
  // live particles always occupy a contiguous prefix ready to hand to WebGL.
  step() {
    const drag = OdysseyConfig.particles.drag;
    let live = 0;
    for (let i = 0; i < this.#count; i++) {
      const life = this.#life[i] - this.#decay[i];
      if (life <= 0) continue;

      const vx = this.#vel[i * 2] * drag;
      const vy = this.#vel[i * 2 + 1] * drag;

      this.#pos[live * 2] = this.#pos[i * 2] + this.#vel[i * 2];
      this.#pos[live * 2 + 1] = this.#pos[i * 2 + 1] + this.#vel[i * 2 + 1];
      this.#vel[live * 2] = vx;
      this.#vel[live * 2 + 1] = vy;
      this.#life[live] = life;
      this.#decay[live] = this.#decay[i];
      this.#size[live] = this.#size[i];
      this.#color[live * 3] = this.#color[i * 3];
      this.#color[live * 3 + 1] = this.#color[i * 3 + 1];
      this.#color[live * 3 + 2] = this.#color[i * 3 + 2];
      live++;
    }
    this.#count = live;
    return live;
  }

  // Views over the live prefix only — no copying, no per-frame allocation.
  get vertexData() {
    const n = this.#count;
    return {
      length: n,
      pos: this.#pos.subarray(0, n * 2),
      vel: this.#vel.subarray(0, n * 2),
      life: this.#life.subarray(0, n),
      size: this.#size.subarray(0, n),
      color: this.#color.subarray(0, n * 3),
    };
  }
}

// One frame: clear, advance, draw. Returns true while particles remain, so the
// caller knows whether to keep the rAF loop alive or go back to sleep.
export function renderFrame(gl, program, pool, light, width, height) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (pool.step() === 0) return false;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);

  const data = pool.vertexData;
  const locs = program.activate();
  const b = program.buffers;
  program.upload(data.pos, b.pos, 'a_pos', 2);
  program.upload(data.vel, b.vel, 'a_vel', 2);
  program.upload(data.life, b.life, 'a_life', 1);
  program.upload(data.size, b.size, 'a_size', 1);
  program.upload(data.color, b.color, 'a_color', 3);
  gl.uniform1f(locs.isLight, light ? 1 : 0);
  gl.uniform2f(locs.res, width, height);
  gl.drawArrays(gl.POINTS, 0, data.length);
  return true;
}
