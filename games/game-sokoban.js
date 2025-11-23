// 推箱子游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let level = 1;
  let moves = 0;
  let gameRunning = false;
  
  // 画布
  const canvas = document.getElementById('sokoban-canvas');
  const ctx = canvas.getContext('2d');
  
  // 游戏配置
  const TILE_SIZE = 30;
  const COLS = 12;
  const ROWS = 12;
  
  // 设置画布大小
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
  
  // 地图元素
  const WALL = 1;
  const FLOOR = 0;
  const BOX = 2;
  const TARGET = 3;
  const BOX_ON_TARGET = 4;
  const PLAYER = 5;
  
  // 关卡数据（简化版，3个关卡）
  const levels = [
    // 关卡1
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,2,0,0,0,0,0,0,0,1],
      [1,0,2,2,0,0,0,3,3,0,0,1],
      [1,0,0,0,0,0,0,3,3,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡2
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,3,3,0,1,1,0,3,3,0,1],
      [1,0,3,3,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,2,2,0,0,0,0,1],
      [1,1,0,0,0,2,2,0,0,0,1,1],
      [1,1,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡3
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,3,3,0,0,0,0,3,3,0,1],
      [1,0,3,3,0,1,1,0,3,3,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,2,0,0,0,0,2,2,0,1],
      [1,0,2,2,0,0,0,0,2,2,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ]
  ];
  
  let map = [];
  let playerX = 0;
  let playerY = 0;
  let targetCount = 0;
  
  // 初始化关卡
  function initLevel(levelIndex) {
    map = levels[levelIndex].map(row => [...row]);
    
    // 找到玩家位置
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (map[y][x] === PLAYER) {
          playerX = x;
          playerY = y;
          map[y][x] = FLOOR;
        }
        if (map[y][x] === TARGET || map[y][x] === BOX_ON_TARGET) {
          targetCount++;
        }
      }
    }
    
    moves = 0;
    updateUI();
    draw();
  }
  
  // 移动玩家
  function movePlayer(dx, dy) {
    if (!gameRunning) return;
    
    const newX = playerX + dx;
    const newY = playerY + dy;
    
    // 检查边界
    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) return;
    
    const nextTile = map[newY][newX];
    
    // 如果是墙，不能移动
    if (nextTile === WALL) return;
    
    // 如果是箱子
    if (nextTile === BOX || nextTile === BOX_ON_TARGET) {
      const boxNewX = newX + dx;
      const boxNewY = newY + dy;
      
      // 检查箱子能否移动
      if (boxNewX < 0 || boxNewX >= COLS || boxNewY < 0 || boxNewY >= ROWS) return;
      if (map[boxNewY][boxNewX] === WALL) return;
      if (map[boxNewY][boxNewX] === BOX || map[boxNewY][boxNewX] === BOX_ON_TARGET) return;
      
      // 移动箱子
      const wasOnTarget = map[newY][newX] === BOX_ON_TARGET;
      map[newY][newX] = wasOnTarget ? TARGET : FLOOR;
      
      const isOnTarget = map[boxNewY][boxNewX] === TARGET;
      map[boxNewY][boxNewX] = isOnTarget ? BOX_ON_TARGET : BOX;
    }
    
    // 移动玩家
    playerX = newX;
    playerY = newY;
    moves++;
    
    // 检查是否完成
    if (checkWin()) {
      completeLevel();
    }
    
    updateUI();
    draw();
  }
  
  // 检查是否胜利
  function checkWin() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (map[y][x] === TARGET) {
          return false; // 还有目标未完成
        }
      }
    }
    return true;
  }
  
  // 完成关卡
  function completeLevel() {
    // 计算积分：基础分 + 关卡奖励 - 步数惩罚
    const baseScore = level * 100;
    const moveBonus = Math.max(0, 500 - moves * 2);
    score += baseScore + moveBonus;
    
    level++;
    
    if (level > levels.length) {
      // 所有关卡完成
      endGame();
    } else {
      // 下一关
      initLevel(level - 1);
    }
  }
  
  // 绘制
  function draw() {
    // 清空画布
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = map[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        
        // 绘制地板
        if (tile !== WALL) {
          ctx.fillStyle = '#555';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        
        // 绘制目标点
        if (tile === TARGET || tile === BOX_ON_TARGET) {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // 绘制墙
        if (tile === WALL) {
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#654321';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        
        // 绘制箱子
        if (tile === BOX || tile === BOX_ON_TARGET) {
          ctx.fillStyle = tile === BOX_ON_TARGET ? '#90EE90' : '#D2691E';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
      }
    }
    
    // 绘制玩家
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(
      playerX * TILE_SIZE + TILE_SIZE / 2,
      playerY * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('moves').textContent = moves;
    
    // 计算剩余目标
    let remaining = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (map[y][x] === TARGET) remaining++;
      }
    }
    document.getElementById('targets').textContent = remaining;
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
    level = 1;
    moves = 0;
    gameRunning = true;
    
    initLevel(0);
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    
    // 计算最终积分
    const finalScore = score;
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('sokoban', finalScore, difficulty);
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
  let touchStartX = 0;
  let touchStartY = 0;
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
  });
  
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    
    const minSwipeDistance = 30;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平滑动
      if (Math.abs(dx) > minSwipeDistance) {
        if (dx > 0) {
          movePlayer(1, 0); // 右
        } else {
          movePlayer(-1, 0); // 左
        }
      }
    } else {
      // 垂直滑动
      if (Math.abs(dy) > minSwipeDistance) {
        if (dy > 0) {
          movePlayer(0, 1); // 下
        } else {
          movePlayer(0, -1); // 上
        }
      }
    }
  });
  
  // 键盘控制
  document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        movePlayer(-1, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        movePlayer(1, 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        movePlayer(0, -1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        movePlayer(0, 1);
        break;
    }
  });
  
  // 按钮控制
  document.getElementById('btn-up').addEventListener('click', () => movePlayer(0, -1));
  document.getElementById('btn-down').addEventListener('click', () => movePlayer(0, 1));
  document.getElementById('btn-left').addEventListener('click', () => movePlayer(-1, 0));
  document.getElementById('btn-right').addEventListener('click', () => movePlayer(1, 0));
  
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

