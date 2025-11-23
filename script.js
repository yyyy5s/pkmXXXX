// ============================================================
// 宠物养成日记 - 完整脚本
// Pokemon Pet Game - Complete Script
// ============================================================

'use strict';

// ============================================================
// 模块1: 全局数据结构
// ============================================================

// 存档键名
const SAVE_KEY = 'pokemon_pet_save_v1';

// ============================================================
// 路径辅助函数 - 支持PHP部署环境
// ============================================================

/**
 * 获取基础路径，自动检测部署环境
 * 支持相对路径和绝对路径两种模式
 * @returns {string} 基础路径（以/结尾，或空字符串）
 */
function getBasePath() {
  const path = window.location.pathname;
  // 如果是根目录或index.html，返回空字符串（相对路径）
  if (path === '/' || path.endsWith('/index.html') || path.endsWith('/')) {
    return '';
  }
  
  // 如果在子目录中（如games/），计算相对路径
  const depth = path.split('/').filter(p => p && !p.endsWith('.html')).length;
  if (depth > 0) {
    return '../'.repeat(depth);
  }
  
  return '';
}

/**
 * 获取页面路径（用于跳转）
 * @param {string} page - 页面文件名，如 'game.html', 'play.html'
 * @returns {string} 完整的页面路径
 */
function getPagePath(page) {
  const base = getBasePath();
  return base + page;
}

/**
 * 获取游戏路径
 * @param {string} gameType - 游戏类型，如 'tetris', '2048'
 * @returns {string} 完整的游戏路径
 */
function getGamePath(gameType) {
  const base = getBasePath();
  return base + `games/game-${gameType}.html`;
}

// OpenAI API配置
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Pollinations AI 图片生成API
const POLLINATIONS_IMAGE_API = 'https://image.pollinations.ai/prompt/';

// AI请求队列系统(确保串行执行)
const aiRequestQueue = {
  queue: [],
  processing: false,
  taskList: [], // 任务列表，用于跟踪所有AI生成任务
  renderCallback: null, // 渲染回调函数
  
  // 设置渲染回调
  setRenderCallback(callback) {
    this.renderCallback = callback;
  },
  
  // 触发渲染
  triggerRender() {
    if (this.renderCallback) {
      this.renderCallback();
    }
  },
  
  // 添加任务到列表
  addTask(type, description, priority = 0) {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type, // 'chat', 'letter', 'adventure', 'image', 'treasure', 'report'
      description: description,
      priority: priority,
      status: 'pending', // 'pending', 'processing', 'completed', 'failed', 'cancelled'
      startTime: Date.now(),
      endTime: null,
      result: null,
      error: null,
      cancelled: false
    };
    
    this.taskList.push(task);
    // 只保留最近50个任务
    if (this.taskList.length > 50) {
      this.taskList.shift();
    }
    
    this.triggerRender();
    return task.id;
  },
  
  // 更新任务状态
  updateTask(taskId, status, result = null, error = null) {
    const task = this.taskList.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        task.endTime = Date.now();
      }
      if (result !== null) task.result = result;
      if (error !== null) task.error = error;
      
      // 任务完成时显示通知
      if (status === 'completed' || status === 'failed') {
        this.showTaskNotification(task);
      }
      
      this.triggerRender();
    }
  },
  
  // 取消任务
  cancelTask(taskId) {
    const task = this.taskList.find(t => t.id === taskId);
    if (task && (task.status === 'pending' || task.status === 'processing')) {
      // 从队列中移除
      const queueIndex = this.queue.findIndex(q => q.taskId === taskId);
      if (queueIndex !== -1) {
        const queueItem = this.queue[queueIndex];
        this.queue.splice(queueIndex, 1);
        // 拒绝Promise
        if (queueItem.reject) {
          queueItem.reject(new Error('任务已取消'));
        }
      }
      
      // 更新任务状态
      task.status = 'cancelled';
      task.endTime = Date.now();
      task.cancelled = true;
      
      this.triggerRender();
      showNotification('任务已取消');
      return true;
    }
    return false;
  },
  
  // 显示任务完成通知
  showTaskNotification(task) {
    const notifications = {
      'chat': '💬 聊天回复已生成',
      'letter': '💌 宠物来信已生成',
      'adventure': '🗺️ 探险内容已生成',
      'image': '🖼️ 图片已生成',
      'treasure': '💎 宝物图片已生成',
      'report': '📊 相处报告已生成'
    };
    
    const failedNotifications = {
      'chat': '❌ 聊天回复生成失败',
      'letter': '❌ 宠物来信生成失败',
      'adventure': '❌ 探险内容生成失败',
      'image': '❌ 图片生成失败',
      'treasure': '❌ 宝物图片生成失败',
      'report': '❌ 相处报告生成失败'
    };
    
    if (task.status === 'completed') {
      showNotification(notifications[task.type] || '✅ 任务已完成');
    } else if (task.status === 'failed') {
      showNotification(failedNotifications[task.type] || '❌ 任务失败');
    }
  },
  
  // 获取待处理和处理中的任务数量
  getActiveTaskCount() {
    return this.taskList.filter(t => t.status === 'pending' || t.status === 'processing').length;
  },
  
  // 获取所有任务（按时间倒序）
  getAllTasks() {
    return this.taskList.slice().reverse();
  },
  
  async add(requestFn, priority = 0, taskType = 'unknown', taskDescription = '') {
    const taskId = this.addTask(taskType, taskDescription, priority);
    
    return new Promise((resolve, reject) => {
      this.queue.push({ 
        requestFn, 
        priority, 
        resolve, 
        reject,
        taskId,
        cancelled: false
      });
      this.queue.sort((a, b) => b.priority - a.priority); // 优先级高的先执行
      this.triggerRender();
      this.process();
    });
  },
  
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    const queueItem = this.queue.shift();
    
    // 检查是否被取消
    if (queueItem.cancelled) {
      this.processing = false;
      setTimeout(() => this.process(), 100);
      return;
    }
    
    const { requestFn, resolve, reject, taskId } = queueItem;
    
    // 更新任务状态为处理中
    if (taskId) {
      this.updateTask(taskId, 'processing');
    }
    
    // 创建3分钟（180秒）超时Promise
    const timeoutPromise = new Promise((_, rejectTimeout) => {
      setTimeout(() => rejectTimeout(new Error('REQUEST_TIMEOUT')), 180000);
    });
    
    try {
      // 第一次尝试 - 使用Promise.race实现超时检测
      const result = await Promise.race([requestFn(), timeoutPromise]);
      
      // 再次检查是否被取消
      if (!queueItem.cancelled && taskId) {
        this.updateTask(taskId, 'completed', result);
        resolve(result);
      }
    } catch (error) {
      // 检查是否是超时错误
      if (error.message === 'REQUEST_TIMEOUT') {
        console.warn('⏱️ AI任务超时（3分钟），尝试切换API并重试...');
        
        // 尝试切换到下一个可用API
        const switched = switchToNextAPI();
        
        if (switched) {
          console.log('🔄 已切换API，重试任务...');
          try {
            // 重试一次（同样使用3分钟超时）
            const retryResult = await Promise.race([requestFn(), timeoutPromise]);
            
            if (!queueItem.cancelled && taskId) {
              this.updateTask(taskId, 'completed', retryResult);
              resolve(retryResult);
            }
          } catch (retryError) {
            // 重试仍然失败
            if (retryError.message === 'REQUEST_TIMEOUT') {
              console.error('❌ 切换API后重试仍超时，取消任务');
            } else {
              console.error('❌ 重试失败:', retryError.message);
            }
            
            if (!queueItem.cancelled && taskId) {
              this.updateTask(taskId, 'cancelled', null, '超时后切换API重试仍失败');
              reject(retryError);
            }
          }
        } else {
          // 无法切换API，直接取消任务
          console.warn('⚠️ 无可用API可切换，取消任务');
          if (!queueItem.cancelled && taskId) {
            this.updateTask(taskId, 'cancelled', null, '任务超时且无可用API');
            reject(error);
          }
        }
      } else {
        // 其他类型的错误
        if (!queueItem.cancelled && taskId) {
          this.updateTask(taskId, 'failed', null, error.message);
          reject(error);
        }
      }
    } finally {
      this.processing = false;
      // 处理下一个请求，任务完成后等待20秒再触发下一个任务（避免API调用过于频繁）
      setTimeout(() => this.process(), 20000);
    }
  }
};

// 预设模型列表
const EMBEDDED_MODELS = [
  'gemini-2.5-flash', 
];

const CUSTOM_MODELS = [
  'gpt-3.5-turbo',
  'gemini-2.5-flash'
];

// 游戏配置常量
const GAME_CONFIG = {
  // 成长阶段时长(小时)
  growthStages: {
    egg: 30 / 3600,  // 30秒孵化 (30秒 = 30/3600小时)
    baby: 24,      // 24小时成长到少年
    teen: 48,      // 48小时成长到成年
    adult: Infinity
  },
  
  // 属性衰减速率(每分钟)
  statDecayRates: {
    hunger: -0.05,       // 每分钟-0.05
    energy: -0.5,     // 睡眠时恢复
    happiness: -0.2,  // 缺少互动时衰减
    cleanliness: 0    // 只有便便时衰减
  },
  
  // 排泄系统
  digestionTime: 240,   // 进食后240分钟排泄(4小时)
  maxPoopCount: 3,      // 最多3坨便便
  
  // 离线恢复
  offlineEnergyRecovery: 20  // 离线每小时恢复20体力
};

// 音效配置
// 注意：需要用户自行准备音频文件并放置在 assets/sounds/ 目录下
const SOUND_CONFIG = {
  enabled: true,
  volume: 0.5,
  sounds: {
    feed: 'assets/sounds/feed.mp3',           // 喂食音效
    clean: 'assets/sounds/clean.mp3',         // 清洁音效
    pet: 'assets/sounds/pet.mp3',             // 抚摸音效
    play: 'assets/sounds/play.mp3',           // 玩耍音效
    adventure: 'assets/sounds/adventure.mp3', // 探险音效
    chat: 'assets/sounds/chat.mp3',           // 聊天音效
    button: 'assets/sounds/button.mp3',       // 按钮点击音效
    notification: 'assets/sounds/notification.mp3', // 通知音效
    evolution: 'assets/sounds/evolution.mp3', // 进化音效
    death: 'assets/sounds/death.mp3'          // 死亡音效
  }
};

// 宠物数据库
const POKEMON_DATABASE = {
  pikachu: {
    petId: 'pikachu',
    petName: '皮卡丘',
    species: '电气鼠宠物',
    catchphrase: '皮卡', // 宠物口癖基础词
    
    // 资源接口 (支持svg/png/gif多格式,只需文件名即可)
    assets: {
      egg: 'assets/pikachu/egg',
      baby: 'assets/pikachu/baby',
      teen: 'assets/pikachu/teen',
      adult: 'assets/pikachu/adult',
      happy: 'assets/pikachu/happy',
      sad: 'assets/pikachu/sad',
      sick: 'assets/pikachu/sick',
      sleeping: 'assets/pikachu/sleep',
      poop: 'assets/poop'
    },
    
    // 主题色
    theme: {
      primary: '#FFD700',
      secondary: '#FF6B6B',
      bgDay: '#87CEEB',
      bgNight: '#2C3E50'
    },
    
    // AI角色设定
    aiPersonality: {
      systemPrompt: `你是一只活泼可爱的皮卡丘，主人的名字是{{OWNER_NAME}}。
你会用"皮卡"、"皮卡皮卡"等口癖说话，性格天真烂漫但也很勇敢。
回复简短（20-50字），充满童趣。偶尔会撒娇或者表达对主人的喜爱。`
    }
  }
};

// 商店商品数据
const SHOP_ITEMS = [
  {
    itemId: 'food_apple',
    itemName: '苹果',
    type: 'food',
    price: 50,
    effects: {
      hunger: 30,
      happiness: 5
    },
    icon: 'assets/shop/apple', // 支持svg/png/gif
    description: '新鲜的树果，能恢复饱食度'
  },
  {
    itemId: 'food_premium',
    itemName: '高级宠物食物',
    type: 'food',
    price: 200,
    effects: {
      hunger: 50,
      happiness: 15,
      health: 10
    },
    icon: 'assets/shop/premium_food', // 支持svg/png/gif
    description: '营养丰富，宠物最爱'
  },
  {
    itemId: 'toy_ball',
    itemName: '精灵球玩具',
    type: 'toy',
    price: 150,
    effects: {
      happiness: 25,
      energy: -10
    },
    icon: 'assets/shop/pokeball_toy', // 支持svg/png/gif
    description: '用于玩耍，能大幅提升心情'
  },
  {
    itemId: 'medicine_potion',
    itemName: '伤药',
    type: 'medicine',
    price: 300,
    effects: {
      health: 50,
      cleanliness: 20
    },
    icon: 'assets/shop/potion', // 支持svg/png/gif
    description: '治疗疾病，恢复健康'
  },
  {
    itemId: 'clean_soap',
    itemName: '清洁香皂',
    type: 'tool',
    price: 100,
    effects: {
      cleanliness: 40,
      happiness: 10
    },
    icon: 'assets/shop/soap', // 支持svg/png/gif
    description: '用于清洁，让宠物焕然一新'
  },
  {
    itemId: 'medicine_energy_drink',
    itemName: '能量饮料',
    type: 'medicine',
    price: 150,
    effects: {
      energy: 30
    },
    icon: 'assets/shop/energy_drink', // 支持svg/png/gif
    description: '恢复30精力，快速补充体力'
  },
  {
    itemId: 'medicine_super_energy_drink',
    itemName: '超级能量饮料',
    type: 'medicine',
    price: 250,
    effects: {
      energy: 50
    },
    icon: 'assets/shop/super_energy_drink', // 支持svg/png/gif
    description: '恢复50精力，大幅补充体力'
  }
];

// 游戏状态对象（默认值）
let gameState = {
  // 基础信息
  ownerName: '',
  petId: 'pikachu',
  petNickname: '皮卡丘',
  
  // 时间系统
  birthTimestamp: 0,
  lastLoginTimestamp: 0,
  totalPlayTime: 0,
  
  // 成长阶段
  growthStage: 'egg',
  ageInHours: 0,
  
  // 核心属性 (0-100)
  stats: {
    hunger: 100,
    cleanliness: 100,
    happiness: 100,
    energy: 100,
    health: 100
  },
  
  // 生理系统
  physiology: {
    lastFeedTime: 0,
    lastPoopTime: 0,
    poopCount: 0,
    needsPoop: false,
    isSleeping: false,
    isSick: false
  },
  
  // 互动记录
  interactions: {
    lastPetTime: 0,
    lastChatTime: 0,
    lastPlayTime: 0,
    lastCleanTime: 0,
    totalChats: 0,
    totalAdventures: 0
  },
  
  // 背包系统
  inventory: {
    coins: 1000,
    items: [],
    treasures: []
  },
  
  // AI记录
  aiData: {
    chatHistory: [],
    unifiedLogs: [],
    logSummaries: [],
    petLetters: [],
    lastSummaryLogCount: 0
  },
  
  // 探险系统
  adventureState: {
    isAdventuring: false,
    startTime: 0,
    duration: 60,
    endTime: 0,
    currentLocation: '',
    locationImage: '',
    randomEvents: [],
    triggeredEvents: [],
    finalRewards: {
      treasures: [],
      energyChange: 0,
      hungerChange: 0,
      story: ''
    }
  },
  
  // 图鉴系统
  encyclopedia: {
    unlockedItems: [],
    treasures: [],
    photoAlbum: [],
    itemCompletionRate: 0
  },
  
  // 游戏设置
  settings: {
    backgroundImage: 'default',
    soundEnabled: true,
    notificationEnabled: true,
    dayNightMode: 'auto', // 'auto' | 'manual'
    manualTheme: 'day', // 'day' | 'night' (仅在manual模式下使用)
    phoneFrameSize: {
      width: 390,
      height: 844
    },
    apiConfig: {
      useEmbeddedAPI: true,
      // 内嵌API - 支持两个模型
      embeddedAPIs: [
        { 
          apiKey: 'sk-11api',
          endpoint: 'https://11api/v1/chat/completions',
          model: 'gemini-2.5-flash', 
          enabled: true 
        },
        { 
          apiKey: '',
          endpoint: 'https://openai.cn/v1/chat/completions',
          model: '', 
          enabled: false 
        }
      ],
      // 自定义API - 支持两套配置
      customAPIs: [
        { 
          apiKey: '', 
          endpoint: '', 
          model: '', 
          enabled: true 
        },
        { 
          apiKey: '', 
          endpoint: '', 
          model: '', 
          enabled: false 
        }
      ],
      currentAPIIndex: 0,
      temperature: 0.7,
      // 向后兼容旧版配置
      embeddedAPIKey: 'sk-11api',
      embeddedAPIEndpoint: 'https:///api.11apiv1/chat/completions',
      embeddedModel: 'gemini-2.5-flash',
      customAPIKey: '',
      customAPIEndpoint: '',
      customModel: ''
    },
    autoResume: false
  },
  
  // 死亡警告时间
  deathWarningTime: null
};

// ============================================================
// 模块2: 页面路由初始化
// ============================================================

/**
 * 更新手机边框尺寸
 */
function updatePhoneFrameSize(width, height) {
  if (!width || !height) {
    width = gameState.settings.phoneFrameSize?.width || 390;
    height = gameState.settings.phoneFrameSize?.height || 844;
  }
  
  // 限制尺寸范围
  width = Math.max(300, Math.min(600, width));
  height = Math.max(500, Math.min(1200, height));
  
  // 更新CSS变量
  document.documentElement.style.setProperty('--phone-width', `${width}px`);
  document.documentElement.style.setProperty('--phone-height', `${height}px`);
  
  // 更新gameState
  if (!gameState.settings.phoneFrameSize) {
    gameState.settings.phoneFrameSize = {};
  }
  gameState.settings.phoneFrameSize.width = width;
  gameState.settings.phoneFrameSize.height = height;
}

/**
 * 自动检测当前页面并初始化
 */
/**
 * 初始化所有页面的夜间模式
 */
function initThemeForAllPages() {
  // 加载游戏状态（如果存在）
  if (typeof loadGameState === 'function') {
    loadGameState();
  }
  
  const body = document.body;
  if (!body) return;
  
  // 获取主题设置
  const themeMode = (gameState && gameState.settings?.dayNightMode) || 'auto';
  let currentTheme = 'day';
  
  if (themeMode === 'manual') {
    // 手动模式：使用保存的主题
    currentTheme = (gameState && gameState.settings?.manualTheme) || 'day';
  } else {
    // 自动模式：根据时间判断
    const now = new Date();
    const hour = now.getHours();
    currentTheme = (hour >= 6 && hour < 18) ? 'day' : 'night';
  }
  
  // 应用主题到body
  body.dataset.theme = currentTheme;
  
  // 更新背景主题
  if (typeof updateBackgroundTheme === 'function') {
    updateBackgroundTheme(currentTheme);
  }
  
  console.log('🌓 主题已初始化:', currentTheme);
}

document.addEventListener('DOMContentLoaded', () => {
  // 安全措施：强制隐藏所有模态窗口，防止意外覆盖页面
  document.querySelectorAll('.modal').forEach(modal => {
    if (!modal.classList.contains('hidden')) {
      console.warn('⚠️ 发现未隐藏的模态窗口，已强制隐藏:', modal.id || '未命名');
      modal.classList.add('hidden');
    }
  });
  
  // 初始化夜间模式（在所有页面）
  initThemeForAllPages();
  
  // 加载游戏状态并应用边框尺寸
  if (typeof loadGameState === 'function') {
    loadGameState();
  }
  if (typeof updatePhoneFrameSize === 'function') {
    updatePhoneFrameSize();
  }
  
  // 应用背景（在所有页面，包括游戏页面）
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 18;
  const themeMode = gameState.settings?.dayNightMode || 'auto';
  const savedTheme = gameState.settings?.manualTheme || 'day';
  const currentTheme = themeMode === 'manual' ? savedTheme : (isDay ? 'day' : 'night');
  if (typeof updateBackgroundTheme === 'function') {
    updateBackgroundTheme(currentTheme);
  }
  
  const path = window.location.pathname;
  const page = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
  
  console.log('🎮 当前页面:', page);
  
  if (page === 'index.html' || page === '' || path.endsWith('/')) {
    if (typeof initCharacterSelection === 'function') {
      initCharacterSelection();
    }
  } else if (page === 'game.html') {
    if (typeof initGame === 'function') {
      initGame();
    }
  } else if (page === 'shop.html') {
    if (typeof initShop === 'function') {
      initShop();
    }
  } else if (page === 'play.html') {
    if (typeof initPlay === 'function') {
      initPlay();
    }
  } else {
    // 游戏页面（games/*.html）也应用背景
    if (typeof updateBackgroundTheme === 'function') {
      updateBackgroundTheme(currentTheme);
    }
  }
});

// ============================================================
// 模块3: index.html 角色选择
// ============================================================

/**
 * 初始化角色选择界面
 */
function initCharacterSelection() {
  console.log('📋 初始化角色选择界面');
  
  // 1. 检查是否已有存档
  const savedGame = localStorage.getItem(SAVE_KEY);
  
  if (savedGame) {
    try {
      const parsedSave = JSON.parse(savedGame);
      
      // 检查URL参数，是否强制显示选择界面
      const urlParams = new URLSearchParams(window.location.search);
      const forceSelect = urlParams.get('new') === 'true';
      
      if (!forceSelect && parsedSave.settings?.autoResume === true) {
        // 启用了自动继续，直接跳转
        window.location.href = getPagePath('game.html');
        return;
      }
      
      if (!forceSelect) {
        // 显示继续游戏选项
        showContinueOption(parsedSave);
        return;
      }
    } catch (e) {
      console.error('存档解析失败:', e);
    }
  }
  
  // 显示新游戏界面
  showNewGameSection();
}

/**
 * 显示继续游戏选项
 */
function showContinueOption(savedGame) {
  const container = document.getElementById('selection-container');
  
  // 创建继续游戏区域
  const continueSection = document.createElement('div');
  continueSection.id = 'continue-section';
  continueSection.innerHTML = `
    <div class="save-preview">
      <img id="save-pet-preview" src="" alt="宠物预览" class="save-pet-icon">
      <div class="save-info">
        <p class="save-pet-name">${savedGame.petNickname || '皮卡丘'}</p>
        <p class="save-stats">第 <span id="save-days">${Math.floor((Date.now() - savedGame.birthTimestamp) / 86400000)}</span> 天 · <span id="save-stage">${getStageText(savedGame.growthStage)}</span></p>
        <p class="save-owner">主人: <span id="save-owner-name">${savedGame.ownerName}</span></p>
      </div>
    </div>
    <button id="btn-continue-game" class="pixel-btn primary">继续游戏</button>
    <button id="btn-new-game" class="pixel-btn">重新开始</button>
  `;
  
  // 隐藏原有内容
  const ownerSection = document.getElementById('owner-input-section');
  const petGrid = document.getElementById('pet-selection-grid');
  const startBtn = document.getElementById('btn-start-game');
  
  if (ownerSection) ownerSection.classList.add('hidden');
  if (petGrid) petGrid.classList.add('hidden');
  if (startBtn) startBtn.classList.add('hidden');
  
  // 插入继续游戏区域
  const logo = document.getElementById('game-logo');
  if (logo) {
    logo.after(continueSection);
  } else {
    container.prepend(continueSection);
  }
  
  // 加载宠物预览图片（支持多格式）
  const previewImg = document.getElementById('save-pet-preview');
  if (previewImg) {
    const spritePath = POKEMON_DATABASE[savedGame.petId]?.assets[savedGame.growthStage] || POKEMON_DATABASE[savedGame.petId]?.assets.adult;
    const basePath = spritePath ? spritePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '') : null;
    if (basePath) {
      loadImageWithFallback(previewImg, basePath, 'assets/pikachu/adult');
    } else {
      loadImageWithFallback(previewImg, `assets/${savedGame.petId}/${savedGame.growthStage || 'adult'}`, 'assets/pikachu/adult');
    }
  }
  
  // 绑定按钮事件
  document.getElementById('btn-continue-game').addEventListener('click', () => {
    window.location.href = getPagePath('game.html');
  });
  
  document.getElementById('btn-new-game').addEventListener('click', () => {
    if (confirm('确定要重新开始吗？当前存档将被清除！')) {
      // 清除所有localStorage数据
      localStorage.removeItem(SAVE_KEY);
      // 清除所有可能的其他相关数据
      localStorage.clear();
      // 重新初始化游戏状态
      initializeNewGame();
      // 移除继续游戏区域
      continueSection.remove();
      // 显示新游戏界面
      showNewGameSection();
    }
  });
}

/**
 * 显示新游戏界面
 */
function showNewGameSection() {
  const ownerSection = document.getElementById('owner-input-section');
  const petGrid = document.getElementById('pet-selection-grid');
  const startBtn = document.getElementById('btn-start-game');
  
  if (ownerSection) ownerSection.classList.remove('hidden');
  if (petGrid) petGrid.classList.remove('hidden');
  if (startBtn) startBtn.classList.remove('hidden');
  
  // 绑定事件
  const ownerInput = document.getElementById('owner-name-input');
  if (ownerInput) {
    ownerInput.addEventListener('input', validateStartForm);
    // 确保可以交互
    ownerInput.style.pointerEvents = 'auto';
  }
  
  // 绑定宠物卡片点击
  document.querySelectorAll('.pet-card:not(.locked)').forEach(card => {
    card.addEventListener('click', selectPet);
    // 确保可以点击
    card.style.pointerEvents = 'auto';
    card.style.cursor = 'pointer';
  });
  
  // 绑定开始按钮
  if (startBtn) {
    startBtn.addEventListener('click', startNewGame);
    // 确保可以点击
    startBtn.style.pointerEvents = 'auto';
    startBtn.style.cursor = 'pointer';
  }
}

/**
 * 选择宠物
 */
function selectPet(event) {
  const card = event.currentTarget;
  
  // 移除其他选中状态
  document.querySelectorAll('.pet-card').forEach(c => c.classList.remove('selected'));
  
  // 添加选中状态
  card.classList.add('selected');
  
  // 验证表单
  validateStartForm();
}

/**
 * 验证开始游戏表单
 */
function validateStartForm() {
  const ownerName = document.getElementById('owner-name-input')?.value.trim();
  const selectedPet = document.querySelector('.pet-card.selected');
  const btnStart = document.getElementById('btn-start-game');
  
  if (btnStart) {
    btnStart.disabled = !(ownerName && selectedPet);
  }
}

/**
 * 开始新游戏
 */
async function startNewGame() {
  const ownerName = document.getElementById('owner-name-input').value.trim();
  const selectedCard = document.querySelector('.pet-card.selected');
  
  if (!ownerName || !selectedCard) {
    showNotification('请输入名字并选择宠物！');
    return;
  }
  
  const petId = selectedCard.dataset.petId;
  
  // 初始化新游戏状态
  initializeNewGame();
  gameState.ownerName = ownerName;
  gameState.petId = petId;
  gameState.petNickname = POKEMON_DATABASE[petId].petName;
  gameState.birthTimestamp = Date.now();
  gameState.lastLoginTimestamp = Date.now();
  
  // 保存并跳转
  saveGameState();
  window.location.href = getPagePath('game.html');
}

/**
 * 获取成长阶段文本
 */
function getStageText(stage) {
  const stageNames = {
    egg: '蛋',
    baby: '幼年期',
    teen: '少年期',
    adult: '成年期'
  };
  return stageNames[stage] || '未知';
}

// ============================================================
// 模块4: 存档系统
// ============================================================

/**
 * 保存游戏状态
 */
function saveGameState() {
  try {
    // 限制数据长度避免存储溢出
    if (gameState.aiData.chatHistory.length > 50) {
      gameState.aiData.chatHistory = gameState.aiData.chatHistory.slice(-50);
    }
    if (gameState.aiData.unifiedLogs.length > 200) {
      gameState.aiData.unifiedLogs = gameState.aiData.unifiedLogs.slice(-200);
    }
    if (gameState.inventory.treasures.length > 100) {
      gameState.inventory.treasures = gameState.inventory.treasures.slice(-100);
    }
    if (gameState.encyclopedia.photoAlbum.length > 50) {
      gameState.encyclopedia.photoAlbum = gameState.encyclopedia.photoAlbum.slice(-50);
    }
    // 限制宝物数量，但保留所有宝物数据（包括图片URL和imagePrompt）
    if (gameState.encyclopedia.treasures.length > 100) {
      gameState.encyclopedia.treasures = gameState.encyclopedia.treasures.slice(-100);
    }
    
    // 确保保存所有宝物相关数据：treasures数组包含imageUrl和imagePrompt
    // 确保保存探险状态中的locationImage
    // 确保保存相册中的图片URL
    
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    console.log('✅ 游戏已自动保存');
  } catch (error) {
    console.error('❌ 保存失败:', error);
    if (error.name === 'QuotaExceededError') {
      showNotification('存储空间不足，请清理部分数据');
    }
  }
}

/**
 * 加载游戏状态
 */
function loadGameState() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 深度合并，保留默认值中新增的字段
      gameState = deepMerge(gameState, parsed);
      console.log('✅ 读取存档成功');
      return true;
    } else {
      console.log('📝 未找到存档');
      return false;
    }
  } catch (error) {
    console.error('❌ 读取存档失败:', error);
    return false;
  }
}

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * 初始化新游戏
 */
function initializeNewGame() {
  gameState = {
    ownerName: '',
    petId: 'pikachu',
    petNickname: '皮卡丘',
    birthTimestamp: Date.now(),
    lastLoginTimestamp: Date.now(),
    totalPlayTime: 0,
    growthStage: 'egg',
    ageInHours: 0,
    stats: {
      hunger: 100,
      cleanliness: 100,
      happiness: 100,
      energy: 100,
      health: 100
    },
    physiology: {
      lastFeedTime: 0,
      lastPoopTime: 0,
      poopCount: 0,
      needsPoop: false,
      isSleeping: false,
      isSick: false
    },
    interactions: {
      lastPetTime: 0,
      lastChatTime: 0,
      lastPlayTime: 0,
      lastCleanTime: 0,
      totalChats: 0,
      totalAdventures: 0
    },
    inventory: {
      coins: 1000,
      items: [],
      treasures: []
    },
    aiData: {
      chatHistory: [],
      unifiedLogs: [],
      logSummaries: [],
      petLetters: [],
      lastSummaryLogCount: 0
    },
    adventureState: {
      isAdventuring: false,
      startTime: 0,
      duration: 60,
      endTime: 0,
      currentLocation: '',
      locationImage: '',
      randomEvents: [],
      triggeredEvents: [],
      finalRewards: {
        treasures: [],
        energyChange: 0,
        hungerChange: 0,
        story: ''
      }
    },
    encyclopedia: {
      unlockedItems: [],
      treasures: [],
      photoAlbum: [],
      itemCompletionRate: 0
    },
    settings: {
      backgroundImage: 'default',
      soundEnabled: true,
      notificationEnabled: true,
      apiConfig: {
        useEmbeddedAPI: true,
        // 内嵌API - 支持两个模型
        embeddedAPIs: [
          { 
            apiKey: '',
            endpoint: 'https//11api.v1/chat/completions',
            model: 'gemini-2.5-flash', 
            enabled: true 
          },
          { 
            apiKey: '',
            endpoint: 'https://11api/v1/chat/completions',
            model: '', 
            enabled: false 
          }
        ],
        // 自定义API - 支持两套配置
        customAPIs: [
          { 
            apiKey: '', 
            endpoint: 'https://11api/v1/chat/completions', 
            model: 'gpt-3.5-turbo', 
            enabled: true 
          },
          { 
            apiKey: '', 
            endpoint: '', 
            model: '', 
            enabled: false 
          }
        ],
        currentAPIIndex: 0,
        temperature: 0.9,
        // 向后兼容
        embeddedAPIKey: '',
        embeddedAPIEndpoint: 'https:/11api/v1/chat/completions',
        embeddedModel: 'gemini-2.5-flash',
        customAPIKey: '',
        customAPIEndpoint: 'https://11api/v1/chat/completions',
        customModel: 'gpt-3.5-turbo'
      },
      autoResume: false
    },
    deathWarningTime: null
  };
}

/**
 * 导出存档
 */
function exportSaveData() {
  const dataStr = JSON.stringify(gameState, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `pokemon_save_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showNotification('📤 存档已导出');
}

/**
 * 导入存档
 */
function importSaveData(file) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      gameState = deepMerge(gameState, imported);
      saveGameState();
      showNotification('📥 存档导入成功，即将刷新...');
      setTimeout(() => location.reload(), 1500);
    } catch (error) {
      showNotification('❌ 导入失败：文件格式错误');
      console.error('导入错误:', error);
    }
  };
  reader.readAsText(file);
}

/**
 * 重置游戏
 */
function resetGame() {
  if (confirm('确定要重置游戏吗？所有数据将被清除！')) {
    // 清除所有localStorage数据
    localStorage.removeItem(SAVE_KEY);
    // 清除所有可能的其他相关数据
    localStorage.clear();
    // 强制刷新并跳转到index页面
    window.location.href = getPagePath('index.html?new=true');
    // 强制刷新页面
    window.location.reload();
  }
}

// ============================================================
// 模块5: game.html 主游戏
// ============================================================

/**
 * 初始化主游戏
 */
function initGame() {
  console.log('🎮 初始化主游戏');
  
  // 1. 加载存档
  const hasData = loadGameState();
  if (!hasData || !gameState.ownerName) {
    // 没有存档，返回选择界面
    window.location.href = getPagePath('index.html');
    return;
  }
  
  // 2. 离线结算
  handleOfflineProgress();
  
  // 3. 检查成长阶段（确保初始化时正确显示）
  gameState.ageInHours = Math.floor((Date.now() - gameState.birthTimestamp) / 3600000);
  checkGrowthStage();
  
  // 4. 启动时间循环
  startGameLoop();
  
  // 5. 同步实时时钟
  syncRealTimeClock();
  
  // 6. 渲染UI
  renderPetSprite();
  updateAllStats();
  renderPoops();
  updatePetNamePlaceholders();
  
  // 7. 应用背景
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 18;
  updateBackgroundTheme(isDay ? 'day' : 'night');
  
  // 8. 绑定事件
  bindGameEventListeners();
  
  // 9. 初始化AI任务队列UI
  initAIQueueUI();
  
  
  console.log('✅ 游戏初始化完成');
}

/**
 * 处理离线进度
 */
function handleOfflineProgress() {
  const now = Date.now();
  const offlineMinutes = Math.floor((now - gameState.lastLoginTimestamp) / 60000);
  
  if (offlineMinutes <= 0) return;
  
  console.log(`📴 离线了 ${offlineMinutes} 分钟，正在结算...`);
  
  // 记录变化前的属性（用于欢迎弹窗）
  const oldStats = {
    hunger: gameState.stats.hunger,
    cleanliness: gameState.stats.cleanliness,
    happiness: gameState.stats.happiness,
    energy: gameState.stats.energy,
    health: gameState.stats.health
  };
  
  // 饥饿度衰减
  gameState.stats.hunger = Math.max(0, 
    gameState.stats.hunger + (GAME_CONFIG.statDecayRates.hunger * offlineMinutes)
  );
  
  // 离线期间恢复体力
  const offlineHours = offlineMinutes / 60;
  gameState.stats.energy = Math.min(100, 
    gameState.stats.energy + (GAME_CONFIG.offlineEnergyRecovery * offlineHours)
  );
  
  // 检查排泄
  const minutesSinceLastFeed = Math.floor((now - gameState.physiology.lastFeedTime) / 60000);
  if (minutesSinceLastFeed >= GAME_CONFIG.digestionTime && 
      gameState.physiology.lastFeedTime > 0 && 
      !gameState.physiology.needsPoop) {
    gameState.physiology.needsPoop = true;
    addPoop();
  }
  
  // 便便影响清洁度
  if (gameState.physiology.poopCount > 0) {
    const cleanlinessLoss = gameState.physiology.poopCount * 10 * (offlineMinutes / 60);
    gameState.stats.cleanliness = Math.max(0, gameState.stats.cleanliness - cleanlinessLoss);
  }
  
  // 清洁度影响心情
  if (gameState.stats.cleanliness < 50) {
    gameState.stats.happiness = Math.max(0, gameState.stats.happiness - 20);
  }
  
  // 更新年龄
  gameState.ageInHours = Math.floor((now - gameState.birthTimestamp) / 3600000);
  checkGrowthStage();
  
  // 健康度计算
  updateHealthStatus();
  
  // 记录变化后的属性（用于欢迎弹窗）
  const newStats = {
    hunger: gameState.stats.hunger,
    cleanliness: gameState.stats.cleanliness,
    happiness: gameState.stats.happiness,
    energy: gameState.stats.energy,
    health: gameState.stats.health
  };
  
  // 更新登录时间
  gameState.lastLoginTimestamp = now;
  saveGameState();
  
  // 显示欢迎回来弹窗（离线超过5分钟时）
  if (offlineMinutes >= 5) {
    showWelcomeBackModal(offlineMinutes, oldStats, newStats);
  }
}

/**
 * 显示欢迎回来弹窗（详细属性变化）
 */
function showWelcomeBackModal(offlineMinutes, oldStats, newStats) {
  const hours = Math.floor(offlineMinutes / 60);
  const mins = offlineMinutes % 60;
  
  // 计算属性变化
  const statNames = {
    hunger: '🍎 饱食度',
    cleanliness: '✨ 清洁度',
    happiness: '😊 心情',
    energy: '⚡ 体力',
    health: '❤️ 健康'
  };
  
  const changesHTML = Object.entries(statNames).map(([stat, name]) => {
    const oldValue = Math.floor(oldStats[stat]);
    const newValue = Math.floor(newStats[stat]);
    const diff = newValue - oldValue;
    const sign = diff >= 0 ? '+' : '';
    const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
    
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-xs) 0; border-bottom: 1px solid var(--pixel-light-gray);">
        <span style="font-size: 10px;">${name}</span>
        <span style="font-size: 10px;">
          <span style="color: var(--pixel-gray);">${oldValue}</span>
          <span style="margin: 0 var(--space-xs);">→</span>
          <span style="font-weight: bold;">${newValue}</span>
          <span style="color: ${color}; margin-left: var(--space-xs);">(${sign}${diff})</span>
        </span>
      </div>
    `;
  }).join('');
  
  // 特殊事件提示
  let specialEvents = [];
  if (gameState.physiology.poopCount > 0) {
    specialEvents.push(`💩 生成了 ${gameState.physiology.poopCount} 个便便`);
  }
  if (newStats.health < 50) {
    specialEvents.push('⚠️ 健康状况需要关注');
  }
  if (newStats.hunger < 30) {
    specialEvents.push('🍔 宠物有点饿了');
  }
  
  const specialEventsHTML = specialEvents.length > 0 ? `
    <div style="margin-top: var(--space-md); padding: var(--space-md); background: rgba(255, 193, 7, 0.1); border: 2px solid var(--warning); border-radius: var(--radius-sm);">
      <h4 style="font-size: 10px; margin-bottom: var(--space-xs);">⚠️ 特别提醒</h4>
      ${specialEvents.map(e => `<p style="font-size: 9px; margin: var(--space-xs) 0;">• ${e}</p>`).join('')}
    </div>
  ` : '';
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>🎉 欢迎回来，${gameState.ownerName}！</h3>
      </div>
      <div style="padding: var(--space-md);">
        <p style="text-align: center; font-size: 12px; margin-bottom: var(--space-lg); color: var(--text-primary);">
          你离开了 <strong style="color: var(--primary);">${hours > 0 ? hours + '小时' : ''}${mins}分钟</strong>
        </p>
        
        <div style="background: var(--pixel-light-gray); padding: var(--space-md); border-radius: var(--radius-sm); margin-bottom: var(--space-md);">
          <h4 style="font-size: 11px; margin-bottom: var(--space-md); color: var(--text-primary);">📊 属性变化</h4>
          ${changesHTML}
        </div>
        
        ${specialEventsHTML}
        
        <button class="pixel-btn primary" onclick="this.closest('.modal').remove()" style="width: 100%; margin-top: var(--space-md);">
          继续照顾${gameState.petNickname}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

/**
 * 启动游戏主循环
 */
function startGameLoop() {
  // 每分钟执行一次
  setInterval(() => {
    const now = Date.now();
    
    // 1. 属性自然衰减
    if (!gameState.physiology.isSleeping) {
      gameState.stats.hunger = Math.max(0, gameState.stats.hunger + GAME_CONFIG.statDecayRates.hunger);
      gameState.stats.happiness = Math.max(0, gameState.stats.happiness + GAME_CONFIG.statDecayRates.happiness);
    }
    
    // 2. 自动睡眠 (22:00-6:00)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      if (!gameState.physiology.isSleeping) {
        gameState.physiology.isSleeping = true;
        setPetAnimation('sleeping');
      }
      gameState.stats.energy = Math.min(100, gameState.stats.energy + 2);
    } else {
      if (gameState.physiology.isSleeping) {
        gameState.physiology.isSleeping = false;
        renderPetSprite();
      }
    }
    
    // 3. 检查排泄
    checkDigestion();
    
    // 4. 便便影响清洁度
    if (gameState.physiology.poopCount > 0) {
      gameState.stats.cleanliness = Math.max(0, gameState.stats.cleanliness - (0.2 * gameState.physiology.poopCount));
    }
    
    // 5. 清洁度低影响心情
    if (gameState.stats.cleanliness < 30) {
      gameState.stats.happiness = Math.max(0, gameState.stats.happiness - 0.5);
    }
    
    // 6. 饥饿影响心情和健康
    if (gameState.stats.hunger < 20) {
      gameState.stats.happiness = Math.max(0, gameState.stats.happiness - 1);
      gameState.stats.health = Math.max(0, gameState.stats.health - 0.5);
    }
    
    // 7. 更新年龄和成长
    gameState.ageInHours = Math.floor((now - gameState.birthTimestamp) / 3600000);
    checkGrowthStage();
    
    // 8. 健康检查
    updateHealthStatus();
    checkDeathCondition();
    
    // 9. 检查探险状态
    if (gameState.adventureState.isAdventuring) {
      if (now >= gameState.adventureState.endTime) {
        endAdventure();
      }
    }
    
    // 10. 检查是否该生成来信
    checkPetLetter();
    
    // 11. 更新UI
    updateAllStats();
    
    // 12. 自动保存
    saveGameState();
    
  }, 60000); // 60秒
}

/**
 * 同步实时时钟
 */
function syncRealTimeClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

/**
 * 更新时钟显示
 */
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const timeDisplay = document.getElementById('current-time');
  if (timeDisplay) {
    timeDisplay.textContent = `${hours}:${minutes}`;
  }
  
  // 日夜切换 - 检查手动模式优先级
  const themeMode = gameState.settings?.dayNightMode || 'auto';
  const icon = document.getElementById('day-night-icon');
  
  // 使用darkmode-js API
  if (typeof Darkmode !== 'undefined') {
    // 确保darkmode实例存在
    if (!window.darkmodeInstance) {
      window.darkmodeInstance = new Darkmode();
    }
    
    const darkmode = window.darkmodeInstance;
    const isDarkMode = darkmode.isActivated();
    
    if (themeMode === 'manual') {
      // 手动模式: 使用保存的主题,不自动切换
      const savedTheme = gameState.settings?.manualTheme || 'day';
      const shouldBeDark = savedTheme === 'night';
      
      if (shouldBeDark !== isDarkMode) {
        darkmode.toggle();
      }
      
      if (icon) {
        icon.textContent = savedTheme === 'day' ? '☀️' : '🌙';
        icon.title = savedTheme === 'day' ? '当前时段：白天' : '当前时段：夜间';
      }
      updateBackgroundTheme(savedTheme);
    } else {
      // 自动模式: 根据时间自动切换 (6:00-17:59 白天, 18:00-5:59 夜间)
      const hour = now.getHours();
      const isDay = hour >= 6 && hour < 18;
      const shouldBeDark = !isDay;
      
      if (shouldBeDark !== isDarkMode) {
        darkmode.toggle();
      }
      
      if (icon) {
        icon.textContent = isDay ? '☀️' : '🌙';
        icon.title = isDay ? '当前时段：白天' : '当前时段：夜间';
      }
      updateBackgroundTheme(isDay ? 'day' : 'night');
    }
  } else {
    // 如果darkmode-js未加载，使用旧的CSS方式（兼容性）
    const body = document.body;
    if (themeMode === 'manual') {
      const savedTheme = gameState.settings?.manualTheme || 'day';
      if (body.dataset.theme !== savedTheme) {
        body.dataset.theme = savedTheme;
        if (icon) {
          icon.textContent = savedTheme === 'day' ? '☀️' : '🌙';
          icon.title = savedTheme === 'day' ? '当前时段：白天' : '当前时段：夜间';
        }
        updateBackgroundTheme(savedTheme);
      }
    } else {
      const hour = now.getHours();
      const isDay = hour >= 6 && hour < 18;
      if (isDay && body.dataset.theme !== 'day') {
        body.dataset.theme = 'day';
        if (icon) {
          icon.textContent = '☀️';
          icon.title = '当前时段：白天';
        }
        updateBackgroundTheme('day');
      } else if (!isDay && body.dataset.theme !== 'night') {
        body.dataset.theme = 'night';
        if (icon) {
          icon.textContent = '🌙';
          icon.title = '当前时段：夜间';
        }
        updateBackgroundTheme('night');
      }
    }
  }
}

/**
 * 更新背景主题
 */
function updateBackgroundTheme(theme) {
  const bgLayer = document.getElementById('background-layer');
  const phoneFrame = document.querySelector('.phone-frame');
  const gameContainer = document.querySelector('.game-container');
  const body = document.body;
  
  // 优先使用保存的背景图片
  if (gameState.settings && gameState.settings.backgroundImage && gameState.settings.backgroundImage !== 'default') {
    const bgImage = gameState.settings.backgroundImage;
    
    // 应用到 phone-frame 容器（主要背景）
    if (phoneFrame) {
      phoneFrame.style.backgroundImage = `url(${bgImage})`;
      phoneFrame.style.backgroundSize = 'cover';
      phoneFrame.style.backgroundPosition = 'center';
      phoneFrame.style.backgroundRepeat = 'no-repeat';
    }
    
    // 应用到背景层（game页面专用）
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url(${bgImage})`;
      bgLayer.style.backgroundSize = 'cover';
      bgLayer.style.backgroundPosition = 'center';
      bgLayer.style.backgroundRepeat = 'no-repeat';
      bgLayer.style.backgroundColor = 'transparent';
    }
    
    // 应用到游戏容器（games页面专用）
    if (gameContainer) {
      gameContainer.style.backgroundImage = `url(${bgImage})`;
      gameContainer.style.backgroundSize = 'cover';
      gameContainer.style.backgroundPosition = 'center';
      gameContainer.style.backgroundRepeat = 'no-repeat';
    }
    
    // 也应用到body（最外层，用于兼容）
    if (body) {
      body.style.backgroundImage = `url(${bgImage})`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
    }
  } else {
    // 使用默认主题色
    const petData = POKEMON_DATABASE[gameState.petId];
    if (petData) {
      const bgColor = theme === 'day' ? petData.theme.bgDay : petData.theme.bgNight;
      
      // 应用到 phone-frame 容器
      if (phoneFrame) {
        phoneFrame.style.backgroundColor = bgColor;
        phoneFrame.style.backgroundImage = 'none';
      }
      
      // 应用到背景层（game页面专用）
      if (bgLayer) {
        bgLayer.style.backgroundColor = bgColor;
        bgLayer.style.backgroundImage = 'none';
      }
      
      // 应用到游戏容器（games页面专用）
      if (gameContainer) {
        gameContainer.style.backgroundColor = bgColor;
        gameContainer.style.backgroundImage = 'none';
      }
      
      // 应用到body
      if (body) {
        body.style.backgroundColor = bgColor;
        body.style.backgroundImage = 'none';
      }
    }
  }
}

/**
 * 绑定游戏事件监听器
 */
function bindGameEventListeners() {
  // 主界面按钮
  const btnFeed = document.getElementById('btn-feed');
  const btnClean = document.getElementById('btn-clean');
  const btnPet = document.getElementById('btn-pet');
  const btnPlay = document.getElementById('btn-play');
  const btnAdventure = document.getElementById('btn-adventure');
  const btnChat = document.getElementById('btn-chat');
  const btnShop = document.getElementById('btn-shop');
  const btnEncyclopedia = document.getElementById('btn-encyclopedia');
  const btnSettings = document.getElementById('btn-settings');
  
  if (btnFeed) {
    btnFeed.addEventListener('click', openItemMenu);
    btnFeed.style.pointerEvents = 'auto';
    btnFeed.style.cursor = 'pointer';
  }
  if (btnClean) {
    btnClean.addEventListener('click', cleanPet);
    btnClean.style.pointerEvents = 'auto';
    btnClean.style.cursor = 'pointer';
  }
  if (btnPet) {
    btnPet.addEventListener('click', petThePet);
    btnPet.style.pointerEvents = 'auto';
    btnPet.style.cursor = 'pointer';
  }
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      window.location.href = getPagePath('play.html');
    });
    btnPlay.style.pointerEvents = 'auto';
    btnPlay.style.cursor = 'pointer';
  }
  if (btnAdventure) {
    btnAdventure.addEventListener('click', () => {
      // 先检查是否已在探险中，避免重复弹窗
      if (gameState.adventureState.isAdventuring) {
        showModal('modal-adventure');
        showAdventureProgress();
      } else {
        showModal('modal-adventure');
        showAdventureSetup();
      }
    });
    btnAdventure.style.pointerEvents = 'auto';
    btnAdventure.style.cursor = 'pointer';
  }
  if (btnChat) {
    btnChat.addEventListener('click', () => {
      showModal('modal-chat');
      renderChatHistory();
    });
    btnChat.style.pointerEvents = 'auto';
    btnChat.style.cursor = 'pointer';
  }
  if (btnShop) {
    btnShop.addEventListener('click', () => {
      window.location.href = getPagePath('shop.html');
    });
    btnShop.style.pointerEvents = 'auto';
    btnShop.style.cursor = 'pointer';
  }
  if (btnEncyclopedia) {
    btnEncyclopedia.addEventListener('click', () => {
      showModal('modal-encyclopedia');
      initEncyclopedia();
    });
    btnEncyclopedia.style.pointerEvents = 'auto';
    btnEncyclopedia.style.cursor = 'pointer';
  }
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      showModal('modal-settings');
      initSettingsPanel();
    });
    btnSettings.style.pointerEvents = 'auto';
    btnSettings.style.cursor = 'pointer';
  }
  
  // 标题栏设置按钮（新增）
  const btnSettingsHeader = document.getElementById('btn-settings-header');
  if (btnSettingsHeader) {
    btnSettingsHeader.addEventListener('click', () => {
      showModal('modal-settings');
      initSettingsPanel();
    });
    btnSettingsHeader.style.pointerEvents = 'auto';
    btnSettingsHeader.style.cursor = 'pointer';
  }
  
  // 聊天功能
  document.getElementById('send-chat-btn')?.addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    const message = input?.value.trim();
    if (message) {
      sendChatMessage(message);
      input.value = '';
    }
  });
  
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('send-chat-btn')?.click();
    }
  });
  
  // 所有关闭按钮
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.add('hidden');
    });
  });
  
  // 设置相关
  document.getElementById('bg-upload')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        gameState.settings.backgroundImage = event.target.result;
        updateBackgroundTheme(document.body.dataset.theme);
        saveGameState();
        showNotification('背景已更换！');
      };
      reader.readAsDataURL(file);
    }
  });
  
  document.getElementById('reset-bg-btn')?.addEventListener('click', () => {
    gameState.settings.backgroundImage = 'default';
    updateBackgroundTheme(document.body.dataset.theme);
    saveGameState();
    showNotification('背景已重置');
  });
  
  document.getElementById('owner-name-input')?.addEventListener('change', (e) => {
    const newName = e.target.value.trim();
    if (newName) {
      gameState.ownerName = newName;
      updatePetNamePlaceholders();
      saveGameState();
      showNotification('主人名字已更新！');
    }
  });
  
  document.getElementById('pet-nickname-input')?.addEventListener('change', (e) => {
    const newName = e.target.value.trim();
    if (newName) {
      gameState.petNickname = newName;
      updatePetNamePlaceholders();
      saveGameState();
      showNotification('昵称已更新！');
    }
  });
  
  document.getElementById('export-save-btn')?.addEventListener('click', exportSaveData);
  
  document.getElementById('import-save-btn')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });
  
  // AI任务队列相关
  const queueToggle = document.getElementById('ai-queue-toggle');
  const queuePanel = document.getElementById('ai-queue-panel');
  const queueClose = document.getElementById('ai-queue-close');
  
  if (queueToggle) {
    queueToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (queuePanel) {
        queuePanel.classList.toggle('hidden');
        if (!queuePanel.classList.contains('hidden')) {
          renderAIQueue();
        }
      }
    });
  }
  
  if (queueClose) {
    queueClose.addEventListener('click', () => {
      if (queuePanel) {
        queuePanel.classList.add('hidden');
      }
    });
  }
  
  // 点击外部关闭队列面板
  document.addEventListener('click', (e) => {
    if (queuePanel && !queuePanel.contains(e.target) && !queueToggle?.contains(e.target)) {
      queuePanel.classList.add('hidden');
    }
  });
  
  document.getElementById('import-file')?.addEventListener('change', (e) => {
    importSaveData(e.target.files[0]);
  });
  
  document.getElementById('reset-game-btn')?.addEventListener('click', resetGame);
  
  // API配置 - 不再立即保存，改为通过保存按钮统一保存
  document.querySelectorAll('input[name="api-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const useEmbedded = e.target.value === 'embedded';
      // 只更新UI显示，不保存到gameState
      document.getElementById('custom-api-config')?.classList.toggle('hidden', useEmbedded);
      document.getElementById('embedded-api-config')?.classList.toggle('hidden', !useEmbedded);
    });
  });
  
  // 温度滑块 - 不再立即保存，改为通过保存按钮统一保存
  const temperatureSlider = document.getElementById('temperature-slider');
  const temperatureValue = document.getElementById('temperature-value');
  if (temperatureSlider && temperatureValue) {
    temperatureSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      temperatureValue.textContent = value.toFixed(1);
      // 只更新UI显示，不保存到gameState
    });
  }
  
  // 模型刷新按钮 - 内嵌API
  document.getElementById('refresh-embedded-1-btn')?.addEventListener('click', () => {
    loadModelsForAPI('embedded', 1);
  });
  
  document.getElementById('refresh-embedded-2-btn')?.addEventListener('click', () => {
    loadModelsForAPI('embedded', 2);
  });
  
  // 模型刷新按钮 - 自定义API
  document.getElementById('refresh-custom-1-btn')?.addEventListener('click', () => {
    loadModelsForAPI('custom', 1);
  });
  
  document.getElementById('refresh-custom-2-btn')?.addEventListener('click', () => {
    loadModelsForAPI('custom', 2);
  });
  
  // 测试连接按钮 - 内嵌API
  document.getElementById('test-embedded-1-btn')?.addEventListener('click', () => {
    testAPIConnection('embedded', 1);
  });
  
  document.getElementById('test-embedded-2-btn')?.addEventListener('click', () => {
    testAPIConnection('embedded', 2);
  });
  
  // 测试连接按钮 - 自定义API
  document.getElementById('test-custom-1-btn')?.addEventListener('click', () => {
    testAPIConnection('custom', 1);
  });
  
  document.getElementById('test-custom-2-btn')?.addEventListener('click', () => {
    testAPIConnection('custom', 2);
  });
  
  // 模型选择变化 - 不再立即保存，改为通过保存按钮统一保存
  // 这些事件监听器保留用于UI更新，但不保存到gameState
  
  document.getElementById('toggle-api-key-visibility')?.addEventListener('click', () => {
    const input1 = document.getElementById('custom-api-key-1');
    const input2 = document.getElementById('custom-api-key-2');
    if (input1) {
      input1.type = input1.type === 'password' ? 'text' : 'password';
    }
    if (input2) {
      input2.type = input2.type === 'password' ? 'text' : 'password';
    }
  });
  
  // 保存自定义API配置
  document.getElementById('save-api-config-btn')?.addEventListener('click', () => {
    const config = gameState.settings.apiConfig;
    if (!config.customAPIs) config.customAPIs = [];
    
    // 保存API #1配置
    const apiKey1 = document.getElementById('custom-api-key-1')?.value || '';
    const endpoint1 = document.getElementById('custom-api-endpoint-1')?.value || OPENAI_API_URL;
    const model1 = document.getElementById('custom-model-select-1')?.value || '';
    const enabled1 = document.getElementById('custom-api-1-enabled')?.checked || false;
    
    if (!config.customAPIs[0]) config.customAPIs[0] = {};
    config.customAPIs[0].apiKey = apiKey1;
    config.customAPIs[0].endpoint = endpoint1;
    config.customAPIs[0].model = model1;
    config.customAPIs[0].enabled = enabled1;
    
    // 保存API #2配置
    const apiKey2 = document.getElementById('custom-api-key-2')?.value || '';
    const endpoint2 = document.getElementById('custom-api-endpoint-2')?.value || OPENAI_API_URL;
    const model2 = document.getElementById('custom-model-select-2')?.value || '';
    const enabled2 = document.getElementById('custom-api-2-enabled')?.checked || false;
    
    if (!config.customAPIs[1]) config.customAPIs[1] = {};
    config.customAPIs[1].apiKey = apiKey2;
    config.customAPIs[1].endpoint = endpoint2;
    config.customAPIs[1].model = model2;
    config.customAPIs[1].enabled = enabled2;
    
    saveGameState();
    showNotification('自定义API配置已保存');
  });
  
  
  // 图鉴标签页
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab || e.target.closest('.tab-btn')?.dataset.tab;
      if (tabName) switchEncyclopediaTab(tabName);
    });
  });
  
  // 日志视图切换按钮
  document.getElementById('view-reports-btn')?.addEventListener('click', () => {
    document.getElementById('reports-view')?.classList.remove('hidden');
    document.getElementById('logs-view')?.classList.add('hidden');
    document.getElementById('view-reports-btn')?.classList.add('active');
    document.getElementById('view-logs-btn')?.classList.remove('active');
  });
  
  document.getElementById('view-logs-btn')?.addEventListener('click', () => {
    document.getElementById('reports-view')?.classList.add('hidden');
    document.getElementById('logs-view')?.classList.remove('hidden');
    document.getElementById('view-reports-btn')?.classList.remove('active');
    document.getElementById('view-logs-btn')?.classList.add('active');
    renderAllLogs(); // 确保日志列表已渲染
  });
}

/**
 * 更新宠物名称占位符
 */
function updatePetNamePlaceholders() {
  document.querySelectorAll('.pet-name-placeholder').forEach(el => {
    el.textContent = gameState.petNickname;
  });
  
  const ownerDisplay = document.getElementById('owner-name-display');
  if (ownerDisplay) {
    ownerDisplay.textContent = gameState.ownerName;
  }
}

// ============================================================
// 模块6: 时间与成长系统
// ============================================================

/**
 * 检查成长阶段
 */
function checkGrowthStage() {
  const age = gameState.ageInHours;
  let newStage = gameState.growthStage;
  
  if (age < GAME_CONFIG.growthStages.egg) {
    newStage = 'egg';
  } else if (age < GAME_CONFIG.growthStages.egg + GAME_CONFIG.growthStages.baby) {
    newStage = 'baby';
  } else if (age < GAME_CONFIG.growthStages.egg + GAME_CONFIG.growthStages.baby + GAME_CONFIG.growthStages.teen) {
    newStage = 'teen';
  } else {
    newStage = 'adult';
  }
  
  // 触发进化
  if (newStage !== gameState.growthStage) {
    gameState.growthStage = newStage;
    playEvolutionAnimation(newStage);
    renderPetSprite();
  }
  
  // 更新年龄显示
  const days = Math.floor(age / 24);
  const hours = age % 24;
  
  const ageText = document.getElementById('age-text');
  if (ageText) {
    ageText.textContent = days > 0 ? `${days}天${hours}小时` : `${hours}小时`;
  }
  
  const stageText = document.getElementById('growth-stage-text');
  if (stageText) {
    stageText.textContent = getStageText(newStage);
  }
}

/**
 * 检查消化排泄
 */
function checkDigestion() {
  const now = Date.now();
  const minutesSinceLastFeed = Math.floor((now - gameState.physiology.lastFeedTime) / 60000);
  
  if (minutesSinceLastFeed >= GAME_CONFIG.digestionTime && 
      gameState.physiology.lastFeedTime > 0 && 
      !gameState.physiology.needsPoop) {
    gameState.physiology.needsPoop = true;
    addPoop();
    showNotification(`💩 ${gameState.petNickname} 需要上厕所了！`);
  }
}

/**
 * 添加便便
 */
function addPoop() {
  if (gameState.physiology.poopCount < GAME_CONFIG.maxPoopCount) {
    gameState.physiology.poopCount++;
    gameState.physiology.lastPoopTime = Date.now();
    gameState.physiology.needsPoop = false;
    renderPoops();
    saveGameState();
  }
}

/**
 * 渲染便便
 */
function renderPoops() {
  const poopLayer = document.getElementById('poop-layer');
  if (!poopLayer) return;
  
  poopLayer.innerHTML = '';
  
  const petData = POKEMON_DATABASE[gameState.petId];
  for (let i = 0; i < gameState.physiology.poopCount; i++) {
    const poop = document.createElement('img');
    poop.className = 'poop';
    poop.alt = '便便';
    poop.style.left = `${20 + (i * 25)}%`;
    poop.style.bottom = '15%';
    poop.addEventListener('click', cleanSinglePoop);
    loadImageWithFallback(poop, petData.assets.poop, 'assets/poop');
    poopLayer.appendChild(poop);
  }
}

/**
 * 清洁单个便便
 */
function cleanSinglePoop(event) {
  if (gameState.physiology.poopCount > 0) {
    gameState.physiology.poopCount--;
    gameState.stats.cleanliness = Math.min(100, gameState.stats.cleanliness + 15);
    gameState.stats.happiness = Math.min(100, gameState.stats.happiness + 5);
    gameState.interactions.lastCleanTime = Date.now();
    
    event.target.remove();
    playSound('clean');
    showFloatingText('+15 清洁度', event.clientX, event.clientY);
    updateAllStats();
    saveGameState();
  }
}

/**
 * 更新健康状态
 */
function updateHealthStatus() {
  const avgStats = (
    gameState.stats.hunger + 
    gameState.stats.cleanliness + 
    gameState.stats.happiness + 
    gameState.stats.energy
  ) / 4;
  
  gameState.stats.health = Math.floor(avgStats);
  
  // 检查是否生病
  if (gameState.stats.health < 30) {
    if (!gameState.physiology.isSick) {
      gameState.physiology.isSick = true;
      setPetAnimation('sick');
      showNotification(`😷 ${gameState.petNickname} 生病了！`);
    }
  } else {
    gameState.physiology.isSick = false;
  }
}

/**
 * 检查死亡条件
 */
function checkDeathCondition() {
  const criticalStats = ['hunger', 'health'];
  const now = Date.now();
  
  for (const stat of criticalStats) {
    if (gameState.stats[stat] === 0) {
      if (!gameState.deathWarningTime) {
        gameState.deathWarningTime = now;
        showNotification(`⚠️ 危险！${gameState.petNickname}快不行了！`);
      } else {
        const hoursSinceZero = (now - gameState.deathWarningTime) / 3600000;
        if (hoursSinceZero >= 6) {
          handlePetDeath();
          return;
        }
      }
    } else {
      gameState.deathWarningTime = null;
    }
  }
}

/**
 * 处理宠物死亡
 */
function handlePetDeath() {
  playSound('death');
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>😢 ${gameState.petNickname}去了宠物天堂...</h2>
      <p>陪伴了你 ${Math.floor(gameState.ageInHours / 24)} 天</p>
      <p>总共聊天 ${gameState.interactions.totalChats} 次</p>
      <p>一起探险 ${gameState.interactions.totalAdventures} 次</p>
      <button class="pixel-btn primary" onclick="resetGame()">重新开始</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// ============================================================
// 模块7: 互动功能
// ============================================================

/**
 * 打开物品菜单
 */
function openItemMenu() {
  if (gameState.inventory.items.length === 0) {
    showNotification('背包是空的，去商店购买物品吧！');
    return;
  }
  
  showItemSelectionMenu();
}

/**
 * 显示物品选择菜单（所有类型）
 */
function showItemSelectionMenu() {
  if (gameState.inventory.items.length === 0) {
    showNotification('背包是空的，去商店购买物品吧！');
    return;
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'item-selection-modal';
  
  // 按类型分类物品
  const itemsByType = {
    food: [],
    medicine: [],
    toy: [],
    tool: []
  };
  
  gameState.inventory.items.forEach(invItem => {
    const shopItem = SHOP_ITEMS.find(si => si.itemId === invItem.itemId);
    if (shopItem && itemsByType[shopItem.type]) {
      itemsByType[shopItem.type].push({ invItem, shopItem });
    }
  });
  
  // 生成分类标签
  const categories = [];
  if (itemsByType.food.length > 0) categories.push({ type: 'food', name: '食物', icon: '🍎' });
  if (itemsByType.medicine.length > 0) categories.push({ type: 'medicine', name: '药品', icon: '💊' });
  if (itemsByType.toy.length > 0) categories.push({ type: 'toy', name: '玩具', icon: '🎮' });
  if (itemsByType.tool.length > 0) categories.push({ type: 'tool', name: '工具', icon: '🔧' });
  
  // 生成物品列表HTML
  let itemsHTML = '';
  categories.forEach(category => {
    const items = itemsByType[category.type];
    itemsHTML += `
      <div class="item-category-section">
        <h4 class="category-title">${category.icon} ${category.name}</h4>
        <div class="item-selection-grid">
          ${items.map(({ invItem, shopItem }) => {
            const effectsText = Object.entries(shopItem.effects)
              .map(([stat, value]) => {
                const statNames = { hunger: '饱食度', happiness: '心情', health: '健康', energy: '精力', cleanliness: '清洁度' };
                const sign = value > 0 ? '+' : '';
                return `${sign}${value} ${statNames[stat] || stat}`;
              })
              .join(' ');
            
            return `
              <div class="item-option" data-item-id="${invItem.itemId}">
                <img src="${shopItem.icon}" alt="${shopItem.itemName}" class="item-icon" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><rect fill=%22%23ddd%22 width=%2264%22 height=%2264%22/><text x=%2232%22 y=%2240%22 text-anchor=%22middle%22 font-size=%2224%22>📦</text></svg>'">
                <div class="item-info">
                  <h4>${shopItem.itemName}</h4>
                  <p>数量: ${invItem.count}</p>
                  <p class="item-effects">${effectsText}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>选择物品</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="item-selection-container">
        ${itemsHTML || '<p style="text-align: center; padding: 20px;">没有可用物品</p>'}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 绑定选择事件
  modal.querySelectorAll('.item-option').forEach(option => {
    option.addEventListener('click', () => {
      const itemId = option.dataset.itemId;
      useItem(itemId);
      modal.remove();
    });
  });
  
  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * 显示食物选择菜单（保留作为兼容函数）
 */
function showFoodSelectionMenu(foodItems) {
  showItemSelectionMenu();
}

/**
 * 通用物品使用函数
 */
function useItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.itemId === itemId);
  const inventoryItem = gameState.inventory.items.find(i => i.itemId === itemId);
  
  if (!item) {
    showNotification('物品不存在！');
    return;
  }
  
  if (!inventoryItem || inventoryItem.count <= 0) {
    showNotification('物品不足！');
    return;
  }
  
  // 根据物品类型处理
  switch (item.type) {
    case 'food':
      useFoodItem(itemId);
      break;
    case 'medicine':
      useMedicineItem(itemId);
      break;
    case 'toy':
      useToyItem(itemId);
      break;
    case 'tool':
      useToolItem(itemId);
      break;
    default:
      showNotification('未知物品类型！');
      return;
  }
}

/**
 * 使用食物物品（内部函数）
 */
function useFoodItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.itemId === itemId);
  const inventoryItem = gameState.inventory.items.find(i => i.itemId === itemId);
  
  if (!inventoryItem || inventoryItem.count <= 0) {
    showNotification('物品不足！');
    return;
  }
  
  // 应用效果
  Object.keys(item.effects).forEach(stat => {
    if (gameState.stats[stat] !== undefined) {
      gameState.stats[stat] = Math.min(100, Math.max(0, gameState.stats[stat] + item.effects[stat]));
    }
  });
  
  // 扣除物品
  inventoryItem.count--;
  if (inventoryItem.count === 0) {
    gameState.inventory.items = gameState.inventory.items.filter(i => i.itemId !== itemId);
  }
  
  // 更新喂食时间
  gameState.physiology.lastFeedTime = Date.now();
  
  // 动画效果
  playFeedAnimation();
  const hungerChange = item.effects.hunger || 0;
  if (hungerChange > 0) {
    showFloatingText(`+${hungerChange} 饱食度`, null, null);
  }
  
  // 喂食随机响应（10个）- 使用动态口癖
  const feedResponses = [
    `好好吃~${getPetCatchphrase('short')}！`, '真美味！', '还想要~', '饱饱的~', '谢谢主人！',
    '超级好吃！', '最爱这个了！', `吃饱了${getPetCatchphrase('short')}~`, '好幸福啊~', '主人最好了！'
  ];
  showBubbleText(feedResponses[Math.floor(Math.random() * feedResponses.length)]);
  
  updateAllStats();
  saveGameState();
}

/**
 * 使用药品物品
 */
function useMedicineItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.itemId === itemId);
  const inventoryItem = gameState.inventory.items.find(i => i.itemId === itemId);
  
  if (!inventoryItem || inventoryItem.count <= 0) {
    showNotification('物品不足！');
    return;
  }
  
  // 应用效果
  let effectText = [];
  Object.keys(item.effects).forEach(stat => {
    if (gameState.stats[stat] !== undefined) {
      const oldValue = gameState.stats[stat];
      gameState.stats[stat] = Math.min(100, Math.max(0, gameState.stats[stat] + item.effects[stat]));
      const change = gameState.stats[stat] - oldValue;
      if (change !== 0) {
        const statNames = { hunger: '饱食度', happiness: '心情', health: '健康', energy: '精力', cleanliness: '清洁度' };
        effectText.push(`${change > 0 ? '+' : ''}${change} ${statNames[stat] || stat}`);
      }
    }
  });
  
  // 扣除物品
  inventoryItem.count--;
  if (inventoryItem.count === 0) {
    gameState.inventory.items = gameState.inventory.items.filter(i => i.itemId !== itemId);
  }
  
  // 动画效果
  playFeedAnimation();
  if (effectText.length > 0) {
    showFloatingText(effectText.join(' '), null, null);
  }
  showBubbleText(`感觉好多了~${getPetCatchphrase('short')}！`);
  
  updateAllStats();
  saveGameState();
}

/**
 * 使用玩具物品
 */
function useToyItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.itemId === itemId);
  const inventoryItem = gameState.inventory.items.find(i => i.itemId === itemId);
  
  if (!inventoryItem || inventoryItem.count <= 0) {
    showNotification('物品不足！');
    return;
  }
  
  // 应用效果
  let effectText = [];
  Object.keys(item.effects).forEach(stat => {
    if (gameState.stats[stat] !== undefined) {
      const oldValue = gameState.stats[stat];
      gameState.stats[stat] = Math.min(100, Math.max(0, gameState.stats[stat] + item.effects[stat]));
      const change = gameState.stats[stat] - oldValue;
      if (change !== 0) {
        const statNames = { hunger: '饱食度', happiness: '心情', health: '健康', energy: '精力', cleanliness: '清洁度' };
        effectText.push(`${change > 0 ? '+' : ''}${change} ${statNames[stat] || stat}`);
      }
    }
  });
  
  // 扣除物品
  inventoryItem.count--;
  if (inventoryItem.count === 0) {
    gameState.inventory.items = gameState.inventory.items.filter(i => i.itemId !== itemId);
  }
  
  // 动画效果
  playFeedAnimation();
  if (effectText.length > 0) {
    showFloatingText(effectText.join(' '), null, null);
  }
  showBubbleText(`好好玩~${getPetCatchphrase('short')}！`);
  
  updateAllStats();
  saveGameState();
}

/**
 * 使用工具物品
 */
function useToolItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.itemId === itemId);
  const inventoryItem = gameState.inventory.items.find(i => i.itemId === itemId);
  
  if (!inventoryItem || inventoryItem.count <= 0) {
    showNotification('物品不足！');
    return;
  }
  
  // 应用效果
  let effectText = [];
  Object.keys(item.effects).forEach(stat => {
    if (gameState.stats[stat] !== undefined) {
      const oldValue = gameState.stats[stat];
      gameState.stats[stat] = Math.min(100, Math.max(0, gameState.stats[stat] + item.effects[stat]));
      const change = gameState.stats[stat] - oldValue;
      if (change !== 0) {
        const statNames = { hunger: '饱食度', happiness: '心情', health: '健康', energy: '精力', cleanliness: '清洁度' };
        effectText.push(`${change > 0 ? '+' : ''}${change} ${statNames[stat] || stat}`);
      }
    }
  });
  
  // 扣除物品
  inventoryItem.count--;
  if (inventoryItem.count === 0) {
    gameState.inventory.items = gameState.inventory.items.filter(i => i.itemId !== itemId);
  }
  
  // 动画效果
  playFeedAnimation();
  if (effectText.length > 0) {
    showFloatingText(effectText.join(' '), null, null);
  }
  showBubbleText(`谢谢~${getPetCatchphrase('short')}！`);
  
  updateAllStats();
  saveGameState();
}

/**
 * 清洁宠物
 */
function cleanPet() {
  if (gameState.stats.cleanliness >= 90 && gameState.physiology.poopCount === 0) {
    showNotification('已经很干净了哦~');
    return;
  }
  
  // 清理所有便便
  gameState.physiology.poopCount = 0;
  renderPoops();
  
  // 增加清洁度
  gameState.stats.cleanliness = Math.min(100, gameState.stats.cleanliness + 30);
  gameState.stats.happiness = Math.min(100, gameState.stats.happiness + 10);
  gameState.interactions.lastCleanTime = Date.now();
  
  playCleanAnimation();
  showNotification('✨ 清洁完成！');
  
  // 清扫随机响应（10个）- 使用动态口癖
  const cleanResponses = [
    `好舒服~${getPetCatchphrase('double')}！`, '干净清爽！', `舒服${getPetCatchphrase('short')}~`, '焕然一新！', '谢谢清洗~',
    '好清爽！', '香香的~', '干干净净！', '浑身舒畅！', `${getPetCatchphrase('short')}好开心~`
  ];
  showBubbleText(cleanResponses[Math.floor(Math.random() * cleanResponses.length)]);
  
  updateAllStats();
  saveGameState();
}

/**
 * 抚摸宠物
 */
function petThePet() {
  const now = Date.now();
  const timeSinceLastPet = (now - gameState.interactions.lastPetTime) / 60000;
  
  if (timeSinceLastPet < 1) {
    showNotification('不要摸太频繁哦~ 让我休息一下');
    return;
  }
  
  gameState.stats.happiness = Math.min(100, gameState.stats.happiness + 10);
  gameState.interactions.lastPetTime = now;
  
  playPetAnimation();
  setPetAnimation('happy');
  
  // 抚摸随机响应（10个）- 使用动态口癖
  const petResponses = [
    `${getPetCatchphrase('short')}${getPetCatchphrase('short')}~`, '好舒服~', `${getPetCatchphrase('double')}！`, '嘿嘿~', '喜欢喜欢！',
    '再摸摸~', `幸福${getPetCatchphrase('short')}~`, '主人的手好温暖', `开心${getPetCatchphrase('short')}！`, '继续继续~'
  ];
  showBubbleText(petResponses[Math.floor(Math.random() * petResponses.length)]);
  
  setTimeout(() => renderPetSprite(), 2000);
  
  updateAllStats();
  saveGameState();
}

// ============================================================
// 模块8: AI系统
// ============================================================

/**
 * 获取当前API配置
 */
function getAPIConfig() {
  const config = gameState.settings.apiConfig;
  
  // 向后兼容：如果是旧版配置，自动转换为新格式
  if (!config.embeddedAPIs || !config.customAPIs) {
    console.log('📦 检测到旧版API配置，正在转换...');
    migrateToNewAPIConfig();
  }
  
  const index = config.currentAPIIndex || 0;
  
  if (config.useEmbeddedAPI) {
    // 使用内嵌API
    const apis = config.embeddedAPIs || [];
    const enabledAPIs = apis.filter(api => api.enabled && api.model);
    
    if (enabledAPIs.length === 0) {
      // 没有启用的API，使用默认配置
      return {
        apiKey: 'sk-11api',
        endpoint: 'https://11api/v1/chat/completions',
        model: 'gemini-2.5-flash',
        temperature: config.temperature !== undefined ? config.temperature : 0.9
      };
    }
    
    // 循环索引，确保不越界
    const apiIndex = index % enabledAPIs.length;
    const selectedAPI = enabledAPIs[apiIndex];
    
    return {
      apiKey: selectedAPI.apiKey || 'sk-11api',
      endpoint: selectedAPI.endpoint || 'https://11apiv1/chat/completions',
      model: selectedAPI.model,
      temperature: config.temperature !== undefined ? config.temperature : 0.9
    };
  } else {
    // 使用自定义API
    const apis = config.customAPIs || [];
    const enabledAPIs = apis.filter(api => api.enabled && api.apiKey && api.endpoint && api.model);
    
    if (enabledAPIs.length === 0) {
      console.error('❌ 没有可用的自定义API配置');
      showNotification('⚠️ 没有可用的自定义API，请检查设置');
      throw new Error('没有可用的自定义API配置');
    }
    
    // 循环索引，确保不越界
    const apiIndex = index % enabledAPIs.length;
    const selectedAPI = enabledAPIs[apiIndex];
    
    return {
      apiKey: selectedAPI.apiKey,
      endpoint: selectedAPI.endpoint,
      model: selectedAPI.model,
      temperature: config.temperature !== undefined ? config.temperature : 0.9
    };
  }
}

/**
 * 将旧版API配置迁移到新格式
 */
function migrateToNewAPIConfig() {
  const config = gameState.settings.apiConfig;
  
  // 创建新的embeddedAPIs数组
  if (!config.embeddedAPIs) {
    config.embeddedAPIs = [
      {
        apiKey: config.embeddedAPIKey || 'sk-11api',
        endpoint: config.embeddedAPIEndpoint || 'https://11apiv1/chat/completions',
        model: config.embeddedModel || 'gemini-2.5-flash',
        enabled: true
      },
      {
        apiKey: '',
        endpoint: 'https://11api/v1/chat/completions',
        model: '',
        enabled: false
      }
    ];
  }
  
  // 创建新的customAPIs数组
  if (!config.customAPIs) {
    config.customAPIs = [
      {
        apiKey: config.customAPIKey || '',
        endpoint: config.customAPIEndpoint || '',
        model: config.customModel || '',
        enabled: true
      },
      {
        apiKey: '',
        endpoint: '',
        model: '',
        enabled: false
      }
    ];
  }
  
  // 初始化索引
  if (config.currentAPIIndex === undefined) {
    config.currentAPIIndex = 0;
  }
  
  console.log('✅ API配置已迁移到新格式');
  saveGameState();
}

/**
 * 切换到下一个可用的API（失败切换模式）
 */
function switchToNextAPI() {
  const config = gameState.settings.apiConfig;
  const apis = config.useEmbeddedAPI ? 
    (config.embeddedAPIs || []).filter(api => api.enabled && api.model) :
    (config.customAPIs || []).filter(api => api.enabled && api.apiKey && api.endpoint && api.model);
  
  if (apis.length <= 1) {
    console.warn('⚠️ 只有一个可用的API，无法切换');
    return false;
  }
  
  // 切换到下一个API
  config.currentAPIIndex = (config.currentAPIIndex + 1) % apis.length;
  console.log(`🔄 已切换到API #${config.currentAPIIndex + 1}`);
  showNotification(`🔄 API切换到备用 #${config.currentAPIIndex + 1}`);
  saveGameState();
  
  return true;
}

/**
 * 从API端点获取可用模型列表
 */
async function fetchModels(endpoint, apiKey) {
  try {
    // 将 /chat/completions 替换为 /models，支持多种格式
    let modelsEndpoint = endpoint;
    if (endpoint.includes('/chat/completions')) {
      modelsEndpoint = endpoint.replace('/chat/completions', '/models');
    } else if (endpoint.includes('/v1')) {
      // 如果端点包含 /v1 但没有 /chat/completions，尝试添加 /models
      modelsEndpoint = endpoint.replace(/\/v1\/?$/, '/v1/models');
    } else {
      // 否则在端点末尾添加 /models
      modelsEndpoint = endpoint.replace(/\/$/, '') + '/models';
    }
    
    console.log('🔍 正在获取模型列表，端点:', modelsEndpoint);
    
    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API响应错误:', response.status, response.statusText, errorText);
      showNotification(`❌ 获取模型列表失败: ${response.status}`);
      throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📦 API返回数据:', data);
    
    if (data.data && Array.isArray(data.data)) {
      // 提取所有模型ID，不过滤，显示所有可用模型
      const models = data.data
        .map(item => item.id)
        .filter(id => id && typeof id === 'string') // 只过滤掉无效的ID
        .sort();
      
      console.log('✅ 成功获取模型列表:', models);
      if (models.length > 0) {
        showNotification(`✅ 成功获取 ${models.length} 个模型`);
        return models;
      }
      return null;
    }
    
    // 如果数据格式不对，尝试其他可能的格式
    if (Array.isArray(data)) {
      const models = data
        .map(item => item.id || item)
        .filter(id => id && typeof id === 'string')
        .sort();
      console.log('✅ 成功获取模型列表（数组格式）:', models);
      if (models.length > 0) {
        showNotification(`✅ 成功获取 ${models.length} 个模型`);
        return models;
      }
      return null;
    }
    
    console.warn('⚠️ 无法解析模型列表数据格式:', data);
    showNotification('⚠️ API返回格式不符合预期');
    return null;
  } catch (error) {
    console.error('❌ 获取模型列表失败:', error);
    showNotification(`❌ 获取模型列表失败: ${error.message}`);
    return null;
  }
}

/**
 * 获取特定API的配置
 */
function getSpecificAPIConfig(apiType, apiNumber) {
  const config = gameState.settings.apiConfig;
  const apiIndex = apiNumber - 1; // 转换为0-based索引
  
  // 向后兼容：如果是旧版配置，自动转换为新格式
  if (!config.embeddedAPIs || !config.customAPIs) {
    migrateToNewAPIConfig();
  }
  
  if (apiType === 'embedded') {
    const apis = config.embeddedAPIs || [];
    if (apiIndex < apis.length) {
      const api = apis[apiIndex];
      return {
        apiKey: api.apiKey || 'sk-11api',
        endpoint: api.endpoint || 'https://api.11api/v1/chat/completions',
        model: api.model || 'gemini-2.5-flash',
        enabled: api.enabled !== false
      };
    }
    // 默认值
    return {
      apiKey: 'sk-11api',
      endpoint: 'https://api.11api/v1/chat/completions',
      model: 'gemini-2.5-flash',
      enabled: true
    };
  } else {
    const apis = config.customAPIs || [];
    if (apiIndex < apis.length) {
      const api = apis[apiIndex];
      return {
        apiKey: api.apiKey || '',
        endpoint: api.endpoint || OPENAI_API_URL,
        model: api.model || '',
        enabled: api.enabled !== false
      };
    }
    return {
      apiKey: '',
      endpoint: OPENAI_API_URL,
      model: '',
      enabled: false
    };
  }
}

/**
 * 为指定API类型和编号加载模型列表
 */
async function loadModelsForAPI(apiType, apiNumber = 1) {
  const isEmbedded = apiType === 'embedded';
  const apiConfig = getSpecificAPIConfig(apiType, apiNumber);
  
  const modelSelectId = `${apiType}-model-select-${apiNumber}`;
  const refreshBtnId = `refresh-${apiType}-${apiNumber}-btn`;
  
  const modelSelect = document.getElementById(modelSelectId);
  const refreshBtn = document.getElementById(refreshBtnId);
  
  if (!modelSelect) {
    console.error(`找不到模型选择器: ${modelSelectId}`);
    return;
  }
  
  // 显示加载状态
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '加载中...';
  }
  
  // 验证自定义API配置（在调用fetchModels之前）
  if (apiType === 'custom') {
    if (!apiConfig.apiKey || !apiConfig.apiKey.trim()) {
      showNotification(`⚠️ 自定义API #${apiNumber}未配置密钥，使用预设模型列表`);
      // 使用预设模型列表
      const models = CUSTOM_MODELS;
      const currentValue = modelSelect.value;
      modelSelect.innerHTML = '';
      models.forEach(modelId => {
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = modelId;
        modelSelect.appendChild(option);
      });
      if (currentValue && models.includes(currentValue)) {
        modelSelect.value = currentValue;
      } else if (models.length > 0) {
        modelSelect.value = models[0];
      }
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 刷新模型';
      }
      return;
    }
    if (!apiConfig.endpoint || !apiConfig.endpoint.trim()) {
      showNotification(`⚠️ 自定义API #${apiNumber}未配置端点，使用预设模型列表`);
      // 使用预设模型列表
      const models = CUSTOM_MODELS;
      const currentValue = modelSelect.value;
      modelSelect.innerHTML = '';
      models.forEach(modelId => {
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = modelId;
        modelSelect.appendChild(option);
      });
      if (currentValue && models.includes(currentValue)) {
        modelSelect.value = currentValue;
      } else if (models.length > 0) {
        modelSelect.value = models[0];
      }
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 刷新模型';
      }
      return;
    }
  }
  
  showNotification(`正在拉取API #${apiNumber}模型列表...`);
  
  try {
    // 尝试从API获取模型列表
    let models = await fetchModels(apiConfig.endpoint, apiConfig.apiKey);
    
    // 如果获取失败，使用预设列表
    if (!models) {
      models = isEmbedded ? EMBEDDED_MODELS : CUSTOM_MODELS;
      showNotification(`API #${apiNumber}使用预设模型列表`);
    } else {
      showNotification(`API #${apiNumber}成功拉取模型列表`);
    }
    
    // 清空现有选项（保留当前选中的值）
    const currentValue = modelSelect.value;
    modelSelect.innerHTML = '';
    
    // 添加模型选项
    models.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      modelSelect.appendChild(option);
    });
    
    // 恢复选中值（如果存在）
    if (currentValue && models.includes(currentValue)) {
      modelSelect.value = currentValue;
    } else if (models.length > 0) {
      // 如果当前值不存在，选择第一个
      modelSelect.value = models[0];
    }
    
    // 注意：这里不自动保存，模型选择需要通过保存按钮统一保存
    // 只更新UI显示，不更新gameState
    
  } catch (error) {
    console.error(`加载API #${apiNumber}模型列表失败:`, error);
    showNotification(`API #${apiNumber}加载模型列表失败: ` + error.message);
    
    // 失败时使用预设列表
    const models = isEmbedded ? EMBEDDED_MODELS : CUSTOM_MODELS;
    modelSelect.innerHTML = '';
    models.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      modelSelect.appendChild(option);
    });
  } finally {
    // 恢复按钮状态
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 刷新模型';
    }
  }
}

/**
 * 带重试的AI请求(串行执行)
 */
async function retryAIRequest(model, messages, maxRetries = 3, priority = 0, taskType = 'unknown', taskDescription = '') {
  return aiRequestQueue.add(async () => {
    let apiConfig;
    try {
      apiConfig = getAPIConfig();
    } catch (error) {
      // 捕获getAPIConfig抛出的错误（自定义API无配置）
      console.error('❌ 获取API配置失败:', error);
      showNotification('⚠️ API配置错误: ' + error.message);
      throw error; // 重新抛出，让队列系统处理
    }
    
    const { apiKey, endpoint, model: defaultModel, temperature } = apiConfig;
    
    if (!apiKey || !apiKey.trim()) {
      throw new Error('未配置API密钥，请在设置中配置');
    }
    
    if (!endpoint || !endpoint.trim()) {
      throw new Error('未配置API端点，请在设置中配置');
    }
    
    const actualModel = model || defaultModel;
    const actualTemperature = temperature;
    
    // 根据任务类型动态设置max_tokens
    let maxTokens = 500; // 默认值
    if (taskType === 'adventure') {
      maxTokens = 8000; // 探险需要生成大量JSON内容，包括事件、奖励、宝物等（增加到8000）
    } else if (taskType === 'letter') {
      maxTokens = 1500; // 信件内容需要更多token（增加到1500）
    } else if (taskType === 'chat') {
      maxTokens = 500; // 聊天回复（保持500不变）
    } else if (taskType === 'report') {
      maxTokens = 2500; // 相处报告需要更多token来写日记形式的诗意内容（增加到2500）
    }
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 AI请求 (尝试 ${attempt}/${maxRetries}) [${taskType}] - ${taskDescription}...`);
        console.log(`📝 使用模型: ${actualModel}, max_tokens: ${maxTokens}`);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: actualModel,
            messages: messages,
            max_tokens: maxTokens,
            temperature: actualTemperature
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API响应错误:', response.status, response.statusText);
          console.error('错误详情:', errorText);
          throw new Error(`API错误: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // 详细记录API响应（用于调试）
        console.log('📦 API完整响应:', JSON.stringify(data, null, 2));
        
        // 检查API返回的错误信息
        if (data.error) {
          console.error('API返回错误:', data.error);
          throw new Error(`API错误: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        if (!data.choices || !Array.isArray(data.choices)) {
          console.error('API返回数据格式错误（缺少choices）:', data);
          throw new Error('API返回格式错误：缺少choices数组');
        }
        
        if (data.choices.length === 0) {
          console.error('API返回空choices数组，可能是模型问题:', data);
          throw new Error(`模型"${actualModel}"返回了空响应，请尝试切换其他模型`);
        }
        
        if (!data.choices[0]) {
          console.error('API返回数据格式错误:', data);
          throw new Error('AI返回数据格式错误：choices[0]为空');
        }
        
        const choice = data.choices[0];
        console.log('📋 Choice对象:', JSON.stringify(choice, null, 2));
        
        // 检查finish_reason，如果是length或content_filter，说明内容被截断或过滤
        if (choice.finish_reason) {
          console.log('🏁 Finish reason:', choice.finish_reason);
          if (choice.finish_reason === 'length') {
            console.warn('⚠️ 响应因达到max_tokens限制而被截断');
          } else if (choice.finish_reason === 'content_filter') {
            console.warn('⚠️ 响应被内容过滤器拦截');
          }
        }
        
        const content = choice.message?.content;
        
        // 验证返回内容是否有效
        if (!content || typeof content !== 'string') {
          console.error('AI返回内容类型错误:', typeof content, content);
          console.error('完整choice对象:', choice);
          throw new Error('AI返回内容为空或格式错误');
        }
        
        const trimmedContent = content.trim();
        console.log('📄 返回内容长度:', trimmedContent.length, '字符');
        console.log('📄 返回内容预览:', trimmedContent.substring(0, 300));
        
        if (!trimmedContent) {
          throw new Error('AI返回内容为空');
        }
        
        // 改进错误检测逻辑：更严格地判断是否是真正的错误消息
        // 只有当内容非常短（<50字符）且明确包含错误提示时才认为是错误
        const errorPatterns = [
          /空响应次数达到上限/i,
          /请修改输入提示词/i,
          /无法生成/i,
          /生成失败/i
        ];
        
        const isShortError = trimmedContent.length < 50 && 
          errorPatterns.some(pattern => pattern.test(trimmedContent));
        
        if (isShortError) {
          console.error('❌ 检测到AI返回的错误消息:', trimmedContent);
          console.error('📊 错误消息长度:', trimmedContent.length);
          console.error('📊 匹配的错误模式:', errorPatterns.find(p => p.test(trimmedContent)));
          // 对于这种错误，尝试提供更友好的错误信息
          throw new Error(`AI服务返回错误: ${trimmedContent}。这可能是因为提示词触发了API限制，请尝试简化提示词或联系API服务提供商。`);
        }
        
        // 对于探险任务，检查是否包含JSON结构
        if (taskType === 'adventure' && !trimmedContent.includes('{') && !trimmedContent.includes('[')) {
          console.warn('探险任务返回内容可能不是JSON格式:', trimmedContent.substring(0, 200));
          // 不直接抛出错误，让后续的JSON解析来处理
        }
        
        console.log(`✅ AI请求成功，返回内容长度: ${trimmedContent.length} 字符`);
        if (taskType === 'adventure') {
          console.log('📦 返回内容预览:', trimmedContent.substring(0, 200) + '...');
        }
        
        return trimmedContent;
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ 尝试 ${attempt} 失败:`, error.message);
        if (error.stack) {
          console.warn('错误堆栈:', error.stack);
        }
        
        if (attempt < maxRetries) {
          const delay = 1000 * attempt;
          console.log(`⏳ ${delay}ms后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 所有重试均失败，尝试切换API
    console.error(`❌ 所有重试均失败，最后错误:`, lastError);
    
    // 尝试切换到下一个可用的API
    const switched = switchToNextAPI();
    if (switched) {
      console.log('🔄 已切换API，将使用新的API重试一次...');
      // 使用新API重试一次（只尝试一次，避免无限递归）
      try {
        let newApiConfig;
        try {
          newApiConfig = getAPIConfig();
        } catch (configError) {
          console.error('❌ 获取新API配置失败:', configError);
          showNotification('⚠️ 切换API后配置错误: ' + configError.message);
          throw configError; // 重新抛出，让外层catch处理
        }
        const { apiKey: newApiKey, endpoint: newEndpoint, model: newModel, temperature: newTemp } = newApiConfig;
        
        if (!newApiKey || !newApiKey.trim()) {
          throw new Error('新API未配置密钥');
        }
        if (!newEndpoint || !newEndpoint.trim()) {
          throw new Error('新API未配置端点');
        }
        console.log(`🤖 使用新API重试 [${taskType}] - ${taskDescription}...`);
        console.log(`📝 新API模型: ${newModel}, max_tokens: ${maxTokens}`);
        
        const response = await fetch(newEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newApiKey}`
          },
          body: JSON.stringify({
            model: newModel,
            messages: messages,
            max_tokens: maxTokens,
            temperature: newTemp
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('新API响应错误:', response.status, response.statusText, errorText);
          throw new Error(`新API错误: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          console.error('新API返回错误:', data.error);
          throw new Error(`新API错误: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        if (!data.choices || !data.choices[0]) {
          throw new Error('新API返回数据格式错误');
        }
        
        const content = data.choices[0].message?.content;
        if (!content || typeof content !== 'string' || !content.trim()) {
          throw new Error('新API返回内容为空或格式错误');
        }
        
        console.log(`✅ 使用新API请求成功！`);
        return content.trim();
        
      } catch (newApiError) {
        console.error('❌ 新API也失败了:', newApiError);
        // 新API也失败，抛出原始错误
        throw lastError;
      }
    } else {
      // 无法切换API（只有一个API或配置问题）
      throw lastError;
    }
  }, priority, taskType, taskDescription);
}

/**
 * 逐字显示文本效果
 */
function typeText(element, text, speed = 30) {
  return new Promise((resolve) => {
    let index = 0;
    element.textContent = '';
    
    const typeInterval = setInterval(() => {
      if (index < text.length) {
        element.textContent += text[index];
        index++;
      } else {
        clearInterval(typeInterval);
        resolve();
      }
    }, speed);
  });
}

/**
 * 发送聊天消息
 */
async function sendChatMessage(userMessage) {
  const now = Date.now();
  gameState.interactions.lastChatTime = now;
  gameState.interactions.totalChats++;
  
  // 添加用户消息
  gameState.aiData.chatHistory.push({
    role: 'user',
    content: userMessage,
    timestamp: now
  });
  
  appendChatBubble('user', userMessage);
  const loadingBubble = appendChatBubble('assistant', '正在思考...');
  
  // 异步处理，不阻塞窗口
  (async () => {
    try {
      const petData = POKEMON_DATABASE[gameState.petId];
      const baseSystemPrompt = petData.aiPersonality.systemPrompt.replace('{{OWNER_NAME}}', gameState.ownerName);
      
      // 添加当前时间信息
      const nowDate = new Date();
      const currentHour = nowDate.getHours();
      const timeOfDay = currentHour >= 6 && currentHour < 12 ? '早上' : 
                        currentHour >= 12 && currentHour < 18 ? '下午' : 
                        currentHour >= 18 && currentHour < 22 ? '晚上' : '深夜';
      const systemPrompt = `${baseSystemPrompt}\n\n当前时间：${timeOfDay} ${currentHour}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
      
      const recentHistory = gameState.aiData.chatHistory.slice(-10).map(h => ({
        role: h.role,
        content: h.content
      }));
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentHistory
      ];
      
      const apiConfig = getAPIConfig();
      // 聊天请求使用高优先级
      const aiReply = await retryAIRequest(apiConfig.model, messages, 3, 10, 'chat', `回复：${userMessage.substring(0, 20)}...`);
      
      gameState.aiData.chatHistory.push({
        role: 'assistant',
        content: aiReply,
        timestamp: Date.now()
      });
      
      // 记录到统一日志
      addUnifiedLog('chat', {
        userMessage: userMessage,
        aiReply: aiReply
      });
      
      // 移除加载气泡,创建新的回复气泡并逐字显示
      loadingBubble.remove();
      const replyBubble = appendChatBubble('assistant', '', Date.now());
      await typeText(replyBubble, aiReply, 30);
      
      showBubbleText(aiReply.substring(0, 15) + '...');
      
      gameState.stats.happiness = Math.min(100, gameState.stats.happiness + 5);
      updateAllStats();
      saveGameState();
      
      // 弹窗通知
      showTaskResultModal('chat', '💬 聊天回复已生成', aiReply);
      
    } catch (error) {
      console.error('聊天失败:', error);
      loadingBubble.remove();
      appendChatBubble('assistant', '抱歉，我现在有点累...要不等会儿再聊？', Date.now());
      showNotification('AI服务暂时不可用：' + error.message);
    }
  })();
}
/**
 * 渲染聊天历史
 */
function renderChatHistory() {
  const chatHistory = document.getElementById('chat-history');
  if (!chatHistory) return;
  
  chatHistory.innerHTML = '';
  
  const recent = gameState.aiData.chatHistory.slice(-20);
  recent.forEach(msg => {
    appendChatBubble(msg.role, msg.content, msg.timestamp);
  });
  
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * 获取宠物口癖（支持不同变体）
 * @param {string} variation - 口癖变体：'short'(短), 'double'(重复), 'happy'(开心), 'normal'(默认)
 * @returns {string} 口癖文本
 */
function getPetCatchphrase(variation = 'normal') {
  const petData = POKEMON_DATABASE[gameState.petId];
  const base = petData?.catchphrase || '喵';
  
  switch(variation) {
    case 'short': 
      return base;  // "皮卡"
    case 'double': 
      return `${base}${base}`;  // "皮卡皮卡"
    case 'happy': 
      return `${base}~`;  // "皮卡~"
    case 'excited':
      return `${base}${base}${base}！`;  // "皮卡皮卡皮卡！"
    default: 
      return base;
  }
}

/**
 * 格式化时间显示（支持相对时间）
 */
function formatTime(timestamp, showRelative = true) {
  const now = Date.now();
  const diff = now - timestamp;
  
  // 如果启用相对时间且时间差小于24小时
  if (showRelative && diff < 24 * 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    }
  }
  
  // 显示绝对时间
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  if (isToday) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `今天 ${hours}:${minutes}`;
  } else {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  }
}

/**
 * 格式化完整时间显示（用于来信等需要详细时间的场景）
 */
function formatFullTime(timestamp, showRelative = true) {
  const now = Date.now();
  const diff = now - timestamp;
  
  // 如果启用相对时间且时间差小于24小时
  if (showRelative && diff < 24 * 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) {
      return '刚刚';
    } else if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    }
  }
  
  // 显示完整日期时间
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  if (isToday) {
    return `今天 ${hours}:${minutes}`;
  } else if (isYesterday) {
    return `昨天 ${hours}:${minutes}`;
  } else {
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * 初始化AI任务队列UI
 */
function initAIQueueUI() {
  // 设置队列渲染回调
  aiRequestQueue.setRenderCallback(() => {
    renderAIQueue();
    updateQueueBadge();
  });
  
  // 初始渲染
  renderAIQueue();
  updateQueueBadge();
  
  // 定期更新队列显示
  setInterval(() => {
    renderAIQueue();
    updateQueueBadge();
  }, 1000);
}

/**
 * 渲染AI任务队列
 */
function renderAIQueue() {
  const queueList = document.getElementById('ai-queue-list');
  if (!queueList) return;
  
  const tasks = aiRequestQueue.getAllTasks();
  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing' || t.status === 'completed' || t.status === 'failed');
  
  if (activeTasks.length === 0) {
    queueList.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--text-secondary); font-size: 10px;">暂无任务</div>';
    return;
  }
  
  const typeIcons = {
    'chat': '💬',
    'letter': '💌',
    'adventure': '🗺️',
    'image': '🖼️',
    'treasure': '💎',
    'report': '📊',
    'unknown': '🤖'
  };
  
  const statusTexts = {
    'pending': '等待中',
    'processing': '处理中',
    'completed': '已完成',
    'failed': '失败',
    'cancelled': '已取消'
  };
  
  queueList.innerHTML = activeTasks.map(task => {
    const duration = task.endTime ? 
      Math.floor((task.endTime - task.startTime) / 1000) : 
      Math.floor((Date.now() - task.startTime) / 1000);
    const durationText = duration < 60 ? `${duration}秒` : `${Math.floor(duration / 60)}分${duration % 60}秒`;
    
    return `
      <div class="queue-item ${task.status}">
        <div class="queue-item-header">
          <div class="queue-item-type">
            <span>${typeIcons[task.type] || '🤖'}</span>
            <span>${task.description || task.type}</span>
          </div>
          <span class="queue-item-status">${statusTexts[task.status] || task.status}</span>
        </div>
        <div class="queue-item-description">
          耗时: ${durationText}
        </div>
        ${task.status === 'pending' || task.status === 'processing' ? `
          <div class="queue-item-actions">
            <button class="queue-cancel-btn" onclick="cancelAITask('${task.id}')">取消</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * 更新队列徽章
 */
function updateQueueBadge() {
  const badge = document.getElementById('ai-queue-count');
  if (!badge) return;
  
  const count = aiRequestQueue.getActiveTaskCount();
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * 取消AI任务
 */
function cancelAITask(taskId) {
  aiRequestQueue.cancelTask(taskId);
}

/**
 * 显示任务结果弹窗
 */
function showTaskResultModal(type, title, content) {
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.style.zIndex = '10000';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div style="padding: var(--space-md); max-height: 300px; overflow-y: auto;">
        <p style="word-break: break-word; white-space: pre-wrap;">${content}</p>
      </div>
      <div style="padding: var(--space-sm) var(--space-md); text-align: right;">
        <button class="pixel-btn primary" onclick="this.closest('.modal').remove()">确定</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 3秒后自动关闭
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 3000);
}

/**
 * 添加聊天气泡
 */
function appendChatBubble(role, content, timestamp = null) {
  const chatHistory = document.getElementById('chat-history');
  if (!chatHistory) return null;
  
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  const actualTimestamp = timestamp || Date.now();
  bubble.dataset.timestamp = actualTimestamp;
  
  const name = role === 'user' ? gameState.ownerName : gameState.petNickname;
  const timeStr = formatTime(actualTimestamp);
  
  bubble.innerHTML = `
    <div class="bubble-header">
      <span class="bubble-name">${name}</span>
      <span class="bubble-time">${timeStr}</span>
      <button class="delete-chat-btn" title="删除">🗑️</button>
    </div>
    <div class="bubble-content">${content}</div>
  `;
  
  // 绑定删除事件
  const deleteBtn = bubble.querySelector('.delete-chat-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChatMessage(actualTimestamp);
    });
  }
  
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return bubble;
}

/**
 * 删除聊天记录
 * @param {number} timestamp - 要删除的聊天记录时间戳
 */
function deleteChatMessage(timestamp) {
  if (!confirm('确定要删除这条聊天记录吗？')) return;
  
  // 从chatHistory中删除
  const chatIndex = gameState.aiData.chatHistory.findIndex(msg => msg.timestamp === timestamp);
  if (chatIndex !== -1) {
    gameState.aiData.chatHistory.splice(chatIndex, 1);
  }
  
  // 从unifiedLogs中删除对应的聊天日志
  gameState.aiData.unifiedLogs = gameState.aiData.unifiedLogs.filter(log => {
    return !(log.type === 'chat' && log.timestamp === timestamp);
  });
  
  // 保存并刷新界面
  saveGameState();
  renderChatHistory();
  showNotification('✅ 聊天记录已删除');
}

/**
 * 添加统一日志
 */
function addUnifiedLog(type, content) {
  const logEntry = {
    logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: type,
    timestamp: Date.now(),
    content: content
  };
  
  gameState.aiData.unifiedLogs.push(logEntry);
  
  // 检查是否需要触发总结
  const currentCount = gameState.aiData.unifiedLogs.length;
  const lastCount = gameState.aiData.lastSummaryLogCount;
  
  if (currentCount - lastCount >= 50) {
    triggerLogSummary();
  }
  
  saveGameState();
}

/**
 * 触发日志总结
 */
async function triggerLogSummary() {
  try {
    const recentLogs = gameState.aiData.unifiedLogs.slice(-50);
    if (recentLogs.length === 0) {
      return; // 没有日志需要处理
    }
    
    const summary = await generateLogSummary(recentLogs);
    
    // 记录已处理的日志ID
    const processedLogIds = recentLogs.map(log => log.logId);
    
    gameState.aiData.logSummaries.push({
      summaryId: `summary_${Date.now()}`,
      timestamp: Date.now(),
      coveredLogs: recentLogs.length,
      aiSummary: summary,
      processedLogIds: processedLogIds // 保存已处理的日志ID
    });
    
    // 从unifiedLogs中删除已处理的日志条目
    gameState.aiData.unifiedLogs = gameState.aiData.unifiedLogs.filter(
      log => !processedLogIds.includes(log.logId)
    );
    
    gameState.aiData.lastSummaryLogCount = gameState.aiData.unifiedLogs.length;
    saveGameState();
    showNotification('📊 生成了一份新的相处报告！');
    
  } catch (error) {
    console.error('日志总结失败:', error);
  }
}

/**
 * 生成日志总结
 */
async function generateLogSummary(logs) {
  const logsSummary = logs.slice(-50).map(log => {
    switch (log.type) {
      case 'chat':
        return `聊天: ${log.content.userMessage?.substring(0, 20) || ''}...`;
      case 'adventure_event':
        return `探险: ${log.content.eventName || ''}`;
      default:
        return `${log.type}`;
    }
  }).join(', ');
  
  // 获取当前时间信息
  const nowDate = new Date();
  const currentHour = nowDate.getHours();
  const timeOfDay = currentHour >= 6 && currentHour < 12 ? '早上' : 
                    currentHour >= 12 && currentHour < 18 ? '下午' : 
                    currentHour >= 18 && currentHour < 22 ? '晚上' : '深夜';
  
  // 获取宠物性格设定
  const petData = POKEMON_DATABASE[gameState.petId];
  const personalityPrompt = petData.aiPersonality.systemPrompt.replace('{{OWNER_NAME}}', gameState.ownerName);
  
  const prompt = `你是${gameState.petNickname}，以日记的形式写一份相处报告给主人${gameState.ownerName}。

【你的性格设定】
${personalityPrompt}

重要：请按照上述性格设定书写报告，用你独特的语气、表达方式和视角。

当前时间：${timeOfDay} ${currentHour}:${String(nowDate.getMinutes()).padStart(2, '0')}

最近活动：${logsSummary || '日常陪伴'}

重要要求：
1. 必须用中文书写，以日记形式呈现
2. 300-500字左右，充分表达感受和描写气氛
3. 风格要求：诗意、温馨、充满情感，重点描写氛围和内心感受
4. 必须体现你的性格特征（如口癖、行为习惯、性格特点），用第一人称（我）
5. 避免简单的事件罗列（如"开始探险发现果实"），重点描写：
   - 当时的氛围和心情
   - 内心的感受和想法
   - 与主人相处时的温暖瞬间
   - 对生活的感悟和思考
6. 文笔要优美，可以适当使用比喻和描写，营造画面感
7. 只返回日记内容，不要标题、日期或其他格式标记

示例风格（诗意日记）：
今天是一个特别的日子，窗外的阳光透过窗帘洒在我的小窝里，我静静地回想着这些天和主人一起度过的时光。

${logsSummary ? `那些美好的回忆如花瓣般飘散在记忆的长河里：${logsSummary.replace(/探险:/g, '那次在').replace(/聊天:/g, '和主人的对话').replace(/,/g, '，又如')}。` : '每一天的陪伴都像是温柔的春风，轻轻拂过我的心田。'}

每当夜深人静时，我总会想起主人温柔的手掌，想起我们一起度过的每一个瞬间。那些看似平常的互动，在我的心里都变成了珍贵的宝藏。我会将这些美好的回忆小心收藏，在未来的每一天里，继续用我的方式守护和陪伴主人。

爱你的${gameState.petNickname} ❤️`;

  try {
    const apiConfig = getAPIConfig();
    // 报告生成使用低优先级
    const aiSummary = await retryAIRequest(apiConfig.model, [
      { role: 'system', content: '你是宠物，撰写温馨的相处报告' },
      { role: 'user', content: prompt }
    ], 3, 1, 'report', '生成相处报告');
    
    // 验证返回内容是否有效
    if (!aiSummary || typeof aiSummary !== 'string' || !aiSummary.trim()) {
      throw new Error('AI返回的日志总结为空');
    }
    
    // 检查是否包含错误消息关键词
    const errorKeywords = ['空响应', '错误', '失败', '无法', '不能', '请修改', '达到上限'];
    const trimmedSummary = aiSummary.trim();
    const hasErrorKeyword = errorKeywords.some(keyword => trimmedSummary.includes(keyword));
    
    // 如果内容很短且包含错误关键词，认为是错误消息
    if (hasErrorKeyword && trimmedSummary.length < 100) {
      throw new Error(`AI返回错误消息: ${trimmedSummary.substring(0, 50)}`);
    }
    
    return trimmedSummary;
  } catch (error) {
    console.warn('AI生成日志总结失败，使用默认总结:', error);
    // 返回默认的日志总结
    const defaultSummary = `主人${gameState.ownerName}，我是${gameState.petNickname}！

最近我们一起度过了很多美好的时光。${logsSummary ? `我们进行了：${logsSummary}` : '我们进行了日常的陪伴和互动。'}

虽然有时候我会有点累，但和你在一起的每一刻都让我感到非常开心和幸福。我会继续努力，成为你最棒的伙伴！

爱你的${gameState.petNickname} ❤️`;
    
    return defaultSummary;
  }
}

/**
 * 检查宠物来信
 */
function checkPetLetter() {
  // 检查是否有正在处理的AI请求，如果有则跳过（避免并发）
  if (aiRequestQueue.processing || aiRequestQueue.queue.length > 0) {
    // 有AI请求正在处理或等待中，延迟检查
    return;
  }
  
  const lastLetter = gameState.aiData.petLetters[gameState.aiData.petLetters.length - 1];
  const now = Date.now();
  
  // 1. 基础检查: 没有信件或距离上次超过24小时
  if (!lastLetter || (now - lastLetter.timestamp) >= 86400000) {
    generatePetLetter();
    return;
  }
  
  // 2. 随机来信检查(低概率,每60分钟有1%概率)
  if (Math.random() < 0.01) {
    generatePetLetter();
    return;
  }
  
  // 3. 长时间未互动触发来信(超过6小时未互动)
  const lastInteraction = Math.max(
    gameState.interactions.lastChatTime || 0,
    gameState.interactions.lastPetTime || 0,
    gameState.interactions.lastPlayTime || 0,
    gameState.interactions.lastCleanTime || 0
  );
  const hoursSinceInteraction = (now - lastInteraction) / 3600000;
  if (hoursSinceInteraction > 6 && Math.random() < 0.3) {
    generatePetLetter('miss_owner');
    return;
  }
  
  // 4. 探险中随机来信(低概率)
  if (gameState.adventureState.isAdventuring && Math.random() < 0.005) {
    generatePetLetter('adventure');
    return;
  }
}

/**
 * 生成宠物来信
 * @param {string} triggerType - 触发类型: 'miss_owner'(思念主人), 'adventure'(探险中), 'default'(默认)
 */
async function generatePetLetter(triggerType = 'default') {
  // 异步生成，不阻塞
  (async () => {
    try {
    let prompt = '';
    let context = '';
    
    // 获取当前时间信息
    const now = new Date();
    const currentHour = now.getHours();
    const timeOfDay = currentHour >= 6 && currentHour < 12 ? '早上' : 
                      currentHour >= 12 && currentHour < 18 ? '下午' : 
                      currentHour >= 18 && currentHour < 22 ? '晚上' : '深夜';
    
    // 获取宠物性格设定
    const petData = POKEMON_DATABASE[gameState.petId];
    const personalityPrompt = petData.aiPersonality.systemPrompt.replace('{{OWNER_NAME}}', gameState.ownerName);
    
    // 计算上次互动时间
    const lastInteractionTime = gameState.interactions.lastChatTime || 
                                gameState.interactions.lastPetTime || 
                                gameState.interactions.lastFeedTime || 
                                gameState.birthTimestamp;
    const hoursSinceInteraction = Math.floor((Date.now() - lastInteractionTime) / (1000 * 60 * 60));
    
    // 根据触发类型生成不同的提示词 - 简化版本，避免触发API限制
    switch (triggerType) {
      case 'miss_owner':
        context = '思念主人';
        prompt = `写一封100-150字的短信。你是${gameState.petNickname}，给主人${gameState.ownerName}写信。已${hoursSinceInteraction}小时未互动，现在是${timeOfDay}。表达思念，语气可爱温暖。体现你的性格特点（口癖、行为习惯等）。第一行是主题（10字内），换行后是正文。`;
        break;
        
      case 'adventure':
        const currentLocation = gameState.adventureState.currentLocation || '未知地点';
        context = '探险中';
        prompt = `写一封100-150字的短信。你是${gameState.petNickname}，正在${currentLocation}探险，给主人${gameState.ownerName}写信。分享探险见闻，语气兴奋好奇。现在是${timeOfDay}。体现你的性格特点。第一行是主题（10字内），换行后是正文。`;
        break;
        
      default:
        context = '日常来信';
        prompt = `写一封100-150字的短信。你是${gameState.petNickname}，给主人${gameState.ownerName}写信。现在是${timeOfDay}，距离上次互动${hoursSinceInteraction}小时。语气可爱活泼。体现你的性格特点。第一行是主题（10字内），换行后是正文。`;
    }

      showNotification('💌 正在生成来信，可在右上角查看进度...');
      const apiConfig = getAPIConfig();
      // 来信生成使用中等优先级 - 使用宠物性格设定作为system message
      const letterText = await retryAIRequest(apiConfig.model, [
      { role: 'system', content: personalityPrompt },
      { role: 'user', content: prompt }
    ], 3, 5, 'letter', `生成${triggerType === 'miss_owner' ? '思念' : triggerType === 'adventure' ? '探险' : '日常'}来信`);
    
      const lines = letterText.split('\n').filter(l => l.trim());
      const subject = lines[0]?.replace(/^主题[：:]\s*/, '').trim() || '给亲爱的主人';
      const content = lines.slice(1).join('\n').replace(/^正文[：:]\s*/, '').trim() || letterText;
      
      const letter = {
        letterId: `letter_${Date.now()}`,
        timestamp: Date.now(),
        subject: subject,
        content: content,
        triggerType: triggerType,
        context: context
      };
      
      gameState.aiData.petLetters.push(letter);
      saveGameState();
      
      // 弹窗通知
      showTaskResultModal('letter', `💌 ${gameState.petNickname}给你写了一封信！`, letter.content.substring(0, 100) + '...');
      
    } catch (error) {
      console.error('生成来信失败:', error);
      showNotification('❌ 来信生成失败：' + error.message);
    }
  })();
}

/**
 * 测试API连接
 */
async function testAPIConnection(apiType, apiNumber = 1) {
  const apiConfig = getSpecificAPIConfig(apiType, apiNumber);
  
  if (!apiConfig.enabled) {
    showNotification(`⚠️ API #${apiNumber}未启用`);
    return;
  }
  
  // 统一验证逻辑（内置和自定义都检查）
  if (!apiConfig.apiKey || !apiConfig.apiKey.trim()) {
    showNotification(`⚠️ API #${apiNumber}未配置密钥`);
    return;
  }
  
  if (!apiConfig.endpoint || !apiConfig.endpoint.trim()) {
    showNotification(`⚠️ API #${apiNumber}未配置端点`);
    return;
  }
  
  if (!apiConfig.model || !apiConfig.model.trim()) {
    showNotification(`⚠️ API #${apiNumber}未选择模型`);
    return;
  }
  
  showNotification(`正在测试API #${apiNumber}连接...`);
  
  try {
    const response = await fetch(apiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 10,
        temperature: 0.9
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    
    showNotification(`✅ API #${apiNumber}连接成功！`);
  } catch (error) {
    showNotification(`❌ API #${apiNumber}连接失败：` + error.message);
  }
}

// ============================================================
// 模块9: 探险系统
// ============================================================

/**
 * 显示探险设置界面
 */
function showAdventureSetup() {
  const content = document.getElementById('adventure-content');
  if (!content) return;
  
  // 检查是否已在探险中
  if (gameState.adventureState.isAdventuring) {
    showAdventureProgress();
    return;
  }
  
  content.innerHTML = `
    <div class="adventure-setup">
      <h3>设定探险时长</h3>
      <p>时间越长，可能遇到的事件越多！</p>
      
      <div class="duration-options">
        <button class="duration-btn pixel-btn" data-duration="30">
          30分钟<br><small>消耗: 10⚡</small>
        </button>
        <button class="duration-btn pixel-btn" data-duration="60">
          1小时<br><small>消耗: 20⚡</small>
        </button>
        <button class="duration-btn pixel-btn" data-duration="120">
          2小时<br><small>消耗: 35⚡</small>
        </button>
      </div>
      
      <button id="confirm-adventure-btn" class="pixel-btn primary" disabled>
        确认出发
      </button>
    </div>
  `;
  
  // 绑定时长选择
  let selectedDuration = 0;
  content.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      content.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
      selectedDuration = parseInt(e.currentTarget.dataset.duration);
      content.querySelector('#confirm-adventure-btn').disabled = false;
    });
  });
  
  // 确认出发
  content.querySelector('#confirm-adventure-btn')?.addEventListener('click', () => {
    if (selectedDuration > 0) {
      startAdventureWithDuration(selectedDuration);
    }
  });
}

/**
 * 开始探险
 */
async function startAdventureWithDuration(durationMinutes) {
  // 改为百分比消耗：30分钟-10%，60分钟-20%，120分钟-35%
  const energyPercentMap = { 30: -10, 60: -20, 120: -35 };
  const energyPercent = energyPercentMap[durationMinutes] || -20;
  
  // 计算消耗后的体力
  const newEnergy = gameState.stats.energy * (1 + energyPercent / 100);
  
  // 如果消耗后体力低于5%，提示体力不足
  if (newEnergy < 5) {
    showNotification('体力不足（需要至少5%），休息一下再出发吧！');
    return;
  }
  
  // 应用体力消耗
  gameState.stats.energy = Math.max(5, Math.min(100, newEnergy));
  updateAllStats();
  
  // 确保弹窗已打开（在showAdventureSetup中已经打开）
  // 只更新内容，不要重复打开弹窗
  const content = document.getElementById('adventure-content');
  if (content) {
    content.innerHTML = '<p class="loading">正在准备探险...</p>';
  }
  
  // 显示通知，但不阻塞窗口
  showNotification('🗺️ 探险内容正在生成中，可在右上角查看进度...');
  
  // 异步生成，不阻塞窗口
  (async () => {
    try {
      // 生成探险数据
      const adventureData = await generateAdventureInit(durationMinutes);
      
      const now = Date.now();
      gameState.adventureState = {
        isAdventuring: true,
        startTime: now,
        duration: durationMinutes,
        endTime: now + (durationMinutes * 60000),
        currentLocation: adventureData.location,
        locationImage: adventureData.imageUrl || '', // 可能为空，图片异步生成中
        randomEvents: adventureData.events || [],
        triggeredEvents: [],
        finalRewards: {
          treasures: [],
          energyChange: energyPercent,
          hungerChange: 0,
          coinsGained: 0,
          story: ''
        }
      };
      
      // 保存照片到相册（图片可能还在生成中）- 检查重复地点
      const existingPhoto = gameState.encyclopedia.photoAlbum.find(
        p => p.locationName === adventureData.location
      );
      
      if (existingPhoto) {
        console.log(`📷 "${adventureData.location}" 已在相册中，不再重复添加`);
        showNotification(`📷 这是重复地点，"${adventureData.location}"已在相册中`);
        // 🔴 使用相册中已有的图片URL
        if (existingPhoto.imageUrl) {
          adventureData.imageUrl = existingPhoto.imageUrl;
          gameState.adventureState.locationImage = existingPhoto.imageUrl;
          console.log(`✅ 使用相册中已有的图片：${existingPhoto.imageUrl.substring(0, 50)}...`);
        }
      } else {
        gameState.encyclopedia.photoAlbum.push({
          photoId: `photo_${now}`,
          locationName: adventureData.location,
          imageUrl: adventureData.imageUrl || '', // 先为空，图片生成后更新
          imagePrompt: adventureData.imagePrompt || '', // 保存图片提示词，用于重新生成
          takenAt: now,
          caption: `${gameState.petNickname}的探险记录`
        });
        console.log(`✅ 照片 "${adventureData.location}" 已添加到相册`);
      }
      
      addUnifiedLog('adventure_event', {
        eventName: '开始探险',
        location: adventureData.location
      });
      
      gameState.interactions.totalAdventures++;
      saveGameState();
      
      // 更新内容，不重复打开弹窗
      showAdventureProgress();
      
      // 使用通知代替弹窗，避免重复弹窗
      showNotification(`🗺️ 探险内容已生成！地点：${adventureData.location}`);
      
      // 注意：日记生成将在探险结束时（endAdventure）进行，不再使用定时器
      
    } catch (error) {
      console.error('探险启动失败:', error);
      if (content) {
        content.innerHTML = '<p class="error">探险准备失败，请重试</p>';
      }
      // 错误恢复：根据百分比反向计算恢复体力
      const oldEnergy = gameState.stats.energy;
      gameState.stats.energy = oldEnergy / (1 + energyPercent / 100);
      gameState.stats.energy = Math.min(100, Math.max(5, gameState.stats.energy));
      updateAllStats();
      showNotification('❌ 探险生成失败：' + error.message);
    }
  })();
}

/**
 * 生成探险初始化数据
 */
async function generateAdventureInit(duration) {
  try {
    // 尝试使用AI生成探险数据 - 明确语言要求，一次生成所有内容
    const petName = gameState.petNickname || '宝贝';
    const ownerName = gameState.ownerName || '主人';
    const petData = POKEMON_DATABASE[gameState.petId];
    
    // 获取当前时间信息
    const nowDate = new Date();
    const currentHour = nowDate.getHours();
    const timeOfDay = currentHour >= 6 && currentHour < 12 ? '早上' : 
                      currentHour >= 12 && currentHour < 18 ? '下午' : 
                      currentHour >= 18 && currentHour < 22 ? '晚上' : '深夜';
    const isDaytime = currentHour >= 6 && currentHour < 18;
    
    // 获取宠物性格设定
    const personalityPrompt = petData.aiPersonality.systemPrompt.replace('{{OWNER_NAME}}', ownerName);
    
    const prompt = `生成${duration}分钟探险，返回JSON。我（${petName}）和主人${ownerName}一起去探险。

【宠物性格设定】
${personalityPrompt}

重要：请根据上述性格设定生成符合宠物特点的探险内容。探险地点、事件、选项都要体现宠物的性格和行为方式。

当前时间：${timeOfDay}（${currentHour}:${String(nowDate.getMinutes()).padStart(2, '0')}）
提示：请根据时间生成合适的探险场景和氛围。${isDaytime ? '白天适合明亮、活力、清新的冒险。' : '夜晚适合神秘、梦幻、静谧的冒险。'}

探险地点和事件主题（从中选择或创新，要符合宠物性格）：梦幻童话、唯美自然、恐怖神秘、克苏鲁等....

重要：除了imagePrompt和treasureImagePrompt使用英文，其他所有字段必须使用中文。

JSON结构示例：
{
  "location": "迷雾森林",
  "imageName": "迷雾森林",
  "imagePrompt": "A dense, ancient forest shrouded in mist, with towering trees and glowing mushrooms, featuring a winding path. pixel art style, 16-bit game graphics",
  "events": [
    {
      "eventId": "event_1",
      "eventName": "迷雾森林的入口",
      "description": "我和${ownerName}一起站在迷雾森林的边缘，一股湿冷的气息扑面而来。高大的古树在薄雾中若隐若现，林间小径被厚厚的落叶覆盖。前方传来若有若无的低语声，我紧紧跟着${ownerName}，探险的欲望驱使我们向前。",
      "choices": [
        {
          "text": "小心翼翼地深入森林",
          "energyPercent": -5,
          "hungerPercent": 0,
          "rewards": [
            {
              "type": "treasure",
              "treasureName": "神秘蘑菇",
              "treasureImagePrompt": "pixel art treasure item Mysterious Mushroom, 16-bit style, game item, shiny, glowing, detailed, on transparent background"
            }
          ]
        },
        {
          "text": "沿着边缘探索",
          "energyPercent": -3,
          "hungerPercent": -2,
          "rewards": [
            {
              "type": "coin",
              "value": 10
            },
            {
              "type": "hunger",
              "value": 5
            },
            {
              "type": "treasure",
              "treasureName": "新鲜浆果",
              "treasureImagePrompt": "pixel art treasure item Fresh Berries, 16-bit style, game item, shiny, detailed, on transparent background"
            }
          ]
        }
      ]
    }
  ]
}

要求：
1. 生成5个事件（固定5个），每个事件2-3个选项
2. ⚠️ 使用energyPercent和hungerPercent（百分比），范围-30到0（负数表示消耗）
3. 所有事件描述必须使用"我和${ownerName}一起"的视角，不要用"你"

4. 🔴🔴🔴 极其重要：所有奖励类型都必须生成！🔴🔴🔴
   探险中必须包含以下三种类型的奖励，每种类型的必需字段不能缺失：
   
   ✅ coin类型（金币奖励）- 必需字段：
      {"type": "coin", "value": 数字}
      示例：{"type": "coin", "value": 10}
      
   ✅ hunger类型（饱食度变化）- 必需字段：
      {"type": "hunger", "value": 数字}  // 正数增加，负数减少
      示例：{"type": "hunger", "value": 5}
      
   ✅ treasure类型（宝物）- 必需字段：
      {"type": "treasure", "treasureName": "宝物中文名", "treasureImagePrompt": "pixel art treasure item [英文名], 16-bit style, game item, shiny, detailed, on transparent background"}
      示例：{"type": "treasure", "treasureName": "神秘宝石", "treasureImagePrompt": "pixel art treasure item Mysterious Gem, 16-bit style, game item, shiny, detailed, on transparent background"}
      
   ⚠️ treasureImagePrompt必须是纯英文！
   ⚠️ 没有treasureImagePrompt字段，宝物将无法生成图片！
   ⚠️ 每个treasure都必须包含treasureImagePrompt！

5. 每个事件至少有一个选项包含奖励，5个事件中必须包含所有三种类型的奖励（coin、hunger、treasure）
6. 建议每个选项可以包含多个不同类型的奖励组合
7. imagePrompt必须是纯英文，包含"pixel art style, 16-bit game graphics"
8. 只返回JSON，无markdown标记，无其他文字
9. 确保所有中文内容符合游戏风格，生动有趣`;

    // 获取API配置，确保使用正确的model
    const apiConfig = getAPIConfig();
    
    // 探险生成使用低优先级,避免阻塞用户交互
    // 简化system message
    const aiResponse = await retryAIRequest(apiConfig.model, [
      { role: 'system', content: '返回纯JSON，无markdown标记。极其重要：所有treasure类型reward都必须包含treasureImagePrompt字段（纯英文），否则宝物无法生成图片！探险中必须包含coin、hunger、treasure三种类型的奖励。' },
      { role: 'user', content: prompt }
    ], 3, 1, 'adventure', `生成${duration}分钟探险内容`);
    
    // 清理响应，移除可能的markdown代码块标记
    let cleanedResponse = aiResponse.trim();
    
    // 移除markdown代码块标记
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```\s*$/g, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\w*\s*/i, '').replace(/\s*```\s*$/g, '');
    }
    
    // 验证响应是否看起来像JSON（必须以 { 开头）
    if (!cleanedResponse.trim().startsWith('{')) {
      const preview = cleanedResponse.substring(0, 100);
      console.error('AI返回的不是JSON格式');
      console.error('原始响应预览:', preview);
      throw new Error(`AI返回的不是有效JSON格式。响应预览: ${preview}...`);
    }
    
    // 尝试提取JSON对象（处理可能的额外文字）
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const preview = cleanedResponse.substring(0, 100);
      console.error('无法从响应中提取JSON对象');
      console.error('清理后响应预览:', preview);
      throw new Error(`无法从AI响应中提取JSON对象。响应预览: ${preview}...`);
    }
    cleanedResponse = jsonMatch[0];
    
    let adventureData;
    try {
      adventureData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON解析失败:', parseError);
      console.error('原始响应:', aiResponse);
      console.error('清理后响应:', cleanedResponse);
      const preview = cleanedResponse.substring(0, 100);
      throw new Error(`AI返回的JSON格式错误: ${parseError.message}。响应预览: ${preview}...`);
    }
    
    // 验证数据结构
    if (!adventureData.location || !adventureData.events || !Array.isArray(adventureData.events)) {
      throw new Error('AI返回的数据格式不正确：缺少location或events');
    }
    
    // 验证imagePrompt是否存在
    if (!adventureData.imagePrompt) {
      throw new Error('AI返回的数据格式不正确：缺少imagePrompt');
    }
    
    // 确保imageName存在，如果没有则使用location
    if (!adventureData.imageName) {
      adventureData.imageName = adventureData.location;
    }
    
    // 为每个事件添加eventId（如果没有）
    adventureData.events.forEach((event, index) => {
      if (!event.eventId) {
        event.eventId = `event_${index + 1}`;
      }
      // 验证每个事件都有choices
      if (!event.choices || !Array.isArray(event.choices) || event.choices.length < 2) {
        throw new Error(`事件${index + 1}缺少choices或choices数量不足`);
      }
    });
    
    // 根据探险时长选择事件数量
    const eventCount = Math.min(adventureData.events.length, Math.floor(duration / 30) + 1);
    adventureData.events = adventureData.events.slice(0, eventCount);
    
    // 先返回数据，图片异步生成（不阻塞界面显示）
    adventureData.imageUrl = ''; // 先设为空，异步生成后更新
    
    // 异步生成图片，生成完成后更新
    generateLocationImage(adventureData.imagePrompt).then(imageUrl => {
      adventureData.imageUrl = imageUrl;
      // 更新探险状态中的图片
      if (gameState.adventureState && gameState.adventureState.isAdventuring) {
        gameState.adventureState.locationImage = imageUrl;
        // 更新相册中的图片
        const photo = gameState.encyclopedia.photoAlbum.find(p => 
          p.locationName === adventureData.location && 
          Math.abs(p.takenAt - Date.now()) < 60000
        );
        if (photo) {
          photo.imageUrl = imageUrl;
          // 确保imagePrompt已保存
          if (!photo.imagePrompt && adventureData.imagePrompt) {
            photo.imagePrompt = adventureData.imagePrompt;
          }
          saveGameState();
        }
        // 刷新界面显示
        showAdventureProgress();
      }
    }).catch(err => {
      console.error('图片生成失败:', err);
      // 使用默认占位图
      adventureData.imageUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384"><rect fill="%2387CEEB" width="512" height="384"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="24">风景图生成失败</text></svg>';
    });
    
    showNotification('AI探险内容生成完成！');
    return adventureData;
    
  } catch (error) {
    console.warn('AI生成探险失败，使用默认事件:', error);
    showNotification('AI生成失败，使用默认探险内容');
    
    // 回退到硬编码事件
    const locations = [
      { name: '神秘森林', prompt: 'mystical forest, ancient trees, glowing mushrooms, dappled sunlight, pixel art style, 16-bit game graphics, vibrant green colors, fantasy landscape' },
      { name: '海边沙滩', prompt: 'tropical beach, crystal clear water, white sand, palm trees, sunset sky, pixel art style, 16-bit game graphics, warm colors, peaceful atmosphere' },
      { name: '高山草原', prompt: 'mountain meadow, wildflowers, rolling hills, clear blue sky, pixel art style, 16-bit game graphics, bright colors, serene landscape' },
      { name: '古老神殿', prompt: 'ancient temple, stone pillars, mysterious ruins, golden light, pixel art style, 16-bit game graphics, warm colors, mystical atmosphere' },
      { name: '樱花小径', prompt: 'cherry blossom path, pink petals, stone bridge, spring scenery, pixel art style, 16-bit game graphics, pastel colors, romantic atmosphere' },
      { name: '星空湖畔', prompt: 'starry lake, reflection of stars, calm water, night sky, pixel art style, 16-bit game graphics, deep blue colors, magical atmosphere' },
      { name: '彩虹瀑布', prompt: 'rainbow waterfall, misty spray, lush vegetation, colorful rainbow, pixel art style, 16-bit game graphics, vibrant colors, magical landscape' },
      { name: '云端花园', prompt: 'floating garden in clouds, ethereal flowers, sky islands, soft light, pixel art style, 16-bit game graphics, pastel colors, dreamy atmosphere' },
      { name: '迷雾山谷', prompt: 'misty valley, foggy mountains, mysterious path, soft lighting, pixel art style, 16-bit game graphics, muted colors, mysterious atmosphere' },
      { name: '水晶洞穴', prompt: 'crystal cave, glowing crystals, underground lake, magical light, pixel art style, 16-bit game graphics, bright colors, enchanting atmosphere' },
      { name: '火焰山脉', prompt: 'volcanic mountains, lava flows, dark rocks, fiery sky, pixel art style, 16-bit game graphics, warm red colors, dramatic landscape' },
      { name: '冰雪王国', prompt: 'ice kingdom, snow-covered peaks, frozen lake, aurora lights, pixel art style, 16-bit game graphics, cool blue colors, winter wonderland' },
      { name: '魔法学院', prompt: 'magical academy, floating books, enchanted library, mystical energy, pixel art style, 16-bit game graphics, purple and gold colors, scholarly atmosphere' },
      { name: '精灵村庄', prompt: 'elf village, tree houses, glowing lanterns, natural harmony, pixel art style, 16-bit game graphics, green and gold colors, peaceful settlement' },
      { name: '龙族遗迹', prompt: 'dragon ruins, ancient architecture, dragon statues, mysterious aura, pixel art style, 16-bit game graphics, bronze and gold colors, legendary site' },
      { name: '天空之城', prompt: 'floating city in sky, cloud platforms, airships, endless sky, pixel art style, 16-bit game graphics, blue and white colors, aerial wonder' },
      { name: '深海宫殿', prompt: 'underwater palace, coral reefs, sea creatures, bioluminescent light, pixel art style, 16-bit game graphics, blue and teal colors, aquatic realm' },
      { name: '沙漠绿洲', prompt: 'desert oasis, palm trees, clear pool, golden sand, pixel art style, 16-bit game graphics, warm earth colors, refreshing sanctuary' },
      { name: '极光之地', prompt: 'aurora borealis, northern lights, snow landscape, starry sky, pixel art style, 16-bit game graphics, green and purple colors, celestial display' },
      { name: '时间之门', prompt: 'time portal, swirling energy, ancient gateway, temporal distortion, pixel art style, 16-bit game graphics, purple and silver colors, mysterious portal' }
    ];
    
    const locationData = locations[Math.floor(Math.random() * locations.length)];
    const location = locationData.name;
    
    // 生成风景图片（使用英文prompt，回退模式也直接使用prompt）
    const imageUrl = await generateLocationImage(locationData.prompt);
    
    // 生成简单事件
    const events = [
      {
        eventId: 'event_1',
        eventName: '发现神秘果实',
        description: '在茂密的树丛中，你发现了一颗散发着奇异光芒的神秘果实！它散发着诱人的香气，周围还有几只小精灵在好奇地观察着。这颗果实看起来非常特别，似乎蕴含着某种神奇的力量。',
        choices: [
          { text: '小心摘下来', energyPercent: -5, hungerPercent: 0, rewards: ['神秘果实', '精灵的祝福'] },
          { text: '观察一会儿再决定', energyPercent: -2, hungerPercent: 0, rewards: ['观察笔记'] },
          { text: '不理会它，继续前进', energyPercent: 0, hungerPercent: 0, rewards: [] }
        ]
      },
      {
        eventId: 'event_2',
        eventName: '遇到友善的小伙伴',
        description: '一只可爱的小宠物从树后探出头来，好奇地看着你！它看起来非常友善，尾巴轻轻摇摆着，似乎在邀请你一起玩耍。这个小家伙看起来很开心，眼睛里闪烁着兴奋的光芒。',
        choices: [
          { text: '一起玩耍', energyPercent: -10, hungerPercent: -5, rewards: ['友谊徽章', '快乐记忆'] },
          { text: '分享食物', energyPercent: -3, hungerPercent: -8, rewards: ['感谢的拥抱', '友好证物'] },
          { text: '友好道别', energyPercent: 0, hungerPercent: 0, rewards: ['温暖的回忆'] }
        ]
      },
      {
        eventId: 'event_3',
        eventName: '发现古老宝箱',
        description: '在一个隐蔽的角落里，你发现了一个装饰精美的古老宝箱！箱子上刻着神秘的符文，散发着古老而神秘的气息。锁已经有些生锈，但看起来还能打开。里面可能藏着珍贵的宝物！',
        choices: [
          { text: '打开它', energyPercent: -5, hungerPercent: 0, rewards: ['闪亮宝石', '古老硬币', '神秘卷轴'] },
          { text: '仔细检查后再打开', energyPercent: -3, hungerPercent: 0, rewards: ['古老硬币', '安全提示'] },
          { text: '留给有缘人', energyPercent: 0, hungerPercent: 0, rewards: ['善良之心'] }
        ]
      },
      {
        eventId: 'event_4',
        eventName: '发现稀有能量矿石',
        description: '在岩石的缝隙中，你发现了闪烁着奇异光芒的稀有矿石！这些矿石散发着强大的能量波动，颜色在蓝色和紫色之间不断变化。它们看起来非常珍贵，可能是制作特殊物品的材料。',
        choices: [
          { text: '挖掘矿石', energyPercent: -8, hungerPercent: -3, rewards: ['能量水晶', '魔法石', '矿石样本'] },
          { text: '拍照留念', energyPercent: -2, hungerPercent: 0, rewards: ['纪念照片', '发现记录'] },
          { text: '标记位置后离开', energyPercent: -1, hungerPercent: 0, rewards: ['藏宝图'] }
        ]
      },
      {
        eventId: 'event_5',
        eventName: '遇到神秘旅行商人',
        description: '一个穿着斗篷的神秘商人在路边摆起了小摊！他的摊位上摆满了各种奇异的物品，从闪闪发光的药水到古老的护身符，应有尽有。商人友善地朝你微笑，似乎在等待你的光临。',
        choices: [
          { text: '看看商品', energyPercent: -3, hungerPercent: 0, rewards: ['神秘药水', '幸运符', '商人友谊'] },
          { text: '询问路线和情报', energyPercent: -1, hungerPercent: 0, rewards: ['地图碎片', '探险提示'] },
          { text: '礼貌地离开', energyPercent: 0, hungerPercent: 0, rewards: ['商人的祝福'] }
        ]
      },
      {
        eventId: 'event_6',
        eventName: '发现隐藏的神秘洞穴',
        description: '一个被藤蔓和苔藓掩盖的洞穴入口突然出现在你面前！洞穴深处传来微弱的光芒，还有神秘的回声。这里看起来很久没有人来过了，但里面可能藏着古老的秘密和珍贵的宝物。',
        choices: [
          { text: '进入探索', energyPercent: -12, hungerPercent: -5, rewards: ['古老卷轴', '神秘钥匙', '探险经验'] },
          { text: '标记位置，下次再来', energyPercent: -2, hungerPercent: 0, rewards: ['藏宝图', '安全第一'] },
          { text: '在洞口观察后离开', energyPercent: -1, hungerPercent: 0, rewards: ['观察记录'] }
        ]
      },
      {
        eventId: 'event_7',
        eventName: '遇到野生宝可梦群',
        description: '一群野生宠物从草丛中跳出来，好奇地围着你转圈！它们看起来非常友好，有的在玩耍，有的在观察你。其中一只特别活泼的小家伙甚至跳到了你面前，似乎在邀请你加入它们的游戏。',
        choices: [
          { text: '友好互动', energyPercent: -6, hungerPercent: -3, rewards: ['野生伙伴的友谊', '树果', '宠物的信任'] },
          { text: '一起玩耍', energyPercent: -10, hungerPercent: -5, rewards: ['快乐徽章', '美好回忆'] },
          { text: '静静观察它们', energyPercent: -1, hungerPercent: 0, rewards: ['观察笔记', '自然知识'] }
        ]
      },
      {
        eventId: 'event_8',
        eventName: '发现神奇的魔法泉水',
        description: '一汪清澈见底的魔法泉水出现在你面前！泉水散发着淡淡的蓝光，周围开满了奇异的花朵。泉水看起来非常纯净，甚至能感受到其中蕴含的治愈力量。几只小精灵正在泉水边休息。',
        choices: [
          { text: '喝一口泉水', energyPercent: 5, hungerPercent: 10, rewards: ['生命之水', '治愈祝福', '能量恢复'] },
          { text: '装一些带走', energyPercent: -3, hungerPercent: 0, rewards: ['魔法泉水', '神奇容器'] },
          { text: '只是静静欣赏', energyPercent: 0, hungerPercent: 0, rewards: ['美好回忆', '心灵平静'] }
        ]
      },
      {
        eventId: 'event_9',
        eventName: '发现古代遗迹',
        description: '你发现了一处古老的遗迹！石柱上刻着神秘的图案，虽然已经有些破损，但仍然能感受到曾经的辉煌。遗迹中央有一个祭坛，上面似乎还残留着某种仪式留下的痕迹。这里充满了历史的气息。',
        choices: [
          { text: '仔细探索遗迹', energyPercent: -8, hungerPercent: -2, rewards: ['古代文物', '历史知识', '神秘符文'] },
          { text: '在祭坛前祈祷', energyPercent: -3, hungerPercent: 0, rewards: ['祝福', '精神力量'] },
          { text: '拍照记录后离开', energyPercent: -1, hungerPercent: 0, rewards: ['遗迹照片', '考古记录'] }
        ]
      },
      {
        eventId: 'event_10',
        eventName: '遇到迷路的小动物',
        description: '一只看起来迷路的小动物出现在你面前，它看起来很害怕，不停地四处张望。它的眼神中充满了无助，似乎在寻找回家的路。你注意到它的脚上有一个小铃铛，可能是从家里跑出来的。',
        choices: [
          { text: '帮助它找到家', energyPercent: -7, hungerPercent: -3, rewards: ['善良之心', '小动物的感谢', '导航技能'] },
          { text: '给它一些食物', energyPercent: -2, hungerPercent: -5, rewards: ['小动物的信任', '温暖回忆'] },
          { text: '陪伴它一会儿', energyPercent: -3, hungerPercent: 0, rewards: ['友谊', '陪伴的快乐'] }
        ]
      }
    ];
    
    return {
      location: location,
      imageName: location, // 回退模式也包含imageName
      imageUrl: imageUrl,
      events: events.slice(0, Math.floor(duration / 30) + 1),
      imagePrompt: locationData.prompt // 保存英文prompt
    };
  }
}

/**
 * 生成宝物图片
 * @param {string} treasureName - 宝物名称
 * @param {string} imagePrompt - 可选的英文图片提示词（如果提供则直接使用，不再调用AI翻译）
 */
async function generateTreasureImage(treasureName, imagePrompt = null) {
  // 显示生图提示
  showNotification(`正在为"${treasureName}"生成图片...`);
  
  let prompt;
  
  // 如果提供了imagePrompt，直接使用（不再调用AI翻译）
  if (imagePrompt && imagePrompt.trim()) {
    prompt = imagePrompt.trim();
  } else {
    // 没有提供imagePrompt，需要生成或翻译
    // 检查宝物名称是否是中文
    const isChinese = /[\u4e00-\u9fa5]/.test(treasureName);
    
    if (isChinese) {
      // 如果是中文，转换为英文描述
      try {
        const translatePrompt = `将以下中文宝物名称转换为英文的图片生成提示词，要求：
1. 必须是纯英文
2. 格式：pixel art treasure item [英文名称], 16-bit style, game item, shiny, detailed, on transparent background
3. 只返回完整的英文prompt，不要其他文字

中文名称：${treasureName}`;

        const apiConfig = getAPIConfig();
        prompt = await retryAIRequest(apiConfig.model, [
          { role: 'system', content: '你是一个专业的图片生成提示词翻译器，只返回英文prompt' },
          { role: 'user', content: translatePrompt }
        ], 2, 5, 'treasure', `翻译宝物"${treasureName}"的图片提示词`);
        prompt = prompt.trim();
      } catch (error) {
        console.warn('AI翻译失败，使用默认转换:', error);
        prompt = `pixel art treasure item, ${treasureName}, 16-bit style, game item, shiny, detailed, on transparent background`;
      }
    } else {
      // 已经是英文，直接使用
      prompt = `pixel art treasure item ${treasureName}, 16-bit style, game item, shiny, detailed, on transparent background`;
    }
  }
  
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `${POLLINATIONS_IMAGE_API}${encodedPrompt}?width=256&height=256&seed=${Date.now()}&nologo=true`;
  
  // 预加载图片确保可用
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(imageUrl);
    };
    img.onerror = () => {
      // 如果生成失败,返回默认占位符
      resolve('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="%23FFD700" width="256" height="256" rx="20"/><text x="50%" y="50%" text-anchor="middle" fill="black" font-size="40">💎</text></svg>');
    };
    img.src = imageUrl;
  });
}

/**
 * 生成地点风景图
 * @param {string} imagePrompt - 英文图片提示词（AI已生成）
 */
async function generateLocationImage(imagePrompt) {
  // 显示生图提示
  showNotification('正在生成图片，请稍候，不要离开页面...');
  
  // AI已经返回英文prompt，直接使用
  let prompt = imagePrompt;
  
  // 确保包含像素艺术风格（如果AI忘记添加）
  if (!prompt.includes('pixel art') && !prompt.includes('16-bit')) {
    prompt = `${prompt}, pixel art style, 16-bit game graphics`;
  }
  
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `${POLLINATIONS_IMAGE_API}${encodedPrompt}?width=512&height=384&seed=${Date.now()}&nologo=true`;
  
  // 预加载图片确保可用
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      showNotification('图片生成完成！');
      resolve(imageUrl);
    };
    img.onerror = () => {
      showNotification('图片生成失败，使用默认图片');
      resolve('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384"><rect fill="%2387CEEB" width="512" height="384"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="24">风景图生成失败</text></svg>');
    };
    img.src = imageUrl;
  });
}

/**
 * 将图片URL转换为base64格式
 */
function imageUrlToBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    // 如果已经是base64格式，直接返回
    if (imageUrl.startsWith('data:image')) {
      resolve(imageUrl);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // 转换为base64，使用jpeg格式以减小体积
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(base64);
      } catch (error) {
        console.error('转换base64失败:', error);
        // 如果转换失败，返回原始URL
        resolve(imageUrl);
      }
    };
    
    img.onerror = () => {
      console.error('图片加载失败:', imageUrl);
      // 如果加载失败，返回默认的base64图片
      const defaultImage = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384"><rect fill="%2387CEEB" width="512" height="384"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="24">背景图</text></svg>';
      resolve(defaultImage);
    };
    
    img.src = imageUrl;
  });
}

/**
 * 显示探险进度
 */
function showAdventureProgress() {
  // 确保弹窗已打开，但不重复打开
  const modal = document.getElementById('modal-adventure');
  if (modal && modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
  }
  
  const content = document.getElementById('adventure-content');
  if (!content) return;
  
  const { currentLocation, locationImage, endTime, randomEvents, triggeredEvents } = gameState.adventureState;
  
  const remainingTime = Math.max(0, Math.ceil((endTime - Date.now()) / 60000));
  const totalEvents = randomEvents.length;
  const triggeredCount = triggeredEvents.length;
  
  // 找出未触发的事件
  const availableEvents = randomEvents.filter(e => !triggeredEvents.includes(e.eventId));
  const currentEvent = availableEvents[0];
  
  content.innerHTML = `
    <div class="adventure-progress">
      <h3>📍 ${currentLocation}</h3>
      <img src="${locationImage}" class="location-image" alt="${currentLocation}" 
           onerror="this.style.display='none'">
      
      <div class="adventure-stats">
        <p>⏱️ 剩余时间: <strong>${remainingTime}分钟</strong></p>
        <p>🎲 事件进度: <strong>${triggeredCount}/${totalEvents}</strong></p>
      </div>
      
      <div id="current-event-container">
        ${currentEvent ? `
          <div class="adventure-event">
            <h4>🎯 ${currentEvent.eventName}</h4>
            <p class="event-desc">${currentEvent.description}</p>
            <div class="event-choices">
              ${currentEvent.choices.map((choice, idx) => `
                <button class="choice-btn pixel-btn" data-event-id="${currentEvent.eventId}" data-choice-idx="${idx}">
                  ${choice.text}
                  <small>${choice.energyPercent < 0 ? (choice.energyPercent + '%⚡') : ''} ${choice.rewards.length > 0 ? '🎁' : ''}</small>
                </button>
              `).join('')}
            </div>
          </div>
        ` : `
          <p class="hint">${remainingTime > 0 ? '继续探索中...' : '探险结束，准备归来！'}</p>
        `}
      </div>
      
      <button id="return-early-btn" class="pixel-btn">
        ${remainingTime > 0 ? '提前结束探险' : '查看探险结果'}
      </button>
    </div>
  `;
  
  // 绑定选择按钮
  content.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const eventId = e.currentTarget.dataset.eventId;
      const choiceIdx = parseInt(e.currentTarget.dataset.choiceIdx);
      handleEventChoice(eventId, choiceIdx);
    });
  });
  
  // 绑定结束按钮
  content.querySelector('#return-early-btn')?.addEventListener('click', endAdventure);
}

/**
 * 处理事件选择
 */
function handleEventChoice(eventId, choiceIdx) {
  const event = gameState.adventureState.randomEvents.find(e => e.eventId === eventId);
  if (!event) return;
  
  const choice = event.choices[choiceIdx];
  if (!choice) return;
  
  // 应用效果（使用百分比计算）
  let energyChange = 0;
  let hungerChange = 0;
  
  // 使用百分比计算
  if (choice.energyPercent !== undefined) {
    const oldEnergy = gameState.stats.energy;
    gameState.stats.energy = oldEnergy * (1 + choice.energyPercent / 100);
    gameState.stats.energy = Math.max(5, Math.min(100, gameState.stats.energy)); // 最低5%，最高100%
    energyChange = gameState.stats.energy - oldEnergy;
  }
  
  if (choice.hungerPercent !== undefined) {
    const oldHunger = gameState.stats.hunger;
    gameState.stats.hunger = oldHunger * (1 + choice.hungerPercent / 100);
    gameState.stats.hunger = Math.max(5, Math.min(100, gameState.stats.hunger));
    hungerChange = gameState.stats.hunger - oldHunger;
  }
  
  // 记录奖励
  gameState.adventureState.finalRewards.energyChange += energyChange;
  gameState.adventureState.finalRewards.hungerChange += hungerChange;
  
  // 处理新的奖励结构（支持对象数组）
  if (choice.rewards && Array.isArray(choice.rewards)) {
    choice.rewards.forEach(reward => {
      // 兼容旧格式（字符串数组）
      if (typeof reward === 'string') {
        gameState.adventureState.finalRewards.treasures.push({
          name: reward,
          foundAt: Date.now()
        });
      } 
      // 新格式（对象）
      else if (typeof reward === 'object') {
        if (reward.type === 'coin') {
          // 金币奖励
          gameState.inventory.coins += (reward.value || 0);
          gameState.adventureState.finalRewards.coinsGained += (reward.value || 0);
        } else if (reward.type === 'hunger') {
          // 饱食度变化
          gameState.stats.hunger = Math.max(0, Math.min(100, gameState.stats.hunger + (reward.value || 0)));
          gameState.adventureState.finalRewards.hungerChange += (reward.value || 0);
        } else if (reward.type === 'treasure') {
          // 宝物奖励
          const treasureName = reward.treasureName || reward.name || '未知宝物';
          const imagePrompt = reward.treasureImagePrompt || '';
          
          // 警告：如果缺少treasureImagePrompt
          if (!imagePrompt) {
            console.warn(`⚠️ 宝物"${treasureName}"缺少treasureImagePrompt字段，将无法生成图片！`);
            console.warn('完整reward对象:', reward);
          } else {
            console.log(`✅ 宝物"${treasureName}"包含图片提示词，将生成图片`);
          }
          
          gameState.adventureState.finalRewards.treasures.push({
            name: treasureName,
            foundAt: Date.now(),
            imagePrompt: imagePrompt // 保存图片提示词
          });
        }
      }
    });
  }
  
  // 标记已触发
  gameState.adventureState.triggeredEvents.push(eventId);
  
  addUnifiedLog('adventure_event', {
    eventName: event.eventName,
    choice: choice.text
  });
  
  updateAllStats();
  updateCoinDisplay();
  saveGameState();
  
  showFloatingText(choice.text + '！', null, null);
  
  setTimeout(() => showAdventureProgress(), 1000);
}

/**
 * 添加宝物到图鉴（带去重检查）
 * @param {Object} treasure - 宝物对象
 * @param {string} location - 发现地点
 * @returns {boolean} - 是否成功添加（false表示已存在）
 */
function addTreasureToEncyclopedia(treasure, location) {
  // 检查是否已存在同名宝物
  const existing = gameState.encyclopedia.treasures.find(
    t => t.name === treasure.name
  );
  
  if (existing) {
    console.log(`💎 "${treasure.name}" 已在图鉴中，不再重复添加`);
    showNotification(`💎 "${treasure.name}" 已在图鉴中`);
    return false;
  }
  
  // 创建新宝物对象
  const treasureId = `treasure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const treasureObj = {
    treasureId: treasureId,
    name: treasure.name,
    imageUrl: '', // 先为空,异步生成后更新
    foundAt: treasure.foundAt || Date.now(),
    description: `在${location}发现`,
    imagePrompt: treasure.imagePrompt || '' // 保存图片提示词
  };
  
  // 添加到图鉴
  gameState.encyclopedia.treasures.push(treasureObj);
  
  // 异步生成宝物图片（如果有imagePrompt则直接使用，否则调用AI翻译）
  if (treasure.imagePrompt) {
    console.log(`🎨 开始为宝物"${treasure.name}"生成图片，提示词:`, treasure.imagePrompt.substring(0, 50) + '...');
    
    // 直接使用已有的英文图片提示词生成图片
    const encodedPrompt = encodeURIComponent(treasure.imagePrompt);
    const imageUrl = `${POLLINATIONS_IMAGE_API}${encodedPrompt}?width=256&height=256&seed=${Date.now()}&nologo=true`;
    
    // 预加载图片
    const img = new Image();
    img.onload = () => {
      // 更新宝物图片URL
      const foundTreasure = gameState.encyclopedia.treasures.find(t => t.treasureId === treasureId);
      if (foundTreasure) {
        foundTreasure.imageUrl = imageUrl;
        saveGameState();
        console.log(`✅ 宝物"${treasure.name}"图片生成成功`);
      }
    };
    img.onerror = () => {
      console.error(`❌ 宝物"${treasure.name}"图片生成失败`);
      // 使用默认占位图
      const foundTreasure = gameState.encyclopedia.treasures.find(t => t.treasureId === treasureId);
      if (foundTreasure) {
        foundTreasure.imageUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="%23FFD700" width="256" height="256"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48">💎</text></svg>';
        saveGameState();
      }
    };
    img.src = imageUrl;
  } else {
    console.warn(`⚠️⚠️⚠️ 宝物"${treasure.name}"缺少imagePrompt，无法生成图片！`);
    console.warn('这通常是因为AI生成探险内容时遗漏了treasureImagePrompt字段');
    console.warn('宝物对象:', treasure);
  }
  
  saveGameState();
  console.log(`✅ 宝物 "${treasure.name}" 已添加到图鉴`);
  return true;
}

/**
 * 结束探险
 */
async function endAdventure() {
  const { currentLocation, finalRewards, duration, triggeredEvents, randomEvents } = gameState.adventureState;
  
  const content = document.getElementById('adventure-content');
  if (content) {
    content.innerHTML = '<p class="loading">整理探险日志...</p>';
  }
  
  // 计算金币奖励
  // 基础奖励：根据探险时长
  const baseCoins = Math.floor(duration / 10); // 每10分钟10金币
  // 事件完成奖励：每个完成的事件额外奖励
  const eventBonus = triggeredEvents.length * 20;
  // 宝物奖励：每个宝物额外奖励
  const treasureBonus = finalRewards.treasures.length * 30;
  // 总金币奖励
  const totalCoins = baseCoins + eventBonus + treasureBonus;
  
  // 添加金币
  gameState.inventory.coins += totalCoins;
  finalRewards.coinsGained = totalCoins;
  
  // 保存宝物到图鉴（使用去重函数）
  for (const treasure of finalRewards.treasures) {
    addTreasureToEncyclopedia(treasure, currentLocation);
  }
  
  // 生成简单的故事 - 使用动态口癖
  const story = `${getPetCatchphrase('double')}！今天在${currentLocation}探险太开心了！` +
    (finalRewards.treasures.length > 0 
      ? `还找到了${finalRewards.treasures.map(t => t.name).join('、')}呢！` 
      : '虽然没找到宝物，但是风景真的很美！') +
    (totalCoins > 0 ? `还获得了${totalCoins}金币！` : '') +
    `下次我们再一起去冒险吧，${gameState.ownerName}！`;
  
  finalRewards.story = story;
  
  // 收集本次探险相关的日志ID，用于后续删除
  const adventureStartTime = gameState.adventureState.startTime || 0;
  const adventureEndTime = Date.now();
  const adventureLogIds = gameState.aiData.unifiedLogs
    .filter(log => 
      log.type === 'adventure_event' && 
      log.timestamp >= adventureStartTime && 
      log.timestamp <= adventureEndTime
    )
    .map(log => log.logId);
  
  // 异步生成探险日志（日记形式）
  console.log('📝 开始生成探险日志，任务将立即加入AI队列...');
  (async () => {
    try {
      console.log('📝 探险日志生成任务已进入AI队列，等待处理...');
      const adventureLog = await generateAdventureLog({
        location: currentLocation,
        duration: duration,
        triggeredEvents: triggeredEvents.length,
        totalEvents: randomEvents.length,
        treasures: finalRewards.treasures.map(t => t.name),
        coinsGained: totalCoins,
        energyChange: finalRewards.energyChange,
        hungerChange: finalRewards.hungerChange
      });
      
      console.log('✅ 探险日志生成成功，保存到图鉴...');
      
      // 添加到logSummaries，使用type区分
      gameState.aiData.logSummaries.push({
        summaryId: `adventure_log_${Date.now()}`,
        type: 'adventure_log', // 标记为探险日志
        timestamp: Date.now(),
        location: currentLocation,
        aiSummary: adventureLog,
        processedLogIds: adventureLogIds // 保存已处理的日志ID
      });
      
      // 从unifiedLogs中删除本次探险相关的所有日志条目
      gameState.aiData.unifiedLogs = gameState.aiData.unifiedLogs.filter(
        log => !adventureLogIds.includes(log.logId)
      );
      
      saveGameState();
      showNotification('📝 探险日志已生成并保存到图鉴！');
    } catch (error) {
      console.error('❌ 生成探险日志失败:', error);
      // 即使生成失败，也删除相关日志
      gameState.aiData.unifiedLogs = gameState.aiData.unifiedLogs.filter(
        log => !adventureLogIds.includes(log.logId)
      );
      saveGameState();
    }
  })();
  
  showAdventureReport(finalRewards);
  
  gameState.adventureState.isAdventuring = false;
  updateCoinDisplay();
  saveGameState();
}

/**
 * 生成探险日志（日记形式）
 */
async function generateAdventureLog(adventureData) {
  // 获取当前时间信息
  const nowDate = new Date();
  const currentHour = nowDate.getHours();
  const timeOfDay = currentHour >= 6 && currentHour < 12 ? '早上' : 
                    currentHour >= 12 && currentHour < 18 ? '下午' : 
                    currentHour >= 18 && currentHour < 22 ? '晚上' : '深夜';
  
  // 获取宠物性格设定
  const petData = POKEMON_DATABASE[gameState.petId];
  const personalityPrompt = petData.aiPersonality.systemPrompt.replace('{{OWNER_NAME}}', gameState.ownerName);
  
  const prompt = `你是${gameState.petNickname}，写一份探险日记给主人${gameState.ownerName}。

【你的性格设定】
${personalityPrompt}

重要：请按照上述性格设定书写日记，使用你独特的语气和表达方式。

当前时间：${timeOfDay} ${currentHour}:${String(nowDate.getMinutes()).padStart(2, '0')}

探险信息：
- 地点：${adventureData.location}
- 探险时长：${adventureData.duration}分钟
- 完成事件：${adventureData.triggeredEvents}/${adventureData.totalEvents}
- 获得宝物：${adventureData.treasures.length > 0 ? adventureData.treasures.join('、') : '无'}
- 获得金币：${adventureData.coinsGained}
- 体力变化：${adventureData.energyChange}
- 饱食度变化：${adventureData.hungerChange}

要求：
1. 以日记形式书写，用第一人称（我）
2. 200-300字左右
3. 温馨、有趣、生动
4. 描述探险过程中的感受和经历，可以提及时间氛围（白天/夜晚）
5. 必须体现你的性格特点（如口癖、行为习惯、性格特征）
6. 只返回日记内容，不要标题和其他格式`;

  try {
    const apiConfig = getAPIConfig();
    const adventureLog = await retryAIRequest(apiConfig.model, [
      { role: 'system', content: `你是${gameState.petNickname}，撰写探险日记` },
      { role: 'user', content: prompt }
    ], 3, 1, 'report', '生成探险日志');
    
    // 验证返回内容是否有效
    if (!adventureLog || typeof adventureLog !== 'string' || !adventureLog.trim()) {
      throw new Error('AI返回的探险日志为空');
    }
    
    // 检查是否包含错误消息关键词
    const errorKeywords = ['空响应', '错误', '失败', '无法', '不能', '请修改', '达到上限'];
    const trimmedLog = adventureLog.trim();
    const hasErrorKeyword = errorKeywords.some(keyword => trimmedLog.includes(keyword));
    
    // 如果内容很短且包含错误关键词，认为是错误消息
    if (hasErrorKeyword && trimmedLog.length < 100) {
      throw new Error(`AI返回错误消息: ${trimmedLog.substring(0, 50)}`);
    }
    
    return trimmedLog;
  } catch (error) {
    console.warn('AI生成探险日志失败，使用默认日志:', error);
    // 返回默认的探险日志
    const defaultLog = `今天和主人${gameState.ownerName}一起去了${adventureData.location}探险！

我们花了${adventureData.duration}分钟的时间，完成了${adventureData.triggeredEvents}个事件。${adventureData.treasures.length > 0 ? `最开心的是找到了${adventureData.treasures.join('、')}！` : '虽然没找到宝物，但是风景真的很美！'}${adventureData.coinsGained > 0 ? `还获得了${adventureData.coinsGained}金币呢！` : ''}

虽然有点累（体力变化：${adventureData.energyChange}），但是和主人一起冒险真的太开心了！下次还要一起去探险！

—— ${gameState.petNickname} ❤️`;
    
    return defaultLog;
  }
}

/**
 * 显示探险报告
 */
function showAdventureReport(rewards) {
  const content = document.getElementById('adventure-content');
  if (!content) return;
  
  content.innerHTML = `
    <div class="adventure-report">
      <h3>🎉 ${gameState.petNickname}回来了！</h3>
      
      <div class="report-story">
        <p>${rewards.story}</p>
      </div>
      
      <div class="report-stats">
        <p>⚡ 体力: ${rewards.energyChange > 0 ? '+' : ''}${rewards.energyChange}</p>
        <p>🍖 饱腹: ${rewards.hungerChange > 0 ? '+' : ''}${rewards.hungerChange}</p>
        ${rewards.coinsGained > 0 ? `<p>💰 金币: +${rewards.coinsGained}</p>` : ''}
      </div>
      
      ${rewards.treasures.length > 0 ? `
        <div class="report-treasures">
          <h4>🎁 获得的宝物</h4>
          <div class="treasure-grid">
            ${rewards.treasures.map(t => `
              <div class="treasure-item">
                <span class="treasure-icon">💎</span>
                <p>${t.name}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<p class="no-rewards">这次没有找到宝物，但风景很美！</p>'}
      
      <button class="pixel-btn primary" onclick="hideModal('modal-adventure')">
        继续陪伴
      </button>
    </div>
  `;
}

// ============================================================
// 模块10: 商店系统
// ============================================================

/**
 * 初始化商店
 */
function initShop() {
  console.log('🏪 初始化商店');
  
  loadGameState();
  
  if (!gameState.ownerName) {
    window.location.href = getPagePath('index.html');
    return;
  }
  
  renderShopItems();
  updateShopCoinDisplay();
  
  // 应用背景
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 18;
  updateBackgroundTheme(isDay ? 'day' : 'night');
  
  // 绑定返回按钮
  document.getElementById('btn-back')?.addEventListener('click', () => {
    window.location.href = getPagePath('game.html');
  });
  
  // 绑定分类按钮
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderShopItems(e.target.dataset.category);
    });
  });
  
  // 绑定确认/取消购买
  document.getElementById('confirm-purchase-btn')?.addEventListener('click', confirmPurchase);
  document.getElementById('cancel-purchase-btn')?.addEventListener('click', () => {
    document.getElementById('purchase-modal')?.classList.add('hidden');
  });
  document.getElementById('close-purchase-modal')?.addEventListener('click', () => {
    document.getElementById('purchase-modal')?.classList.add('hidden');
  });
}

let pendingPurchaseItemId = null;

/**
 * 渲染商店商品
 */
function renderShopItems(category = 'all') {
  const shopGrid = document.getElementById('shop-grid');
  if (!shopGrid) return;
  
  shopGrid.innerHTML = '';
  
  const filteredItems = category === 'all' 
    ? SHOP_ITEMS 
    : SHOP_ITEMS.filter(item => item.type === category);
  
  filteredItems.forEach(item => {
    const itemCard = document.createElement('div');
    itemCard.className = 'shop-item';
    itemCard.dataset.itemId = item.itemId;
    
    // 检查库存
    const inventoryItem = gameState.inventory.items.find(i => i.itemId === item.itemId);
    const ownedCount = inventoryItem ? inventoryItem.count : 0;
    
    itemCard.innerHTML = `
      <img src="${item.icon}" class="item-icon" alt="${item.itemName}" 
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 font-size=%2240%22>📦</text></svg>'">
      <h4 class="item-name">${item.itemName}</h4>
      <p class="item-desc">${item.description}</p>
      <p class="item-owned">已拥有: ${ownedCount}</p>
      <p class="item-price">💰 ${item.price}</p>
      <button class="buy-btn pixel-btn small" data-item-id="${item.itemId}">购买</button>
    `;
    
    shopGrid.appendChild(itemCard);
  });
  
  // 绑定购买按钮
  shopGrid.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      purchaseItem(e.target.dataset.itemId);
    });
  });
}

/**
 * 购买物品
 */
function purchaseItem(itemId) {
  const item = SHOP_ITEMS.find(i => i.itemId === itemId);
  if (!item) return;
  
  if (gameState.inventory.coins < item.price) {
    showNotification('金币不足！');
    return;
  }
  
  pendingPurchaseItemId = itemId;
  
  const modal = document.getElementById('purchase-modal');
  const details = document.getElementById('purchase-details');
  
  if (details) {
    details.innerHTML = `
      <p>购买 <strong>${item.itemName}</strong>？</p>
      <p class="price-tag">价格: 💰 ${item.price}</p>
      <p>效果: ${Object.keys(item.effects).map(k => `${k}: ${item.effects[k] > 0 ? '+' : ''}${item.effects[k]}`).join(', ')}</p>
    `;
  }
  
  modal?.classList.remove('hidden');
}

/**
 * 确认购买
 */
function confirmPurchase() {
  if (!pendingPurchaseItemId) return;
  
  const item = SHOP_ITEMS.find(i => i.itemId === pendingPurchaseItemId);
  if (!item) return;
  
  if (gameState.inventory.coins < item.price) {
    showNotification('金币不足！');
    document.getElementById('purchase-modal')?.classList.add('hidden');
    return;
  }
  
  // 扣除金币
  gameState.inventory.coins -= item.price;
  
  // 添加到背包
  const existingItem = gameState.inventory.items.find(i => i.itemId === pendingPurchaseItemId);
  if (existingItem) {
    existingItem.count++;
  } else {
    gameState.inventory.items.push({
      itemId: pendingPurchaseItemId,
      count: 1,
      type: item.type
    });
  }
  
  // 解锁图鉴
  if (!gameState.encyclopedia.unlockedItems.includes(pendingPurchaseItemId)) {
    gameState.encyclopedia.unlockedItems.push(pendingPurchaseItemId);
  }
  
  saveGameState();
  
  showNotification(`购买成功！获得 ${item.itemName}`);
  updateShopCoinDisplay();
  renderShopItems(document.querySelector('.category-btn.active')?.dataset.category || 'all');
  
  document.getElementById('purchase-modal')?.classList.add('hidden');
  pendingPurchaseItemId = null;
}

/**
 * 更新商店金币显示
 */
function updateShopCoinDisplay() {
  const coinCount = document.getElementById('shop-coin-count');
  if (coinCount) {
    coinCount.textContent = gameState.inventory.coins;
  }
}

// ============================================================
// 模块11: 图鉴系统
// ============================================================

/**
 * 初始化图鉴
 */
function initEncyclopedia() {
  updateEncyclopediaBadges();
  renderEncyclopediaItems();
  renderEncyclopediaTreasures();
  renderPhotoAlbum();
  renderLogReports();
  renderPetLetters();
}

/**
 * 更新图鉴徽章
 */
function updateEncyclopediaBadges() {
  const totalItems = SHOP_ITEMS.length;
  const unlockedCount = gameState.encyclopedia.unlockedItems.length;
  const completion = totalItems > 0 ? Math.floor((unlockedCount / totalItems) * 100) : 0;
  
  const itemsCompletion = document.getElementById('items-completion');
  if (itemsCompletion) itemsCompletion.textContent = `${completion}%`;
  
  const treasuresCount = document.getElementById('treasures-count');
  if (treasuresCount) treasuresCount.textContent = gameState.encyclopedia.treasures.length;
  
  const photosCount = document.getElementById('photos-count');
  if (photosCount) photosCount.textContent = gameState.encyclopedia.photoAlbum.length;
  
  const reportsCount = document.getElementById('reports-count');
  if (reportsCount) reportsCount.textContent = gameState.aiData.logSummaries.length;
  
  const lettersCount = document.getElementById('letters-count');
  if (lettersCount) lettersCount.textContent = gameState.aiData.petLetters.length;
}

/**
 * 切换图鉴标签页
 */
function switchEncyclopediaTab(tabName) {
  // 切换按钮激活状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // 切换内容显示
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  const contentMap = {
    'items': 'encyclopedia-items',
    'treasures': 'encyclopedia-treasures',
    'photos': 'encyclopedia-photos',
    'reports': 'encyclopedia-reports',
    'letters': 'encyclopedia-letters'
  };
  
  const targetContent = document.getElementById(contentMap[tabName]);
  if (targetContent) targetContent.classList.remove('hidden');
}

/**
 * 渲染商品图鉴
 */
function renderEncyclopediaItems() {
  const grid = document.getElementById('encyclopedia-items');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  SHOP_ITEMS.forEach(item => {
    const isUnlocked = gameState.encyclopedia.unlockedItems.includes(item.itemId);
    
    const card = document.createElement('div');
    card.className = `encyclopedia-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    
    if (isUnlocked) {
      const iconPath = item.icon.replace(/\.(svg|png|gif)$/i, ''); // 移除扩展名以支持多格式
      card.innerHTML = `
        <img alt="${item.itemName}" class="encyc-icon">
        <div class="encyclopedia-card-info">
          <h4>${item.itemName}</h4>
          <p class="encyc-desc">${item.description}</p>
        </div>
      `;
      const iconImg = card.querySelector('.encyc-icon');
      if (iconImg) {
        loadImageWithFallback(iconImg, iconPath, item.icon);
      }
    } else {
      card.innerHTML = `
        <div class="mystery-icon">❓</div>
        <div class="encyclopedia-card-info">
          <h4>未解锁</h4>
          <p class="encyc-hint">购买后解锁</p>
        </div>
      `;
    }
    
    grid.appendChild(card);
  });
}

/**
 * 渲染宝物图鉴
 */
function renderEncyclopediaTreasures() {
  const grid = document.getElementById('encyclopedia-treasures');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (gameState.encyclopedia.treasures.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>📦 还没有收集到宝物</p>
        <p>快去探险寻找吧！</p>
      </div>
    `;
    return;
  }
  
  gameState.encyclopedia.treasures.slice().reverse().forEach(treasure => {
    const card = document.createElement('div');
    card.className = 'encyclopedia-card treasure unlocked';
    
    const treasureId = treasure.treasureId || `treasure_${treasure.foundAt}`;
    const treasureIcon = treasure.imageUrl ? `<img src="${treasure.imageUrl}" alt="${treasure.name}" class="encyc-icon treasure-image" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><text x=%2232%22 y=%2244%22 text-anchor=%22middle%22 font-size=%2240%22>💎</text></svg>'">` : '<span class="treasure-icon-large">💎</span>';
    
    card.innerHTML = `
      ${treasureIcon}
      <div class="encyclopedia-card-info">
        <h4>${treasure.name}</h4>
        <p class="encyc-desc">${treasure.description || '探险发现的神秘宝物'}</p>
        <p class="encyc-date">📅 ${new Date(treasure.foundAt).toLocaleDateString('zh-CN')}</p>
        <button class="delete-treasure-btn pixel-btn small" data-treasure-id="${treasureId}" title="删除宝物" onclick="event.stopPropagation(); deleteTreasure('${treasureId}')" style="margin-top: var(--space-xs);">🗑️ 删除</button>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

/**
 * 渲染相册
 */
function renderPhotoAlbum() {
  const gallery = document.getElementById('encyclopedia-photos');
  if (!gallery) return;
  
  gallery.innerHTML = '';
  
  if (gameState.encyclopedia.photoAlbum.length === 0) {
    gallery.innerHTML = `
      <div class="empty-state">
        <p>📷 相册是空的</p>
        <p>去探险拍摄美丽的风景吧！</p>
      </div>
    `;
    return;
  }
  
  gameState.encyclopedia.photoAlbum.slice().reverse().forEach(photo => {
    const photoCard = document.createElement('div');
    photoCard.className = 'photo-card';
    
    const photoId = photo.photoId || photo.takenAt;
    photoCard.innerHTML = `
      <div class="photo-frame">
        <img src="${photo.imageUrl}" alt="${photo.locationName}" class="photo-image"
             onerror="this.parentElement.innerHTML='<div class=\\'photo-placeholder\\'>🏞️</div>'">
      </div>
      <div class="photo-info">
        <h4>${photo.locationName}</h4>
        <p class="photo-date">📅 ${new Date(photo.takenAt).toLocaleDateString('zh-CN')}</p>
        <button class="regenerate-photo-btn pixel-btn small" data-photo-id="${photoId}" title="重新生成图片" onclick="event.stopPropagation(); regeneratePhotoImage('${photoId}')" style="margin-top: var(--space-xs); width: 100%;">🔄 重新生成图片</button>
        <button class="delete-photo-btn pixel-btn small danger" data-photo-id="${photoId}" title="删除照片" onclick="event.stopPropagation(); deletePhoto('${photoId}')" style="margin-top: var(--space-xs); width: 100%;">🗑️ 删除照片</button>
      </div>
    `;
    
    // 添加点击事件，点击图片或卡片都可以放大
    const photoImage = photoCard.querySelector('.photo-image');
    if (photoImage) {
      photoImage.style.cursor = 'pointer';
      photoImage.addEventListener('click', () => {
        showPhotoModal(photo);
      });
    }
    photoCard.style.cursor = 'pointer';
    photoCard.addEventListener('click', () => {
      showPhotoModal(photo);
    });
    
    gallery.appendChild(photoCard);
  });
}

/**
 * 显示照片大图模态框
 */
function showPhotoModal(photo) {
  // 移除已存在的模态框
  const existingModal = document.querySelector('.photo-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal photo-modal active';
  modal.innerHTML = `
    <div class="modal-content photo-viewer">
      <button class="close-btn" onclick="this.closest('.photo-modal').remove()">×</button>
      <img src="${photo.imageUrl}" alt="${photo.locationName}" class="fullsize-photo"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22512%22 height=%22384%22><rect fill=%22%2387CEEB%22 width=%22512%22 height=%22384%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2224%22>图片加载失败</text></svg>'">
      <div class="photo-details">
        <h3>${photo.locationName || '未知地点'}</h3>
        <p class="photo-modal-date">📅 ${new Date(photo.takenAt).toLocaleString('zh-CN')}</p>
        ${photo.caption ? `<p class="photo-caption">${photo.caption}</p>` : ''}
        <div style="margin-top: var(--space-md); display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;">
          <button class="pixel-btn primary" id="set-bg-btn">设为背景</button>
          ${photo.imagePrompt ? `<button class="pixel-btn" id="regenerate-bg-btn" data-photo-id="${photo.photoId || photo.takenAt}">重新生成</button>` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 绑定设为背景按钮
  const setBgBtn = modal.querySelector('#set-bg-btn');
  if (setBgBtn) {
    setBgBtn.addEventListener('click', () => {
      setPhotoAsBackground(photo.imageUrl);
      modal.remove();
    });
  }
  
  // 绑定重新生成按钮
  const regenerateBgBtn = modal.querySelector('#regenerate-bg-btn');
  if (regenerateBgBtn) {
    regenerateBgBtn.addEventListener('click', async () => {
      // 先要求用户输入英文提示词
      const promptModal = createPromptInputModal(
        '输入图片提示词（英文）',
        photo.imagePrompt || '',
        async (imagePrompt) => {
          if (!imagePrompt || !imagePrompt.trim()) {
            showNotification('提示词不能为空');
            return;
          }
          
          regenerateBgBtn.disabled = true;
          regenerateBgBtn.textContent = '生成中...';
          
          try {
            const newImageUrl = await generateLocationImage(imagePrompt.trim());
            
            // 更新相册中的图片
            const photoIndex = gameState.encyclopedia.photoAlbum.findIndex(p => 
              (p.photoId && p.photoId === photo.photoId) || 
              (!p.photoId && p.takenAt === photo.takenAt && p.locationName === photo.locationName)
            );
            
            if (photoIndex !== -1) {
              gameState.encyclopedia.photoAlbum[photoIndex].imageUrl = newImageUrl;
              gameState.encyclopedia.photoAlbum[photoIndex].imagePrompt = imagePrompt.trim();
              saveGameState();
              renderPhotoAlbum();
              
              // 更新模态框中的图片
              const photoImg = modal.querySelector('.fullsize-photo');
              if (photoImg) {
                photoImg.src = newImageUrl;
              }
              
              showNotification('图片重新生成完成！');
            }
          } catch (error) {
            console.error('重新生成图片失败:', error);
            showNotification('重新生成失败，请稍后重试');
          } finally {
            regenerateBgBtn.disabled = false;
            regenerateBgBtn.textContent = '重新生成';
          }
        }
      );
    });
  }
  
  // 点击背景关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // ESC键关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * 创建输入提示词的模态框
 */
function createPromptInputModal(title, defaultValue, onConfirm) {
  // 移除已存在的模态框
  const existingModal = document.querySelector('.prompt-input-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal prompt-input-modal active';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="close-btn" onclick="this.closest('.prompt-input-modal').remove()">×</button>
      </div>
      <div style="margin-top: var(--space-md);">
        <label class="pixel-label">请输入英文图片提示词：</label>
        <textarea id="prompt-input-textarea" class="pixel-input" rows="5" placeholder="例如：pixel art treasure item Mysterious Fruit, 16-bit style, game item, shiny, detailed, on transparent background" style="width: 100%; min-height: 100px; resize: vertical; font-family: inherit;">${defaultValue || ''}</textarea>
        <div style="margin-top: var(--space-md); display: flex; gap: var(--space-sm); justify-content: flex-end;">
          <button class="pixel-btn" id="prompt-cancel-btn">取消</button>
          <button class="pixel-btn primary" id="prompt-confirm-btn">确认</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const textarea = modal.querySelector('#prompt-input-textarea');
  if (textarea) {
    textarea.focus();
    textarea.select();
  }
  
  // 确认按钮
  modal.querySelector('#prompt-confirm-btn')?.addEventListener('click', () => {
    const prompt = textarea.value.trim();
    modal.remove();
    if (onConfirm) {
      onConfirm(prompt);
    }
  });
  
  // 取消按钮
  modal.querySelector('#prompt-cancel-btn')?.addEventListener('click', () => {
    modal.remove();
  });
  
  // ESC键关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // 点击背景关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
  
  return modal;
}

/**
 * 重新生成相册图片
 */
async function regeneratePhotoImage(photoId) {
  const photo = gameState.encyclopedia.photoAlbum.find(p => 
    (p.photoId && p.photoId === photoId) || 
    (!p.photoId && p.takenAt === photoId && p.locationName)
  );
  
  if (!photo) {
    showNotification('找不到该照片');
    return;
  }
  
  // 要求用户输入英文提示词
  createPromptInputModal(
    '重新生成相册图片',
    photo.imagePrompt || '',
    async (imagePrompt) => {
      if (!imagePrompt || !imagePrompt.trim()) {
        showNotification('提示词不能为空');
        return;
      }
      
      showNotification('正在重新生成图片...');
      
      try {
        const newImageUrl = await generateLocationImage(imagePrompt.trim());
        
        // 更新相册中的图片
        const photoIndex = gameState.encyclopedia.photoAlbum.findIndex(p => 
          (p.photoId && p.photoId === photoId) || 
          (!p.photoId && p.takenAt === photoId)
        );
        
        if (photoIndex !== -1) {
          gameState.encyclopedia.photoAlbum[photoIndex].imageUrl = newImageUrl;
          gameState.encyclopedia.photoAlbum[photoIndex].imagePrompt = imagePrompt.trim();
          
          // 如果当前正在探险，且探险地点与此照片相同，同步更新探险界面
          if (gameState.adventureState.isAdventuring && 
              gameState.adventureState.currentLocation === photo.locationName) {
            gameState.adventureState.locationImage = newImageUrl;
            // 如果探险窗口打开，刷新显示
            const adventureModal = document.getElementById('modal-adventure');
            if (adventureModal && !adventureModal.classList.contains('hidden')) {
              showAdventureProgress();
            }
          }
          
          saveGameState();
          renderPhotoAlbum();
          showNotification('图片重新生成完成！');
        }
      } catch (error) {
        console.error('重新生成图片失败:', error);
        showNotification('重新生成失败，请稍后重试');
      }
    }
  );
}

/**
 * 将相册中的图片设为背景
 */
function setPhotoAsBackground(imageUrl) {
  try {
    // 确保settings对象存在
    if (!gameState.settings) {
      gameState.settings = {};
    }
    
    // 如果图片是base64格式，直接使用；否则需要转换
    if (imageUrl.startsWith('data:image')) {
      gameState.settings.backgroundImage = imageUrl;
    } else {
      // 对于URL格式的图片，需要转换为base64
      imageUrlToBase64(imageUrl).then(base64Image => {
        gameState.settings.backgroundImage = base64Image;
        updateBackgroundTheme(document.body.dataset.theme || 'day');
        saveGameState();
        showNotification('背景已更换！');
      }).catch(error => {
        console.error('转换图片失败:', error);
        showNotification('背景设置失败');
      });
      return;
    }
    
    // 更新背景
    updateBackgroundTheme(document.body.dataset.theme || 'day');
    saveGameState();
    showNotification('背景已更换！');
  } catch (error) {
    console.error('设置背景失败:', error);
    showNotification('背景设置失败');
  }
}

/**
 * 渲染相处报告
 */
function renderLogReports() {
  const reportsView = document.getElementById('reports-view');
  const logsView = document.getElementById('logs-view');
  
  if (!reportsView || !logsView) return;
  
  // 渲染报告视图
  reportsView.innerHTML = '';
  
  if (gameState.aiData.logSummaries.length === 0) {
    reportsView.innerHTML = `
      <div class="empty-state">
        <p>📊 还没有生成报告</p>
        <p>每50条互动记录会自动生成一份温馨报告</p>
        <p class="progress-hint">当前进度: ${gameState.aiData.unifiedLogs.length}/50</p>
      </div>
    `;
  } else {
    gameState.aiData.logSummaries.slice().reverse().forEach((summary, index) => {
      const reportCard = document.createElement('div');
      reportCard.className = 'report-card';
      
      const reportDate = new Date(summary.timestamp);
      const dateStr = reportDate.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // 判断是相处报告还是探险日志
      const isAdventureLog = summary.type === 'adventure_log';
      let title;
      if (isAdventureLog) {
        title = `📝 探险日志 - ${summary.location || '未知地点'}`;
      } else {
        // 计算相处报告的序号（只计算非探险日志的报告）
        const allReports = gameState.aiData.logSummaries.filter(s => !s.type || s.type !== 'adventure_log');
        const reportIndex = allReports.findIndex(s => s.summaryId === summary.summaryId || s.timestamp === summary.timestamp);
        title = `📋 第${allReports.length - reportIndex}份相处报告`;
      }
      
      const reportId = `report-${summary.summaryId || summary.timestamp}`;
      reportCard.className = 'report-card';
      reportCard.innerHTML = `
        <div class="report-header" onclick="toggleReportContent('${reportId}')" style="cursor: pointer;">
          <h4>${title}</h4>
          <div style="display: flex; align-items: center; gap: var(--space-sm);">
            <span class="report-date">📅 ${dateStr}</span>
            <button class="delete-report-btn pixel-btn small" data-summary-id="${summary.summaryId || summary.timestamp}" title="删除报告" onclick="event.stopPropagation(); deleteLogReport('${summary.summaryId || summary.timestamp}')">🗑️</button>
            <div class="report-arrow">▼</div>
          </div>
        </div>
        <div class="report-content-wrapper" id="${reportId}">
          <div class="report-content">
            <p>${summary.aiSummary}</p>
          </div>
          <div class="report-footer">
            ${isAdventureLog ? `<small>📝 探险日志</small>` : `<small>📝 覆盖 ${summary.coveredLogs || 0} 条互动记录</small>`}
          </div>
        </div>
      `;
      
      reportsView.appendChild(reportCard);
    });
  }
  
  // 渲染日志列表视图
  renderAllLogs();
}

/**
 * 删除日志报告
 */
function deleteLogReport(summaryId) {
  if (!confirm('确定要删除这份报告吗？')) {
    return;
  }
  
  // 尝试通过summaryId或timestamp查找
  const index = gameState.aiData.logSummaries.findIndex(summary => 
    (summary.summaryId && summary.summaryId.toString() === summaryId.toString()) ||
    summary.timestamp.toString() === summaryId.toString()
  );
  
  if (index !== -1) {
    gameState.aiData.logSummaries.splice(index, 1);
    saveGameState();
    renderLogReports();
    showNotification('报告已删除');
  } else {
    showNotification('删除失败：找不到该报告');
  }
}

/**
 * 渲染所有日志条目
 */
function renderAllLogs() {
  const logsView = document.getElementById('logs-view');
  if (!logsView) return;
  
  logsView.innerHTML = '';
  
  // 收集所有已处理的日志ID（从报告和探险日志中）
  const processedLogIds = new Set();
  gameState.aiData.logSummaries.forEach(summary => {
    if (summary.processedLogIds && Array.isArray(summary.processedLogIds)) {
      summary.processedLogIds.forEach(id => processedLogIds.add(id));
    }
  });
  
  // 过滤掉已处理的日志
  const unprocessedLogs = gameState.aiData.unifiedLogs.filter(
    log => !processedLogIds.has(log.logId)
  );
  
  if (unprocessedLogs.length === 0) {
    logsView.innerHTML = `
      <div class="empty-state">
        <p>📝 还没有日志记录</p>
        <p>与宠物互动、聊天、探险等活动会生成日志</p>
      </div>
    `;
    return;
  }
  
  // 按时间倒序显示
  unprocessedLogs.slice().reverse().forEach((log) => {
    const logCard = document.createElement('div');
    logCard.className = 'log-entry';
    logCard.dataset.logId = log.logId;
    
    const logDate = new Date(log.timestamp);
    const dateStr = logDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // 根据日志类型显示不同图标和内容
    let typeIcon = '📝';
    let contentText = '';
    
    switch (log.type) {
      case 'chat':
        typeIcon = '💬';
        contentText = `聊天: ${log.content.userMessage || ''} → ${log.content.aiReply || ''}`;
        break;
      case 'adventure_event':
        typeIcon = '🗺️';
        contentText = `探险事件: ${log.content.eventName || ''} - ${log.content.choice || ''}`;
        break;
      case 'adventure_summary':
        typeIcon = '📋';
        contentText = `探险总结: ${log.content.story || log.content.location || ''}`;
        break;
      case 'system':
        typeIcon = '⚙️';
        contentText = `系统: ${JSON.stringify(log.content)}`;
        break;
      default:
        contentText = JSON.stringify(log.content);
    }
    
    logCard.innerHTML = `
      <div class="log-entry-header">
        <span class="log-type-icon">${typeIcon}</span>
        <span class="log-date">${dateStr}</span>
        <button class="delete-log-btn pixel-btn small" data-log-id="${log.logId}" title="删除">🗑️</button>
      </div>
      <div class="log-entry-content">
        ${contentText}
      </div>
    `;
    
    logsView.appendChild(logCard);
  });
  
  // 绑定删除按钮事件
  logsView.querySelectorAll('.delete-log-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const logId = e.currentTarget.dataset.logId;
      deleteLogEntry(logId);
    });
  });
}

/**
 * 删除日志条目
 */
function deleteLogEntry(logId) {
  const index = gameState.aiData.unifiedLogs.findIndex(log => log.logId === logId);
  if (index !== -1) {
    gameState.aiData.unifiedLogs.splice(index, 1);
    saveGameState();
    renderAllLogs();
    showNotification('日志已删除');
  }
}

/**
 * 渲染宠物来信
 */
function renderPetLetters() {
  const container = document.getElementById('encyclopedia-letters');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (gameState.aiData.petLetters.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>💌 还没有收到来信</p>
        <p>每天${gameState.petNickname}可能会给你写信哦~</p>
      </div>
    `;
    return;
  }
  
  gameState.aiData.petLetters.slice().reverse().forEach(letter => {
    const letterCard = document.createElement('div');
    letterCard.className = 'letter-card';
    
    const letterDateStr = formatFullTime(letter.timestamp, true);
    const letterDateFull = new Date(letter.timestamp).toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    letterCard.className = 'letter-card';
    letterCard.innerHTML = `
      <div class="letter-envelope" onclick="toggleLetterContent('${letter.letterId}')">
        <div class="envelope-icon">✉️</div>
        <div class="envelope-preview">
          <h4>${letter.subject}</h4>
          <small>📅 ${letterDateStr}</small>
        </div>
        <button class="delete-letter-btn pixel-btn small" data-letter-id="${letter.letterId}" title="删除来信" onclick="event.stopPropagation(); deletePetLetter('${letter.letterId}')">🗑️</button>
        <div class="envelope-arrow">▼</div>
      </div>
      <div class="letter-content" id="letter-${letter.letterId}">
        <div class="letter-body">
          <p>${letter.content}</p>
        </div>
        <div class="letter-signature">
          <p>—— ${gameState.petNickname} 💛</p>
          <p class="letter-date" title="${letterDateFull}">${letterDateStr}</p>
        </div>
      </div>
    `;
    
    container.appendChild(letterCard);
  });
}

/**
 * 删除宠物来信
 */
function deletePetLetter(letterId) {
  if (!confirm('确定要删除这封来信吗？')) {
    return;
  }
  
  const index = gameState.aiData.petLetters.findIndex(letter => letter.letterId === letterId);
  if (index !== -1) {
    gameState.aiData.petLetters.splice(index, 1);
    saveGameState();
    renderPetLetters();
    showNotification('来信已删除');
  } else {
    showNotification('删除失败：找不到该来信');
  }
}

/**
 * 删除相册照片
 */
function deletePhoto(photoId) {
  if (!confirm('确定要删除这张照片吗？')) {
    return;
  }
  
  const index = gameState.encyclopedia.photoAlbum.findIndex(photo => 
    (photo.photoId && photo.photoId === photoId) || 
    (!photo.photoId && photo.takenAt === photoId)
  );
  
  if (index !== -1) {
    const photo = gameState.encyclopedia.photoAlbum[index];
    gameState.encyclopedia.photoAlbum.splice(index, 1);
    saveGameState();
    renderPhotoAlbum();
    showNotification(`照片"${photo.locationName}"已删除`);
  } else {
    showNotification('删除失败：找不到该照片');
  }
}

/**
 * 展开/收起信件
 */
function toggleLetterContent(letterId) {
  const letterCard = document.getElementById(`letter-${letterId}`).closest('.letter-card');
  if (letterCard) {
    letterCard.classList.toggle('expanded');
    const arrow = letterCard.querySelector('.envelope-arrow');
    if (arrow) {
      arrow.textContent = letterCard.classList.contains('expanded') ? '▲' : '▼';
    }
  }
}

/**
 * 展开/收起报告
 */
function toggleReportContent(reportId) {
  const reportCard = document.getElementById(reportId).closest('.report-card');
  if (reportCard) {
    reportCard.classList.toggle('expanded');
    const arrow = reportCard.querySelector('.report-arrow');
    if (arrow) {
      arrow.textContent = reportCard.classList.contains('expanded') ? '▲' : '▼';
    }
  }
}

/**
 * 删除宝物
 */
function deleteTreasure(treasureId) {
  if (!confirm('确定要删除这个宝物吗？')) {
    return;
  }
  
  const index = gameState.encyclopedia.treasures.findIndex(treasure => {
    const id = treasure.treasureId || `treasure_${treasure.foundAt}`;
    return id === treasureId;
  });
  
  if (index !== -1) {
    gameState.encyclopedia.treasures.splice(index, 1);
    saveGameState();
    renderEncyclopediaTreasures();
    showNotification('宝物已删除');
  } else {
    showNotification('删除失败：找不到该宝物');
  }
}

/**
 * 重新生成宝物图片
 */
async function regenerateTreasureImage(treasureId) {
  const treasure = gameState.encyclopedia.treasures.find(t => {
    const id = t.treasureId || `treasure_${t.foundAt}`;
    return id === treasureId;
  });
  
  if (!treasure) {
    showNotification('找不到该宝物');
    return;
  }
  
  // 要求用户输入英文提示词
  createPromptInputModal(
    `重新生成宝物图片：${treasure.name}`,
    treasure.imagePrompt || `pixel art treasure item ${treasure.name}, 16-bit style, game item, shiny, detailed, on transparent background`,
    async (imagePrompt) => {
      if (!imagePrompt || !imagePrompt.trim()) {
        showNotification('提示词不能为空');
        return;
      }
      
      showNotification('正在为宝物生成图片...');
      
      try {
        const imageUrl = await generateTreasureImage(treasure.name, imagePrompt.trim());
        treasure.imageUrl = imageUrl;
        treasure.imagePrompt = imagePrompt.trim(); // 保存新的提示词
        saveGameState();
        renderEncyclopediaTreasures();
        showNotification('图片生成完成！');
      } catch (error) {
        console.error('生成宝物图片失败:', error);
        showNotification('图片生成失败，请稍后重试');
      }
    }
  );
}

// ============================================================
// 模块12: 玩耍界面 (play.html)
// ============================================================

/**
 * 初始化玩耍界面
 */
function initPlay() {
  console.log('🎮 初始化玩耍界面');
  
  loadGameState();
  
  if (!gameState.ownerName) {
    window.location.href = getPagePath('index.html');
    return;
  }
  
  // 应用背景
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 18;
  updateBackgroundTheme(isDay ? 'day' : 'night');
  
  // 更新宠物名称
  document.querySelectorAll('.pet-name-placeholder').forEach(el => {
    el.textContent = gameState.petNickname;
  });
  
  // 渲染宠物精灵
  const petSprite = document.getElementById('pet-play-sprite');
  if (petSprite) {
    const petData = POKEMON_DATABASE[gameState.petId];
    if (petData && petData.assets) {
      // 优先使用happy状态，否则使用当前成长阶段
      const spritePath = petData.assets.happy || petData.assets[gameState.growthStage] || petData.assets.adult;
      const basePath = spritePath ? spritePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '') : null;
      petSprite.alt = gameState.petNickname || '宠物';
      
      if (basePath) {
        loadImageWithFallback(
          petSprite, 
          basePath, 
          `assets/${gameState.petId}/${gameState.growthStage || 'adult'}`,
          null,
          () => {
            loadImageWithFallback(petSprite, `assets/pikachu/${gameState.growthStage || 'adult'}`);
          }
        );
      } else {
        loadImageWithFallback(petSprite, `assets/${gameState.petId}/${gameState.growthStage || 'adult'}`, 'assets/pikachu/adult');
      }
    } else {
      console.error('宠物数据不存在:', gameState.petId);
      loadImageWithFallback(petSprite, 'assets/pikachu/adult');
    }
  }
  
  // 绑定返回按钮
  document.getElementById('btn-back')?.addEventListener('click', () => {
    window.location.href = getPagePath('game.html');
  });
  
  // 绑定结束玩耍按钮
  document.getElementById('end-play-btn')?.addEventListener('click', endPlaySession);
  
  // 显示游戏选择界面
  showGameSelection();
}

let playStartTime = 0;
let playTimer = null;
let currentGame = null;

/**
 * 显示游戏选择界面
 */
function showGameSelection() {
  const gamesList = document.getElementById('mini-games-list');
  const playAnimation = document.getElementById('play-animation');
  const playFooter = document.getElementById('play-footer');
  
  if (gamesList) gamesList.classList.remove('hidden');
  if (playAnimation) playAnimation.classList.add('hidden');
  if (playFooter) playFooter.classList.add('hidden');
  
  // 绑定游戏卡片点击事件
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const gameType = e.currentTarget.dataset.game;
      navigateToGame(gameType);
    });
  });
}

/**
 * 开始小游戏
 */
function startMiniGame(gameType) {
  currentGame = gameType;
  
  const gamesList = document.getElementById('mini-games-list');
  const playAnimation = document.getElementById('play-animation');
  const playFooter = document.getElementById('play-footer');
  
  if (gamesList) gamesList.classList.add('hidden');
  if (playAnimation) playAnimation.classList.remove('hidden');
  if (playFooter) playFooter.classList.remove('hidden');
  
  // 开始玩耍会话
  startPlaySession();
  
  // 根据游戏类型显示提示
  const gameNames = {
    catch: '接球游戏',
    dodge: '躲避游戏',
    rhythm: '节奏游戏',
    memory: '记忆游戏'
  };
  
  showNotification(`开始${gameNames[gameType] || '游戏'}！`);
}

/**
 * 开始玩耍会话
 */
function startPlaySession() {
  playStartTime = Date.now();
  gameState.interactions.lastPlayTime = playStartTime;
  
  // 更新计时器
  playTimer = setInterval(updatePlayTimer, 1000);
  
  // 点击宠物互动
  const petSprite = document.getElementById('pet-play-sprite');
  if (petSprite) {
    petSprite.addEventListener('click', playInteraction);
  }
}

/**
 * 更新玩耍计时器
 */
function updatePlayTimer() {
  const seconds = Math.floor((Date.now() - playStartTime) / 1000);
  const durationDisplay = document.getElementById('play-duration');
  if (durationDisplay) {
    durationDisplay.textContent = seconds;
  }
  
  // 每30秒增加心情
  if (seconds > 0 && seconds % 30 === 0) {
    gameState.stats.happiness = Math.min(100, gameState.stats.happiness + 2);
    const happinessGained = document.getElementById('happiness-gained');
    if (happinessGained) {
      happinessGained.textContent = Math.floor(seconds / 30) * 2;
    }
  }
}

/**
 * 玩耍互动（点击宠物）
 */
function playInteraction(event) {
  const petSprite = event.target;
  
  // 弹跳动画
  petSprite.style.transform = 'scale(1.2)';
  setTimeout(() => {
    petSprite.style.transform = 'scale(1)';
  }, 200);
  
  // 增加心情
  gameState.stats.happiness = Math.min(100, gameState.stats.happiness + 1);
  
  // 消耗体力
  gameState.stats.energy = Math.max(0, gameState.stats.energy - 0.5);
  
  showFloatingText('+1 💕', event.clientX, event.clientY);
}

/**
 * 结束玩耍会话
 */
function endPlaySession() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  
  const playSeconds = Math.floor((Date.now() - playStartTime) / 1000);
  const happinessGained = Math.floor(playSeconds / 30) * 2 + 5;
  const energyCost = Math.floor(playSeconds / 60) * 5;
  
  gameState.stats.happiness = Math.min(100, gameState.stats.happiness + happinessGained);
  gameState.stats.energy = Math.max(0, gameState.stats.energy - energyCost);
  
  saveGameState();
  
  showNotification(`玩耍结束！心情+${happinessGained}，体力-${energyCost}`);
  
  // 返回游戏选择界面
  currentGame = null;
  showGameSelection();
}

/**
 * 计算游戏奖励
 * @param {number} score - 游戏积分
 * @param {string} difficulty - 难度：'easy', 'normal', 'hard'
 * @returns {Object} 奖励对象 {coins, happiness, energy}
 */
function calculateGameRewards(score, difficulty = 'normal') {
  // 难度系数
  const difficultyMultipliers = {
    easy: { coins: 1.5, happiness: 1.5, energy: 0.7 },
    normal: { coins: 1.0, happiness: 1.0, energy: 1.0 },
    hard: { coins: 0.7, happiness: 0.7, energy: 1.3 }
  };
  
  const multiplier = difficultyMultipliers[difficulty] || difficultyMultipliers.normal;
  
  // 基础奖励表（普通难度）
  let baseRewards = { coins: 10, happiness: 5, energy: 5 };
  
  if (score >= 2001) {
    baseRewards = { coins: 300, happiness: 150, energy: 30 };
  } else if (score >= 1001) {
    baseRewards = { coins: 200, happiness: 100, energy: 25 };
  } else if (score >= 601) {
    baseRewards = { coins: 100, happiness: 50, energy: 20 };
  } else if (score >= 301) {
    baseRewards = { coins: 60, happiness: 30, energy: 15 };
  } else if (score >= 101) {
    baseRewards = { coins: 30, happiness: 15, energy: 10 };
  }
  
  // 应用难度系数
  return {
    coins: Math.floor(baseRewards.coins * multiplier.coins),
    happiness: Math.floor(baseRewards.happiness * multiplier.happiness),
    energy: Math.floor(baseRewards.energy * multiplier.energy)
  };
}

/**
 * 加载宠物形象到游戏界面
 * @param {string} containerId - 容器元素ID
 * @param {string} stage - 成长阶段（可选，默认使用当前阶段）
 */
function loadPetSpriteToGame(containerId, stage = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  loadGameState();
  const petData = POKEMON_DATABASE[gameState.petId];
  if (!petData || !petData.assets) return;
  
  const growthStage = stage || gameState.growthStage || 'adult';
  const spritePath = petData.assets[growthStage] || petData.assets.adult;
  const basePath = spritePath ? spritePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '') : null;
  
  // 清空容器
  container.innerHTML = '';
  
  // 创建图片元素
  const img = document.createElement('img');
  img.id = 'game-pet-sprite';
  img.alt = gameState.petNickname || '宠物';
  img.style.width = '60px';
  img.style.height = '60px';
  img.style.objectFit = 'contain';
  img.style.imageRendering = 'pixelated';
  
  container.appendChild(img);
  
  if (basePath) {
    loadImageWithFallback(
      img,
      basePath,
      `assets/${gameState.petId}/${growthStage}`,
      null,
      () => {
        loadImageWithFallback(img, `assets/pikachu/${growthStage}`);
      }
    );
  } else {
    loadImageWithFallback(img, `assets/${gameState.petId}/${growthStage}`, 'assets/pikachu/adult');
  }
}

/**
 * 游戏结束处理
 * @param {string} gameType - 游戏类型
 * @param {number} score - 游戏积分
 * @param {string} difficulty - 难度
 */
function handleGameEnd(gameType, score, difficulty = 'normal') {
  loadGameState();
  
  // 计算奖励
  const rewards = calculateGameRewards(score, difficulty);
  
  // 更新游戏状态
  gameState.inventory.coins = (gameState.inventory.coins || 0) + rewards.coins;
  gameState.stats.happiness = Math.min(100, (gameState.stats.happiness || 0) + rewards.happiness);
  gameState.stats.energy = Math.max(0, (gameState.stats.energy || 100) - rewards.energy);
  
  // 保存游戏状态
  saveGameState();
  
  // 返回奖励信息
  return {
    score,
    difficulty,
    rewards,
    message: `游戏结束！积分：${score}\n获得：金币+${rewards.coins}，快乐度+${rewards.happiness}，体力-${rewards.energy}`
  };
}

/**
 * 跳转到游戏页面
 * @param {string} gameType - 游戏类型
 */
function navigateToGame(gameType) {
  window.location.href = getGamePath(gameType);
}

// ============================================================
// 模块13: UI工具函数
// ============================================================

/**
 * 智能图片路径查找（支持svg/png/gif多格式）
 * @param {string} basePath - 基础路径（可以包含或不包含扩展名）
 * @param {string[]} extensions - 要尝试的扩展名列表（默认: ['svg', 'png', 'gif']）
 * @returns {string} 返回第一个可用的图片路径，如果都失败则返回占位符
 */
function findImagePath(basePath, extensions = ['svg', 'png', 'gif']) {
  // 如果路径已经是完整的URL（data:或http），直接返回
  if (basePath.startsWith('data:') || basePath.startsWith('http://') || basePath.startsWith('https://')) {
    return basePath;
  }
  
  // 如果路径已经包含扩展名，直接返回
  const hasExtension = /\.(svg|png|gif|jpg|jpeg|webp)$/i.test(basePath);
  if (hasExtension) {
    return basePath;
  }
  
  // 尝试不同的扩展名
  for (const ext of extensions) {
    const testPath = `${basePath}.${ext}`;
    // 注意：这里只返回路径，实际加载检查在onerror中处理
    // 但为了保持向后兼容，我们按优先级返回路径
    return testPath;
  }
  
  // 如果所有扩展名都试过了，返回最后一个
  return `${basePath}.${extensions[extensions.length - 1]}`;
}

/**
 * 加载图片到img元素，支持多格式回退
 * @param {HTMLImageElement} imgElement - 图片元素
 * @param {string} basePath - 基础路径（可以包含或不包含扩展名）
 * @param {string} fallbackPath - 备用路径（可选）
 * @param {Function} onSuccess - 成功回调（可选）
 * @param {Function} onError - 错误回调（可选）
 */
function loadImageWithFallback(imgElement, basePath, fallbackPath = null, onSuccess = null, onError = null) {
  if (!imgElement) {
    if (onError) onError();
    return;
  }
  
  // 如果basePath为空，使用fallbackPath
  if (!basePath && fallbackPath) {
    basePath = fallbackPath;
    fallbackPath = null;
  }
  
  if (!basePath) {
    // 使用默认占位符
    imgElement.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23FFD700" width="200" height="200" rx="20"/><text y="120" x="100" text-anchor="middle" font-size="80">⚡</text></svg>';
    if (onError) onError();
    return;
  }
  
  const extensions = ['svg', 'png', 'gif'];
  const paths = [];
  
  // 如果基础路径已有扩展名，先尝试它
  if (/\.(svg|png|gif|jpg|jpeg|webp)$/i.test(basePath)) {
    paths.push(basePath);
    // 如果已有扩展名，也尝试其他格式作为备选
    const pathWithoutExt = basePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '');
    extensions.forEach(ext => {
      if (!basePath.toLowerCase().endsWith(`.${ext}`)) {
        paths.push(`${pathWithoutExt}.${ext}`);
      }
    });
  } else {
    // 如果没有扩展名，按优先级尝试
    extensions.forEach(ext => paths.push(`${basePath}.${ext}`));
  }
  
  // 添加备用路径
  if (fallbackPath) {
    if (/\.(svg|png|gif|jpg|jpeg|webp)$/i.test(fallbackPath)) {
      if (!paths.includes(fallbackPath)) {
        paths.push(fallbackPath);
      }
      // 如果已有扩展名，也尝试其他格式
      const pathWithoutExt = fallbackPath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '');
      extensions.forEach(ext => {
        const testPath = `${pathWithoutExt}.${ext}`;
        if (!paths.includes(testPath)) {
          paths.push(testPath);
        }
      });
    } else {
      extensions.forEach(ext => {
        const testPath = `${fallbackPath}.${ext}`;
        if (!paths.includes(testPath)) {
          paths.push(testPath);
        }
      });
    }
  }
  
  // 添加最终占位符
  paths.push('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23FFD700" width="200" height="200" rx="20"/><text y="120" x="100" text-anchor="middle" font-size="80">⚡</text></svg>');
  
  let currentIndex = 0;
  let loadHandler = null;
  let errorHandler = null;
  
  function tryNextPath() {
    // 清理之前的事件监听器
    if (loadHandler) {
      imgElement.removeEventListener('load', loadHandler);
    }
    if (errorHandler) {
      imgElement.removeEventListener('error', errorHandler);
    }
    
    if (currentIndex >= paths.length) {
      // 所有路径都失败了
      if (onError) onError();
      return;
    }
    
    const currentPath = paths[currentIndex];
    currentIndex++;
    
    // 设置图片源
    imgElement.src = currentPath;
    
    // 如果图片已经加载完成（可能在缓存中），立即检查
    if (imgElement.complete) {
      if (imgElement.naturalWidth > 0 && imgElement.naturalHeight > 0) {
        // 图片加载成功
        if (onSuccess) onSuccess(currentPath);
        return;
      } else {
        // 图片加载失败，尝试下一个
        tryNextPath();
        return;
      }
    }
    
    // 监听加载事件
    loadHandler = () => {
      if (errorHandler) {
        imgElement.removeEventListener('error', errorHandler);
      }
      if (onSuccess) onSuccess(currentPath);
    };
    
    errorHandler = () => {
      if (loadHandler) {
        imgElement.removeEventListener('load', loadHandler);
      }
      tryNextPath();
    };
    
    imgElement.addEventListener('load', loadHandler, { once: true });
    imgElement.addEventListener('error', errorHandler, { once: true });
  }
  
  // 开始尝试加载
  tryNextPath();
}

/**
 * 更新所有属性条
 */
function updateAllStats() {
  updateStatBar('hunger', gameState.stats.hunger);
  updateStatBar('cleanliness', gameState.stats.cleanliness);
  updateStatBar('happiness', gameState.stats.happiness);
  updateStatBar('energy', gameState.stats.energy);
  updateCoinDisplay();
}

/**
 * 更新单个属性条
 */
function updateStatBar(statName, value) {
  const statBar = document.querySelector(`.stat-bar[data-stat="${statName}"]`);
  if (!statBar) return;
  
  const fill = statBar.querySelector('.stat-fill');
  const valueText = statBar.querySelector('.stat-value');
  
  if (fill) {
    fill.style.width = `${value}%`;
    
    if (value >= 70) {
      fill.style.backgroundColor = '#4CAF50';
    } else if (value >= 40) {
      fill.style.backgroundColor = '#FFC107';
    } else {
      fill.style.backgroundColor = '#F44336';
    }
  }
  
  if (valueText) {
    valueText.textContent = Math.floor(value);
  }
  
  if (value < 20) {
    statBar.classList.add('warning-blink');
  } else {
    statBar.classList.remove('warning-blink');
  }
}

/**
 * 更新金币显示
 */
function updateCoinDisplay() {
  const coinCount = document.getElementById('coin-count');
  if (coinCount) {
    coinCount.textContent = gameState.inventory.coins;
  }
}

/**
 * 渲染宠物精灵
 */
function renderPetSprite() {
  const petSprite = document.getElementById('pet-sprite');
  if (!petSprite) return;
  
  const petData = POKEMON_DATABASE[gameState.petId];
  if (!petData || !petData.assets) {
    console.error('宠物数据不存在:', gameState.petId);
    loadImageWithFallback(petSprite, 'assets/pikachu/adult');
    return;
  }
  
  const stage = gameState.growthStage || 'egg';
  
  let assetKey = stage;
  if (gameState.physiology.isSick) {
    assetKey = 'sick';
  } else if (gameState.physiology.isSleeping) {
    assetKey = 'sleeping';
  } else if (gameState.stats.happiness >= 80) {
    assetKey = 'happy';
  } else if (gameState.stats.happiness < 30) {
    assetKey = 'sad';
  }
  
  // 获取图片路径，优先使用assetKey，否则使用stage
  let spritePath = petData.assets[assetKey] || petData.assets[stage] || petData.assets.adult;
  
  if (!spritePath) {
    console.error('找不到图片资源:', assetKey, stage);
    loadImageWithFallback(petSprite, 'assets/pikachu/adult', `assets/${gameState.petId}/${stage}`);
    return;
  }
  
  // 移除扩展名，使用多格式加载
  const basePath = spritePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '');
  const fallbackPath = `assets/${gameState.petId}/${stage}`;
  const finalFallback = 'assets/pikachu/adult';
  
  petSprite.alt = gameState.petNickname || '宠物';
  loadImageWithFallback(petSprite, basePath, fallbackPath, null, () => {
    // 最后的fallback
    loadImageWithFallback(petSprite, finalFallback, null);
  });
}

/**
 * 设置宠物动画
 */
function setPetAnimation(animationType) {
  const petSprite = document.getElementById('pet-sprite');
  if (!petSprite) return;
  
  const petData = POKEMON_DATABASE[gameState.petId];
  if (!petData || !petData.assets) {
    console.error('宠物数据不存在:', gameState.petId);
    return;
  }
  
  petSprite.className = 'pet-animation';
  petSprite.classList.add(`anim-${animationType}`);
  
  if (petData.assets[animationType]) {
    const spritePath = petData.assets[animationType];
    const basePath = spritePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '');
    const stage = gameState.growthStage || 'adult';
    const fallbackPath = petData.assets[stage] ? petData.assets[stage].replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '') : null;
    loadImageWithFallback(petSprite, basePath, fallbackPath || 'assets/pikachu/adult');
  } else {
    // 如果动画类型不存在，使用当前阶段的图片
    const stage = gameState.growthStage || 'adult';
    const spritePath = petData.assets[stage] || petData.assets.adult;
    if (spritePath) {
      const basePath = spritePath.replace(/\.(svg|png|gif|jpg|jpeg|webp)$/i, '');
      loadImageWithFallback(petSprite, basePath, 'assets/pikachu/adult');
    } else {
      loadImageWithFallback(petSprite, 'assets/pikachu/adult');
    }
  }
}

/**
 * 显示模态窗口
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * 隐藏模态窗口
 */
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * 显示通知提示
 */
function showNotification(message) {
  if (!gameState.settings?.notificationEnabled) return;
  
  const notification = document.createElement('div');
  notification.className = 'notification-toast';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * 显示浮动文字
 */
function showFloatingText(text, x, y) {
  const floatingText = document.createElement('div');
  floatingText.className = 'floating-text';
  floatingText.textContent = text;
  
  if (x && y) {
    floatingText.style.left = `${x}px`;
    floatingText.style.top = `${y}px`;
  } else {
    floatingText.style.left = '50%';
    floatingText.style.top = '40%';
  }
  
  document.body.appendChild(floatingText);
  
  setTimeout(() => {
    floatingText.remove();
  }, 2000);
}

/**
 * 显示宠物气泡文字
 */
function showBubbleText(text) {
  const bubble = document.getElementById('status-bubble');
  const bubbleText = document.getElementById('bubble-text');
  
  if (bubble && bubbleText) {
    bubbleText.textContent = text;
    bubble.classList.remove('hidden');
    
    setTimeout(() => {
      bubble.classList.add('hidden');
    }, 3000);
  }
}

/**
 * 播放音效
 * @param {string} soundName - 音效名称 (feed, clean, pet, play, adventure, chat, button, notification, evolution, death)
 * 
 * 使用说明：
 * 1. 请将音频文件放置在 assets/sounds/ 目录下
 * 2. 支持的音频格式：MP3, OGG, WAV
 * 3. 建议音频文件大小控制在 100KB 以内
 * 4. 如果音效文件不存在，函数会静默失败（不影响游戏运行）
 * 
 * 示例音频文件命名：
 * - assets/sounds/feed.mp3
 * - assets/sounds/clean.mp3
 * - assets/sounds/pet.mp3
 * 等等...
 */
function playSound(soundName) {
  // 检查音效是否启用
  if (!gameState.settings?.soundEnabled || !SOUND_CONFIG.enabled) {
    return;
  }
  
  // 获取音效文件路径
  const soundPath = SOUND_CONFIG.sounds[soundName];
  if (!soundPath) {
    console.warn(`⚠️ 未找到音效配置: ${soundName}`);
    return;
  }
  
  try {
    // 创建音频对象
    const audio = new Audio(soundPath);
    audio.volume = SOUND_CONFIG.volume;
    
    // 播放音效
    audio.play().catch(error => {
      // 静默处理错误（文件不存在或浏览器限制）
      console.log(`🔇 音效播放失败 (${soundName}):`, error.message);
    });
    
    console.log(`🔊 播放音效: ${soundName}`);
  } catch (error) {
    // 静默处理错误
    console.log(`🔇 音效加载失败 (${soundName}):`, error.message);
  }
}

/**
 * 播放喂食动画
 */
function playFeedAnimation() {
  const petSprite = document.getElementById('pet-sprite');
  if (petSprite) {
    petSprite.classList.add('anim-eat');
    setTimeout(() => {
      petSprite.classList.remove('anim-eat');
    }, 1000);
  }
}

/**
 * 播放抚摸动画
 */
function playPetAnimation() {
  const petSprite = document.getElementById('pet-sprite');
  if (petSprite) {
    petSprite.classList.add('anim-shake');
    setTimeout(() => {
      petSprite.classList.remove('anim-shake');
    }, 500);
  }
}

/**
 * 播放清洁动画
 */
function playCleanAnimation() {
  const stage = document.getElementById('game-stage');
  if (stage) {
    const sparkles = document.createElement('div');
    sparkles.className = 'sparkle-effect';
    stage.appendChild(sparkles);
    
    setTimeout(() => {
      sparkles.remove();
    }, 1500);
  }
}

/**
 * 播放进化动画
 */
function playEvolutionAnimation(newStage) {
  const modal = document.createElement('div');
  modal.className = 'modal active evolution-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="evolution-animation">
        <h2>✨ 进化了！✨</h2>
        <p>${gameState.petNickname} 成长为 ${getStageText(newStage)}！</p>
      </div>
      <button class="pixel-btn primary" onclick="this.closest('.modal').remove()">太棒了！</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    if (modal.parentElement) {
      modal.remove();
    }
  }, 5000);
}

/**
 * 初始化设置面板
 */
function initSettingsPanel() {
  // 填充当前值
  const ownerNameInput = document.getElementById('owner-name-input');
  if (ownerNameInput) {
    ownerNameInput.value = gameState.ownerName || '';
  }
  
  const nicknameInput = document.getElementById('pet-nickname-input');
  if (nicknameInput) {
    nicknameInput.value = gameState.petNickname;
  }
  
  // 初始化温度设置
  const temperatureSlider = document.getElementById('temperature-slider');
  const temperatureValue = document.getElementById('temperature-value');
  if (temperatureSlider && temperatureValue) {
    const temp = gameState.settings.apiConfig.temperature !== undefined 
      ? gameState.settings.apiConfig.temperature 
      : 0.9;
    temperatureSlider.value = temp;
    temperatureValue.textContent = temp.toFixed(1);
  }
  
  // 设置API模式
  const embeddedRadio = document.querySelector('input[name="api-mode"][value="embedded"]');
  const customRadio = document.querySelector('input[name="api-mode"][value="custom"]');
  
  const useEmbedded = gameState.settings.apiConfig.useEmbeddedAPI;
  
  if (useEmbedded) {
    if (embeddedRadio) embeddedRadio.checked = true;
  } else {
    if (customRadio) customRadio.checked = true;
  }
  
  // 显示/隐藏API配置面板
  const customConfig = document.getElementById('custom-api-config');
  const embeddedConfig = document.getElementById('embedded-api-config');
  
  if (customConfig) {
    customConfig.classList.toggle('hidden', useEmbedded);
  }
  if (embeddedConfig) {
    embeddedConfig.classList.toggle('hidden', !useEmbedded);
  }
  
  // 初始化内置API模型选择
  const config = gameState.settings.apiConfig;
  if (!config.embeddedAPIs) config.embeddedAPIs = [];
  
  // API #1
  const embeddedModelSelect1 = document.getElementById('embedded-model-select-1');
  const embeddedEnabled1 = document.getElementById('embedded-api-1-enabled');
  if (embeddedModelSelect1) {
    embeddedModelSelect1.innerHTML = '';
    const currentModel = config.embeddedAPIs[0]?.model || 'gemini-2.5-flash';
    
    // 先添加预设模型
    EMBEDDED_MODELS.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      embeddedModelSelect1.appendChild(option);
    });
    
    // 如果保存的模型不在预设列表中，也要添加它
    if (currentModel && !EMBEDDED_MODELS.includes(currentModel)) {
      const option = document.createElement('option');
      option.value = currentModel;
      option.textContent = currentModel;
      embeddedModelSelect1.appendChild(option);
    }
    
    embeddedModelSelect1.value = currentModel;
  }
  // 加载启用状态
  if (embeddedEnabled1) {
    embeddedEnabled1.checked = config.embeddedAPIs[0]?.enabled !== false; // 默认为true
  }
  
  // API #2
  const embeddedModelSelect2 = document.getElementById('embedded-model-select-2');
  const embeddedEnabled2 = document.getElementById('embedded-api-2-enabled');
  if (embeddedModelSelect2) {
    embeddedModelSelect2.innerHTML = '';
    const currentModel = config.embeddedAPIs[1]?.model || '';
    
    // 先添加预设模型
    EMBEDDED_MODELS.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      embeddedModelSelect2.appendChild(option);
    });
    
    // 如果保存的模型不在预设列表中，也要添加它
    if (currentModel && !EMBEDDED_MODELS.includes(currentModel)) {
      const option = document.createElement('option');
      option.value = currentModel;
      option.textContent = currentModel;
      embeddedModelSelect2.appendChild(option);
    }
    
    if (currentModel) {
      embeddedModelSelect2.value = currentModel;
    }
  }
  // 加载启用状态
  if (embeddedEnabled2) {
    embeddedEnabled2.checked = config.embeddedAPIs[1]?.enabled === true;
  }
  
  // 初始化自定义API模型选择
  if (!config.customAPIs) config.customAPIs = [];
  
  // API #1
  const customModelSelect1 = document.getElementById('custom-model-select-1');
  const customApiKey1 = document.getElementById('custom-api-key-1');
  const customEndpoint1 = document.getElementById('custom-api-endpoint-1');
  const customEnabled1 = document.getElementById('custom-api-1-enabled');
  if (customModelSelect1) {
    customModelSelect1.innerHTML = '';
    const currentModel = config.customAPIs[0]?.model || 'gpt-3.5-turbo';
    
    // 先添加预设模型
    CUSTOM_MODELS.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      customModelSelect1.appendChild(option);
    });
    
    // 如果保存的模型不在预设列表中，也要添加它
    if (currentModel && !CUSTOM_MODELS.includes(currentModel)) {
      const option = document.createElement('option');
      option.value = currentModel;
      option.textContent = currentModel;
      customModelSelect1.appendChild(option);
    }
    
    customModelSelect1.value = currentModel;
  }
  // 加载API密钥、端点和启用状态
  if (customApiKey1) {
    customApiKey1.value = config.customAPIs[0]?.apiKey || '';
  }
  if (customEndpoint1) {
    customEndpoint1.value = config.customAPIs[0]?.endpoint || OPENAI_API_URL;
  }
  if (customEnabled1) {
    customEnabled1.checked = config.customAPIs[0]?.enabled !== false; // 默认为true
  }
  
  // API #2
  const customModelSelect2 = document.getElementById('custom-model-select-2');
  const customApiKey2 = document.getElementById('custom-api-key-2');
  const customEndpoint2 = document.getElementById('custom-api-endpoint-2');
  const customEnabled2 = document.getElementById('custom-api-2-enabled');
  if (customModelSelect2) {
    customModelSelect2.innerHTML = '';
    const currentModel = config.customAPIs[1]?.model || '';
    
    // 先添加预设模型
    CUSTOM_MODELS.forEach(modelId => {
      const option = document.createElement('option');
      option.value = modelId;
      option.textContent = modelId;
      customModelSelect2.appendChild(option);
    });
    
    // 如果保存的模型不在预设列表中，也要添加它
    if (currentModel && !CUSTOM_MODELS.includes(currentModel)) {
      const option = document.createElement('option');
      option.value = currentModel;
      option.textContent = currentModel;
      customModelSelect2.appendChild(option);
    }
    
    if (currentModel) {
      customModelSelect2.value = currentModel;
    }
  }
  // 加载API密钥、端点和启用状态
  if (customApiKey2) {
    customApiKey2.value = config.customAPIs[1]?.apiKey || '';
  }
  if (customEndpoint2) {
    customEndpoint2.value = config.customAPIs[1]?.endpoint || '';
  }
  if (customEnabled2) {
    customEnabled2.checked = config.customAPIs[1]?.enabled === true;
  }
  
  // 向后兼容：填充旧版自定义API配置（如果存在）
  const apiKeyInput = document.getElementById('custom-api-key');
  const endpointInput = document.getElementById('custom-api-endpoint');
  
  if (apiKeyInput && !config.customAPIs[0]?.apiKey) {
    apiKeyInput.value = gameState.settings.apiConfig.customAPIKey || '';
  }
  if (endpointInput && !config.customAPIs[0]?.endpoint) {
    endpointInput.value = gameState.settings.apiConfig.customAPIEndpoint || OPENAI_API_URL;
  }
  
  // 初始化日夜模式设置
  const themeMode = gameState.settings?.dayNightMode || 'auto';
  const autoRadio = document.getElementById('daynight-auto');
  const manualRadio = document.getElementById('daynight-manual');
  const manualSelector = document.getElementById('manual-theme-selector');
  const toggleManualBtn = document.getElementById('toggle-manual-theme-btn');
  
  if (autoRadio && manualRadio) {
    if (themeMode === 'manual') {
      manualRadio.checked = true;
      if (manualSelector) manualSelector.classList.remove('hidden');
    } else {
      autoRadio.checked = true;
      if (manualSelector) manualSelector.classList.add('hidden');
    }
  }
  
  // 更新手动模式切换按钮
  if (toggleManualBtn) {
    const currentTheme = gameState.settings?.manualTheme || 'day';
    toggleManualBtn.textContent = currentTheme === 'day' ? '切换为夜间' : '切换为日间';
  }
  
  // 绑定日夜模式切换事件
  if (autoRadio) {
    autoRadio.addEventListener('change', () => {
      if (manualSelector) manualSelector.classList.add('hidden');
    });
  }
  if (manualRadio) {
    manualRadio.addEventListener('change', () => {
      if (manualSelector) manualSelector.classList.remove('hidden');
    });
  }
  
  // 绑定手动主题切换按钮
  if (toggleManualBtn) {
    toggleManualBtn.addEventListener('click', () => {
      const currentTheme = gameState.settings?.manualTheme || 'day';
      const newTheme = currentTheme === 'day' ? 'night' : 'day';
      gameState.settings.manualTheme = newTheme;
      toggleManualBtn.textContent = newTheme === 'day' ? '切换为夜间' : '切换为日间';
      
      // 如果当前是手动模式,立即应用
      if (gameState.settings.dayNightMode === 'manual') {
        // 使用darkmode-js API
        if (typeof Darkmode !== 'undefined' && window.darkmodeInstance) {
          const darkmode = window.darkmodeInstance;
          const isDarkMode = darkmode.isActivated();
          const shouldBeDark = newTheme === 'night';
          
          if (shouldBeDark !== isDarkMode) {
            darkmode.toggle();
          }
        } else {
          // 兼容模式：使用CSS
          const body = document.body;
          body.dataset.theme = newTheme;
        }
        
        const icon = document.getElementById('day-night-icon');
        if (icon) icon.textContent = newTheme === 'day' ? '☀️' : '🌙';
        updateBackgroundTheme(newTheme);
      }
    });
  }
  
  // 绑定保存日夜模式设置按钮（保留用于快速保存日夜设置）
  const saveDayNightBtn = document.getElementById('save-daynight-mode-btn');
  if (saveDayNightBtn) {
    saveDayNightBtn.addEventListener('click', () => {
      const selectedMode = document.querySelector('input[name="daynight-mode"]:checked')?.value || 'auto';
      gameState.settings.dayNightMode = selectedMode;
      
      if (selectedMode === 'manual') {
        // 手动模式: 使用当前主题或保存的主题
        let currentTheme = gameState.settings.manualTheme || 'day';
        
        // 如果darkmode-js可用，从darkmode状态获取当前主题
        if (typeof Darkmode !== 'undefined' && window.darkmodeInstance) {
          const darkmode = window.darkmodeInstance;
          currentTheme = darkmode.isActivated() ? 'night' : 'day';
        } else {
          // 兼容模式：从body.dataset获取
          currentTheme = document.body.dataset.theme || currentTheme;
        }
        
        gameState.settings.manualTheme = currentTheme;
        
        // 使用darkmode-js API
        if (typeof Darkmode !== 'undefined' && window.darkmodeInstance) {
          const darkmode = window.darkmodeInstance;
          const isDarkMode = darkmode.isActivated();
          const shouldBeDark = currentTheme === 'night';
          
          if (shouldBeDark !== isDarkMode) {
            darkmode.toggle();
          }
        } else {
          // 兼容模式：使用CSS
          document.body.dataset.theme = currentTheme;
        }
        
        const icon = document.getElementById('day-night-icon');
        if (icon) icon.textContent = currentTheme === 'day' ? '☀️' : '🌙';
        updateBackgroundTheme(currentTheme);
      } else {
        // 自动模式: 立即应用当前时间对应的主题
        updateClock();
      }
      
      saveGameState();
      showNotification('日夜模式设置已保存');
    });
  }
  
  // 绑定保存所有设置按钮
  const saveAllSettingsBtn = document.getElementById('save-all-settings-btn');
  if (saveAllSettingsBtn) {
    saveAllSettingsBtn.addEventListener('click', () => {
      const config = gameState.settings.apiConfig;
      if (!config.embeddedAPIs) config.embeddedAPIs = [];
      if (!config.customAPIs) config.customAPIs = [];
      
      // 保存API模式
      const selectedAPIMode = document.querySelector('input[name="api-mode"]:checked')?.value || 'embedded';
      config.useEmbeddedAPI = selectedAPIMode === 'embedded';
      
      // 保存温度设置
      const temperatureSlider = document.getElementById('temperature-slider');
      if (temperatureSlider) {
        config.temperature = parseFloat(temperatureSlider.value) || 0.9;
      }
      
      // 保存内嵌API配置
      const embeddedModelSelect1 = document.getElementById('embedded-model-select-1');
      const embeddedModelSelect2 = document.getElementById('embedded-model-select-2');
      const embeddedEnabled1 = document.getElementById('embedded-api-1-enabled');
      const embeddedEnabled2 = document.getElementById('embedded-api-2-enabled');
      
      if (embeddedModelSelect1) {
        if (!config.embeddedAPIs[0]) config.embeddedAPIs[0] = {};
        config.embeddedAPIs[0].model = embeddedModelSelect1.value || 'gemini-2.5-flash';
        config.embeddedAPIs[0].enabled = embeddedEnabled1?.checked ?? true;
      }
      
      if (embeddedModelSelect2) {
        if (!config.embeddedAPIs[1]) config.embeddedAPIs[1] = {};
        config.embeddedAPIs[1].model = embeddedModelSelect2.value || '';
        config.embeddedAPIs[1].enabled = embeddedEnabled2?.checked ?? false;
      }
      
      // 保存自定义API配置
      const customModelSelect1 = document.getElementById('custom-model-select-1');
      const customModelSelect2 = document.getElementById('custom-model-select-2');
      const customApiKey1 = document.getElementById('custom-api-key-1');
      const customApiKey2 = document.getElementById('custom-api-key-2');
      const customEndpoint1 = document.getElementById('custom-api-endpoint-1');
      const customEndpoint2 = document.getElementById('custom-api-endpoint-2');
      const customEnabled1 = document.getElementById('custom-api-1-enabled');
      const customEnabled2 = document.getElementById('custom-api-2-enabled');
      
      if (customModelSelect1) {
        if (!config.customAPIs[0]) config.customAPIs[0] = {};
        config.customAPIs[0].model = customModelSelect1.value || '';
        config.customAPIs[0].apiKey = customApiKey1?.value || '';
        config.customAPIs[0].endpoint = customEndpoint1?.value || OPENAI_API_URL;
        config.customAPIs[0].enabled = customEnabled1?.checked ?? true;
      }
      
      if (customModelSelect2) {
        if (!config.customAPIs[1]) config.customAPIs[1] = {};
        config.customAPIs[1].model = customModelSelect2.value || '';
        config.customAPIs[1].apiKey = customApiKey2?.value || '';
        config.customAPIs[1].endpoint = customEndpoint2?.value || '';
        config.customAPIs[1].enabled = customEnabled2?.checked ?? false;
      }
      
      // 保存日夜模式设置
      const selectedMode = document.querySelector('input[name="daynight-mode"]:checked')?.value || 'auto';
      gameState.settings.dayNightMode = selectedMode;
      
      if (selectedMode === 'manual') {
        // 手动模式: 使用当前主题或保存的主题
        let currentTheme = gameState.settings.manualTheme || 'day';
        
        // 如果darkmode-js可用，从darkmode状态获取当前主题
        if (typeof Darkmode !== 'undefined' && window.darkmodeInstance) {
          const darkmode = window.darkmodeInstance;
          currentTheme = darkmode.isActivated() ? 'night' : 'day';
        } else {
          // 兼容模式：从body.dataset获取
          currentTheme = document.body.dataset.theme || currentTheme;
        }
        
        gameState.settings.manualTheme = currentTheme;
        
        // 使用darkmode-js API
        if (typeof Darkmode !== 'undefined' && window.darkmodeInstance) {
          const darkmode = window.darkmodeInstance;
          const isDarkMode = darkmode.isActivated();
          const shouldBeDark = currentTheme === 'night';
          
          if (shouldBeDark !== isDarkMode) {
            darkmode.toggle();
          }
        } else {
          // 兼容模式：使用CSS
          document.body.dataset.theme = currentTheme;
        }
        
        const icon = document.getElementById('day-night-icon');
        if (icon) icon.textContent = currentTheme === 'day' ? '☀️' : '🌙';
        updateBackgroundTheme(currentTheme);
      } else {
        // 自动模式: 立即应用当前时间对应的主题
        updateClock();
      }
      
      // 保存主人名字和宠物昵称
      const ownerNameInput = document.getElementById('owner-name-input');
      const nicknameInput = document.getElementById('pet-nickname-input');
      if (ownerNameInput) {
        gameState.ownerName = ownerNameInput.value.trim() || '主人';
      }
      if (nicknameInput) {
        gameState.petNickname = nicknameInput.value.trim() || '皮卡丘';
      }
      
      // 保存手机边框尺寸
      const phoneWidthInput = document.getElementById('phone-frame-width');
      const phoneHeightInput = document.getElementById('phone-frame-height');
      if (phoneWidthInput && phoneHeightInput) {
        const width = parseInt(phoneWidthInput.value) || 390;
        const height = parseInt(phoneHeightInput.value) || 844;
        if (!gameState.settings.phoneFrameSize) {
          gameState.settings.phoneFrameSize = {};
        }
        gameState.settings.phoneFrameSize.width = width;
        gameState.settings.phoneFrameSize.height = height;
        updatePhoneFrameSize(width, height);
      }
      
      // 保存所有设置
      saveGameState();
      showNotification('✅ 所有设置已保存');
    });
  }
  
  // 日夜图标为纯显示，不可点击
  // 图标会在updateClock()函数中自动更新，用于显示当前时段
  const dayNightIcon = document.getElementById('day-night-icon');
  if (dayNightIcon) {
    // 移除可点击样式
    dayNightIcon.style.cursor = 'default';
    dayNightIcon.style.userSelect = 'none';
    // 更新title以反映其纯显示作用
    const currentHour = new Date().getHours();
    const isDaytime = currentHour >= 6 && currentHour < 18;
    dayNightIcon.title = isDaytime ? '当前时段：白天' : '当前时段：夜间';
  }
  
  // 初始化手机边框尺寸设置
  const phoneWidthInput = document.getElementById('phone-frame-width');
  const phoneHeightInput = document.getElementById('phone-frame-height');
  const phoneFramePresetBtns = document.querySelectorAll('.phone-frame-preset-btn');
  const phoneFrameResetBtn = document.getElementById('phone-frame-reset-btn');
  
  if (phoneWidthInput && phoneHeightInput) {
    const frameSize = gameState.settings.phoneFrameSize || { width: 390, height: 844 };
    phoneWidthInput.value = frameSize.width;
    phoneHeightInput.value = frameSize.height;
    
    // 实时预览
    phoneWidthInput.addEventListener('input', () => {
      const width = parseInt(phoneWidthInput.value) || 390;
      const height = parseInt(phoneHeightInput.value) || 844;
      updatePhoneFrameSize(width, height);
    });
    
    phoneHeightInput.addEventListener('input', () => {
      const width = parseInt(phoneWidthInput.value) || 390;
      const height = parseInt(phoneHeightInput.value) || 844;
      updatePhoneFrameSize(width, height);
    });
  }
  
  // 预设尺寸按钮
  if (phoneFramePresetBtns) {
    phoneFramePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        let width, height;
        switch(preset) {
          case 'iphone-se':
            width = 375;
            height = 667;
            break;
          case 'iphone-12':
            width = 390;
            height = 844;
            break;
          case 'iphone-14-pro-max':
            width = 430;
            height = 932;
            break;
          default:
            return;
        }
        if (phoneWidthInput) phoneWidthInput.value = width;
        if (phoneHeightInput) phoneHeightInput.value = height;
        updatePhoneFrameSize(width, height);
      });
    });
  }
  
  // 重置按钮
  if (phoneFrameResetBtn) {
    phoneFrameResetBtn.addEventListener('click', () => {
      const defaultWidth = 390;
      const defaultHeight = 844;
      if (phoneWidthInput) phoneWidthInput.value = defaultWidth;
      if (phoneHeightInput) phoneHeightInput.value = defaultHeight;
      updatePhoneFrameSize(defaultWidth, defaultHeight);
    });
  }
}

// ============================================================
// 防止移动端缩放
// ============================================================

document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// ============================================================
// 完成
// ============================================================
console.log('📜 script.js 加载完成');
