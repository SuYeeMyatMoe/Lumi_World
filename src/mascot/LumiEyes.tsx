import { forwardRef, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LookTarget } from './useLookAt';

interface Props {
  lookRef: React.RefObject<LookTarget | null>;
  eyeScale: number;
}

const EYE_X = 0.165;
const EYE_Y = 0.16;
const EYE_Z = 0.44;

export function LumiEyes({ lookRef, eyeScale }: Props) {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const blinkRef = useRef({ next: 2 + Math.random() * 4, phase: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const look = lookRef.current;
    const px = look ? (look.yaw / 0.61) * 0.045 : 0;
    const py = look ? (-look.pitch / 0.26) * 0.03 : 0;

    const blink = blinkRef.current;
    let scaleY = 1;
    if (t > blink.next) {
      blink.phase += delta * 14;
      scaleY = Math.max(0.08, Math.abs(Math.cos(blink.phase)));
      if (blink.phase > Math.PI) {
        blink.phase = 0;
        blink.next = t + 3 + Math.random() * 5;
      }
    }

    for (const ref of [leftRef, rightRef]) {
      const g = ref.current;
      if (!g) continue;
      g.position.x = THREE.MathUtils.damp(g.position.x, (ref === leftRef ? -EYE_X : EYE_X) + px, 8, delta);
      g.position.y = THREE.MathUtils.damp(g.position.y, EYE_Y + py, 8, delta);
      // Eyes are slightly taller than wide; blink squashes only Y.
      const target = eyeScale * 1.25 * scaleY;
      g.scale.set(eyeScale, THREE.MathUtils.damp(g.scale.y, target, 30, delta), eyeScale);
    }
  });

  return (
    <>
      <Eye ref={leftRef} x={-EYE_X} />
      <Eye ref={rightRef} x={EYE_X} />
    </>
  );
}


const Eye = forwardRef<THREE.Group, { x: number }>(function Eye({ x }, ref) {
  return (
    <group ref={ref} position={[x, EYE_Y, EYE_Z]}>
      {/* Pupil */}
      <mesh>
        <sphereGeometry args={[0.078, 24, 24]} />
        <meshStandardMaterial color="#0b1020" roughness={0.25} metalness={0.1} />
      </mesh>
      {/* Iris rim: thin glowing ring so the eye reads on dark pages too */}
      <mesh position={[0, 0, 0.055]}>
        <ringGeometry args={[0.058, 0.07, 32]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.55} toneMapped={false} depthWrite={false} />
      </mesh>
      {/* Catchlights: one large, one small, offset like a real reflection */}
      <mesh position={[0.026, 0.03, 0.062]}>
        <sphereGeometry args={[0.026, 12, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-0.02, -0.025, 0.064]}>
        <sphereGeometry args={[0.011, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} toneMapped={false} />
      </mesh>
    </group>
  );
});
