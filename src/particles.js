import * as THREE from 'three';

export class ImpactParticles {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 60;
    this.particles = [];

    const geo = new THREE.SphereGeometry(0.003, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe8dec5, // Sisal fiber cream color
      transparent: true,
      opacity: 0.9
    });

    for (let i = 0; i < this.maxParticles; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4
      });
    }
  }

  spawnImpact(worldPos, isWall = false) {
    const count = 12;
    const color = isWall ? 0xa0522d : 0xe8dec5;

    let spawned = 0;
    for (let p of this.particles) {
      if (spawned >= count) break;
      if (!p.mesh.visible) {
        p.mesh.position.copy(worldPos);
        p.mesh.material.color.setHex(color);
        p.mesh.material.opacity = 0.9;
        p.mesh.visible = true;
        p.life = 0;
        p.maxLife = 0.3 + Math.random() * 0.2;

        // Burst outward from board plane (+Z) with spread
        p.velocity.set(
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.8,
          0.3 + Math.random() * 0.6
        );

        spawned++;
      }
    }
  }

  update(delta) {
    const gravity = -3.5;
    for (let p of this.particles) {
      if (p.mesh.visible) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.mesh.visible = false;
        } else {
          p.velocity.y += gravity * delta;
          p.mesh.position.addScaledVector(p.velocity, delta);
          p.mesh.material.opacity = Math.max(0, 1 - p.life / p.maxLife);
          const scale = 1 - (p.life / p.maxLife) * 0.5;
          p.mesh.scale.set(scale, scale, scale);
        }
      }
    }
  }
}
