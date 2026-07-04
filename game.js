// ============ SUPRA DRIVE ============
// Simple arcade driving game: road + trees + touch steering wheel + accel/brake pad

let scene, camera, renderer;
let car, carBody = null;
let clock = new THREE.Clock();

// Car physics state
let speed = 0;          // current speed (m/s)
const MAX_SPEED = 55;   // ~ top speed m/s
const ACCEL_RATE = 14;
const BRAKE_RATE = 26;
const FRICTION = 6;
let steerAngle = 0;      // -1 to 1
const STEER_MAX_VISUAL = 0.5;

let inputAccel = false;
let inputBrake = false;
let inputSteer = 0; // -1 left .. 1 right

// Road
const ROAD_WIDTH = 14;
const SEGMENT_LEN = 20;
const NUM_SEGMENTS = 40;
let roadSegments = [];
let treeMeshes = [];
let treePool = [];

// Camera mode
let camMode = 0; // 0 = chase, 1 = top-ish

init();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 60, 220);

  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 6, -10);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  setupLights();
  setupGround();
  buildRoad();
  spawnTrees();
  loadCar();
  setupControls();
  window.addEventListener('resize', onResize);

  animate();
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2e0, 1.2);
  sun.position.set(-40, 60, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 200;
  scene.add(sun);
}

function setupGround() {
  const groundGeo = new THREE.PlaneGeometry(2000, 2000);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3c, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);
}

function buildRoad() {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 });

  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const geo = new THREE.PlaneGeometry(ROAD_WIDTH, SEGMENT_LEN);
    const seg = new THREE.Mesh(geo, roadMat);
    seg.rotation.x = -Math.PI / 2;
    seg.position.z = i * SEGMENT_LEN;
    seg.receiveShadow = true;
    scene.add(seg);
    roadSegments.push(seg);

    // dashed centerline
    if (i % 2 === 0) {
      const lineGeo = new THREE.PlaneGeometry(0.3, SEGMENT_LEN * 0.5);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.01, seg.position.z);
      scene.add(line);
      seg.userData.line = line;
    }

    // side curbs
    const curbGeo = new THREE.BoxGeometry(0.4, 0.15, SEGMENT_LEN);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8 });
    const curbL = new THREE.Mesh(curbGeo, curbMat);
    curbL.position.set(-ROAD_WIDTH / 2 - 0.2, 0.07, seg.position.z);
    curbL.castShadow = true;
    scene.add(curbL);
    const curbR = curbL.clone();
    curbR.position.x = ROAD_WIDTH / 2 + 0.2;
    scene.add(curbR);

    seg.userData.curbL = curbL;
    seg.userData.curbR = curbR;
  }
}

function makeTree() {
  const group = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  group.add(trunk);

  const foliageColors = [0x2e7d32, 0x358a3a, 0x276b2b];
  const color = foliageColors[Math.floor(Math.random() * foliageColors.length)];
  const foliageMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const r = 1.6 - t * 0.4;
    const h = 1.6 - t * 0.25;
    const geo = new THREE.ConeGeometry(r, h, 8);
    const cone = new THREE.Mesh(geo, foliageMat);
    cone.position.y = 2.2 + t * 1.1;
    cone.castShadow = true;
    group.add(cone);
  }

  const scale = 0.8 + Math.random() * 0.6;
  group.scale.setScalar(scale);
  return group;
}

function spawnTrees() {
  const treesPerSide = NUM_SEGMENTS * 1.5;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < treesPerSide; i++) {
      const tree = makeTree();
      const z = Math.random() * (NUM_SEGMENTS * SEGMENT_LEN);
      const x = side * (ROAD_WIDTH / 2 + 3 + Math.random() * 14);
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      scene.add(tree);
      treeMeshes.push(tree);
    }
  }
}

function loadCar() {
  const loader = new THREE.GLTFLoader();
  const barFill = document.getElementById('bar-fill');
  const loadingSub = document.getElementById('loading-sub');

  loader.load(
    'assets/scene.gltf',
    (gltf) => {
      carBody = gltf.scene;

      // Normalize scale/orientation - fit car to a reasonable size
      const box = new THREE.Box3().setFromObject(carBody);
      const size = new THREE.Vector3();
      box.getSize(size);
      const targetLength = 4.6; // meters, approx real supra length
      const scaleFactor = targetLength / Math.max(size.x, size.z);
      carBody.scale.setScalar(scaleFactor);

      // Recompute box after scale to re-center
      const box2 = new THREE.Box3().setFromObject(carBody);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      carBody.position.sub(center);
      carBody.position.y += (box2.max.y - box2.min.y) * scaleFactor * 0 + (box2.getSize(new THREE.Vector3()).y / 2) - (box2.getSize(new THREE.Vector3()).y/2);
      // Sit on ground: shift so min.y = 0 after centering
      const box3 = new THREE.Box3().setFromObject(carBody);
      carBody.position.y -= box3.min.y;

      carBody.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      car = new THREE.Group();
      car.add(carBody);
      car.position.set(0, 0, 0);
      scene.add(car);

      document.getElementById('loading').style.display = 'none';
    },
    (xhr) => {
      if (xhr.total) {
        const pct = Math.min(100, (xhr.loaded / xhr.total) * 100);
        barFill.style.width = pct + '%';
      }
    },
    (err) => {
      console.error('Failed to load car model', err);
      loadingSub.textContent = 'Failed to load model — check assets/scene.gltf path';
    }
  );
}

// ============ CONTROLS ============
function setupControls() {
  // Steering wheel
  const wheelZone = document.getElementById('wheel-zone');
  const wheelRing = document.getElementById('wheel-ring');
  let wheelDragging = false;
  let wheelCenter = { x: 0, y: 0 };
  let wheelRotation = 0;

  function getWheelCenter() {
    const rect = wheelZone.getBoundingClientRect();
    wheelCenter.x = rect.left + rect.width / 2;
    wheelCenter.y = rect.top + rect.height / 2;
  }

  function updateWheelFromPointer(x, y) {
    const dx = x - wheelCenter.x;
    const dy = y - wheelCenter.y;
    let angle = Math.atan2(dx, -dy); // 0 = up
    // clamp to +-120deg
    const maxAngle = Math.PI * 0.66;
    angle = Math.max(-maxAngle, Math.min(maxAngle, angle));
    wheelRotation = angle;
    wheelRing.style.transform = `rotate(${angle}rad)`;
    inputSteer = angle / maxAngle; // -1..1
  }

  wheelZone.addEventListener('pointerdown', (e) => {
    wheelDragging = true;
    getWheelCenter();
    wheelZone.setPointerCapture(e.pointerId);
    updateWheelFromPointer(e.clientX, e.clientY);
  });
  wheelZone.addEventListener('pointermove', (e) => {
    if (!wheelDragging) return;
    updateWheelFromPointer(e.clientX, e.clientY);
  });
  function releaseWheel(e) {
    wheelDragging = false;
    inputSteer = 0;
    wheelRotation = 0;
    wheelRing.style.transition = 'transform .25s ease-out';
    wheelRing.style.transform = 'rotate(0rad)';
    setTimeout(() => { wheelRing.style.transition = 'none'; }, 260);
  }
  wheelZone.addEventListener('pointerup', releaseWheel);
  wheelZone.addEventListener('pointercancel', releaseWheel);

  // Pedals
  const accelPedal = document.getElementById('accel-pedal');
  const brakePedal = document.getElementById('brake-pedal');

  function bindPedal(el, setter) {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      setter(true);
    });
    const release = () => { el.classList.remove('active'); setter(false); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', (e) => {
      // only release if not still pressed (pointer capture handles most cases)
    });
  }
  bindPedal(accelPedal, (v) => inputAccel = v);
  bindPedal(brakePedal, (v) => inputBrake = v);

  // Keyboard fallback (desktop testing)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') inputAccel = true;
    if (e.key === 'ArrowDown' || e.key === 's') inputBrake = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') inputSteer = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') inputSteer = 1;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') inputAccel = false;
    if (e.key === 'ArrowDown' || e.key === 's') inputBrake = false;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') inputSteer = 0;
  });

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', resetCar);

  // Camera toggle
  document.getElementById('camera-btn').addEventListener('click', () => {
    camMode = (camMode + 1) % 2;
  });
}

function resetCar() {
  if (!car) return;
  car.position.set(0, 0, 0);
  car.rotation.set(0, 0, 0);
  speed = 0;
}

// ============ CAR STATE ============
let carX = 0;
let carZ = 0;
let carYaw = 0;

function updateCar(dt) {
  if (!car) return;

  // Acceleration / braking
  if (inputAccel) {
    speed += ACCEL_RATE * dt;
  } else if (inputBrake) {
    speed -= BRAKE_RATE * dt;
  } else {
    // natural friction decel
    if (speed > 0) speed -= FRICTION * dt;
    else if (speed < 0) speed += FRICTION * dt;
  }
  speed = Math.max(-MAX_SPEED * 0.4, Math.min(MAX_SPEED, speed));
  if (Math.abs(speed) < 0.05) speed = 0;

  // Steering - more effect at lower speed for arcade feel, scaled by speed direction
  const speedFactor = Math.min(1, Math.abs(speed) / 8);
  const turnRate = inputSteer * 1.8 * speedFactor * (speed < 0 ? -1 : 1);
  carYaw += turnRate * dt;

  // Move forward along yaw
  carX += Math.sin(carYaw) * speed * dt;
  carZ += Math.cos(carYaw) * speed * dt;

  // Keep car roughly on road (soft clamp)
  const halfRoad = ROAD_WIDTH / 2 - 1.2;
  if (carX > halfRoad) carX = halfRoad;
  if (carX < -halfRoad) carX = -halfRoad;

  car.position.set(carX, 0, carZ);
  car.rotation.y = carYaw;

  // Visual wheel/body tilt for steering feedback
  carBody.rotation.z = -inputSteer * 0.03 * speedFactor;

  // Infinite road: recycle segments behind camera
  roadSegments.forEach((seg) => {
    while (seg.position.z < carZ - SEGMENT_LEN * 3) {
      seg.position.z += NUM_SEGMENTS * SEGMENT_LEN;
      if (seg.userData.line) seg.userData.line.position.z = seg.position.z;
      if (seg.userData.curbL) seg.userData.curbL.position.z = seg.position.z;
      if (seg.userData.curbR) seg.userData.curbR.position.z = seg.position.z;
    }
  });

  // Recycle trees similarly
  treeMeshes.forEach((tree) => {
    while (tree.position.z < carZ - 60) {
      tree.position.z += NUM_SEGMENTS * SEGMENT_LEN;
      const side = tree.position.x > 0 ? 1 : -1;
      tree.position.x = side * (ROAD_WIDTH / 2 + 3 + Math.random() * 14);
    }
  });

  // Update HUD
  const kmh = Math.abs(speed) * 3.6;
  document.getElementById('speed-val').textContent = Math.round(kmh);
  document.getElementById('gear-val').textContent = speed < -0.1 ? 'R' : 'D';
}

function updateCamera(dt) {
  if (!car) return;

  let camOffset, lookOffset;
  if (camMode === 0) {
    // chase cam
    camOffset = new THREE.Vector3(0, 3.2, -7);
    lookOffset = new THREE.Vector3(0, 1.2, 4);
  } else {
    // higher/top-ish cam
    camOffset = new THREE.Vector3(0, 8, -10);
    lookOffset = new THREE.Vector3(0, 0, 6);
  }

  const rotatedOffset = camOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), carYaw);
  const desiredPos = car.position.clone().add(rotatedOffset);

  camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));

  const rotatedLook = lookOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), carYaw);
  const lookTarget = car.position.clone().add(rotatedLook);
  camera.lookAt(lookTarget);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  updateCar(dt);
  updateCamera(dt);

  renderer.render(scene, camera);
}
