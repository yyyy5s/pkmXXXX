// 记忆游戏
(function() {
  'use strict';
  
  // 游戏状态
  let gameState = null;
  let difficulty = 'normal';
  let score = 0;
  let level = 1;
  let moves = 0;
  let matched = 0;
  let gameRunning = false;
  
  // 卡片数据
  const symbols = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍉', '🍑', '🥝', '🍒', '🥭', '🍍', '🥥'];
  let cards = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let canFlip = true;
  
  // 初始化游戏
  function initGame() {
    const cardCount = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 16 : 12;
    const pairCount = cardCount / 2;
    
    // 选择符号
    const selectedSymbols = symbols.slice(0, pairCount);
    const cardValues = [...selectedSymbols, ...selectedSymbols];
    
    // 打乱顺序
    for (let i = cardValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
    }
    
    // 创建卡片
    cards = cardValues.map((value, index) => ({
      id: index,
      value: value,
      flipped: false,
      matched: false
    }));
    
    matchedPairs = 0;
    flippedCards = [];
    canFlip = true;
    moves = 0;
    matched = 0;
    
    render();
  }
  
  // 渲染
  function render() {
    const grid = document.getElementById('memory-grid');
    grid.innerHTML = '';
    
    cards.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.className = 'memory-card';
      if (card.flipped) cardElement.classList.add('flipped');
      if (card.matched) cardElement.classList.add('matched');
      
      cardElement.innerHTML = `
        <div class="card-back">?</div>
        <div class="card-front">${card.value}</div>
      `;
      
      if (!card.matched) {
        cardElement.addEventListener('click', () => flipCard(card.id));
      }
      
      grid.appendChild(cardElement);
    });
  }
  
  // 翻牌
  function flipCard(cardId) {
    if (!gameRunning || !canFlip) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return;
    
    // 翻牌
    card.flipped = true;
    flippedCards.push(card);
    moves++;
    updateUI();
    render();
    
    // 如果翻了两张牌，检查是否匹配
    if (flippedCards.length === 2) {
      canFlip = false;
      setTimeout(checkMatch, 1000);
    }
  }
  
  // 检查匹配
  function checkMatch() {
    const [card1, card2] = flippedCards;
    
    if (card1.value === card2.value) {
      // 匹配成功
      card1.matched = true;
      card2.matched = true;
      matchedPairs++;
      matched++;
      score += 50;
      
      // 检查是否完成
      if (matchedPairs === cards.length / 2) {
        completeLevel();
      }
    } else {
      // 不匹配，翻回去
      card1.flipped = false;
      card2.flipped = false;
    }
    
    flippedCards = [];
    canFlip = true;
    updateUI();
    render();
  }
  
  // 完成关卡
  function completeLevel() {
    // 计算积分：基础分 + 关卡奖励 - 步数惩罚
    const baseScore = level * 100;
    const moveBonus = Math.max(0, 500 - moves * 5);
    score += baseScore + moveBonus;
    
    level++;
    
    // 下一关
    setTimeout(() => {
      initGame();
    }, 1000);
  }
  
  // 更新UI
  function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('moves').textContent = moves;
    document.getElementById('matched').textContent = matched;
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
    matched = 0;
    gameRunning = true;
    
    initGame();
    updateUI();
  }
  
  // 结束游戏
  function endGame() {
    gameRunning = false;
    
    // 计算最终积分
    const finalScore = score;
    
    // 处理游戏结束
    if (typeof handleGameEnd === 'function') {
      const result = handleGameEnd('memory', finalScore, difficulty);
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

