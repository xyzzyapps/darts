import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createDartboard, DARTBOARD_SPECS } from './dartboard.js';
import { Dart } from './dart.js';
import { createEnvironment } from './environment.js';
import { Scoreboard } from './scoreboard.js';
import { GameManager } from './game.js';
import { VRManager } from './vr-manager.js';
import { DesktopControls } from './desktop-controls.js';
import { ImpactParticles } from './particles.js';
import { sounds } from './audio.js';

class DartsGameApp {
  constructor() {
    this.container = document.getElementById('app');
    this.clock = new THREE.Clock();

    // Camera animation state for smooth cinematic transitions
    this.currentView = 'oche';
    this.cameraTargetPos = new THREE.Vector3(0, 1.70, DARTBOARD_SPECS.THROW_DISTANCE);
    this.cameraTargetLookAt = new THREE.Vector3(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.05);
    this.currentLookAt = new THREE.Vector3(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.05);
    this.isTransitioningCamera = false;
    this.autoZoomTimer = null;

    this.initScene();
    this.initEnvironment();
    this.initDartboard();
    this.initScoreboard();
    this.initDarts();
    this.initParticles();
    this.initGameManager();
    this.initVR();
    this.initDesktopControls();
    this.initUI();

    this.animate = this.animate.bind(this);
    this.renderer.setAnimationLoop(this.animate);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1117);
    this.scene.fog = new THREE.FogExp2(0x0e1117, 0.05);

    // Camera Rig allows clean WebXR offset and standard camera controls
    this.cameraRig = new THREE.Group();
    this.cameraRig.position.set(0, 0, 0);
    this.scene.add(this.cameraRig);

    // Standard player eye level at regulation oche (2.37m away, eye level 1.70m)
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 50);
    this.camera.position.copy(this.cameraTargetPos);
    this.camera.lookAt(this.cameraTargetLookAt);
    this.cameraRig.add(this.camera);

    // Renderer with WebXR enabled
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.xr.enabled = true;

    this.container.appendChild(this.renderer.domElement);

    // WebXR setup
    this.renderer.xr.setReferenceSpaceType('local-floor');

    // WebXR VR Button
    const vrBtn = VRButton.createButton(this.renderer);
    vrBtn.id = 'vr-button';
    document.body.appendChild(vrBtn);

    // Audio unlock on first user gesture (vital for mobile & iframes)
    const unlockAudio = () => {
      sounds.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });

    // Listen to WebXR session start / end to update UI mode indicator
    this.renderer.xr.addEventListener('sessionstart', () => {
      document.body.classList.add('vr-active');
      // In VR, position camera rig at regulation oche line (2.37m from board)
      this.cameraRig.position.set(0, 0, DARTBOARD_SPECS.THROW_DISTANCE);
      const modeIndicator = document.getElementById('mode-indicator');
      if (modeIndicator) modeIndicator.innerHTML = '🥽 <b>VR Mode Active</b> (Headset & Controllers)';
      if (this.desktopControls) this.desktopControls.setView('vr');
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      document.body.classList.remove('vr-active');
      this.cameraRig.position.set(0, 0, 0);
      const modeIndicator = document.getElementById('mode-indicator');
      if (modeIndicator) modeIndicator.innerHTML = '🎮 <b>3D Browser Mode</b> (Touch & Mouse)';
      this.setCameraView('oche');
    });

    // OrbitControls for inspecting the scene in Free 3D view
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.target.copy(this.cameraTargetLookAt);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 + 0.1;
    this.orbitControls.minDistance = 0.5;
    this.orbitControls.maxDistance = 6.0;
    this.orbitControls.enabled = false;
  }

  initEnvironment() {
    this.env = createEnvironment(this.scene);
  }

  initDartboard() {
    this.dartboard = createDartboard();
    this.scene.add(this.dartboard.group);
  }

  initScoreboard() {
    this.scoreboard = new Scoreboard();
    this.scene.add(this.scoreboard.group);
  }

  initDarts() {
    this.darts = [new Dart(0), new Dart(1), new Dart(2)];
    this.darts.forEach(dart => this.scene.add(dart.mesh));
    this.resetDartsToCaddy();
  }

  initParticles() {
    this.particles = new ImpactParticles(this.scene);
  }

  resetDartsToCaddy() {
    const tablePos = this.env.tablePos;
    const spacing = 0.05;

    this.darts.forEach((dart, i) => {
      const pos = new THREE.Vector3(
        tablePos.x - 0.05 + i * spacing,
        tablePos.y + 0.08,
        tablePos.z
      );
      const rot = new THREE.Euler(Math.PI / 2, 0, 0);
      dart.reset(pos, rot);
    });

    if (this.desktopControls && this.desktopControls.heldDartGroup) {
      this.desktopControls.heldDartGroup.visible = (this.currentView === 'oche');
    }
  }

  initGameManager() {
    this.gameManager = new GameManager(this.scoreboard, (state) => {
      this.updateHUD(state);

      // When turn finishes (3rd dart thrown), trigger auto-zoom to board
      if (state.isTurnFinished && !this.renderer.xr.isPresenting) {
        this.triggerEndTurnAutoZoom();
      }
    });
  }

  triggerEndTurnAutoZoom() {
    // If player is at the oche, zoom in to board after a brief delay
    if (this.currentView === 'oche') {
      if (this.autoZoomTimer) clearTimeout(this.autoZoomTimer);
      this.autoZoomTimer = setTimeout(() => {
        if (this.currentView === 'oche' && !this.renderer.xr.isPresenting) {
          this.setCameraView('zoom');
        }
      }, 900);
    }
  }

  initVR() {
    this.vrManager = new VRManager(
      this.renderer,
      this.scene,
      this.cameraRig,
      {
        getAvailableDart: () => this.getAvailableDart(),
        onLaunched: (dart) => {
          // VR dart launched
        }
      },
      (buttonId) => this.handleAction(buttonId),
      () => !this.gameManager.isTurnFinished && !this.gameManager.isGameOver
    );
  }

  initDesktopControls() {
    this.desktopControls = new DesktopControls(
      this.renderer.domElement,
      this.camera,
      (startPos, velocity) => {
        const dart = this.getAvailableDart();
        if (dart) {
          dart.throw(startPos, velocity);
        }
      },
      () => !this.gameManager.isTurnFinished && !this.gameManager.isGameOver,
      (buttonId) => this.handleAction(buttonId),
      this.scoreboard.interactiveObjects
    );

    // Add trajectory line to scene
    this.scene.add(this.desktopControls.trajectoryLine);
  }

  getAvailableDart() {
    return this.darts.find(d => d.state === 'READY') || null;
  }

  handleAction(actionId) {
    if (actionId === 'nextTurn') {
      this.nextTurn();
    } else if (actionId === 'resetGame') {
      this.resetDartsToCaddy();
      this.gameManager.resetGame();
    } else if (actionId === 'switchMode') {
      this.resetDartsToCaddy();
      this.gameManager.cycleMode();
    }
  }

  nextTurn() {
    if (this.autoZoomTimer) clearTimeout(this.autoZoomTimer);
    this.resetDartsToCaddy();
    this.gameManager.nextTurn();

    // If currently zoomed in, smoothly return to oche throw line
    if (this.currentView === 'zoom') {
      this.setCameraView('oche');
    }
  }

  initUI() {
    // Next Turn & Reset
    document.getElementById('btn-next-turn')?.addEventListener('click', () => this.nextTurn());
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.resetDartsToCaddy();
      this.gameManager.resetGame();
    });

    // Direct Throw Button
    document.getElementById('btn-throw-now')?.addEventListener('click', () => {
      this.desktopControls.throwDirect();
    });

    // Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', () => {
      const enabled = sounds.toggleSound();
      const soundBtn = document.getElementById('btn-sound');
      if (soundBtn) soundBtn.textContent = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    });

    // Throw style switcher: Flick vs Precision Power
    const throwStyleBtn = document.getElementById('btn-throw-style');
    if (throwStyleBtn) {
      throwStyleBtn.addEventListener('click', () => {
        const newStyle = this.desktopControls.throwMode === 'flick' ? 'power' : 'flick';
        this.desktopControls.setThrowMode(newStyle);
        throwStyleBtn.textContent = newStyle === 'flick' ? '👆 Mode: Flick Throw' : '🎯 Mode: Power Meter';
        document.getElementById('power-meter-container')?.classList.toggle('active', newStyle === 'power');
      });
    }

    // Trajectory arc toggle
    const trajectoryBtn = document.getElementById('btn-trajectory');
    if (trajectoryBtn) {
      trajectoryBtn.addEventListener('click', () => {
        const enabled = this.desktopControls.toggleTrajectory();
        trajectoryBtn.classList.toggle('active', enabled);
        trajectoryBtn.textContent = enabled ? '📐 Arc: ON' : '📐 Arc: OFF';
      });
    }

    // Fullscreen toggle
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Game mode selector
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.resetDartsToCaddy();
        this.gameManager.setMode(e.target.value);
      });
    }

    // Camera view switcher buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.setCameraView(view);
      });
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN' || e.code === 'Enter') {
        this.nextTurn();
      } else if (e.code === 'KeyR') {
        this.resetDartsToCaddy();
        this.gameManager.resetGame();
      } else if (e.code === 'KeyT') {
        const enabled = this.desktopControls.toggleTrajectory();
        const tBtn = document.getElementById('btn-trajectory');
        if (tBtn) {
          tBtn.classList.toggle('active', enabled);
          tBtn.textContent = enabled ? '📐 Arc: ON' : '📐 Arc: OFF';
        }
      } else if (e.code === 'Digit1') {
        this.setCameraView('oche');
      } else if (e.code === 'Digit2') {
        this.setCameraView('zoom');
      } else if (e.code === 'Digit3') {
        this.setCameraView('scoreboard');
      } else if (e.code === 'Digit4') {
        this.setCameraView('free');
      }
    });
  }

  setCameraView(viewName) {
    if (this.renderer.xr.isPresenting) return; // In VR, headset controls camera position

    this.currentView = viewName;
    this.isTransitioningCamera = true;

    if (viewName === 'oche') {
      this.orbitControls.enabled = false;
      this.cameraTargetPos.set(0, 1.70, DARTBOARD_SPECS.THROW_DISTANCE);
      this.cameraTargetLookAt.set(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.05);
    } else if (viewName === 'zoom') {
      this.orbitControls.enabled = false;
      this.cameraTargetPos.set(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.85);
      this.cameraTargetLookAt.set(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.05);
    } else if (viewName === 'scoreboard') {
      this.orbitControls.enabled = false;
      this.cameraTargetPos.set(-0.75, 1.73, 1.2);
      this.cameraTargetLookAt.set(-0.75, 1.73, 0.04);
    } else if (viewName === 'free') {
      this.orbitControls.enabled = true;
      this.cameraTargetPos.set(1.4, 1.6, 2.0);
      this.cameraTargetLookAt.set(0, DARTBOARD_SPECS.HEIGHT_FROM_FLOOR, 0.5);
      this.orbitControls.target.copy(this.cameraTargetLookAt);
    }

    if (this.desktopControls) {
      this.desktopControls.setView(viewName);
    }

    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewName);
    });

    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.display = (viewName === 'oche') ? 'block' : 'none';
    }

    const aimGuide = document.getElementById('aim-guide');
    if (aimGuide) {
      aimGuide.style.display = (viewName === 'oche') ? 'block' : 'none';
    }

    const throwNowBtn = document.getElementById('btn-throw-now');
    if (throwNowBtn) {
      throwNowBtn.style.display = (viewName === 'oche') ? 'inline-flex' : 'none';
    }
  }

  updateHUD(state) {
    const scoreValEl = document.getElementById('hud-score');
    if (scoreValEl) scoreValEl.textContent = state.score;

    const roundScoreEl = document.getElementById('hud-round-score');
    if (roundScoreEl) roundScoreEl.textContent = `+${state.currentRoundScore}`;

    const roundNumEl = document.getElementById('hud-round');
    if (roundNumEl) roundNumEl.textContent = state.roundNumber;

    const dartsListEl = document.getElementById('hud-darts-list');
    if (dartsListEl) {
      dartsListEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const d = state.darts[i];
        const span = document.createElement('span');
        span.className = 'dart-badge ' + (d ? (d.score > 0 ? 'hit' : 'miss') : 'empty');
        span.textContent = d ? `${d.label}` : `Dart ${i + 1}`;
        dartsListEl.appendChild(span);
      }
    }

    const bannerEl = document.getElementById('hud-banner');
    if (bannerEl) {
      if (state.announcement) {
        bannerEl.textContent = state.announcement;
        bannerEl.classList.add('visible');
      } else {
        bannerEl.classList.remove('visible');
      }
    }

    const nextBtn = document.getElementById('btn-next-turn');
    if (nextBtn) {
      nextBtn.classList.toggle('pulse', state.isTurnFinished);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    // Update Darts physics
    this.darts.forEach(dart => {
      dart.update(delta, this.dartboard, (hitDart, scoreData, hitPos) => {
        this.gameManager.registerHit(scoreData);
        // Spawn dust particles on board impact
        if (this.particles) {
          const isWall = (scoreData.type === 'WALL_MISS' || scoreData.type === 'SURROUND');
          this.particles.spawnImpact(hitPos, isWall);
        }
      });
    });

    // Update particles
    if (this.particles) {
      this.particles.update(delta);
    }

    // Smooth cinematic camera interpolation for desktop
    if (!this.renderer.xr.isPresenting && !this.orbitControls.enabled) {
      this.camera.position.lerp(this.cameraTargetPos, delta * 7);
      this.currentLookAt.lerp(this.cameraTargetLookAt, delta * 7);
      this.camera.lookAt(this.currentLookAt);
    }

    // Update VR controllers or Desktop controls
    if (this.renderer.xr.isPresenting) {
      this.vrManager.update(this.scoreboard.interactiveObjects);
    } else {
      if (this.orbitControls.enabled) {
        this.orbitControls.update();
      } else {
        this.desktopControls.update(delta);

        // Update Power meter UI bar
        if (this.desktopControls.throwMode === 'power') {
          const fill = document.getElementById('power-bar-fill');
          if (fill) {
            fill.style.width = `${Math.round(this.desktopControls.chargePower * 100)}%`;
          }
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new DartsGameApp();
});
