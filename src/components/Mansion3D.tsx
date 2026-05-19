import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PointerLockControls, Stars, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Ghost, Skull, BookOpen } from 'lucide-react';

interface Mansion3DProps {
  difficulty: 'NORMAL' | 'DESPAIR';
  monsterStunnedUntil: number;
  onExit: () => void;
  onWin: () => void;
  onCaught: () => void;
}

const Wall = ({ position, rotation, scale = [10, 10, 1] }: { position: [number, number, number], rotation: [number, number, number], scale?: [number, number, number] }) => (
  <mesh position={position} rotation={rotation}>
    <boxGeometry args={scale as any} />
    <meshStandardMaterial color="#080808" roughness={0.9} metalness={0.1} />
  </mesh>
);

const MemoryFragment = ({ position, onPick }: { position: [number, number, number], onPick: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timer = useMemo(() => new THREE.Timer(), []);
  
  useFrame((state) => {
    if (meshRef.current) {
      timer.update();
      meshRef.current.rotation.y += 0.02;
      meshRef.current.position.y = position[1] + Math.sin(timer.getElapsed() * 2) * 0.2;
      
      // Pickup logic (distance check)
      const dist = state.camera.position.distanceTo(new THREE.Vector3(...position));
      if (dist < 1.8) {
        onPick();
      }
    }
  });

  return (
    <group position={position}>
      <Float speed={5} rotationIntensity={2} floatIntensity={2}>
        <mesh ref={meshRef}>
          <octahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#4db8ff" emissive="#4db8ff" emissiveIntensity={5} />
        </mesh>
      </Float>
      
      {/* Light Beam */}
      <mesh position={[0, 10, 0]}>
        <cylinderGeometry args={[0.05, 0.2, 20]} />
        <meshBasicMaterial color="#4db8ff" transparent opacity={0.3} />
      </mesh>
      
      <pointLight color="#4db8ff" intensity={3} distance={8} />
    </group>
  );
};

const Monster3D = ({ onCaught, collected, stunnedUntil }: { onCaught: () => void, collected: number, stunnedUntil: number }) => {
  const meshRef = useRef<THREE.Group>(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState(new THREE.Vector3(0, 0, -50));

  useFrame((state) => {
    const playerPos = state.camera.position;
    const isStunned = Date.now() < stunnedUntil;
    
    if (!active && Math.random() < 0.008) {
      setActive(true);
      const angle = Math.random() * Math.PI * 2;
      const spawnPos = new THREE.Vector3(
        playerPos.x + Math.cos(angle) * 20,
        1,
        playerPos.z + Math.sin(angle) * 20
      );
      if (meshRef.current) meshRef.current.position.copy(spawnPos);
      else setPos(spawnPos);
    }

    if (active && meshRef.current) {
      meshRef.current.lookAt(playerPos);
      const dir = new THREE.Vector3().subVectors(playerPos, meshRef.current.position).normalize();
      
      const speedScale = 1 + (collected * 0.1);
      
      if (!isStunned) {
        meshRef.current.position.addScaledVector(dir, 0.05 * speedScale);
      }

      window.dispatchEvent(new CustomEvent('monster-pos', { detail: meshRef.current.position.clone() }));

      const dist = meshRef.current.position.distanceTo(playerPos);
      if (dist < 1.5) {
        onCaught();
      }

      if (dist > 40) {
        setActive(false);
        window.dispatchEvent(new CustomEvent('monster-pos', { detail: null }));
      }
    }
  });

  const isStunned = Date.now() < stunnedUntil;

  return (
    <group ref={meshRef} position={pos} visible={active}>
      <mesh>
        <planeGeometry args={[2, 3]} />
        <meshBasicMaterial color={isStunned ? "#003366" : "#000"} transparent opacity={0.8} />
      </mesh>
      <pointLight color={isStunned ? "#00ffff" : "#ff0000"} intensity={active ? 2 : 0} distance={10} />
      {/* Eyes */}
      <mesh position={[-0.3, 0.5, 0.1]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={isStunned ? "#00ffff" : "#9d0000"} />
      </mesh>
      <mesh position={[0.3, 0.5, 0.1]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={isStunned ? "#00ffff" : "#9d0000"} />
      </mesh>
      {isStunned && (
        <group position={[0, 1.8, 0]}>
          <Text
            fontSize={0.3}
            color="#00ffff"
            anchorX="center"
            anchorY="middle"
          >
            STUNNED
          </Text>
        </group>
      )}
    </group>
  );
};

const PlayerTracker = () => {
  useFrame((state) => {
    window.dispatchEvent(new CustomEvent('player-pos', { detail: state.camera.position.clone() }));
  });
  return null;
};

const MapContent = ({ fragments, fragmentVisible }: { fragments: any[], fragmentVisible: boolean[] }) => {
  const [playerPos, setPlayerPos] = useState(new THREE.Vector3());
  const [monsterPos, setMonsterPos] = useState<THREE.Vector3 | null>(null);

  useEffect(() => {
    const handlePlayerPos = (e: any) => setPlayerPos(e.detail);
    const handleMonsterPos = (e: any) => setMonsterPos(e.detail);
    
    window.addEventListener('player-pos', handlePlayerPos);
    window.addEventListener('monster-pos', handleMonsterPos);
    
    return () => {
      window.removeEventListener('player-pos', handlePlayerPos);
      window.removeEventListener('monster-pos', handleMonsterPos);
    };
  }, []);

  const scale = 4; // Map scale factor

  return (
    <div className="absolute inset-0">
      {/* Grid */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      
      {/* Player */}
      <div 
        className="absolute w-2 h-2 bg-white rounded-full z-10 shadow-[0_0_10px_#fff]"
        style={{ 
          left: `calc(50% + ${playerPos.x * scale}px)`, 
          top: `calc(50% + ${playerPos.z * scale}px)`,
          transform: 'translate(-50%, -50%)' 
        }}
      />

      {/* Monster */}
      {monsterPos && (
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="absolute w-2 h-2 bg-accent rounded-full z-20 shadow-[0_0_10px_#9d0000]"
          style={{ 
            left: `calc(50% + ${monsterPos.x * scale}px)`, 
            top: `calc(50% + ${monsterPos.z * scale}px)`,
            transform: 'translate(-50%, -50%)' 
          }}
        />
      )}

      {/* Items */}
      {fragments.map((f, i) => fragmentVisible[i] && (
        <div 
          key={i}
          className="absolute w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#4db8ff]"
          style={{ 
            left: `calc(50% + ${f.pos[0] * scale}px)`, 
            top: `calc(50% + ${f.pos[2] * scale}px)`,
            transform: 'translate(-50%, -50%)' 
          }}
        />
      ))}

      {/* Basic Walls on Map */}
      <div className="absolute inset-0 opacity-20 border-[1px] border-white/20" />
    </div>
  );
};

const Movement = () => {
  const [keys] = useState<Record<string, boolean>>({});
  const virtualInput = useRef({ forward: 0, backward: 0, left: 0, right: 0 });
  const [dashState, setDashState] = useState({
    isActive: false,
    isSlowness: false,
    lastDashTime: 0,
    cooldown: 0, // seconds remaining
    gauge: 100, // 0 to 100
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Shift' && !dashState.isActive && dashState.cooldown <= 0) {
        startDash();
      }
    };
    const up = (e: KeyboardEvent) => (keys[e.key.toLowerCase()] = false);
    
    const handleDashEvent = () => {
      if (!dashState.isActive && dashState.cooldown <= 0) {
        startDash();
      }
    };

    const handleJoystick = (e: any) => {
      const { x, y } = e.detail;
      virtualInput.current.forward = y < -0.2 ? -y : 0;
      virtualInput.current.backward = y > 0.2 ? y : 0;
      virtualInput.current.left = x < -0.2 ? -x : 0;
      virtualInput.current.right = x > 0.2 ? x : 0;
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mobile-dash', handleDashEvent);
    window.addEventListener('mobile-move', handleJoystick as any);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mobile-dash', handleDashEvent);
      window.removeEventListener('mobile-move', handleJoystick as any);
    };
  }, [keys, dashState.isActive, dashState.cooldown]);

  const startDash = () => {
    setDashState(prev => ({ ...prev, isActive: true, gauge: 100 }));
    
    // Dash ends after 3s
    setTimeout(() => {
      setDashState(prev => ({ ...prev, isActive: false, isSlowness: true }));
      // Slowness ends after 2s
      setTimeout(() => {
        setDashState(prev => ({ ...prev, isSlowness: false, cooldown: 40 }));
      }, 2000);
    }, 3000);
  };

  // Cooldown and Gauge timer
  useEffect(() => {
    const interval = setInterval(() => {
      setDashState(prev => {
        if (prev.isActive) {
          return { ...prev, gauge: Math.max(0, prev.gauge - (100 / (3 * 10))) }; // Depletes over 3s (10 ticks/s)
        }
        if (prev.cooldown > 0) {
          return { ...prev, cooldown: Math.max(0, prev.cooldown - 0.1), gauge: Math.min(100, prev.gauge + (100 / (40 * 10))) }; // Refills over 40s
        }
        return prev;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Broadcast dash state for UI
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dash-state', { detail: dashState }));
  }, [dashState]);

  useFrame((state) => {
    let moveSpeed = 0.15;
    if (dashState.isActive) moveSpeed = 0.35;
    if (dashState.isSlowness) moveSpeed = 0.05;

    const direction = new THREE.Vector3();
    const frontVector = new THREE.Vector3();
    const sideVector = new THREE.Vector3();

    const forward = (keys['w'] || keys['arrowup'] ? 1 : 0) || virtualInput.current.forward;
    const backward = (keys['s'] || keys['arrowdown'] ? 1 : 0) || virtualInput.current.backward;
    const left = (keys['a'] || keys['arrowleft'] ? 1 : 0) || virtualInput.current.left;
    const right = (keys['d'] || keys['arrowright'] ? 1 : 0) || virtualInput.current.right;

    frontVector.set(0, 0, backward - forward);
    sideVector.set(left - right, 0, 0);

    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(moveSpeed)
      .applyQuaternion(state.camera.quaternion);

    state.camera.position.x += direction.x;
    state.camera.position.z += direction.z;
    state.camera.position.y = 1;
  });

  return null;
};

const MobileControls = ({ cooldown }: { cooldown: number }) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) return null;

  return (
    <>
      {/* Joystick Area */}
      <div className="fixed bottom-10 left-10 z-[100] w-32 h-32 flex items-center justify-center pointer-events-auto">
        <div 
          className="w-24 h-24 rounded-full border-2 border-white/10 bg-black/20 flex items-center justify-center touch-none"
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const touch = e.touches[0];
            const x = (touch.clientX - centerX) / (rect.width / 2);
            const y = (touch.clientY - centerY) / (rect.height / 2);
            const mag = Math.sqrt(x*x + y*y);
            const nx = mag > 1 ? x/mag : x;
            const ny = mag > 1 ? y/mag : y;
            window.dispatchEvent(new CustomEvent('mobile-move', { detail: { x: nx, y: ny } }));
          }}
          onTouchEnd={() => {
            window.dispatchEvent(new CustomEvent('mobile-move', { detail: { x: 0, y: 0 } }));
          }}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40" />
        </div>
      </div>

      {/* Dash Button */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col gap-4 items-end pointer-events-auto">
        <button 
          className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all active:scale-95 ${cooldown > 0 ? 'border-white/10 text-white/20' : 'border-accent text-accent shadow-[0_0_15px_#9d0000]'}`}
          onClick={() => window.dispatchEvent(new CustomEvent('mobile-dash'))}
        >
          <span className="text-[10px] font-bold tracking-tighter uppercase">Dash</span>
        </button>
      </div>

      {/* Look Area (Right screen) */}
      <div 
        className="fixed inset-y-0 right-0 w-1/2 z-50 touch-none"
        onTouchMove={(e) => {
          // This is handled by a separate ref in the main component to update camera orientation
          const touch = e.touches[0];
          if (!(window as any)._lastTouchLook) {
            (window as any)._lastTouchLook = { x: touch.clientX, y: touch.clientY };
            return;
          }
          const dx = touch.clientX - (window as any)._lastTouchLook.x;
          const dy = touch.clientY - (window as any)._lastTouchLook.y;
          window.dispatchEvent(new CustomEvent('mobile-look', { detail: { x: dx, y: dy } }));
          (window as any)._lastTouchLook = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={() => {
          (window as any)._lastTouchLook = null;
        }}
      />
    </>
  );
};

const TouchLookController = () => {
  useFrame((state) => {
    // We update this via event listener or global
    if ((window as any)._lookDelta) {
      const { x, y } = (window as any)._lookDelta;
      state.camera.rotation.y -= x * 0.005;
      state.camera.rotation.x -= y * 0.005;
      state.camera.rotation.x = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, state.camera.rotation.x));
      (window as any)._lookDelta = null;
    }
  });

  useEffect(() => {
    const handleLook = (e: any) => {
      (window as any)._lookDelta = e.detail;
    };
    window.addEventListener('mobile-look', handleLook);
    return () => window.removeEventListener('mobile-look', handleLook);
  }, []);

  return null;
};

export function Mansion3D({ difficulty, monsterStunnedUntil, onExit, onWin, onCaught }: Mansion3DProps) {
  const [collected, setCollected] = useState(0);
  const [dashInfo, setDashInfo] = useState({ isActive: false, isSlowness: false, cooldown: 0, gauge: 100 });
  const [monsterPos, setMonsterPos] = useState<THREE.Vector3 | null>(null);
  const target = difficulty === 'DESPAIR' ? 5 : 3;
  const playerRef = useRef<THREE.Group>(null);
  
  // Listen for dash state updates
  useEffect(() => {
    const handleDash = (e: any) => setDashInfo(e.detail);
    const handleMonsterPos = (e: any) => setMonsterPos(e.detail);
    
    window.addEventListener('dash-state', handleDash);
    window.addEventListener('monster-pos', handleMonsterPos);
    
    return () => {
      window.removeEventListener('dash-state', handleDash);
      window.removeEventListener('monster-pos', handleMonsterPos);
    };
  }, []);

  const fragments = useMemo(() => [
    { pos: [15, 1, 15] },
    { pos: [-15, 1, 5] },
    { pos: [8, 1, -12] },
    { pos: [-12, 1, -18] },
    { pos: [2, 1, 18] },
  ].slice(0, target), [target]);

  const [fragmentVisible, setFragmentVisible] = useState(fragments.map(() => true));

  const handlePick = (index: number) => {
    if (!fragmentVisible[index]) return;
    const newVisible = [...fragmentVisible];
    newVisible[index] = false;
    setFragmentVisible(newVisible);
    setCollected(prev => {
      const next = prev + 1;
      if (next >= target) {
        setTimeout(onWin, 2000);
      }
      return next;
    });
  };

  return (
    <div className="absolute inset-0 bg-black z-50 overflow-hidden touch-none">
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10 pointer-events-none max-w-[calc(100%-48px)]">
        <h2 className="font-serif text-2xl md:text-4xl text-ink uppercase tracking-[4px] md:tracking-[8px]">幽霊邸</h2>
        <p className="text-accent font-bold text-[10px] md:text-xs mt-1 md:mt-2 uppercase tracking-[2px] md:tracking-[4px]">2nd Floor: The Silent Corridor</p>
        
        <div className="mt-4 md:mt-8">
           <div className="text-[8px] md:text-[10px] text-ink/40 uppercase tracking-[1px] md:tracking-[2px] mb-1 md:mb-2 text-nowrap">Fragments of Sanity</div>
           <div className="flex gap-1 md:gap-2">
             {Array.from({ length: target }).map((_, i) => (
               <div 
                 key={i} 
                 className={`w-2 h-2 md:w-3 md:h-3 border border-accent/30 ${i < collected ? 'bg-accent shadow-[0_0_10px_#9d0000]' : 'bg-transparent'} transition-all duration-500`} 
               />
             ))}
           </div>
        </div>

        {/* Dash Gauge */}
        <div className="mt-4 md:mt-6 w-32 md:w-48">
          <div className="flex justify-between items-end mb-1">
            <div className="text-[7px] md:text-[9px] text-ink/60 uppercase tracking-[1px] md:tracking-[2px]">Sprint Engine</div>
            <div className="text-[7px] md:text-[9px] text-ink/40 font-mono">
              {dashInfo.cooldown > 0 ? `${Math.ceil(dashInfo.cooldown)}s` : 'READY'}
            </div>
          </div>
          <div className="h-0.5 md:h-1 w-full bg-white/5 border border-white/10 relative overflow-hidden">
            <motion.div 
              className={`h-full ${dashInfo.isActive ? 'bg-white shadow-[0_0_10px_#fff]' : dashInfo.isSlowness ? 'bg-red-500' : 'bg-white/40'}`}
              animate={{ width: `${dashInfo.gauge}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          {dashInfo.isSlowness && (
             <div className="mt-1 text-[7px] md:text-[8px] text-red-500/80 uppercase animate-pulse">Exhausted</div>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/20 text-[7px] md:text-[10px] uppercase tracking-[2px] md:tracking-[4px] pointer-events-none text-center hidden md:block">
        WASD to Move | Shift to Dash | Mouse to Look<br/>
        Find all memory fragments to escape this nightmare.
      </div>

      {/* 3D Scene Minimap */}
      <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 z-20 w-32 h-32 md:w-48 md:h-48 bg-black/60 border border-white/10 backdrop-blur-md p-1 md:p-2">
        <div className="relative w-full h-full border border-white/5 overflow-hidden">
           <MapContent fragments={fragments} fragmentVisible={fragmentVisible} />
        </div>
        <div className="mt-1 md:mt-2 text-[7px] md:text-[8px] text-white/30 uppercase tracking-widest text-center">
          {monsterPos ? 'Spirit Detected' : 'Spirit Searching...'}
        </div>
      </div>

      <MobileControls cooldown={dashInfo.cooldown} />

      <Canvas shadows camera={{ fov: 75 }} onPointerDown={(e) => {
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return;
      }}>
        <color attach="background" args={['#000']} />
        <fog attach="fog" args={['#000', 5, 20]} />
        
        <ambientLight intensity={0.1} />
        <PointLightWithPlayer />
        
        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#050505" roughness={1} />
        </mesh>

        {/* Walls - Simple Maze */}
        <Wall position={[0, 4, -20]} rotation={[0, 0, 0]} scale={[100, 10, 1]} />
        <Wall position={[0, 4, 20]} rotation={[0, 0, 0]} scale={[100, 10, 1]} />
        <Wall position={[-20, 4, 0]} rotation={[0, Math.PI / 2, 0]} scale={[100, 10, 1]} />
        <Wall position={[20, 4, 0]} rotation={[0, Math.PI / 2, 0]} scale={[100, 10, 1]} />
        
        {/* Interior Walls */}
        <Wall position={[0, 4, 0]} rotation={[0, 0, 0]} scale={[10, 10, 1]} />
        <Wall position={[10, 4, 10]} rotation={[0, Math.PI / 2, 0]} scale={[10, 10, 1]} />
        <Wall position={[-10, 4, -5]} rotation={[0, 0, 0]} scale={[15, 10, 1]} />

        {/* Items */}
        {fragments.map((f, i) => fragmentVisible[i] && (
          <MemoryFragment key={i} position={f.pos as any} onPick={() => handlePick(i)} />
        ))}

        <Monster3D onCaught={onCaught} collected={collected} stunnedUntil={monsterStunnedUntil} />
        <PlayerTracker />
        <Movement />
        <TouchLookController />

        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {(!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) && <PointerLockControls />}
      </Canvas>
    </div>
  );
}

function PointLightWithPlayer() {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    if (lightRef.current) {
      lightRef.current.position.copy(camera.position);
    }
  });
  return <pointLight ref={lightRef} intensity={1} distance={10} color="#fff" />;
}
