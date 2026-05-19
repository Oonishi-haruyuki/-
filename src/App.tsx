/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Chrome, Ghost, Skull, Volume2, VolumeX, RefreshCcw, Play, FlaskConical, Zap, BookOpen, X } from 'lucide-react';
import { GameState, Point, WORLD_SIZE, PLAYER_SPEED, MONSTER_BASE_SPEED, VISION_RADIUS, ITEM_COUNT, Item, ItemType, Difficulty } from './types.ts';
import { Mansion3D } from './components/Mansion3D.tsx';

// Helper to generate random points
const getRandomPoint = (margin = 100): Point => ({
  x: Math.random() * (WORLD_SIZE - margin * 2) + margin,
  y: Math.random() * (WORLD_SIZE - margin * 2) + margin,
});

const getRandomItem = (id: string, type: ItemType): Item => ({
  id,
  type,
  ...getRandomPoint()
});

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    playerPos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
    monsterPos: { x: 100, y: 100 },
    isCaught: false,
    score: 0,
    scareLevel: 0,
    gameStarted: false,
    items: [],
    inventory: [],
    monsterStunnedUntil: 0,
    difficulty: 'NORMAL',
    showGallery: false,
    floor: 0,
    staircasePos: null,
    mansionEscaped: false,
  });

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const virtualJoystick = useRef({ x: 0, y: 0 });
  const [muted, setMuted] = useState(false);
  const requestRef = useRef<number>(null);
  const gameStateRef = useRef(gameState);

  const isStunned = Date.now() < gameState.monsterStunnedUntil;
  const currentVisionRadius = gameState.difficulty === 'DESPAIR' ? VISION_RADIUS * 0.7 : VISION_RADIUS;
  const currentItemTarget = gameState.difficulty === 'DESPAIR' ? ITEM_COUNT + 4 : ITEM_COUNT;

  // Sync ref with state for the game loop
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const startGame = (difficulty: Difficulty = 'NORMAL') => {
    const itemCount = difficulty === 'DESPAIR' ? ITEM_COUNT + 4 : ITEM_COUNT;
    const relics = Array.from({ length: itemCount }, (_, i) => getRandomItem(`relic-${i}`, 'RELIC'));
    const utilities = Array.from({ length: 4 }, (_, i) => getRandomItem(`utility-${i}`, 'HOLY_WATER'));
    
    setGameState({
      playerPos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      monsterPos: { x: 100, y: 100 },
      isCaught: false,
      score: 0,
      scareLevel: 0,
      gameStarted: true,
      items: [...relics, ...utilities],
      inventory: [],
      monsterStunnedUntil: 0,
      difficulty,
      showGallery: false,
      floor: 0,
      staircasePos: null,
      mansionEscaped: false,
    });
  };

  const startFromFloor2 = (difficulty: Difficulty = 'NORMAL') => {
    setGameState({
      playerPos: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
      monsterPos: { x: 100, y: 100 },
      isCaught: false,
      score: 0,
      scareLevel: 0,
      gameStarted: true,
      items: [],
      inventory: [],
      monsterStunnedUntil: 0,
      difficulty,
      showGallery: false,
      floor: 1,
      staircasePos: null,
      mansionEscaped: false,
    });
  };

  const useItem = useCallback((type: ItemType) => {
    setGameState(prev => {
      if (!prev.inventory.includes(type)) return prev;
      
      const newInventory = [...prev.inventory];
      const index = newInventory.indexOf(type);
      newInventory.splice(index, 1);
      
      let monsterStunnedUntil = prev.monsterStunnedUntil;
      if (type === 'HOLY_WATER') {
        monsterStunnedUntil = Date.now() + 3000; // Stun for 3 seconds
      }
      
      return {
        ...prev,
        inventory: newInventory,
        monsterStunnedUntil
      };
    });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: true }));
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }));
  }, []);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === '1') useItem('HOLY_WATER');
    };
    window.addEventListener('keydown', handleKeys);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeys);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, useItem]);

  // Handle virtual joystick in game loop
  const update = useCallback(() => {
    if (!gameStateRef.current.gameStarted || gameStateRef.current.isCaught) return;

    const { playerPos, monsterPos, items, score, monsterStunnedUntil, inventory, difficulty, floor, staircasePos } = gameStateRef.current;

    if (floor !== 0) return; // Handled by 3D component or simply paused 2D state

    const stunned = Date.now() < monsterStunnedUntil;

    // Movement
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    // Mobile joystick overlay
    if (isMobile) {
      dx = virtualJoystick.current.x;
      dy = virtualJoystick.current.y;
    }

    // Normalize movement
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0.1) {
      dx /= length;
      dy /= length;
    } else if (isMobile && length <= 0.1) {
      dx = 0;
      dy = 0;
    }

    const nextPlayerPos = {
      x: Math.max(0, Math.min(WORLD_SIZE, playerPos.x + dx * PLAYER_SPEED)),
      y: Math.max(0, Math.min(WORLD_SIZE, playerPos.y + dy * PLAYER_SPEED)),
    };

    // Monster AI
    const mDx = nextPlayerPos.x - monsterPos.x;
    const mDy = nextPlayerPos.y - monsterPos.y;
    const mDist = Math.sqrt(mDx * mDx + mDy * mDy);
    
    // Monster speed increases as game progresses
    const difficultyMultiplier = difficulty === 'DESPAIR' ? 1.5 : 1;
    const monsterSpeed = stunned ? 0 : (MONSTER_BASE_SPEED * difficultyMultiplier) + (score * 0.3);
    
    const nextMonsterPos = stunned ? monsterPos : {
      x: monsterPos.x + (mDx / mDist) * monsterSpeed,
      y: monsterPos.y + (mDy / mDist) * monsterSpeed,
    };

    // Collision Check
    const distToMonster = Math.sqrt(
      Math.pow(nextPlayerPos.x - nextMonsterPos.x, 2) + 
      Math.pow(nextPlayerPos.y - nextMonsterPos.y, 2)
    );

    // Scare level based on distance
    const scareLevel = Math.max(0, 1 - distToMonster / 800);

    // Item Collection
    const collectedItems: Item[] = [];
    const remainingItems = items.filter(item => {
      const dist = Math.sqrt(Math.pow(nextPlayerPos.x - item.x, 2) + Math.pow(nextPlayerPos.y - item.y, 2));
      if (dist <= 40) {
        collectedItems.push(item);
        return false;
      }
      return true;
    });

    const newScore = score + collectedItems.filter(i => i.type === 'RELIC').length;
    const newInventory = [...inventory, ...collectedItems.filter(i => i.type !== 'RELIC').map(i => i.type)];
    const relicTarget = difficulty === 'DESPAIR' ? ITEM_COUNT + 4 : ITEM_COUNT;

    // Staircase Logic
    let newStaircasePos = staircasePos;
    if (newScore >= relicTarget && !staircasePos) {
      newStaircasePos = getRandomPoint(500); 
    }

    const distToStaircase = newStaircasePos ? Math.sqrt(Math.pow(nextPlayerPos.x - newStaircasePos.x, 2) + Math.pow(nextPlayerPos.y - newStaircasePos.y, 2)) : Infinity;

    if (distToMonster < 40) {
      setGameState(prev => ({ ...prev, isCaught: true, scareLevel: 1 }));
    } else if (distToStaircase < 100) {
      // Transition to floor 1 (3D)
      setGameState(prev => ({ 
        ...prev, 
        floor: 1, 
        playerPos: nextPlayerPos,
        scareLevel: 0 
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        playerPos: nextPlayerPos,
        monsterPos: nextMonsterPos,
        items: remainingItems,
        score: newScore,
        inventory: newInventory,
        scareLevel,
        staircasePos: newStaircasePos,
      }));
    }

    requestRef.current = requestAnimationFrame(update);
  }, [keys]);

  useEffect(() => {
    if (gameState.gameStarted && !gameState.isCaught) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState.gameStarted, gameState.isCaught, update]);

  return (
    <div className="relative w-full h-screen bg-bg overflow-hidden font-sans text-ink cursor-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(circle_at_70%_30%,_#1a0505_0%,_transparent_70%),_radial-gradient(circle_at_20%_80%,_#000_0%,_#050505_100%)]" />
        <div className="absolute inset-0 bg-noise animate-noise opacity-5" />
      </div>

      <AnimatePresence mode="wait">
        {gameState.floor === 1 ? (
          <motion.div
            key="mansion-3d"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60]"
          >
            <Mansion3D 
              difficulty={gameState.difficulty}
              monsterStunnedUntil={gameState.monsterStunnedUntil}
              onExit={() => setGameState(prev => ({ ...prev, floor: 0 }))}
              onWin={() => setGameState(prev => ({ ...prev, mansionEscaped: true, floor: 0 }))} 
              onCaught={() => setGameState(prev => ({ ...prev, isCaught: true, floor: 0 }))}
            />
          </motion.div>
        ) : !gameState.gameStarted ? (
          <motion.div 
            key="start-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col justify-between p-6 md:p-16 bg-bg/95 backdrop-blur-sm"
          >
            <header className="relative">
              <div className="relative">
                <motion.h1 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 0.9 }}
                  className="font-serif text-[40px] sm:text-[80px] md:text-[140px] leading-[0.9] tracking-[-2px] md:tracking-[-4px] uppercase filter drop-shadow-[4px_0_0_rgba(157,0,0,0.4)]"
                >
                  呪いの森
                </motion.h1>
                <motion.p 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 0.8 }}
                  transition={{ delay: 0.2 }}
                  className="font-serif italic text-sm md:text-2xl text-accent -mt-1 md:-mt-2 ml-1 md:ml-2 tracking-[1px] md:tracking-[2px]"
                >
                  THE CURSED FOREST
                </motion.p>
              </div>

              <nav className="mt-8 md:mt-20 flex flex-col gap-2 md:gap-4">
                <button 
                  onClick={() => startGame('NORMAL')}
                  className="flex items-center group text-left py-2"
                >
                  <div className="w-0 group-hover:w-10 h-[1px] bg-accent mr-0 group-hover:mr-5 transition-all duration-300 shadow-[0_0_10px_#9d0000]" />
                  <span className="font-serif text-sm md:text-xl uppercase tracking-[2px] md:tracking-[4px] text-ink/50 group-hover:text-ink transition-colors">
                    探索を開始する
                  </span>
                </button>
                <button 
                  onClick={() => startFromFloor2('NORMAL')}
                  className="flex items-center group text-left py-2"
                >
                  <div className="w-0 group-hover:w-10 h-[1px] bg-accent mr-0 group-hover:mr-5 transition-all duration-300 shadow-[0_0_10px_#9d0000]" />
                  <span className="font-serif text-sm md:text-xl uppercase tracking-[2px] md:tracking-[4px] text-ink/50 group-hover:text-ink transition-colors">
                    2階から開始する
                  </span>
                </button>
                <button 
                  onClick={() => startGame('DESPAIR')}
                  className="flex items-center group text-left py-2"
                >
                  <div className="w-0 group-hover:w-10 h-[1px] bg-accent mr-0 group-hover:mr-5 transition-all duration-300 shadow-[0_0_10px_#9d0000]" />
                  <span className="font-serif text-sm md:text-xl uppercase tracking-[2px] md:tracking-[4px] text-accent/30 group-hover:text-accent transition-colors">
                    絶望モード
                  </span>
                </button>
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, showGallery: true }))}
                  className="flex items-center group text-left py-2"
                >
                  <div className="w-0 group-hover:w-10 h-[1px] bg-accent mr-0 group-hover:mr-5 transition-all duration-300 shadow-[0_0_10px_#9d0000]" />
                  <span className="font-serif text-sm md:text-xl uppercase tracking-[2px] md:tracking-[4px] text-ink/50 group-hover:text-ink transition-colors">
                    記憶の断片
                  </span>
                </button>
              </nav>
            </header>

            <div className="absolute right-16 bottom-[180px] w-[300px] border-l border-ink/10 pl-6 hidden md:block">
              <div className="text-[10px] uppercase tracking-[2px] text-accent font-bold mb-2">Current Objective</div>
              <div className="text-sm leading-relaxed text-ink/60 font-serif">
                森の深淵に散らばる遺物を集めろ。霧の中に潜む「それ」に見つかってはならない。
              </div>
            </div>

            <footer className="flex justify-between items-end text-[11px] text-ink/30 uppercase tracking-[1px]">
              <div>&copy; 2026 OBSCURA HORROR. ALL RIGHTS RESERVED.</div>
              <div className="bg-accent/10 border border-accent/30 px-3 py-1 text-accent rounded-sm">
                BUILD ver. 1.0.2-ALPHA
              </div>
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Gallery / Story Modal */}
      <AnimatePresence>
        {gameState.showGallery && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-bg/98 backdrop-blur-md flex items-center justify-center p-8"
          >
            <div className="max-w-2xl w-full">
               <div className="flex justify-between items-start mb-12">
                  <h2 className="font-serif text-6xl uppercase tracking-tighter text-ink">記憶の断片</h2>
                  <button onClick={() => setGameState(prev => ({ ...prev, showGallery: false }))} className="p-4 hover:bg-ink/5 border border-ink/10 text-ink">
                    <X size={24} />
                  </button>
               </div>
               <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-6 custom-scrollbar text-ink">
                  {[
                    { title: "森の囁き", text: "この森に入った者は、自らの罪が形となって現れるという。かつてここで遭難した探検家たちは、何日も同じ場所を歩き続け、最後には笑いながら消えていった。" },
                    { title: "遺骸の頭蓋", text: "森に散らばるドクロは、過去に迷い込んだ人々の最後の名残だ。これらをすべて清めない限り、森の呪縛から逃れることはできない。" },
                    { title: "それについて", text: "霧の中から現れる巨大な顔。それは死そのものではなく、この森が作り出した、永遠に終わらない悪夢の具現化である。聖なる水だけが、一時的にその歩みを止めることができる。" }
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="group"
                    >
                      <h3 className="font-serif text-xl text-accent mb-2 uppercase tracking-widest flex items-center gap-3">
                        <BookOpen size={16} /> {item.title}
                      </h3>
                      <p className="font-serif text-ink/60 leading-relaxed italic">
                        {item.text}
                      </p>
                    </motion.div>
                  ))}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game World Container */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          transform: `translate(${-gameState.playerPos.x + window.innerWidth / 2}px, ${-gameState.playerPos.y + window.innerHeight / 2}px)`,
        }}
      >
        {/* Ground */}
        <div 
          className="absolute border border-accent/5" 
          style={{ width: WORLD_SIZE, height: WORLD_SIZE, background: 'radial-gradient(circle at center, #080808, #000)' }}
        >
          {/* Sparse Trees */}
          {Array.from({ length: 100 }).map((_, i) => (
            <div 
              key={`tree-${i}`}
              className="absolute w-12 h-40 bg-gradient-to-t from-zinc-950 to-transparent opacity-20 rounded-full"
              style={{ left: (i * 1373) % WORLD_SIZE, top: (i * 2411) % WORLD_SIZE }}
            />
          ))}
        </div>

        {/* Items to collect */}
        {gameState.items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ scale: 0 }}
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.4, 0.8, 0.4],
            }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute z-20"
            style={{ left: item.x, top: item.y }}
          >
            {item.type === 'RELIC' ? (
              <Skull className="text-accent w-6 h-6 filter drop-shadow(0 0 10px rgba(157, 0, 0, 0.5))" />
            ) : (
              <FlaskConical className="text-blue-500 w-6 h-6 filter drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))" />
            )}
          </motion.div>
        ))}

        {/* Staircase */}
        {gameState.staircasePos && (
           <div 
             className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer"
             style={{ left: gameState.staircasePos.x, top: gameState.staircasePos.y }}
           >
             {/* Light Beam / Beacon */}
             <motion.div 
               animate={{ 
                 opacity: [0.1, 0.3, 0.1],
                 scaleX: [1, 1.2, 1]
               }}
               transition={{ repeat: Infinity, duration: 2 }}
               className="absolute bottom-10 w-32 h-[1000px] bg-gradient-to-t from-white/20 to-transparent blur-3xl -z-10"
             />
             
             <div className="relative group">
               <div className="w-16 h-20 bg-gradient-to-t from-zinc-950 to-zinc-900 border-2 border-white/50 rounded-t-lg overflow-hidden relative shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                  {/* Stairs silhouette */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="h-4 border-b border-white/10 bg-zinc-900/50" 
                      style={{ marginTop: i === 0 ? '4px' : 0 }} 
                    />
                  ))}
                  <div className="absolute inset-0 bg-white/10 animate-pulse" />
               </div>
               <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-black px-3 py-1 font-serif text-[10px] font-bold uppercase tracking-[2px] whitespace-nowrap opacity-100 shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                 2階への入口
               </div>
               <div className="absolute inset-x-0 -bottom-2 h-4 bg-white/20 blur-xl" />
               <div className="absolute inset-0 bg-white/10 blur-2xl -z-10 animate-pulse" />
             </div>
           </div>
        )}

        {/* Monster */}
        <motion.div
          animate={{
            x: gameState.monsterPos.x,
            y: gameState.monsterPos.y,
            scale: 1 + gameState.scareLevel * 0.3,
          }}
          className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative">
             {isStunned && (
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                 className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 text-blue-400 font-bold text-xs uppercase tracking-widest whitespace-nowrap"
               >
                 <Zap size={14} fill="currentColor" /> STUNNED <Zap size={14} fill="currentColor" />
               </motion.div>
             )}
             <div className={`w-56 h-56 bg-black rounded-full flex flex-col items-center justify-center border-2 ${isStunned ? 'border-blue-900/50' : 'border-accent/20'} overflow-hidden shadow-[0_0_100px_rgba(157,0,0,0.1)] transition-colors duration-500`}>
                <div className="flex gap-16 mt-4">
                  <div className="w-12 h-12 bg-zinc-950 rounded-full flex items-center justify-center overflow-hidden">
                    <div className={`w-4 h-4 rounded-full animate-ping ${isStunned ? 'bg-blue-600' : 'bg-accent/80'}`} />
                  </div>
                  <div className="w-12 h-12 bg-zinc-950 rounded-full flex items-center justify-center overflow-hidden">
                    <div className={`w-4 h-4 rounded-full animate-ping ${isStunned ? 'bg-blue-600' : 'bg-accent/80'}`} />
                  </div>
                </div>
                <div className="mt-10 w-28 h-12 bg-black rounded-b-full overflow-hidden border-t-2 border-accent/40">
                   <div className="w-full h-full flex items-center justify-around px-2 pt-1 opacity-50">
                     {Array.from({length: 8}).map((_,i) => (
                        <div key={i} className="w-2 h-4 bg-zinc-900" />
                     ))}
                   </div>
                </div>
             </div>
             <div className={`absolute inset-0 ${isStunned ? 'bg-blue-900/20' : 'bg-accent/10'} blur-3xl -z-10 animate-pulse`} />
          </div>
        </motion.div>
      </div>

      {/* Lighting / Flashlight Layer */}
      <div 
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle ${currentVisionRadius}px at 50% 50%, transparent 40%, rgba(0,0,0,0.98) 90%, black 100%)`
        }}
      />

      {/* HUD */}
      <div className="absolute top-6 left-6 md:top-12 md:left-12 z-40 max-w-[calc(100%-48px)]">
        <div className="bg-bg/60 backdrop-blur-xl border border-ink/5 p-4 md:p-6 min-w-[150px] md:min-w-[200px]">
          <div className="text-[8px] md:text-[10px] text-accent uppercase tracking-[1px] md:tracking-[2px] font-bold mb-1 md:mb-2">Relics Recovered</div>
          <div className="flex items-baseline gap-1 md:gap-2">
            <span className="text-3xl md:text-5xl font-serif font-black text-ink">{gameState.score}</span>
            <span className="text-sm md:text-xl font-serif italic text-ink/30">of {currentItemTarget}</span>
          </div>
          <div className="mt-2 md:mt-4 h-0.5 md:h-1 w-full bg-ink/10">
            <motion.div 
              className="h-full bg-accent shadow-[0_0_10px_#9d0000]"
              initial={{ width: 0 }}
              animate={{ width: `${(gameState.score / currentItemTarget) * 100}%` }}
            />
          </div>
          {gameState.difficulty === 'DESPAIR' && (
             <div className="mt-2 md:mt-4 text-[8px] md:text-[10px] text-accent font-bold uppercase tracking-widest animate-pulse">
               DESPAIR ACTIVE
             </div>
          )}
          {gameState.staircasePos && (
             <motion.div 
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               className="mt-4 md:mt-6 p-3 md:p-4 border border-white/20 bg-white/5 flex flex-col gap-1 md:gap-2 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
             >
               <div className="flex items-center gap-2 md:gap-3">
                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white animate-ping rounded-full" />
                 <div className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-[1px] md:tracking-[2px]">
                   2階への道が開かれた
                 </div>
               </div>
             </motion.div>
          )}
        </div>
      </div>

      {/* Navigation Arrow to Staircase */}
      <AnimatePresence>
        {gameState.staircasePos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            style={{ 
              width: VISION_RADIUS * 1.5,
              height: VISION_RADIUS * 1.5,
            }}
          >
            <div 
              className="absolute top-1/2 left-1/2 w-full h-full"
              style={{
                transform: `translate(-50%, -50%) rotate(${Math.atan2(gameState.staircasePos.y - gameState.playerPos.y, gameState.staircasePos.x - gameState.playerPos.x)}rad)`
              }}
            >
              <motion.div 
                animate={{ x: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute right-0 top-1/2 -translate-y-1/2"
              >
                <div className="w-8 h-8 border-t-2 border-r-2 border-white/40 rotate-45" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-[2px] bg-white/20" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MiniMap */}
      <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 z-40 scale-75 md:scale-100 origin-bottom-left">
        <div className="bg-bg/60 backdrop-blur-xl border border-ink/10 p-2 w-48 h-48 relative overflow-hidden">
          <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />
          <div className="text-[8px] text-accent uppercase tracking-[1px] font-bold mb-1 absolute top-1 left-2 z-10">Forest Survey</div>
          
          {/* Map Grid */}
          <div className="absolute inset-0 border border-ink/5 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
            {Array.from({length: 16}).map((_, i) => <div key={i} className="border border-ink/5" />)}
          </div>

          {/* Map Content (Scaled WORLD_SIZE to map size) */}
          <div className="relative w-full h-full">
            {/* Player Marker on Map */}
            <motion.div 
              key="map-player"
              className="absolute w-2 h-2 bg-ink rounded-full z-20 shadow-[0_0_5px_#fff]"
              style={{ 
                left: `${(gameState.playerPos.x / WORLD_SIZE) * 100}%`, 
                top: `${(gameState.playerPos.y / WORLD_SIZE) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            />

            {/* Item Markers on Map */}
            {gameState.items.map((item) => (
              <div 
                key={`map-item-${item.id}`}
                className={`absolute w-1.5 h-1.5 rounded-full z-10 animate-pulse ${item.type === 'RELIC' ? 'bg-accent' : 'bg-blue-500'}`}
                style={{ 
                  left: `${(item.x / WORLD_SIZE) * 100}%`, 
                  top: `${(item.y / WORLD_SIZE) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}

            {/* Staircase Marker on Map */}
            {gameState.staircasePos && (
              <motion.div 
                key="map-staircase"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute w-3 h-3 bg-white rounded-sm z-15 shadow-[0_0_10px_#fff]"
                style={{ 
                  left: `${(gameState.staircasePos.x / WORLD_SIZE) * 100}%`, 
                  top: `${(gameState.staircasePos.y / WORLD_SIZE) * 100}%`,
                  transform: 'translate(-50%, -50%) rotate(45deg)'
                }}
              >
                 <div className="absolute inset-0 bg-white blur-sm rounded-sm" />
              </motion.div>
            )}

            {/* Monster Marker on Map */}
            <motion.div 
              key="map-monster"
              animate={{ 
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.5, 1]
              }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute w-3 h-3 bg-red-600 rounded-full z-15 shadow-[0_0_10px_#f00]"
              style={{ 
                left: `${(gameState.monsterPos.x / WORLD_SIZE) * 100}%`, 
                top: `${(gameState.monsterPos.y / WORLD_SIZE) * 100}%`,
                transform: 'translate(-50%, -50%)'
              }}
            >
               <div className="absolute inset-0 bg-red-500 blur-sm rounded-full" />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 z-40 flex flex-col gap-4 items-end">
        {isMobile && gameState.floor === 0 && (
          <div className="flex flex-col gap-4 items-end">
             {/* Joystick for Floor 0 */}
             <div 
               className="w-32 h-32 rounded-full border-2 border-white/10 bg-black/20 flex items-center justify-center touch-none mb-10 mr-10"
               onTouchMove={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const centerX = rect.left + rect.width / 2;
                 const centerY = rect.top + rect.height / 2;
                 const touch = e.touches[0];
                 const x = (touch.clientX - centerX) / (rect.width / 2);
                 const y = (touch.clientY - centerY) / (rect.height / 2);
                 const mag = Math.sqrt(x*x + y*y);
                 virtualJoystick.current = { 
                   x: mag > 1 ? x/mag : x, 
                   y: mag > 1 ? y/mag : y 
                 };
               }}
               onTouchEnd={() => {
                 virtualJoystick.current = { x: 0, y: 0 };
               }}
             >
               <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40" />
             </div>
          </div>
        )}

        <div className="bg-bg/60 backdrop-blur-xl border border-ink/5 p-3 md:p-4 min-w-[120px] md:min-w-[150px]">
           <div className="text-[8px] md:text-[10px] text-accent font-bold uppercase tracking-[1px] md:tracking-[2px] mb-2 md:mb-3">Inventory</div>
           <div className="flex gap-2">
              <button 
                onClick={() => useItem('HOLY_WATER')}
                disabled={!gameState.inventory.includes('HOLY_WATER')}
                className={`p-2 border transition-all ${gameState.inventory.includes('HOLY_WATER') ? 'border-blue-500 bg-blue-500/10 active:scale-95' : 'border-ink/10 opacity-30'} relative group`}
              >
                <FlaskConical size={18} className={gameState.inventory.includes('HOLY_WATER') ? 'text-blue-400' : 'text-ink'} />
                <div className="absolute -top-1 -right-1 bg-blue-600 text-[8px] md:text-[10px] px-1 rounded-sm text-white">
                  {gameState.inventory.filter(i => i === 'HOLY_WATER').length}
                </div>
                {!isMobile && (
                  <div className="absolute bottom-full right-0 mb-2 whitespace-nowrap bg-black text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    [1] Use Holy Water
                  </div>
                )}
              </button>
           </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 md:top-12 md:right-12 z-40 flex items-center gap-3 md:gap-6">
        <div className="flex flex-col items-end">
          <div className="text-[7px] md:text-[9px] uppercase tracking-[2px] md:tracking-[3px] text-ink/40 mb-1">Stability</div>
          <div className="flex gap-1">
            {Array.from({length: 5}).map((_, i) => (
              <div 
                key={i} 
                className={`w-3 h-1 md:w-4 md:h-1 transition-colors duration-500 ${gameState.scareLevel > (0.8 - i * 0.2) ? 'bg-accent' : 'bg-ink/10'}`} 
              />
            ))}
          </div>
        </div>
        <button 
          onClick={() => setMuted(!muted)}
          className="p-3 md:p-4 rounded-sm bg-ink/5 hover:bg-ink/10 border border-ink/10 transition-colors"
        >
          {muted ? <VolumeX size={16} className="text-accent" /> : <Volume2 size={16} className="text-ink/60" />}
        </button>
      </div>

      {/* Jumpscare / Game Over */}
      <AnimatePresence mode="wait">
        {gameState.isCaught ? (
          <motion.div 
            key="game-over-caught"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-bg flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
               animate={{ 
                 scale: [1, 1.2, 0.9, 1.1, 1],
                 filter: ["blur(0px)", "blur(10px)", "blur(0px)"]
               }}
               transition={{ duration: 0.1, repeat: 5 }}
               className="mb-12"
            >
               <div className="w-96 h-96 bg-zinc-950 rounded-full border-4 border-accent flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_150px_rgba(157,0,0,0.3)]">
                  <div className="flex gap-24">
                     <div className="w-20 h-20 bg-accent rounded-full shadow-[0_0_80px_rgba(157,0,0,0.8)]" />
                     <div className="w-20 h-20 bg-accent rounded-full shadow-[0_0_80px_rgba(157,0,0,0.8)]" />
                  </div>
                  <div className="mt-16 w-64 h-16 bg-black rounded-b-full border-t border-accent flex items-end justify-center pb-3">
                    <div className="flex gap-1">
                       {Array.from({length: 16}).map((_,i) => (
                         <div key={i} className="w-2 h-8 bg-ink/80 rounded-sm" />
                       ))}
                    </div>
                  </div>
               </div>
            </motion.div>

            <h2 className="font-serif text-[120px] leading-none font-black text-accent tracking-[-6px] uppercase mb-4 filter drop-shadow-[0_0_30px_rgba(157,0,0,0.3)]">
              終焉
            </h2>
            <p className="font-serif italic text-2xl text-ink/40 mb-16">THE ESCAPE FAILED. THE FOREST BENDS FOR NO ONE.</p>
            
            <button 
              onClick={() => setGameState(prev => ({ ...prev, gameStarted: false, isCaught: false }))}
              className="flex items-center gap-4 px-12 py-6 border border-accent hover:bg-accent transition-all group"
            >
              <RefreshCcw className="group-hover:rotate-180 transition-transform duration-500 text-accent group-hover:text-ink" />
              <span className="font-serif text-xl uppercase tracking-[4px] text-accent group-hover:text-ink italic">輪廻の始まり</span>
            </button>
          </motion.div>
        ) : gameState.mansionEscaped ? (
           <motion.div 
            key="game-over-win"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-ink text-bg flex flex-col items-center justify-center p-8 text-center"
          >
            <h2 className="font-serif text-[140px] leading-none font-black tracking-[-8px] uppercase mb-4">生存</h2>
            <p className="font-serif italic text-3xl text-bg/60 mb-20 tracking-wider">THE CURSE IS BROKEN. FOR NOW.</p>
            
            <button 
              onClick={() => setGameState(prev => ({ ...prev, gameStarted: false, isCaught: false }))}
              className="px-16 py-8 bg-bg text-ink border border-bg hover:bg-zinc-800 transition-colors"
            >
              <span className="font-serif text-2xl uppercase tracking-[6px] italic">現世へ戻る</span>
            </button>
            <div className="mt-20 text-[10px] uppercase tracking-[4px] opacity-20 font-bold">
              CONGRATULATIONS PERFORMER. YOU HAVE BESTED THE FOREST.
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style>{`
        .bg-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        @keyframes noise {
          0% { transform: translate(0,0) }
          10% { transform: translate(-5%,-5%) }
          20% { transform: translate(-10%,5%) }
          30% { transform: translate(5%,-10%) }
          40% { transform: translate(-5%,15%) }
          50% { transform: translate(-10%,5%) }
          60% { transform: translate(15%,0) }
          70% { transform: translate(0,10%) }
          80% { transform: translate(-15%,0) }
          90% { transform: translate(10%,5%) }
          100% { transform: translate(5%,0) }
        }
        .animate-noise {
          animation: noise 0.2s infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(240, 240, 240, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #9d0000;
        }
      `}</style>
    </div>
  );
}
