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
import { usePathname } from 'next/navigation';

const GlobalLoader: React.FC = () => {
    const pathname = usePathname();
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Start loading on route change
        setIsVisible(true);
        setProgress(30);

        const timer1 = setTimeout(() => setProgress(70), 100);
        const timer2 = setTimeout(() => {
            setProgress(100);
            setTimeout(() => setIsVisible(false), 200);
        }, 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [pathname]);

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
