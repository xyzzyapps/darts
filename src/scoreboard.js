import * as THREE from 'three';

export class Scoreboard {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 16;

    this.group = new THREE.Group();
    this.group.name = 'Scoreboard';

    // Board dimensions
    const width = 0.65;
    const height = 0.85;
    const depth = 0.025;

    // Wooden Frame / Backing
    const frameGeo = new THREE.BoxGeometry(width + 0.04, height + 0.04, depth);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2b1d0c, // Rich dark mahogany wood frame
      roughness: 0.6
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.castShadow = true;
    this.group.add(frameMesh);

    // Chalkboard / LED screen surface
    const screenGeo = new THREE.PlaneGeometry(width, height);
    const screenMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.85,
      metalness: 0.05
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.z = depth / 2 + 0.002;
    this.group.add(screenMesh);

    // Position on wall to the left of the dartboard
    this.group.position.set(-0.75, 1.73, 0.04);

    // 3D Interactive Buttons attached to the board
    this.interactiveObjects = [];
    this.createButtons(width, height, depth);

    // Initial render of the scoreboard
    this.render({
      mode: '301',
      score: 301,
      darts: [],
      currentRoundScore: 0,
      roundNumber: 1,
      stats: { totalThrows: 0, highestTurn: 0, average: '0.0' },
      announcement: 'GAME ON!'
    });
  }

  createButtons(width, height, depth) {
    const btnMatNormal = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });
    const btnMatHover = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });

    const buttonsData = [
      { id: 'nextTurn', label: 'NEXT TURN', x: -0.18, y: -0.32 },
      { id: 'resetGame', label: 'RESET', x: 0, y: -0.32 },
      { id: 'switchMode', label: 'MODE', x: 0.18, y: -0.32 }
    ];

    buttonsData.forEach(b => {
      const geo = new THREE.BoxGeometry(0.14, 0.05, 0.02);
      const mesh = new THREE.Mesh(geo, btnMatNormal.clone());
      mesh.position.set(b.x, b.y, depth / 2 + 0.015);
      mesh.userData = {
        isButton: true,
        buttonId: b.id,
        label: b.label,
        normalMat: mesh.material,
        hoverMat: btnMatHover
      };
      this.group.add(mesh);
      this.interactiveObjects.push(mesh);
    });
  }

  render(gameState) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background: Dark pub chalkboard slate with subtle gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#10141a');
    grad.addColorStop(1, '#090c10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, w - 30, h - 30);

    // Header Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VR DARTS CHAMPIONSHIP', w / 2, 70);

    // Mode Badge
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 140, 95, 280, 42, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`MODE: ${gameState.mode.toUpperCase()}`, w / 2, 124);

    // Main Big Score
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 120px "Arial Black", sans-serif';
    ctx.fillText(gameState.score.toString(), w / 2, 270);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px sans-serif';
    const scoreLabel = gameState.mode === 'around-clock' ? 'CURRENT TARGET SECTOR' : 'POINTS REMAINING';
    ctx.fillText(scoreLabel, w / 2, 310);

    // Divider line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 335);
    ctx.lineTo(w - 40, 335);
    ctx.stroke();

    // Current Turn Darts (3 Slots)
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`ROUND ${gameState.roundNumber} - DARTS`, w / 2, 375);

    const slotWidth = 260;
    const slotSpacing = 40;
    const startX = (w - (3 * slotWidth + 2 * slotSpacing)) / 2;

    for (let i = 0; i < 3; i++) {
      const sx = startX + i * (slotWidth + slotSpacing);
      const sy = 405;

      const dartInfo = gameState.darts[i];
      const isFilled = !!dartInfo;

      // Slot background
      ctx.fillStyle = isFilled ? '#1e293b' : '#0f172a';
      ctx.strokeStyle = isFilled ? '#38bdf8' : '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(sx, sy, slotWidth, 120, 12);
      ctx.fill();
      ctx.stroke();

      // Dart Number
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`DART ${i + 1}`, sx + 18, sy + 32);

      // Score Value
      ctx.textAlign = 'center';
      if (isFilled) {
        ctx.fillStyle = dartInfo.score > 0 ? '#4ade80' : '#f87171';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(dartInfo.label || `${dartInfo.score}`, sx + slotWidth / 2, sy + 75);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`+${dartInfo.score} pts`, sx + slotWidth / 2, sy + 104);
      } else {
        ctx.fillStyle = '#475569';
        ctx.font = 'italic 26px sans-serif';
        ctx.fillText(i === gameState.darts.length ? 'READY...' : '-', sx + slotWidth / 2, sy + 80);
      }
    }

    // Round Total Score Bar
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`ROUND TOTAL: +${gameState.currentRoundScore} PTS`, w / 2, 570);

    // Banner Announcement (e.g. "BULLSEYE!", "180!", "BUST!")
    if (gameState.announcement) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(60, 605, w - 120, 60, 12);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(gameState.announcement, w / 2, 647);
    }

    // Stats Section at bottom
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(40, 690);
    ctx.lineTo(w - 40, 690);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Throws: ${gameState.stats.totalThrows}`, 60, 730);
    ctx.fillText(`Avg: ${gameState.stats.average}`, 380, 730);
    ctx.fillText(`High Turn: ${gameState.stats.highestTurn}`, 680, 730);

    // 3D Buttons label indicators
    ctx.fillStyle = '#64748b';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ INTERACTIVE BUTTONS BELOW ▼', w / 2, 790);

    this.texture.needsUpdate = true;
  }
}
