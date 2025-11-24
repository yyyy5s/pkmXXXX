// 打地鼠游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let level = 1;
  let hits = 0;
  let misses = 0;
  let gameRunning = false;
  let gameLoop = null;
  let moleTimer = null;
  let isReturning = false;
  let gameTime = 0;
  const GAME_DURATION = 60000; // 60秒
  
  // 地鼠洞
  const holes = [];
  let activeMole = null;
  
  // 连击系统
  let combo = 0;
  let lastHitTime = 0;
  const COMBO_TIMEOUT = 2000; // 2秒内连续命中才算连击
  
  // 初始化游戏
  function initGame() {
    const grid = document.getElementById('whack-grid');
    grid.innerHTML = '';
    holes.length = 0;
    
    // 创建9个洞
    for (let i = 0; i < 9; i++) {
      const hole = document.createElement('div');
      hole.className = 'whack-hole';
      hole.dataset.index = i;
      
      const mole = document.createElement('div');
      mole.className = 'whack-mole';
      mole.textContent = '🐹';
      hole.appendChild(mole);
      
      hole.addEventListener('click', () => whackMole(i));
      grid.appendChild(hole);
      holes.push({ element: hole, mole: mole, index: i });
    }
    
    score = 0;
    level = 1;
    hits = 0;
    misses = 0;
    gameTime = 0;
    activeMole = null;
    updateUI();
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('hits').textContent = hits;
    document.getElementById('misses').textContent = misses;
    document.getElementById('level').textContent = level;
  }
  
  // 显示地鼠
  function showMole() {
    if (!gameRunning) return;
    
    // 隐藏当前地鼠
    if (activeMole !== null) {
      holes[activeMole].mole.classList.remove('show');
      misses++;
      updateUI();
    }
    
    // 随机选择一个洞
    const randomIndex = Math.floor(Math.random() * holes.length);
    activeMole = randomIndex;
    holes[randomIndex].mole.classList.add('show');
    
    // 根据难度设置地鼠显示时间 - 所有模式都更快一点
    const baseTime = difficulty === 'easy' ? 1600 : difficulty === 'hard' ? 600 : 1200;
    const showTime = Math.max(400, baseTime - (level - 1) * 80);
    
    // 自动隐藏
    setTimeout(() => {
      if (activeMole === randomIndex && gameRunning) {
        holes[randomIndex].mole.classList.remove('show');
        misses++;
        updateUI();
        activeMole = null;
      }
    }, showTime);
  }
  
  // 打地鼠
  function whackMole(index) {
    if (!gameRunning) return;
    
    const currentTime = Date.now();
    
    if (activeMole === index && holes[index].mole.classList.contains('show')) {
      // 打中了
      hits++;
      const baseScore = 10 * level;
      
      // 连击系统
      if (currentTime - lastHitTime < COMBO_TIMEOUT) {
        combo++;
      } else {
        combo = 1;
      }
      lastHitTime = currentTime;
      
      // 连击加成
      const comboBonus = combo > 1 ? Math.floor(baseScore * (combo - 1) * 0.5) : 0;
      const totalScore = baseScore + comboBonus;
      score += totalScore;
      level = Math.floor(hits / 10) + 1;
      
      holes[index].mole.classList.add('hit');
      holes[index].mole.classList.remove('show');
      
      // 显示飘字 - 获取地鼠元素的位置
      const rect = holes[index].element.getBoundingClientRect();
      if (combo > 1) {
        showScorePopup(`+${totalScore} (${combo}x COMBO!)`, rect.left + rect.width / 2, rect.top, 'combo');
      } else {
        showScorePopup(`+${totalScore}`, rect.left + rect.width / 2, rect.top, 'positive');
      }
      
      setTimeout(() => {
        holes[index].mole.classList.remove('hit');
      }, 300);
      
      activeMole = null;
      updateUI();
      
      // 🎵 音效提示：这里可以添加打中音效
      // playSound('hit');
      
    } else {
      // 打空了
      combo = 0; // 打空重置连击
      score = Math.max(0, score - 5);
      
      // 显示飘字 - 获取点击位置
      const rect = holes[index].element.getBoundingClientRect();
      showScorePopup('-5', rect.left + rect.width / 2, rect.top, 'negative');
      
      updateUI();
      
      // 🎵 音效提示：这里可以添加打空音效
      // playSound('miss');
    }
  }
  
  // 显示分数飘字效果
  function showScorePopup(text, x, y, type) {
    const popup = document.createElement('div');
    popup.className = `score-popup ${type}`;
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    
    document.body.appendChild(popup);
    
    // 1秒后移除
    setTimeout(() => {
      if (document.body.contains(popup)) {
        document.body.removeChild(popup);
      }
    }, 1000);
  }
  
  // 游戏循环
  function update() {
    if (!gameRunning) return;
    
    gameTime += 16; // 假设60fps
    
    // 检查游戏时间
    if (gameTime >= GAME_DURATION) {
      endGame();
      return;
    }
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
    
    gameLoop = setInterval(update, 16); // 60fps
    
    // 开始显示地鼠
    const baseInterval = difficulty === 'easy' ? 2000 : difficulty === 'hard' ? 800 : 1500;
    const interval = Math.max(500, baseInterval - (level - 1) * 50);
    
    function scheduleNextMole() {
      if (!gameRunning) return;
      showMole();
      const nextInterval = Math.max(500, baseInterval - (level - 1) * 50);
      moleTimer = setTimeout(scheduleNextMole, nextInterval);
    }
    
    scheduleNextMole();
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    if (gameLoop) {
      clearInterval(gameLoop);
      gameLoop = null;
    }
    if (moleTimer) {
      clearTimeout(moleTimer);
      moleTimer = null;
    }
    
    // 隐藏所有地鼠
    holes.forEach(hole => {
      hole.mole.classList.remove('show', 'hit');
    });
    activeMole = null;
    
    // 计算最终积分
    const finalScore = score + hits * 5 - misses * 2;
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('whack', finalScore, difficulty);
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
    if (moleTimer) {
      clearTimeout(moleTimer);
      moleTimer = null;
    }
    
    // 检查游戏是否有积分或命中
    if (score > 0 || hits > 0) {
      // 有积分或命中，先结算
      isReturning = true;
      const finalScore = score + hits * 5 - misses * 2;
      if (typeof handleGameEnd === 'function') {
        const result = handleGameEnd('whack', finalScore, difficulty);
        showGameEnd(result);
      } else {
        // 兜底：直接返回
        isReturning = true;
        window.location.href = getPagePath('play.html');
      }
    } else {
      // 没有积分或命中，直接返回（不设置isReturning，因为马上就要跳转了）
      const path = typeof getPagePath === 'function' ? getPagePath('play.html') : '../play.html';
      window.location.href = path;
    }
  }
  
  // 从结算弹窗返回（结算弹窗的返回按钮）
  function returnFromModal() {
    window.location.href = getPagePath('play.html');
  }
  
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
