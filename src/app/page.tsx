import React from 'react';
import Link from 'next/link';
import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: battles, error } = await supabase
    .from("battles")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <main className="min-h-screen p-6 md:p-12">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-500 uppercase tracking-tighter drop-shadow-sm">
          Beyblade Battle Arena
        </h1>
        <p className="mt-4 text-slate-400 text-lg tracking-wide uppercase font-semibold">
          Live Tournament Broadcast
        </p>
        <div className="mt-6">
          <Link href="/leaderboard" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition shadow-lg border border-slate-700">
            View Global Leaderboard
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {battles?.map((battle) => (
            <Link href={`/battles/${battle.id}`} key={battle.id} className="block group">
              <div className="glass-panel p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/10">
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${
                    battle.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    battle.status === 'finished' ? 'bg-slate-700/50 text-slate-300' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {battle.status}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">Round {battle.round_number}</span>
                </div>
                
                <div className="flex justify-between items-center my-6">
                  <div className="text-center w-5/12">
                    <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest truncate mb-1 bg-blue-500/10 inline-block px-2 py-0.5 rounded-full border border-blue-500/20">[{battle.p1_title || 'Rookie'}]</div>
                    <div className="text-xl font-bold truncate">{battle.player1_username || 'Player 1'}</div>
                    <div className="text-rose-400 text-sm font-mono mt-1">{battle.p1_hp}% HP</div>
                  </div>
                  
                  <div className="text-slate-600 font-black italic text-2xl w-2/12 text-center">VS</div>
                  
                  <div className="text-center w-5/12">
                    <div className="text-[10px] text-rose-400 font-bold uppercase tracking-widest truncate mb-1 bg-rose-500/10 inline-block px-2 py-0.5 rounded-full border border-rose-500/20">[{battle.p2_title || 'Rookie'}]</div>
                    <div className="text-xl font-bold truncate">{battle.player2_username || 'Player 2'}</div>
                    <div className="text-rose-400 text-sm font-mono mt-1">{battle.p2_hp}% HP</div>
                  </div>
                </div>

                {battle.highlights && battle.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {battle.highlights.map((h: string) => (
                      <span key={h} className="text-[9px] uppercase tracking-widest font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                        {h.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {battle.winner && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50 text-center">
                    <span className="text-yellow-400 font-bold uppercase tracking-wide text-sm">
                      {battle.winner === 'draw' ? 'Draw' : `${battle.winner === 'p1' ? battle.player1_username : battle.player2_username} Wins!`}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
          
          {(!battles || battles.length === 0) && (
            <div className="col-span-full text-center py-20 text-slate-500">
              No battles found in the arena. Start a challenge in Telegram!
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
