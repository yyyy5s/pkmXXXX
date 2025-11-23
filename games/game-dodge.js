// 躲避游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let gameTime = 0;
  let dodged = 0;
  let gameRunning = false;
  let gameLoop = null;
  let spawnTimer = null;
  
  // 画布
  const canvas = document.getElementById('dodge-canvas');
  const ctx = canvas.getContext('2d');
  
  // 游戏配置
  canvas.width = 400;
  canvas.height = 600;
  
  // 玩家
  let player = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    radius: 15,
    speed: 5
  };
  
  // 障碍物数组
  let obstacles = [];
  
  // 触屏控制
  let touchX = player.x;
  
  // 生成障碍物
  function spawnObstacle() {
    if (!gameRunning) return;
    
    const baseSpeed = difficulty === 'easy' ? 2 : difficulty === 'hard' ? 5 : 3;
    const baseSpawnRate = difficulty === 'easy' ? 2000 : difficulty === 'hard' ? 800 : 1200;
    
    obstacles.push({
      x: Math.random() * (canvas.width - 40) + 20,
      y: -20,
      radius: 15 + Math.random() * 10,
      speed: baseSpeed + Math.random() * 2,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    });
    
    const spawnRate = Math.max(500, baseSpawnRate - gameTime * 10);
    spawnTimer = setTimeout(spawnObstacle, spawnRate);
  }
  
  // 更新
  function update() {
    if (!gameRunning) return;
    
    gameTime += 16; // 假设60fps
    
    // 更新玩家位置（跟随触屏）
    const targetX = touchX;
    player.x += (targetX - player.x) * 0.2; // 平滑移动
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    
    // 更新障碍物
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.y += obs.speed;
      
      // 检查碰撞
      const dx = player.x - obs.x;
      const dy = player.y - obs.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < player.radius + obs.radius) {
        // 碰撞，游戏结束
        endGame();
        return;
      }
      
      // 移除超出屏幕的障碍物
      if (obs.y > canvas.height + obs.radius) {
        obstacles.splice(i, 1);
        dodged++;
        score += 10;
      }
    }
    
    // 积分随时间增加
    score += 0.1;
    
    updateUI();
    draw();
  }
  
  // 绘制
  function draw() {
    // 清空画布
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制障碍物
    obstacles.forEach(obs => {
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fillStyle = obs.color;
      ctx.fill();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    
    // 绘制玩家
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#4ECDC4';
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = Math.floor(score);
    document.getElementById('time').textContent = Math.floor(gameTime / 1000);
    document.getElementById('dodged').textContent = dodged;
  }
  
  // 开始游戏
  function startGame() {
    // 加载游戏状态
    if (typeof loadGameState === 'function') {
      loadGameState();
      gameState = window.gameState;
    }
    
    // 加载宠物形象
    if (typeof loadPetSpriteToGame === 'function') {
      loadPetSpriteToGame('pet-container');
    }
    
    score = 0;
    gameTime = 0;
    dodged = 0;
    gameRunning = true;
    obstacles = [];
    
    player.x = canvas.width / 2;
    player.y = canvas.height - 50;
    touchX = player.x;
    
    updateUI();
    draw();
    
    gameLoop = setInterval(update, 16); // 60fps
    spawnObstacle();
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
    if (spawnTimer) {
      clearTimeout(spawnTimer);
      spawnTimer = null;
    }
    
    // 计算最终积分：基础分 + 时间分 + 躲避分
    const finalScore = Math.floor(score + gameTime / 10 + dodged * 20);
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('dodge', finalScore, difficulty);
      showGameEnd(result);
    } else {
      showGameEnd({
        score: finalScore,
        difficulty,
        rewards: { coins: 0, happiness: 0, energy: 0 },
        message: `游戏结束！积分：${finalScore}`
      });
    }
  }
  
  // 显示游戏结束界面
  function showGameEnd(result) {
    document.getElementById('final-score').textContent = result.score;
    document.getElementById('rewards-info').innerHTML = `
      <h4>获得奖励</h4>
      <p>💰 金币: +${result.rewards.coins}</p>
      <p>💕 快乐度: +${result.rewards.happiness}</p>
      <p>⚡ 体力: -${result.rewards.energy}</p>
    `;
    document.getElementById('game-end-modal').classList.remove('hidden');
  }
  
  // 重新开始
  function restartGame() {
    document.getElementById('game-end-modal').classList.add('hidden');
    startGame();
  }
  
  // 返回
  function returnToPlay() {
    // 使用路径辅助函数（如果可用），否则使用相对路径
    if (typeof getPagePath === 'function') {
      window.location.href = getPagePath('play.html');
    } else {
      // 计算相对路径
      const path = window.location.pathname;
      const depth = path.split('/').filter(p => p && !p.endsWith('.html')).length;
      const base = depth > 0 ? '../'.repeat(depth) : '';
      window.location.href = base + 'play.html';
    }
  }
  
  // 触屏控制
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = touch.clientX - rect.left;
  });
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchX = touch.clientX - rect.left;
  });
  
  // 鼠标控制（桌面端）
  canvas.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    touchX = e.clientX - rect.left;
  });
  
  // 键盘控制
  let leftPressed = false;
  let rightPressed = false;
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = true;
    if (e.key === 'ArrowRight') rightPressed = true;
  });
  
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = false;
    if (e.key === 'ArrowRight') rightPressed = false;
  });
  
  // 键盘移动
  setInterval(() => {
    if (!gameRunning) return;
    
    if (leftPressed && touchX > 0) {
      touchX -= 5;
    }
    if (rightPressed && touchX < canvas.width) {
      touchX += 5;
    }
  }, 10);
  
  // 难度选择
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      difficulty = e.target.dataset.difficulty;
      if (gameRunning) {
        endGame();
        setTimeout(() => {
          restartGame();
        }, 100);
      }
    });
  });
  
  // 返回按钮
  document.getElementById('btn-back').addEventListener('click', returnToPlay);
  document.getElementById('btn-return').addEventListener('click', returnToPlay);
  document.getElementById('btn-restart').addEventListener('click', restartGame);
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
  } else {
    startGame();
  }
})();

