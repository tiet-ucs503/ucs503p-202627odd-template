import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

interface GameState {
  spiderPoints: number;
  unlockedBosses: string[]; // e.g. ['goblin']
  missionsCompleted: number;
}

const BOSS_KEYS = ['goblin', 'doc-ock', 'mysterio', 'venom', 'lizard', 'kingpin'];

const DEFAULT_STATE: GameState = {
  spiderPoints: 0,
  unlockedBosses: ['goblin'], // ONLY Goblin is unlocked initially after signup
  missionsCompleted: 0,
};

export function useGameState() {
  const { user } = useAuth();

  const [gameState, setGameState] = useState<GameState>(() => {
    const storageKey = user ? `mathverse_state_user_${user.userId}` : 'mathverse_state_guest';
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const userLevel = user ? Math.max(1, user.level || 1) : 1;
        const levelUnlocked = BOSS_KEYS.slice(0, userLevel);
        return {
          spiderPoints: (user && user.points !== undefined) ? user.points : (parsed.spiderPoints || 0),
          unlockedBosses: parsed.unlockedBosses || levelUnlocked,
          missionsCompleted: parsed.missionsCompleted || 0,
        };
      } catch (e) {
        return DEFAULT_STATE;
      }
    }
    return {
      spiderPoints: user?.points || 0,
      unlockedBosses: ['goblin'],
      missionsCompleted: 0,
    };
  });

  // Keep state perfectly synchronized with current logged-in user
  useEffect(() => {
    if (!user) {
      const savedGuest = localStorage.getItem('mathverse_state_guest');
      if (savedGuest) {
        try {
          setGameState(JSON.parse(savedGuest));
          return;
        } catch (e) {}
      }
      setGameState(DEFAULT_STATE);
      return;
    }
    const saved = localStorage.getItem(`mathverse_state_user_${user.userId}`);
    const userLevel = Math.max(1, user.level || 1);
    const levelUnlocked = BOSS_KEYS.slice(0, userLevel);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGameState({
          spiderPoints: user.points !== undefined ? user.points : (parsed.spiderPoints || 0),
          unlockedBosses: levelUnlocked,
          missionsCompleted: parsed.missionsCompleted || 0,
        });
        return;
      } catch (e) {}
    }
    setGameState({
      spiderPoints: user.points || 0,
      unlockedBosses: levelUnlocked,
      missionsCompleted: 0,
    });
  }, [user?.userId, user?.level, user?.points]);

  useEffect(() => {
    const storageKey = user ? `mathverse_state_user_${user.userId}` : 'mathverse_state_guest';
    localStorage.setItem(storageKey, JSON.stringify(gameState));
  }, [gameState, user]);

  const addSpiderPoints = (points: number) => {
    setGameState((prev) => ({ ...prev, spiderPoints: prev.spiderPoints + points }));
  };

  const unlockBoss = (bossId: string) => {
    setGameState((prev) => {
      if (prev.unlockedBosses.includes(bossId)) return prev;
      return { ...prev, unlockedBosses: [...prev.unlockedBosses, bossId] };
    });
  };

  const incrementMissions = () => {
    setGameState((prev) => ({ ...prev, missionsCompleted: prev.missionsCompleted + 1 }));
  };

  const resetGame = () => {
    if (user) {
      localStorage.removeItem(`mathverse_state_user_${user.userId}`);
    }
    setGameState(DEFAULT_STATE);
  };

  return {
    gameState,
    addSpiderPoints,
    unlockBoss,
    incrementMissions,
    resetGame,
  };
}
