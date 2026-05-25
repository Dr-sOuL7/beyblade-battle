import React from 'react';
import Link from 'next/link';
import { supabase } from "@/lib/supabase";
import { INITIAL_HP, INITIAL_SPIN, MAX_SPECIAL } from "@/lib/combatMatrix";

function AnimatedBar({ value, max, fillClass, label }: { value: number, max: number, fillClass: string, label: string }) {
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="bar-container">
        <div className={`bar-fill ${fillClass}`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}

export default async function BattlePage({ params }: { params: { id: string } }) {
  const { data: battle, error: battleError } = await supabase
    .from("battles")
    .select("*")
    .eq("id", params.id)
    .single();

  const { data: logs, error: logsError } = await supabase
    .from("battle_logs")
    .select("*")
    .eq("battle_id", params.id)
    .order("round_number", { ascending: true });

  if (battleError || !battle) {
    return <div className="p-10 text-center text-rose-500 font-bold text-2xl">Battle not found.</div>;
  }

  const actionIcon = (act: string | null) => {
    switch (act) {
      case 'attack': return '⚔️';
      case 'defend': return '🛡️';
      case 'evade': return '💨';
      case 'special': return '✨';
      default: return '❔';
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-10">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-block mb-6 text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider text-sm transition-colors">
          ← Back to Arena
        </Link>

        {/* Top Arena Header */}
        <div className="glass-panel p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-rose-500/10 w-96 h-96 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 bg-blue-500/10 w-96 h-96 rounded-full blur-3xl -ml-40 -mb-40 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            
            {/* Player 1 Stats */}
            <div className="w-full md:w-5/12">
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest truncate mb-1 bg-blue-500/10 inline-block px-2 py-0.5 rounded-full border border-blue-500/20">[{battle.p1_title || 'Rookie'}]</div>
              <h2 className="text-3xl font-black mb-1 truncate text-blue-100 drop-shadow-sm">{battle.player1_username || 'Player 1'}</h2>
              <div className="text-xs font-mono text-blue-300/60 mb-4 truncate italic">🌀 {battle.p1_bey_name || 'Default Bey'}</div>
              <AnimatedBar value={battle.p1_hp} max={INITIAL_HP} fillClass="hp-fill" label="Health" />
              <AnimatedBar value={battle.p1_spin} max={INITIAL_SPIN} fillClass="spin-fill" label="Spin" />
              <AnimatedBar value={battle.p1_charge} max={MAX_SPECIAL} fillClass="sp-fill" label="Special" />
            </div>

            {/* VS Badge */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-slate-300 to-slate-500 drop-shadow-md">
                VS
              </div>
              <div className="mt-2 uppercase tracking-widest text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                Round {battle.round_number}
              </div>
              {battle.combat_version && (
                <div className="mt-1 text-[9px] text-slate-500 font-mono uppercase tracking-widest">
                  {battle.combat_version}
                </div>
              )}
            </div>

            {/* Player 2 Stats */}
            <div className="w-full md:w-5/12 text-right">
              <div className="text-[10px] text-rose-400 font-bold uppercase tracking-widest truncate mb-1 bg-rose-500/10 inline-block px-2 py-0.5 rounded-full border border-rose-500/20">[{battle.p2_title || 'Rookie'}]</div>
              <h2 className="text-3xl font-black mb-1 truncate text-rose-100 drop-shadow-sm">{battle.player2_username || 'Player 2'}</h2>
              <div className="text-xs font-mono text-rose-300/60 mb-4 truncate italic">🌀 {battle.p2_bey_name || 'Default Bey'}</div>
              <AnimatedBar value={battle.p2_hp} max={INITIAL_HP} fillClass="hp-fill" label="Health" />
              <AnimatedBar value={battle.p2_spin} max={INITIAL_SPIN} fillClass="spin-fill" label="Spin" />
              <AnimatedBar value={battle.p2_charge} max={MAX_SPECIAL} fillClass="sp-fill" label="Special" />
            </div>

          </div>
          
          {battle.highlights && battle.highlights.length > 0 && (
            <div className="mt-8 pt-4 border-t border-slate-700/50 flex flex-wrap gap-3 justify-center">
              {battle.highlights.map((h: string) => (
                <span key={h} className="text-xs uppercase tracking-widest font-bold bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 drop-shadow">
                  ★ {h.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}

          {battle.winner && (
            <div className="mt-8 text-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <h3 className="text-2xl font-black text-amber-400 uppercase tracking-widest drop-shadow">
                {battle.winner === 'draw' ? 'DRAW!' : `${battle.winner === 'p1' ? battle.player1_username : battle.player2_username} WINS!`}
              </h3>
            </div>
          )}
        </div>

        {/* Timeline Log */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
            <span className="w-6 h-1 bg-blue-500 rounded-full"></span>
            Battle Timeline
            <span className="w-6 h-1 bg-rose-500 rounded-full"></span>
          </h3>

          {logs?.map((log) => (
            <div key={log.id} className="glass-panel p-5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-600 group-hover:bg-amber-400 transition-colors"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Round {log.round_number}
                  </div>
                  <div className="text-lg leading-relaxed text-slate-200" dangerouslySetInnerHTML={{ __html: log.result_text || 'No description available.' }} />
                </div>
                
                <div className="shrink-0 flex gap-6 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">P1 Action</div>
                    <div className="text-2xl" title={log.p1_action}>{actionIcon(log.p1_action)}</div>
                    <div className="text-[10px] text-rose-400 font-mono mt-1 space-y-0.5">
                      {log.p1_hp_loss > 0 && <div>-{log.p1_hp_loss}HP</div>}
                      {log.p1_spin_loss > 0 && <div>-{log.p1_spin_loss}SPIN</div>}
                      {log.p1_special_delta > 0 && <div className="text-amber-400">+{log.p1_special_delta}SP</div>}
                      {log.p1_action === 'special' && <div className="text-purple-400">SP USED</div>}
                    </div>
                    {/* After-state snapshot */}
                    {log.p1_hp_after !== null && log.p1_hp_after !== undefined && (
                      <div className="text-[9px] text-slate-500 font-mono mt-2 border-t border-slate-700/50 pt-1">
                        <div>❤️{log.p1_hp_after}</div>
                        <div>🌀{log.p1_spin_after}</div>
                        <div>⚡{log.p1_special_after}</div>
                      </div>
                    )}
                  </div>
                  <div className="w-px bg-slate-700"></div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">P2 Action</div>
                    <div className="text-2xl" title={log.p2_action}>{actionIcon(log.p2_action)}</div>
                    <div className="text-[10px] text-rose-400 font-mono mt-1 space-y-0.5">
                      {log.p2_hp_loss > 0 && <div>-{log.p2_hp_loss}HP</div>}
                      {log.p2_spin_loss > 0 && <div>-{log.p2_spin_loss}SPIN</div>}
                      {log.p2_special_delta > 0 && <div className="text-amber-400">+{log.p2_special_delta}SP</div>}
                      {log.p2_action === 'special' && <div className="text-purple-400">SP USED</div>}
                    </div>
                    {/* After-state snapshot */}
                    {log.p2_hp_after !== null && log.p2_hp_after !== undefined && (
                      <div className="text-[9px] text-slate-500 font-mono mt-2 border-t border-slate-700/50 pt-1">
                        <div>❤️{log.p2_hp_after}</div>
                        <div>🌀{log.p2_spin_after}</div>
                        <div>⚡{log.p2_special_after}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {(!logs || logs.length === 0) && (
            <div className="text-center p-10 text-slate-500 font-bold uppercase tracking-widest">
              Waiting for round 1 to finish...
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
