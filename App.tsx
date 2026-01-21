
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Layout } from './components/Layout';
import { PCPart, PCPartStatus, LoreEntry, DiagnosticMetric, DiagnosticStatus, PlayerStats, SectorStatus, Item } from './types';
import { INITIAL_PARTS, LOCATIONS } from './constants';
import { generateLore } from './services/geminiService';

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

interface Toast {
  id: string;
  message: string;
  type: 'critical' | 'info';
}

const ITEMS: Item[] = [
  { id: 'protein-bar', name: 'Compressed Bar', type: 'FOOD', value: 25, description: 'Tastes like chalk. Restores 25 HP.' },
  { id: 'energy-drink', name: 'Neon Volt', type: 'DRINK', value: 50, description: 'Buzzing with caffeine. Restores 50 Stamina.' },
  { id: 'lead-pipe', name: 'Heavy Pipe', type: 'WEAPON', value: 15, description: 'Standard blunt force. 15 Damage.' },
  { id: 'soldering-iron', name: 'High-Temp Iron', type: 'WEAPON', value: 30, description: 'Cauterizes as it cuts. 30 Damage.' },
];

const COMBAT_TIPS = [
  "LOW STAMINA (<25) CAUSES NEURAL LAG: ESCAPE CHANCE DROPS BY 50%.",
  "SALVAGING CONSUMES 15 NEURAL CHARGE (STM) PER EXTRACTION.",
  "EQUIP WEAPONS FROM THE INVENTORY PANEL BEFORE ENGAGING ENTITIES.",
  "SYSTEM INTEGRITY BELOW 50% INCREASES CRITICAL FEEDBACK DAMAGE.",
  "MONSTERS ARE ATTRACTED TO AGGRESSIVE SALVAGE PATTERNS.",
  "RECOVERY ITEMS (FOOD/DRINK) DO NOT CONSUME STAMINA TO EXECUTE."
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [parts, setParts] = useState<PCPart[]>(INITIAL_PARTS);
  const [lore, setLore] = useState<LoreEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedInventoryPart, setSelectedInventoryPart] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | 'RECOVERY' | 'WEAPON'>('ALL');
  const [activeTipIndex, setActiveTipIndex] = useState(0);
  
  // Player Stats State
  const [stats, setStats] = useState<PlayerStats>({
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    scrap: 45,
    inventory: [ITEMS[0]],
    equippedWeapon: null
  });

  // Sector States
  const [sectorStatuses, setSectorStatuses] = useState<SectorStatus[]>(
    LOCATIONS.map(l => ({ id: l.id, salvageLeft: 100, aggression: 0 }))
  );

  // Encounter/Combat States
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [combatActive, setCombatActive] = useState(false);
  const [monsterHp, setMonsterHp] = useState(0);
  const [qteActive, setQteActive] = useState(false);
  const [qteProgress, setQteProgress] = useState(0);

  // Hardware flags for syncing
  const installedParts = parts.filter(p => p.status === PCPartStatus.INSTALLED);
  const hasMotherboard = installedParts.some(p => p.id === 'motherboard');
  const hasCPU = installedParts.some(p => p.id === 'cpu-ram');
  const hasGPU = installedParts.some(p => p.id === 'gpu');
  const hasPSU = installedParts.some(p => p.id === 'psu');

  const resetGame = (targetState: GameState) => {
    setParts(INITIAL_PARTS);
    setLore([]);
    setStats({
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      scrap: 45,
      inventory: [ITEMS[0]],
      equippedWeapon: null
    });
    setSectorStatuses(LOCATIONS.map(l => ({ id: l.id, salvageLeft: 100, aggression: 0 })));
    setActiveEncounterId(null);
    setCombatActive(false);
    setQteActive(false);
    setSelectedInventoryPart(null);
    setGameState(targetState);
  };

  // Cycle combat tips
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const tipInterval = setInterval(() => {
      setActiveTipIndex(prev => (prev + 1) % COMBAT_TIPS.length);
    }, 10000);
    return () => clearInterval(tipInterval);
  }, [gameState]);

  // Diagnostic Sync Logic
  const diagnostics = useMemo((): DiagnosticMetric[] => {
    return [
      { 
        id: 'logic', 
        label: 'Logic Coherence (MB)', 
        value: hasMotherboard ? (hasCPU ? 100 : 45) : 0, 
        unit: '%', 
        status: hasMotherboard ? (hasCPU ? 'OPTIMAL' : 'DEGRADED') : 'CRITICAL' 
      },
      { 
        id: 'temp', 
        label: 'Core Temp (CPU)', 
        value: hasCPU ? (hasPSU ? 42 : 74) : 22, 
        unit: '°C', 
        status: hasCPU ? (hasPSU ? 'OPTIMAL' : 'CRITICAL') : 'OPTIMAL' 
      },
      { 
        id: 'spec', 
        label: 'Spectral Sync (GPU)', 
        value: hasGPU ? (hasPSU ? 94 : 40) : 0, 
        unit: 'mHz', 
        status: hasGPU ? (hasPSU ? 'OPTIMAL' : 'DEGRADED') : 'CRITICAL' 
      },
      { 
        id: 'volt', 
        label: 'Voltage Stability (PSU)', 
        value: hasPSU ? 99 : 0, 
        unit: '%', 
        status: hasPSU ? 'OPTIMAL' : 'CRITICAL' 
      },
    ];
  }, [hasMotherboard, hasCPU, hasGPU, hasPSU]);

  const installedCount = installedParts.length;
  const systemIntegrity = Math.round((installedCount / parts.length) * 100);

  const addToast = (message: string, type: 'critical' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // Aggression (Risk) Decay over time
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const decayInterval = setInterval(() => {
      setSectorStatuses(prev => prev.map(s => ({
        ...s,
        aggression: Math.max(0, s.aggression - 1)
      })));
    }, 4000);
    return () => clearInterval(decayInterval);
  }, [gameState]);

  // Vitals regeneration
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
      if (!qteActive && !combatActive) {
        setStats(prev => ({
          ...prev,
          stamina: Math.min(prev.maxStamina, prev.stamina + 2.5)
        }));
      }
    }, 500);
    return () => clearInterval(interval);
  }, [qteActive, combatActive, gameState]);

  // QTE Logic for escaping
  useEffect(() => {
    if (!qteActive || gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
      setQteProgress(prev => Math.max(0, prev - 1.5));
      setStats(prev => ({ ...prev, stamina: Math.max(0, prev.stamina - 0.5) }));
    }, 50);
    return () => clearInterval(interval);
  }, [qteActive, gameState]);

  useEffect(() => {
    if (qteActive && qteProgress >= 100) {
      setQteActive(false);
      setActiveEncounterId(null);
      addToast("DIVE SUCCESSFUL. CONNECTION SEVERED.", 'info');
    }
    if (qteActive && stats.stamina <= 0) {
      setQteActive(false);
      setStats(prev => ({ ...prev, hp: Math.max(0, prev.hp - 45) }));
      addToast(`FEEDBACK LOOP: STAMINA EXHAUSTED.`, "critical");
      setActiveEncounterId(null);
    }
  }, [qteProgress, stats.stamina, qteActive]);

  useEffect(() => {
    if (stats.hp <= 0 && gameState === 'PLAYING') {
      setGameState('GAMEOVER');
    }
  }, [stats.hp, gameState]);

  const handleFight = async () => {
    if (!activeEncounterId) return;
    const loc = LOCATIONS.find(l => l.id === activeEncounterId);
    setMonsterHp(60 + (loc?.horrorLevel || 1) * 20);
    setCombatActive(true);
    addToast("ENTERING COMBAT PROTOCOL", 'critical');
  };

  const handleAttack = async () => {
    if (!combatActive) return;
    const weaponDmg = stats.equippedWeapon?.value || 5;
    const totalDmg = weaponDmg + Math.floor(Math.random() * 12);
    const newMonsterHp = Math.max(0, monsterHp - totalDmg);
    
    setMonsterHp(newMonsterHp);
    addToast(`HIT: ${totalDmg} DMG`, 'info');

    if (newMonsterHp <= 0) {
      setCombatActive(false);
      setActiveEncounterId(null);
      setStats(prev => ({ ...prev, scrap: prev.scrap + 150 }));
      addToast("ENTITY PURGED.", 'info');
      const combatLore = await generateLore("The Abomination has been physically dismantled. Describe the leaking black fluid that looks like oil and liquid mercury.");
      setLore(prev => [{ id: Date.now().toString(), title: "COMBAT LOG: PURGE", content: combatLore, category: 'Combat' }, ...prev]);
    } else {
      const damage = 12 + Math.floor(Math.random() * 18);
      setStats(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage) }));
      addToast(`SYSTEM BREACH: ${damage} DMG TAKEN`, 'critical');
    }
  };

  const handleInvestigate = async (locId: string) => {
    if (stats.stamina < 15) {
      addToast("INSUFFICIENT NEURAL CHARGE: RECOVERY REQUIRED", "critical");
      return;
    }

    const location = LOCATIONS.find(l => l.id === locId);
    const sector = sectorStatuses.find(s => s.id === locId);
    if (!location || !sector || sector.salvageLeft <= 0) return;

    setIsGenerating(true);
    addToast(`Probing sector: ${location.name}...`, 'info');

    setStats(prev => ({ ...prev, stamina: Math.max(0, prev.stamina - 15) }));

    const risk = (location.horrorLevel * 7) + sector.aggression;
    const roll = Math.random() * 100;
    const isEncounter = roll < risk;
    
    if (isEncounter) {
      setActiveEncounterId(locId);
      addToast(`SIGNAL INTERFERENCE: MONSTER DETECTED`, 'critical');
    } else {
      const missingParts = parts.filter(p => p.status === PCPartStatus.MISSING);
      let foundPartId: string | null = null;
      
      if (missingParts.length > 0 && Math.random() < 0.15) {
        const discovered = missingParts[Math.floor(Math.random() * missingParts.length)];
        foundPartId = discovered.id;
        updatePartStatus(discovered.id, PCPartStatus.FOUND);
        addToast(`HARDWARE RECOVERED: ${discovered.name.toUpperCase()}`, 'info');
      }

      const scrapFound = Math.floor(Math.random() * 20 * (location.horrorLevel / 2)) + 10;
      let droppedItem: Item | null = null;
      if (Math.random() > 0.8) {
        droppedItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      }

      setStats(prev => ({ 
        ...prev, 
        scrap: prev.scrap + scrapFound,
        inventory: droppedItem ? [...prev.inventory, droppedItem] : prev.inventory
      }));
      
      if (droppedItem) addToast(`EXTRACTED: ${droppedItem.name}`, 'info');

      setSectorStatuses(prev => prev.map(s => 
        s.id === locId ? { ...s, salvageLeft: Math.max(0, s.salvageLeft - 20), aggression: s.aggression + 12 } : s
      ));
      if (!foundPartId) addToast(`Salvaged ${scrapFound}u. Aggression peaked.`, 'info');
    }
    setTimeout(() => setIsGenerating(false), 800);
  };

  const useItem = (item: Item, index: number) => {
    if (item.type === 'FOOD') {
      setStats(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + item.value) }));
      addToast(`Vitals improved: ${item.name}.`, 'info');
    } else if (item.type === 'DRINK') {
      setStats(prev => ({ ...prev, stamina: Math.min(prev.maxStamina, prev.stamina + item.value) }));
      addToast(`Neurons firing: ${item.name}.`, 'info');
    } else if (item.type === 'WEAPON') {
      setStats(prev => ({ ...prev, equippedWeapon: item }));
      addToast(`Weapon online: ${item.name}.`, 'info');
      return;
    }
    
    setStats(prev => {
      const newInv = [...prev.inventory];
      newInv.splice(index, 1);
      return { ...prev, inventory: newInv };
    });
  };

  const handleChoiceHide = async () => {
    setActiveEncounterId(null);
    addToast("Signal masked. Undetected.", "info");
  };

  const handleChoiceRun = () => {
    if (stats.stamina < 25 && Math.random() > 0.5) {
      addToast("NEURAL LAG: ESCAPE ATTEMPT FAILED", "critical");
      handleFight();
      return;
    }
    setQteActive(true);
    setQteProgress(0);
  };

  const handleQteClick = () => {
    if (!qteActive || stats.stamina <= 0) return;
    setQteProgress(prev => Math.min(100, prev + 12));
    setStats(prev => ({ ...prev, stamina: Math.max(0, prev.stamina - 2.5) }));
  };

  const updatePartStatus = useCallback((id: string, status: PCPartStatus) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  }, []);

  const handleSlotClick = (id: string) => {
    const part = parts.find(p => p.id === id);
    if (!part || part.status === PCPartStatus.INSTALLED) return;
    if (selectedInventoryPart === id) {
      updatePartStatus(id, PCPartStatus.INSTALLED);
      setSelectedInventoryPart(null);
      addToast(`HARDWARE INTEGRATED: ${part.name.toUpperCase()}`, 'info');
    } else {
      addToast(`SELECT ${part.name.toUpperCase()} FROM HOLDING BAY`, 'info');
    }
  };

  const getStatusColor = (status: DiagnosticStatus) => {
    switch (status) {
      case 'OPTIMAL': return 'text-green-500';
      case 'DEGRADED': return 'text-yellow-500';
      case 'CRITICAL': return 'text-red-500';
      default: return 'text-zinc-500';
    }
  };

  const filteredInventory = stats.inventory.filter(item => {
    if (inventoryFilter === 'ALL') return true;
    if (inventoryFilter === 'RECOVERY') return item.type === 'FOOD' || item.type === 'DRINK';
    if (inventoryFilter === 'WEAPON') return item.type === 'WEAPON';
    return true;
  });

  // MAIN MENU UI
  if (gameState === 'MENU') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="absolute inset-0 bg-gradient-radial from-red-950/20 to-transparent"></div>
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-4">
             <span className="mono text-red-600 text-xs font-black tracking-[0.8em] uppercase block mb-2 opacity-50">Experimental_Neural_Link</span>
             <h1 className="text-[120px] sm:text-[180px] leading-none font-black mono text-white tracking-tighter uppercase glitch-place">
               BAD<br/><span className="text-red-600">SECTOR</span>
             </h1>
          </div>
          
          <div className="w-[400px] h-1 bg-gradient-to-r from-transparent via-zinc-800 to-transparent mb-16"></div>
          
          <button 
            onClick={() => resetGame('PLAYING')}
            className="group relative px-20 py-8 bg-zinc-900 hover:bg-white transition-all duration-300 active:scale-95 border-b-8 border-zinc-800 hover:border-zinc-300 overflow-hidden"
          >
            <div className="absolute inset-0 w-full h-full bg-red-600/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 skew-x-12"></div>
            <span className="relative z-10 mono text-3xl font-black text-white group-hover:text-black uppercase tracking-widest">Connect_System</span>
          </button>
          
          <div className="mt-20 flex flex-col items-center gap-2">
            <p className="mono text-zinc-700 text-xs uppercase tracking-[0.4em] animate-pulse">Scanning for valid hardware signatures...</p>
            <div className="flex gap-4">
               <div className="w-2 h-2 rounded-full bg-zinc-800 animate-bounce delay-75"></div>
               <div className="w-2 h-2 rounded-full bg-zinc-800 animate-bounce delay-150"></div>
               <div className="w-2 h-2 rounded-full bg-zinc-800 animate-bounce delay-300"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout hp={stats.hp} maxHp={stats.maxHp} stamina={stats.stamina} maxStamina={stats.maxStamina} scrap={stats.scrap}>
      
      {/* Toast Overlay */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto min-w-[300px] p-4 border-2 rounded-sm shadow-2xl animate-in slide-in-from-right-full fade-in duration-300 mono text-xs uppercase tracking-tighter ${toast.type === 'critical' ? 'bg-red-950/90 border-red-500 text-red-100' : 'bg-zinc-900/90 border-green-500 text-green-100'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${toast.type === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <div className="flex-1">
                <p className="font-black text-[10px] tracking-widest">{toast.type === 'critical' ? '>> CRITICAL ALERT' : '>> KERNEL LOG'}</p>
                <p className="opacity-80 font-bold">{toast.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* GAME OVER MODAL */}
      {gameState === 'GAMEOVER' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
          <div className="max-w-xl w-full bg-zinc-950 border-4 border-red-600 p-16 shadow-[0_0_200px_rgba(220,38,38,0.4)] flex flex-col items-center animate-in zoom-in-95 duration-500">
            <div className="mb-10 text-center">
              <span className="mono text-red-900 text-[10px] font-black tracking-[1em] uppercase block mb-4">CRITICAL_SYSTEM_FAILURE</span>
              <h2 className="text-[32px] font-black mono text-red-600 uppercase mb-4 tracking-tighter glitch-place leading-none">YOU DEAD</h2>
              <div className="w-full h-1 bg-red-600/30">
                 <div className="w-1/3 h-full bg-red-600 animate-[move_2s_infinite_linear]"></div>
              </div>
            </div>
            
            <p className="mono text-zinc-500 text-center mb-16 text-xs uppercase leading-relaxed tracking-widest font-bold">
              NEURAL CONNECTIVITY: TERMINATED<br/>
              HARDWARE STATUS: DISMANTLED<br/>
              IDENTITY TRACE: PURGED
            </p>

            <div className="flex flex-col gap-6 w-full">
              <button 
                onClick={() => resetGame('PLAYING')}
                className="w-full py-5 bg-red-600 hover:bg-red-500 text-white mono font-black uppercase text-xl border-b-8 border-red-900 transition-all active:scale-95 shadow-xl"
              >
                Restart_Extraction
              </button>
              <button 
                onClick={() => resetGame('MENU')}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 mono font-black uppercase text-lg border border-zinc-700 transition-all active:scale-95"
              >
                Return_To_Main_Menu
              </button>
            </div>
            
            <style>{`
              @keyframes move {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(300%); }
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Popups */}
      {activeEncounterId && !qteActive && !combatActive && gameState === 'PLAYING' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
          <div className="max-w-md w-full bg-zinc-900 border-4 border-red-600 p-10 rounded-sm shadow-[0_0_120px_rgba(220,38,38,0.6)] animate-in zoom-in-95">
            <h2 className="text-4xl font-black mono text-red-500 uppercase mb-6 tracking-tighter text-center flicker">ENTITY DETECTED</h2>
            <div className="flex flex-col gap-4">
              <button onClick={handleFight} className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black mono uppercase text-xl border-2 border-red-400 transition-all shadow-lg active:scale-95">COMBAT PROTOCOL</button>
              <button onClick={handleChoiceRun} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 mono font-black uppercase border border-zinc-700 active:scale-95">ESCAPE ATTEMPT</button>
              <button onClick={handleChoiceHide} className="w-full py-4 bg-black hover:bg-zinc-900 text-zinc-600 mono font-black uppercase border border-zinc-800 active:scale-95">MASK SIGNAL</button>
            </div>
          </div>
        </div>
      )}

      {combatActive && gameState === 'PLAYING' && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/98 backdrop-blur-2xl p-4">
          <div className="max-w-2xl w-full flex flex-col items-center">
            <div className="w-full mb-16 px-12">
               <div className="flex justify-between items-end mb-3">
                 <span className="mono text-red-600 text-xs font-black uppercase tracking-widest">Abomination_V.Alpha</span>
                 <span className="mono text-red-500 font-black">{monsterHp} UNITS</span>
               </div>
               <div className="w-full h-6 bg-zinc-900 rounded-sm border-2 border-red-900/50 overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                  <div className="h-full bg-red-600 transition-all duration-300 relative" style={{ width: `${(monsterHp / 300) * 100}%` }}>
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  </div>
               </div>
            </div>
            <button onClick={handleAttack} className="w-full h-48 bg-red-600 hover:bg-red-500 text-white font-black mono uppercase text-4xl border-8 border-red-400 active:scale-90 transition-all shadow-[0_0_80px_rgba(220,38,38,0.7)] group">
              <span className="group-hover:scale-110 transition-transform inline-block">STRIKE</span>
            </button>
            <button onClick={() => { setCombatActive(false); setActiveEncounterId(null); }} className="mt-12 py-3 px-16 bg-zinc-900 text-zinc-600 mono text-xs font-black uppercase hover:bg-zinc-800 border-2 border-zinc-800 hover:text-zinc-400 transition-all">FORCED_DISCONNECT</button>
          </div>
        </div>
      )}

      {qteActive && gameState === 'PLAYING' && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-2xl cursor-pointer" onClick={handleQteClick}>
          <h2 className="text-9xl font-black mono text-white italic animate-pulse mb-16 tracking-tighter drop-shadow-2xl">SEVER!</h2>
          <div className="w-full max-w-2xl bg-black/90 p-8 border-4 border-white/20 rounded-sm shadow-[0_0_100px_rgba(255,255,255,0.1)]">
            <div className="h-16 bg-zinc-950 rounded-sm relative overflow-hidden border-2 border-zinc-800 shadow-inner">
              <div className="h-full bg-red-600 transition-all duration-75 shadow-[0_0_20px_rgba(220,38,38,0.5)]" style={{ width: `${qteProgress}%` }} />
            </div>
            <p className="mono text-center text-red-500 text-sm mt-8 uppercase tracking-widest font-black">SPAM CLICK TO OVERLOAD THE CONNECTION</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-3 space-y-8">
          
          {/* Section 1: Critical Sectors */}
          <section className="bg-zinc-900/60 border-2 border-zinc-800 rounded shadow-2xl overflow-hidden">
            <div className="bg-zinc-800 px-3 py-2 border-b-2 border-zinc-700 flex justify-between items-center">
              <h2 className="text-[20px] font-black mono uppercase text-zinc-300 tracking-[0.1em] flex items-center gap-2">
                <span className="w-4 h-4 bg-red-600 animate-pulse rounded-sm"></span>
                Sectors
              </h2>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                <div className="w-2 h-2 rounded-full bg-red-900"></div>
              </div>
            </div>
            
            <div className="p-2 flex flex-col gap-4">
              {LOCATIONS.map(loc => {
                const sector = sectorStatuses.find(s => s.id === loc.id);
                if (!sector) return null;
                const riskPercent = Math.min(100, (loc.horrorLevel * 7) + sector.aggression);

                return (
                  <div key={loc.id} className="bg-black border-2 border-zinc-800 rounded-sm overflow-hidden flex flex-col relative shadow-[0_8px_16px_-4px_rgba(0,0,0,0.9)] hover:shadow-[0_12px_24px_-8px_rgba(220,38,38,0.4)] transition-shadow duration-500">
                    <div className="h-28 relative bg-zinc-950 overflow-hidden group">
                       <img src={loc.imageUrl} className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" alt={loc.name} />
                       <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                       <div className="absolute bottom-2 left-4">
                          <span className="mono text-[20px] text-zinc-100 font-black uppercase tracking-tighter drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{loc.name}</span>
                       </div>
                    </div>
                    
                    <div className="p-3 flex flex-col gap-3 bg-zinc-900/40">
                       <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-[20px] mono uppercase mb-1 leading-none">
                               <span className="text-zinc-600">Risk</span>
                               <span className={riskPercent > 70 ? 'text-red-500 font-black' : 'text-zinc-500'}>{Math.round(riskPercent)}%</span>
                            </div>
                            <div className="h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
                               <div className={`h-full transition-all duration-1000 ${riskPercent > 70 ? 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]' : riskPercent > 40 ? 'bg-yellow-600' : 'bg-zinc-700'}`} style={{ width: `${riskPercent}%` }}></div>
                            </div>
                          </div>
                          
                          <div className="text-[20px] mono text-zinc-500 italic leading-[1.1] border-l-2 border-zinc-800 pl-3 py-1 truncate">
                            {loc.description}
                          </div>

                          <div className="flex justify-between items-center text-[20px] mono uppercase text-zinc-700 font-black leading-none">
                             <span>Salvage</span>
                             <span className="text-zinc-300">{sector.salvageLeft}%</span>
                          </div>
                       </div>

                       <button 
                          disabled={isGenerating || sector.salvageLeft <= 0}
                          onClick={() => handleInvestigate(loc.id)}
                          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-700 mono text-[20px] font-black uppercase text-zinc-300 transition-all active:scale-95 shadow-lg"
                        >
                          Salvage
                        </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-zinc-900 px-3 py-1.5 text-[20px] mono text-zinc-700 uppercase tracking-widest text-center border-t border-zinc-800 font-black">
              DECAY_PROTOCOL: ACTIVE
            </div>
          </section>
        </div>

        <div className="lg:col-span-6 space-y-8">
          {/* Section 3: Assembly Table with Integrated System Diagnostics */}
          <section className="bg-zinc-900 border-2 border-zinc-800 rounded-lg p-0 relative overflow-hidden min-h-[750px] shadow-[0_0_50px_rgba(0,0,0,1)] flex flex-col">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            
            <div className="p-10 flex-1 relative z-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-black mono uppercase flex items-center gap-4 tracking-tighter text-zinc-100">
                    <span className="w-5 h-5 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)] rounded-sm"></span>
                    3. Assembly Table
                  </h2>
                  <p className="text-zinc-600 text-xs mono uppercase mt-2 tracking-[0.2em] font-black italic">Structural_Rigging_Active</p>
                </div>
              </div>

              <div className="aspect-video bg-[#050505] rounded border-2 border-zinc-800 relative p-16 mb-10 overflow-hidden shadow-inner group/assembly">
                 <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.4),_transparent_75%)]"></div>
                 <div className="absolute top-6 left-8 mono text-[10px] text-zinc-800 uppercase tracking-[0.3em] font-black opacity-50">Hardware_Mesh_Overlay</div>
                 
                 <div className="w-full h-full relative border-l-4 border-b-4 border-zinc-900/40">
                    {['motherboard', 'cpu-ram', 'gpu', 'psu'].map((id, index) => {
                      const part = parts.find(p => p.id === id);
                      const isInstalled = part?.status === PCPartStatus.INSTALLED;
                      const isSelected = selectedInventoryPart === id;
                      
                      const coords = [
                        'top-[10%] left-[15%] w-[60%] h-[70%]',
                        'top-[22%] left-[32%] w-[28%] h-[32%] z-20',
                        'top-[62%] left-[18%] w-[52%] h-[12%] z-10',
                        'top-[10%] left-[82%] w-[12%] h-[55%]'
                      ][index];

                      return (
                        <div 
                          key={id}
                          onClick={() => handleSlotClick(id)}
                          className={`absolute border-2 transition-all duration-500 cursor-pointer shadow-2xl ${coords} ${
                            isInstalled ? 'border-green-500/60 bg-green-500/5' : 
                            isSelected ? 'border-yellow-400 bg-yellow-400/10 shadow-[0_0_35px_rgba(250,204,21,0.3)] scale-105 z-30' : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-600 hover:bg-zinc-800/20'
                          }`}
                        >
                           <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-zinc-800/40"></div>
                           <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-800/40"></div>
                           <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-zinc-800/40"></div>
                           <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-800/40"></div>

                           {isInstalled ? (
                             <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                <span className="mono text-[10px] font-black text-green-500/80 uppercase text-center tracking-tighter leading-none">{id.replace('-', '_')}</span>
                                <div className="mt-3 w-full h-1 bg-green-950 rounded-full border border-green-900/30">
                                   <div className="w-full h-full bg-green-500/50 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                                </div>
                             </div>
                           ) : (
                             <div className="w-full h-full flex items-center justify-center mono text-[10px] text-zinc-900 uppercase font-black tracking-[0.2em] group-hover/assembly:text-zinc-700 transition-colors opacity-30 group-hover/assembly:opacity-100">
                               DATA_SLOT_{index+1}
                             </div>
                           )}
                        </div>
                      );
                    })}
                 </div>
              </div>

              <div className="bg-black border-2 border-zinc-800 p-8 rounded shadow-inner relative z-10">
                <h3 className="mono text-[11px] uppercase text-zinc-500 mb-8 border-b-2 border-zinc-900 pb-4 flex justify-between items-center font-black tracking-widest">
                  <span>Holding Bay Extraction</span>
                  <span className="text-zinc-700 font-black">{parts.filter(p => p.status === PCPartStatus.FOUND).length} AVAILABLE</span>
                </h3>
                <div className="flex gap-6 flex-wrap">
                  {parts.filter(p => p.status === PCPartStatus.FOUND).map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setSelectedInventoryPart(prev => prev === p.id ? null : p.id)}
                      className={`px-8 py-4 border-2 mono text-[11px] font-black uppercase transition-all duration-400 ${selectedInventoryPart === p.id ? 'bg-yellow-500 text-black border-white shadow-[0_0_30px_rgba(250,204,21,0.5)] -translate-y-2' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-200 hover:shadow-lg'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                  {parts.filter(p => p.status === PCPartStatus.FOUND).length === 0 && (
                    <div className="w-full text-center py-10 border-4 border-dotted border-zinc-900/50 rounded-sm">
                      <span className="mono text-[11px] text-zinc-800 uppercase italic font-black tracking-[0.3em]">No valid hardware found in current sweep sectors.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Integrated System Diagnostics Footer - Text Size 17px */}
            <div className="bg-black border-t-2 border-zinc-800 px-8 py-6 flex flex-col sm:flex-row items-center gap-12 relative z-20">
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[17px] mono text-zinc-500 uppercase font-black tracking-[0.2em] leading-none">INTEGRITY</span>
                    <span className={`text-[17px] mono font-black leading-none ${systemIntegrity > 80 ? 'text-green-500' : 'text-yellow-500'}`}>{systemIntegrity}%</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900/50 relative">
                    <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${systemIntegrity}%` }}>
                      <div className="absolute inset-0 bg-white/10 animate-pulse" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 bg-zinc-900/30 px-6 py-3 rounded-sm border border-zinc-800/50">
                  {diagnostics.map(m => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full shadow-[0_0_8px] ${
                        m.status === 'OPTIMAL' ? 'bg-green-500 shadow-green-500/30' : 
                        m.status === 'DEGRADED' ? 'bg-yellow-500 shadow-yellow-500/30' : 
                        'bg-red-500 shadow-red-500/50 animate-pulse'
                      }`}></div>
                      <span className={`text-[17px] mono font-black uppercase leading-none ${getStatusColor(m.status)}`}>
                        {m.id === 'logic' ? 'MB' : m.id === 'temp' ? 'CPU' : m.id === 'spec' ? 'GPU' : 'PSU'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block border-l-2 border-zinc-900 pl-8 min-w-[140px]">
                   <span className="text-[17px] mono text-zinc-700 uppercase font-black block leading-none mb-1">BOOT_STAT</span>
                   <span className={`text-[17px] mono font-black uppercase tracking-[0.1em] leading-none ${systemIntegrity === 100 ? 'text-green-400 flicker' : 'text-zinc-800'}`}>
                    {systemIntegrity === 100 ? 'READY' : 'WAITING'}
                  </span>
                </div>
            </div>
          </section>

          {/* Section 2: Inventory */}
          <section className="bg-zinc-900/40 border-2 border-zinc-800 p-6 shadow-2xl">
            <h2 className="text-[20px] font-black mono uppercase mb-4 text-zinc-400 flex items-center gap-3 tracking-widest">
              <span className="w-4 h-4 bg-blue-500 rounded-sm"></span>
              2. Inventory
            </h2>

            <div className="flex gap-1 mb-6 border-b border-zinc-800 pb-3">
              {(['ALL', 'RECOVERY', 'WEAPON'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setInventoryFilter(filter)}
                  className={`flex-1 py-2 text-[20px] mono font-black border transition-all ${
                    inventoryFilter === filter
                      ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {filteredInventory.length === 0 && (
                <p className="text-[20px] mono text-zinc-700 italic text-center py-6 font-black uppercase tracking-widest leading-none">
                  {inventoryFilter === 'ALL' ? 'Cache_Empty' : `No_${inventoryFilter}_Detected`}
                </p>
              )}
              {filteredInventory.map((item, i) => (
                <div key={i} className={`p-4 border-2 rounded-sm bg-black/50 group ${stats.equippedWeapon?.id === item.id ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-zinc-800 hover:border-zinc-700'}`}>
                   <div className="flex justify-between items-start mb-3">
                      <span className="mono font-black text-[20px] uppercase text-zinc-200 tracking-tighter leading-none">{item.name}</span>
                      <span className={`text-[20px] mono px-2 py-0.5 border-2 rounded-sm font-black leading-none ${item.type === 'WEAPON' ? 'border-blue-900 text-blue-500 bg-blue-950/20' : 'border-zinc-800 text-zinc-600'}`}>{item.type}</span>
                   </div>
                   <button 
                    onClick={() => useItem(item, i)} 
                    className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-[20px] mono font-black uppercase text-zinc-500 border-2 border-zinc-800 transition-all group-hover:text-zinc-200"
                  >
                    {item.type === 'WEAPON' ? (stats.equippedWeapon?.id === item.id ? 'Equipped' : 'Equip') : 'Execute_Proc'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-3 space-y-8">
          {/* Section 4: Realtime Telemetry & Combat Tip */}
          <section className="bg-zinc-900/40 border-2 border-zinc-800 p-6 shadow-2xl">
            <h2 className="text-[11px] font-black mono uppercase mb-6 text-zinc-400 flex items-center gap-3 tracking-widest">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-sm"></span>
              4. Realtime Telemetry
            </h2>
            <div className="space-y-5 mb-8">
              {diagnostics.map(metric => (
                <div key={metric.id} className="bg-black/60 border-2 border-zinc-800 p-5 rounded-sm shadow-xl relative overflow-hidden group">
                  <div className="flex justify-between items-end mb-3 relative z-10">
                    <span className="text-[10px] mono text-zinc-600 uppercase font-black tracking-widest">{metric.label}</span>
                    <span className={`text-sm font-black mono ${getStatusColor(metric.status)}`}>{metric.value}{metric.unit}</span>
                  </div>
                  <div className="h-2 bg-zinc-950 rounded-sm overflow-hidden border border-zinc-800 shadow-inner">
                    <div className={`h-full transition-all duration-1000 ease-out ${getStatusColor(metric.status).replace('text-', 'bg-')}`} style={{ width: `${(metric.value / (metric.id === 'spec' ? 2 : 1))}%` }}>
                       <div className="w-full h-full bg-white/5 animate-pulse" />
                    </div>
                  </div>
                  {metric.status === 'CRITICAL' && (
                    <div className="absolute inset-0 bg-red-950/10 animate-pulse pointer-events-none" />
                  )}
                </div>
              ))}
            </div>

            {/* Combat Tactic Tip Box */}
            <div className="bg-zinc-950 border-2 border-dashed border-yellow-600/40 p-4 rounded-sm shadow-inner relative overflow-hidden">
               <div className="absolute top-0 right-0 w-8 h-8 opacity-20 rotate-12 -mr-4 -mt-4">
                  <svg className="text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2zm0-6h2v4h-2z"/></svg>
               </div>
               <h3 className="text-[10px] mono font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <span className="w-1.5 h-3 bg-yellow-500"></span>
                 Combat Tactics
               </h3>
               <p className="text-[9px] mono text-zinc-400 font-bold uppercase leading-relaxed animate-in fade-in duration-700" key={activeTipIndex}>
                 {COMBAT_TIPS[activeTipIndex]}
               </p>
            </div>
          </section>

          <section className="bg-zinc-900 border-2 border-zinc-800 p-6 h-[calc(100vh-650px)] min-h-[400px] flex flex-col shadow-2xl relative overflow-hidden">
            <h2 className="text-[11px] font-black mono uppercase mb-8 text-green-500 flex items-center gap-3 tracking-[0.2em] border-b-2 border-zinc-800 pb-4">
               Sidebar System Logs
            </h2>
            <div className="space-y-5 overflow-y-auto pr-3 custom-scrollbar flex-1">
              {lore.map(entry => (
                <div key={entry.id} className="p-5 border-2 border-zinc-800 bg-black/70 rounded-sm animate-in slide-in-from-bottom-3 duration-500 shadow-lg border-l-4 border-l-zinc-600">
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[7px] px-2 py-1 rounded-sm mono border-2 font-black uppercase tracking-widest ${
                      entry.category === 'Monster' ? 'border-red-900/50 text-red-600 bg-red-950/30' : 
                      entry.category === 'Combat' ? 'border-orange-900/50 text-orange-500 bg-orange-950/20' :
                      'border-blue-900/50 text-blue-500 bg-blue-950/20'
                    }`}>
                      {entry.category}
                    </span>
                  </div>
                  <h4 className="text-[10px] font-black mono text-zinc-200 uppercase leading-tight mb-3 tracking-tighter">{entry.title}</h4>
                  <div className="text-[10px] text-zinc-500 leading-relaxed font-mono italic font-bold">
                    {entry.content}
                  </div>
                </div>
              ))}
              {lore.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                  <div className="w-12 h-12 border-4 border-zinc-500 border-t-transparent animate-spin rounded-full mb-4" />
                  <p className="mono text-[10px] text-zinc-500 uppercase italic font-black tracking-[0.3em] text-center">Scanning for digital debris...</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default App;
