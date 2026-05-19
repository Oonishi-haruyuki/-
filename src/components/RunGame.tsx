import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Zap, Skull } from 'lucide-react';

interface RunGameProps {
  onExit: () => void;
}

export const RunGame = ({ onExit }: RunGameProps) => {
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(8);
  const [isGameOver, setIsGameOver] = useState(false);
  const [monsterDist, setMonsterDist] = useState(400); // Distance of monster behind player
  const [obstacles, setObstacles] = useState<{ id: number; x: number; type: 'TRAP' | 'SPEED' }[]>([]);
  const requestRef = useRef<number>(null);
  const lastTime = useRef<number>(0);
  const speedRef = useRef(8);
  const monsterDistRef = useRef(400);
  
  // Game loop
  const update = useCallback((time: number) => {
    if (isGameOver) return;
    
    if (lastTime.current === 0) {
      lastTime.current = time;
    }
    
    const deltaTime = (time - lastTime.current) / 1000;
    lastTime.current = time;

    // Player moves forward
    setDistance(prev => prev + speedRef.current * 10);
    
    // Monster catches up
    const catchUpSpeed = 1.2 + (distance / 5000); // Monster slowly gets faster
    monsterDistRef.current -= (catchUpSpeed - 1) * 20 * deltaTime;
    setMonsterDist(monsterDistRef.current);

    // Collision check
    if (monsterDistRef.current <= 0) {
      setIsGameOver(true);
    }

    // Move obstacles
    setObstacles(prev => {
       const next = prev.filter(o => o.x > -100).map(o => ({ ...o, x: o.x - speedRef.current * 10 * deltaTime * 10 }));
       if (Math.random() < 0.05 && (next.length === 0 || next[next.length-1].x < 800)) {
         next.push({ id: Date.now(), x: 1000, type: Math.random() < 0.8 ? 'TRAP' : 'SPEED' });
       }
       return next;
    });

    requestRef.current = requestAnimationFrame(update);
  }, [isGameOver, distance]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  const handleJump = () => {
    // In this mini-game, maybe we use keys or click to evade
  };

  const handleObstacle = (type: 'TRAP' | 'SPEED') => {
    if (type === 'TRAP') {
      speedRef.current = Math.max(4, speedRef.current - 2);
      monsterDistRef.current -= 50;
    } else {
      speedRef.current = Math.min(15, speedRef.current + 2);
      monsterDistRef.current += 30;
    }
    setSpeed(speedRef.current);
  };

  return (
    <div className="absolute inset-0 bg-black z-[1000] overflow-hidden flex flex-col items-center justify-center font-mono">
      <div className="absolute top-10 left-10 text-accent font-bold tracking-widest">
        RUN FOR YOUR LIFE
        <div className="text-white text-4xl mt-2">{Math.floor(distance)}m</div>
      </div>

      <div className="relative w-full h-96 border-y border-white/10 flex items-center overflow-hidden">
        {/* Ground */}
        <div className="absolute bottom-0 w-full h-1 bg-white/20" />
        
        {/* Monster Indicator */}
        <div 
          className="absolute left-0 bottom-10 flex flex-col items-center transition-all duration-300"
          style={{ transform: `scale(${1 + (400 - monsterDist) / 400})`, opacity: (400 - monsterDist) / 200 }}
        >
          <Skull className="text-accent animate-pulse" size={60 + (400 - monsterDist)/4} />
          <div className="text-[10px] text-accent mt-2 font-bold">CLOSE</div>
        </div>

        {/* Player Placeholder */}
        <div className="absolute left-40 bottom-10">
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 0.3 }}
            className="w-8 h-16 bg-white/80 border border-white"
          />
        </div>

        {/* Obstacles */}
        {obstacles.map(o => (
          <div 
            key={o.id}
            className={`absolute bottom-10 w-10 h-10 border flex items-center justify-center transition-all ${o.type === 'TRAP' ? 'border-red-500 bg-red-500/20' : 'border-blue-500 bg-blue-500/20'}`}
            style={{ left: `${o.x}px` }}
            onClick={() => handleObstacle(o.type)}
          >
            {o.type === 'TRAP' ? <AlertCircle className="text-red-500" /> : <Zap className="text-blue-500" />}
          </div>
        ))}
      </div>

      <div className="mt-10 text-white/40 text-[10px] uppercase tracking-widest">
        TAP THE BLUE ORBS TO SPEED UP | AVOID RED ORBS
      </div>

      <AnimatePresence>
        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/90 z-10 flex flex-col items-center justify-center text-center p-10"
          >
             <h2 className="text-accent text-6xl font-black mb-4">CAUGHT</h2>
             <p className="text-white/60 mb-8">You survived for {Math.floor(distance)} meters before the darkness took you.</p>
             <button 
                onClick={onExit}
                className="px-10 py-4 border border-white hover:bg-white hover:text-black transition-all"
             >
                RETURN
             </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
