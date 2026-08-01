/* Value + simplex-ish noise, seeded and deterministic.
   Deterministic matters: a moodboard that renders differently on every reload
   cannot be argued about. Same seed, same field, every time. */

(function (global) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 1D value noise with cubic interpolation — used for membrane contours,
     where we walk theta around a node and want a smooth closed loop. */
  function Noise1D(seed, size) {
    size = size || 256;
    const rnd = mulberry32(seed);
    const table = new Float32Array(size);
    for (let i = 0; i < size; i++) table[i] = rnd() * 2 - 1;

    function at(x) {
      const i = Math.floor(x);
      const f = x - i;
      const a = table[((i % size) + size) % size];
      const b = table[(((i + 1) % size) + size) % size];
      const t = f * f * (3 - 2 * f);
      return a + (b - a) * t;
    }

    /* fractal sum. octaves are cheap here and buy a lot of organic irregularity */
    at.fbm = function (x, octaves, gain) {
      octaves = octaves || 3;
      gain = gain === undefined ? 0.5 : gain;
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += at(x * freq) * amp;
        norm += amp;
        amp *= gain;
        freq *= 2;
      }
      return sum / norm;
    };
    return at;
  }

  /* 2D value noise — fields, washes, erosion masks */
  function Noise2D(seed, size) {
    size = size || 128;
    const rnd = mulberry32(seed);
    const table = new Float32Array(size * size);
    for (let i = 0; i < table.length; i++) table[i] = rnd() * 2 - 1;

    const wrap = (n) => ((n % size) + size) % size;
    const get = (x, y) => table[wrap(y) * size + wrap(x)];

    function at(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const a = get(xi, yi),     b = get(xi + 1, yi);
      const c = get(xi, yi + 1), d = get(xi + 1, yi + 1);
      return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
    }

    at.fbm = function (x, y, octaves, gain) {
      octaves = octaves || 4;
      gain = gain === undefined ? 0.5 : gain;
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += at(x * freq, y * freq) * amp;
        norm += amp;
        amp *= gain;
        freq *= 2;
      }
      return sum / norm;
    };
    return at;
  }

  global.GoblinNoise = { mulberry32, Noise1D, Noise2D };
})(window);
