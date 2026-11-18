// The Tally (characters.md Fix 5): the chip every counted person carries, made visible. An amber dot on the crown of
// every Census head (and the informant's) pulsing slowly. When they're counted out it flares and goes dark.
// Civilians in Moth's care have none (they're uncounted); Null has none. One instanced draw for all of them.
import * as THREE from 'three';
import { G } from './state.js';

export function makeTally(scene) {
  const N = 32, geo = new THREE.PlaneGeometry(1, 1);
  const ph = new Float32Array(N); for (let i = 0; i < N; i++) ph[i] = Math.random() * 6.28;
  geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
  const im = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute float aPh; uniform float uTime; varying vec2 vU; varying float vA;
      void main(){ vec3 c = instanceMatrix[3].xyz; float s = length(instanceMatrix[0].xyz);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vU = uv * 2.0 - 1.0; vA = 0.35 + 0.25 * (0.5 + 0.5 * sin(uTime * 2.4 + aPh));
        gl_Position = projectionMatrix * viewMatrix * vec4(c + (right * position.x + up * position.y) * s, 1.0); }`,
    fragmentShader: `varying vec2 vU; varying float vA;
      void main(){ float r = length(vU); if (r > 1.0) discard; float core = 1.0 - smoothstep(0.12, 0.22, r); float glow = pow(1.0 - r, 2.2);
        gl_FragColor = vec4(vec3(2.6, 1.3, 0.35) * (core * 1.4 + glow * vA * 1.6), 1.0); }` }), N);
  im.count = 0; im.frustumCulled = false; im.renderOrder = 9; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), H = new THREE.Vector3();
  const out = new WeakMap();
  function update(dt) {
    im.material.uniforms.uTime.value = G.rt || 0;
    let n = 0;
    for (const e of G.enemies || []) {
      if (n >= N || e.def.drone || !e.bones || !e.bones.head || e.state === 'spawn') continue;
      let size = 0.18;
      if (e.dead || !e.alive) { const t = (out.get(e) || 0) + dt; out.set(e, t); if (t > 0.12) continue; size = 0.36; }   // counted out: it flares, then it's gone
      e.bones.head.getWorldPosition(H);
      const fx = Math.sin(e.yaw || 0), fz = Math.cos(e.yaw || 0), sc = e.def.scale || 1;
      P.set(H.x - fx * 0.12 * sc, H.y + 0.12 * sc, H.z - fz * 0.12 * sc);
      M.compose(P, Q, S.setScalar(size * sc)); im.setMatrixAt(n++, M);
    }
    im.count = n; im.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
