
export type PlayerSide = 'left' | 'right';
export type GameMode = 'local' | 'online';
export type PeerRole = 'host' | 'guest';

export interface Vector {
  x: number;
  y: number;
}

export interface Puck {
  id: string;
  pos: Vector;
  vel: Vector;
  radius: number;
  color: string;
  side: PlayerSide; 
  isDragged: boolean;
  dragPos?: Vector; 
}

export interface GameState {
  pucks: Puck[];
  status: 'waiting' | 'playing' | 'winner';
  winner: PlayerSide | null;
  score: { left: number; right: number };
}

export interface NetworkMessage {
  type: 'sync' | 'input' | 'win' | 'start' | 'reset';
  payload: any;
}

// CANONICAL PHYSICS BOARD (Always 800x500 internally)
export const BOARD_WIDTH = 800;
export const BOARD_HEIGHT = 500;

export const PUCK_RADIUS = 18;
export const GAP_SIZE = 65;
export const FRICTION = 0.985;
export const ELASTICITY = 0.8;
export const SLING_STIFFNESS = 0.15;
