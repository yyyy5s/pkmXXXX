// 三消游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let gameRunning = false;
  let isReturning = false;
  
  // 游戏数据
  const BOARD_SIZE = 8;
  const GEM_TYPES = 6; // 6种宝石
  const GEMS = ['💎', '💍', '🔮', '💠', '⭐', '✨'];
  
  let board = [];
  let selectedGem = null;
  let matches = 0;
  let combos = 0;
  let moves = 0;
  let isProcessing = false;
  
  // 初始化棋盘
  function initBoard() {
    board = [];
    
    // 生成初始棋盘，确保没有初始三连
    do {
      board = [];
      for (let i = 0; i < BOARD_SIZE; i++) {
        board[i] = [];
        for (let j = 0; j < BOARD_SIZE; j++) {
          board[i][j] = getRandomGem(i, j);
        }
      }
    } while (hasMatches());
    
    selectedGem = null;
    matches = 0;
    combos = 0;
    moves = 0;
    
    render();
    updateUI();
  }
  
  // 获取随机宝石（避免初始三连）
  function getRandomGem(row, col) {
    const excluded = [];
    
    // 检查水平方向
    if (col >= 2 && board[row] && board[row][col - 1] === board[row][col - 2]) {
      excluded.push(board[row][col - 1]);
    }
    
    // 检查垂直方向
    if (row >= 2 && board[row - 1] && board[row - 1][col] === board[row - 2][col]) {
      excluded.push(board[row - 1][col]);
    }
    
    const available = [];
    for (let i = 0; i < GEM_TYPES; i++) {
      if (!excluded.includes(i)) {
        available.push(i);
      }
    }
    
    if (available.length === 0) {
      return Math.floor(Math.random() * GEM_TYPES);
    }
    
    return available[Math.floor(Math.random() * available.length)];
  }
  
  // 检查是否有匹配
  function hasMatches() {
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (checkMatchAt(i, j).length > 0) {
          return true;
        }
      }
    }
    return false;
  }
  
  // 检查指定位置的匹配
  function checkMatchAt(row, col) {
    const gem = board[row][col];
    const matched = [{row, col}];
    
    // 检查水平方向
    let left = col - 1;
    while (left >= 0 && board[row][left] === gem) {
      matched.push({row, col: left});
      left--;
    }
    
    let right = col + 1;
    while (right < BOARD_SIZE && board[row][right] === gem) {
      matched.push({row, col: right});
      right++;
    }
    
    if (matched.length >= 3) {
      return matched;
    }
    
    // 检查垂直方向
    matched.length = 1;
    let up = row - 1;
    while (up >= 0 && board[up][col] === gem) {
      matched.push({row: up, col});
      up--;
    }
    
    let down = row + 1;
    while (down < BOARD_SIZE && board[down][col] === gem) {
      matched.push({row: down, col});
      down++;
    }
    
    if (matched.length >= 3) {
      return matched;
    }
    
    return [];
  }
  
  // 查找所有匹配
  function findAllMatches() {
    const allMatches = new Set();
    
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        const match = checkMatchAt(i, j);
        match.forEach(cell => {
          allMatches.add(`${cell.row},${cell.col}`);
        });
      }
    }
    
    return Array.from(allMatches).map(pos => {
      const [r, c] = pos.split(',').map(Number);
      return {row: r, col: c};
    });
  }
  
  // 渲染棋盘
  function render() {
    const boardElement = document.getElementById('match3-board');
    boardElement.innerHTML = '';
    
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        const gem = document.createElement('div');
        gem.className = 'match3-gem';
        gem.textContent = GEMS[board[i][j]];
        gem.dataset.row = i;
        gem.dataset.col = j;
        
        if (selectedGem && selectedGem.row === i && selectedGem.col === j) {
          gem.classList.add('selected');
        }
        
        gem.addEventListener('click', () => handleGemClick(i, j));
        
        boardElement.appendChild(gem);
      }
    }
  }
  
  // 处理宝石点击
  function handleGemClick(row, col) {
    if (!gameRunning || isProcessing) return;
    
    if (!selectedGem) {
      // 选择第一个宝石
      selectedGem = {row, col};
      render();
    } else {
      // 检查是否相邻
      const dr = Math.abs(selectedGem.row - row);
      const dc = Math.abs(selectedGem.col - col);
      
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        // 交换宝石
        swapGems(selectedGem.row, selectedGem.col, row, col);
      } else {
        // 选择新的宝石
        selectedGem = {row, col};
        render();
      }
    }
  }
  
  // 交换宝石
  function swapGems(r1, c1, r2, c2) {
    if (isProcessing) return;
    
    isProcessing = true;
    selectedGem = null;
    
    // 交换
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
    render();
    
    // 检查是否有匹配
    const match1 = checkMatchAt(r1, c1);
    const match2 = checkMatchAt(r2, c2);
    
    if (match1.length >= 3 || match2.length >= 3) {
      // 有匹配，处理消除
      moves++;
      updateUI();
      setTimeout(() => {
        processMatches();
      }, 200);
    } else {
      // 没有匹配，交换回来
      setTimeout(() => {
        [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
        render();
        isProcessing = false;
      }, 300);
    }
  }
  
  // 处理匹配
  function processMatches(comboCount = 0) {
    if (!gameRunning) {
      isProcessing = false;
      return;
    }
    
    const matchedCells = findAllMatches();
    
    if (matchedCells.length === 0) {
      // 没有匹配了，检查是否有可用移动
      isProcessing = false;
      updateUI();
      
      if (!hasValidMove()) {
        // 洗牌
        setTimeout(() => {
          if (gameRunning) {
            shuffleBoard();
          }
        }, 500);
      }
      return;
    }
    
    // 显示连锁效果
    if (comboCount > 0) {
      showCombo(comboCount);
      combos++;
    }
    
    // 标记匹配的宝石
    matchedCells.forEach(({row, col}) => {
      const gem = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (gem) {
        gem.classList.add('matched');
      }
    });
    
    // 计算得分
    const matchScore = matchedCells.length * 10;
    const comboBonus = comboCount * 50;
    score += matchScore + comboBonus;
    matches += matchedCells.length;
    updateUI();
    
    // 延迟后移除匹配的宝石
    setTimeout(() => {
      if (!gameRunning) {
        isProcessing = false;
        return;
      }
      
      // 移除匹配的宝石
      matchedCells.forEach(({row, col}) => {
        board[row][col] = -1; // 标记为空
      });
      
      // 下落
      dropGems();
      
      // 填充新宝石
      fillGems();
      
      render();
      
      // 检查连锁
      setTimeout(() => {
        if (!gameRunning) {
          isProcessing = false;
          return;
        }
        
        const newMatches = findAllMatches();
        if (newMatches.length > 0) {
          processMatches(comboCount + 1);
        } else {
          isProcessing = false;
          updateUI();
          
          // 检查是否有可用移动
          if (!hasValidMove()) {
            setTimeout(() => {
              if (gameRunning) {
                shuffleBoard();
              }
            }, 500);
          }
        }
      }, 300);
    }, 500);
  }
  
  // 宝石下落
  function dropGems() {
    for (let col = 0; col < BOARD_SIZE; col++) {
      let writePos = BOARD_SIZE - 1;
      
      for (let row = BOARD_SIZE - 1; row >= 0; row--) {
        if (board[row][col] !== -1) {
          if (writePos !== row) {
            board[writePos][col] = board[row][col];
            board[row][col] = -1;
          }
          writePos--;
        }
      }
    }
  }
  
  // 填充新宝石
  function fillGems() {
    for (let col = 0; col < BOARD_SIZE; col++) {
      for (let row = 0; row < BOARD_SIZE; row++) {
        if (board[row][col] === -1) {
          // 避免立即形成三连
          let gem;
          do {
            gem = Math.floor(Math.random() * GEM_TYPES);
            board[row][col] = gem;
          } while (checkMatchAt(row, col).length >= 3);
        }
      }
    }
  }
  
  // 检查是否有有效移动
  function hasValidMove() {
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        // 检查右侧交换
        if (j < BOARD_SIZE - 1) {
          [board[i][j], board[i][j + 1]] = [board[i][j + 1], board[i][j]];
          if (hasMatches()) {
            [board[i][j], board[i][j + 1]] = [board[i][j + 1], board[i][j]];
            return true;
          }
          [board[i][j], board[i][j + 1]] = [board[i][j + 1], board[i][j]];
        }
        
        // 检查下方交换
        if (i < BOARD_SIZE - 1) {
          [board[i][j], board[i + 1][j]] = [board[i + 1][j], board[i][j]];
          if (hasMatches()) {
            [board[i][j], board[i + 1][j]] = [board[i + 1][j], board[i][j]];
            return true;
          }
          [board[i][j], board[i + 1][j]] = [board[i + 1][j], board[i][j]];
        }
      }
    }
    
    return false;
  }
  
  // 洗牌
  function shuffleBoard() {
    if (!gameRunning || isProcessing) return;
    
    isProcessing = true;
    
    // 收集所有宝石
    const allGems = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        allGems.push(board[i][j]);
      }
    }
    
    // 打乱
    for (let i = allGems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allGems[i], allGems[j]] = [allGems[j], allGems[i]];
    }
    
    // 重新填充
    let index = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        board[i][j] = allGems[index++];
      }
    }
    
    // 确保没有初始匹配，最多尝试10次避免无限循环
    let attempts = 0;
    while (hasMatches() && attempts < 10) {
      for (let i = allGems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allGems[i], allGems[j]] = [allGems[j], allGems[i]];
      }
      index = 0;
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          board[i][j] = allGems[index++];
        }
      }
      attempts++;
    }
    
    render();
    isProcessing = false;
  }
  
  // 显示连锁效果
  function showCombo(count) {
    const comboEl = document.createElement('div');
    comboEl.className = 'match3-combo';
    comboEl.textContent = `${count}x 连锁！`;
    document.body.appendChild(comboEl);
    
    setTimeout(() => {
      if (document.body.contains(comboEl)) {
        document.body.removeChild(comboEl);
      }
    }, 1000);
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('matches').textContent = matches;
    document.getElementById('combos').textContent = combos;
    document.getElementById('moves').textContent = moves;
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
    gameRunning = true;
    isReturning = false;
    
    initBoard();
  }
  
  // 结束游戏（可以设置移动次数限制或时间限制）
  function endGame() {
    gameRunning = false;
    
    // 计算最终积分
    let finalScore = score;
    
    // 难度系数
    const difficultyMultipliers = {
      easy: 1.2,
      normal: 1.0,
      hard: 0.8
    };
    finalScore = Math.floor(finalScore * (difficultyMultipliers[difficulty] || 1.0));
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('match3', finalScore, difficulty);
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
    if (isReturning) return;
    
    gameRunning = false;
    
    if (score > 0) {
      isReturning = true;
      let finalScore = score;
      const difficultyMultipliers = {
        easy: 1.2,
        normal: 1.0,
        hard: 0.8
      };
      finalScore = Math.floor(finalScore * (difficultyMultipliers[difficulty] || 1.0));
      
      if (typeof handleGameEnd === 'function') {
        const result = handleGameEnd('match3', finalScore, difficulty);
        showGameEnd(result);
      } else {
        const path = typeof getPagePath === 'function' ? getPagePath('play.html') : '../play.html';
        window.location.href = path;
      }
    } else {
      const path = typeof getPagePath === 'function' ? getPagePath('play.html') : '../play.html';
      window.location.href = path;
    }
  }
  
  // 从结算弹窗返回
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
