import { useEffect, useMemo, useRef } from 'react';
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
// Mouth is a torus arc; this is its angular span. Scale handles the expression.
const MOUTH_ARC = Math.PI * 0.72;

// Soft radial halo drawn once; tinted per state via material color.
function makeHaloTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function LumiBody({ state, lookRef }: Props) {
  const rootRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const haloMatRef = useRef<THREE.SpriteMaterial>(null);
  const mouthRef = useRef<THREE.Group>(null);
  const blushLRef = useRef<THREE.MeshBasicMaterial>(null);
  const blushRRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Group>(null);
  const bounceRef = useRef({ lastState: state, t: 0 });
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
  }, []);

  const config = STATE_CONFIG[state] ?? STATE_CONFIG.idle;
  const coreColor = useMemo(() => new THREE.Color(config.coreColor), [config.coreColor]);
  const bodyColor = useMemo(() => new THREE.Color(config.bodyColor), [config.bodyColor]);
  const haloTexture = useMemo(makeHaloTexture, []);
  useEffect(() => () => haloTexture.dispose(), [haloTexture]);

  const ringOffsets = useMemo(
    () => Array.from({ length: RING_COUNT }, (_, i) => (i / RING_COUNT) * Math.PI * 2),
    [],
  );

  useFrame((frame, delta) => {
    const t = frame.clock.elapsedTime;
    const root = rootRef.current;
    const head = headRef.current;
    if (!root || !head) return;
    const reduced = reducedRef.current;

    if (bounceRef.current.lastState !== state) {
      bounceRef.current.lastState = state;
      bounceRef.current.t = config.bounce && !reduced ? 0.001 : 0;
    }

    // Float / breathe (held still under reduced motion)
    const bob = reduced ? 0 : Math.sin(t * config.bobSpeed) * config.bobAmplitude;
    root.position.y = THREE.MathUtils.damp(root.position.y, bob - 0.05, 4, delta);

    // One-shot bounce for success
    let bounceScale = 1;
    if (bounceRef.current.t > 0) {
      bounceRef.current.t += delta * 5;
      const p = bounceRef.current.t;
      bounceScale = 1 + Math.sin(Math.min(p, Math.PI)) * 0.14;
      if (p >= Math.PI) bounceRef.current.t = 0;
    }
    const breathe = reduced ? 1 : 1 + Math.sin(t * 1.4) * 0.015;
    root.scale.setScalar(THREE.MathUtils.damp(root.scale.x, bounceScale * breathe, 10, delta));

    // Look-at: damp the head toward the target yaw/pitch, never snap
    const look = lookRef.current;
    const idleYaw = reduced ? 0 : Math.sin(t * 0.5) * 0.08;
    const idlePitch = reduced ? 0 : Math.sin(t * 0.7) * 0.03;
    const targetYaw = look ? look.yaw : idleYaw;
    const targetPitch = look ? look.pitch : idlePitch;
    head.rotation.y = THREE.MathUtils.damp(head.rotation.y, targetYaw, 6, delta);
    head.rotation.x = THREE.MathUtils.damp(head.rotation.x, targetPitch, 6, delta);
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, -targetYaw * 0.12, 4, delta);

    // Core glow
    const pulse = config.pulse && !reduced ? 0.6 + Math.sin(t * 5) * 0.5 : 1;
    const core = coreMatRef.current;
    if (core) {
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
    const halo = haloMatRef.current;
    if (halo) {
      halo.color.lerp(coreColor, Math.min(1, delta * 3));
      halo.opacity = THREE.MathUtils.damp(halo.opacity, 0.32 + (pulse - 1) * 0.12, 4, delta);
    }

    // Expression: mouth arc width/height and cheek blush
    const mouth = mouthRef.current;
    if (mouth) {
      const sx = 0.55 + config.smile * 0.6;
      const sy = 0.25 + config.smile * 0.9;
      mouth.scale.x = THREE.MathUtils.damp(mouth.scale.x, sx, 6, delta);
      mouth.scale.y = THREE.MathUtils.damp(mouth.scale.y, sy, 6, delta);
    }
    for (const m of [blushLRef.current, blushRRef.current]) {
      if (!m) continue;
      m.opacity = THREE.MathUtils.damp(m.opacity, config.blush * 0.5, 4, delta);
      m.color.lerp(coreColor, Math.min(1, delta * 3));
    }

    // Thinking ring
    const ring = ringRef.current;
    if (ring) {
      const targetScale = config.ring ? 1 : 0.001;
      ring.scale.setScalar(THREE.MathUtils.damp(ring.scale.x, targetScale, 6, delta));
      ring.rotation.y += delta * (reduced ? 0.4 : 1.6);
      ring.rotation.x = Math.sin(t * 0.8) * 0.35;
      if (!reduced) {
        ring.children.forEach((child, i) => {
          child.position.y = Math.sin(t * 3 + i) * 0.06;
        });
      }
    }
  });

  return (
    <group ref={rootRef}>
      {/* Halo: separates Lumi from any page background, light or dark */}
      <sprite position={[0, -0.02, -0.6]} scale={[2.3, 2.3, 1]}>
        <spriteMaterial
          ref={haloMatRef}
          map={haloTexture}
          color={config.coreColor}
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      <group ref={headRef}>
        {/* Translucent shell, slightly squashed so it reads as a soft body, not a pill */}
        <mesh scale={[1, 0.96, 1]}>
          <capsuleGeometry args={[0.48, 0.42, 8, 48]} />
          <meshPhysicalMaterial
            ref={bodyMatRef}
            color={config.bodyColor}
            emissive={config.coreColor}
            emissiveIntensity={0.22}
            roughness={0.32}
            metalness={0}
            transparent
            opacity={0.8}
            depthWrite={false}
            clearcoat={1}
            clearcoatRoughness={0.18}
            sheen={0.8}
            sheenRoughness={0.6}
            sheenColor={config.coreColor}
            iridescence={0.35}
            iridescenceIOR={1.3}
            iridescenceThicknessRange={[120, 420]}
          />
        </mesh>

        {/* Gloss: fixed specular smear so the shell reads as glass under flat page lighting */}
        <mesh position={[-0.2, 0.42, 0.28]} rotation={[0.2, 0, 0.5]} scale={[1, 0.45, 0.5]}>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.32} depthWrite={false} toneMapped={false} />
        </mesh>

        {/* Inner glowing core */}
        <mesh position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial
            ref={coreMatRef}
            color={config.coreColor}
            emissive={config.coreColor}
            emissiveIntensity={config.emissive}
            toneMapped={false}
          />
        </mesh>
        <pointLight position={[0, -0.1, 0]} intensity={1.4} distance={2.5} color={config.coreColor} />

        <LumiEyes lookRef={lookRef} eyeScale={config.eyeScale} />

        {/* Mouth: arc centered at the bottom of the torus, scaled by expression */}
        <group ref={mouthRef} position={[0, -0.02, 0.47]} scale={[0.85, 0.6, 1]}>
          <mesh rotation={[0, 0, -Math.PI / 2 - MOUTH_ARC / 2]}>
            <torusGeometry args={[0.085, 0.014, 8, 28, MOUTH_ARC]} />
            <meshBasicMaterial color="#0b1020" toneMapped={false} />
          </mesh>
        </group>

        {/* Cheek blush */}
        <mesh position={[-0.3, -0.01, 0.38]} rotation={[0, -0.6, 0]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial ref={blushLRef} color={config.coreColor} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0.3, -0.01, 0.38]} rotation={[0, 0.6, 0]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial ref={blushRRef} color={config.coreColor} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
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
    </group>
  );
}
