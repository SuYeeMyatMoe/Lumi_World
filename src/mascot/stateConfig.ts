import type { AgentState } from '../shared/types/agentState';

export interface MascotStateConfig {
  coreColor: string;
  bodyColor: string;
  emissive: number;
  bobSpeed: number;
  bobAmplitude: number;
  ring: boolean;
  pulse: boolean;
  bounce: boolean;
  eyeScale: number;
  /** 0 = flat line, 1 = wide grin. Drives the mouth arc. */
  smile: number;
  /** Cheek blush opacity, 0..1. */
  blush: number;
}

export const STATE_CONFIG: Record<AgentState, MascotStateConfig> = {
  idle: {
    coreColor: '#67e8f9',
    bodyColor: '#cffafe',
    emissive: 1.6,
    bobSpeed: 1.2,
    bobAmplitude: 0.08,
    ring: false,
    pulse: false,
    bounce: false,
    eyeScale: 1,
    smile: 0.55,
    blush: 0.35,
  },
  looking: {
    coreColor: '#22d3ee',
    bodyColor: '#cffafe',
    emissive: 2.4,
    bobSpeed: 1.6,
    bobAmplitude: 0.06,
    ring: false,
    pulse: false,
    bounce: false,
    eyeScale: 1.18,
    smile: 0.65,
    blush: 0.45,
  },
  thinking: {
    coreColor: '#a78bfa',
    bodyColor: '#ede9fe',
    emissive: 2.8,
    bobSpeed: 2.4,
    bobAmplitude: 0.05,
    ring: true,
    pulse: false,
    bounce: false,
    eyeScale: 0.85,
    smile: 0.3,
    blush: 0.2,
  },
  warning: {
    coreColor: '#f59e0b',
    bodyColor: '#fef3c7',
    emissive: 3.2,
    bobSpeed: 0.4,
    bobAmplitude: 0.02,
    ring: false,
    pulse: true,
    bounce: false,
    eyeScale: 1.28,
    smile: 0.08,
    blush: 0.1,
  },
  success: {
    coreColor: '#34d399',
    bodyColor: '#d1fae5',
    emissive: 3.4,
    bobSpeed: 3,
    bobAmplitude: 0.1,
    ring: false,
    pulse: true,
    bounce: true,
    eyeScale: 1.1,
    smile: 1,
    blush: 0.6,
  },
  listening: {
    coreColor: '#f472b6',
    bodyColor: '#fce7f3',
    emissive: 3,
    bobSpeed: 0,
    bobAmplitude: 0,
    ring: true,
    pulse: true,
    bounce: false,
    eyeScale: 1.05,
    smile: 0.5,
    blush: 0.5,
  },
};
