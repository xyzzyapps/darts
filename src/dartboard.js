import * as THREE from 'three';

// PDC / BDO Regulation dimensions (in meters)
export const DARTBOARD_SPECS = {
  HEIGHT_FROM_FLOOR: 1.73,     // 5 ft 8 in regulation bullseye height
  THROW_DISTANCE: 2.37,        // 7 ft 9.25 in regulation oche distance
  DOUBLE_BULL_RADIUS: 0.00635, // 12.7mm diameter (50 pts)
  SINGLE_BULL_RADIUS: 0.0159,  // 31.8mm diameter (25 pts)
  TREBLE_INNER: 0.097,
  TREBLE_OUTER: 0.107,         // 10mm wide treble bed
  DOUBLE_INNER: 0.162,
  DOUBLE_OUTER: 0.170,         // 8mm wide double bed
  BOARD_RADIUS: 0.2255,        // 451mm diameter regulation board
  SURROUND_RADIUS: 0.36,       // Rubber/cork wall surround ring
};

export const SECTOR_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
];

export function getScoreAtLocal(x, y) {
  const r = Math.sqrt(x * x + y * y);

  // Beyond surround = wall miss
  if (r > DARTBOARD_SPECS.SURROUND_RADIUS) {
    return {
      score: 0,
      multiplier: 0,
      sector: 0,
      type: 'WALL_MISS',
      label: 'Miss (Wall)',
      isBull: false,
      isDouble: false,
      isTreble: false
    };
  }

  // Inside surround but off the active scoring board
  if (r > DARTBOARD_SPECS.DOUBLE_OUTER) {
    const isNumberRing = r <= DARTBOARD_SPECS.BOARD_RADIUS;
    return {
      score: 0,
      multiplier: 0,
      sector: 0,
      type: isNumberRing ? 'NUMBER_RING' : 'SURROUND',
      label: isNumberRing ? 'Miss (Number Ring)' : 'Miss (Surround)',
      isBull: false,
      isDouble: false,
      isTreble: false
    };
  }

  // Double Bull (Bullseye) = 50 pts
  if (r <= DARTBOARD_SPECS.DOUBLE_BULL_RADIUS) {
    return {
      score: 50,
      multiplier: 2,
      sector: 25,
      type: 'DOUBLE_BULL',
      label: 'BULLSEYE! (50)',
      isBull: true,
      isDouble: true,
      isTreble: false
    };
  }

  // Single Bull (Outer Bull) = 25 pts
  if (r <= DARTBOARD_SPECS.SINGLE_BULL_RADIUS) {
    return {
      score: 25,
      multiplier: 1,
      sector: 25,
      type: 'SINGLE_BULL',
      label: 'Outer Bull (25)',
      isBull: true,
      isDouble: false,
      isTreble: false
    };
  }

  // Angular calculation: 0 rad is +Y (top, sector 20), angles increase clockwise towards +X
  // In screen/3D space: x is right, y is up
  // Angle clockwise from +Y:
  let angleDeg = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  // Offset by 9 degrees because sector 20 is centered on 0 (-9 deg to +9 deg)
  const sectorIndex = Math.floor(((angleDeg + 9) % 360) / 18);
  const sector = SECTOR_ORDER[sectorIndex];

  // Treble ring
  if (r >= DARTBOARD_SPECS.TREBLE_INNER && r <= DARTBOARD_SPECS.TREBLE_OUTER) {
    return {
      score: sector * 3,
      multiplier: 3,
      sector: sector,
      type: 'TREBLE',
      label: `Treble ${sector} (${sector * 3})`,
      isBull: false,
      isDouble: false,
      isTreble: true
    };
  }

  // Double ring
  if (r >= DARTBOARD_SPECS.DOUBLE_INNER && r <= DARTBOARD_SPECS.DOUBLE_OUTER) {
    return {
      score: sector * 2,
      multiplier: 2,
      sector: sector,
      type: 'DOUBLE',
      label: `Double ${sector} (${sector * 2})`,
      isBull: false,
      isDouble: true,
      isTreble: false
    };
  }

  // Single bed
  return {
    score: sector,
    multiplier: 1,
    sector: sector,
    type: 'SINGLE',
    label: `Single ${sector} (${sector})`,
    isBull: false,
    isDouble: false,
    isTreble: false
  };
}

// Procedural high-resolution dartboard canvas texture
export function createDartboardTexture() {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;
  // Scale factor: BOARD_RADIUS corresponds to size * 0.45
  const scale = (size * 0.45) / DARTBOARD_SPECS.BOARD_RADIUS;

  // Background: dark sisal edge
  ctx.fillStyle = '#0f0f13';
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  // Colors
  const blackColor = '#18181c';
  const creamColor = '#e8dec5';
  const redColor = '#cc1c23';
  const greenColor = '#1f7a3a';

  const rDoubleOuter = DARTBOARD_SPECS.DOUBLE_OUTER * scale;
  const rDoubleInner = DARTBOARD_SPECS.DOUBLE_INNER * scale;
  const rTrebleOuter = DARTBOARD_SPECS.TREBLE_OUTER * scale;
  const rTrebleInner = DARTBOARD_SPECS.TREBLE_INNER * scale;
  const rSingleBull = DARTBOARD_SPECS.SINGLE_BULL_RADIUS * scale;
  const rDoubleBull = DARTBOARD_SPECS.DOUBLE_BULL_RADIUS * scale;

  // Draw 20 wedge sectors clockwise starting with sector 20 at top
  for (let i = 0; i < 20; i++) {
    const canvasCenterAngle = -Math.PI / 2 + (i * 18 * Math.PI / 180);
    const startAngle = canvasCenterAngle - 9 * Math.PI / 180;
    const endAngle = canvasCenterAngle + 9 * Math.PI / 180;
    const isEven = i % 2 === 0;

    // Single outer and inner bed
    ctx.fillStyle = isEven ? blackColor : creamColor;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, rDoubleInner, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    // Double ring
    ctx.fillStyle = isEven ? redColor : greenColor;
    ctx.beginPath();
    ctx.arc(center, center, rDoubleOuter, startAngle, endAngle);
    ctx.arc(center, center, rDoubleInner, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();

    // Treble ring
    ctx.fillStyle = isEven ? redColor : greenColor;
    ctx.beginPath();
    ctx.arc(center, center, rTrebleOuter, startAngle, endAngle);
    ctx.arc(center, center, rTrebleInner, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();
  }

  // Outer Bull (green)
  ctx.fillStyle = greenColor;
  ctx.beginPath();
  ctx.arc(center, center, rSingleBull, 0, Math.PI * 2);
  ctx.fill();

  // Inner Bull (red)
  ctx.fillStyle = redColor;
  ctx.beginPath();
  ctx.arc(center, center, rDoubleBull, 0, Math.PI * 2);
  ctx.fill();

  // Numbers ring
  const numberRadius = (rDoubleOuter + (size * 0.45)) * 0.5;
  ctx.fillStyle = '#f8f8fc';
  ctx.font = 'bold 64px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI / 2 + (i * 18 * Math.PI / 180);
    const numX = center + Math.cos(angle) * numberRadius;
    const numY = center + Math.sin(angle) * numberRadius;

    ctx.save();
    ctx.translate(numX, numY);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(SECTOR_ORDER[i].toString(), 0, 0);
    ctx.restore();
  }

  // Add authentic sisal bristle texture noise
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Builds the complete 3D Dartboard group with board, spider wire, surround, and cabinet
export function createDartboard() {
  const group = new THREE.Group();
  group.name = 'DartboardGroup';

  const boardRadius = DARTBOARD_SPECS.BOARD_RADIUS;
  const boardDepth = 0.038; // 38mm thick sisal board

  // 1. Sisal Board Cylinder Body
  const cylinderGeo = new THREE.CylinderGeometry(boardRadius, boardRadius, boardDepth, 64);
  cylinderGeo.rotateX(Math.PI / 2);
  const cylinderMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    roughness: 0.85
  });
  const cylinderMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
  cylinderMesh.castShadow = true;
  cylinderMesh.receiveShadow = true;
  group.add(cylinderMesh);

  // 2. High-res Front Face Disc (CircleGeometry provides perfect 1:1 UV alignment with canvas)
  const faceGeo = new THREE.CircleGeometry(boardRadius, 64);
  const boardTexture = createDartboardTexture();
  const faceMat = new THREE.MeshStandardMaterial({
    map: boardTexture,
    roughness: 0.88,
    metalness: 0.05
  });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.name = 'DartboardMesh';
  faceMesh.position.z = boardDepth / 2 + 0.0005;
  faceMesh.receiveShadow = true;
  group.add(faceMesh);

  // 3. High-spec 3D Metallic Spider Wire overlay
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0xd8d8e0,
    metalness: 0.9,
    roughness: 0.25
  });
  const wireRadius = 0.0009; // 0.9mm metallic wire

  // Concentric Rings
  const ringRadii = [
    DARTBOARD_SPECS.DOUBLE_BULL_RADIUS,
    DARTBOARD_SPECS.SINGLE_BULL_RADIUS,
    DARTBOARD_SPECS.TREBLE_INNER,
    DARTBOARD_SPECS.TREBLE_OUTER,
    DARTBOARD_SPECS.DOUBLE_INNER,
    DARTBOARD_SPECS.DOUBLE_OUTER
  ];

  ringRadii.forEach(r => {
    const ringGeo = new THREE.TorusGeometry(r, wireRadius, 8, 64);
    const ringMesh = new THREE.Mesh(ringGeo, wireMat);
    ringMesh.position.z = boardDepth / 2 + 0.0015;
    group.add(ringMesh);
  });

  // Radial spoke wires
  const innerR = DARTBOARD_SPECS.SINGLE_BULL_RADIUS;
  const outerR = DARTBOARD_SPECS.DOUBLE_OUTER;
  const spokeLength = outerR - innerR;
  const midR = (innerR + outerR) / 2;

  for (let i = 0; i < 20; i++) {
    const alpha = (i * 18 - 9) * Math.PI / 180; // Clockwise from top
    const dir = new THREE.Vector3(Math.sin(alpha), Math.cos(alpha), 0);

    const spokeGeo = new THREE.CylinderGeometry(wireRadius, wireRadius, spokeLength, 6);
    const spokeMesh = new THREE.Mesh(spokeGeo, wireMat);

    spokeMesh.position.copy(dir.clone().multiplyScalar(midR));
    spokeMesh.position.z = boardDepth / 2 + 0.0015;
    spokeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    group.add(spokeMesh);
  }

  // 4. Wall Protection Surround Ring (Velvet / EVA Foam / Rubber)
  const surroundInnerR = DARTBOARD_SPECS.BOARD_RADIUS;
  const surroundOuterR = DARTBOARD_SPECS.SURROUND_RADIUS;
  const surroundDepth = 0.035;

  const surroundShape = new THREE.Shape();
  surroundShape.absarc(0, 0, surroundOuterR, 0, Math.PI * 2, false);
  const surroundHole = new THREE.Path();
  surroundHole.absarc(0, 0, surroundInnerR, 0, Math.PI * 2, true);
  surroundShape.holes.push(surroundHole);

  const extrudeSettings = { depth: surroundDepth, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.006, bevelThickness: 0.006 };
  const surroundGeo = new THREE.ExtrudeGeometry(surroundShape, extrudeSettings);
  surroundGeo.translate(0, 0, -surroundDepth / 2);

  const surroundMat = new THREE.MeshStandardMaterial({
    color: 0x8b1a20, // Classic rich burgundy / wine velvet surround
    roughness: 0.95,
    metalness: 0.02
  });
  const surroundMesh = new THREE.Mesh(surroundGeo, surroundMat);
  surroundMesh.name = 'SurroundMesh';
  surroundMesh.position.z = 0;
  surroundMesh.castShadow = true;
  surroundMesh.receiveShadow = true;
  group.add(surroundMesh);

  // Position entire board group at regulation height: Bullseye at Y = 1.73m, facing +Z
  group.position.set(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.05);

  return {
    group,
    frontZ: group.position.z + boardDepth / 2 + 0.001,
    getScoreAtLocal
  };
}
