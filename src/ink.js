// The pen-and-ink look (design F10):
//  - makeInk(): a Lambert material whose lit result is redrawn as watercolour wash + cross-hatching
//    in 6 levels, fixed to world space so the hatching never swims. Optional wood grain / parquet.
//  - InkPost: outline pass (depth + normal edges, slightly wobbly) and paper grain over the frame.
import * as THREE from 'three';

export const INK = new THREE.Color('#1A1714');
export const PAPER = new THREE.Color('#F7EEDC');

const NOISE_GLSL = /* glsl */ `
float ink_hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float ink_hash3(vec3 p){ return ink_hash(p.xy + p.z*17.17); }
float ink_noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(ink_hash(i), ink_hash(i+vec2(1,0)), f.x), mix(ink_hash(i+vec2(0,1)), ink_hash(i+vec2(1,1)), f.x), f.y);
}
float ink_fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*ink_noise(p); p *= 2.03; a *= 0.5; } return s; }
`;

const HATCH_GLSL = /* glsl */ `
// One family of parallel pen lines. Returns ink coverage 0..1, about one pixel wide at any distance.
float ink_lines(vec2 p, float ang, float spacing, float phase, float seed){
  vec2 d = vec2(cos(ang), sin(ang));
  float along = dot(p, d);
  float c = dot(p, vec2(-d.y, d.x)) / spacing + phase;
  // hand wobble: the line drifts slowly along its length
  c += (ink_noise(vec2(along*9.0, floor(c)*3.1 + seed)) - 0.5) * 0.35;
  float w = fwidth(c);
  float dist = 0.5 - abs(fract(c) - 0.5);     // distance to the nearest line, in cells
  float line = 1.0 - smoothstep(w*0.35, w*1.1, dist);
  // pen lifts: short random gaps along each stroke
  float gap = step(0.12, ink_noise(vec2(along*14.0 + seed*7.0, floor(c)*1.7)));
  line *= mix(1.0, gap, 0.8);
  // too dense to resolve: fade to an even grey instead of moiré
  return mix(line, 0.38, smoothstep(0.3, 0.7, w));
}
`;

let shaderCount = 0;

/**
 * @param {object} o
 * @param {string|number} o.color  watercolour wash colour
 * @param {number} [o.wash=0.55]   how strongly the wash tints the paper
 * @param {number} [o.wood=0]      0 none, 1 wood grain, 2 herringbone parquet
 * @param {THREE.Vector3} [o.grain] world direction the grain runs along
 * @param {number} [o.spacing=0.0065] hatch spacing in metres
 * @param {number} [o.emissive]    self-lit amount (lamp shade, glowing book)
 */
export function makeInk(o = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: o.color ?? '#E9C99A', side: o.side ?? THREE.FrontSide });
  if (o.emissive) { mat.emissive = new THREE.Color(o.emissiveColor ?? o.color ?? '#ffffff'); mat.emissiveIntensity = o.emissive; }
  if (o.transparent) { mat.transparent = true; mat.opacity = o.opacity ?? 0.5; mat.depthWrite = false; }
  const uniforms = {
    uInk: { value: INK },
    uPaper: { value: PAPER },
    uWash: { value: o.wash ?? 0.55 },
    uWood: { value: o.wood ?? 0 },
    uGrain: { value: (o.grain ?? new THREE.Vector3(1, 0, 0)).clone().normalize() },
    uSpacing: { value: o.spacing ?? 0.0065 },
    uSeed: { value: Math.random() * 50 },
    uGrainScale: { value: o.grainScale ?? 1 },
  };
  mat.userData.ink = uniforms;
  mat.customProgramCacheKey = () => 'ink' + (o.wood ?? 0);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInkPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vec4 inkWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    inkWp = instanceMatrix * inkWp;
  #endif
  vInkPos = (modelMatrix * inkWp).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vInkPos;
uniform vec3 uInk; uniform vec3 uPaper; uniform float uWash; uniform float uWood;
uniform vec3 uGrain; uniform float uSpacing; uniform float uSeed; uniform float uGrainScale;
${NOISE_GLSL}
${HATCH_GLSL}
// Herringbone parquet: planks n×1, rotated 45°. Returns (ink, tone).
vec2 ink_parquet(vec2 xz){
  float W = 0.075; float n = 5.0;
  vec2 r = vec2(xz.x + xz.y, xz.x - xz.y) * 0.70710678 / W;
  float k = floor(r.y);
  float s = mod(r.x - k, 2.0*n);
  vec2 local; vec2 id; float horiz;
  if (s < n) { local = vec2(s, fract(r.y)); id = vec2(floor((r.x - k)/(2.0*n)), k); horiz = 1.0; }
  else { float col = floor(r.x); float j = k + floor(s - n); local = vec2(r.y - (j + 1.0 - n), fract(r.x)); id = vec2(col, j + 99.0); horiz = 0.0; }
  float fw = fwidth(r.x) + fwidth(r.y);
  float edge = 1.0 - smoothstep(fw*0.4, fw*1.3, min(min(local.x, n - local.x), min(local.y, 1.0 - local.y)));
  float rnd = ink_hash(id);
  float g = local.y*7.0 + ink_fbm(vec2(local.x*0.7 + rnd*20.0, local.y*2.0))*2.5;
  float gw = fwidth(g);
  float gd = 0.5 - abs(fract(g) - 0.5);
  float grain =(1.0 - smoothstep(gw*0.3, gw*1.0, gd)) * 0.55 * step(0.35, ink_noise(vec2(local.x*3.0, floor(g)+rnd*9.0)));
  grain = mix(grain, 0.2, smoothstep(0.35, 0.8, gw));
  return vec2(max(edge*0.9, grain), rnd);
}`)
      .replace('#include <opaque_fragment>', `
  vec3 inkFn = normalize(cross(dFdx(vInkPos), dFdy(vInkPos)));
  vec3 an = abs(inkFn);
  vec2 hp = an.x > an.y && an.x > an.z ? vInkPos.zy : (an.y > an.z ? vInkPos.xz : vInkPos.xy);
  vec3 base = max(diffuseColor.rgb, vec3(0.03));
  vec3 irr = (outgoingLight - totalEmissiveRadiance) / base * PI; // undo Lambert's 1/π: 1.0 = fully lit
  float L = dot(irr, vec3(0.299, 0.587, 0.114)) + dot(totalEmissiveRadiance, vec3(0.33))*1.5;
  L += (ink_noise(hp*6.0 + uSeed) - 0.5) * 0.06;
  vec3 wash = mix(uPaper, base, uWash);
  float tone = 1.0;
  if (uWood > 1.5) {
    vec2 pq = ink_parquet(vInkPos.xz);
    tone = 0.9 + 0.18*pq.y;
    wash *= tone;
    wash = mix(wash, uInk, pq.x*0.75);
  } else if (uWood > 0.5) {
    vec3 g = uGrain;
    vec3 perp = vInkPos - g*dot(vInkPos, g);
    float along = dot(vInkPos, g) * uGrainScale;
    float pc = dot(perp, vec3(0.61, 1.0, 0.83)) * 60.0 * uGrainScale;
    float f = pc + ink_fbm(vec2(along*1.3, pc*0.05) + uSeed)*3.2 + sin(along*2.0 + pc*0.1)*0.6;
    float fw2 = fwidth(f);
    float gd = 0.5 - abs(fract(f) - 0.5);
    float grain = (1.0 - smoothstep(fw2*0.3, fw2*1.1, gd)) * step(0.28, ink_noise(vec2(along*6.0, floor(f)*1.3 + uSeed)));
    grain = mix(grain, 0.25, smoothstep(0.3, 0.8, fw2));
    wash = mix(wash, uInk, grain*0.55);
  }
  vec3 lit = wash * (0.62 + 0.42*clamp(irr, 0.0, 1.4)) + totalEmissiveRadiance*0.6;
  float sp = uSpacing;
  float ink = 0.0;
  ink = max(ink, ink_lines(hp, 0.785, sp*2.0, 0.0, uSeed)      * (1.0 - smoothstep(0.80, 0.92, L)));
  ink = max(ink, ink_lines(hp, 0.785, sp*2.0, 0.5, uSeed+1.0)  * (1.0 - smoothstep(0.62, 0.72, L)));
  ink = max(ink, ink_lines(hp, -0.785, sp*1.6, 0.0, uSeed+2.0) * (1.0 - smoothstep(0.46, 0.55, L)));
  ink = max(ink, ink_lines(hp, 0.15, sp*1.3, 0.0, uSeed+3.0)   * (1.0 - smoothstep(0.30, 0.38, L)));
  ink = max(ink, ink_lines(hp, 1.4, sp*1.1, 0.0, uSeed+4.0)    * (1.0 - smoothstep(0.15, 0.22, L)));
  lit *= mix(1.0, 0.8, 1.0 - smoothstep(0.05, 0.2, L));
  vec3 inkCol = mix(lit, uInk, ink*0.72);
  gl_FragColor = vec4(inkCol, diffuseColor.a);`);
    shaderCount++;
  };
  return mat;
}

/** Flat material for screens, LCDs and paper that show their own drawn texture. */
export function makeScreen(texture, o = {}) {
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: !!o.transparent, side: o.side ?? THREE.FrontSide });
}

export class InkPost {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rtColor = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.rtColor.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.rtColor.depthTexture.type = THREE.UnsignedIntType;
    this.rtNormal = new THREE.WebGLRenderTarget(size.x, size.y);
    this.normalMat = new THREE.MeshNormalMaterial();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rtColor.texture },
        tDepth: { value: this.rtColor.depthTexture },
        tNormal: { value: this.rtNormal.texture },
        uRes: { value: new THREE.Vector2(size.x, size.y) },
        uNear: { value: 0.05 }, uFar: { value: 80 },
        uInk: { value: INK },
        uScale: { value: renderer.getPixelRatio() },
        uTime: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tColor, tDepth, tNormal; uniform vec2 uRes; uniform float uNear, uFar, uScale, uTime; uniform vec3 uInk;
        ${NOISE_GLSL}
        float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear*uFar / (uFar - d*(uFar - uNear)); }
        vec3 nrm(vec2 uv){ return texture2D(tNormal, uv).xyz*2.0 - 1.0; }
        void main(){
          vec2 px = uScale / uRes;
          // wobble the sampling a little so outlines look hand-drawn, not CAD
          vec2 wob = (vec2(ink_noise(vUv*uRes/(38.0*uScale)), ink_noise(vUv*uRes/(38.0*uScale) + 7.3)) - 0.5) * 2.4 * px;
          vec2 uv = vUv + wob;
          float z = lin(uv); vec3 n = nrm(uv);
          float ez = 0.0, en = 0.0;
          vec2 offs[4]; offs[0] = vec2(1,0); offs[1] = vec2(-1,0); offs[2] = vec2(0,1); offs[3] = vec2(0,-1);
          for (int i = 0; i < 4; i++) {
            vec2 o = offs[i] * px * 1.1;
            float zi = lin(uv + o);
            ez = max(ez, abs(zi - z) / min(z, zi));
            en = max(en, 1.0 - dot(n, nrm(uv + o)));
          }
          // silhouettes (big depth jumps) get a heavier line by sampling further out
          float ez2 = 0.0;
          for (int i = 0; i < 4; i++) { float zi = lin(uv + offs[i]*px*2.0); ez2 = max(ez2, (zi - z) / z); }
          float edge = max(smoothstep(0.03, 0.07, ez), smoothstep(0.18, 0.4, en));
          edge = max(edge, smoothstep(0.08, 0.2, ez2) * 0.9);
          // tapered, broken strokes
          edge *= mix(0.55, 1.0, ink_noise(vUv*uRes/(9.0*uScale)));
          vec4 col = texture2D(tColor, vUv);
          vec3 c = mix(col.rgb, uInk, clamp(edge, 0.0, 1.0)*0.9);
          // paper grain + soft vignette
          float g = ink_noise(vUv*uRes/(1.6*uScale)) * 0.6 + ink_noise(vUv*uRes/(6.0*uScale)) * 0.4;
          c *= 0.955 + 0.06*g;
          vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q)*0.45;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
  }
  setSize(w, h) {
    this.rtColor.setSize(w, h); this.rtNormal.setSize(w, h);
    this.mat.uniforms.uRes.value.set(w, h);
    this.mat.uniforms.uScale.value = this.renderer.getPixelRatio();
  }
  render(scene, camera) {
    const r = this.renderer;
    this.mat.uniforms.uNear.value = camera.near; this.mat.uniforms.uFar.value = camera.far;
    r.setRenderTarget(this.rtColor);
    r.render(scene, camera);
    // normals: skip the window diorama (layer 1) and anything flagged noOutline
    const mask = camera.layers.mask;
    camera.layers.set(0);
    const bg = scene.background; scene.background = null;
    scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.rtNormal);
    r.setClearColor(0x8080ff, 1); r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null; scene.background = bg;
    camera.layers.mask = mask;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }
}
