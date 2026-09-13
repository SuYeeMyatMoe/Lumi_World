import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type { AgentState } from '../shared/types/agentState';
import { LumiBody } from './LumiBody';
import { useLookAt, type MascotTarget } from './useLookAt';

interface Props {
  state: AgentState;
  target: MascotTarget | null;
  size: 'mini' | 'full';
  cursorFallback?: boolean;
  className?: string;
}

export function LumiMascot({ state, target, size, cursorFallback = true, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lookRef = useLookAt(containerRef, target, cursorFallback);
  const isMini = size === 'mini';

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <Canvas
        dpr={isMini ? [1, 1.5] : [1, 2]}
        camera={{ position: [0, 0.1, isMini ? 2.6 : 2.9], fov: isMini ? 38 : 34 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        {/* Three-point rig: key, cool fill, and a strong rim so the silhouette holds on white pages */}
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#ffffff', '#1e1b4b', 0.5]} />
        <directionalLight position={[2, 3, 2]} intensity={1.5} />
        <directionalLight position={[-2, 1, -1]} intensity={0.5} color="#a5f3fc" />
        <directionalLight position={[0, 1.2, -3]} intensity={2.4} color="#67e8f9" />
        <LumiBody state={state} lookRef={lookRef} />
      </Canvas>
    </div>
  );
}
