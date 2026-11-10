import * as THREE from 'three';
import { DARTBOARD_SPECS } from './dartboard.js';

export function createEnvironment(scene) {
  const envGroup = new THREE.Group();
  envGroup.name = 'PubEnvironment';

  // 1. Procedural Wood Floor Texture
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 1024;
  floorCanvas.height = 1024;
  const fctx = floorCanvas.getContext('2d');

  fctx.fillStyle = '#22150c';
  fctx.fillRect(0, 0, 1024, 1024);

  // Planks
  const plankH = 64;
  for (let y = 0; y < 1024; y += plankH) {
    fctx.strokeStyle = '#0e0804';
    fctx.lineWidth = 4;
    fctx.beginPath();
    fctx.moveTo(0, y);
    fctx.lineTo(1024, y);
    fctx.stroke();

    const shadeOffset = (Math.random() - 0.5) * 20;
    fctx.fillStyle = `rgba(180, 100, 45, ${0.15 + (y % 128 === 0 ? 0.05 : 0)})`;
    fctx.fillRect(0, y, 1024, plankH);
  }

  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(4, 4);

  // Floor Mesh
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.6,
    metalness: 0.1
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  envGroup.add(floorMesh);

  // 2. Regulation Darts Oche (Throw Line at 2.37m)
  const ocheZ = DARTBOARD_SPECS.THROW_DISTANCE;
  const ocheGeo = new THREE.BoxGeometry(1.4, 0.038, 0.08); // Raised wooden toe board
  const ocheMat = new THREE.MeshStandardMaterial({
    color: 0x8a1c14, // PDC tournament red oche
    roughness: 0.7
  });
  const ocheMesh = new THREE.Mesh(ocheGeo, ocheMat);
  ocheMesh.position.set(0, 0.019, ocheZ);
  ocheMesh.castShadow = true;
  ocheMesh.receiveShadow = true;
  envGroup.add(ocheMesh);

  // Oche brass nameplate label
  const ocheLabelCanvas = document.createElement('canvas');
  ocheLabelCanvas.width = 512;
  ocheLabelCanvas.height = 64;
  const olctx = ocheLabelCanvas.getContext('2d');
  olctx.fillStyle = '#b4975a'; // Brass
  olctx.fillRect(0, 0, 512, 64);
  olctx.fillStyle = '#111';
  olctx.font = 'bold 26px sans-serif';
  olctx.textAlign = 'center';
  olctx.fillText('★ OCHE  2.37M (7 FT 9¼ IN) ★', 256, 42);

  const ocheLabelTexture = new THREE.CanvasTexture(ocheLabelCanvas);
  const ocheLabelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.07),
    new THREE.MeshStandardMaterial({ map: ocheLabelTexture, metalness: 0.8, roughness: 0.3 })
  );
  ocheLabelMesh.position.set(0, 0.04, ocheZ);
  ocheLabelMesh.rotation.x = -Math.PI / 2;
  envGroup.add(ocheLabelMesh);

  // Runner Mat from Oche to Dartboard
  const runnerMatGeo = new THREE.PlaneGeometry(0.9, ocheZ);
  const runnerMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.95
  });
  const runnerMesh = new THREE.Mesh(runnerMatGeo, runnerMat);
  runnerMesh.position.set(0, 0.002, ocheZ / 2);
  runnerMesh.rotation.x = -Math.PI / 2;
  runnerMesh.receiveShadow = true;
  envGroup.add(runnerMesh);

  // 3. Back Wall behind dartboard (Exposed Brick / Dark Wood Paneling)
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 1024;
  wallCanvas.height = 1024;
  const wctx = wallCanvas.getContext('2d');
  wctx.fillStyle = '#1c1613';
  wctx.fillRect(0, 0, 1024, 1024);

  // Brick pattern
  const bh = 40;
  const bw = 90;
  for (let y = 0; y < 1024; y += bh + 6) {
    const rowOffset = (Math.floor(y / bh) % 2) * (bw / 2);
    for (let x = -bw; x < 1024 + bw; x += bw + 6) {
      const redVal = 100 + Math.floor(Math.random() * 45);
      wctx.fillStyle = `rgb(${redVal}, ${Math.floor(redVal * 0.45)}, ${Math.floor(redVal * 0.3)})`;
      wctx.fillRect(x + rowOffset, y, bw, bh);
    }
  }
  const wallTexture = new THREE.CanvasTexture(wallCanvas);
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(3, 2);

  const backWallGeo = new THREE.PlaneGeometry(10, 5);
  const backWallMat = new THREE.MeshStandardMaterial({
    map: wallTexture,
    roughness: 0.9,
    metalness: 0.05
  });
  const backWall = new THREE.Mesh(backWallGeo, backWallMat);
  backWall.position.set(0, 2.5, 0);
  backWall.receiveShadow = true;
  envGroup.add(backWall);

  // Left & Right walls
  const sideWallGeo = new THREE.PlaneGeometry(10, 5);
  const leftWall = new THREE.Mesh(sideWallGeo, backWallMat);
  leftWall.position.set(-5, 2.5, 5);
  leftWall.rotation.y = Math.PI / 2;
  envGroup.add(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, backWallMat);
  rightWall.position.set(5, 2.5, 5);
  rightWall.rotation.y = -Math.PI / 2;
  envGroup.add(rightWall);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(10, 10);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95 });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.set(0, 4.0, 5);
  ceiling.rotation.x = Math.PI / 2;
  envGroup.add(ceiling);

  // 4. Pub Side Table / Dart Stand (Right of the player at oche)
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0.75, 0, 2.2);

  // Table top
  const tableTopGeo = new THREE.BoxGeometry(0.45, 0.04, 0.55);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.7 });
  const tableTop = new THREE.Mesh(tableTopGeo, woodMat);
  tableTop.position.y = 0.85;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  tableGroup.add(tableTop);

  // Table legs
  const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.83, 12);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.4 });
  const legPositions = [
    [-0.18, 0.415, -0.22],
    [0.18, 0.415, -0.22],
    [-0.18, 0.415, 0.22],
    [0.18, 0.415, 0.22]
  ];
  legPositions.forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    tableGroup.add(leg);
  });

  // Wooden Dart Caddy Block on table
  const caddyGeo = new THREE.BoxGeometry(0.18, 0.045, 0.09);
  const caddyMesh = new THREE.Mesh(caddyGeo, woodMat);
  caddyMesh.position.set(0, 0.89, 0);
  caddyMesh.castShadow = true;
  tableGroup.add(caddyMesh);

  // Frosted Ale Glass on table
  const glassGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.14, 16);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xef9f22,
    transparent: true,
    opacity: 0.75,
    roughness: 0.2,
    transmission: 0.6
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0.12, 0.94, -0.1);
  glass.castShadow = true;
  tableGroup.add(glass);

  // Foam top on ale
  const foamGeo = new THREE.CylinderGeometry(0.041, 0.04, 0.02, 16);
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.9 });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.set(0.12, 1.01, -0.1);
  tableGroup.add(foam);

  envGroup.add(tableGroup);

  // 5. Lighting Setup
  // Ambient Pub Warmth
  const ambientLight = new THREE.AmbientLight(0xffecd2, 0.45);
  scene.add(ambientLight);

  // Overhead pub room light
  const roomLight = new THREE.PointLight(0xffcaa0, 1.2, 12);
  roomLight.position.set(0, 3.2, 2.5);
  roomLight.castShadow = true;
  roomLight.shadow.mapSize.width = 1024;
  roomLight.shadow.mapSize.height = 1024;
  scene.add(roomLight);

  // Focused Tournament Spotlight directed onto the Dartboard
  const boardSpotlight = new THREE.SpotLight(0xffffff, 3.5);
  boardSpotlight.position.set(0, 2.8, 1.2);
  boardSpotlight.target.position.set(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.05);
  boardSpotlight.angle = Math.PI / 5;
  boardSpotlight.penumbra = 0.35;
  boardSpotlight.castShadow = true;
  boardSpotlight.shadow.bias = -0.0001;
  boardSpotlight.shadow.mapSize.width = 2048;
  boardSpotlight.shadow.mapSize.height = 2048;
  scene.add(boardSpotlight);
  scene.add(boardSpotlight.target);

  // Warm backlight fill for scoreboard
  const scoreLight = new THREE.PointLight(0x93c5fd, 0.8, 4);
  scoreLight.position.set(-0.75, 2.2, 0.8);
  scene.add(scoreLight);

  scene.add(envGroup);

  return {
    envGroup,
    tablePos: new THREE.Vector3(0.75, 0.89, 2.2),
    ocheZ
  };
}
