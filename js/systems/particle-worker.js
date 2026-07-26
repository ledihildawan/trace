import {
  GL_CONTEXT_ATTRS,
  ParticlePool,
  createParticleProgram,
  renderFrame,
} from './particle-core.js';

// WebGL particle renderer running off the main thread on a transferred
// OffscreenCanvas. The main-thread ParticleEngine posts:
//   {type:'init', canvas, width, height, dpr, capacity, light}
//   {type:'spawn', x, y, isExhaust, primary, secondary}
//   {type:'resize', width, height}
//   {type:'theme', light}
//   {type:'visibility', hidden}

let canvas = null;
let gl = null;
let program = null;
let pool = null;
let raf = null;
let light = false;

self.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      init(msg);
      break;
    case 'spawn':
      if (!pool) return;
      pool.spawn(msg.x, msg.y, msg.isExhaust, msg.primary, msg.secondary, light);
      wake();
      break;
    case 'resize':
      if (!gl) return;
      canvas.width = msg.width;
      canvas.height = msg.height;
      gl.viewport(0, 0, msg.width, msg.height);
      break;
    case 'theme':
      light = !!msg.light;
      break;
    case 'visibility':
      if (msg.hidden) sleep();
      else wake();
      break;
  }
};

function init(msg) {
  canvas = msg.canvas;
  if (!canvas) return;
  gl = canvas.getContext('webgl', GL_CONTEXT_ATTRS);
  if (!gl) return;

  program = createParticleProgram(gl);
  if (!program) {
    // Shaders failed to build — stay inert rather than drawing garbage.
    gl = null;
    return;
  }

  pool = new ParticlePool(msg.capacity, msg.dpr);
  light = !!msg.light;
  canvas.width = msg.width;
  canvas.height = msg.height;
  gl.viewport(0, 0, msg.width, msg.height);
}

function wake() {
  if (raf === null && gl && pool) raf = requestAnimationFrame(loop);
}

function sleep() {
  if (raf !== null) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

function loop() {
  const alive = renderFrame(gl, program, pool, light, canvas.width, canvas.height);
  // Drained — the clear already wiped the last frame, so idle until the next spawn.
  raf = alive ? requestAnimationFrame(loop) : null;
}
