import * as THREE from 'three';
import { sounds } from './audio.js';
import { createDartMesh } from './dart.js';

export class DesktopControls {
  constructor(canvas, camera, onThrowDart, canThrowCheck, on3DButtonClick, interactiveButtons = []) {
    this.canvas = canvas;
    this.camera = camera;
    this.onThrowDart = onThrowDart;
    this.canThrowCheck = canThrowCheck;
    this.on3DButtonClick = on3DButtonClick;
    this.interactiveButtons = interactiveButtons;

    // Throwing mode: 'flick' or 'power'
    this.throwMode = 'flick';

    // Drag / Flick tracking
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0, time: 0 };
    this.dragCurrent = { x: 0, y: 0 };

    // Rolling pointer history for accurate release velocity calculation
    this.pointerHistory = [];

    // Aim & Crosshair
    this.crosshairNorm = new THREE.Vector2(0, 0);
    this.mouseScreen = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

    // Power Meter state
    this.isCharging = false;
    this.chargePower = 0.5; // 0.0 to 1.0
    this.chargeSpeed = 1.3;
    this.chargeDirection = 1;

    // Trajectory Guide
    this.showTrajectory = true;
    this.trajectoryLine = null;

    // First-person held dart viewmodel
    this.heldDartGroup = new THREE.Group();
    this.heldDartMesh = null;
    this.viewmodelOffset = new THREE.Vector3(0.16, -0.16, -0.38);
    this.viewmodelPullback = 0;
    this.activeView = 'oche';

    // Raycaster for clicking 3D buttons
    this.raycaster = new THREE.Raycaster();
    this.hoveredButton = null;

    this.initViewmodel();
    this.initTrajectoryGuide();
    this.initListeners();
  }

  initViewmodel() {
    this.heldDartMesh = createDartMesh(0xe63946, 0xd4af37);
    this.heldDartMesh.scale.set(0.85, 0.85, 0.85);
    this.heldDartGroup.add(this.heldDartMesh);
    this.heldDartGroup.position.copy(this.viewmodelOffset);
    this.camera.add(this.heldDartGroup);
  }

  initTrajectoryGuide() {
    const pointCount = 24;
    const positions = new Float32Array(pointCount * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.08,
      gapSize: 0.04,
      linewidth: 2,
      transparent: true,
      opacity: 0.65
    });

    this.trajectoryLine = new THREE.Line(geo, mat);
    this.trajectoryLine.computeLineDistances();
    this.trajectoryLine.visible = true;
  }

  setThrowMode(mode) {
    this.throwMode = mode;
    this.isCharging = false;
    this.isDragging = false;
  }

  toggleTrajectory() {
    this.showTrajectory = !this.showTrajectory;
    if (!this.showTrajectory && this.trajectoryLine) {
      this.trajectoryLine.visible = false;
    }
    return this.showTrajectory;
  }

  setView(viewName) {
    this.activeView = viewName;
    if (this.heldDartGroup) {
      this.heldDartGroup.visible = (viewName === 'oche');
    }
    if (this.trajectoryLine) {
      this.trajectoryLine.visible = (viewName === 'oche' && this.showTrajectory);
    }
  }

  initListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onPointerDown(e.clientX, e.clientY, e.button));
    window.addEventListener('mousemove', (e) => this.onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => this.onPointerUp(e.clientX, e.clientY));

    // Touch events for mobile/tablet browsers
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.onPointerDown(e.touches[0].clientX, e.touches[0].clientY, 0);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        this.onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      this.onPointerUp(this.dragCurrent.x, this.dragCurrent.y);
    });

    // Spacebar to charge & throw in power mode, or quick throw in flick mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        if (this.activeView !== 'oche') return;
        if (this.canThrowCheck && !this.canThrowCheck()) return;

        if (this.throwMode === 'power') {
          this.isCharging = true;
          this.chargePower = 0.2;
          sounds.playGrab();
        } else {
          // In flick mode, pressing space charges a smooth power throw
          this.isCharging = true;
          this.chargePower = 0.2;
          sounds.playGrab();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.isCharging) {
        this.isCharging = false;
        this.executePowerThrow(this.chargePower);
      }
    });
  }

  onPointerDown(clientX, clientY, button = 0) {
    if (button !== 0) return; // Only primary click

    // Check if clicking on an interactive 3D chalkboard button
    if (this.hoveredButton) {
      sounds.playGrab();
      if (this.on3DButtonClick) {
        this.on3DButtonClick(this.hoveredButton.userData.buttonId);
      }
      return;
    }

    if (this.activeView !== 'oche') return;
    if (this.canThrowCheck && !this.canThrowCheck()) return;

    this.isDragging = true;
    const now = performance.now();
    this.dragStart = { x: clientX, y: clientY, time: now };
    this.dragCurrent = { x: clientX, y: clientY };
    this.pointerHistory = [{ x: clientX, y: clientY, time: now }];

    if (this.throwMode === 'power') {
      this.isCharging = true;
      this.chargePower = 0.2;
      this.chargeDirection = 1;
    }

    sounds.playGrab();
  }

  onPointerMove(clientX, clientY) {
    this.dragCurrent = { x: clientX, y: clientY };
    this.mouseScreen.set(clientX, clientY);

    const now = performance.now();
    this.pointerHistory.push({ x: clientX, y: clientY, time: now });
    if (this.pointerHistory.length > 10) {
      this.pointerHistory.shift();
    }

    const rect = this.canvas.getBoundingClientRect();
    this.crosshairNorm.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.crosshairNorm.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.checkButtonHover();
  }

  checkButtonHover() {
    if (!this.interactiveButtons || this.interactiveButtons.length === 0) return;

    this.raycaster.setFromCamera(this.crosshairNorm, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveButtons, false);

    if (intersects.length > 0) {
      const hitBtn = intersects[0].object;
      if (this.hoveredButton !== hitBtn) {
        if (this.hoveredButton) {
          this.hoveredButton.material = this.hoveredButton.userData.normalMat;
        }
        this.hoveredButton = hitBtn;
        hitBtn.material = hitBtn.userData.hoverMat;
        this.canvas.style.cursor = 'pointer';
      }
    } else if (this.hoveredButton) {
      this.hoveredButton.material = this.hoveredButton.userData.normalMat;
      this.hoveredButton = null;
      this.canvas.style.cursor = 'default';
    }
  }

  onPointerUp(clientX, clientY) {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.throwMode === 'power') {
      if (this.isCharging) {
        this.isCharging = false;
        this.executePowerThrow(this.chargePower);
      }
      return;
    }

    // Flick Throw Mode:
    // Analyze recent pointer motion (over the last 120ms)
    const now = performance.now();
    let isUpwardFlick = false;
    let flickSpeedY = 0;
    let flickSpeedX = 0;

    if (this.pointerHistory.length >= 2) {
      // Find sample ~80-120ms ago
      const recentSamples = this.pointerHistory.filter(s => now - s.time <= 140);
      if (recentSamples.length >= 2) {
        const oldest = recentSamples[0];
        const latest = recentSamples[recentSamples.length - 1];
        const dt = Math.max(16, latest.time - oldest.time);
        const dy = latest.y - oldest.y; // Upward is negative dy
        const dx = latest.x - oldest.x;

        // Speed in px/ms (positive speedY means moving upward)
        const speedY = -dy / dt;
        const speedX = dx / dt;

        // If flicking upward with noticeable speed
        if (speedY > 0.35 || dy < -25) {
          isUpwardFlick = true;
          flickSpeedY = speedY;
          flickSpeedX = speedX;
        }
      }
    }

    if (isUpwardFlick) {
      // Execute flick throw with recorded gesture momentum
      const zSpeed = -Math.min(16, Math.max(9.5, flickSpeedY * 9.2));
      const yVel = Math.min(3.4, Math.max(0.6, flickSpeedY * 1.2));
      const xVel = flickSpeedX * 1.2;

      const worldHandPos = new THREE.Vector3();
      this.heldDartMesh.getWorldPosition(worldHandPos);
      const velocity = new THREE.Vector3(xVel, yVel, zSpeed);
      this.triggerThrow(worldHandPos, velocity);
    } else {
      // Direct Aim / Click Throw towards the aimed crosshair coordinate!
      // This guarantees that any simple click always throws the dart!
      this.executeAimClickThrow(this.crosshairNorm.x, this.crosshairNorm.y);
    }
  }

  // Quick explicit throw (e.g. from on-screen button or keypress)
  throwDirect() {
    if (this.activeView !== 'oche') return;
    if (this.canThrowCheck && !this.canThrowCheck()) return;
    this.executeAimClickThrow(this.crosshairNorm.x, this.crosshairNorm.y);
  }

  executePowerThrow(power) {
    this.raycaster.setFromCamera(this.crosshairNorm, this.camera);
    const targetZ = 0.05;
    const dir = this.raycaster.ray.direction;
    const origin = this.raycaster.ray.origin;

    const distZ = Math.abs(origin.z - targetZ);
    const powerRatio = power / 0.75;
    const flightTime = 0.20 / Math.max(0.5, powerRatio);
    const zSpeed = -distZ / flightTime;

    const targetX = origin.x + dir.x * (distZ / Math.abs(dir.z));
    const targetY = origin.y + dir.y * (distZ / Math.abs(dir.z));

    const worldHandPos = new THREE.Vector3();
    this.heldDartMesh.getWorldPosition(worldHandPos);

    const g = -9.2;
    let vy = (targetY - worldHandPos.y - 0.5 * g * flightTime * flightTime) / flightTime;
    let vx = (targetX - worldHandPos.x) / flightTime;

    const powerDeviation = power - 0.75;
    vy += powerDeviation * 1.8;

    const velocity = new THREE.Vector3(vx, vy, zSpeed);
    this.triggerThrow(worldHandPos, velocity);
  }

  executeAimClickThrow(normX, normY) {
    this.raycaster.setFromCamera(new THREE.Vector2(normX, normY), this.camera);
    const targetZ = 0.05;
    const dir = this.raycaster.ray.direction;
    const origin = this.raycaster.ray.origin;

    const distZ = Math.abs(origin.z - targetZ);
    const flightTime = 0.21;
    const zSpeed = -distZ / flightTime;

    const targetX = origin.x + dir.x * (distZ / Math.abs(dir.z));
    const targetY = origin.y + dir.y * (distZ / Math.abs(dir.z));

    const worldHandPos = new THREE.Vector3();
    this.heldDartMesh.getWorldPosition(worldHandPos);

    const g = -9.2;
    const vy = (targetY - worldHandPos.y - 0.5 * g * flightTime * flightTime) / flightTime;
    const vx = (targetX - worldHandPos.x) / flightTime;

    const velocity = new THREE.Vector3(vx, vy, zSpeed);
    this.triggerThrow(worldHandPos, velocity);
  }

  triggerThrow(startPos, velocity) {
    if (this.onThrowDart) {
      this.onThrowDart(startPos, velocity);
    }
    // Viewmodel throw recoil animation
    this.viewmodelPullback = -0.15;
  }

  update(delta) {
    // 1. Power meter oscillation
    if (this.isCharging) {
      this.chargePower += delta * this.chargeSpeed * this.chargeDirection;
      if (this.chargePower >= 1.0) {
        this.chargePower = 1.0;
        this.chargeDirection = -1;
      } else if (this.chargePower <= 0.1) {
        this.chargePower = 0.1;
        this.chargeDirection = 1;
      }
    }

    // 2. Viewmodel In-Hand Dart Animation
    if (this.activeView === 'oche') {
      const time = performance.now() * 0.001;

      // Subtle breathing idle sway
      const swayY = Math.sin(time * 2.2) * 0.003;
      const swayX = Math.cos(time * 1.4) * 0.002;

      // Pullback during aim / charge / drag
      let targetPullback = 0;
      if (this.isCharging) {
        targetPullback = this.chargePower * 0.08;
      } else if (this.isDragging) {
        const dy = Math.max(0, this.dragCurrent.y - this.dragStart.y);
        targetPullback = Math.min(0.09, dy * 0.0008);
      }

      this.viewmodelPullback = THREE.MathUtils.lerp(this.viewmodelPullback, targetPullback, delta * 14);

      // Apply to held dart position
      this.heldDartGroup.position.set(
        this.viewmodelOffset.x + swayX,
        this.viewmodelOffset.y + swayY,
        this.viewmodelOffset.z + this.viewmodelPullback
      );

      // Pitch slightly up when pulling back
      this.heldDartGroup.rotation.x = -this.viewmodelPullback * 2.0;

      // Update Trajectory Preview Line
      this.updateTrajectoryLine();
    }
  }

  updateTrajectoryLine() {
    if (!this.trajectoryLine || !this.showTrajectory || this.activeView !== 'oche') {
      if (this.trajectoryLine) this.trajectoryLine.visible = false;
      return;
    }

    const worldHandPos = new THREE.Vector3();
    this.heldDartMesh.getWorldPosition(worldHandPos);

    this.raycaster.setFromCamera(this.crosshairNorm, this.camera);
    const targetZ = 0.05;
    const dir = this.raycaster.ray.direction;
    const origin = this.raycaster.ray.origin;

    const distZ = Math.abs(origin.z - targetZ);
    const flightTime = 0.21;
    const zSpeed = -distZ / flightTime;

    const targetX = origin.x + dir.x * (distZ / Math.abs(dir.z));
    const targetY = origin.y + dir.y * (distZ / Math.abs(dir.z));

    const g = -9.2;
    const vy = (targetY - worldHandPos.y - 0.5 * g * flightTime * flightTime) / flightTime;
    const vx = (targetX - worldHandPos.x) / flightTime;
    const vel = new THREE.Vector3(vx, vy, zSpeed);

    const positions = this.trajectoryLine.geometry.attributes.position.array;
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = (i / (steps - 1)) * flightTime;
      const px = worldHandPos.x + vel.x * t;
      const py = worldHandPos.y + vel.y * t + 0.5 * g * t * t;
      const pz = worldHandPos.z + vel.z * t;

      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;
    }

    this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
    this.trajectoryLine.computeLineDistances();
    this.trajectoryLine.visible = true;
  }
}
