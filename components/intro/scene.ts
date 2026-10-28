import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Optional future adapter: only pass validated, fresh hardware telemetry here.
 * Defaults below describe an illustrative environment, NOT measured readings.
 * Keep risk calculation in FastAPI; supply its risk state without recalculating it.
 */
export type SceneTelemetry = {
  waterHeight?: number; // Map measured metres to the scene's local water datum.
  rainfallIntensity?: number; // Normalized 0..1 from a validated rainfall reading.
  buoyStatus?: 'unknown' | 'online' | 'offline';
  riskState?: 'normal' | 'warning' | 'critical';
};
type FrameState = { elapsed: number; reducedMotion: boolean; exiting: boolean; telemetry?: SceneTelemetry };
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const material = (color: string, metalness = 0, roughness = .8) => new THREE.MeshStandardMaterial({ color, metalness, roughness });

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material, x: number, y: number, z: number) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function surfaceDetail() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 31817;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = (random() - .5) * .12;
    const nx = grain + Math.sin(x * .23 + y * .11) * .014;
    const ny = (random() - .5) * .1;
    const i = (y * size + x) * 4;
    pixels[i] = Math.round(128 + nx * 80);
    pixels[i + 1] = Math.round(128 + ny * 80);
    pixels[i + 2] = 255;
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

export function MonitoringBuoy() {
  const group = new THREE.Group();
  const normalMap = surfaceDetail();
  const hull = new THREE.MeshPhysicalMaterial({ color: '#928c69', metalness: .08, roughness: .64, clearcoat: .08, clearcoatRoughness: .72, normalMap, normalScale: new THREE.Vector2(.11, .11) });
  const wetHull = new THREE.MeshPhysicalMaterial({ color: '#626d65', metalness: .06, roughness: .27, clearcoat: .32, clearcoatRoughness: .25, normalMap, normalScale: new THREE.Vector2(.08, .08) });
  const white = new THREE.MeshPhysicalMaterial({ color: '#bfc7be', metalness: 0, roughness: .54, clearcoat: .09, clearcoatRoughness: .6, normalMap, normalScale: new THREE.Vector2(.08, .08) });
  const steel = new THREE.MeshStandardMaterial({ color: '#727e7c', metalness: .72, roughness: .4, normalMap, normalScale: new THREE.Vector2(.05, .05) });
  const dark = new THREE.MeshStandardMaterial({ color: '#242d2c', metalness: .03, roughness: .86, normalMap, normalScale: new THREE.Vector2(.06, .06) });
  const solar = new THREE.MeshPhysicalMaterial({ color: '#253c43', metalness: .18, roughness: .4, clearcoat: .14, clearcoatRoughness: .5 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#5c7272', metalness: .2, roughness: .46, emissive: '#324342', emissiveIntensity: 0 });
  // Molded flotation body with a wet lower band, rub rail, and bolted deck.
  mesh(group, new THREE.LatheGeometry([
    new THREE.Vector2(0, -.11), new THREE.Vector2(.98, -.11),
    new THREE.Vector2(1.13, -.055), new THREE.Vector2(1.22, .04),
    new THREE.Vector2(1.24, .14), new THREE.Vector2(1.18, .235),
    new THREE.Vector2(1.05, .285), new THREE.Vector2(0, .285),
  ], 64), hull, 0, 0, 0);
  mesh(group, new THREE.CylinderGeometry(1.19, 1.13, .125, 64), wetHull, 0, -.015, 0);
  mesh(group, new THREE.TorusGeometry(1.195, .052, 12, 64), dark, 0, .06, 0).rotation.x = Math.PI / 2;
  mesh(group, new THREE.CylinderGeometry(.98, 1.12, .16, 64), white, 0, .34, 0);
  mesh(group, new THREE.TorusGeometry(.96, .018, 8, 64), dark, 0, .425, 0).rotation.x = Math.PI / 2;
  mesh(group, new THREE.CylinderGeometry(.78, .85, .105, 48), dark, 0, .49, 0);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    mesh(group, new THREE.CylinderGeometry(.027, .027, .012, 12), steel, Math.cos(a) * .89, .435, Math.sin(a) * .89);
  }
  // Weather-sealed electronics enclosure, lid gasket, screws, and cable glands.
  mesh(group, new RoundedBoxGeometry(.78, .55, .6, 3, .045), white, 0, .8, 0);
  mesh(group, new RoundedBoxGeometry(.83, .024, .65, 2, .008), dark, 0, 1.075, 0);
  mesh(group, new RoundedBoxGeometry(.86, .062, .68, 3, .018), white, 0, 1.113, 0);
  for (const x of [-.31, .31]) for (const z of [-.23, .23]) {
    mesh(group, new THREE.CylinderGeometry(.025, .025, .009, 12), steel, x, 1.15, z);
    mesh(group, new THREE.BoxGeometry(.019, .004, .004), dark, x, 1.156, z);
  }
  mesh(group, new RoundedBoxGeometry(.35, .105, .017, 2, .012), dark, 0, .85, .308);
  for (let i = 0; i < 3; i++) mesh(group, new THREE.SphereGeometry(.018, 10, 8), i === 0 ? lamp : steel, -.075 + i * .075, .85, .32);
  for (const x of [-.19, .19]) {
    const gland = mesh(group, new THREE.CylinderGeometry(.058, .058, .09, 16), dark, x, .66, -.34);
    gland.rotation.x = Math.PI / 2;
  }
  // Original mast, GPS puck, sensor crossarm, and paired transducers.
  mesh(group, new THREE.CylinderGeometry(.052, .065, 2.05, 16), steel, -.18, 1.51, -.08);
  mesh(group, new THREE.CylinderGeometry(.085, .085, .16, 16), dark, -.18, .6, -.08);
  mesh(group, new THREE.CylinderGeometry(.17, .17, .025, 32), dark, -.18, 2.53, -.08);
  mesh(group, new THREE.CylinderGeometry(.15, .16, .105, 32), white, -.18, 2.59, -.08);
  const arm = mesh(group, new THREE.CylinderGeometry(.042, .042, 1.3, 12), steel, .34, 2.16, -.08);
  arm.rotation.z = Math.PI / 2;
  mesh(group, new RoundedBoxGeometry(.3, .15, .24, 2, .025), dark, .88, 2.06, -.08);
  for (const x of [.81, .96]) {
    mesh(group, new THREE.CylinderGeometry(.053, .053, .09, 16), steel, x, 1.97, -.08);
    mesh(group, new THREE.CylinderGeometry(.04, .04, .018, 16), dark, x, 1.92, -.08);
  }
  mesh(group, new THREE.CylinderGeometry(.025, .038, .83, 12), dark, -.53, 1.48, .03);
  mesh(group, new THREE.SphereGeometry(.037, 12, 8), dark, -.53, 1.92, .03);
  // Framed solar panel with restrained cell lines and a mounting bracket.
  const panel = new THREE.Group(); panel.position.set(.28, 1.18, -.44); panel.rotation.x = -.28;
  group.add(panel);
  mesh(panel, new RoundedBoxGeometry(.82, .048, .67, 2, .012), steel, 0, 0, 0);
  mesh(panel, new THREE.BoxGeometry(.75, .008, .6), solar, 0, .03, 0);
  for (let i = -2; i <= 2; i++) mesh(panel, new THREE.BoxGeometry(.006, .003, .59), steel, i * .13, .036, 0);
  mesh(panel, new THREE.BoxGeometry(.74, .003, .006), steel, 0, .036, 0);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + .4;
    mesh(group, new THREE.TorusGeometry(.067, .016, 8, 16), steel, Math.cos(angle), .4, Math.sin(angle)).rotation.y = -angle;
  }
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(-.14, 2.1, -.09), new THREE.Vector3(-.1, 1.4, .08), new THREE.Vector3(.2, 1.12, .15)]);
  mesh(group, new THREE.TubeGeometry(cable, 16, .016, 6, false), dark, 0, 0, 0);
  group.userData.detailTexture = normalMap;
  return { group, lamp };
}

export function RiverScene(scene: THREE.Scene, compact: boolean) {
  const waterGeometry = new THREE.PlaneGeometry(220, 220, compact ? 48 : 100, compact ? 48 : 100);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLight: { value: new THREE.Vector3(-.3, .8, -.6).normalize() }, uFog: { value: new THREE.Color('#536e7b') } },
    vertexShader: `uniform float uTime; varying vec3 vWorld; varying float vDistance;
      void main() {
        vec3 p = position;
        p.y += sin(p.x * 1.2 + p.z * .65 + uTime * .85) * .025 + sin(p.z * 2.6 - uTime * 1.1) * .018;
        vec4 world = modelMatrix * vec4(p, 1.0); vWorld = world.xyz;
        vec4 view = viewMatrix * world; vDistance = -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uLight; uniform vec3 uFog;
      varying vec3 vWorld; varying float vDistance;
      void main() {
        vec2 p = vWorld.xz;
        float dx = cos(p.x * 1.2 + p.y * .65 + uTime * .85) * .1;
        float dz = cos(p.y * 2.6 - uTime * 1.1) * .13;
        dx += sin(p.y * 17.0 + p.x * 8.0 + uTime * 1.4) * .035;
        dz += sin(p.y * 26.0 - p.x * 3.0 - uTime * 2.0) * .045;
        vec3 n = normalize(vec3(dx, 1.0, dz));
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - max(dot(view, n), 0.0), 3.0);
        float spec = pow(max(dot(n, normalize(view + uLight)), 0.0), 100.0);
        vec3 col = mix(vec3(.025,.085,.11), vec3(.27,.40,.46), fresnel * .8);
        col += vec3(.55,.69,.72) * spec * .48;
        float streak = pow(.5 + .5 * sin(p.y * 13.0 + sin(p.x * 4.0 + uTime) + uTime * .8), 18.0);
        col += streak * .021;
        float glow = exp(-length((p - vec2(2.5, 2.0)) * vec2(.9,.3))) * .035;
        col += vec3(.2,.6,.65) * glow;
        col = mix(col, uFog, 1.0 - exp(-vDistance * vDistance * .00019));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = mesh(scene, waterGeometry, waterMaterial, 0, 0, -40);
  const soil = material('#303e35');
  const rock = material('#56615a');
  const trunk = material('#3c3931');
  const leaves = material('#253e36');
  // Organic shore contours keep an open river corridor toward the distant bridge.
  for (const side of [-1, 1]) {
    const vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 60; i++) {
      const z = 22 - i * 2.5;
      const edge = side * (13 + Math.sin(i * .12) * 3.2);
      vertices.push(edge, -.11, z, edge + side * 3, 1.1 + Math.sin(i) * .1, z, side * 85, 1.9, z);
      if (i < 60) for (let j = 0; j < 2; j++) { const a = i * 3 + j; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
    }
    const land = new THREE.BufferGeometry(); land.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); land.setIndex(indices); land.computeVertexNormals();
    const landMaterial = soil.clone(); landMaterial.side = THREE.DoubleSide;
    mesh(scene, land, landMaterial, 0, 0, 0);
  }
  let seed = 913;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const count = compact ? 90 : 220;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .21, 1, 5), trunk, count);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leaves, count * 3);
  const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), rock, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? -1 : 1;
    const z = 12 - random() * 138;
    const edge = 13 + Math.sin((22 - z) / 2.5 * .12) * 3.2;
    const x = side * (edge + 3 + random() * 22);
    const height = 3 + random() * 4;
    dummy.position.set(x, 1 + height * .4, z); dummy.scale.set(1, height, 1); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 3; j++) {
      dummy.position.set(x + (random() - .5) * 1.6, 1.5 + height * .7 + j * .65, z + (random() - .5) * 1.4);
      dummy.scale.set(height * .36, height * .31, height * .33); dummy.rotation.y = random() * 6; dummy.updateMatrix(); crowns.setMatrixAt(i * 3 + j, dummy.matrix);
      crowns.setColorAt(i * 3 + j, new THREE.Color().setHSL(.36 + random() * .035, .16, .15 + random() * .12));
    }
    dummy.position.set(side * (edge + random() * 1.6), .05, z); dummy.scale.set(.5 + random(), .25 + random() * .5, .5 + random()); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
  }
  scene.add(trunks, crowns, stones);
  const building = material('#a6aaa0'); const roof = material('#435159');
  const windowMaterial = new THREE.MeshStandardMaterial({ color: '#cfb880', emissive: '#b99a5d', emissiveIntensity: .5 });
  for (let i = 0; i < (compact ? 3 : 7); i++) {
    const house = new THREE.Group(); const x = (i % 2 ? -1 : 1) * (18 + i % 3 * 3); const z = -22 - i * 7;
    mesh(house, new THREE.BoxGeometry(3, 2.8, 3.6), building, 0, 2.2, 0);
    const top = mesh(house, new THREE.CylinderGeometry(0, 2.7, 1.6, 4), roof, 0, 4.35, 0); top.rotation.y = Math.PI / 4; top.scale.z = 1.2;
    for (const wx of [-.8, .8]) mesh(house, new THREE.BoxGeometry(.5, .65, .035), windowMaterial, wx, 2.5, 1.82);
    house.position.set(x, 0, z); scene.add(house);
  }
  // Road bridge with piers, deck, rails and softly silhouetted arch structure.
  const concrete = material('#717e7c'); const bridge = new THREE.Group(); bridge.position.z = -68;
  mesh(bridge, new THREE.BoxGeometry(49, .65, 3.7), concrete, 0, 4, 0);
  for (const x of [-18, -6, 6, 18]) mesh(bridge, new THREE.BoxGeometry(.8, 4.1, 2.6), concrete, x, 1.9, 0);
  for (const z of [-1.7, 1.7]) {
    mesh(bridge, new THREE.BoxGeometry(49, .12, .12), concrete, 0, 5.1, z);
    for (let x = -24; x <= 24; x += 2) mesh(bridge, new THREE.BoxGeometry(.08, 1, .08), concrete, x, 4.6, z);
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => new THREE.Vector3(-24 + i * 3, 4.3 + Math.sin(i / 16 * Math.PI) * 4, z)));
    mesh(bridge, new THREE.TubeGeometry(curve, 32, .17, 6, false), concrete, 0, 0, 0);
  }
  scene.add(bridge);
  return { water, waterMaterial };
}

export function RainParticles(scene: THREE.Scene, compact: boolean) {
  const count = compact ? 100 : 360;
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const x = Math.sin(i * 74.3) * 24, y = (i * .713) % 16, z = Math.cos(i * 41.7) * 30;
    positions.set([x, y, z, x - .04, y + .24, z], i * 6);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const surface = new THREE.LineBasicMaterial({ color: '#b5d7dc', transparent: true, opacity: .13, depthWrite: false });
  const rain = new THREE.LineSegments(geometry, surface); rain.frustumCulled = false; scene.add(rain);
  return { update(time: number, intensity: number) {
    surface.opacity = .13 * intensity;
    for (let i = 0; i < count; i++) { const y = 16 - ((i * .713 + time * 8) % 16); positions[i * 6 + 1] = y; positions[i * 6 + 4] = y + .24; }
    geometry.attributes.position.needsUpdate = true;
  } };
}

export function createFloodScene(host: HTMLDivElement, getState: () => FrameState, onFailure: () => void) {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch { onFailure(); return () => {}; }
  const scene = new THREE.Scene();
  const compact = host.clientWidth < 900;
  scene.background = new THREE.Color('#536e7b'); scene.fog = new THREE.FogExp2('#536e7b', .014);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Animated river with an IoT monitoring buoy');
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 230);
  let resize: ResizeObserver | undefined;
  let stopped = false;
  const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
  const dispose = () => {
    if (stopped) return; stopped = true;
    renderer.setAnimationLoop(null); resize?.disconnect(); document.removeEventListener('visibilitychange', visibility);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    scene.traverse((object) => {
      const item = object as THREE.Mesh;
      if (item.geometry) geometries.add(item.geometry);
      if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach((m) => materials.add(m));
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose());
    renderer.dispose(); renderer.domElement.remove();
  };
  const contextLost = (event: Event) => { event.preventDefault(); dispose(); onFailure(); };
  let draw: (now: number) => void = () => {};
  function visibility() { if (!stopped) renderer.setAnimationLoop(document.hidden ? null : draw); }
  try {
    scene.add(new THREE.HemisphereLight('#d4e6f0', '#263b35', 2.4));
    const light = new THREE.DirectionalLight('#e6e8dd', 3.1); light.position.set(-12, 22, -14); scene.add(light);
    const fill = new THREE.DirectionalLight('#91cbd5', 1.7); fill.position.set(10, 7, 12); scene.add(fill);
    const { water, waterMaterial } = RiverScene(scene, compact);
    const buoy = MonitoringBuoy(); buoy.group.position.set(2.5, 0, 2); buoy.group.rotation.y = -.28; scene.add(buoy.group);
    const rain = RainParticles(scene, compact);
    const rings = new THREE.Group(); rings.position.set(2.5, .03, 2); scene.add(rings);
    for (let i = 0; i < 3; i++) {
      const ring = mesh(rings, new THREE.RingGeometry(1.5, 1.514, compact ? 48 : 96), new THREE.MeshBasicMaterial({ color: '#94c7c9', transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false }), 0, i * .008, 0); ring.rotation.x = -Math.PI / 2;
    }
    const resizeScene = () => { const width = host.clientWidth, height = host.clientHeight; camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); renderer.setSize(width, height); };
    resize = new ResizeObserver(resizeScene); resize.observe(host); resizeScene();
    let previous = 0;
    draw = (now: number) => {
      if (stopped || now - previous < (compact ? 1000 / 30 : 1000 / 45)) return;
      previous = now;
      const state = getState(); const time = state.reducedMotion ? 18 : state.elapsed / 1000;
      const reveal = state.reducedMotion ? 1 : smooth(1, 12, time);
      const narrow = camera.aspect < .8;
      camera.position.set(narrow ? 9 : 10.5 - reveal * .5, 6.9 - reveal * 1.8, (narrow ? 20 : 17) - reveal * 2 - (state.exiting ? .65 : 0));
      camera.lookAt(narrow ? 1 : -3.6, narrow ? 1 : .7, -5);
      waterMaterial.uniforms.uTime.value = time;
      // Future real water data affects water plane AND buoy/ripple datum together.
      const waterHeight = Number.isFinite(state.telemetry?.waterHeight) ? THREE.MathUtils.clamp(state.telemetry!.waterHeight!, -1, 3) : 0;
      water.position.y = waterHeight;
      const buoyReveal = state.reducedMotion ? 1 : smooth(10, 17, time);
      buoy.group.visible = buoyReveal > 0;
      buoy.group.position.y = waterHeight + Math.sin(time * 1.35) * .045 - (1 - buoyReveal) * 3;
      buoy.group.rotation.z = Math.sin(time * .8) * .016; buoy.group.rotation.x = Math.cos(time * .9) * .012;
      // Warning / critical states use backend riskState; never infer risk from rain art.
      const risk = state.telemetry?.riskState;
      buoy.lamp.emissive.set(risk === 'critical' ? '#c44f4f' : risk === 'warning' ? '#c29442' : '#477d80');
      buoy.lamp.emissiveIntensity = state.telemetry?.buoyStatus === 'offline' ? 0 : .55;
      rings.position.y = waterHeight + .035;
      rings.visible = buoyReveal > .8;
      rings.children.forEach((object, i) => { const phase = (time * .19 + i / 3) % 1; object.scale.setScalar(1 + phase * 1.8); ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - phase) * .23; });
      const intensity = state.telemetry?.rainfallIntensity;
      rain.update(time, Number.isFinite(intensity) ? THREE.MathUtils.clamp(intensity!, 0, 1) : .6);
      try { renderer.render(scene, camera); } catch { dispose(); onFailure(); }
      // One frame is sufficient for reduced motion, until resize / preference changes.
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibility);
    visibility();
  } catch { dispose(); onFailure(); }
  return dispose;
}
