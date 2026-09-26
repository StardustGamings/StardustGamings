import type { DrawableImage } from '@/canvas/render/types';
import { clamp } from '@/utils/math';
import type { PixelParams } from './adjustments';

/**
 * GPU develop pipeline (WebGL 1, so it runs on practically every phone).
 *
 *   source ─▶ warp (perspective) ─▶ [blur] ─▶ develop (tone, colour, curves,
 *   sharpen, fade, vignette, grain) ─▶ [composite with mask + backdrop] ─▶ canvas
 *
 * Intermediate textures hold straight (non-premultiplied) alpha; the final pass
 * premultiplies for the canvas. The maths mirror `adjustPixel` in adjustments.ts.
 */

const HEADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform float uFlipY;
vec2 uvIn() { return vec2(vUv.x, uFlipY > 0.5 ? 1.0 - vUv.y : vUv.y); }
`;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const WARP = `${HEADER}
uniform sampler2D uTex;
uniform mat3 uWarp;
void main() {
  vec3 p = uWarp * vec3(uvIn(), 1.0);
  gl_FragColor = texture2D(uTex, p.xy / p.z);
}`;

/** Separable Gaussian on premultiplied colour (so transparent edges don't bleed dark). */
const BLUR = `${HEADER}
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uSigma;
void main() {
  vec2 uv = uvIn();
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = -12; i <= 12; i++) {
    float fi = float(i);
    float w = exp(-0.5 * fi * fi / (uSigma * uSigma));
    vec4 c = texture2D(uTex, uv + uStep * fi);
    sum += vec4(c.rgb * c.a, c.a) * w;
    wsum += w;
  }
  sum /= wsum;
  gl_FragColor = sum.a > 0.0001 ? vec4(sum.rgb / sum.a, sum.a) : vec4(0.0);
}`;

const DEVELOP = `${HEADER}
uniform sampler2D uTex;
uniform sampler2D uLut;
uniform float uUseLut;
uniform vec2 uTexel;
uniform vec2 uSize;
uniform float uSharpen;
uniform float uPremultiply;
uniform float uExposure, uBrightness, uContrast, uHighlights, uShadows;
uniform float uTemperature, uTint, uSaturation, uVibrance, uFade, uVignette, uGrain;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float grainNoise(vec2 p) {
  p = mod(p, 257.0);
  return fract(sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453) - 0.5;
}

void main() {
  vec2 uv = uvIn();
  vec4 src = texture2D(uTex, uv);
  vec3 c = src.rgb;
  if (uSharpen > 0.0) {
    vec3 n = texture2D(uTex, uv + vec2(0.0, uTexel.y)).rgb;
    vec3 s = texture2D(uTex, uv - vec2(0.0, uTexel.y)).rgb;
    vec3 e = texture2D(uTex, uv + vec2(uTexel.x, 0.0)).rgb;
    vec3 w = texture2D(uTex, uv - vec2(uTexel.x, 0.0)).rgb;
    c = c + uSharpen * 1.5 * (c - (n + s + e + w) * 0.25);
    c = clamp(c, 0.0, 1.0);
  }
  if (uExposure != 0.0) c = pow(pow(max(c, 0.0), vec3(2.2)) * pow(2.0, uExposure * 1.5), vec3(1.0 / 2.2));
  if (uBrightness != 0.0) c = pow(clamp(c, 0.0, 1.0), vec3(exp(-uBrightness * 0.8)));
  if (uContrast != 0.0) {
    float f = uContrast > 0.0 ? 1.0 + uContrast * 1.2 : 1.0 + uContrast * 0.8;
    c = (c - 0.5) * f + 0.5;
  }
  if (uHighlights != 0.0 || uShadows != 0.0) {
    float l = clamp(luma(c), 0.0, 1.0);
    float amt = uShadows * 0.6 * (1.0 - smoothstep(0.0, 0.55, l)) + uHighlights * 0.6 * smoothstep(0.45, 1.0, l);
    vec3 cc = clamp(c, 0.0, 1.0);
    c = c + amt * (amt > 0.0 ? 1.0 - cc : cc);
  }
  if (uTemperature != 0.0 || uTint != 0.0) {
    c *= vec3(1.0 + uTemperature * 0.18 + uTint * 0.05, 1.0 - uTint * 0.12, 1.0 - uTemperature * 0.18 + uTint * 0.05);
  }
  if (uSaturation != 0.0 || uVibrance != 0.0) {
    float l = luma(c);
    float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
    float f = 1.0 + uSaturation + uVibrance * (1.0 - clamp(sat, 0.0, 1.0)) * 1.2;
    c = l + (c - l) * f;
  }
  if (uUseLut > 0.5) {
    vec3 cc = clamp(c, 0.0, 1.0) * (255.0 / 256.0) + (0.5 / 256.0);
    c = vec3(texture2D(uLut, vec2(cc.r, 0.5)).r, texture2D(uLut, vec2(cc.g, 0.5)).g, texture2D(uLut, vec2(cc.b, 0.5)).b);
  }
  if (uFade > 0.0) c = c * (1.0 - 0.22 * uFade) + 0.16 * uFade;
  if (uVignette != 0.0) {
    float aspect = uSize.x / uSize.y;
    vec2 d = (uv - 0.5) * vec2(min(1.0, aspect), min(1.0, 1.0 / aspect));
    float m = smoothstep(0.35, 1.05, length(d) / 0.7071) * abs(uVignette) * 0.8;
    c = uVignette > 0.0 ? c * (1.0 - m) : c + (1.0 - c) * m;
  }
  if (uGrain > 0.0) c += grainNoise(floor(uv * uSize)) * uGrain * 0.22;
  c = clamp(c, 0.0, 1.0);
  gl_FragColor = uPremultiply > 0.5 ? vec4(c * src.a, src.a) : vec4(c, src.a);
}`;

/**
 * Background-only copy for the "portrait blur" backdrop: alpha = 1 − mask, so the
 * (premultiplied) blur fills the subject's area from the surrounding background
 * instead of smearing the subject into a halo.
 */
const MASK_OUT = `${HEADER}
uniform sampler2D uSubject;
uniform sampler2D uMask;
uniform mat3 uWarp;
void main() {
  vec2 uv = uvIn();
  vec4 s = texture2D(uSubject, uv);
  vec3 p = uWarp * vec3(uv, 1.0);
  float m = texture2D(uMask, p.xy / p.z).r;
  gl_FragColor = vec4(s.rgb, s.a * (1.0 - m));
}`;

/** Cut-out: subject alpha = mask, over an optional backdrop. Output is premultiplied. */
const COMPOSITE = `${HEADER}
uniform sampler2D uSubject;
uniform sampler2D uMask;
uniform sampler2D uBackdrop;
uniform float uHasBackdrop;
uniform float uOpaqueBackdrop;
uniform mat3 uWarp;
void main() {
  vec2 uv = uvIn();
  vec4 s = texture2D(uSubject, uv);
  vec3 p = uWarp * vec3(uv, 1.0);
  float m = texture2D(uMask, p.xy / p.z).r * s.a;
  vec3 premult = s.rgb * m;
  float a = m;
  if (uHasBackdrop > 0.5) {
    vec4 b = texture2D(uBackdrop, uv);
    if (uOpaqueBackdrop > 0.5) b.a = 1.0;
    premult += b.rgb * b.a * (1.0 - m);
    a += b.a * (1.0 - m);
  }
  gl_FragColor = vec4(premult, a);
}`;

type GL = WebGLRenderingContext;

interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  used: number;
}

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export interface DevelopInput {
  source: DrawableImage;
  width: number;
  height: number;
  params: PixelParams;
  /** 256×1 RGBA table, or null for no curves. */
  lut: Uint8Array | null;
  /** Row-major 3×3 output→source uv map, or null. */
  warp: number[] | null;
  sharpen: number;
  /** Blur radius in output pixels (0 = none). */
  blur: number;
  cutout: null | {
    mask: DrawableImage;
    /** Feather radius in output pixels. */
    feather: number;
    backdrop: { kind: 'none' } | { kind: 'image'; image: DrawableImage } | { kind: 'blur'; radius: number };
  };
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** WebGL wants column-major matrices (and can't transpose in WebGL 1). */
const columnMajor = (m: number[]) => new Float32Array([m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!]);

export class GlProcessor {
  readonly canvas: HTMLCanvasElement;
  readonly maxSize: number;
  private gl: GL;
  private programs = new Map<string, Program>();
  private pool: Target[] = [];
  private textures = new WeakMap<object, { tex: WebGLTexture; used: number }>();
  private textureList: { key: object; tex: WebGLTexture }[] = [];
  private lutTex: WebGLTexture | null = null;
  private clock = 0;
  lost = false;

  static create(): GlProcessor | null {
    if (typeof document === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
      });
      if (!gl) return null;
      return new GlProcessor(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: GL) {
    this.canvas = canvas;
    this.gl = gl;
    this.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.disable(gl.BLEND);
  }

  private program(name: string, source: string): Program {
    const cached = this.programs.get(name);
    if (cached) return cached;
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
      return sh;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    const p = { program, uniforms: new Map() };
    this.programs.set(name, p);
    return p;
  }

  private use(p: Program) {
    const gl = this.gl;
    gl.useProgram(p.program);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  private u(p: Program, name: string): WebGLUniformLocation | null {
    if (!p.uniforms.has(name)) p.uniforms.set(name, this.gl.getUniformLocation(p.program, name));
    return p.uniforms.get(name)!;
  }

  private newTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /** Uploads (or reuses) a texture for an image; a few are kept so slider drags don't re-upload. */
  private imageTexture(image: DrawableImage): WebGLTexture {
    const gl = this.gl;
    const hit = this.textures.get(image);
    if (hit) {
      hit.used = ++this.clock;
      return hit.tex;
    }
    const tex = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
    this.textures.set(image, { tex, used: ++this.clock });
    this.textureList.push({ key: image, tex });
    if (this.textureList.length > 6) {
      const old = this.textureList.shift()!;
      this.textures.delete(old.key);
      gl.deleteTexture(old.tex);
    }
    return tex;
  }

  /** Canvases change content in place, so they're uploaded fresh (and not cached). */
  private transientTexture(image: DrawableImage): WebGLTexture {
    const gl = this.gl;
    const tex = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
    return tex;
  }

  private target(width: number, height: number, exclude: Target[] = []): Target {
    const gl = this.gl;
    const free = this.pool.find((t) => t.width === width && t.height === height && !exclude.includes(t));
    if (free) {
      free.used = ++this.clock;
      return free;
    }
    const tex = this.newTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const t = { tex, fbo, width, height, used: ++this.clock };
    this.pool.push(t);
    if (this.pool.length > 14) {
      const victim = [...this.pool].filter((x) => !exclude.includes(x) && x !== t).sort((a, b) => a.used - b.used)[0];
      if (victim) {
        this.pool.splice(this.pool.indexOf(victim), 1);
        gl.deleteFramebuffer(victim.fbo);
        gl.deleteTexture(victim.tex);
      }
    }
    return t;
  }

  private bindTex(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private draw(target: Target | null, width: number, height: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private pass(name: string, src: string, target: Target | null, width: number, height: number, setup: (p: Program) => void) {
    const p = this.program(name, src);
    this.use(p);
    this.gl.uniform1f(this.u(p, 'uFlipY'), target ? 0 : 1);
    setup(p);
    this.draw(target, width, height);
  }

  /**
   * Gaussian blur with radius `radius` (in pixels of a `width`×`height` image).
   * Large radii are computed at reduced resolution (visually identical, much faster).
   */
  private blur(tex: WebGLTexture, width: number, height: number, radius: number, keep: Target[]): Target {
    let cur = tex;
    let w = width;
    let h = height;
    let r = radius;
    const held: Target[] = [...keep];
    while (r > 10 && w > 8 && h > 8) {
      const nw = Math.max(1, Math.round(w / 2));
      const nh = Math.max(1, Math.round(h / 2));
      const t = this.target(nw, nh, held);
      this.pass('warp', WARP, t, nw, nh, (p) => {
        this.bindTex(0, cur);
        this.gl.uniform1i(this.u(p, 'uTex'), 0);
        this.gl.uniformMatrix3fv(this.u(p, 'uWarp'), false, columnMajor(IDENTITY));
      });
      held.push(t);
      cur = t.tex;
      w = nw;
      h = nh;
      r /= 2;
    }
    const sigma = Math.max(0.5, r / 2.5);
    const spacing = Math.max(1, (sigma * 3) / 12);
    const a = this.target(w, h, held);
    held.push(a);
    this.pass('blur', BLUR, a, w, h, (p) => {
      this.bindTex(0, cur);
      this.gl.uniform1i(this.u(p, 'uTex'), 0);
      this.gl.uniform2f(this.u(p, 'uStep'), spacing / w, 0);
      this.gl.uniform1f(this.u(p, 'uSigma'), sigma / spacing);
    });
    const b = this.target(w, h, held);
    this.pass('blur', BLUR, b, w, h, (p) => {
      this.bindTex(0, a.tex);
      this.gl.uniform1i(this.u(p, 'uTex'), 0);
      this.gl.uniform2f(this.u(p, 'uStep'), 0, spacing / h);
      this.gl.uniform1f(this.u(p, 'uSigma'), sigma / spacing);
    });
    return b;
  }

  private lut(data: Uint8Array): WebGLTexture {
    const gl = this.gl;
    this.lutTex ??= this.newTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return this.lutTex;
  }

  /** Runs the pipeline; the result is left in `this.canvas` (premultiplied), sized `width`×`height`. */
  develop(input: DevelopInput): HTMLCanvasElement | null {
    if (this.lost || this.gl.isContextLost()) return null;
    const gl = this.gl;
    const width = clamp(Math.round(input.width), 1, this.maxSize);
    const height = clamp(Math.round(input.height), 1, this.maxSize);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const transient: WebGLTexture[] = [];
    const held: Target[] = [];

    try {
      let base = this.imageTexture(input.source);

      if (input.warp) {
        const t = this.target(width, height, held);
        held.push(t);
        this.pass('warp', WARP, t, width, height, (p) => {
          this.bindTex(0, base);
          gl.uniform1i(this.u(p, 'uTex'), 0);
          gl.uniformMatrix3fv(this.u(p, 'uWarp'), false, columnMajor(input.warp!));
        });
        base = t.tex;
      }
      if (input.blur > 0.5) {
        const t = this.blur(base, width, height, input.blur, held);
        held.push(t);
        base = t.tex;
      }

      const toCanvas = !input.cutout;
      const developed = toCanvas ? null : this.target(width, height, held);
      if (developed) held.push(developed);
      const pp = input.params;
      this.pass('develop', DEVELOP, developed, width, height, (p) => {
        this.bindTex(0, base);
        gl.uniform1i(this.u(p, 'uTex'), 0);
        if (input.lut) this.bindTex(1, this.lut(input.lut));
        gl.uniform1i(this.u(p, 'uLut'), 1);
        gl.uniform1f(this.u(p, 'uUseLut'), input.lut ? 1 : 0);
        gl.uniform2f(this.u(p, 'uTexel'), 1 / width, 1 / height);
        gl.uniform2f(this.u(p, 'uSize'), width, height);
        gl.uniform1f(this.u(p, 'uSharpen'), input.sharpen);
        gl.uniform1f(this.u(p, 'uPremultiply'), toCanvas ? 1 : 0);
        gl.uniform1f(this.u(p, 'uExposure'), pp.exposure);
        gl.uniform1f(this.u(p, 'uBrightness'), pp.brightness);
        gl.uniform1f(this.u(p, 'uContrast'), pp.contrast);
        gl.uniform1f(this.u(p, 'uHighlights'), pp.highlights);
        gl.uniform1f(this.u(p, 'uShadows'), pp.shadows);
        gl.uniform1f(this.u(p, 'uTemperature'), pp.temperature);
        gl.uniform1f(this.u(p, 'uTint'), pp.tint);
        gl.uniform1f(this.u(p, 'uSaturation'), pp.saturation);
        gl.uniform1f(this.u(p, 'uVibrance'), pp.vibrance);
        gl.uniform1f(this.u(p, 'uFade'), pp.fade);
        gl.uniform1f(this.u(p, 'uVignette'), pp.vignette);
        gl.uniform1f(this.u(p, 'uGrain'), pp.grain);
      });

      if (input.cutout && developed) {
        const { mask, feather, backdrop } = input.cutout;
        let maskTex = this.transientTexture(mask);
        transient.push(maskTex);
        const maskW = mask.width;
        const maskH = mask.height;
        if (feather > 0.3) {
          // Feather is specified in output pixels; convert to mask pixels.
          const t = this.blur(maskTex, maskW, maskH, feather * (maskW / width), held);
          held.push(t);
          maskTex = t.tex;
        }
        let backdropTex: WebGLTexture | null = null;
        if (backdrop.kind === 'image') {
          backdropTex = this.transientTexture(backdrop.image);
          transient.push(backdropTex);
        } else if (backdrop.kind === 'blur') {
          const bg = this.target(width, height, held);
          held.push(bg);
          const mTex = maskTex;
          this.pass('mask-out', MASK_OUT, bg, width, height, (p) => {
            this.bindTex(0, developed.tex);
            gl.uniform1i(this.u(p, 'uSubject'), 0);
            this.bindTex(1, mTex);
            gl.uniform1i(this.u(p, 'uMask'), 1);
            gl.uniformMatrix3fv(this.u(p, 'uWarp'), false, columnMajor(input.warp ?? IDENTITY));
          });
          const t = this.blur(bg.tex, width, height, Math.max(1, backdrop.radius), held);
          held.push(t);
          backdropTex = t.tex;
        }
        this.pass('composite', COMPOSITE, null, width, height, (p) => {
          this.bindTex(0, developed.tex);
          gl.uniform1i(this.u(p, 'uSubject'), 0);
          this.bindTex(1, maskTex);
          gl.uniform1i(this.u(p, 'uMask'), 1);
          if (backdropTex) this.bindTex(2, backdropTex);
          gl.uniform1i(this.u(p, 'uBackdrop'), 2);
          gl.uniform1f(this.u(p, 'uHasBackdrop'), backdropTex ? 1 : 0);
          gl.uniform1f(this.u(p, 'uOpaqueBackdrop'), backdrop.kind === 'blur' ? 1 : 0);
          gl.uniformMatrix3fv(this.u(p, 'uWarp'), false, columnMajor(input.warp ?? IDENTITY));
        });
      }
      return this.canvas;
    } catch {
      return null;
    } finally {
      transient.forEach((t) => gl.deleteTexture(t));
    }
  }
}

let processor: GlProcessor | null | undefined;

/** Shared processor, or null where WebGL isn't available (the CPU path takes over). */
export function glProcessor(): GlProcessor | null {
  if (processor && processor.lost) processor = undefined;
  if (processor === undefined) processor = GlProcessor.create();
  return processor;
}
