// 打砖块游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let lives = 3;
  let level = 1;
  let bricks = 0;
  let gameRunning = false;
  let gameLoop = null;
  
  // 画布
  const canvas = document.getElementById('brick-canvas');
  const ctx = canvas.getContext('2d');
  
  // 游戏配置
  const PADDLE_WIDTH = 80;
  const PADDLE_HEIGHT = 10;
  const BALL_RADIUS = 8;
  const BRICK_ROWS = 5;
  const BRICK_COLS = 8;
  const BRICK_WIDTH = 60;
  const BRICK_HEIGHT = 20;
  const BRICK_PADDING = 5;
  const BRICK_OFFSET_TOP = 50;
  const BRICK_OFFSET_LEFT = 35;
  
  // 设置画布大小
  canvas.width = 600;
  canvas.height = 400;
  
  // 游戏对象
  let paddle = { x: 0, y: 0, width: PADDLE_WIDTH, height: PADDLE_HEIGHT };
  let ball = { x: 0, y: 0, radius: BALL_RADIUS, dx: 0, dy: 0 };
  let brickArray = [];
  
  // 触屏控制
  let paddleX = 0;
  
  // 初始化砖块
  function initBricks() {
    brickArray = [];
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    
    for (let r = 0; r < BRICK_ROWS; r++) {
      brickArray[r] = [];
      for (let c = 0; c < BRICK_COLS; c++) {
        brickArray[r][c] = {
          x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
          y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
          status: 1,
          color: colors[r % colors.length]
        };
      }
    }
    bricks = BRICK_ROWS * BRICK_COLS;
  }
  
  // 初始化游戏
  function initGame() {
    paddle.x = (canvas.width - PADDLE_WIDTH) / 2;
    paddle.y = canvas.height - PADDLE_HEIGHT - 10;
    
    ball.x = canvas.width / 2;
    ball.y = canvas.height - PADDLE_HEIGHT - 20;
    
    // 根据难度设置球速
    const baseSpeed = difficulty === 'easy' ? 3 : difficulty === 'hard' ? 6 : 4;
    const angle = (Math.random() - 0.5) * Math.PI / 3; // -30到30度
    ball.dx = baseSpeed * Math.sin(angle);
    ball.dy = -baseSpeed * Math.cos(angle);
  }
  
  // 绘制
  function draw() {
    // 清空画布
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制挡板
    ctx.fillStyle = '#FFF';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    
    // 绘制球
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.closePath();
    
    // 绘制砖块
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (brickArray[r][c].status === 1) {
          ctx.fillStyle = brickArray[r][c].color;
          ctx.fillRect(
            brickArray[r][c].x,
            brickArray[r][c].y,
            BRICK_WIDTH,
            BRICK_HEIGHT
          );
          ctx.strokeStyle = '#FFF';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            brickArray[r][c].x,
            brickArray[r][c].y,
            BRICK_WIDTH,
            BRICK_HEIGHT
          );
        }
      }
    }
  }
  
  // 碰撞检测
  function collisionDetection() {
    // 砖块碰撞
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const b = brickArray[r][c];
        if (b.status === 1) {
          if (
            ball.x > b.x &&
            ball.x < b.x + BRICK_WIDTH &&
            ball.y > b.y &&
            ball.y < b.y + BRICK_HEIGHT
          ) {
            ball.dy = -ball.dy;
            b.status = 0;
            bricks--;
            score += 10;
            updateUI();
            
            // 检查是否完成关卡
            if (bricks === 0) {
              level++;
              score += 100 * level;
              initBricks();
              initGame();
              updateUI();
            }
          }
        }
      }
    }
    
    // 挡板碰撞
    if (
      ball.x > paddle.x &&
      ball.x < paddle.x + paddle.width &&
      ball.y > paddle.y &&
      ball.y < paddle.y + paddle.height
    ) {
      // 根据击中位置改变角度
      const hitPos = (ball.x - paddle.x) / paddle.width;
      const angle = (hitPos - 0.5) * Math.PI / 3; // -60到60度
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      ball.dx = speed * Math.sin(angle);
      ball.dy = -Math.abs(speed * Math.cos(angle));
    }
    
    // 墙壁碰撞
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
      ball.dx = -ball.dx;
    }
    if (ball.y - ball.radius < 0) {
      ball.dy = -ball.dy;
    }
    
    // 底部碰撞（失去生命）
    if (ball.y + ball.radius > canvas.height) {
      lives--;
      updateUI();
      
      if (lives === 0) {
        endGame();
      } else {
        initGame();
      }
    }
  }
  
  // 更新
  function update() {
    if (!gameRunning) return;
    
    // 更新挡板位置（跟随触屏）
    paddle.x = paddleX - PADDLE_WIDTH / 2;
    paddle.x = Math.max(0, Math.min(canvas.width - PADDLE_WIDTH, paddle.x));
    
    // 更新球位置
    ball.x += ball.dx;
    ball.y += ball.dy;
    
    collisionDetection();
    draw();
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('bricks').textContent = bricks;
    document.getElementById('level').textContent = level;
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
    lives = 3;
    level = 1;
    gameRunning = true;
    
    initBricks();
    initGame();
    updateUI();
    draw();
    
    gameLoop = setInterval(update, 16); // 60fps
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
    
    // 计算最终积分
    const finalScore = score + level * 50;
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('brick', finalScore, difficulty);
      showGameEnd(result, lives > 0);
    } else {
      showGameEnd({
        score: finalScore,
        difficulty,
        rewards: { coins: 0, happiness: 0, energy: 0 },
        message: `游戏结束！积分：${finalScore}`
      }, lives > 0);
    }
  }
  
  // 显示游戏结束界面
  function showGameEnd(result, won) {
    document.getElementById('end-title').textContent = won ? '恭喜通关！' : '游戏结束';
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
    paddleX = touch.clientX - rect.left;
  });
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
  });
  
  // 鼠标控制（桌面端）
  canvas.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    paddleX = e.clientX - rect.left;
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
  
  // 键盘移动挡板
  setInterval(() => {
    if (!gameRunning) return;
    
    if (leftPressed && paddleX > 0) {
      paddleX -= 5;
    }
    if (rightPressed && paddleX < canvas.width) {
      paddleX += 5;
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

