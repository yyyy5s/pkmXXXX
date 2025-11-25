// 贪吃蛇游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let level = 1;
  let snakeLength = 3;
  let gameRunning = false;
  let gameLoop = null;
  let isReturning = false;
  
  // 画布
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  
  // 游戏配置
  const GRID_SIZE = 20;
  const COLS = Math.floor(400 / GRID_SIZE);
  const ROWS = Math.floor(400 / GRID_SIZE);
  canvas.width = COLS * GRID_SIZE;
  canvas.height = ROWS * GRID_SIZE;
  
  // 蛇
  let snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  
  // 生成食物
  function generateFood() {
    do {
      food.x = Math.floor(Math.random() * COLS);
      food.y = Math.floor(Math.random() * ROWS);
    } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
  }
  
  // 初始化游戏
  function initGame() {
    snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    snakeLength = 3;
    score = 0;
    level = 1;
    generateFood();
    updateUI();
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('length').textContent = snake.length;
    document.getElementById('level').textContent = level;
  }
  
  // 游戏循环
  function update() {
    if (!gameRunning) return;
    
    // 更新方向
    direction = { ...nextDirection };
    
    // 移动蛇头
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    
    // 检查碰撞
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      endGame();
      return;
    }
    
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      endGame();
      return;
    }
    
    snake.unshift(head);
    
    // 检查是否吃到食物
    if (head.x === food.x && head.y === food.y) {
      score += 10 * level;
      snakeLength++;
      level = Math.floor(snake.length / 5) + 1;
      generateFood();
    } else {
      // 保持蛇的长度
      if (snake.length > snakeLength) {
        snake.pop();
      }
    }
    
    updateUI();
    draw();
  }
  
  // 绘制 - 像素风格，可爱配色
  function draw() {
    // 清空画布 - 柔和的深紫色背景
    ctx.fillStyle = '#2D1B3D';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制网格 - 柔和的网格线
    ctx.strokeStyle = '#4A3A5A';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * GRID_SIZE, 0);
      ctx.lineTo(i * GRID_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * GRID_SIZE);
      ctx.lineTo(canvas.width, i * GRID_SIZE);
      ctx.stroke();
    }
    
    // 绘制食物 - 可爱的粉色/橙色方块（像小草莓）
    const foodX = food.x * GRID_SIZE;
    const foodY = food.y * GRID_SIZE;
    
    // 主方块 - 粉红色
    ctx.fillStyle = '#FF69B4';
    ctx.fillRect(foodX + 1, foodY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    
    // 高光（左上角小方块）- 更亮的粉色
    ctx.fillStyle = '#FFB6C1';
    ctx.fillRect(foodX + 2, foodY + 2, 4, 4);
    
    // 边框 - 深粉色
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 1;
    ctx.strokeRect(foodX + 1, foodY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    
    // 绘制蛇 - 可爱的青色/薄荷绿配色
    snake.forEach((segment, index) => {
      const segX = segment.x * GRID_SIZE;
      const segY = segment.y * GRID_SIZE;
      
      if (index === 0) {
        // 蛇头 - 可爱的薄荷绿/青色方块
        ctx.fillStyle = '#7FFFD4'; // 青绿色
        ctx.fillRect(segX + 1, segY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        
        // 高光 - 更亮的青色
        ctx.fillStyle = '#B0FFE6';
        ctx.fillRect(segX + 2, segY + 2, 4, 4);
        
        // 边框 - 深青色
        ctx.strokeStyle = '#40E0D0';
        ctx.lineWidth = 1;
        ctx.strokeRect(segX + 1, segY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        
        // 眼睛 - 两个可爱的深色小方块
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(segX + 4, segY + 4, 2, 2);
        ctx.fillRect(segX + GRID_SIZE - 6, segY + 4, 2, 2);
      } else {
        // 蛇身 - 柔和的青色系，越往后越深
        const darken = Math.min(40, index * 3);
        const baseR = 127; // 青色基础R值
        const baseG = 255; // 青色基础G值
        const baseB = 212; // 青色基础B值
        
        const r = Math.max(60, baseR - darken);
        const g = Math.max(180, baseG - darken);
        const b = Math.max(150, baseB - darken);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(segX + 1, segY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        
        // 边框 - 稍微深一点
        ctx.strokeStyle = `rgb(${Math.max(40, r - 20)}, ${Math.max(160, g - 20)}, ${Math.max(130, b - 20)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(segX + 1, segY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
      }
    });
  }
  
  // 改变方向
  function changeDirection(newDir) {
    // 防止反向移动
    if (newDir.x === -direction.x && newDir.y === -direction.y) {
      return;
    }
    nextDirection = newDir;
  }
  
  // 开始游戏
  function startGame() {
    if (gameRunning) return;
    
    // 加载游戏状态
    if (typeof loadGameState === 'function') {
      loadGameState();
      gameState = window.gameState;
    }
    
    // 加载宠物形象
    if (typeof loadPetSpriteToGame === 'function') {
      loadPetSpriteToGame('pet-container');
    }
    
    initGame();
    gameRunning = true;
    isReturning = false; // 重置返回标志
    
    // 贪吃蛇速度调慢
    const baseSpeed = difficulty === 'easy' ? 350 : difficulty === 'hard' ? 180 : 250;
    const speed = Math.max(120, baseSpeed - (level - 1) * 6);
    gameLoop = setInterval(update, speed);
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
    
    // 计算最终积分
    const finalScore = score + snake.length * 5;
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('snake', finalScore, difficulty);
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
    
    // 检查游戏是否有积分
    if (score > 0) {
      // 有积分，先结算
      isReturning = true;
      const finalScore = score + snake.length * 5;
      if (typeof handleGameEnd === 'function') {
        const result = handleGameEnd('snake', finalScore, difficulty);
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
  
  // 键盘控制
  document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        changeDirection({ x: -1, y: 0 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        changeDirection({ x: 1, y: 0 });
        break;
      case 'ArrowUp':
        e.preventDefault();
        changeDirection({ x: 0, y: -1 });
        break;
      case 'ArrowDown':
        e.preventDefault();
        changeDirection({ x: 0, y: 1 });
        break;
    }
  });
  
  // 按钮控制
  document.getElementById('btn-left')?.addEventListener('click', () => {
    if (gameRunning) changeDirection({ x: -1, y: 0 });
  });
  document.getElementById('btn-right')?.addEventListener('click', () => {
    if (gameRunning) changeDirection({ x: 1, y: 0 });
  });
  document.getElementById('btn-up')?.addEventListener('click', () => {
    if (gameRunning) changeDirection({ x: 0, y: -1 });
  });
  document.getElementById('btn-down')?.addEventListener('click', () => {
    if (gameRunning) changeDirection({ x: 0, y: 1 });
  });
  
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
  document.getElementById('btn-back')?.addEventListener('click', returnToPlay);
  document.getElementById('btn-return')?.addEventListener('click', returnFromModal);
  document.getElementById('btn-restart')?.addEventListener('click', restartGame);
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
  } else {
    startGame();
  }
})();

