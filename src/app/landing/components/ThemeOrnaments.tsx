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
    Flame, Star, Sparkles, GraduationCap, PartyPopper, Zap,
    Music, ShoppingBag, Book, Pencil, Timer, Egg, Tag, Percent,
} from 'lucide-react';

interface ThemeOrnamentsProps {
    themeId: string;
}

const createSeededRatio = (seedKey: string): number => {
    let hash = 2166136261;

    for (let index = 0; index < seedKey.length; index += 1) {
        hash ^= seedKey.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0) / 4294967295;
};

const getSeededValue = (
    themeId: string,
    index: number,
    salt: string,
    min: number,
    max: number,
): number => {
    const ratio = createSeededRatio(`${themeId}:${index}:${salt}`);
    return min + (max - min) * ratio;
};

const formatPercent = (value: number): string => `${value.toFixed(3)}%`;
const formatSeconds = (value: number): string => `${value.toFixed(2)}s`;

export const ThemeOrnaments: React.FC<ThemeOrnamentsProps> = ({ themeId }) => {
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
                    {Array.from({ length: 20 }, (_, index) => {
                        const top = getSeededValue(themeId, index, 'top', 0, 100);
                        const left = getSeededValue(themeId, index, 'left', 0, 100);
                        const duration = getSeededValue(themeId, index, 'duration', 15, 35);
                        const size = getSeededValue(themeId, index, 'size', 15, 55);

                        return (
                            <div
                                key={index}
                                className="absolute text-fuchsia-500/10 animate-spin-slow"
                                style={{
                                    top: formatPercent(top),
                                    left: formatPercent(left),
                                    animationDuration: formatSeconds(duration),
                                }}
                            >
                                <Music size={size} />
                            </div>
                        );
                    })}
                    <div className="absolute top-1/4 right-[15%] text-purple-500/10 animate-bounce">
                        <PartyPopper size={250} />
                    </div>
                </div>
            );
        case 'black-friday':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.1),transparent_70%)]" />
                    {Array.from({ length: 15 }, (_, index) => {
                        const top = getSeededValue(themeId, index, 'top', 0, 100);
                        const left = getSeededValue(themeId, index, 'left', 0, 100);
                        const size = getSeededValue(themeId, index, 'size', 150, 300);

                        return (
                            <div
                                key={index}
                                className="absolute text-yellow-500/5 animate-pulse"
                                style={{
                                    top: formatPercent(top),
                                    left: formatPercent(left),
                                    animationDelay: formatSeconds(index * 0.3),
                                }}
                            >
                                <Zap size={size} strokeWidth={0.5} />
                            </div>
                        );
                    })}
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
                    {Array.from({ length: 15 }, (_, index) => {
                        const top = getSeededValue(themeId, index, 'top', 0, 100);
                        const left = getSeededValue(themeId, index, 'left', 0, 100);
                        const duration = getSeededValue(themeId, index, 'duration', 4, 9);
                        const size = getSeededValue(themeId, index, 'size', 25, 65);

                        return (
                            <div
                                key={index}
                                className="absolute text-amber-400/20 animate-ping"
                                style={{
                                    top: formatPercent(top),
                                    left: formatPercent(left),
                                    animationDuration: formatSeconds(duration),
                                }}
                            >
                                <Star size={size} fill="currentColor" />
                            </div>
                        );
                    })}
                    <div className="absolute top-1/3 left-1/3 text-blue-400/10 animate-pulse">
                        <Sparkles size={350} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'pascoa':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    {Array.from({ length: 8 }, (_, index) => {
                        const top = getSeededValue(themeId, index, 'top', 80, 95);
                        const left = getSeededValue(themeId, index, 'left', 0, 90);
                        const size = getSeededValue(themeId, index, 'size', 40, 80);

                        return (
                            <div
                                key={index}
                                className="absolute text-emerald-500/10 animate-bounce"
                                style={{
                                    top: formatPercent(top),
                                    left: formatPercent(left),
                                    animationDelay: formatSeconds(index * 0.5),
                                }}
                            >
                                <Egg size={size} strokeWidth={1} />
                            </div>
                        );
                    })}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-emerald-600/5">
                        <Egg size={400} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'consumidor':
            return (
                <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden select-none">
                    {Array.from({ length: 12 }, (_, index) => {
                        const top = getSeededValue(themeId, index, 'top', 0, 100);
                        const left = getSeededValue(themeId, index, 'left', 0, 100);
                        const rotation = getSeededValue(themeId, index, 'rotation', 0, 360);
                        const size = getSeededValue(themeId, index, 'size', 30, 60);

                        return (
                            <div
                                key={index}
                                className="absolute text-rose-500/10 animate-pulse flex items-center gap-1"
                                style={{
                                    top: formatPercent(top),
                                    left: formatPercent(left),
                                    animationDelay: formatSeconds(index * 0.2),
                                    transform: `rotate(${rotation.toFixed(2)}deg)`,
                                }}
                            >
                                <Tag size={size} />
                                <Percent size={14} />
                            </div>
                        );
                    })}
                    <div className="absolute top-1/2 right-[10%] text-rose-600/5">
                        <ShoppingBag size={300} strokeWidth={0.5} />
                    </div>
                </div>
            );
        default:
            return null;
    }
};
