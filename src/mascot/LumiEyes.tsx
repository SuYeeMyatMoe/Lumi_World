import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LookTarget } from './useLookAt';

interface Props {
  lookRef: React.RefObject<LookTarget | null>;
  eyeScale: number;
}

export function LumiEyes({ lookRef, eyeScale }: Props) {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const blinkRef = useRef({ next: 2 + Math.random() * 4, phase: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const look = lookRef.current;
    const px = look ? (look.yaw / 0.61) * 0.04 : 0;
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
      g.position.x = THREE.MathUtils.damp(g.position.x, (ref === leftRef ? -0.17 : 0.17) + px, 8, delta);
      g.position.y = THREE.MathUtils.damp(g.position.y, 0.18 + py, 8, delta);
      const target = eyeScale * scaleY;
      g.scale.set(eyeScale, THREE.MathUtils.damp(g.scale.y, target, 30, delta), eyeScale);
    }
  });

  return (
    <>
      <group ref={leftRef} position={[-0.17, 0.18, 0.45]}>
        <mesh>
          <sphereGeometry args={[0.075, 24, 24]} />
          <meshStandardMaterial color="#0b1020" roughness={0.3} />
        </mesh>
        <mesh position={[0.02, 0.025, 0.06]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      <group ref={rightRef} position={[0.17, 0.18, 0.45]}>
        <mesh>
          <sphereGeometry args={[0.075, 24, 24]} />
          <meshStandardMaterial color="#0b1020" roughness={0.3} />
        </mesh>
        <mesh position={[0.02, 0.025, 0.06]}>
          <sphereGeometry args={[0.022, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </>
  );
}
