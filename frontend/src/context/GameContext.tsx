import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api, Progress } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// Points, level and unlocked bosses live on the server. This context holds the
// latest copy so every component shows the same numbers.

const EMPTY: Progress = {
  points: 0,
  level: 1,
  unlocked_bosses: ['goblin'],
  missions_won: 0,
  link_code: null,
};

interface GameContextType {
  progress: Progress;
  /** Use the progress the server sent back with an answer. */
  setProgress: (progress: Progress) => void;
  refreshProgress: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const studentId = user?.role === 'student' ? user.id : null;

  const refreshProgress = useCallback(async () => {
    if (studentId === null) {
      setProgress(EMPTY);
      return;
    }
    try {
      setProgress(await api<Progress>('/students/me/progress'));
    } catch {
      /* keep the last known progress; the next action will retry */
    }
  }, [studentId]);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  return (
    <GameContext.Provider value={{ progress, setProgress, refreshProgress }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
