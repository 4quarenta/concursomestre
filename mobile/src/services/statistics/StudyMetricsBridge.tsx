import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { statisticsService } from '@/services/statistics/statisticsService';

const MIN_RECORD_SECONDS = 10;
const queueKey = (userId: string) => `cm-study-time-queue:${userId}`;
const isPracticePath = (pathname: string) => /^\/questao\/[^/]+\/?$/.test(pathname);

type PendingSession = { seconds: number; startedAt: string; endedAt: string };

export const StudyMetricsBridge: React.FC = () => {
  const pathname = usePathname() || '/';
  const { user } = useAuth();
  const secondsRef = React.useRef(0);
  const startedAtRef = React.useRef<string | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const flushingRef = React.useRef(false);

  const flush = React.useCallback(async (force = false) => {
    const userId = String(user?.id || '').trim();
    if (!userId || flushingRef.current) return;
    if (secondsRef.current >= MIN_RECORD_SECONDS) {
      const endedAt = new Date().toISOString();
      const session: PendingSession = {
        seconds: secondsRef.current,
        startedAt: startedAtRef.current || endedAt,
        endedAt,
      };
      secondsRef.current = 0;
      startedAtRef.current = null;
      try {
        const raw = await AsyncStorage.getItem(queueKey(userId));
        const queue: PendingSession[] = raw ? JSON.parse(raw) : [];
        queue.push(session);
        await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
      } catch {
        secondsRef.current += session.seconds;
        startedAtRef.current ||= session.startedAt;
        return;
      }
    }

    if (!force && appStateRef.current !== 'active') return;
    flushingRef.current = true;
    try {
      const raw = await AsyncStorage.getItem(queueKey(userId));
      const queue: PendingSession[] = raw ? JSON.parse(raw) : [];
      while (queue.length > 0) {
        const session = queue[0];
        await statisticsService.recordStudySession({
          practiceSeconds: session.seconds,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          sourceContext: { source: 'mobile_practice', route: pathname },
        });
        queue.shift();
        await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
      }
    } catch {
      // Mantém a fila local para reenviar quando a conexão/API estiver disponível.
    } finally {
      flushingRef.current = false;
    }
  }, [pathname, user?.id]);

  React.useEffect(() => {
    if (!user?.id || !isPracticePath(pathname) || appStateRef.current !== 'active') return;
    startedAtRef.current ||= new Date().toISOString();
    const interval = setInterval(() => {
      if (appStateRef.current !== 'active') return;
      secondsRef.current += 1;
      if (secondsRef.current >= 60) void flush();
    }, 1000);
    return () => {
      clearInterval(interval);
      void flush(true);
    };
  }, [flush, pathname, user?.id]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      if (previous === 'active' && nextState !== 'active') void flush(true);
      if (nextState === 'active') void flush(true);
    });
    return () => subscription.remove();
  }, [flush]);

  return null;
};
