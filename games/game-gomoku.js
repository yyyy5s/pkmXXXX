// 技能五子棋游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let gameRunning = false;
  let isReturning = false;
  
  // 棋盘状态
  const BOARD_SIZE = 15;
  let board = []; // 0=空, 1=黑(玩家), 2=白(AI)
  let currentPlayer = 1; // 1=玩家, 2=AI
  let rounds = 0;
  let skillsUsed = 0;
  let moveHistory = []; // 用于悔棋
  let protectedCells = new Set(); // 受保护的棋子
  let hintCell = null; // 提示位置
  
  // 技能使用次数
  const skillCounts = {
    timeback: 3,
    remove: 2,
    hint: 2,
    thunder: 1
  };
  
  let activeSkill = null; // 当前激活的技能
  
  // 初始化棋盘
  function initBoard() {
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    moveHistory = [];
    protectedCells.clear();
    hintCell = null;
    currentPlayer = 1;
    rounds = 0;
    skillsUsed = 0;
    activeSkill = null;
    
    // 重置技能次数
    skillCounts.timeback = 3;
    skillCounts.remove = 2;
    skillCounts.hint = 2;
    skillCounts.thunder = 1;
    
    render();
    updateUI();
    updateSkillButtons();
  }
  
  // 渲染棋盘
  function render() {
    const boardElement = document.getElementById('gomoku-board');
    boardElement.innerHTML = '';
    
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        const cell = document.createElement('div');
        cell.className = 'gomoku-cell';
        cell.dataset.row = i;
        cell.dataset.col = j;
        
        if (board[i][j] !== 0) {
          cell.classList.add('occupied');
          const stone = document.createElement('div');
          stone.className = `gomoku-stone ${board[i][j] === 1 ? 'black' : 'white'}`;
          cell.appendChild(stone);
        }
        
        if (protectedCells.has(`${i},${j}`)) {
          cell.classList.add('protected');
        }
        
        if (hintCell && hintCell.row === i && hintCell.col === j) {
          cell.classList.add('skill-hint');
        }
        
        if (activeSkill) {
          if (activeSkill === 'thunder' && board[i][j] === 0) {
            // 雷霆万钧：显示空位（点击后清除3x3范围）
            cell.classList.add('skill-target');
          } else if (activeSkill === 'remove' && board[i][j] === 2) {
            // 移花接木：显示对手的棋子
            cell.classList.add('skill-target');
          }
        }
        
        // 添加点击事件
        if (!activeSkill || 
            (activeSkill === 'thunder' && board[i][j] === 0) ||
            (activeSkill === 'remove' && board[i][j] === 2)) {
          cell.addEventListener('click', () => handleCellClick(i, j));
        }
        
        boardElement.appendChild(cell);
      }
    }
  }
  
  // 处理单元格点击
  function handleCellClick(row, col) {
    if (!gameRunning) return;
    
    if (activeSkill) {
      // 使用技能
      useSkill(activeSkill, row, col);
      return;
    }
    
    // 正常下棋
    if (currentPlayer !== 1 || board[row][col] !== 0) return;
    
    placeStone(row, col, 1);
    render();
    
    // 检查是否获胜
    if (checkWin(row, col, 1)) {
      endGame(true);
      return;
    }
    
    // AI回合
    currentPlayer = 2;
    updateUI();
    
    setTimeout(() => {
      aiMove();
    }, 300);
  }
  
  // 放置棋子
  function placeStone(row, col, player) {
    board[row][col] = player;
    moveHistory.push({row, col, player});
    rounds++;
    updateUI();
  }
  
  // 检查是否获胜
  function checkWin(row, col, player) {
    const directions = [
      [[0, 1], [0, -1]],   // 横向
      [[1, 0], [-1, 0]],   // 纵向
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ];
    
    for (let dir of directions) {
      let count = 1; // 包括当前棋子
      
      for (let [dx, dy] of dir) {
        let r = row + dx;
        let c = col + dy;
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && 
               board[r][c] === player) {
          count++;
          r += dx;
          c += dy;
        }
      }
      
      if (count >= 5) {
        return true;
      }
    }
    
    return false;
  }
  
  // AI移动
  function aiMove() {
    if (!gameRunning || currentPlayer !== 2) return;
    
    let move;
    
    if (difficulty === 'easy') {
      // 简单：随机落子
      move = getRandomMove();
    } else if (difficulty === 'normal') {
      // 普通：基础评估
      move = getBestMove(1);
    } else {
      // 地狱：深度搜索
      move = getBestMove(2);
    }
    
    if (move) {
      placeStone(move.row, move.col, 2);
      render();
      
      // 检查AI是否获胜
      if (checkWin(move.row, move.col, 2)) {
        endGame(false);
        return;
      }
      
      currentPlayer = 1;
      updateUI();
    }
  }
  
  // 获取随机移动
  function getRandomMove() {
    const emptyCells = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (board[i][j] === 0) {
          emptyCells.push({row: i, col: j});
        }
      }
    }
    
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
  
  // 获取最佳移动（评估函数）
  function getBestMove(depth) {
    let bestMove = null;
    let bestScore = -Infinity;
    
    // 获取所有可能的移动（优先考虑已有棋子附近）
    const candidates = getCandidateMoves();
    
    for (let move of candidates) {
      board[move.row][move.col] = 2;
      let score = evaluatePosition(2) - evaluatePosition(1) * 0.8;
      board[move.row][move.col] = 0;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove || getRandomMove();
  }
  
  // 获取候选移动（已有棋子附近）
  function getCandidateMoves() {
    const candidates = new Set();
    
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (board[i][j] !== 0) {
          // 检查周围8个方向
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
              if (dx === 0 && dy === 0) continue;
              const r = i + dx;
              const c = j + dy;
              if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && 
                  board[r][c] === 0) {
                candidates.add(`${r},${c}`);
              }
            }
          }
        }
      }
    }
    
    // 如果没有候选，返回所有空位
    if (candidates.size === 0) {
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          if (board[i][j] === 0) {
            candidates.add(`${i},${j}`);
          }
        }
      }
    }
    
    return Array.from(candidates).map(pos => {
      const [r, c] = pos.split(',').map(Number);
      return {row: r, col: c};
    });
  }
  
  // 评估位置
  function evaluatePosition(player) {
    let score = 0;
    
    // 检查所有方向的连子
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (board[i][j] === player) {
          score += evaluateCell(i, j, player);
        }
      }
    }
    
    return score;
  }
  
  // 评估单个单元格
  function evaluateCell(row, col, player) {
    const patterns = {
      5: 100000,    // 五连
      4: 10000,     // 活四
      3: 1000,      // 活三
      2: 100,       // 活二
      1: 10         // 活一
    };
    
    let score = 0;
    const directions = [
      [[0, 1], [0, -1]],   // 横向
      [[1, 0], [-1, 0]],   // 纵向
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ];
    
    for (let dir of directions) {
      let count = 1;
      let blocked = 0;
      
      for (let [dx, dy] of dir) {
        let r = row + dx;
        let c = col + dy;
        let blockedSide = false;
        
        while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          if (board[r][c] === player) {
            count++;
          } else if (board[r][c] === 0) {
            break;
          } else {
            blockedSide = true;
            break;
          }
          r += dx;
          c += dy;
        }
        
        if (blockedSide) blocked++;
      }
      
      if (count >= 5) {
        score += patterns[5];
      } else if (blocked === 0 && count >= 2) {
        score += patterns[count] || 0;
      }
    }
    
    return score;
  }
  
  // 使用技能
  function useSkill(skill, row, col) {
    if (skillCounts[skill] <= 0) {
      activeSkill = null;
      updateSkillButtons();
      render();
      return;
    }
    
    let success = false;
    
    switch(skill) {
      case 'timeback':
        // 时光倒流：悔棋三步（检查历史记录是否足够）
        if (moveHistory.length >= 1) {
          const stepsToUndo = Math.min(3, moveHistory.length);
          success = undoMoves(stepsToUndo);
          if (success) {
            skillCounts['timeback']--;
            skillsUsed++;
          }
        }
        activeSkill = null;
        updateSkillButtons();
        render();
        updateUI();
        return;
      case 'remove':
        // 移花接木：移除对手一颗棋子
        if (board[row][col] === 2 && !protectedCells.has(`${row},${col}`)) {
          board[row][col] = 0;
          // 从历史记录中移除
          moveHistory = moveHistory.filter(m => !(m.row === row && m.col === col && m.player === 2));
          success = true;
          render();
        }
        break;
      case 'thunder':
        // 雷霆万钧：清除3x3范围内的所有棋子
        if (board[row][col] === 0) {
          for (let i = Math.max(0, row - 1); i <= Math.min(BOARD_SIZE - 1, row + 1); i++) {
            for (let j = Math.max(0, col - 1); j <= Math.min(BOARD_SIZE - 1, col + 1); j++) {
              if (board[i][j] !== 0 && !protectedCells.has(`${i},${j}`)) {
                board[i][j] = 0;
                moveHistory = moveHistory.filter(m => !(m.row === i && m.col === j));
              }
            }
          }
          success = true;
          render();
        }
        break;
      case 'hint':
        // 天眼通：显示AI的下一步最佳位置
        const aiMove = getBestMove(difficulty === 'hard' ? 2 : 1);
        if (aiMove) {
          hintCell = aiMove;
          success = true;
          render();
          // 3秒后清除提示
          setTimeout(() => {
            hintCell = null;
            render();
          }, 3000);
        }
        break;
    }
    
    if (success && skill !== 'timeback') {
      // 时光倒流的扣除已经在各自分支处理
      skillCounts[skill]--;
      skillsUsed++;
      activeSkill = null;
      updateSkillButtons();
      updateUI();
      render();
    } else if (!success) {
      // 技能使用失败，清除激活状态
      activeSkill = null;
      updateSkillButtons();
      render();
    }
  }
  
  // 悔棋
  function undoMoves(count) {
    if (moveHistory.length === 0) return false;
    
    const actualCount = Math.min(count, moveHistory.length);
    
    for (let i = 0; i < actualCount; i++) {
      const move = moveHistory.pop();
      if (move) {
        board[move.row][move.col] = 0;
        protectedCells.delete(`${move.row},${move.col}`);
      }
    }
    
    // 重置当前玩家（确保轮到玩家）
    currentPlayer = 1;
    rounds = Math.max(0, rounds - actualCount);
    
    return true;
  }
  
  // 更新技能按钮
  function updateSkillButtons() {
    const skills = ['timeback', 'remove', 'hint', 'thunder'];
    
    skills.forEach(skill => {
      const btn = document.getElementById(`skill-${skill}`);
      const countEl = document.getElementById(`count-${skill}`);
      
      if (btn && countEl) {
        countEl.textContent = skillCounts[skill];
        
        if (skillCounts[skill] <= 0) {
          btn.classList.add('disabled');
        } else {
          btn.classList.remove('disabled');
        }
        
        if (activeSkill === skill) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('rounds').textContent = rounds;
    document.getElementById('current-player').textContent = currentPlayer === 1 ? '你' : 'AI';
    document.getElementById('skills-used').textContent = skillsUsed;
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
  
  // 结束游戏
  function endGame(playerWon) {
    gameRunning = false;
    
    // 计算最终积分
    let finalScore = 0;
    
    if (playerWon) {
      // 基础分
      finalScore = 500;
      // 连子数奖励（假设最大连子数为5）
      finalScore += 5 * 10;
      // 回合数奖励
      finalScore += rounds * 2;
      // 技能使用惩罚
      finalScore -= skillsUsed * 3;
    } else {
      // 失败也有基础分
      finalScore = Math.max(0, 100 + rounds - skillsUsed * 3);
    }
    
    // 难度系数
    const difficultyMultipliers = {
      easy: 0.8,
      normal: 1.0,
      hard: 1.5
    };
    finalScore = Math.floor(finalScore * (difficultyMultipliers[difficulty] || 1.0));
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('gomoku', finalScore, difficulty);
      showGameEnd(result, playerWon);
    } else {
      showGameEnd({
        score: finalScore,
        difficulty,
        rewards: { coins: 0, happiness: 0, energy: 0 },
        message: playerWon ? '恭喜获胜！' : '游戏结束！'
      }, playerWon);
    }
  }
  
  // 显示游戏结束界面
  function showGameEnd(result, playerWon) {
    document.getElementById('end-title').textContent = playerWon ? '恭喜获胜！' : '游戏结束';
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
    
    if (score > 0 || rounds > 0) {
      isReturning = true;
      let finalScore = 0;
      if (currentPlayer === 1) {
        finalScore = Math.max(0, 100 + rounds - skillsUsed * 3);
      }
      const difficultyMultipliers = {
        easy: 0.8,
        normal: 1.0,
        hard: 1.5
      };
      finalScore = Math.floor(finalScore * (difficultyMultipliers[difficulty] || 1.0));
      
      if (typeof handleGameEnd === 'function') {
        const result = handleGameEnd('gomoku', finalScore, difficulty);
        showGameEnd(result, false);
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
  
  // 显示技能特效
  function showSkillEffect(skillName) {
    const effect = document.createElement('div');
    effect.className = 'skill-effect';
    effect.textContent = skillName;
    document.body.appendChild(effect);
    
    setTimeout(() => {
      if (document.body.contains(effect)) {
        document.body.removeChild(effect);
      }
    }, 1500);
  }
  
  // 技能按钮事件
  document.querySelectorAll('.skill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!gameRunning || currentPlayer !== 1) return;
      
      const skill = e.currentTarget.dataset.skill;
      
      if (skillCounts[skill] <= 0) return;
      
      if (activeSkill === skill) {
        // 取消技能
        activeSkill = null;
      } else {
        // 激活技能
        const skillNames = {
          'timeback': '⏰ 时光倒流',
          'remove': '🌺 移花接木',
          'hint': '👁️ 天眼通',
          'thunder': '⚡ 雷霆万钧'
        };
        
        if (skill === 'hint') {
          // 天眼通直接使用
          showSkillEffect(skillNames[skill]);
          useSkill('hint', 0, 0);
        } else if (skill === 'timeback') {
          // 时光倒流直接使用
          showSkillEffect(skillNames[skill]);
          useSkill('timeback', 0, 0);
        } else {
          activeSkill = skill;
          showSkillEffect(skillNames[skill]);
        }
      }
      
      updateSkillButtons();
      render();
    });
  });
  
  // 难度选择
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      difficulty = e.target.dataset.difficulty;
      if (gameRunning) {
        endGame(false);
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
