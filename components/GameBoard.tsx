
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { 
  PUCK_RADIUS, 
  GAP_SIZE, 
  FRICTION, 
  ELASTICITY, 
  SLING_STIFFNESS, 
  Puck, 
  PlayerSide, 
  Vector,
  GameMode,
  PeerRole,
  NetworkMessage,
  BOARD_WIDTH,
  BOARD_HEIGHT
} from '../types';
import { DataConnection } from 'https://esm.sh/peerjs@1.5.4';

interface GameBoardProps {
  status: 'waiting' | 'playing' | 'winner';
  onWin: (winner: PlayerSide) => void;
  isVertical: boolean;
  mode: GameMode;
  peerRole: PeerRole | null;
  connection: DataConnection | null;
}

const BAND_OFFSET = 80;

const GameBoard: React.FC<GameBoardProps> = ({ status, onWin, isVertical, mode, peerRole, connection }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pucksRef = useRef<Puck[]>([]);
  // Added 'side' to dragRef to track which side of the board the current drag is restricted to
  const dragRef = useRef<{ id: string | null; offset: Vector; side: PlayerSide | null }>({ 
    id: null, 
    offset: { x: 0, y: 0 },
    side: null 
  });
  const mouseRef = useRef<Vector>({ x: 0, y: 0 });
  const requestRef = useRef<number>(0);
  const winTimerRef = useRef<number | null>(null);
  const lastSyncRef = useRef<number>(0);
  
  const [pendingSide, setPendingSide] = useState<PlayerSide | null>(null);

  const SCREEN_W = isVertical ? BOARD_HEIGHT : BOARD_WIDTH;
  const SCREEN_H = isVertical ? BOARD_WIDTH : BOARD_HEIGHT;

  const initPucks = useCallback(() => {
    const initialPucks: Puck[] = [];
    setPendingSide(null);
    if (winTimerRef.current) clearTimeout(winTimerRef.current);
    winTimerRef.current = null;
    
    const spacing = 70;
    const startY = (BOARD_HEIGHT - (2 * spacing)) / 2;
    for (let i = 0; i < 6; i++) {
      initialPucks.push({
        id: `left-${i}`, 
        pos: { x: 140 + (i % 2) * 50, y: startY + Math.floor(i / 2) * spacing + 60 },
        vel: { x: 0, y: 0 }, 
        radius: PUCK_RADIUS, 
        color: '#FFFFFF', 
        side: 'left', 
        isDragged: false,
      });
    }
    for (let i = 0; i < 6; i++) {
      initialPucks.push({
        id: `right-${i}`, 
        pos: { x: BOARD_WIDTH - 140 - (i % 2) * 50, y: startY + Math.floor(i / 2) * spacing + 60 },
        vel: { x: 0, y: 0 }, 
        radius: PUCK_RADIUS, 
        color: '#1a1a1a', 
        side: 'right', 
        isDragged: false,
      });
    }
    pucksRef.current = initialPucks;
  }, []);

  useEffect(() => {
    if (status === 'playing') {
      initPucks();
    }
  }, [initPucks, status]);

  useEffect(() => {
    if (!connection) return;

    const handleData = (data: any) => {
      const msg = data as NetworkMessage;
      
      if (peerRole === 'host' && msg.type === 'input') {
        const { id, vel, isDragging, pos } = msg.payload;
        const p = pucksRef.current.find(p => p.id === id);
        if (p) {
          if (vel !== undefined) {
            p.vel = vel;
            p.isDragged = false;
          } else {
            p.isDragged = isDragging;
            if (pos) p.pos = pos;
          }
        }
      } 
      else if (peerRole === 'guest' && msg.type === 'sync') {
        const remotePucks = msg.payload.pucks;
        setPendingSide(msg.payload.pendingSide);
        
        remotePucks.forEach((rp: any) => {
          const p = pucksRef.current.find(lp => lp.id === rp.id);
          if (p) {
            if (dragRef.current.id === p.id) {
               p.isDragged = true;
            } else {
              p.pos = rp.pos;
              p.vel = rp.vel;
              p.isDragged = rp.isDragged;
            }
          } else {
             pucksRef.current.push({ ...rp });
          }
        });
      }
    };

    connection.on('data', handleData);
    return () => connection.off('data', handleData);
  }, [connection, peerRole]);

  const updatePhysics = () => {
    if (status !== 'playing') return;
    
    const pucks = pucksRef.current;

    for (let i = 0; i < pucks.length; i++) {
      const p = pucks[i];
      if (p.isDragged && dragRef.current.id === p.id) {
        let targetX = mouseRef.current.x - dragRef.current.offset.x;
        let targetY = mouseRef.current.y - dragRef.current.offset.y;

        const midX = BOARD_WIDTH / 2;
        const wallT = 8; 
        
        const activeSide = dragRef.current.side;
        if (activeSide === 'left') {
          targetX = Math.max(p.radius, Math.min(midX - p.radius - wallT, targetX));
        } else if (activeSide === 'right') {
          targetX = Math.max(midX + p.radius + wallT, Math.min(BOARD_WIDTH - p.radius, targetX));
        }
        
        targetY = Math.max(p.radius, Math.min(BOARD_HEIGHT - p.radius, targetY));
        
        p.pos.x = targetX; 
        p.pos.y = targetY; 
        p.vel = { x: 0, y: 0 };

        if (peerRole === 'guest' && connection && Date.now() - lastSyncRef.current > 16) {
            connection.send({ 
                type: 'input', 
                payload: { id: p.id, isDragging: true, pos: p.pos } 
            });
            lastSyncRef.current = Date.now();
        }
      }
    }

    if (peerRole === 'guest') return;

    for (let i = 0; i < pucks.length; i++) {
      const p = pucks[i];
      if (p.isDragged) continue;

      p.pos.x += p.vel.x; p.pos.y += p.vel.y;
      p.vel.x *= FRICTION; p.vel.y *= FRICTION;

      if (Math.abs(p.vel.x) < 0.05) p.vel.x = 0;
      if (Math.abs(p.vel.y) < 0.05) p.vel.y = 0;

      if (p.pos.y - p.radius < 0) { p.pos.y = p.radius; p.vel.y *= -ELASTICITY; }
      else if (p.pos.y + p.radius > BOARD_HEIGHT) { p.pos.y = BOARD_HEIGHT - p.radius; p.vel.y *= -ELASTICITY; }
      if (p.pos.x - p.radius < 0) { p.pos.x = p.radius; p.vel.x *= -ELASTICITY; }
      else if (p.pos.x + p.radius > BOARD_WIDTH) { p.pos.x = BOARD_WIDTH - p.radius; p.vel.x *= -ELASTICITY; }

      const wallThickness = 12;
      const midX = BOARD_WIDTH / 2; 
      const gapTop = (BOARD_HEIGHT - GAP_SIZE) / 2; 
      const gapBottom = gapTop + GAP_SIZE;
      
      if (p.pos.x + p.radius > midX - wallThickness / 2 && p.pos.x - p.radius < midX + wallThickness / 2) {
        if (p.pos.y - p.radius < gapTop || p.pos.y + p.radius > gapBottom) {
          if (p.pos.x < midX) { p.pos.x = midX - wallThickness / 2 - p.radius; p.vel.x *= -ELASTICITY; }
          else { p.pos.x = midX + wallThickness / 2 + p.radius; p.vel.x *= -ELASTICITY; }
        }
      }

      for (let j = i + 1; j < pucks.length; j++) {
        const p2 = pucks[j];
        const dx = p2.pos.x - p.pos.x; const dy = p2.pos.y - p.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy); const minDist = p.radius + p2.radius;
        if (dist < minDist) {
          const angle = Math.atan2(dy, dx); const overlap = minDist - dist;
          const resolveX = Math.cos(angle) * overlap * 0.5; const resolveY = Math.sin(angle) * overlap * 0.5;
          p.pos.x -= resolveX; p.pos.y -= resolveY; p2.pos.x += resolveX; p2.pos.y += resolveY;
          const nx = dx / dist; const ny = dy / dist;
          const v1n = p.vel.x * nx + p.vel.y * ny; const v2n = p2.vel.x * nx + p2.vel.y * ny;
          const common = v1n - v2n;
          p.vel.x -= common * nx * ELASTICITY; p.vel.y -= common * ny * ELASTICITY;
          p2.vel.x += common * nx * ELASTICITY; p2.vel.y += common * ny * ELASTICITY;
        }
      }
    }

    const side1Pucks = pucks.filter(p => p.pos.x < BOARD_WIDTH / 2).length;
    const side2Pucks = pucks.filter(p => p.pos.x >= BOARD_WIDTH / 2).length;
    
    if (side1Pucks === 0 || side2Pucks === 0) {
      const winnerCandidate = side1Pucks === 0 ? 'right' : 'left';
      if (!winTimerRef.current && status === 'playing') {
        setPendingSide(winnerCandidate);
        winTimerRef.current = window.setTimeout(() => { 
          onWin(winnerCandidate);
          // We don't set winTimerRef.current = null here to prevent re-triggering
          // before the status prop updates to 'winner'.
          // It will be reset in initPucks() when the next game starts.
        }, 1000);
      }
    } else {
      if (winTimerRef.current) { 
        clearTimeout(winTimerRef.current); 
        winTimerRef.current = null; 
        setPendingSide(null); 
      }
    }

    if (peerRole === 'host' && connection && Date.now() - lastSyncRef.current > 33) {
       connection.send({
          type: 'sync',
          payload: {
            pucks: pucks.map(p => ({ 
              id: p.id, pos: p.pos, vel: p.vel, radius: p.radius, color: p.color, side: p.side, isDragged: p.isDragged
            })),
            pendingSide
          }
       });
       lastSyncRef.current = Date.now();
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
    
    if (isVertical) {
        ctx.translate(SCREEN_W, 0);
        ctx.rotate(Math.PI / 2);
    }

    ctx.fillStyle = '#3d2b1f';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    if (pendingSide) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      const pulse = (Math.sin(Date.now() / 100) + 1) / 2;
      ctx.globalAlpha = 0.2 + pulse * 0.3;
      if (pendingSide === 'left') ctx.fillRect(0, 0, BOARD_WIDTH / 2, BOARD_HEIGHT);
      else ctx.fillRect(BOARD_WIDTH / 2, 0, BOARD_WIDTH / 2, BOARD_HEIGHT);
      ctx.globalAlpha = 1.0;
    }
    
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_WIDTH; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + (Math.sin(i * 0.05) * 5), BOARD_HEIGHT);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BOARD_WIDTH/2, 0); ctx.lineTo(BOARD_WIDTH/2, (BOARD_HEIGHT-GAP_SIZE)/2);
    ctx.moveTo(BOARD_WIDTH/2, (BOARD_HEIGHT+GAP_SIZE)/2); ctx.lineTo(BOARD_WIDTH/2, BOARD_HEIGHT);
    ctx.stroke();

    ctx.fillStyle = '#2a1d15';
    const wallT = 12;
    ctx.fillRect(BOARD_WIDTH/2 - wallT/2, 0, wallT, (BOARD_HEIGHT-GAP_SIZE)/2);
    ctx.fillRect(BOARD_WIDTH/2 - wallT/2, (BOARD_HEIGHT+GAP_SIZE)/2, wallT, (BOARD_HEIGHT-GAP_SIZE)/2);

    const drawBand = (isLeft: boolean) => {
      ctx.strokeStyle = '#e11d48'; 
      ctx.lineWidth = 4;
      const anchorX = isLeft ? BAND_OFFSET : BOARD_WIDTH - BAND_OFFSET;
      
      const stretchedPuck = pucksRef.current.find(p => p.isDragged && (
          isLeft ? p.pos.x < anchorX : p.pos.x > anchorX
      ));

      ctx.beginPath();
      ctx.moveTo(anchorX, 20);
      if (stretchedPuck) {
        ctx.lineWidth = 6;
        ctx.lineTo(stretchedPuck.pos.x, stretchedPuck.pos.y);
        ctx.lineTo(anchorX, BOARD_HEIGHT - 20);
        ctx.stroke();

        // Guide line - MATCH PHYSICS EXACTLY
        ctx.save();
        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(stretchedPuck.pos.x, stretchedPuck.pos.y);
        
        // Use the same multipliers as handleInputEnd for visual trajectory
        const vx = (anchorX - stretchedPuck.pos.x) * SLING_STIFFNESS * 3.8;
        const vy = (BOARD_HEIGHT / 2 - stretchedPuck.pos.y) * SLING_STIFFNESS * 2.2;
        
        // Draw the guide for a reasonable distance (e.g., 20 frames worth of movement)
        // guideScale reduced to make the line shorter as requested
        const guideScale = 12; 
        ctx.lineTo(stretchedPuck.pos.x + vx * guideScale, stretchedPuck.pos.y + vy * guideScale);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.lineTo(anchorX, BOARD_HEIGHT - 20);
        ctx.stroke();
      }
    };
    
    drawBand(true); 
    drawBand(false);

    pucksRef.current.forEach(p => {
      ctx.save();
      ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowOffsetY = 4;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.color === '#FFFFFF' ? '#e5e7eb' : '#333'; ctx.lineWidth = 2; ctx.stroke();
      if (p.isDragged) {
          ctx.shadowBlur = 15; ctx.shadowColor = '#fbbf24'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.radius + 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    });

    ctx.restore();

    updatePhysics();
    requestRef.current = requestAnimationFrame(draw);
  }, [status, onWin, isVertical, SCREEN_W, SCREEN_H, pendingSide, peerRole, connection]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [draw]);

  const mapToPhysics = (clientX: number, clientY: number): Vector => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const lx = (clientX - rect.left) * (SCREEN_W / rect.width);
    const ly = (clientY - rect.top) * (SCREEN_H / rect.height);
    
    if (isVertical) {
        return { x: ly, y: BOARD_HEIGHT - lx };
    }
    return { x: lx, y: ly };
  };

  const handleInputStart = (clientX: number, clientY: number) => {
    if (status !== 'playing') return;
    const physPos = mapToPhysics(clientX, clientY);
    mouseRef.current = physPos;

    const currentInputSide: PlayerSide = physPos.x < BOARD_WIDTH / 2 ? 'left' : 'right';

    const isOurSide = (inputSide: PlayerSide) => {
      if (mode === 'local') return true;
      if (peerRole === 'host') return inputSide === 'left';
      if (peerRole === 'guest') return inputSide === 'right';
      return false;
    };

    if (!isOurSide(currentInputSide)) return;

    for (const p of pucksRef.current) {
      const dx = physPos.x - p.pos.x; 
      const dy = physPos.y - p.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < p.radius + 30) {
        const puckPhysicalSide: PlayerSide = p.pos.x < BOARD_WIDTH / 2 ? 'left' : 'right';
        if (puckPhysicalSide === currentInputSide) {
          p.isDragged = true; 
          dragRef.current = { 
            id: p.id, 
            offset: { x: dx, y: dy },
            side: currentInputSide 
          };
          if (peerRole === 'guest' && connection) {
              connection.send({ type: 'input', payload: { id: p.id, isDragging: true, pos: p.pos } });
          }
          break;
        }
      }
    }
  };

  const handleInputMove = (clientX: number, clientY: number) => {
    mouseRef.current = mapToPhysics(clientX, clientY);
  };

  const handleInputEnd = () => {
    if (dragRef.current.id) {
      const p = pucksRef.current.find(p => p.id === dragRef.current.id);
      if (p) {
        p.isDragged = false;
        let finalVel = { x: 0, y: 0 };
        
        const dragSide = dragRef.current.side;
        const anchorX = dragSide === 'left' ? BAND_OFFSET : BOARD_WIDTH - BAND_OFFSET;
        
        const isPulledBack = dragSide === 'left' ? p.pos.x < anchorX : p.pos.x > anchorX;
        
        if (isPulledBack) {
          finalVel.x = (anchorX - p.pos.x) * SLING_STIFFNESS * 3.8;
          finalVel.y = (BOARD_HEIGHT / 2 - p.pos.y) * SLING_STIFFNESS * 2.2;
        }

        if (peerRole !== 'guest') {
            p.vel = finalVel;
        } else if (connection) {
            connection.send({ type: 'input', payload: { id: p.id, vel: finalVel, isDragging: false } });
        }
      }
      dragRef.current.id = null;
      dragRef.current.side = null;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      onMouseDown={(e) => handleInputStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleInputMove(e.clientX, e.clientY)}
      onMouseUp={handleInputEnd}
      onMouseLeave={handleInputEnd}
      onTouchStart={(e) => handleInputStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleInputMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleInputEnd}
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      className="cursor-crosshair touch-none shadow-inner bg-stone-900"
    />
  );
};

export default GameBoard;
