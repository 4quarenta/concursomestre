import {
    Flame, Star, Sparkles, GraduationCap, PartyPopper, Zap,
    Music, ShoppingBag, Book, Pencil, Timer, Egg, Tag, Percent,
    Clock, Ghost
} from 'lucide-react';

interface ThemeOrnamentsProps {
    themeId: string;
}

export const ThemeOrnaments: React.FC<ThemeOrnamentsProps> = ({ themeId }) => {
    switch (themeId) {
        case 'sao-joao':
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
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
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-fuchsia-500/10 animate-spin-slow"
                            style={{
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                animationDuration: `${15 + Math.random() * 20}s`
                            }}
                        >
                            <Music size={15 + Math.random() * 40} />
                        </div>
                    ))}
                    <div className="absolute top-1/4 right-[15%] text-purple-500/10 animate-bounce">
                        <PartyPopper size={250} />
                    </div>
                </div>
            );
        case 'black-friday':
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(234,179,8,0.1),transparent_70%)]" />
                    {[...Array(15)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-yellow-500/5 animate-pulse"
                            style={{
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${i * 0.3}s`
                            }}
                        >
                            <Zap size={150 + Math.random() * 150} strokeWidth={0.5} />
                        </div>
                    ))}
                </div>
            );
        case 'black-november':
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
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
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 text-indigo-500/10">
                    <div className="absolute top-40 left-[10%] animate-float"><GraduationCap size={180} /></div>
                    <div className="absolute bottom-40 right-[15%] animate-float-delayed"><Book size={150} /></div>
                    <div className="absolute top-1/2 right-[25%] opacity-50"><Pencil size={100} /></div>
                </div>
            );
        case 'ano-novo':
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                    {[...Array(15)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-amber-400/20 animate-ping"
                            style={{
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                animationDuration: `${4 + Math.random() * 5}s`
                            }}
                        >
                            <Star size={25 + Math.random() * 40} fill="currentColor" />
                        </div>
                    ))}
                    <div className="absolute top-1/3 left-1/3 text-blue-400/10 animate-pulse">
                        <Sparkles size={350} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'pascoa':
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                    {[...Array(8)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-emerald-500/10 animate-bounce"
                            style={{
                                top: `${80 + Math.random() * 15}%`,
                                left: `${Math.random() * 90}%`,
                                animationDelay: `${i * 0.5}s`
                            }}
                        >
                            <Egg size={40 + Math.random() * 40} strokeWidth={1} />
                        </div>
                    ))}
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-emerald-600/5">
                        <Egg size={400} strokeWidth={0.5} />
                    </div>
                </div>
            );
        case 'consumidor':
            return (
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute text-rose-500/10 animate-pulse flex items-center gap-1"
                            style={{
                                top: `${Math.random() * 100}%`,
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${i * 0.2}s`,
                                transform: `rotate(${Math.random() * 360}deg)`
                            }}
                        >
                            <Tag size={30 + Math.random() * 30} />
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
};
