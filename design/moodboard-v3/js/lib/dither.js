/* Dither as material, not as filter.
   Three algorithms, because they are not interchangeable:

   BAYER     ordered, per-pixel independent, threshold read from a fixed matrix.
             Stable under motion — the pattern is locked to screen space, so a
             moving object does not make the texture crawl. This is the only one
             that survives animation. Cost: O(n), trivially cheap.

   FLOYD-STEINBERG  error diffused right and down. Organic, irregular, looks
             photographic. Under motion the error path changes every frame and
             the whole surface boils. Use it for STILL material only.

   ATKINSON  diffuses only 6/8 of the error, deliberately losing the rest.
             Blows out highlights, keeps edges crisp — the classic early-Mac
             archival look. Also boils under motion, but less violently.

   All three run on ImageData. At full canvas resolution the diffusion kernels
   are the bottleneck, so callers pass a `scale` and we dither a smaller buffer
   then upscale with smoothing off — which additionally enforces a real pixel
   grid instead of a resolution-independent smear. */

(function (global) {
  'use strict';

  /* 8x8 Bayer, generated rather than typed out, so the order can be changed */
  function bayerMatrix(order) {
    let m = [[0]];
    for (let k = 1; k <= order; k++) {
      const n = m.length;
      const next = [];
      for (let y = 0; y < n * 2; y++) next.push(new Array(n * 2).fill(0));
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const v = m[y][x] * 4;
          next[y][x]         = v;
          next[y][x + n]     = v + 2;
          next[y + n][x]     = v + 3;
          next[y + n][x + n] = v + 1;
        }
      }
      m = next;
    }
    return m;
  }

  const BAYER8 = bayerMatrix(3);           // 8x8, values 0..63
  const BAYER8_N = BAYER8.length * BAYER8.length;

  function luma(d, i) {
    // Rec. 709. Using proper coefficients matters here — a naive average
    // turns the acid green signal colour into mud.
    return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  }

  /* Black point / white point.

     Textbook ordered dithering offsets every pixel by up to half a
     quantisation step. At 2 levels that is ±127, so a near-black background
     (#05060a, luma 6) still flips roughly one pixel in 64 to pure white and
     the void fills with a visible dot lattice. Mathematically correct, and
     wrong for this product: the void is not material, it is absence, and it
     must stay absent.

     So the input is remapped through a black/white point first, and anything
     at or below the black point is clamped out of the dither entirely. This
     is also what makes `dither as material` literal — you set the range of
     tone that IS material, and the rest is nothing. */
  function ramp(g, black, white) {
    if (g <= black) return -1;                    // sentinel: not material
    return Math.max(0, Math.min(255, ((g - black) / (white - black)) * 255));
  }

  function applyBayer(img, opts) {
    const d = img.data, w = img.width, h = img.height;
    const strength = opts.strength === undefined ? 1 : opts.strength;
    const levels = Math.max(2, opts.levels || 2);
    const black = opts.black === undefined ? 10 : opts.black;
    const white = opts.white === undefined ? 235 : opts.white;
    const step = 255 / (levels - 1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const g = ramp(luma(d, i), black, white);
        if (g < 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
        const t = (BAYER8[y & 7][x & 7] / BAYER8_N - 0.5) * step * strength;
        const v = Math.max(0, Math.min(255, Math.round((g + t) / step) * step));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
    return img;
  }

  function diffuse(img, opts, kernel, divisor) {
    const w = img.width, h = img.height, d = img.data;
    const levels = Math.max(2, opts.levels || 2);
    const black = opts.black === undefined ? 10 : opts.black;
    const white = opts.white === undefined ? 235 : opts.white;
    const step = 255 / (levels - 1);
    const buf = new Float32Array(w * h);
    const solid = new Uint8Array(w * h);   // pixels below the black point

    for (let i = 0, p = 0; p < w * h; p++, i += 4) {
      const g = ramp(luma(d, i), black, white);
      if (g < 0) { solid[p] = 1; buf[p] = 0; } else buf[p] = g;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (solid[p]) { buf[p] = 0; continue; }   // void absorbs no error
        const old = buf[p];
        const nv = Math.max(0, Math.min(255, Math.round(old / step) * step));
        buf[p] = nv;
        const err = old - nv;
        for (let k = 0; k < kernel.length; k++) {
          const dx = kernel[k][0], dy = kernel[k][1], wt = kernel[k][2];
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny >= h) continue;
          buf[ny * w + nx] += err * wt / divisor;
        }
      }
    }

    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const v = Math.max(0, Math.min(255, buf[p]));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return img;
  }

  const FS_KERNEL = [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]];
  const ATK_KERNEL = [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]];

  function apply(img, mode, opts) {
    opts = opts || {};
    if (mode === 'floyd')   return diffuse(img, opts, FS_KERNEL, 16);
    if (mode === 'atkinson') return diffuse(img, opts, ATK_KERNEL, 8);
    if (mode === 'none')    return img;
    return applyBayer(img, opts);
  }

  /* Post-process an entire canvas in place, at reduced resolution.
     `scale` of 0.5 quarters the work and doubles the apparent pixel size —
     which is a look, not just an optimisation. */
  function post(ctx, mode, opts) {
    if (mode === 'none') return;
    opts = opts || {};
    const scale = opts.scale || 1;
    const cv = ctx.canvas;
    const w = Math.max(1, Math.round(cv.width * scale));
    const h = Math.max(1, Math.round(cv.height * scale));

    let src = ctx;
    let tmp = null;
    if (scale !== 1) {
      tmp = post._tmp || (post._tmp = document.createElement('canvas'));
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d', { willReadFrequently: true });
      tctx.imageSmoothingEnabled = true;
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(cv, 0, 0, w, h);
      src = tctx;
    }

    const img = src.getImageData(0, 0, w, h);
    apply(img, mode, opts);
    src.putImageData(img, 0, 0);

    if (scale !== 1) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;   // hard pixel grid, no smear
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(tmp, 0, 0, w, h, 0, 0, cv.width, cv.height);
      ctx.restore();
    }
  }

  global.GoblinDither = { apply, post, bayerMatrix, BAYER8 };
})(window);
