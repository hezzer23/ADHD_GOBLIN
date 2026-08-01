// src/atlas.ts
var MONO_STACK = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
function validateCharset(charset) {
  if (charset.length < 2) {
    throw new Error("[motes] charset must contain at least 2 characters");
  }
  if (charset[0] !== " ") {
    throw new Error("[motes] charset index 0 must be a space");
  }
  return charset;
}
function buildGlyphAtlas(charset, cellW, cellH, dpr) {
  const count = charset.length;
  const w = Math.max(1, Math.round(cellW * dpr));
  const h = Math.max(1, Math.round(cellH * dpr));
  const canvas = document.createElement("canvas");
  canvas.width = w * count;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[motes] could not acquire a 2D context for the glyph atlas");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${cellH * dpr}px ${MONO_STACK}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < count; i++) {
    const glyph = charset[i];
    if (!glyph || glyph === " ") continue;
    ctx.fillText(glyph, i * w, 0);
  }
  return { canvas, count, cellW: w, cellH: h };
}

// src/color.ts
var HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function expandBody(body) {
  return body.length === 3 ? body[0] + body[0] + body[1] + body[1] + body[2] + body[2] : body;
}
function rgbFrom(body6) {
  const n = parseInt(body6, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function parseHexColor(hex, what) {
  const match = HEX.exec(hex.trim());
  if (!match) throw new Error(`[motes] invalid ${what} color: "${hex}"`);
  return rgbFrom(expandBody(match[1]));
}
var HEX_RGBA = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function parseColorRGBA(input) {
  const text = input.trim();
  if (text.toLowerCase() === "transparent") return [0, 0, 0, 0];
  const match = HEX_RGBA.exec(text);
  if (!match) throw new Error(`[motes] invalid colour: "${input}"`);
  const body = expandBody(match[1]);
  const a = body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1;
  const [r, g, b] = rgbFrom(body.slice(0, 6));
  return [r, g, b, a];
}
function premultiply([r, g, b, a]) {
  return [r * a, g * a, b * a, a];
}

// src/diagnostics.ts
var INTRINSIC_W = 300;
var INTRINSIC_H = 150;
function isOpaque(bg) {
  if (!bg || bg === "transparent") return false;
  const inner = bg.match(/^rgba?\(([^)]+)\)/)?.[1];
  if (inner) {
    const parts = inner.split(",").map((s) => s.trim());
    if (parts.length < 4) return true;
    const alpha = parts[3];
    return alpha !== void 0 && Number.parseFloat(alpha) > 0;
  }
  return true;
}
var UNSIZED_MESSAGE = "[motes] Canvas is 300\xD7150 \u2014 the <canvas> intrinsic size, not the box you pinned it to. `inset: 0` does not stretch a replaced element: with `width: auto` the inset equation is over-constrained, so the intrinsic size wins.\n  Fix: add `h-full w-full`, or `width: 100%; height: 100%`.\n  Deliberate? Silence with <canvas data-motes-quiet>.";
var OCCLUDED_MESSAGE = "[motes] Canvas is drawing but painted behind an opaque background \u2014 z-index is negative and both <html> and <body> have a background colour. Once <html> has its own background, <body>'s stops propagating to the viewport and paints as an ordinary block background, above any negative z-index.\n  Fix: remove `background` from either <html> or <body> \u2014 keeping it on exactly one is enough. Or drop the negative z-index and layer content above instead.\n  Deliberate? Silence with <canvas data-motes-quiet>.";
function diagnose(input) {
  if (input.quiet) return null;
  const isIntrinsic = input.clientWidth === INTRINSIC_W && input.clientHeight === INTRINSIC_H;
  const isPinned = input.position === "absolute" || input.position === "fixed";
  const overConstrained = input.left !== "auto" && input.right !== "auto";
  const containerBigger = input.containerWidth > INTRINSIC_W || input.containerHeight > INTRINSIC_H;
  if (isIntrinsic && isPinned && overConstrained && containerBigger) {
    return { code: "unsized", message: UNSIZED_MESSAGE };
  }
  const z = Number.parseInt(input.zIndex, 10);
  const negativeZ = Number.isFinite(z) && z < 0;
  if (negativeZ && isOpaque(input.htmlBg) && isOpaque(input.bodyBg)) {
    return { code: "occluded", message: OCCLUDED_MESSAGE };
  }
  return null;
}
function channelLuminance(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relativeLuminance([r, g, b]) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}
var MIN_RATIO = 1.5;
var WASHED_MESSAGE = "[motes] The field is drawing, but `ink` and `background` are too close in luminance to see. The ambient ramp runs from the background toward `ink`, so when those two match there is nothing to render but the background.\n  Fix: move `ink` away from `background` \u2014 light glyphs on a dark background, or dark on light.\n  Deliberate? Silence with <canvas data-motes-quiet>.";
function diagnoseContrast(background, ink, quiet) {
  if (quiet) return null;
  if (background[3] < 1) return null;
  const a = relativeLuminance([background[0], background[1], background[2]]);
  const b = relativeLuminance(ink);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio < MIN_RATIO ? { code: "washed", message: WASHED_MESSAGE } : null;
}

// src/effects/flow.glsl
var flow_default = "// 01 \u2014 flow. Domain-warped trig noise drifting on a slow current.\n// No pointer math. The cursor arrives via the shared pass in main().\nfloat field(vec2 cell, float t) {\n  float cx = cell.x;\n  float cy = cell.y;\n\n  float wx = sin(cy * 0.15 + t * 0.6) * 1.4;\n  float wy = cos(cx * 0.13 - t * 0.5) * 1.4;\n\n  float a = sin((cx + wx) * 0.16 + t * 0.5);\n  float b = cos((cy + wy) * 0.19 - t * 0.4);\n  float c = sin((cx + cy) * 0.07 + t * 0.3);\n\n  return ((a * b + c) / 2.0) * 0.5 + 0.5;\n}\n";

// src/effects/waves.glsl
var waves_default = "// 02 \u2014 waves. Layered sine bands, phase-shifted by a travelling warp.\n// No pointer math. The cursor arrives via the shared pass in main().\nfloat field(vec2 cell, float t) {\n  float cx = cell.x;\n  float cy = cell.y;\n\n  float w = sin(cx * 0.12 + t * 1.1) * 0.5\n          + sin(cx * 0.05 - cy * 0.09 + t * 0.7) * 0.5;\n\n  float band = sin(cy * 0.22 + w * 1.6 + t * 0.5);\n\n  return band * 0.5 + 0.5;\n}\n";

// src/effects/pulse.glsl
var pulse_default = "// 03 \u2014 pulse. Radial waves breathing out from the centre of the grid.\n// No pointer math. The cursor arrives via the shared pass in main().\nfloat field(vec2 cell, float t) {\n  vec2  d    = cell - u_grid * 0.5;\n  float dist = length(d);\n\n  float p = sin(dist * 0.35 - t * 2.4)\n          + sin(cell.x * 0.14 + t) * 0.4\n          + sin(cell.y * 0.16 - t) * 0.4;\n\n  return (p / 1.8) * 0.5 + 0.5;\n}\n";

// src/effects/registry.ts
var effects = /* @__PURE__ */ new Map();
var FIELD_SIGNATURE = /float\s+field\s*\(/;
function defineEffect(name, def) {
  if (!name) {
    throw new Error("[motes] defineEffect: name is required");
  }
  if (!def?.glsl || !FIELD_SIGNATURE.test(def.glsl)) {
    throw new Error(
      `[motes] defineEffect("${name}"): glsl must define "float field(vec2 cell, float t)"`
    );
  }
  effects.set(name, def);
}
function getEffect(name) {
  return effects.get(name);
}
function listEffects() {
  return [...effects.keys()];
}
defineEffect("flow", { glsl: flow_default });
defineEffect("waves", { glsl: waves_default });
defineEffect("pulse", { glsl: pulse_default });

// src/renderer/shaders/quad.vert
var quad_default = "#version 300 es\nprecision highp float;\n\n// Full-screen triangle: no attribute buffers, position derived from\n// gl_VertexID. Draw with drawArrays(TRIANGLES, 0, 3).\nvoid main() {\n  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);\n  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n}\n";

// src/renderer/shaders/common.glsl
var common_default = "// Shared uniforms and helpers available to every effect's field() and to main.\n\nuniform float u_time;        // seconds since start, unscaled by speed\nuniform vec2  u_resolution;  // drawing buffer size, device px\nuniform float u_dpr;\nuniform vec2  u_cell;        // cell size in CSS px: (dens * 0.6, dens)\nuniform vec2  u_grid;        // cols, rows\nuniform float u_speed;\nuniform vec3  u_accent;\n\nuniform sampler2D u_glyphAtlas;\nuniform int   u_charCount;\n\n// --- phosphor feedback ---\nuniform sampler2D u_prev;  // previous frame\nuniform float u_fade;      // how far to pull it toward the background, 0..1\n\n// --- pointer block: written only by the shared pass, see pointer.glsl ---\nuniform vec2  u_pointer;       // CSS px, top-left origin\nuniform vec2  u_pointerVel;    // CSS px per frame\nuniform float u_pointerEnergy; // 0..1\nuniform float u_pointerOn;     // 0 or 1\nuniform float u_radius;\nuniform float u_force;\n\n// --- colour block ---\nuniform vec4  u_background;  // premultiplied: (rgb * a, a)\nuniform vec3  u_ink;         // the bright end of the ambient ramp\n\n// --- ambient tone curve: shapes field(), never the pointer pass ---\nuniform float u_contrast;\nuniform float u_brightness;\n\n// The atlas is a horizontal strip of u_charCount monospace glyphs, drawn\n// white on transparent. Coverage is the alpha channel.\nfloat sampleGlyph(int index, vec2 sub) {\n  float u = (float(index) + sub.x) / float(u_charCount);\n  return texture(u_glyphAtlas, vec2(u, sub.y)).a;\n}\n\n// \u2500\u2500 Convenience noise for custom effects. Unused functions are stripped by\n// the GLSL compiler, so these cost nothing unless a field() calls them.\n\nfloat hash21(vec2 p) {\n  vec3 p3 = fract(vec3(p.xyx) * 0.1031);\n  p3 += dot(p3, p3.yzx + 33.33);\n  return fract((p3.x + p3.y) * p3.z);\n}\n\nfloat valueNoise(vec2 p) {\n  vec2 i = floor(p);\n  vec2 f = fract(p);\n  vec2 u = f * f * (3.0 - 2.0 * f);\n  float a = hash21(i);\n  float b = hash21(i + vec2(1.0, 0.0));\n  float c = hash21(i + vec2(0.0, 1.0));\n  float d = hash21(i + vec2(1.0, 1.0));\n  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n}\n\nfloat fbm(vec2 p) {\n  float sum = 0.0;\n  float amp = 0.5;\n  for (int i = 0; i < 4; i++) {\n    sum += amp * valueNoise(p);\n    p *= 2.02;\n    amp *= 0.5;\n  }\n  return sum;\n}\n";

// src/renderer/shaders/pointer.glsl
var pointer_default = "// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n// THE SHARED POINTER LAYER \u2014 THE GOLDEN RULE\n//\n// This is the only place in motes where cursor math is allowed to live. It is\n// applied in main() after field() returns, identically for every effect.\n// An effect that wants pointer reactivity writes zero pointer code; it just\n// sets `pointer: true`.\n//\n// If you are about to add cursor math to an effect's field(), stop. It\n// belongs here.\n//\n// Ported from the ascii-flux prototype. The three terms and their constants\n// are the interaction feel \u2014 do not retune casually.\n// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nfloat pointerForce(vec2 px) {\n  if (u_pointerOn < 0.5) return 0.0;\n\n  vec2  d  = px - u_pointer;\n  float d2 = dot(d, d);\n\n  // Cull well outside the influence radius; the Gaussian is negligible there.\n  if (d2 >= u_radius * u_radius * 2.2) return 0.0;\n\n  float dist  = sqrt(d2);\n  float sigma = u_radius * 0.55;\n  float fall  = exp(-d2 / (2.0 * sigma * sigma));\n\n  // Ripple travelling outward. Deliberately driven by unscaled time, so the\n  // interaction keeps its own cadence independent of `speed`.\n  float ripple = sin(dist * 0.06 - u_time * 6.0) * 0.5 + 0.5;\n\n  // Wake: only the half the cursor is moving toward lights up.\n  float wake = 0.0;\n  if (dist > 0.001) {\n    float along = dot(d, u_pointerVel) / (dist + 0.001);\n    wake = max(0.0, along) * 0.08 * u_pointerEnergy;\n  }\n\n  return fall * (u_force * 0.06) * (0.5 + ripple)  // core, ripple-modulated\n       + fall * wake                               // directional wake\n       + fall * u_pointerEnergy * 0.5;             // energy glow\n}\n";

// src/renderer/shaders/main.frag
var main_default = "// Assembled last. Expects common.glsl, the selected effect's field(), and\n// pointer.glsl to have been concatenated above it.\n\nvoid main() {\n  // Work in CSS pixels with a top-left origin, matching the prototype's\n  // coordinate space so every ported constant keeps its meaning.\n  vec2 px = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_dpr;\n\n  vec2 g    = px / u_cell;\n  vec2 cell = floor(g);\n  vec2 sub  = fract(g);\n\n  // Phosphor: last frame, decayed toward the background. Premultiplied\n  // throughout, so a transparent background decays toward vec4(0) \u2014 a clean\n  // fade-out \u2014 and an opaque one is arithmetically what it always was.\n  vec4 prev  = texelFetch(u_prev, ivec2(gl_FragCoord.xy), 0);\n  vec4 faded = mix(prev, u_background, u_fade);\n\n  // 1. The effect. Time-only, pointer-blind, by construction.\n  float v = field(cell, u_time * u_speed);\n\n  // 2. The ambient tone curve. Deliberately here, before the pointer pass:\n  //    contrast reshapes which glyphs the field reaches for, and the cursor\n  //    must still punch through at full strength across a flattened field.\n  v = clamp((v - 0.5) * u_contrast + 0.5 + u_brightness, 0.0, 1.0);\n\n  // 3. The shared pointer pass. Same code for every effect.\n  float boost = pointerForce(px);\n\n  float val = v + boost;\n\n  // Near-empty cells leave the decaying frame untouched: sparser field, and a\n  // cheap early out.\n  if (val < 0.14) {\n    fragColor = faded;\n    return;\n  }\n  val = min(val, 1.0);\n\n  // 4. Quantise to the glyph ramp and sample the atlas.\n  int   gi  = int(val * float(u_charCount - 1));\n  float cov = sampleGlyph(gi, sub);\n\n  // 5. Colour. The ambient ramp runs from the background toward `ink`, so dim\n  //    cells recede into whatever the background is \u2014 which is the whole\n  //    reason a light background works at all. 0.44/0.56 and the #827865\n  //    default are the solution to reproducing the old (60 + val*70)/255\n  //    warm-grey ramp: worst case 0.68/255 across the range, under one 8-bit\n  //    step. Changing them changes every existing user's page.\n  float ramp = 0.44 + val * 0.56;\n  vec3  dim  = mix(u_background.rgb, u_ink, ramp);\n  float dimA = mix(ramp, 1.0, u_background.a);\n\n  //    Value drives colour toward the accent, and pointer boost drives it far\n  //    harder. This is what makes the cursor read.\n  float m    = min(1.0, val * 0.5 + boost * 1.4);\n  vec3  col  = mix(dim, u_accent, m);\n  float colA = mix(dimA, 1.0, m);\n\n  // 6. Composite the glyph over the decaying frame. Premultiplied source-over:\n  //    coverage attenuates the destination and scales the source together.\n  fragColor = mix(faded, vec4(col, colA), cov);\n}\n";

// src/renderer/shaders/blit.frag
var blit_default = "// Present pass: copy the accumulation target to the screen 1:1.\n// texelFetch keeps it exact \u2014 no filtering, no half-texel drift.\n\nuniform sampler2D u_src;\n\nvoid main() {\n  // Alpha carries through: the accumulation target is premultiplied, and a\n  // transparent background needs that alpha to reach the compositor.\n  fragColor = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);\n}\n";

// src/renderer/gl.ts
var VERTEX_SHADER = quad_default;
var FRAGMENT_HEADER = `#version 300 es
precision highp float;
out vec4 fragColor;
`;
function assembleFragmentShader(effect) {
  return [
    FRAGMENT_HEADER,
    common_default,
    effect.glsl,
    pointer_default,
    main_default
  ].join("\n");
}
var UNIFORM_NAMES = [
  "u_time",
  "u_resolution",
  "u_dpr",
  "u_cell",
  "u_grid",
  "u_speed",
  "u_accent",
  "u_background",
  "u_ink",
  "u_contrast",
  "u_brightness",
  "u_glyphAtlas",
  "u_charCount",
  "u_prev",
  "u_fade",
  "u_pointer",
  "u_pointerVel",
  "u_pointerEnergy",
  "u_pointerOn",
  "u_radius",
  "u_force"
];
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("[motes] could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    throw new Error(`[motes] ${kind} shader failed to compile:
${log}`);
  }
  return shader;
}
function linkProgram(gl, vertexSource, fragmentSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("[motes] could not create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`[motes] program failed to link:
${log}`);
  }
  return program;
}
function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    // Unconditionally alpha-capable: `set({ background: 'transparent' })` can
    // arrive at any time and context attributes are immutable after creation.
    // Costs one compositing pass on opaque setups; the alternative is
    // transparency that only works if you asked for it in the constructor.
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance"
  });
  if (!gl) throw new Error("[motes] WebGL2 is not available in this browser");
  const vao = gl.createVertexArray();
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const canRenderFloat = Boolean(gl.getExtension("EXT_color_buffer_float"));
  const blitProgram = linkProgram(gl, VERTEX_SHADER, FRAGMENT_HEADER + blit_default);
  const blitSrc = gl.getUniformLocation(blitProgram, "u_src");
  let targets = null;
  let readIndex = 0;
  let background = [5 / 255, 4 / 255, 3 / 255, 1];
  let program = null;
  let uniforms = {};
  let destroyed = false;
  function createTarget(width, height) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (canRenderFloat) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        width,
        height,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );
    gl.clearColor(background[0], background[1], background[2], background[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex };
  }
  function releaseTargets() {
    if (!targets) return;
    for (const t of targets) {
      gl.deleteFramebuffer(t.fb);
      gl.deleteTexture(t.tex);
    }
    targets = null;
  }
  function cacheUniforms(target) {
    uniforms = {};
    for (const name of UNIFORM_NAMES) {
      const location = gl.getUniformLocation(target, name);
      if (location) uniforms[name] = location;
    }
  }
  return {
    setEffect(effect) {
      if (destroyed) return;
      const next = linkProgram(gl, VERTEX_SHADER, assembleFragmentShader(effect));
      if (program) gl.deleteProgram(program);
      program = next;
      gl.useProgram(program);
      cacheUniforms(program);
    },
    setAtlas(atlas) {
      if (destroyed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlas.canvas
      );
    },
    setBackground(bg) {
      if (destroyed) return;
      background = bg;
    },
    resize(width, height) {
      if (destroyed) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      releaseTargets();
      targets = [createTarget(width, height), createTarget(width, height)];
      readIndex = 0;
    },
    draw(frame) {
      if (destroyed || !program || !targets) return;
      const read = targets[readIndex];
      const write = targets[readIndex === 0 ? 1 : 0];
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      const u = uniforms;
      if (u.u_prev) gl.uniform1i(u.u_prev, 1);
      if (u.u_fade) gl.uniform1f(u.u_fade, frame.fade);
      if (u.u_glyphAtlas) gl.uniform1i(u.u_glyphAtlas, 0);
      if (u.u_time) gl.uniform1f(u.u_time, frame.time);
      if (u.u_resolution) {
        gl.uniform2f(u.u_resolution, canvas.width, canvas.height);
      }
      if (u.u_dpr) gl.uniform1f(u.u_dpr, frame.dpr);
      if (u.u_cell) gl.uniform2f(u.u_cell, frame.cellW, frame.cellH);
      if (u.u_grid) gl.uniform2f(u.u_grid, frame.cols, frame.rows);
      if (u.u_speed) gl.uniform1f(u.u_speed, frame.speed);
      if (u.u_accent) gl.uniform3fv(u.u_accent, frame.accent);
      if (u.u_background) gl.uniform4fv(u.u_background, background);
      if (u.u_ink) gl.uniform3fv(u.u_ink, frame.ink);
      if (u.u_contrast) gl.uniform1f(u.u_contrast, frame.contrast);
      if (u.u_brightness) gl.uniform1f(u.u_brightness, frame.brightness);
      if (u.u_charCount) gl.uniform1i(u.u_charCount, frame.charCount);
      if (u.u_pointer) gl.uniform2f(u.u_pointer, frame.pointerX, frame.pointerY);
      if (u.u_pointerVel) {
        gl.uniform2f(u.u_pointerVel, frame.pointerVx, frame.pointerVy);
      }
      if (u.u_pointerEnergy) {
        gl.uniform1f(u.u_pointerEnergy, frame.pointerEnergy);
      }
      if (u.u_pointerOn) {
        gl.uniform1f(u.u_pointerOn, frame.pointerOn ? 1 : 0);
      }
      if (u.u_radius) gl.uniform1f(u.u_radius, frame.radius);
      if (u.u_force) gl.uniform1f(u.u_force, frame.force);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(blitProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, write.tex);
      if (blitSrc) gl.uniform1i(blitSrc, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      readIndex = readIndex === 0 ? 1 : 0;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (program) gl.deleteProgram(program);
      gl.deleteProgram(blitProgram);
      releaseTargets();
      gl.deleteTexture(texture);
      gl.deleteVertexArray(vao);
      program = null;
      uniforms = {};
    }
  };
}

// src/renderer/pointer.ts
var REFERENCE_DT = 1 / 60;
var REFERENCE_LERP = 0.25;
var REFERENCE_ENERGY_DECAY = 0.9;
var REFERENCE_IDLE_DECAY = 0.92;
var REFERENCE_ENERGY_GAIN = 0.03;
var MAX_DT = 1 / 15;
var MIN_DT = 1e-4;
var OFFSCREEN = -9999;
function stepPointer(state, dt) {
  const step = Math.min(MAX_DT, Math.max(MIN_DT, dt)) / REFERENCE_DT;
  if (state.active) {
    const lerp = 1 - Math.pow(1 - REFERENCE_LERP, step);
    const decay = Math.pow(REFERENCE_ENERGY_DECAY, step);
    const gain = REFERENCE_ENERGY_GAIN * ((1 - decay) / (1 - REFERENCE_ENERGY_DECAY));
    const px = state.x;
    const py = state.y;
    state.x += (state.tx - state.x) * lerp;
    state.y += (state.ty - state.y) * lerp;
    state.vx = (state.x - px) / step;
    state.vy = (state.y - py) / step;
    const speed = Math.hypot(state.vx, state.vy);
    state.energy = Math.min(1, state.energy * decay + speed * gain);
  } else {
    state.energy *= Math.pow(REFERENCE_IDLE_DECAY, step);
  }
}
function createPointerState() {
  return {
    x: OFFSCREEN,
    y: OFFSCREEN,
    tx: OFFSCREEN,
    ty: OFFSCREEN,
    vx: 0,
    vy: 0,
    active: false,
    energy: 0
  };
}
function hitTest(rect, clientX, clientY) {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return {
    x,
    y,
    inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
  };
}
function createPointer(canvas) {
  const state = createPointerState();
  let rect = { left: 0, top: 0, width: 0, height: 0 };
  function refreshRect() {
    const r = canvas.getBoundingClientRect();
    rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function track(clientX, clientY, press) {
    const hit = hitTest(rect, clientX, clientY);
    if (!hit.inside) {
      state.active = false;
      return;
    }
    state.tx = hit.x;
    state.ty = hit.y;
    if (!state.active) {
      state.x = hit.x;
      state.y = hit.y;
    }
    state.active = true;
    if (press) state.energy = 1;
  }
  const onMove = (e) => track(e.clientX, e.clientY, false);
  const onDown = (e) => track(e.clientX, e.clientY, true);
  const onOut = () => {
    state.active = false;
  };
  const onScroll = () => refreshRect();
  let attached = false;
  return {
    state,
    update(dt) {
      stepPointer(state, dt);
    },
    isLive() {
      return state.active || state.energy > 0.02;
    },
    refreshRect,
    attach() {
      if (attached) return;
      attached = true;
      refreshRect();
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("blur", onOut);
      document.addEventListener("pointerleave", onOut);
      window.addEventListener("scroll", onScroll, {
        passive: true,
        capture: true
      });
    },
    detach() {
      if (!attached) return;
      attached = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("blur", onOut);
      document.removeEventListener("pointerleave", onOut);
      window.removeEventListener("scroll", onScroll, { capture: true });
    }
  };
}

// src/types.ts
var DEFAULT_OPTIONS = {
  effect: "flow",
  pointer: true,
  radius: 150,
  force: 1.4,
  speed: 1,
  density: 13,
  charset: " .:-=+*#%@",
  accent: "#d8531f",
  background: "#050403",
  ink: "#827865",
  contrast: 1,
  brightness: 0,
  respectMotionPreference: true,
  trail: 0.3
};

// src/motes.ts
var MAX_DPR = 2;
var MIN_FADE = 0.08;
var ARM_DELAY_MS = 1e3;
var NOISY = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
})();
function cellSize(density) {
  return { w: Math.max(5, density * 0.6), h: density };
}
function compact(patch) {
  const out = {};
  for (const key of Object.keys(patch)) {
    if (patch[key] !== void 0) Object.assign(out, { [key]: patch[key] });
  }
  return out;
}
function resolveOptions(base, patch) {
  const next = { ...base, ...compact(patch) };
  if (patch.charset !== void 0) validateCharset(next.charset);
  if (patch.effect !== void 0 && !getEffect(next.effect)) {
    throw new Error(
      `[motes] unknown effect "${next.effect}". Registered: ${listEffects().join(", ")}`
    );
  }
  next.radius = Math.max(1, next.radius);
  next.density = Math.max(2, next.density);
  next.trail = Math.min(1, Math.max(0, next.trail));
  next.contrast = Math.min(4, Math.max(0, next.contrast));
  next.brightness = Math.min(1, Math.max(-1, next.brightness));
  return next;
}
function createMotes(canvas, config = {}) {
  if (!canvas) throw new Error("[motes] createMotes requires a canvas element");
  let options = resolveOptions(DEFAULT_OPTIONS, {
    ...config,
    // Validate resolved values, not just the provided patch.
    charset: config.charset ?? DEFAULT_OPTIONS.charset,
    effect: config.effect ?? DEFAULT_OPTIONS.effect
  });
  const renderer = createRenderer(canvas);
  const pointer = createPointer(canvas);
  let accent = parseHexColor(options.accent, "accent");
  let ink = parseHexColor(options.ink, "ink");
  let background = premultiply(parseColorRGBA(options.background));
  let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  let cols = 0;
  let rows = 0;
  let raf = 0;
  let running = false;
  let destroyed = false;
  let startTime = 0;
  let lastTime = 0;
  let diagnosed = false;
  let armed = null;
  function runDiagnostics() {
    if (diagnosed || destroyed) return;
    diagnosed = true;
    const cs = getComputedStyle(canvas);
    const root = document.documentElement;
    const container = canvas.offsetParent ?? root;
    const result = diagnose({
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      position: cs.position,
      left: cs.left,
      right: cs.right,
      top: cs.top,
      bottom: cs.bottom,
      zIndex: cs.zIndex,
      containerWidth: container.clientWidth,
      containerHeight: container.clientHeight,
      htmlBg: getComputedStyle(root).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      quiet: canvas.hasAttribute("data-motes-quiet")
    });
    if (result) console.warn(result.message);
    const palette = diagnoseContrast(background, ink, canvas.hasAttribute("data-motes-quiet"));
    if (palette) console.warn(palette.message);
  }
  function armDiagnostics() {
    if (!NOISY || diagnosed) return;
    if (armed) clearTimeout(armed);
    armed = setTimeout(runDiagnostics, ARM_DELAY_MS);
  }
  function rebuildAtlas() {
    const { w, h } = cellSize(options.density);
    renderer.setAtlas(buildGlyphAtlas(options.charset, w, h, dpr));
  }
  function measure() {
    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return false;
    const dprChanged = nextDpr !== dpr;
    dpr = nextDpr;
    const { w, h } = cellSize(options.density);
    cols = Math.ceil(cssW / w) + 1;
    rows = Math.ceil(cssH / h) + 1;
    renderer.resize(Math.floor(cssW * dpr), Math.floor(cssH * dpr));
    pointer.refreshRect();
    armDiagnostics();
    return dprChanged;
  }
  const observer = new ResizeObserver(() => {
    if (measure()) rebuildAtlas();
  });
  let dprQuery = null;
  function onDprChange() {
    if (measure()) rebuildAtlas();
    watchDpr();
  }
  function watchDpr() {
    dprQuery?.removeEventListener("change", onDprChange);
    dprQuery = window.matchMedia(
      `(resolution: ${window.devicePixelRatio || 1}dppx)`
    );
    dprQuery.addEventListener("change", onDprChange);
  }
  let motionQuery = null;
  let reduceMotion = false;
  function onMotionChange() {
    reduceMotion = motionQuery?.matches ?? false;
  }
  function watchMotion() {
    motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = motionQuery.matches;
    motionQuery.addEventListener("change", onMotionChange);
  }
  function render(now) {
    if (startTime === 0) {
      startTime = now;
      lastTime = now;
    }
    const time = (now - startTime) / 1e3;
    const dt = (now - lastTime) / 1e3;
    lastTime = now;
    pointer.update(dt);
    const { w, h } = cellSize(options.density);
    const p = pointer.state;
    renderer.draw({
      time,
      dpr,
      cellW: w,
      cellH: h,
      cols,
      rows,
      speed: options.respectMotionPreference && reduceMotion ? 0 : options.speed,
      accent,
      ink,
      contrast: options.contrast,
      brightness: options.brightness,
      charCount: options.charset.length,
      pointerX: p.x,
      pointerY: p.y,
      pointerVx: p.vx,
      pointerVy: p.vy,
      pointerEnergy: p.energy,
      pointerOn: options.pointer && pointer.isLive(),
      radius: options.radius,
      force: options.force,
      // The prototype's phosphor clear: fade the previous frame toward the
      // background by (1 - trail), floored so persistence always terminates.
      fade: Math.max(MIN_FADE, 1 - options.trail)
    });
  }
  const frame = (now) => {
    if (!running) return;
    render(now);
    raf = requestAnimationFrame(frame);
  };
  renderer.setEffect(getEffect(options.effect));
  renderer.setBackground(background);
  measure();
  rebuildAtlas();
  observer.observe(canvas);
  watchDpr();
  watchMotion();
  pointer.attach();
  return {
    start() {
      if (running || destroyed) return;
      running = true;
      startTime = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    set(patch) {
      if (destroyed) return;
      const previous = options;
      const next = resolveOptions(previous, patch);
      const nextAccent = next.accent !== previous.accent ? parseHexColor(next.accent, "accent") : accent;
      const nextInk = next.ink !== previous.ink ? parseHexColor(next.ink, "ink") : ink;
      const nextBackground = next.background !== previous.background ? premultiply(parseColorRGBA(next.background)) : background;
      options = next;
      accent = nextAccent;
      ink = nextInk;
      if (options.effect !== previous.effect) {
        renderer.setEffect(getEffect(options.effect));
      }
      if (options.background !== previous.background) {
        background = nextBackground;
        renderer.setBackground(background);
      }
      if (options.density !== previous.density) {
        measure();
      }
      if (options.charset !== previous.charset || options.density !== previous.density) {
        rebuildAtlas();
      }
      if (!running) {
        requestAnimationFrame((now) => {
          if (!destroyed && !running) render(now);
        });
      }
    },
    getOptions() {
      return options;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      if (armed) clearTimeout(armed);
      armed = null;
      observer.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
      dprQuery = null;
      motionQuery?.removeEventListener("change", onMotionChange);
      motionQuery = null;
      pointer.detach();
      renderer.destroy();
    }
  };
}

export { DEFAULT_OPTIONS, createMotes, defineEffect, listEffects };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map