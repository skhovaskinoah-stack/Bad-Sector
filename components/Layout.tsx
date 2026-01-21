
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  hp?: number;
  maxHp?: number;
  stamina?: number;
  maxStamina?: number;
  scrap?: number;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  hp = 100, 
  maxHp = 100, 
  stamina = 100, 
  maxStamina = 100, 
  scrap = 0 
}) => {
  const hpPercent = (hp / maxHp) * 100;
  const staminaPercent = (stamina / maxStamina) * 100;

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 selection:bg-green-500 selection:text-black">
      <nav className="border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center font-bold text-black mono">
              BS
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold tracking-tighter uppercase mono text-green-500">
                Bad Sector <span className="text-gray-600">v0.1.0</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Vitals Group */}
            <div className="flex items-center gap-4">
              {/* HP Bar */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2 items-center">
                  <span className="text-[9px] mono text-zinc-500 uppercase">HP</span>
                  <span className={`text-[10px] mono font-bold ${hp < 30 ? 'text-red-500 animate-pulse' : 'text-zinc-300'}`}>{hp}</span>
                </div>
                <div className="w-20 sm:w-24 h-1 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                  <div 
                    className={`h-full transition-all duration-500 ${hp < 30 ? 'bg-red-600' : 'bg-green-500'}`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              </div>

              {/* Stamina Bar */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2 items-center">
                  <span className="text-[9px] mono text-zinc-500 uppercase">STM</span>
                  <span className={`text-[10px] mono font-bold text-blue-400`}>{Math.round(stamina)}</span>
                </div>
                <div className="w-20 sm:w-24 h-1 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                  <div 
                    className={`h-full transition-all duration-200 bg-blue-500`}
                    style={{ width: `${staminaPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Scrap Counter */}
            <div className="hidden sm:flex items-center gap-2 border-l border-zinc-800 pl-6">
              <div className="w-8 h-8 rounded bg-zinc-800/50 flex items-center justify-center border border-zinc-700">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] mono text-zinc-500 uppercase">Salvage</span>
                <span className="text-sm mono font-bold text-yellow-500">{scrap}u</span>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};
