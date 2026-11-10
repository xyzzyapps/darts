import * as THREE from 'three';
import { sounds } from './audio.js';
import { DARTBOARD_SPECS, getScoreAtLocal } from './dartboard.js';

// Realistic 3D Dart Model Generator
export function createDartMesh(flightColor = 0xe63946, barrelColor = 0xd4af37) {
  const dartGroup = new THREE.Group();
  dartGroup.name = 'Dart';

  // Dart dimensions (meters)
  // Tip: 0.03m, Barrel: 0.045m, Shaft: 0.04m, Flights: 0.035m. Total ~ 0.15m.
  // We orient dart along -Z so -Z is forward (the tip points towards -Z, facing the board when thrown forward).

  // 1. Steel needle point
  const tipGeo = new THREE.ConeGeometry(0.0012, 0.032, 16);
  tipGeo.rotateX(-Math.PI / 2);
  tipGeo.translate(0, 0, -0.016);
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.95,
    roughness: 0.15
  });
  const tipMesh = new THREE.Mesh(tipGeo, tipMat);
  dartGroup.add(tipMesh);

  // 2. Heavy tungsten / brass barrel with knurled grip rings
  const barrelGeo = new THREE.CylinderGeometry(0.0035, 0.0032, 0.048, 24);
  barrelGeo.rotateX(-Math.PI / 2);
  barrelGeo.translate(0, 0, 0.024);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: barrelColor,
    metalness: 0.85,
    roughness: 0.35
  });
  const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  dartGroup.add(barrelMesh);

  // Gripping ridges on barrel
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.3
  });
  for (let i = 0; i < 4; i++) {
    const ridgeGeo = new THREE.TorusGeometry(0.0036, 0.0004, 8, 16);
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.position.z = 0.012 + i * 0.008;
    dartGroup.add(ridge);
  }

  // 3. Polycarbonate / aluminum shaft (stem)
  const shaftGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.042, 12);
  shaftGeo.rotateX(-Math.PI / 2);
  shaftGeo.translate(0, 0, 0.069);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a24,
    metalness: 0.3,
    roughness: 0.4
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  dartGroup.add(shaftMesh);

  // 4. Aerodynamic 4-wing flights
  const flightMat = new THREE.MeshStandardMaterial({
    color: flightColor,
    roughness: 0.5,
    side: THREE.DoubleSide
  });

  const flightShape = new THREE.Shape();
  flightShape.moveTo(0, 0);
  flightShape.lineTo(0.016, 0.008);
  flightShape.lineTo(0.016, 0.038);
  flightShape.lineTo(0, 0.032);
  flightShape.closePath();

  const flightGeo = new THREE.ShapeGeometry(flightShape);
  flightGeo.center();
  flightGeo.rotateY(Math.PI / 2);

  // 4 wings at 90 degree angles
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Mesh(flightGeo, flightMat);
    wing.rotation.z = (i * Math.PI) / 2;
    wing.position.z = 0.098;
    dartGroup.add(wing);
  }

  // Shadow casting
  dartGroup.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return dartGroup;
}

export class Dart {
  constructor(index = 0) {
    this.index = index;
    // Color variants for darts
    const colors = [0xe63946, 0x3a86ff, 0xffbe0b];
    this.mesh = createDartMesh(colors[index % colors.length]);

    this.state = 'READY'; // 'READY', 'HELD', 'FLIGHT', 'STUCK', 'BOUNCED'
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.previousTipPos = new THREE.Vector3();
    this.currentTipPos = new THREE.Vector3();

    this.hitResult = null;
    this.embeddedOffset = new THREE.Vector3();

    // Gravity for dart flight (tuned for realistic darts feel)
    this.gravity = new THREE.Vector3(0, -9.2, 0);

    // Tip position relative to dart origin
    this.tipLocalOffset = new THREE.Vector3(0, 0, -0.032);
  }

  getTipWorldPos() {
    return this.mesh.localToWorld(this.tipLocalOffset.clone());
  }

  reset(position, rotation) {
    this.state = 'READY';
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.hitResult = null;
    this.mesh.visible = true;
    if (position) this.mesh.position.copy(position);
    if (rotation) this.mesh.rotation.copy(rotation);
  }

  hold() {
    this.state = 'HELD';
    this.velocity.set(0, 0, 0);
    this.hitResult = null;
  }

  throw(startPos, velocity) {
    this.state = 'FLIGHT';
    this.mesh.position.copy(startPos);
    this.velocity.copy(velocity);

    // Orient dart tip directly along velocity direction
    this.alignToVelocity(this.velocity);

    this.previousTipPos.copy(this.getTipWorldPos());
    this.currentTipPos.copy(this.previousTipPos);

    sounds.playWhoosh(velocity.length() / 10);
  }

  alignToVelocity(vel, slerpFactor = 1.0) {
    if (vel.lengthSq() < 0.01) return;
    const forward = vel.clone().normalize();
    // Dart mesh tip points at -Z in local space
    // So local -Z should map to forward vector, or local +Z to -forward
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, -1),
      forward
    );
    if (slerpFactor >= 1.0) {
      this.mesh.quaternion.copy(targetQuat);
    } else {
      this.mesh.quaternion.slerp(targetQuat, slerpFactor);
    }
  }

  update(delta, boardInfo, onHitCallback) {
    if (this.state === 'FLIGHT') {
      this.updateFlight(delta, boardInfo, onHitCallback);
    } else if (this.state === 'BOUNCED') {
      this.updateBounced(delta);
    }
  }

  updateFlight(delta, boardInfo, onHitCallback) {
    // 1. Gravity acceleration
    this.velocity.addScaledVector(this.gravity, delta);

    // 2. Previous tip position
    this.previousTipPos.copy(this.getTipWorldPos());

    // 3. Move dart
    this.mesh.position.addScaledVector(this.velocity, delta);

    // 4. Aerodynamic flight orientation (fins keep tail following trajectory)
    this.alignToVelocity(this.velocity, Math.min(1.0, delta * 20));

    // 5. Current tip position
    this.currentTipPos.copy(this.getTipWorldPos());

    // 6. Collision detection with Dartboard Plane
    // Board face is at boardInfo.frontZ, facing +Z
    const boardZ = boardInfo.frontZ;

    // Check if the tip crossed the board plane along -Z
    if (this.previousTipPos.z >= boardZ && this.currentTipPos.z <= boardZ) {
      // Linear interpolation to find the exact hit point on the Z = boardZ plane
      const t = (boardZ - this.previousTipPos.z) / (this.currentTipPos.z - this.previousTipPos.z);
      const hitWorld = new THREE.Vector3().lerpVectors(this.previousTipPos, this.currentTipPos, t);

      // Dartboard center coordinates
      const boardCenter = boardInfo.group.position;
      const localX = hitWorld.x - boardCenter.x;
      const localY = hitWorld.y - boardCenter.y;
      const radius = Math.sqrt(localX * localX + localY * localY);

      // Check if it hit the board or surround
      if (radius <= DARTBOARD_SPECS.SURROUND_RADIUS) {
        const scoreData = getScoreAtLocal(localX, localY);
        this.hitResult = scoreData;
        this.state = 'STUCK';

        // Embed the tip slightly into the board (10mm)
        const embedDepth = 0.012;
        this.mesh.position.z -= (this.currentTipPos.z - (boardZ - embedDepth));

        // Audio trigger
        if (scoreData.type === 'WALL_MISS' || scoreData.type === 'SURROUND') {
          sounds.playWood();
        } else {
          sounds.playThud();
          if (scoreData.isBull || scoreData.score >= 50) {
            sounds.playFanfare();
          } else {
            sounds.playScoreChime(scoreData.score);
          }
        }

        if (onHitCallback) {
          onHitCallback(this, scoreData, hitWorld);
        }
        return;
      } else {
        // Hit outside the surround - bounce off wall
        sounds.playWood();
        this.state = 'BOUNCED';
        this.velocity.z = Math.abs(this.velocity.z) * 0.3; // reflect back
        this.velocity.y *= 0.5;
        this.velocity.x += (Math.random() - 0.5) * 2;
        this.angularVelocity.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
      }
    }

    // Floor collision
    if (this.mesh.position.y <= 0.05) {
      this.mesh.position.y = 0.05;
      this.state = 'BOUNCED';
      this.velocity.set(0, 0, 0);
      sounds.playBounce();
    }
  }

  updateBounced(delta) {
    if (this.mesh.position.y > 0.05) {
      this.velocity.addScaledVector(this.gravity, delta);
      this.mesh.position.addScaledVector(this.velocity, delta);

      this.mesh.rotation.x += this.angularVelocity.x * delta;
      this.mesh.rotation.y += this.angularVelocity.y * delta;
      this.mesh.rotation.z += this.angularVelocity.z * delta;

      if (this.mesh.position.y <= 0.05) {
        this.mesh.position.y = 0.05;
        this.velocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        sounds.playBounce();
      }
    }
  }
}
