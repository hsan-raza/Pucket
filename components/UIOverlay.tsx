
import React, { useState, useEffect } from 'react';
import { PlayerSide, GameMode, PeerRole } from '../types';

interface UIOverlayProps {
  status: 'waiting' | 'playing' | 'winner';
  winner: PlayerSide | null;
  onStart: () => void;
  onReset: () => void;
  isVertical: boolean;
  mode: GameMode;
  setMode: (m: GameMode) => void;
  roomId: string;
  onHost: () => void;
  onJoin: (id: string) => void;
  peerRole: PeerRole | null;
  isConnected: boolean;
  error: string | null;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  status, winner, onStart, onReset, isVertical, mode, setMode, roomId, onHost, onJoin, peerRole, isConnected, error 
}) => {
  const [inputRoomId, setInputRoomId] = useState('');
  const [view, setView] = useState<'main' | 'online-lobby' | 'joining'>('main');
  const [copied, setCopied] = useState(false);

  // If we are a guest and just connected, we should probably be in a "waiting for host" view
  useEffect(() => {
    if (isConnected && peerRole === 'guest') {
        setView('online-lobby');
    }
  }, [isConnected, peerRole]);

  const handleCopy = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'playing') return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl overflow-hidden p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      
      <div className="relative z-30 text-center p-6 md:p-8 w-full max-w-sm animate-in fade-in zoom-in duration-300">
        
        {status === 'waiting' && view === 'main' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex justify-center mb-2">
               <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/50 rotate-12">
                 <i className="fa-solid fa-bolt text-white text-2xl md:text-3xl"></i>
               </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Pucket Battle</h2>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setMode('local'); onStart(); }}
                className="group w-full py-4 bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-users"></i> Local Play
              </button>
              <button
                onClick={() => { setMode('online'); setView('online-lobby'); }}
                className="group w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-zinc-700 flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-globe"></i> Online Play
              </button>
            </div>
          </div>
        )}

        {status === 'waiting' && view === 'online-lobby' && (
           <div className="space-y-6">
              <button onClick={() => { setView('main'); setMode('local'); }} className="absolute top-0 left-0 text-zinc-500 hover:text-white transition-colors">
                <i className="fa-solid fa-arrow-left text-xl"></i>
              </button>
              <h3 className="text-xl font-black text-white uppercase">Online Lobby</h3>
              
              {!peerRole ? (
                <div className="flex flex-col gap-3">
                  <button onClick={onHost} className="py-4 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase rounded-xl transition-all active:scale-95">Host Game</button>
                  <button onClick={() => setView('joining')} className="py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase rounded-xl border border-zinc-700 transition-all active:scale-95">Join Game</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status Indicator */}
                  <div className={`p-4 rounded-xl border transition-all ${isConnected ? 'bg-green-500/10 border-green-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">
                        {peerRole === 'host' ? 'Host Room ID' : 'Joined Room'}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <p className="text-xl font-mono font-black text-white tracking-widest overflow-hidden text-ellipsis whitespace-nowrap">
                            {roomId ? (roomId.length > 12 ? roomId.slice(0, 8) + '...' : roomId) : 'Generating...'}
                        </p>
                        <button onClick={handleCopy} className="hover:text-amber-500 transition-colors text-zinc-500">
                           <i className={`fa-solid ${copied ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                        </button>
                    </div>
                  </div>

                  {isConnected ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-center gap-2 text-green-400">
                            <i className="fa-solid fa-circle-check"></i>
                            <span className="text-xs uppercase font-bold tracking-widest">Opponent Connected</span>
                        </div>
                        {peerRole === 'host' ? (
                            <button onClick={onStart} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase rounded-xl shadow-lg shadow-amber-500/20 animate-pulse">
                                Start Match
                            </button>
                        ) : (
                            <div className="py-4 bg-zinc-800/50 text-zinc-400 font-bold uppercase rounded-xl border border-dashed border-zinc-700">
                                Waiting for host...
                            </div>
                        )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-4">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs uppercase font-bold text-zinc-500 tracking-widest">
                            {peerRole === 'host' ? 'Waiting for opponent' : 'Connecting to host'}
                        </span>
                    </div>
                  )}
                </div>
              )}
              {error && <p className="text-red-500 text-xs font-bold uppercase">{error}</p>}
           </div>
        )}

        {status === 'waiting' && view === 'joining' && (
          <div className="space-y-6">
            <button onClick={() => setView('online-lobby')} className="absolute top-0 left-0 text-zinc-500 hover:text-white">
              <i className="fa-solid fa-arrow-left text-xl"></i>
            </button>
            <h3 className="text-xl font-black text-white uppercase">Join Room</h3>
            <div className="space-y-2">
                <input 
                    type="text" 
                    placeholder="PASTE ROOM ID" 
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-white text-center font-mono text-sm focus:outline-none focus:border-amber-500 uppercase transition-all"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                />
                {error && <p className="text-red-500 text-[10px] font-bold uppercase">{error}</p>}
            </div>
            <button 
              onClick={() => onJoin(inputRoomId)}
              disabled={!inputRoomId}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-black font-black uppercase rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/10"
            >
              Connect
            </button>
          </div>
        )}

        {status === 'winner' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex justify-center mb-2 relative">
                <i className="fa-solid fa-crown text-yellow-400 text-5xl md:text-6xl drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]"></i>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">
              {winner === 'left' ? (isVertical ? 'Top' : 'Left') : (isVertical ? 'Bottom' : 'Right')} Player Wins!
            </h2>
            <div className="flex flex-col gap-3">
              {(!peerRole || peerRole === 'host') ? (
                  <button onClick={onStart} className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-black uppercase rounded-xl transition-all active:scale-95">Rematch</button>
              ) : (
                  <div className="py-4 bg-zinc-800 text-zinc-500 font-bold uppercase rounded-xl">Waiting for Rematch...</div>
              )}
              <button onClick={onReset} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase rounded-xl border border-zinc-700 transition-all active:scale-95">Main Menu</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UIOverlay;
