/**
 * confetti.js - K-Traditional Modern 순수 Canvas 메가 팡파레 물리 엔진
 * 오방색 + 전통 금박/비취 팔레트 기반 4단 연속 폭발
 */
(function () {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationId = null;

  // 전통 오방색 변형 + 골드 & 비취 팔레트
  const COLORS = [
    '#C59B27', // 황금(골드)
    '#D1493B', // 주홍 낙관(레드)
    '#2A7B62', // 비취 옥빛(청록)
    '#1B2A4A', // 기와 네이비(청)
    '#B45309', // 옻칠 앰버
    '#FAF8F5', // 백자/한지 백색
    '#E76F51', // 단청 살구
    '#C58B1E'  // 고궁 금박
  ];

  function initCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'celebrationCanvas';
      canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:99999;';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
  }

  function resize() {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  function createParticle(x, y, vx, vy, color, size, type) {
    return {
      x, y,
      vx, vy,
      color,
      size,
      type: type || 'square',
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      wobble: Math.random() * 10,
      opacity: 1,
      decay: Math.random() * 0.006 + 0.007
    };
  }

  function spawnBurst(x, y, count, speedMultiplier, angleBase, angleSpread) {
    for (let i = 0; i < count; i++) {
      const angle = angleBase + (Math.random() - 0.5) * angleSpread;
      const speed = (Math.random() * 12 + 6) * speedMultiplier;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const size = Math.random() * 8 + 6;
      const type = Math.random() > 0.45 ? 'square' : (Math.random() > 0.5 ? 'ribbon' : 'circle');
      particles.push(createParticle(x, y, vx, vy, color, size, type));
    }
    if (!animationId) loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98; // 공기 저항
      p.vy += 0.26; // 중력 가속도
      p.rotation += p.rotSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0 || p.y > canvas.height + 50) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;

      if (p.type === 'square') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (p.type === 'ribbon') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size * 1.8, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (particles.length > 0) {
      animationId = requestAnimationFrame(loop);
    } else {
      animationId = null;
    }
  }

  // 4단계 초대형 연속 축하 팡파레
  window.fireBigCelebration = function () {
    initCanvas();
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1단계: 좌하단 대포 발사
    spawnBurst(w * 0.1, h * 0.9, 80, 1.2, -Math.PI / 3, Math.PI / 4);

    // 2단계: 우하단 대포 발사 (120ms 후)
    setTimeout(() => {
      spawnBurst(w * 0.9, h * 0.9, 80, 1.2, (-2 * Math.PI) / 3, Math.PI / 4);
    }, 120);

    // 3단계: 중앙 대형 폭발 (300ms 후)
    setTimeout(() => {
      spawnBurst(w * 0.5, h * 0.45, 140, 1.5, -Math.PI / 2, Math.PI * 2);
    }, 300);

    // 4단계: 상단 글리터 샤워 (600ms 후)
    setTimeout(() => {
      spawnBurst(w * 0.3, h * 0.15, 60, 0.8, Math.PI / 2, Math.PI / 2);
      spawnBurst(w * 0.7, h * 0.15, 60, 0.8, Math.PI / 2, Math.PI / 2);
    }, 600);
  };
})();
