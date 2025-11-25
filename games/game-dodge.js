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
  let keyboardInterval = null;
  let isReturning = false;
  
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
    speed: 5,
    emoji: '' // 玩家表情符号
  };
  
  // 障碍物数组
  let obstacles = [];
  
  // 触屏控制
  let touchX = player.x;
  
  // 表情符号数组
  const playerEmojis = ['🎾', '🏀', '🥎', '🏐'];
  const obstacleEmojis = ['💣', '🔥', '⚡', '💥'];
  
  // 生成障碍物
  function spawnObstacle() {
    if (!gameRunning) return;
    
    // 所有模式速度都更快
    const baseSpeed = difficulty === 'easy' ? 3.5 : difficulty === 'hard' ? 7.5 : 4.5;
    const baseSpawnRate = difficulty === 'easy' ? 1200 : difficulty === 'hard' ? 500 : 700;
    
    obstacles.push({
      x: Math.random() * (canvas.width - 40) + 20,
      y: -20,
      radius: 15 + Math.random() * 10,
      speed: baseSpeed + Math.random() * 2,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      emoji: obstacleEmojis[Math.floor(Math.random() * obstacleEmojis.length)]
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
    
    // 绘制障碍物（使用表情符号）
    obstacles.forEach(obs => {
      ctx.font = `${obs.radius * 2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obs.emoji, obs.x, obs.y);
    });
    
    // 绘制玩家（使用表情符号）
    ctx.font = `${player.radius * 2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.emoji, player.x, player.y);
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
    isReturning = false; // 重置返回标志
    obstacles = [];
    
    player.x = canvas.width / 2;
    player.y = canvas.height - 50;
    player.emoji = playerEmojis[Math.floor(Math.random() * playerEmojis.length)];
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
    if (keyboardInterval) {
      clearInterval(keyboardInterval);
      keyboardInterval = null;
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
  
  // 返回（左上角返回按钮）
  function returnToPlay() {
    // 防止重复调用
    if (isReturning) return;
    
    // 清理所有资源
    gameRunning = false;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
    if (spawnTimer) {
      clearTimeout(spawnTimer);
      spawnTimer = null;
    }
    if (keyboardInterval) {
      clearInterval(keyboardInterval);
      keyboardInterval = null;
    }
    if (typeof animationId !== 'undefined' && animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    // 检查游戏是否有积分
    if (score > 0) {
      // 有积分，先结算
      isReturning = true;
      const finalScore = Math.floor(score + gameTime / 10 + dodged * 20);
      if (typeof handleGameEnd === 'function') {
        const result = handleGameEnd('dodge', finalScore, difficulty);
        showGameEnd(result);
      } else {
        // 兜底：直接返回
        isReturning = true;
        window.location.href = getPagePath('play.html');
      }
    } else {
      // 没有积分，直接返回（不设置isReturning，因为马上就要跳转了）
      const path = typeof getPagePath === 'function' ? getPagePath('play.html') : '../play.html';
      window.location.href = path;
    }
  }
  
  // 从结算弹窗返回（结算弹窗的返回按钮）
  function returnFromModal() {
    window.location.href = getPagePath('play.html');
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
  keyboardInterval = setInterval(() => {
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
  document.getElementById('btn-return').addEventListener('click', returnFromModal);
  document.getElementById('btn-restart').addEventListener('click', restartGame);
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
  } else {
    startGame();
  }
})();

