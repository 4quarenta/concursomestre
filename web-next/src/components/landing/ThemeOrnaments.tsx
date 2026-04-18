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

import {
    Book,
    Egg,
    Flame,
    GraduationCap,
    Music,
    PartyPopper,
    Pencil,
    Percent,
    ShoppingBag,
    Sparkles,
    Star,
    Tag,
    Timer,
    Zap
} from 'lucide-react';

interface ThemeOrnamentsProps {
    themeId: string;
}

const hashSeed = (seed: string) => {
    let hash = 2166136261;

    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
};

const getSeededNumber = (seed: string, min: number, max: number) => {
    const normalized = hashSeed(seed) / 4294967295;
    return min + (normalized * (max - min));
};

const getPercentValue = (themeId: string, index: number, axis: 'x' | 'y', min = 0, max = 100) => (
    `${getSeededNumber(`${themeId}:${index}:${axis}`, min, max).toFixed(2)}%`
);

const getDurationValue = (themeId: string, index: number, key: string, min: number, max: number) => (
    `${getSeededNumber(`${themeId}:${index}:${key}`, min, max).toFixed(2)}s`
);

const getPixelValue = (themeId: string, index: number, key: string, min: number, max: number) => (
    Number(getSeededNumber(`${themeId}:${index}:${key}`, min, max).toFixed(2))
);

const getRotationValue = (themeId: string, index: number) => (
    `${getSeededNumber(`${themeId}:${index}:rotation`, 0, 360).toFixed(2)}deg`
);

export function ThemeOrnaments({ themeId }: ThemeOrnamentsProps) {
    switch (themeId) {
        case 'sao-joao':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    <div className="absolute top-0 left-0 w-full flex justify-between px-10 opacity-30 h-10">
                        {[...Array(24)].map((_, i) => (
                            <div
                                key={i}
                                className={`w-3 h-5 ${i % 3 === 0 ? 'bg-orange-500' : i % 3 === 1 ? 'bg-red-500' : 'bg-yellow-500'} rounded-b-sm animate-bounce`}
                                style={{ animationDelay: `${i * 0.1}s` }}
                            />
                        ))}
                    </div>
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-orange-950/20" />
                    <div className="absolute bottom-20 -left-10 text-orange-500/10 animate-pulse">
                        <Flame size={400} strokeWidth={1} />
                    </div>
                    <div className="absolute top-40 -right-10 text-yellow-500/10 animate-pulse delay-700">
                        <Flame size={300} strokeWidth={1} />
                    </div>
                </div>
            );
        case 'carnaval':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-fuchsia-500/10 animate-spin-slow"
                            style={{
                                top: getPercentValue(themeId, i, 'y'),
                                left: getPercentValue(themeId, i, 'x'),
                                animationDuration: getDurationValue(themeId, i, 'duration', 15, 35)
                            }}
                        >
                            <Music size={getPixelValue(themeId, i, 'size', 15, 55)} />
                        </div>
                    ))}
                    <div className="absolute top-1/4 right-[15%] text-purple-500/10 animate-bounce">
                        <PartyPopper size={250} />
                    </div>
                </div>
            );
        case 'black-friday':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.1),transparent_70%)]" />
                    {[...Array(15)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-yellow-500/5 animate-pulse"
                            style={{
                                top: getPercentValue(themeId, i, 'y'),
                                left: getPercentValue(themeId, i, 'x'),
                                animationDelay: `${i * 0.3}s`
                            }}
                        >
                            <Zap size={getPixelValue(themeId, i, 'size', 150, 300)} strokeWidth={0.5} />
                        </div>
                    ))}
                </div>
            );
        case 'black-november':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-zinc-950/20" />
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent w-full animate-slide-right"
                            style={{
                                top: `${15 + i * 15}%`,
                                animationDuration: `${5 + i * 2}s`
                            }}
                        />
                    ))}
                    <div className="absolute bottom-1/4 right-1/4 text-amber-500/5 animate-pulse">
                        <Timer size={300} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'estudante':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none text-indigo-500/10">
                    <div className="absolute top-40 left-[10%] animate-float"><GraduationCap size={180} /></div>
                    <div className="absolute bottom-40 right-[15%] animate-float-delayed"><Book size={150} /></div>
                    <div className="absolute top-1/2 right-[25%] opacity-50"><Pencil size={100} /></div>
                </div>
            );
        case 'ano-novo':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    {[...Array(15)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-amber-400/20 animate-ping"
                            style={{
                                top: getPercentValue(themeId, i, 'y'),
                                left: getPercentValue(themeId, i, 'x'),
                                animationDuration: getDurationValue(themeId, i, 'duration', 4, 9)
                            }}
                        >
                            <Star size={getPixelValue(themeId, i, 'size', 25, 65)} fill="currentColor" />
                        </div>
                    ))}
                    <div className="absolute top-1/3 left-1/3 text-blue-400/10 animate-pulse">
                        <Sparkles size={350} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'pascoa':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-emerald-500/10 animate-bounce"
                            style={{
                                top: getPercentValue(themeId, i, 'y', 80, 95),
                                left: getPercentValue(themeId, i, 'x', 0, 90),
                                animationDelay: `${i * 0.5}s`
                            }}
                        >
                            <Egg size={getPixelValue(themeId, i, 'size', 40, 80)} strokeWidth={1} />
                        </div>
                    ))}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-emerald-600/5">
                        <Egg size={400} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'consumidor':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-rose-500/10 animate-pulse flex items-center gap-1"
                            style={{
                                top: getPercentValue(themeId, i, 'y'),
                                left: getPercentValue(themeId, i, 'x'),
                                animationDelay: `${i * 0.2}s`,
                                transform: `rotate(${getRotationValue(themeId, i)})`
                            }}
                        >
                            <Tag size={getPixelValue(themeId, i, 'size', 30, 60)} />
                            <Percent size={14} />
                        </div>
                    ))}
                    <div className="absolute top-1/2 right-[10%] text-rose-600/5">
                        <ShoppingBag size={300} strokeWidth={0.5} />
                    </div>
                </div>
            );
        default:
            return null;
    }
}
