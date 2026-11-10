import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { sounds } from './audio.js';

export class VRManager {
  constructor(renderer, scene, cameraRig, onDartThrown, onButtonClick, canThrowCheck) {
    this.renderer = renderer;
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.onDartThrown = onDartThrown;
    this.onButtonClick = onButtonClick;
    this.canThrowCheck = canThrowCheck;

    this.controllerModelFactory = new XRControllerModelFactory();

    // Two VR controllers
    this.controllers = [];
    this.controllerGrips = [];

    // Raycaster for 3D buttons interaction
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.hoveredButton = null;

    // Track active held dart per controller
    this.heldDarts = new Map(); // controller -> dart

    // Controller motion history for velocity calculation
    this.motionHistory = new Map();

    this.initControllers();
  }

  initControllers() {
    for (let i = 0; i < 2; i++) {
      // 1. Controller Ray / Event Node
      const controller = this.renderer.xr.getController(i);
      controller.userData.index = i;
      controller.userData.btnAPressed = false;
      controller.userData.btnBPressed = false;

      // Laser line for pointing at UI & aiming
      const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -2.4)
      ]);
      const laserMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55
      });
      const laserLine = new THREE.Line(laserGeo, laserMat);
      laserLine.name = 'LaserLine';
      laserLine.visible = true;
      controller.add(laserLine);

      // Controller reticle dot at end of laser
      const reticleGeo = new THREE.RingGeometry(0.008, 0.012, 16);
      const reticleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const reticle = new THREE.Mesh(reticleGeo, reticleMat);
      reticle.position.z = -2.4;
      controller.add(reticle);

      // Event listeners for Trigger and Grip (select and squeeze)
      controller.addEventListener('selectstart', e => this.onSelectStart(controller));
      controller.addEventListener('selectend', e => this.onSelectEnd(controller));
      controller.addEventListener('squeezestart', e => this.onSelectStart(controller));
      controller.addEventListener('squeezeend', e => this.onSelectEnd(controller));

      this.scene.add(controller);
      this.controllers.push(controller);
      this.motionHistory.set(controller, []);

      // 2. Controller Grip 3D Model
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(this.controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  // Trigger or Grip Pressed
  onSelectStart(controller) {
    // 1. Check if clicking an interactive 3D button on scoreboard
    if (this.hoveredButton) {
      this.triggerHaptic(controller, 0.6, 60);
      sounds.playGrab();
      if (this.onButtonClick) {
        this.onButtonClick(this.hoveredButton.userData.buttonId);
      }
      return;
    }

    // 2. Check if we can pick up / ready a dart
    if (!this.heldDarts.has(controller)) {
      if (this.canThrowCheck && !this.canThrowCheck()) return;

      const dart = this.onDartThrown ? this.onDartThrown.getAvailableDart() : null;
      if (dart) {
        dart.hold();
        controller.add(dart.mesh);
        // Position dart comfortably in VR hand grip
        dart.mesh.position.set(0, 0.02, -0.06);
        dart.mesh.rotation.set(0, 0, 0);
        this.heldDarts.set(controller, dart);

        this.triggerHaptic(controller, 0.4, 40);
        sounds.playGrab();
      }
    }
  }

  // Trigger or Grip Released -> Natural Physical Throw!
  onSelectEnd(controller) {
    const dart = this.heldDarts.get(controller);
    if (!dart) return;

    // Detach dart from controller and attach to world scene
    this.heldDarts.delete(controller);

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    dart.mesh.getWorldPosition(worldPos);
    dart.mesh.getWorldQuaternion(worldQuat);

    this.scene.add(dart.mesh);
    dart.mesh.position.copy(worldPos);
    dart.mesh.quaternion.copy(worldQuat);

    // Calculate release velocity from recent controller motion history
    const history = this.motionHistory.get(controller) || [];
    let throwVelocity = new THREE.Vector3(0, 0, -8.5);

    if (history.length >= 3) {
      const nowSample = history[history.length - 1];
      const prevSample = history[Math.max(0, history.length - 4)];
      const dt = (nowSample.time - prevSample.time) / 1000;

      if (dt > 0.005) {
        const vel = new THREE.Vector3().subVectors(nowSample.pos, prevSample.pos).divideScalar(dt);

        // Tuning factor for comfortable, natural VR throw feel in Quest
        const vrThrowBoost = 1.35;
        vel.multiplyScalar(vrThrowBoost);

        // Ensure sufficient forward momentum towards board (-Z)
        if (vel.z < -1.5) {
          throwVelocity.copy(vel);
        } else {
          // If released with relaxed motion, use controller forward orientation
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
          const speed = Math.max(8.0, vel.length() * 1.25);
          throwVelocity = forward.multiplyScalar(speed);
        }
      }
    }

    // Launch dart!
    dart.throw(worldPos, throwVelocity);
    this.triggerHaptic(controller, 0.8, 80);

    if (this.onDartThrown && this.onDartThrown.onLaunched) {
      this.onDartThrown.onLaunched(dart);
    }
  }

  // Oculus Touch Button 'A' / 'X' Quick Throw
  onButtonAPressed(controller) {
    if (this.heldDarts.has(controller)) {
      // Throw dart aimed directly along controller's pointing ray
      const dart = this.heldDarts.get(controller);
      this.heldDarts.delete(controller);

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      dart.mesh.getWorldPosition(worldPos);
      dart.mesh.getWorldQuaternion(worldQuat);

      this.scene.add(dart.mesh);
      dart.mesh.position.copy(worldPos);
      dart.mesh.quaternion.copy(worldQuat);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
      const throwVelocity = forward.multiplyScalar(11.5);

      dart.throw(worldPos, throwVelocity);
      this.triggerHaptic(controller, 0.7, 70);

      if (this.onDartThrown && this.onDartThrown.onLaunched) {
        this.onDartThrown.onLaunched(dart);
      }
    } else {
      // Pick up next ready dart
      this.onSelectStart(controller);
    }
  }

  triggerHaptic(controller, intensity = 0.5, durationMs = 50) {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    const inputSources = session.inputSources;
    const idx = controller.userData.index;
    if (inputSources && inputSources[idx] && inputSources[idx].gamepad) {
      const gamepad = inputSources[idx].gamepad;
      if (gamepad.hapticActuators && gamepad.hapticActuators[0]) {
        gamepad.hapticActuators[0].pulse(intensity, durationMs);
      }
    }
  }

  update(interactiveButtons = []) {
    const now = performance.now();
    const session = this.renderer.xr.getSession();

    for (const controller of this.controllers) {
      // 1. Record controller world position history for throw physics
      const worldPos = new THREE.Vector3();
      controller.getWorldPosition(worldPos);

      const history = this.motionHistory.get(controller);
      if (history) {
        history.push({ pos: worldPos, time: now });
        if (history.length > 10) history.shift();
      }

      // 2. Check Oculus gamepad buttons (Button 4 is 'A'/'X', Button 5 is 'B'/'Y')
      const inputSource = session?.inputSources?.[controller.userData.index];
      const gamepad = inputSource?.gamepad;
      if (gamepad && gamepad.buttons) {
        // Button 4 ('A' on right / 'X' on left Touch controller)
        const btnA = gamepad.buttons[4];
        if (btnA && btnA.pressed && !controller.userData.btnAPressed) {
          controller.userData.btnAPressed = true;
          this.onButtonAPressed(controller);
        } else if (btnA && !btnA.pressed) {
          controller.userData.btnAPressed = false;
        }

        // Button 5 ('B' on right / 'Y' on left Touch controller -> Next Turn)
        const btnB = gamepad.buttons[5];
        if (btnB && btnB.pressed && !controller.userData.btnBPressed) {
          controller.userData.btnBPressed = true;
          if (this.onButtonClick) {
            this.onButtonClick('nextTurn');
          }
        } else if (btnB && !btnB.pressed) {
          controller.userData.btnBPressed = false;
        }
      }

      // 3. Raycast against interactive 3D buttons (scoreboard buttons)
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

      const intersects = this.raycaster.intersectObjects(interactiveButtons, false);

      if (intersects.length > 0) {
        const hitBtn = intersects[0].object;
        if (this.hoveredButton !== hitBtn) {
          if (this.hoveredButton) {
            this.hoveredButton.material = this.hoveredButton.userData.normalMat;
          }
          this.hoveredButton = hitBtn;
          hitBtn.material = hitBtn.userData.hoverMat;
          this.triggerHaptic(controller, 0.2, 20);
        }
      } else if (this.hoveredButton) {
        this.hoveredButton.material = this.hoveredButton.userData.normalMat;
        this.hoveredButton = null;
      }
    }
  }
}
