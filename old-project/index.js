import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const sunGroup = new THREE.Group();
scene.add(sunGroup);
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 115;
camera.position.x = 5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
THREE.ColorManagement.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;
scene.add(earthGroup);
new OrbitControls(camera, renderer.domElement);
const detail = 12;
const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1, detail);
const material = new THREE.MeshPhongMaterial({
  map: loader.load("../public/textures/00_earthmap1k.jpg"),
  specularMap: loader.load("../public/textures/02_earthspec1k.jpg"),
  bumpMap: loader.load("../public/textures/01_earthbump1k.jpg"),
  bumpScale: 0.04,
});
material.map.colorSpace = THREE.SRGBColorSpace;
const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);

const lightsMat = new THREE.MeshBasicMaterial({
  map: loader.load("../public/textures/03_earthlights1k.jpg"),
  blending: THREE.AdditiveBlending,
});
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

const cloudsMat = new THREE.MeshStandardMaterial({
  map: loader.load("../public/textures/04_earthcloudmap.jpg"),
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  alphaMap: loader.load('../public/textures/05_earthcloudmaptrans.jpg'),
});
const cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

const fresnelMat = getFresnelMat();
const glowMesh = new THREE.Mesh(geometry, fresnelMat);
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(-2, 0.1, 0.5);
scene.add(sunLight);

const sunRadius = 1.2;
const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
const sunSurfaceMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, blending: THREE.AdditiveBlending });
const sunMesh = new THREE.Mesh(sunGeometry, sunSurfaceMat);
sunMesh.position.set(-20, 0.5, -2);
sunGroup.add(sunMesh);

const fresnelMatSunGlow = getFresnelMat({ rimHex: 0xffaa22, facingHex: 0x110000 });
const scales = [1.0, 1.02, 1.05, 1.1, 1.2, 1.4, 1.6];

for (const scale of scales) {
  const glow = new THREE.Mesh(sunGeometry, fresnelMatSunGlow);
  glow.scale.setScalar(scale);
  glow.position.copy(sunMesh.position);
  sunGroup.add(glow);
}

const sunPointLight = new THREE.PointLight(0xffeecc, 6, 200, 2);
sunPointLight.position.copy(sunMesh.position);
scene.add(sunPointLight);

let moonPivot = null;
let moonMesh = null;
let moonVisible = true;
moonPivot = new THREE.Object3D();
moonPivot.name = 'moonPivot';
moonPivot.visible = moonVisible;
earthGroup.add(moonPivot);

loader.load('../public/textures/moonmap1k.jpg', (moonTex) => {
  try { moonTex.colorSpace = THREE.SRGBColorSpace; } catch (e) { }
  loader.load('../public/textures/moonbump1k.jpg', (bumpTex) => {
    try { bumpTex.colorSpace = THREE.SRGBColorSpace; } catch (e) { }
    const moonGeo = new THREE.SphereGeometry(0.27, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, bumpMap: bumpTex, bumpScale: 0.02 });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(3.2, 0.2, 0);
    moonMesh.name = 'moonMesh';
    moonMesh.visible = moonVisible;
    moonPivot.add(moonMesh);
  }, undefined, (err) => {
    console.warn('Moon bump map missing or failed to load:', err);
    const moonGeo = new THREE.SphereGeometry(0.27, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ map: moonTex });
    moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(3.2, 0.2, 0);
    moonMesh.name = 'moonMesh';
    moonMesh.visible = moonVisible;
    moonPivot.add(moonMesh);
  });
}, undefined, (err) => {
  console.warn('Moon texture not found or failed to load:', err);
});

function getFresnelMat({ rimHex = 0x0088ff, facingHex = 0x000000 } = {}) {
  const uniforms = {
    color1: { value: new THREE.Color(rimHex) },
    color2: { value: new THREE.Color(facingHex) },
    fresnelBias: { value: 0.1 },
    fresnelScale: { value: 1.0 },
    fresnelPower: { value: 4.0 },
  };
  const vs = `
  uniform float fresnelBias;
  uniform float fresnelScale;
  uniform float fresnelPower;
  varying float vReflectionFactor;
  
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
    vec3 I = worldPosition.xyz - cameraPosition;
    vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
    gl_Position = projectionMatrix * mvPosition;
  }
  `;
  const fs = `
  uniform vec3 color1;
  uniform vec3 color2;
  varying float vReflectionFactor;
  
  void main() {
    float f = clamp( vReflectionFactor, 0.0, 1.0 );
    gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
  }
  `;
  const fresnelMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
    blending: THREE.AdditiveBlending,
    wireframe: false,
  });
  return fresnelMat;
}

const speed = 0.0005;
const clock = new THREE.Clock();
const explosions = [];
const shockwaves = [];
let _frameCounter = 0;

function animateSun() {
  requestAnimationFrame(animateSun);

  const dt = clock.getDelta();
  earthMesh.rotation.y += speed;
  lightsMesh.rotation.y += speed;
  cloudsMesh.rotation.y -= speed;
  glowMesh.rotation.y += speed;
  sunMesh.rotation.y += speed;
  earthGroup.rotation.z -= speed;
  if (moonPivot) {
    moonPivot.rotation.y -= speed * 5;
  }
  if (moonMesh) {
    moonMesh.rotation.y -= speed * 10;
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.birth += dt;
    const posAttr = e.pts.geometry.getAttribute('position');
    for (let j = 0; j < posAttr.count; j++) {
      let vx = e.velocities[3 * j + 0] * dt;
      let vy = e.velocities[3 * j + 1] * dt;
      let vz = e.velocities[3 * j + 2] * dt;
      if (!Number.isFinite(vx)) { vx = 0; e.velocities[3 * j + 0] = 0; }
      if (!Number.isFinite(vy)) { vy = 0; e.velocities[3 * j + 1] = 0; }
      if (!Number.isFinite(vz)) { vz = 0; e.velocities[3 * j + 2] = 0; }
      const nx = posAttr.array[3 * j + 0] + vx;
      const ny = posAttr.array[3 * j + 1] + vy;
      const nz = posAttr.array[3 * j + 2] + vz;
      posAttr.array[3 * j + 0] = Number.isFinite(nx) ? nx : 0;
      posAttr.array[3 * j + 1] = Number.isFinite(ny) ? ny : 0;
      posAttr.array[3 * j + 2] = Number.isFinite(nz) ? nz : 0;
      e.velocities[3 * j + 0] *= 0.999;
      e.velocities[3 * j + 1] *= 0.999;
      e.velocities[3 * j + 2] *= 0.999;
    }
    posAttr.needsUpdate = true;
    const t = e.birth / e.life;
    e.pts.material.opacity = Math.max(0, 1.0 - t);
    if (e.birth > e.life) {
      scene.remove(e.pts);
      explosions.splice(i, 1);
    }
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.birth += dt;
    const t = s.birth / s.life;
    s.mesh.scale.setScalar(1 + t * 8);
    s.mesh.material.opacity = Math.max(0, 0.9 * (1 - t));
    if (s.birth > s.life) {
      scene.remove(s.mesh);
      shockwaves.splice(i, 1);
    }
  }

  _frameCounter++;
  renderer.render(scene, camera);
}

animateSun();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);