import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sound } from './utils/audio';

// 8 個獨立主題圖案，各兩張構成 16 張牌
const CARD_DEFINITIONS = [
  { id: 1, icon: '🚀', name: '穿梭火箭', color: '#c084fc', border: 'rgba(192, 132, 252, 0.6)' },
  { id: 2, icon: '🪐', name: '璀璨土星', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.6)' },
  { id: 3, icon: '🌟', name: '幸運之星', color: '#facc15', border: 'rgba(250, 204, 21, 0.6)' },
  { id: 4, icon: '🛸', name: '神秘飛碟', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.6)' },
  { id: 5, icon: '👾', name: '星際怪獸', color: '#4ade80', border: 'rgba(74, 222, 128, 0.6)' },
  { id: 6, icon: '🌈', name: '夢幻彩虹', color: '#f472b6', border: 'rgba(244, 114, 182, 0.6)' },
  { id: 7, icon: '💎', name: '永恆寶石', color: '#60a5fa', border: 'rgba(96, 165, 250, 0.6)' },
  { id: 8, icon: '⚡', name: '閃電能源', color: '#fb923c', border: 'rgba(251, 146, 60, 0.6)' },
];

function generateShuffledCards() {
  const deck = [];
  // 複製一份，總共 16 張 (8 對)
  [...CARD_DEFINITIONS, ...CARD_DEFINITIONS].forEach((item, index) => {
    deck.push({
      ...item,
      uniqueId: `${item.id}-${index}-${Math.random()}`,
      isFlipped: false,
      isMatched: false,
    });
  });

  // Fisher-Yates 洗牌演算法
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export default function App() {
  const [cards, setCards] = useState(generateShuffledCards);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGameWon, setIsGameWon] = useState(false);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 歷史最快紀錄 (從 localStorage 讀取最快通關時間)
  const [bestScore, setBestScore] = useState(() => {
    try {
      const saved = localStorage.getItem('memory_game_fastest_record') || localStorage.getItem('memory_game_best_score');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const timerRef = useRef(null);

  // 計時器邏輯
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning]);

  // 音效開關切換
  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    sound.enabled = nextState;
  };

  // 重新開始遊戲
  const restartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCards(generateShuffledCards());
    setFlippedIndices([]);
    setIsLocked(false);
    setMoves(0);
    setSeconds(0);
    setIsTimerRunning(false);
    setIsGameWon(false);
    setIsNewRecord(false);
  };

  // 處理點擊卡牌
  const handleCardClick = (index) => {
    if (isLocked) return;

    const clickedCard = cards[index];
    // 已翻開或已消除配對的卡牌不能再點
    if (clickedCard.isFlipped || clickedCard.isMatched) return;
    if (flippedIndices.includes(index)) return;

    // 第一次翻牌開始計時
    if (!isTimerRunning && !isGameWon) {
      setIsTimerRunning(true);
    }

    sound.playFlip();

    // 翻開該張卡牌
    const updatedCards = [...cards];
    updatedCards[index] = { ...updatedCards[index], isFlipped: true };
    setCards(updatedCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    // 翻了兩張牌
    if (newFlipped.length === 2) {
      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = updatedCards[firstIdx];
      const secondCard = updatedCards[secondIdx];
      const newMoves = moves + 1;
      setMoves(newMoves);
      setIsLocked(true);

      // 配對成功！
      if (firstCard.id === secondCard.id) {
        sound.playMatch();
        setTimeout(() => {
          setCards((prev) => {
            const matchedCards = [...prev];
            matchedCards[firstIdx] = { ...matchedCards[firstIdx], isMatched: true };
            matchedCards[secondIdx] = { ...matchedCards[secondIdx], isMatched: true };

            // 檢查是否全部配對完成 (16 張全部 isMatched)
            const allMatched = matchedCards.every((c) => c.isMatched);
            if (allMatched) {
              handleGameComplete(newMoves);
            }
            return matchedCards;
          });
          setFlippedIndices([]);
          setIsLocked(false);
        }, 500);
      } else {
        // 配對失敗
        setTimeout(() => {
          sound.playMismatch();
        }, 300);

        setTimeout(() => {
          setCards((prev) => {
            const resetCards = [...prev];
            resetCards[firstIdx] = { ...resetCards[firstIdx], isFlipped: false };
            resetCards[secondIdx] = { ...resetCards[secondIdx], isFlipped: false };
            return resetCards;
          });
          setFlippedIndices([]);
          setIsLocked(false);
        }, 900);
      }
    }
  };

  // 通關處理
  const handleGameComplete = (finalMoves) => {
    setIsTimerRunning(false);
    setIsGameWon(true);
    sound.playVictory();

    // 施放慶祝煙火
    fireConfetti();

    // 判定歷史最快紀錄（以通關秒數為優先指標，秒數相同則以步數少者優先）
    let isRecord = false;
    if (
      !bestScore ||
      seconds < bestScore.seconds ||
      (seconds === bestScore.seconds && finalMoves < bestScore.moves)
    ) {
      isRecord = true;
      setIsNewRecord(true);
      const newBest = { seconds, moves: finalMoves };
      setBestScore(newBest);
      try {
        localStorage.setItem('memory_game_fastest_record', JSON.stringify(newBest));
      } catch (err) {
        console.error('Failed to save score', err);
      }
    }
  };

  // 煙火特效
  const fireConfetti = () => {
    try {
      const count = 200;
      const defaults = { origin: { y: 0.7 } };

      const fire = (particleRatio, opts) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      };

      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    } catch (e) {
      console.log('Confetti effect failed', e);
    }
  };

  // 時間格式化 MM:SS
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 計算星級
  const getRating = () => {
    if (moves <= 14) return '★★★';
    if (moves <= 20) return '★★☆';
    return '★☆☆';
  };

  const matchedCount = cards.filter((c) => c.isMatched).length / 2;

  return (
    <div className="app-container">
      {/* 標題與簡介 */}
      <header className="game-header">
        <h1 className="game-title">
          <span>🧠</span> 記憶翻牌大挑戰
        </h1>
        <p className="game-subtitle">找出所有成對的卡牌，考驗你的專注與記憶力！</p>
      </header>

      {/* 狀態儀表板 */}
      <section className="dashboard-card" aria-label="遊戲資訊面板">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">⏱️ 計時</div>
            <div className="stat-value highlight-cyan">{formatTime(seconds)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">🎯 步數</div>
            <div className="stat-value highlight-yellow">{moves}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">🧩 進度</div>
            <div className="stat-value highlight-green">{matchedCount} / 8</div>
          </div>
          <div
            className="stat-item"
            title={
              bestScore
                ? `歷史最快紀錄：${formatTime(bestScore.seconds)}（共 ${bestScore.moves} 步）`
                : '尚未有最快紀錄'
            }
          >
            <div className="stat-label">🏆 最快紀錄</div>
            <div className="stat-value highlight-yellow">
              {bestScore ? formatTime(bestScore.seconds) : '--:--'}
            </div>
            {bestScore && (
              <div className="stat-sub">{bestScore.moves} 步</div>
            )}
          </div>
        </div>

        {/* 控制列 */}
        <div className="controls-bar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={restartGame}
            title="重新洗牌並開始新局"
          >
            <span>🔄</span> 重新開始
          </button>

          <button
            type="button"
            className="btn btn-icon"
            onClick={toggleSound}
            title={soundEnabled ? '關閉音效' : '開啟音效'}
            aria-label="切換音效"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </section>

      {/* 4x4 遊戲卡牌區 */}
      <main className="board-wrapper">
        <div className="board-grid" role="region" aria-label="卡牌棋盤">
          {cards.map((card, idx) => {
            const isFlipped = card.isFlipped || card.isMatched;
            return (
              <div
                key={card.uniqueId}
                className={`card-scene ${isFlipped ? 'is-active-card' : ''} ${
                  card.isMatched ? 'is-matched-scene' : ''
                }`}
                onClick={() => handleCardClick(idx)}
                role="button"
                tabIndex={card.isMatched ? -1 : 0}
                aria-label={card.isMatched ? '已消除' : `卡牌 ${idx + 1}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCardClick(idx);
                  }
                }}
              >
                <div
                  className={`card-inner ${isFlipped ? 'is-flipped' : ''} ${
                    card.isMatched ? 'is-matched' : ''
                  }`}
                >
                  {/* 卡牌背面 */}
                  <div className="card-face card-back">
                    <span className="card-back-icon">✨</span>
                  </div>

                  {/* 卡牌正面 */}
                  <div
                    className="card-face card-front"
                    style={{
                      borderColor: card.border,
                      boxShadow: card.isMatched
                        ? `0 0 16px ${card.color}`
                        : undefined,
                    }}
                  >
                    <span className="card-front-icon">{card.icon}</span>
                    <span
                      className="card-front-name"
                      style={{ color: card.color }}
                    >
                      {card.name}
                    </span>
                    {card.isMatched && (
                      <span className="card-matched-badge" title="已消除">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 全部消除完成後的「完成」彈窗 */}
      {isGameWon && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <div className="modal-trophy">🏆</div>
            <h2 className="modal-title">恭喜完成！</h2>
            <div className="modal-stars">{getRating()}</div>

            {isNewRecord && (
              <div className="modal-new-record">
                <span>🎉</span> 創下歷史最快紀錄！
              </div>
            )}

            <div className="modal-stats-box">
              <div className="modal-stat-group">
                <div className="modal-stat-label">總耗時</div>
                <div className="modal-stat-val highlight-cyan">
                  {formatTime(seconds)}
                </div>
              </div>
              <div className="modal-stat-group">
                <div className="modal-stat-label">翻牌步數</div>
                <div className="modal-stat-val highlight-yellow">{moves} 步</div>
              </div>
              <div className="modal-stat-group">
                <div className="modal-stat-label">配對數量</div>
                <div className="modal-stat-val highlight-green">16 / 16</div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={restartGame}
                style={{ padding: '12px 28px', fontSize: '1.05rem' }}
              >
                <span>🔄</span> 再玩一次
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
