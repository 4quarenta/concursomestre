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

            const timer1 = setTimeout(() => setProgress(46), 80);
            const timer2 = setTimeout(() => setProgress(72), 180);
            const timer3 = setTimeout(() => setProgress(86), 520);
            const stallTimer = setTimeout(() => {
                setProgress(92);
            }, 1800);
            const safetyTimer = setTimeout(() => {
                setIsVisible(false);
                setProgress(0);
                resetNavigation();
            }, 8000);

            return () => {
                window.cancelAnimationFrame(frameId);
                clearTimeout(timer1);
                clearTimeout(timer2);
                clearTimeout(timer3);
                clearTimeout(stallTimer);
                clearTimeout(safetyTimer);
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
        <div className="pointer-events-none fixed left-0 top-0 z-[9999] h-0.5 w-full overflow-hidden">
            <div
                className="h-full w-full origin-left bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.45)] transition-transform duration-150 ease-out will-change-transform"
                style={{ transform: `scaleX(${progress / 100})` }}
            />
        </div>
    );
};

export default GlobalLoader;
