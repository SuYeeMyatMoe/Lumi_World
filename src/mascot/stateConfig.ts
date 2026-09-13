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
}

export const STATE_CONFIG: Record<AgentState, MascotStateConfig> = {
  idle: {
    coreColor: '#7dd3fc',
    bodyColor: '#e0f2fe',
    emissive: 1.4,
    bobSpeed: 1.2,
    bobAmplitude: 0.08,
    ring: false,
    pulse: false,
    bounce: false,
    eyeScale: 1,
  },
  looking: {
    coreColor: '#22d3ee',
    bodyColor: '#e0f2fe',
    emissive: 2.2,
    bobSpeed: 1.6,
    bobAmplitude: 0.06,
    ring: false,
    pulse: false,
    bounce: false,
    eyeScale: 1.15,
  },
  thinking: {
    coreColor: '#a78bfa',
    bodyColor: '#ede9fe',
    emissive: 2.6,
    bobSpeed: 2.4,
    bobAmplitude: 0.05,
    ring: true,
    pulse: false,
    bounce: false,
    eyeScale: 0.85,
  },
  warning: {
    coreColor: '#f59e0b',
    bodyColor: '#fef3c7',
    emissive: 3,
    bobSpeed: 0.4,
    bobAmplitude: 0.02,
    ring: false,
    pulse: true,
    bounce: false,
    eyeScale: 1.25,
  },
  success: {
    coreColor: '#34d399',
    bodyColor: '#d1fae5',
    emissive: 3.2,
    bobSpeed: 3,
    bobAmplitude: 0.1,
    ring: false,
    pulse: true,
    bounce: true,
    eyeScale: 1.1,
  },
  listening: {
    coreColor: '#f472b6',
    bodyColor: '#fce7f3',
    emissive: 2.8,
    bobSpeed: 0,
    bobAmplitude: 0,
    ring: true,
    pulse: true,
    bounce: false,
    eyeScale: 1.05,
  },
};
