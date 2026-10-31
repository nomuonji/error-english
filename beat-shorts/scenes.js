// Background scenes. Each one: make(THREE, scene, camera, rnd) -> update({ t, kick, down, rms, bands, color, color2 })
// Shared rules: stay behind the text column (centre ~y 2), pulse on the beat, take the
// palette colours every frame, deterministic for a given t.

const C = (THREE, hex) => new THREE.Color(hex);

function ring(THREE, scene, nbands, radius, y) {
  const n = nbands * 2;
  const geo = new THREE.BoxGeometry(0.16, 1, 0.16); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  mesh.position.y = y; scene.add(mesh);
  const d = new THREE.Object3D();
  return ({ t, bands, rms, color }) => {
    for (let i = 0; i < n; i++) {
      const b = bands[i < nbands ? i : n - 1 - i], a = i / n * Math.PI * 2;
      d.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      d.rotation.set(0, 0, a - Math.PI / 2);
      d.scale.set(1, 0.2 + b * b * 3.2 * (0.4 + rms * 0.9), 1);
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, color.clone().lerp(C(THREE, 0xffffff), b * 0.6));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    mesh.rotation.z = t * 0.2;
  };
}

function stars(THREE, scene, rnd, n = 2200) {
  const pos = new Float32Array(n * 3), seeds = [];
  for (let i = 0; i < n; i++) seeds.push([rnd() * 2 - 1, rnd() * 2 - 1, rnd()]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(geo, mat));
  return ({ travel, kick }) => {
    for (let i = 0; i < n; i++) {
      const s = seeds[i];
      pos[i * 3] = s[0] * 40; pos[i * 3 + 1] = s[1] * 60; pos[i * 3 + 2] = ((s[2] * 160 + travel * 1.5) % 160) - 140;
    }
    geo.attributes.position.needsUpdate = true; mat.size = 0.1 + kick * 0.12;
  };
}

// 1. crystal core + hex tunnel + spectrum ring (the original look)
export function core(THREE, scene, camera, rnd) {
  const g = new THREE.Group(); g.position.y = 2.2; scene.add(g);
  const wm = new THREE.LineBasicMaterial({ transparent: true });
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(4.2, 1)), wm);
  const im = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.08 });
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(3.0, 0), im);
  const iw = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.0, 0)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  g.add(wire, inner, iw);
  const tunnel = [];
  for (let i = 0; i < 28; i++) {
    const pts = []; for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; pts.push(new THREE.Vector3(Math.cos(a) * 14, Math.sin(a) * 22, 0)); }
    const m = new THREE.LineBasicMaterial({ transparent: true }); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
    scene.add(l); tunnel.push(l);
  }
  const rg = ring(THREE, scene, 24, 6.6, 2.2), st = stars(THREE, scene, rnd);
  return (f) => {
    const { t, kick, rms, color } = f;
    g.rotation.set(t * 0.21, t * 0.45 + kick * 0.12, 0);
    wire.scale.setScalar(1 + kick * 0.22 + rms * 0.08); inner.scale.setScalar(1 + kick * 0.35); iw.scale.setScalar(1 + kick * 0.35);
    iw.rotation.y = -t * 1.1; wm.color.copy(color); im.color.copy(color); im.opacity = 0.04 + kick * 0.1; wm.opacity = 0.3 + kick * 0.35;
    tunnel.forEach((l, i) => {
      l.position.z = ((i * 6 + f.travel) % 168) - 148; l.rotation.z = i * 0.12 + t * 0.15;
      l.material.color.copy(color).lerp(C(THREE, 0xffffff), kick * 0.4); l.material.opacity = 0.2 + kick * 0.35;
    });
    rg(f); st(f);
  };
}

// 2. synthwave: scrolling grid floor, striped sun, mountain lines
export function grid(THREE, scene, camera, rnd) {
  camera.position.set(0, 3, 18);
  const lines = [], gm = new THREE.LineBasicMaterial({ transparent: true });
  for (let i = -20; i <= 20; i++) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i * 3, -6, -160), new THREE.Vector3(i * 3, -6, 30)]);
    scene.add(new THREE.Line(g, gm));
  }
  for (let k = 0; k < 40; k++) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-60, -6, 0), new THREE.Vector3(60, -6, 0)]);
    const l = new THREE.Line(g, gm); scene.add(l); lines.push(l);
  }
  const sunMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, k: { value: 0 }, t: { value: 0 } },
    vertexShader: "varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }",
    fragmentShader: `varying vec2 v; uniform vec3 c1; uniform vec3 c2; uniform float k; uniform float t;
      void main(){ vec2 p=v-.5; float r=length(p); if(r>.5) discard;
        float band=step(.5, fract((v.y*14.)-t*.6)); if(v.y<.45 && band<.5) discard;
        gl_FragColor=vec4(mix(c2,c1,v.y)*(.55+k*.35), 1.); }`,
  });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(16, 64), sunMat); sun.position.set(0, 9, -120); scene.add(sun);
  const mts = [];
  for (let side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 24; i++) { const x = side * (14 + i * 3.4); pts.push(new THREE.Vector3(x, -6 + Math.abs(Math.sin(i * 1.7 + side)) * (6 + rnd() * 10), -110)); }
    const m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ transparent: true })); scene.add(m); mts.push(m);
  }
  const rg = ring(THREE, scene, 24, 6.4, 2.2), st = stars(THREE, scene, rnd, 900);
  return (f) => {
    const { t, kick, color, color2 } = f;
    gm.color.copy(color); gm.opacity = 0.35 + kick * 0.5;
    lines.forEach((l, k) => { l.position.z = -((k * 4 - f.travel * 0.9) % 160 + 160) % 160 + 30; });
    sunMat.uniforms.c1.value.copy(color2); sunMat.uniforms.c2.value.copy(color); sunMat.uniforms.k.value = kick; sunMat.uniforms.t.value = t;
    sun.scale.setScalar(1 + kick * 0.05);
    mts.forEach(m => { m.material.color.copy(color2); m.material.opacity = 0.6; });
    camera.position.y = 3 + Math.sin(t * 0.4) * 0.4;
    rg(f); st(f);
  };
}

// 3. galaxy: spiral of particles that breathes on the kick
export function galaxy(THREE, scene, camera, rnd) {
  const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) { const arm = i % 4, r = Math.pow(rnd(), 0.6) * 22; seed.push([arm, r, (rnd() - 0.5) * 2.2, rnd()]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.position.y = 2.2; pts.rotation.x = 1.0; scene.add(pts);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); core.position.y = 2.2; scene.add(core);
  const rg = ring(THREE, scene, 24, 7.2, 2.2);
  const white = new THREE.Color(0xffffff), tmp = new THREE.Color();
  return (f) => {
    const { t, kick, color, color2 } = f;
    for (let i = 0; i < N; i++) {
      const [arm, r, h, s] = seed[i];
      const a = arm / 4 * Math.PI * 2 + r * 0.28 + t * (0.35 - r * 0.008) + s * 0.4;
      const rr = r * (1 + kick * 0.06);
      pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = Math.sin(a) * rr; pos[i * 3 + 2] = h * (1 - r / 26);
      tmp.copy(color).lerp(color2, r / 22).lerp(white, Math.max(0, 1 - r / 4) * 0.8);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    pts.rotation.z = t * 0.05; core.scale.setScalar(1 + kick * 0.5); core.material.color.copy(color).lerp(white, 0.6);
    mat.size = 0.14 + kick * 0.1;
    rg(f);
  };
}

// 4. equaliser city: a field of boxes driven by the spectrum, slow orbit
export function city(THREE, scene, camera, rnd) {
  const NX = 18, NZ = 18, n = NX * NZ;
  const geo = new THREE.BoxGeometry(1.6, 1, 1.6); geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n); scene.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(60, 0.01, 60)), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 }));
  edges.position.y = -8; scene.add(edges);
  const d = new THREE.Object3D(), h = [];
  for (let i = 0; i < n; i++) h.push([i % NX, Math.floor(i / NX), rnd()]);
  const rg = ring(THREE, scene, 24, 6.6, 2.2);
  const dark = new THREE.Color(0x0a0c18);
  return (f) => {
    const { t, kick, bands, color, color2 } = f;
    camera.position.set(Math.sin(t * 0.12) * 4, 1 + Math.sin(t * 0.2) * 0.6, 18);
    camera.lookAt(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const [x, z, r] = h[i];
      const dist = Math.hypot(x - NX / 2, z - NZ / 2);
      const b = bands[Math.min(bands.length - 1, Math.floor(dist / 13 * bands.length))];
      d.position.set((x - NX / 2) * 3.2, -8, (z - NZ / 2) * 3.2 - 30);
      d.scale.set(1, 0.3 + b * b * 12 * (0.6 + r * 0.6) + kick * 2, 1);
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, dark.clone().lerp((x + z) % 2 ? color : color2, 0.18 + b * 0.5));
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    edges.material.color.copy(color);
    rg(f);
  };
}

export const SCENES = { core, grid, galaxy, city };
