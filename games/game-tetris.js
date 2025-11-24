// 俄罗斯方块游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let level = 1;
  let lines = 0;
  let gameRunning = false;
  let gameLoop = null;
  let dropTimer = null;
  
  // 画布
  const canvas = document.getElementById('tetris-canvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next-canvas');
  const nextCtx = nextCanvas.getContext('2d');
  
  // 游戏配置
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 20;
  
  // 设置画布大小
  canvas.width = COLS * BLOCK_SIZE;
  canvas.height = ROWS * BLOCK_SIZE;
  nextCanvas.width = 80;
  nextCanvas.height = 80;
  
  // 方块形状定义
  const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[0,1,1],[1,1,0]], // S
    [[1,1,0],[0,1,1]], // Z
    [[1,0,0],[1,1,1]], // J
    [[0,0,1],[1,1,1]]  // L
  ];
  
  // 多彩渐变色方案
  const COLORS = [
    '#00E5FF', // I - 亮青色
    '#FFD700', // O - 金色
    '#BA55D3', // T - 中紫色
    '#32CD32', // S - 酸橙绿
    '#FF4500', // Z - 橙红色
    '#4169E1', // J - 皇家蓝
    '#FF8C00'  // L - 深橙色
  ];
  
  // 渐变色辅助函数
  function getGradientColor(ctx, x, y, width, height, baseColor) {
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    // 创建更亮的渐变
    const lightColor = lightenColor(baseColor, 30);
    const darkColor = darkenColor(baseColor, 20);
    gradient.addColorStop(0, lightColor);
    gradient.addColorStop(0.5, baseColor);
    gradient.addColorStop(1, darkColor);
    return gradient;
  }
  
  function lightenColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  
  function darkenColor(color, percent) {
    const num = parseInt(color.replace("#",""), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
    const b = Math.max(0, (num & 0x0000FF) - percent);
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  
  // 消除行动画
  let clearingRows = [];
  let clearAnimationFrame = null;
  
  // 游戏板
  let board = [];
  let currentPiece = null;
  let nextPiece = null;
  let currentX = 0;
  let currentY = 0;
  let currentColor = 0;
  
  // 初始化游戏板
  function initBoard() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  }
  
  // 创建新方块
  function createPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    return {
      shape: SHAPES[shapeIndex],
      color: COLORS[shapeIndex],
      colorIndex: shapeIndex
    };
  }
  
  // 旋转方块
  function rotatePiece(piece) {
    const rows = piece.shape.length;
    const cols = piece.shape[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        rotated[j][rows - 1 - i] = piece.shape[i][j];
      }
    }
    
    return {
      shape: rotated,
      color: piece.color,
      colorIndex: piece.colorIndex
    };
  }
  
  // 检查碰撞
  function checkCollision(piece, x, y) {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const newX = x + col;
          const newY = y + row;
          
          if (newX < 0 || newX >= COLS || newY >= ROWS) {
            return true;
          }
          
          if (newY >= 0 && board[newY][newX]) {
            return true;
          }
        }
      }
    }
    return false;
  }
  
  // 放置方块
  function placePiece() {
    for (let row = 0; row < currentPiece.shape.length; row++) {
      for (let col = 0; col < currentPiece.shape[row].length; col++) {
        if (currentPiece.shape[row][col]) {
          const y = currentY + row;
          const x = currentX + col;
          if (y >= 0) {
            board[y][x] = currentPiece.colorIndex + 1;
          }
        }
      }
    }
  }
  
  // 清除完整行（带动画）
  function clearLines() {
    clearingRows = [];
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row].every(cell => cell !== 0)) {
        clearingRows.push(row);
      }
    }
    
    if (clearingRows.length > 0) {
      // 开始消除动画
      animateClear();
    }
  }
  
  // 消除动画
  function animateClear() {
    let frame = 0;
    const maxFrames = 10;
    
    function animate() {
      frame++;
      const progress = frame / maxFrames;
      const alpha = 1 - progress;
      const scale = 1 - progress * 0.5;
      
      // 重绘游戏板，对消除行应用动画
      drawBoardWithClearAnimation(clearingRows, alpha, scale);
      
      if (frame < maxFrames) {
        clearAnimationFrame = requestAnimationFrame(animate);
      } else {
        // 动画完成，实际清除行
        for (const row of clearingRows.sort((a, b) => b - a)) {
          board.splice(row, 1);
          board.unshift(Array(COLS).fill(0));
        }
        
        lines += clearingRows.length;
        // 积分计算：消除行数 * 100 * 等级
        score += clearingRows.length * 100 * level;
        level = Math.floor(lines / 10) + 1;
        updateUI();
        
        clearingRows = [];
        draw();
      }
    }
    
    animate();
  }
  
  // 带消除动画的绘制
  function drawBoardWithClearAnimation(rowsToClear, alpha, scale) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制已放置的方块
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (board[row][col]) {
          if (rowsToClear.includes(row)) {
            // 消除行动画
            const px = col * BLOCK_SIZE;
            const py = row * BLOCK_SIZE;
            const offsetX = (BLOCK_SIZE - BLOCK_SIZE * scale) / 2;
            const offsetY = (BLOCK_SIZE - BLOCK_SIZE * scale) / 2;
            
            ctx.save();
            ctx.translate(px + BLOCK_SIZE / 2, py + BLOCK_SIZE / 2);
            ctx.scale(scale, scale);
            ctx.translate(-BLOCK_SIZE / 2, -BLOCK_SIZE / 2);
            drawBlock(ctx, col, row, COLORS[board[row][col] - 1], alpha);
            ctx.restore();
          } else {
            drawBlock(ctx, col, row, COLORS[board[row][col] - 1]);
          }
        }
      }
    }
    
    // 绘制当前方块
    if (currentPiece) {
      for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
          if (currentPiece.shape[row][col]) {
            drawBlock(ctx, currentX + col, currentY + row, currentPiece.color);
          }
        }
      }
    }
  }
  
  // 生成新方块
  function spawnPiece() {
    if (nextPiece) {
      currentPiece = nextPiece;
    } else {
      currentPiece = createPiece();
    }
    nextPiece = createPiece();
    
    currentX = Math.floor(COLS / 2) - Math.floor(currentPiece.shape[0].length / 2);
    currentY = 0;
    
    // 检查游戏结束
    if (checkCollision(currentPiece, currentX, currentY)) {
      endGame();
      return;
    }
    
    drawNext();
  }
  
  // 移动方块
  function movePiece(dx, dy) {
    if (!gameRunning || !currentPiece) return;
    
    const newX = currentX + dx;
    const newY = currentY + dy;
    
    if (!checkCollision(currentPiece, newX, newY)) {
      currentX = newX;
      currentY = newY;
      draw();
      return true;
    }
    
    // 如果向下移动失败，固定方块
    if (dy > 0) {
      placePiece();
      clearLines();
      spawnPiece();
    }
    
    return false;
  }
  
  // 旋转当前方块
  function rotateCurrentPiece() {
    if (!gameRunning || !currentPiece) return;
    
    const rotated = rotatePiece(currentPiece);
    if (!checkCollision(rotated, currentX, currentY)) {
      currentPiece = rotated;
      draw();
    }
  }
  
  // 硬降（直接到底）
  function hardDrop() {
    if (!gameRunning || !currentPiece) return;
    
    while (movePiece(0, 1)) {
      score += 2; // 硬降奖励
    }
    updateUI();
  }
  
  // 绘制方块（带渐变和阴影效果）
  function drawBlock(ctx, x, y, color, alpha = 1) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;
    
    // 绘制渐变背景
    const gradient = getGradientColor(ctx, px, py, BLOCK_SIZE, BLOCK_SIZE, color);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = alpha;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    
    // 绘制高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 4, BLOCK_SIZE / 3);
    
    // 绘制边框
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha;
    ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    
    // 绘制内边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
    
    ctx.globalAlpha = 1;
  }
  
  // 绘制游戏板
  function drawBoard() {
    // 绘制背景网格
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * BLOCK_SIZE, 0);
      ctx.lineTo(i * BLOCK_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * BLOCK_SIZE);
      ctx.lineTo(canvas.width, i * BLOCK_SIZE);
      ctx.stroke();
    }
    
    // 绘制已放置的方块
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (board[row][col]) {
          drawBlock(ctx, col, row, COLORS[board[row][col] - 1]);
        }
      }
    }
    
    // 绘制当前方块（带阴影预览）
    if (currentPiece) {
      // 绘制阴影
      let shadowY = currentY;
      while (!checkCollision(currentPiece, currentX, shadowY + 1)) {
        shadowY++;
      }
      if (shadowY > currentY) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let row = 0; row < currentPiece.shape.length; row++) {
          for (let col = 0; col < currentPiece.shape[row].length; col++) {
            if (currentPiece.shape[row][col]) {
              ctx.fillRect(
                (currentX + col) * BLOCK_SIZE,
                (shadowY + row) * BLOCK_SIZE,
                BLOCK_SIZE,
                BLOCK_SIZE
              );
            }
          }
        }
      }
      
      // 绘制当前方块
      for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
          if (currentPiece.shape[row][col]) {
            drawBlock(ctx, currentX + col, currentY + row, currentPiece.color);
          }
        }
      }
    }
  }
  
  // 绘制下一个方块
  function drawNext() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (!nextPiece) return;
    
    const blockSize = 15;
    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSize) / 2;
    
    for (let row = 0; row < nextPiece.shape.length; row++) {
      for (let col = 0; col < nextPiece.shape[row].length; col++) {
        if (nextPiece.shape[row][col]) {
          nextCtx.fillStyle = nextPiece.color;
          nextCtx.fillRect(
            offsetX + col * blockSize,
            offsetY + row * blockSize,
            blockSize,
            blockSize
          );
          nextCtx.strokeStyle = '#000';
          nextCtx.lineWidth = 1;
          nextCtx.strokeRect(
            offsetX + col * blockSize,
            offsetY + row * blockSize,
            blockSize,
            blockSize
          );
        }
      }
    }
  }
  
  // 绘制
  function draw() {
    drawBoard();
    drawNext();
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
  }
  
  // 游戏循环
  function gameTick() {
    if (!gameRunning) return;
    
    // 根据难度和等级调整下降速度
    const baseSpeed = difficulty === 'easy' ? 1000 : difficulty === 'hard' ? 300 : 600;
    const speed = Math.max(100, baseSpeed - (level - 1) * 50);
    
    if (dropTimer) clearTimeout(dropTimer);
    dropTimer = setTimeout(() => {
      movePiece(0, 1);
    }, speed);
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
    
    initBoard();
    score = 0;
    level = 1;
    lines = 0;
    gameRunning = true;
    currentPiece = null;
    nextPiece = null;
    
    spawnPiece();
    updateUI();
    draw();
    
    gameLoop = setInterval(gameTick, 100);
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
    if (dropTimer) {
      clearTimeout(dropTimer);
      dropTimer = null;
    }
    if (clearAnimationFrame) {
      cancelAnimationFrame(clearAnimationFrame);
      clearAnimationFrame = null;
    }
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('tetris', score, difficulty);
      showGameEnd(result);
    } else {
      showGameEnd({
        score,
        difficulty,
        rewards: { coins: 0, happiness: 0, energy: 0 },
        message: `游戏结束！积分：${score}`
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
  let touchStartTime = 0;
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
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
    const dt = Date.now() - touchStartTime;
    
    // 判断滑动方向
    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平滑动
      if (Math.abs(dx) > 30) {
        if (dx > 0) {
          movePiece(1, 0); // 右
        } else {
          movePiece(-1, 0); // 左
        }
      }
    } else {
      // 垂直滑动
      if (dy > 50) {
        movePiece(0, 1); // 下
      } else if (dy < -50) {
        hardDrop(); // 上 - 硬降
      }
    }
    
    // 点击旋转（短时间小距离）
    if (dt < 200 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      rotateCurrentPiece();
    }
  });
  
  // 键盘控制
  document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        movePiece(-1, 0);
        break;
      case 'ArrowRight':
        e.preventDefault();
        movePiece(1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        movePiece(0, 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        rotateCurrentPiece();
        break;
      case ' ':
        e.preventDefault();
        hardDrop();
        break;
    }
  });
  
  // 按钮控制
  document.getElementById('btn-left').addEventListener('click', () => movePiece(-1, 0));
  document.getElementById('btn-right').addEventListener('click', () => movePiece(1, 0));
  document.getElementById('btn-down').addEventListener('click', () => movePiece(0, 1));
  document.getElementById('btn-rotate').addEventListener('click', rotateCurrentPiece);
  
  // 难度选择
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      difficulty = e.target.dataset.difficulty;
      if (gameRunning) {
        // 如果游戏进行中，重新开始
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

