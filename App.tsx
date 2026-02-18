
import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameBoard from './components/GameBoard';
import UIOverlay from './components/UIOverlay';
import { GameState, PlayerSide, GameMode, PeerRole, NetworkMessage } from './types';
import Peer, { DataConnection } from 'https://esm.sh/peerjs@1.5.4';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    pucks: [], 
    status: 'waiting',
    winner: null,
    score: { left: 0, right: 0 }
  });

  const [mode, setMode] = useState<GameMode>('local');
  const [peerRole, setPeerRole] = useState<PeerRole | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [isVertical, setIsVertical] = useState(window.innerHeight > window.innerWidth);
  const [connError, setConnError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    const handleResize = () => setIsVertical(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNetworkMessage = useCallback((msg: NetworkMessage) => {
    if (msg.type === 'start') {
      setGameState(prev => ({ ...prev, status: 'playing', winner: null }));
    } else if (msg.type === 'reset') {
      setGameState(prev => ({ ...prev, status: 'waiting', winner: null }));
    } else if (msg.type === 'win') {
      handleGameEnd(msg.payload, false);
    }
  }, []);

  const setupConnection = useCallback((conn: DataConnection, role: PeerRole) => {
    conn.on('open', () => {
      console.log('Connection established as', role);
      setConnection(conn);
      setConnError(null);
      // If we are host, we can auto-start or wait for manually clicking start.
      // For now, let's just stay in 'waiting' until Host clicks 'Start'
    });

    conn.on('data', (data: any) => {
      const msg = data as NetworkMessage;
      handleNetworkMessage(msg);
    });

    conn.on('close', () => {
      setConnection(null);
      setGameState(prev => ({ ...prev, status: 'waiting' }));
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setConnError('Connection failed.');
    });
  }, [handleNetworkMessage]);

  const initPeer = (role: PeerRole, id?: string) => {
    setConnError(null);
    if (peerRef.current) peerRef.current.destroy();

    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (myId) => {
      console.log('Peer opened with ID:', myId);
      if (role === 'host') {
        setRoomId(myId);
      } else if (id) {
        setRoomId(id);
        const conn = peer.connect(id, { reliable: true });
        setupConnection(conn, 'guest');
      }
    });

    peer.on('connection', (conn) => {
      if (role === 'host') {
        setupConnection(conn, 'host');
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'peer-unavailable') {
        setConnError('Room not found. Check the ID.');
      } else {
        setConnError('Network error. Try again.');
      }
      setPeerRole(null);
    });

    setPeerRole(role);
  };

  const sendNetworkMessage = (msg: NetworkMessage) => {
    if (connection && connection.open) {
      connection.send(msg);
    }
  };

  const handleGameEnd = useCallback((winner: PlayerSide, broadcast = true) => {
    setGameState(prev => ({
      ...prev,
      status: 'winner',
      winner,
      score: {
        ...prev.score,
        [winner]: prev.score[winner] + 1
      }
    }));
    if (broadcast) sendNetworkMessage({ type: 'win', payload: winner });
  }, [connection]);

  const startGame = useCallback(() => {
    setGameState(prev => ({ ...prev, status: 'playing', winner: null }));
    sendNetworkMessage({ type: 'start', payload: null });
  }, [connection]);

  const resetGame = useCallback(() => {
    setGameState(prev => ({ ...prev, status: 'waiting', winner: null }));
    sendNetworkMessage({ type: 'reset', payload: null });
  }, [connection]);

  const toggleMode = (m: GameMode) => {
    setMode(m);
    setConnError(null);
    if (m === 'local') {
      if (peerRef.current) peerRef.current.destroy();
      setPeerRole(null);
      setConnection(null);
      setRoomId('');
    }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 overflow-hidden select-none px-4">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-zinc-500 rounded-full blur-[120px]" />
      </div>

      <div className={`z-10 text-center ${isVertical ? 'mb-4' : 'mb-6'}`}>
        <h1 className={`${isVertical ? 'text-3xl' : 'text-4xl md:text-6xl'} font-black text-white tracking-tighter uppercase italic flex items-center justify-center gap-4`}>
          <span className="text-amber-500">Pucket</span>
          {connection && <span className="text-xs font-bold not-italic bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">ONLINE</span>}
        </h1>
        
        <div className="flex gap-4 mt-2 justify-center">
            <div className="flex flex-col items-center">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{isVertical ? 'Top' : 'Left'}</span>
              <span className="text-2xl font-black text-white">{gameState.score.left}</span>
            </div>
            <div className="h-8 w-px bg-zinc-800 self-end mb-1" />
            <div className="flex flex-col items-center">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{isVertical ? 'Bottom' : 'Right'}</span>
              <span className="text-2xl font-black text-white">{gameState.score.right}</span>
            </div>
        </div>
      </div>

      <div className="relative z-10 p-2 md:p-4 bg-zinc-800 rounded-2xl md:rounded-3xl shadow-2xl border border-zinc-700 max-w-full max-h-[80vh] flex items-center justify-center overflow-hidden">
        <GameBoard 
          status={gameState.status} 
          onWin={handleGameEnd} 
          isVertical={isVertical}
          mode={mode}
          peerRole={peerRole}
          connection={connection}
        />
        
        <UIOverlay 
          status={gameState.status} 
          winner={gameState.winner} 
          onStart={startGame} 
          onReset={resetGame} 
          isVertical={isVertical}
          mode={mode}
          setMode={toggleMode}
          roomId={roomId}
          onHost={() => initPeer('host')}
          onJoin={(id) => initPeer('guest', id)}
          peerRole={peerRole}
          isConnected={!!connection}
          error={connError}
        />
      </div>

      <footer className="absolute bottom-2 md:bottom-4 text-zinc-600 text-[8px] md:text-[10px] uppercase tracking-[0.2em] flex items-center gap-4">
        <span>Handcrafted Physics</span>
        {roomId && <span className="text-amber-500/50">Room: {roomId.slice(0, 8)}...</span>}
      </footer>
    </div>
  );
};

export default App;
