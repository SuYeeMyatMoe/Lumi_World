import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AgentState } from '../shared/types/agentState';
import { STATE_CONFIG } from './stateConfig';
import { LumiEyes } from './LumiEyes';
import type { LookTarget } from './useLookAt';

interface Props {
  state: AgentState;
  lookRef: React.RefObject<LookTarget | null>;
}

const RING_COUNT = 14;

export function LumiBody({ state, lookRef }: Props) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const ringRef = useRef<THREE.Group>(null);
  const bounceRef = useRef({ lastState: state, t: 0 });

  const config = STATE_CONFIG[state] ?? STATE_CONFIG.idle;
  const coreColor = useMemo(() => new THREE.Color(config.coreColor), [config.coreColor]);
  const bodyColor = useMemo(() => new THREE.Color(config.bodyColor), [config.bodyColor]);

  const ringOffsets = useMemo(
    () => Array.from({ length: RING_COUNT }, (_, i) => (i / RING_COUNT) * Math.PI * 2),
    [],
  );

  useFrame((frame, delta) => {
    const t = frame.clock.elapsedTime;
    const root = rootRef.current;
    const head = headRef.current;
    if (!root || !head) return;

    if (bounceRef.current.lastState !== state) {
      bounceRef.current.lastState = state;
      bounceRef.current.t = config.bounce ? 0.001 : 0;
    }

    // Float / breathe
    const bob = Math.sin(t * config.bobSpeed) * config.bobAmplitude;
    root.position.y = THREE.MathUtils.damp(root.position.y, bob - 0.05, 4, delta);

    // One-shot bounce for success
    let bounceScale = 1;
    if (bounceRef.current.t > 0) {
      bounceRef.current.t += delta * 5;
      const p = bounceRef.current.t;
      bounceScale = 1 + Math.sin(Math.min(p, Math.PI)) * 0.14;
      if (p >= Math.PI) bounceRef.current.t = 0;
    }
    const breathe = 1 + Math.sin(t * 1.4) * 0.015;
    root.scale.setScalar(THREE.MathUtils.damp(root.scale.x, bounceScale * breathe, 10, delta));

    // Look-at: damp the head toward the target yaw/pitch, never snap
    const look = lookRef.current;
    const targetYaw = look ? look.yaw : Math.sin(t * 0.5) * 0.08;
    const targetPitch = look ? look.pitch : Math.sin(t * 0.7) * 0.03;
    head.rotation.y = THREE.MathUtils.damp(head.rotation.y, targetYaw, 6, delta);
    head.rotation.x = THREE.MathUtils.damp(head.rotation.x, targetPitch, 6, delta);
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, -targetYaw * 0.12, 4, delta);

    // Core glow
    const core = coreMatRef.current;
    if (core) {
      const pulse = config.pulse ? 0.6 + Math.sin(t * 5) * 0.5 : 1;
      core.emissiveIntensity = THREE.MathUtils.damp(core.emissiveIntensity, config.emissive * pulse, 5, delta);
      core.emissive.lerp(coreColor, Math.min(1, delta * 4));
      core.color.lerp(coreColor, Math.min(1, delta * 4));
    }
    const body = bodyMatRef.current;
    if (body) {
      body.color.lerp(bodyColor, Math.min(1, delta * 3));
      body.emissive.lerp(coreColor, Math.min(1, delta * 3));
      body.sheenColor.lerp(coreColor, Math.min(1, delta * 3));
    }

    // Thinking ring
    const ring = ringRef.current;
    if (ring) {
      const targetScale = config.ring ? 1 : 0.001;
      ring.scale.setScalar(THREE.MathUtils.damp(ring.scale.x, targetScale, 6, delta));
      ring.rotation.y += delta * 1.6;
      ring.rotation.x = Math.sin(t * 0.8) * 0.35;
      ring.children.forEach((child, i) => {
        child.position.y = Math.sin(t * 3 + i) * 0.06;
      });
    }
  });

  return (
    <group ref={rootRef}>
      <group ref={headRef}>
        {/* Translucent shell */}
        <mesh>
          <capsuleGeometry args={[0.46, 0.5, 8, 32]} />
          <meshPhysicalMaterial
            ref={bodyMatRef}
            color={config.bodyColor}
            emissive={config.coreColor}
            emissiveIntensity={0.18}
            roughness={0.42}
            metalness={0}
            transparent
            opacity={0.74}
            depthWrite={false}
            clearcoat={0.8}
            clearcoatRoughness={0.25}
            sheen={0.6}
            sheenColor={config.coreColor}
          />
        </mesh>
        {/* Inner glowing core */}
        <mesh position={[0, -0.08, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial
            ref={coreMatRef}
            color={config.coreColor}
            emissive={config.coreColor}
            emissiveIntensity={config.emissive}
            toneMapped={false}
          />
        </mesh>
        <pointLight position={[0, -0.08, 0]} intensity={1.2} distance={2.5} color={config.coreColor} />
        <LumiEyes lookRef={lookRef} eyeScale={config.eyeScale} />
      </group>

      {/* Thinking particle ring */}
      <group ref={ringRef} position={[0, 0.1, 0]} scale={0.001}>
        {ringOffsets.map((angle, i) => (
          <mesh key={i} position={[Math.cos(angle) * 0.85, 0, Math.sin(angle) * 0.85]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#c4b5fd" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Soft floor glow */}
      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color={config.coreColor} transparent opacity={0.12} toneMapped={false} />
      </mesh>
    </group>
  );
}
