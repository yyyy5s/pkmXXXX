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
  let keyboardInterval = null;
  let isReturning = false;
  
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
  
  // 砖块回弹特效
  let brickAnimations = []; // 存储正在回弹的砖块动画
  
  // 连击系统
  let combo = 0; // 当前连击数
  let lastBrickHitTime = 0; // 上次消砖时间
  const COMBO_TIMEOUT = 1500; // 1.5秒内连续消砖才算连击
  
  // 预设关卡布局（10个关卡）
  // 1表示有砖块，0表示无砖块
  const levelLayouts = [
    // 关卡1 - 简单：完整5行
    [
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1]
    ],
    // 关卡2 - 简单：金字塔形
    [
      [0,0,0,0,0,0,0,0],
      [0,0,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1]
    ],
    // 关卡3 - 简单：倒金字塔
    [
      [1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,0,0],
      [0,0,0,0,0,0,0,0]
    ],
    // 关卡4 - 中等：中间空
    [
      [1,1,1,1,1,1,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,1,1,1,1,1,1]
    ],
    // 关卡5 - 中等：左右分离
    [
      [1,1,1,1,0,0,0,0],
      [1,1,1,1,0,0,0,0],
      [1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,1],
      [0,0,0,0,1,1,1,1]
    ],
    // 关卡6 - 中等：棋盘格
    [
      [1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1],
      [1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1],
      [1,0,1,0,1,0,1,0]
    ],
    // 关卡7 - 困难：X形
    [
      [1,0,0,0,0,0,0,1],
      [0,1,0,0,0,0,1,0],
      [0,0,1,1,1,1,0,0],
      [0,1,0,0,0,0,1,0],
      [1,0,0,0,0,0,0,1]
    ],
    // 关卡8 - 困难：边框
    [
      [1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1]
    ],
    // 关卡9 - 困难：双列
    [
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1],
      [1,1,0,0,0,0,1,1]
    ],
    // 关卡10 - 困难：复杂图案
    [
      [1,1,1,0,0,1,1,1],
      [1,0,1,0,0,1,0,1],
      [1,1,1,1,1,1,1,1],
      [0,0,1,0,0,1,0,0],
      [1,1,1,0,0,1,1,1]
    ]
  ];
  
  // 初始化砖块
  function initBricks() {
    brickArray = [];
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    const layout = levelLayouts[level - 1] || levelLayouts[0];
    
    for (let r = 0; r < layout.length; r++) {
      brickArray[r] = [];
      for (let c = 0; c < layout[r].length; c++) {
        if (layout[r][c] === 1) {
          brickArray[r][c] = {
            x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
            y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
            status: 1,
            color: colors[r % colors.length]
          };
        } else {
          brickArray[r][c] = {
            x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
            y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
            status: 0,
            color: colors[r % colors.length]
          };
        }
      }
    }
    
    // 计算砖块总数
    bricks = 0;
    for (let r = 0; r < brickArray.length; r++) {
      for (let c = 0; c < brickArray[r].length; c++) {
        if (brickArray[r][c].status === 1) {
          bricks++;
        }
      }
    }
  }
  
  // 初始化游戏
  function initGame() {
    paddle.x = (canvas.width - PADDLE_WIDTH) / 2;
    paddle.y = canvas.height - PADDLE_HEIGHT - 10;
    
    ball.x = canvas.width / 2;
    ball.y = canvas.height - PADDLE_HEIGHT - 20;
    
    // 清除所有动画和连击
    brickAnimations = [];
    combo = 0;
    lastBrickHitTime = 0;
    
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
    
    // 更新并绘制砖块回弹动画
    updateBrickAnimations();
    
    // 绘制砖块
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        if (brickArray[r][c].status === 1) {
          const brick = brickArray[r][c];
          const animation = brickAnimations.find(a => a.row === r && a.col === c);
          
          if (animation) {
            // 绘制回弹动画效果
            drawBrickWithAnimation(brick, animation);
          } else {
            // 正常绘制
            ctx.fillStyle = brick.color;
            ctx.fillRect(
              brick.x,
              brick.y,
              BRICK_WIDTH,
              BRICK_HEIGHT
            );
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(
              brick.x,
              brick.y,
              BRICK_WIDTH,
              BRICK_HEIGHT
            );
          }
        }
      }
    }
  }
  
  // 更新砖块回弹动画
  function updateBrickAnimations() {
    const now = Date.now();
    for (let i = brickAnimations.length - 1; i >= 0; i--) {
      const anim = brickAnimations[i];
      const elapsed = now - anim.startTime;
      
      if (elapsed >= anim.duration) {
        // 动画结束，移除
        brickAnimations.splice(i, 1);
      }
    }
  }
  
  // 绘制带动画的砖块
  function drawBrickWithAnimation(brick, animation) {
    const elapsed = Date.now() - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    
    // 回弹效果：先放大再缩小，同时有轻微的位移
    const scale = 1 + Math.sin(progress * Math.PI) * 0.3; // 0.3倍放大
    const offsetX = Math.sin(progress * Math.PI * 2) * 3; // 左右摆动
    const offsetY = -Math.sin(progress * Math.PI) * 2; // 向上回弹
    
    const centerX = brick.x + BRICK_WIDTH / 2;
    const centerY = brick.y + BRICK_HEIGHT / 2;
    const newWidth = BRICK_WIDTH * scale;
    const newHeight = BRICK_HEIGHT * scale;
    const newX = centerX - newWidth / 2 + offsetX;
    const newY = centerY - newHeight / 2 + offsetY;
    
    // 保存上下文
    ctx.save();
    
    // 绘制砖块（带缩放和位移）
    ctx.fillStyle = brick.color;
    ctx.fillRect(newX, newY, newWidth, newHeight);
    
    // 添加高光效果（回弹时更亮）
    const brightness = 1 + Math.sin(progress * Math.PI) * 0.5;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#FFF';
    ctx.fillRect(newX + 2, newY + 2, newWidth * 0.3, newHeight * 0.3);
    ctx.globalAlpha = 1;
    
    // 边框
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(newX, newY, newWidth, newHeight);
    
    // 恢复上下文
    ctx.restore();
  }
  
  // 添加砖块回弹动画
  function addBrickBounceAnimation(row, col) {
    // 移除该位置之前的动画（如果有）
    brickAnimations = brickAnimations.filter(a => !(a.row === row && a.col === col));
    
    // 添加新动画
    brickAnimations.push({
      row: row,
      col: col,
      startTime: Date.now(),
      duration: 200 // 200毫秒动画
    });
  }
  
  // 显示分数飘字效果
  function showScorePopup(text, x, y, type) {
    const popup = document.createElement('div');
    popup.className = `score-popup ${type}`;
    popup.textContent = text;
    
    // 获取画布在页面中的位置
    const rect = canvas.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${rect.left + x}px`;
    popup.style.top = `${rect.top + y}px`;
    popup.style.pointerEvents = 'none';
    popup.style.zIndex = '1000';
    popup.style.fontSize = 'var(--font-size-md)';
    popup.style.fontWeight = 'bold';
    popup.style.fontFamily = '"MuzaiPixel", "Press Start 2P", monospace';
    popup.style.textAlign = 'center';
    popup.style.whiteSpace = 'nowrap';
    popup.style.transition = 'all 0.8s ease-out';
    
    // 根据类型设置颜色
    if (type === 'combo') {
      popup.style.color = '#FFD700';
      popup.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.8)';
    } else if (type === 'positive') {
      popup.style.color = '#4ECDC4';
      popup.style.textShadow = '0 0 8px rgba(78, 205, 196, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.8)';
    } else {
      popup.style.color = '#FF6B6B';
      popup.style.textShadow = '0 0 8px rgba(255, 107, 107, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.8)';
    }
    
    document.body.appendChild(popup);
    
    // 触发动画
    requestAnimationFrame(() => {
      popup.style.transform = 'translateY(-40px) scale(1.2)';
      popup.style.opacity = '0';
    });
    
    // 1秒后移除
    setTimeout(() => {
      if (document.body.contains(popup)) {
        document.body.removeChild(popup);
      }
    }, 800);
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
            // 添加回弹特效
            addBrickBounceAnimation(r, c);
            
            // 连击系统
            const currentTime = Date.now();
            if (currentTime - lastBrickHitTime < COMBO_TIMEOUT) {
              combo++;
            } else {
              combo = 1; // 重置连击
            }
            lastBrickHitTime = currentTime;
            
            // 计算得分（连击加成）
            const baseScore = 10;
            const comboBonus = combo > 1 ? Math.floor(baseScore * (combo - 1) * 0.5) : 0;
            const totalScore = baseScore + comboBonus;
            score += totalScore;
            
            // 显示飘字提示
            const brickCenterX = b.x + BRICK_WIDTH / 2;
            const brickCenterY = b.y + BRICK_HEIGHT / 2;
            
            if (combo > 1) {
              // 显示连击提示
              showScorePopup(`${combo}x 连击！`, brickCenterX, brickCenterY, 'combo');
            } else {
              // 显示普通得分
              showScorePopup(`+${totalScore}`, brickCenterX, brickCenterY, 'positive');
            }
            
            ball.dy = -ball.dy;
            b.status = 0;
            bricks--;
            updateUI();
            
            // 检查是否完成关卡
            if (bricks === 0) {
              score += 100 * level;
              
              // 检查是否完成所有关卡
              if (level >= 10) {
                // 所有关卡完成，结束游戏
                setTimeout(() => {
                  endGame();
                }, 500);
              } else {
                // 进入下一关
                level++;
                setTimeout(() => {
                  initBricks();
                  initGame();
                  updateUI();
                }, 500);
              }
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
      // 重置连击
      combo = 0;
      lastBrickHitTime = 0;
      
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
    isReturning = false; // 重置返回标志
    
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
    if (keyboardInterval) {
      clearInterval(keyboardInterval);
      keyboardInterval = null;
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
      const finalScore = score + level * 50;
      if (typeof handleGameEnd === 'function') {
        const result = handleGameEnd('brick', finalScore, difficulty);
        showGameEnd(result, false);  // false表示未通关
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
    paddleX = touch.clientX - rect.left;
    // 限制范围，防止超出画布
    paddleX = Math.max(PADDLE_WIDTH / 2, Math.min(canvas.width - PADDLE_WIDTH / 2, paddleX));
  });
  
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
  });
  
  // 鼠标控制（桌面端）
  canvas.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;
    
    const rect = canvas.getBoundingClientRect();
    paddleX = e.clientX - rect.left;
    // 限制范围，防止超出画布
    paddleX = Math.max(PADDLE_WIDTH / 2, Math.min(canvas.width - PADDLE_WIDTH / 2, paddleX));
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
  keyboardInterval = setInterval(() => {
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
  document.getElementById('btn-return').addEventListener('click', returnFromModal);
  document.getElementById('btn-restart').addEventListener('click', restartGame);
  
  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGame);
  } else {
    startGame();
  }
})();

