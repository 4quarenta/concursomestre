import { useEffect, useMemo, useState } from 'react';

export interface LimitedOfferCountdownState {
  isActive: boolean;
  expiresAt: number;
  remainingMs: number;
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

const parseEndsAt = (endsAt?: string | null) => {
  if (!endsAt) {
    return 0;
  }

  const timestamp = new Date(endsAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const splitRemainingTime = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
};

export const useLimitedOfferCountdown = (
  enabled: boolean,
  endsAt?: string | null,
): LimitedOfferCountdownState => {
  const expiresAt = useMemo(() => parseEndsAt(endsAt), [endsAt]);
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!enabled || expiresAt <= 0) {
      return 0;
    }

    return Math.max(0, expiresAt - Date.now());
  });

  useEffect(() => {
    if (!enabled || expiresAt <= Date.now()) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      setRemainingMs(Math.max(0, expiresAt - Date.now()));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, expiresAt]);

  const parts = useMemo(() => splitRemainingTime(remainingMs), [remainingMs]);
  const isActive = enabled && expiresAt > Date.now() && remainingMs > 0;

  return {
    isActive,
    expiresAt,
    remainingMs,
    ...parts,
  };
};
