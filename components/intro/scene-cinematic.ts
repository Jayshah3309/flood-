import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water2.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MonitoringBuoy, RainParticles, type SceneTelemetry } from './scene';

type FrameState = {
  elapsed: number;
  reducedMotion: boolean;
  exiting: boolean;
  telemetry?: SceneTelemetry;
};

function waterNormal(seed: number): THREE.DataTexture {
  const size = 128;
  const heights = new Float32Array(size * size);
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2;
    const v = y / size * Math.PI * 2;
    heights[y * size + x] =
      Math.sin(u * 9 + Math.sin(v * 3 + seed)) * .42 +
      Math.sin(v * 17 - u * 4 + seed * 2) * .2 +
      Math.sin(u * 29 + v * 21 + seed) * .07;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = heights[y * size + (x + size - 1) % size];
    const right = heights[y * size + (x + 1) % size];
    const up = heights[((y + size - 1) % size) * size + x];
    const down = heights[((y + 1) % size) * size + x];
    const normal = new THREE.Vector3((left - right) * .7, (up - down) * .7, 1).normalize();
    const i = (y * size + x) * 4;
    pixels[i] = Math.round((normal.x * .5 + .5) * 255);
    pixels[i + 1] = Math.round((normal.y * .5 + .5) * 255);
    pixels[i + 2] = Math.round((normal.z * .5 + .5) * 255);
    pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeOvercastSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: [
      'varying vec3 vDirection;',
      'void main() {',
      '  vDirection = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vDirection;',
      'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p), f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
      '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);',
      '}',
      'void main() {',
      '  vec3 d = normalize(vDirection);',
      '  vec2 uv = vec2(atan(d.z, d.x) * 1.3, d.y * 2.8);',
      '  float cloud = noise(uv * 2.0) * .6 + noise(uv * 4.3) * .28 + noise(uv * 8.0) * .12;',
      '  float horizon = smoothstep(.02, .55, d.y);',
      '  vec3 low = vec3(.004, .011, .023);',
      '  vec3 high = vec3(.05, .095, .125);',
      '  vec3 color = mix(low, high, horizon);',
      '  color += (cloud - .5) * vec3(.10, .13, .14) * horizon; ',
      '  gl_FragColor = vec4(color, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}',
    ].join('\n'),
  });
  return new THREE.Mesh(new THREE.SphereGeometry(195, 32, 20), material);
}

function makeBank(side: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= 80; i++) {
    const z = 35 - i * 3;
    const edge = side * (15 + Math.sin(i * .13) * 1.5 + Math.sin(i * .047) * 2.2);
    vertices.push(edge, -.13, z, edge + side * 7, .55 + Math.sin(i * .19) * .12, z, side * 180, 3, z);
    if (i < 80) for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: '#1a2528', roughness: 1, metalness: 0, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

function loadBuoyModel(root: THREE.Group, fallback: THREE.Group, isStopped: () => boolean) {
  const loader = new GLTFLoader();
  loader.load('/intro/telemetry-buoy.glb', (gltf) => {
    if (isStopped()) {
      gltf.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      });
      return;
    }
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;
    const scale = 2.5 / Math.max(size.x, size.z);
    model.scale.setScalar(scale);
    model.position.set(
      -(bounds.min.x + size.x / 2) * scale,
      -bounds.min.y * scale - .18,
      -(bounds.min.z + size.z / 2) * scale,
    );
    root.add(model);
    fallback.visible = false;
  }, undefined, () => { /* Procedural buoy remains visible until a GLB is supplied. */ });
}

export function createCinematicScene(
  host: HTMLDivElement,
  getState: () => FrameState,
  onFailure: () => void,
  onAnchor: (x: number, y: number, visible: boolean) => void,
) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    onFailure();
    return () => {};
  }
  let stopped = false;
  let hdrTexture: THREE.DataTexture | undefined;
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#0d1b2a');
  scene.background = fogColor;
  const sky = makeOvercastSky();
  scene.add(sky);
  scene.fog = new THREE.FogExp2(fogColor, .023);
  const compact = host.clientWidth < 900;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.2 : 1.65));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 250);
  const normal0 = waterNormal(1.3);
  const normal1 = waterNormal(4.7);
  const water = new Water(new THREE.PlaneGeometry(420, 420), {
    color: new THREE.Color('#91aeb7'),
    textureWidth: compact ? 256 : 512,
    textureHeight: compact ? 256 : 512,
    normalMap0: normal0,
    normalMap1: normal1,
    flowDirection: new THREE.Vector2(.16, -1).normalize(),
    flowSpeed: .035,
    reflectivity: .35,
    scale: 70,
  });
  const detailNormals: THREE.Texture[] = [];
  const textureLoader = new THREE.TextureLoader();
  const loadDetailNormal = (path: string, uniform: 'tNormalMap0' | 'tNormalMap1') => {
    textureLoader.load(path, (texture) => {
      if (stopped) { texture.dispose(); return; }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      water.material.uniforms[uniform].value = texture;
      detailNormals.push(texture);
    }, undefined, () => { /* Generated tileable normals remain in use. */ });
  };
  loadDetailNormal('/intro/water-normal-1.jpg', 'tNormalMap0');
  loadDetailNormal('/intro/water-normal-2.jpg', 'tNormalMap1');
  water.rotation.x = -Math.PI / 2;
  water.position.z = -80;
  scene.add(water, makeBank(-1), makeBank(1));
  scene.add(new THREE.HemisphereLight('#b8c8cc', '#172422', 1.7));
  const key = new THREE.DirectionalLight('#dae3e3', 2.2);
  key.position.set(-12, 18, -20);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6aa5b4', .85);
  rim.position.set(8, 7, 12);
  scene.add(rim);
  const procedural = MonitoringBuoy();
  const buoy = new THREE.Group();
  buoy.position.set(2.5, 0, 2);
  buoy.rotation.y = -.28;
  buoy.scale.setScalar(1.25);
  buoy.add(procedural.group);
  scene.add(buoy);
  loadBuoyModel(buoy, procedural.group, () => stopped);
  const rain = RainParticles(scene, compact);
  const rings = new THREE.Group();
  rings.position.set(2.5, .02, 2);
  scene.add(rings);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 1.52, compact ? 48 : 96),
      new THREE.MeshBasicMaterial({ color: '#8faeb4', transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = i * .006;
    rings.add(ring);
  }
  const resizeScene = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const resize = new ResizeObserver(resizeScene);
  resize.observe(host);
  resizeScene();
  // Supply an equirectangular, overcast HDRI at this URL. It illuminates the
  // PBR buoy and is reflected by Water2's planar reflector.
  new HDRLoader().load('/intro/overcast-river.hdr', (texture) => {
    if (stopped) { texture.dispose(); return; }
    texture.mapping = THREE.EquirectangularReflectionMapping;
    hdrTexture = texture;
    scene.environment = texture;
    scene.background = texture;
    sky.visible = false;
    scene.backgroundIntensity = .28;
    scene.environmentIntensity = .8;
  }, undefined, () => { /* Solid sky/fog remains the fallback. */ });
  let previous = 0;
  const anchorPoint = new THREE.Vector3();
  const draw = (now: number) => {
    if (stopped || now - previous < (compact ? 1000 / 30 : 1000 / 45)) return;
    previous = now;
    const state = getState();
    const time = state.reducedMotion ? 18 : state.elapsed / 1000;
    const reveal = state.reducedMotion ? 1 : THREE.MathUtils.smoothstep(time, 1, 12);
    const narrow = camera.aspect < .8;
    camera.position.set(narrow ? 9 : 10.5 - reveal * .5, 6.9 - reveal * 1.8, (narrow ? 20 : 17) - reveal * 2 - (state.exiting ? .65 : 0));
    camera.lookAt(narrow ? 1 : -3.6, narrow ? 1 : .7, -5);
    camera.updateMatrixWorld();
    const waterHeight = Number.isFinite(state.telemetry?.waterHeight)
      ? THREE.MathUtils.clamp(state.telemetry!.waterHeight!, -1, 3) : 0;
    water.position.y = waterHeight;
    const buoyReveal = state.reducedMotion ? 1 : THREE.MathUtils.smoothstep(time, 10, 17);
    buoy.visible = buoyReveal > 0;
    buoy.position.y = waterHeight + Math.sin(time * 1.35) * .055 + Math.sin(time * .72 + .4) * .02 - (1 - buoyReveal) * 3;
    buoy.rotation.x = Math.sin(time * .8) * .018;
    buoy.rotation.z = Math.cos(time * .95) * .023;
    const risk = state.telemetry?.riskState;
    procedural.lamp.emissive.set(risk === 'critical' ? '#c44f4f' : risk === 'warning' ? '#c29442' : '#477d80');
    procedural.lamp.emissiveIntensity = state.telemetry?.buoyStatus === 'offline' ? 0 : .55;
    rings.position.y = waterHeight + .025;
    rings.visible = buoyReveal > .8;
    rings.children.forEach((object, i) => {
      const phase = (time * .19 + i / 3) % 1;
      object.scale.setScalar(1 + phase * 1.8);
      (object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = (1 - phase) * .16;
    });
    const intensity = state.telemetry?.rainfallIntensity;
    rain.update(time, Number.isFinite(intensity) ? THREE.MathUtils.clamp(intensity!, 0, 1) : .45);
    buoy.updateMatrixWorld();
    anchorPoint.set(0, 1.6, 0);
    buoy.localToWorld(anchorPoint);
    anchorPoint.project(camera);
    onAnchor((anchorPoint.x * .5 + .5) * host.clientWidth, (-anchorPoint.y * .5 + .5) * host.clientHeight,
      buoy.visible && anchorPoint.z > -1 && anchorPoint.z < 1);
    try { renderer.render(scene, camera); } catch { dispose(); onFailure(); }
  };
  const visibility = () => renderer.setAnimationLoop(document.hidden || stopped ? null : draw);
  const contextLost = (event: Event) => { event.preventDefault(); dispose(); onFailure(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', visibility);
  visibility();
  const dispose = () => {
    if (stopped) return;
    stopped = true;
    renderer.setAnimationLoop(null);
    resize.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    normal0.dispose();
    normal1.dispose();
    detailNormals.forEach((texture) => texture.dispose());
    hdrTexture?.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
  return dispose;
}

