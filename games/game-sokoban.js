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
  
  // 关卡数据（10个关卡，难度递增）
  const levels = [
    // 关卡1 - 简单：2个箱子，宽敞空间
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,2,0,0,0,0,2,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,0,3,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡2 - 简单：2个箱子，有墙壁
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,1,1,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,0,3,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡3 - 简单：3个箱子
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡4 - 中等：3个箱子，有墙壁限制
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡5 - 中等：4个箱子
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,0,0,0,0,3,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡6 - 中等：4个箱子，复杂路径
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡7 - 困难：4个箱子，需要策略
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,3,3,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,0,0,0,0,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡8 - 困难：5个箱子
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,0,0,0,0,3,3,0,1],
      [1,0,0,0,0,0,0,0,3,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡9 - 困难：5个箱子，复杂布局
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,3,3,0,1],
      [1,0,3,0,0,0,0,0,3,5,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1]
    ],
    // 关卡10 - 困难：5个箱子，最复杂
    [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,0,0,0,0,0,0,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,0,2,0,1],
      [1,0,0,0,0,1,1,0,0,0,0,1],
      [1,0,2,0,0,0,0,0,3,3,0,1],
      [1,0,3,3,0,0,0,0,3,5,0,1],
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
  
  // 动画状态
  let animating = false;
  let animPlayerX = 0;
  let animPlayerY = 0;
  let animBoxX = -1;
  let animBoxY = -1;
  let animProgress = 0;
  
  // 移动玩家（带动画）
  function movePlayer(dx, dy) {
    if (!gameRunning || animating) return;
    
    const newX = playerX + dx;
    const newY = playerY + dy;
    
    // 检查边界
    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) return;
    
    const nextTile = map[newY][newX];
    
    // 如果是墙，不能移动
    if (nextTile === WALL) return;
    
    let boxMoved = false;
    let boxNewX = -1;
    let boxNewY = -1;
    
    // 如果是箱子
    if (nextTile === BOX || nextTile === BOX_ON_TARGET) {
      boxNewX = newX + dx;
      boxNewY = newY + dy;
      
      // 检查箱子能否移动
      if (boxNewX < 0 || boxNewX >= COLS || boxNewY < 0 || boxNewY >= ROWS) return;
      if (map[boxNewY][boxNewX] === WALL) return;
      if (map[boxNewY][boxNewX] === BOX || map[boxNewY][boxNewX] === BOX_ON_TARGET) return;
      
      boxMoved = true;
    }
    
    // 开始动画
    animating = true;
    animPlayerX = playerX;
    animPlayerY = playerY;
    animBoxX = boxMoved ? newX : -1;
    animBoxY = boxMoved ? newY : -1;
    animProgress = 0;
    
    // 动画循环
    const animate = () => {
      animProgress += 0.2;
      if (animProgress >= 1) {
        animProgress = 1;
        animating = false;
        
        // 实际移动
        if (boxMoved) {
          const wasOnTarget = map[newY][newX] === BOX_ON_TARGET;
          map[newY][newX] = wasOnTarget ? TARGET : FLOOR;
          
          const isOnTarget = map[boxNewY][boxNewX] === TARGET;
          map[boxNewY][boxNewX] = isOnTarget ? BOX_ON_TARGET : BOX;
        }
        
        playerX = newX;
        playerY = newY;
        moves++;
        
        // 检查是否完成
        if (checkWin()) {
          completeLevel();
        }
        
        updateUI();
      }
      
      draw();
      
      if (animating) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
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
    // 清空画布 - 使用清新的渐变背景
    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, '#E8F5E9');
    bgGradient.addColorStop(1, '#C8E6C9');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 设置emoji字体
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = map[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const centerX = px + TILE_SIZE / 2;
        const centerY = py + TILE_SIZE / 2;
        
        // 绘制地板（带纹理）
        if (tile !== WALL) {
          ctx.fillStyle = '#F1F8E9';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          // 添加网格线
          ctx.strokeStyle = 'rgba(129, 199, 132, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        
        // 绘制墙 - 使用砖块emoji
        if (tile === WALL) {
          ctx.fillStyle = '#8D6E63';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          // 绘制砖块emoji
          ctx.font = `${TILE_SIZE * 0.8}px Arial`;
          ctx.fillText('🧱', centerX, centerY);
        }
        
        // 绘制目标点 - 使用标记emoji
        if (tile === TARGET) {
          ctx.font = `${TILE_SIZE * 0.7}px Arial`;
          ctx.fillText('🎯', centerX, centerY);
        }
        
        // 绘制箱子（不在动画中）
        if (tile === BOX && !(x === animBoxX && y === animBoxY)) {
          ctx.font = `${TILE_SIZE * 0.8}px Arial`;
          ctx.fillText('📦', centerX, centerY);
        }
        
        // 绘制在目标点上的箱子 - 显示成功效果
        if (tile === BOX_ON_TARGET && !(x === animBoxX && y === animBoxY)) {
          // 先画目标点
          ctx.font = `${TILE_SIZE * 0.7}px Arial`;
          ctx.fillText('🎯', centerX, centerY);
          // 再画箱子，带绿色阴影表示成功
          ctx.shadowColor = '#4CAF50';
          ctx.shadowBlur = 5;
          ctx.font = `${TILE_SIZE * 0.8}px Arial`;
          ctx.fillText('📦', centerX, centerY);
          ctx.shadowBlur = 0;
        }
      }
    }
    
    // 绘制动画中的箱子
    if (animBoxX >= 0 && animBoxY >= 0) {
      const oldPx = animBoxX * TILE_SIZE + TILE_SIZE / 2;
      const oldPy = animBoxY * TILE_SIZE + TILE_SIZE / 2;
      const newPx = (animBoxX + (playerX - animPlayerX)) * TILE_SIZE + TILE_SIZE / 2;
      const newPy = (animBoxY + (playerY - animPlayerY)) * TILE_SIZE + TILE_SIZE / 2;
      const px = oldPx + (newPx - oldPx) * animProgress;
      const py = oldPy + (newPy - oldPy) * animProgress;
      
      ctx.font = `${TILE_SIZE * 0.8}px Arial`;
      ctx.fillText('📦', px, py);
    }
    
    // 绘制玩家（带动画）- 使用可爱的emoji
    const playerPx = animating 
      ? (animPlayerX + (playerX - animPlayerX) * animProgress) * TILE_SIZE + TILE_SIZE / 2
      : playerX * TILE_SIZE + TILE_SIZE / 2;
    const playerPy = animating
      ? (animPlayerY + (playerY - animPlayerY) * animProgress) * TILE_SIZE + TILE_SIZE / 2
      : playerY * TILE_SIZE + TILE_SIZE / 2;
    
    ctx.font = `${TILE_SIZE * 0.9}px Arial`;
    ctx.fillText('🐱', playerPx, playerPy);
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

