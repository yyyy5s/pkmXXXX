// 2048游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let moves = 0;
  let maxTile = 2;
  let gameRunning = false;
  let board = [];
  const SIZE = 4;
  
  // 初始化游戏板
  function initBoard() {
    board = Array(SIZE).fill().map(() => Array(SIZE).fill(0));
    addRandomTile();
    addRandomTile();
    render();
  }
  
  // 添加随机方块
  function addRandomTile() {
    const emptyCells = [];
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (board[i][j] === 0) {
          emptyCells.push({row: i, col: j});
        }
      }
    }
    
    if (emptyCells.length === 0) return false;
    
    const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    // 90%概率生成2，10%概率生成4
    board[cell.row][cell.col] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }
  
  // 移动行
  function moveRow(row) {
    // 移除0
    let filtered = row.filter(val => val !== 0);
    let merged = [];
    let i = 0;
    
    while (i < filtered.length) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
        // 合并
        const mergedValue = filtered[i] * 2;
        merged.push(mergedValue);
        score += mergedValue;
        if (mergedValue > maxTile) {
          maxTile = mergedValue;
        }
        i += 2;
      } else {
        merged.push(filtered[i]);
        i++;
      }
    }
    
    // 填充0
    while (merged.length < SIZE) {
      merged.push(0);
    }
    
    return merged;
  }
  
  // 移动
  function move(direction) {
    if (!gameRunning) return false;
    
    const prevBoard = board.map(row => [...row]);
    let moved = false;
    
    if (direction === 'left') {
      for (let i = 0; i < SIZE; i++) {
        board[i] = moveRow(board[i]);
        if (JSON.stringify(board[i]) !== JSON.stringify(prevBoard[i])) {
          moved = true;
        }
      }
    } else if (direction === 'right') {
      for (let i = 0; i < SIZE; i++) {
        board[i] = moveRow(board[i].reverse()).reverse();
        if (JSON.stringify(board[i]) !== JSON.stringify(prevBoard[i])) {
          moved = true;
        }
      }
    } else if (direction === 'up') {
      for (let j = 0; j < SIZE; j++) {
        const column = [];
        for (let i = 0; i < SIZE; i++) {
          column.push(board[i][j]);
        }
        const movedColumn = moveRow(column);
        for (let i = 0; i < SIZE; i++) {
          board[i][j] = movedColumn[i];
        }
        if (JSON.stringify(movedColumn) !== JSON.stringify(column)) {
          moved = true;
        }
      }
    } else if (direction === 'down') {
      for (let j = 0; j < SIZE; j++) {
        const column = [];
        for (let i = 0; i < SIZE; i++) {
          column.push(board[i][j]);
        }
        const movedColumn = moveRow(column.reverse()).reverse();
        for (let i = 0; i < SIZE; i++) {
          board[i][j] = movedColumn[i];
        }
        if (JSON.stringify(movedColumn) !== JSON.stringify(column)) {
          moved = true;
        }
      }
    }
    
    if (moved) {
      moves++;
      addRandomTile();
      render();
      updateUI();
      
      // 检查游戏结束
      if (isGameOver()) {
        endGame();
      }
    }
    
    return moved;
  }
  
  // 检查游戏是否结束
  function isGameOver() {
    // 检查是否有空格
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (board[i][j] === 0) return false;
      }
    }
    
    // 检查是否可以合并
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const current = board[i][j];
        if (
          (i < SIZE - 1 && board[i + 1][j] === current) ||
          (j < SIZE - 1 && board[i][j + 1] === current)
        ) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  // 渲染
  function render() {
    const boardElement = document.getElementById('game-board');
    boardElement.innerHTML = '';
    
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const cell = document.createElement('div');
        cell.className = 'game-2048-cell';
        const value = board[i][j];
        
        if (value !== 0) {
          cell.textContent = value;
          cell.classList.add(`tile-${value}`);
          if (value > 2048) {
            cell.classList.add('tile-super');
          }
        }
        
        boardElement.appendChild(cell);
      }
    }
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('max-tile').textContent = maxTile;
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
    
    board = [];
    score = 0;
    moves = 0;
    maxTile = 2;
    gameRunning = true;
    
    initBoard();
    updateUI();
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    
    // 计算最终积分（基础分 + 最高数字 * 10 + 移动次数）
    const finalScore = score + maxTile * 10 + moves * 5;
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('2048', finalScore, difficulty);
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
  
  const boardElement = document.getElementById('game-board');
  
  boardElement.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  });
  
  boardElement.addEventListener('touchmove', (e) => {
    e.preventDefault();
  });
  
  boardElement.addEventListener('touchend', (e) => {
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
          move('right');
        } else {
          move('left');
        }
      }
    } else {
      // 垂直滑动
      if (Math.abs(dy) > minSwipeDistance) {
        if (dy > 0) {
          move('down');
        } else {
          move('up');
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
        move('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        move('right');
        break;
      case 'ArrowUp':
        e.preventDefault();
        move('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        move('down');
        break;
    }
  });
  
  // 按钮控制
  document.getElementById('btn-up').addEventListener('click', () => move('up'));
  document.getElementById('btn-down').addEventListener('click', () => move('down'));
  document.getElementById('btn-left').addEventListener('click', () => move('left'));
  document.getElementById('btn-right').addEventListener('click', () => move('right'));
  
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

