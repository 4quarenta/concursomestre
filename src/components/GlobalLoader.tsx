/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useEffect, useState } from 'react';
import { useNavigationProgressStore } from '@/state/navigation-progress/navigationProgressStore';

interface GlobalLoaderProps {
    forceVisible?: boolean;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ forceVisible = false }) => {
    const phase = useNavigationProgressStore((store) => store.phase);
    const transitionId = useNavigationProgressStore((store) => store.transitionId);
    const resetNavigation = useNavigationProgressStore((store) => store.resetNavigation);
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (forceVisible) {
            const frameId = window.requestAnimationFrame(() => {
                setIsVisible(true);
                setProgress(72);
            });

            const pulseTimer = setTimeout(() => {
                setProgress(84);
            }, 240);

            return () => {
                window.cancelAnimationFrame(frameId);
                clearTimeout(pulseTimer);
            };
        }

        if (phase === 'idle') {
            return undefined;
        }

        if (phase === 'running') {
            const frameId = window.requestAnimationFrame(() => {
                setIsVisible(true);
                setProgress(14);
            });

            const timer1 = setTimeout(() => setProgress(42), 90);
            const timer2 = setTimeout(() => setProgress(68), 260);
            const timer3 = setTimeout(() => setProgress(84), 900);
            const stallTimer = setTimeout(() => {
                setProgress(92);
            }, 3500);

            return () => {
                window.cancelAnimationFrame(frameId);
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
                clearTimeout(stallTimer);
            };
        }

        const frameId = window.requestAnimationFrame(() => {
            setIsVisible(true);
            setProgress(100);
        });

        const hideTimer = setTimeout(() => {
            setIsVisible(false);
            setProgress(0);
            resetNavigation();
        }, 180);

        return () => {
            window.cancelAnimationFrame(frameId);
            clearTimeout(hideTimer);
        };
    }, [forceVisible, phase, resetNavigation, transitionId]);

    if (!isVisible) return null;

    return (
        <div className="fixed top-0 left-0 w-full h-1 z-[9999]">
            <div
                className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
};

export default GlobalLoader;
