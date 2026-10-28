import * as THREE from 'three';
import { MonitoringBuoy } from './scene';

// Normalized coordinates of the existing river photograph, from top left.
const WATER_ANCHOR = new THREE.Vector2(.51, .625);

const fragmentShader = /* glsl */`
  uniform sampler2D uPhoto;
  uniform float uTime;
  uniform vec2 uCover;
  uniform vec2 uAnchor;
  varying vec2 vUv;

  vec2 river(vec2 p) {
    float y = p.y;
    if (y < .39) return vec2(.53, .002);
    if (y < .45) return mix(vec2(.53,.002), vec2(.525,.037), (y-.39)/.06);
    if (y < .52) return mix(vec2(.525,.037), vec2(.525,.066), (y-.45)/.07);
    if (y < .62) return mix(vec2(.525,.066), vec2(.51,.085), (y-.52)/.10);
    if (y < .72) return mix(vec2(.51,.085), vec2(.455,.125), (y-.62)/.10);
    if (y < .82) return mix(vec2(.455,.125), vec2(.375,.16), (y-.72)/.10);
    if (y < .92) return mix(vec2(.375,.16), vec2(.275,.19), (y-.82)/.10);
    return mix(vec2(.275,.19), vec2(.19,.23), clamp((y-.92)/.08, 0., 1.));
  }

  void main() {
    vec2 p = (vec2(vUv.x, 1. - vUv.y) - .5) * uCover + .5;
    vec2 channel = river(p);
    float bank = channel.y - abs(p.x - channel.x);
    float mask = smoothstep(-.006, .009, bank) * smoothstep(.387, .407, p.y);
    if (mask <= .001) discard;

    // Animated distortion and highlights move downstream inside the river mask.
    float phase = p.y * 390. - uTime * 2.25 + p.x * 39. + sin(p.x * 61.) * 1.3;
    float crossWave = sin(phase) * .5 + sin(phase * .51 + p.x * 96.) * .3;
    float curl = sin(p.y * 96. - uTime * 1.1 + p.x * 75.);
    vec2 displacement = vec2(crossWave * .0017 + curl * .0006, sin(phase * .73) * .0008);
    vec2 samplePoint = clamp(p + displacement, vec2(.001), vec2(.999));
    vec3 color = texture2D(uPhoto, vec2(samplePoint.x, 1. - samplePoint.y)).rgb;
    float glint = pow(max(0., sin(phase + curl * .9)), 13.);
    float broad = pow(max(0., sin(p.y * 165. - uTime * 1.35 + p.x * 53.)), 18.);
    color += vec3(.047, .052, .047) * glint + vec3(.022, .026, .024) * broad;

    // Local contact shadow and expanding wake around the device.
    vec2 d = (p - uAnchor) * vec2(1., 2.15);
    float radius = length(d);
    color *= 1. - exp(-pow(radius / .033, 2.)) * .28;
    float ripple = 0.;
    for (int i = 0; i < 3; i++) {
      float r = .028 + mod(uTime * .007 + float(i) * .016, .05);
      ripple += exp(-pow((radius - r) / .0015, 2.)) * (1. - r / .09);
    }
    color += vec3(.034, .043, .043) * ripple;
    gl_FragColor = vec4(color, mask);
    #include <colorspace_fragment>
  }
`;

const contactShader = /* glsl */`
  uniform sampler2D uPhoto;
  uniform float uTime;
  uniform vec2 uCover;
  uniform vec2 uAnchor;
  varying vec2 vUv;
  void main() {
    vec2 p = (vec2(vUv.x, 1. - vUv.y) - .5) * uCover + .5;
    vec2 d = (p - uAnchor) * vec2(1., 2.15);
    float footprint = 1. - smoothstep(.029, .043, length(d));
    float band = smoothstep(uAnchor.y - .014, uAnchor.y - .004, p.y)
      * (1. - smoothstep(uAnchor.y + .004, uAnchor.y + .014, p.y));
    float alpha = footprint * band * .9;
    if (alpha < .001) discard;
    vec2 flow = vec2(sin(p.y * 390. - uTime * 2.25) * .0011, 0.);
    vec3 water = texture2D(uPhoto, vec2(p.x + flow.x, 1. - p.y)).rgb;
    water += vec3(.013, .018, .017) * sin(p.x * 310. - uTime * 1.5);
    gl_FragColor = vec4(water, alpha);
    #include <colorspace_fragment>
  }
`;

export function createPhotographicScene(host: HTMLDivElement) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch { return () => {}; }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.domElement.className = 'intro-motion-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const waterScene = new THREE.Scene();
  const waterCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  waterCamera.position.z = 1;
  const uniforms = {
    uPhoto: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uCover: { value: new THREE.Vector2(1, 1) },
    uAnchor: { value: WATER_ANCHOR },
  };
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
    fragmentShader,
  });
  const waterGeometry = new THREE.PlaneGeometry(2, 2);
  waterScene.add(new THREE.Mesh(waterGeometry, waterMaterial));
  const contactScene = new THREE.Scene();
  const contactMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
    fragmentShader: contactShader,
  });
  contactScene.add(new THREE.Mesh(waterGeometry, contactMaterial));

  const deviceScene = new THREE.Scene();
  deviceScene.add(new THREE.HemisphereLight('#cad4d1', '#334a3d', 1.55));
  const sun = new THREE.DirectionalLight('#f2dfbd', 1.55);
  sun.position.set(-4, 8, 5);
  deviceScene.add(sun);
  const fill = new THREE.DirectionalLight('#8ea8a8', .48);
  fill.position.set(5, 4, -3);
  deviceScene.add(fill);
  const buoy = MonitoringBuoy();
  buoy.group.rotation.y = -.48;
  deviceScene.add(buoy.group);
  const deviceCamera = new THREE.PerspectiveCamera(30, 1, .1, 40);
  deviceCamera.position.set(4.2, 4.6, 8.5);
  deviceCamera.lookAt(0, 1.25, 0);

  const loader = new THREE.TextureLoader();
  let texture: THREE.Texture | undefined;
  let disposed = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let compact = false;
  let coverX = 1;
  let coverY = 1;
  let last = 0;
  const clockStart = performance.now();

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    compact = width <= 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.75));
    renderer.setSize(width, height, false);
    const viewportAspect = width / height;
    const imageAspect = 1672 / 941;
    coverX = Math.min(1, viewportAspect / imageAspect);
    coverY = Math.min(1, imageAspect / viewportAspect);
    uniforms.uCover.value.set(coverX, coverY);
  }

  function render(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (document.hidden || (compact && now - last < 1000 / 30)) return;
    last = now;
    const t = reduced.matches ? 0 : (now - clockStart) / 1000;
    uniforms.uTime.value = t;
    renderer.clear();
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    if (texture) renderer.render(waterScene, waterCamera);

    // A viewport within the transparent canvas places the existing device on
    // the photographed river, independent of object-fit cropping.
    const photoX = compact ? .525 : WATER_ANCHOR.x;
    const photoY = compact ? .69 : WATER_ANCHOR.y;
    const anchorX = ((photoX - .5) / coverX + .5) * width;
    const anchorY = ((photoY - .5) / coverY + .5) * height;
    uniforms.uAnchor.value.set(photoX, photoY);
    const deviceHeight = Math.min(compact ? 158 : 220, height * (compact ? .20 : .29));
    const deviceWidth = deviceHeight * .9;
    const left = Math.round(anchorX - deviceWidth * .5);
    // Lower the hull through the waterline; scissor hides the submerged portion.
    const bottom = Math.round(height - anchorY - deviceHeight * .24);
    buoy.group.position.set(
      reduced.matches ? 0 : Math.sin(t * .29) * .035,
      reduced.matches ? -.18 : -.18 + Math.sin(t * 1.24) * .047,
      0,
    );
    buoy.group.rotation.x = reduced.matches ? 0 : Math.sin(t * .83) * .015;
    buoy.group.rotation.z = reduced.matches ? 0 : Math.sin(t * .68 + .7) * .02;
    deviceCamera.aspect = deviceWidth / deviceHeight;
    deviceCamera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setViewport(left, bottom, deviceWidth, deviceHeight);
    renderer.setScissor(left, Math.round(height - anchorY), deviceWidth, deviceHeight);
    renderer.render(deviceScene, deviceCamera);
    renderer.setScissorTest(false);
    renderer.clearDepth();
    renderer.setViewport(0, 0, width, height);
    if (texture) renderer.render(contactScene, waterCamera);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  loader.load(window.innerWidth <= 700 ? '/intro/river-valley-hero-mobile.webp' : '/intro/river-valley-hero.webp', loaded => {
    if (disposed) { loaded.dispose(); return; }
    texture = loaded;
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.minFilter = THREE.LinearFilter;
    loaded.magFilter = THREE.LinearFilter;
    uniforms.uPhoto.value = loaded;
  });
  frame = requestAnimationFrame(render);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    texture?.dispose();
    waterGeometry.dispose();
    waterMaterial.dispose();
    contactMaterial.dispose();
    buoy.group.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
    });
    (buoy.group.userData.detailTexture as THREE.Texture | undefined)?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
