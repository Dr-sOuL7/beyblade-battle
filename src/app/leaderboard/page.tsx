import { supabase } from '@/lib/supabase';
import { getRankDetails } from '@/lib/ranking';
import Link from 'next/link';

// Prevent static generation caching
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('elo', { ascending: false })
    .limit(50);

  if (error) {
    return <div className="p-8 text-rose-500">Failed to load leaderboard.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-rose-400 tracking-tight drop-shadow-sm">
              GLOBAL LEADERBOARD
            </h1>
            <p className="text-slate-400 mt-2 font-medium tracking-wide">Top 50 Bladers Worldwide</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition shadow-lg border border-slate-700">
            Back to Arena
          </Link>
        </header>

        <div className="bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/80 text-slate-300 text-xs uppercase tracking-widest">
                <th className="px-6 py-4 font-bold">Rank</th>
                <th className="px-6 py-4 font-bold">Blader</th>
                <th className="px-6 py-4 font-bold text-center">Record</th>
                <th className="px-6 py-4 font-bold text-center">Streak</th>
                <th className="px-6 py-4 font-bold text-right">ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {users?.map((user, index) => {
                const rank = getRankDetails(user.elo, user.total_battles);
                const winRate = user.total_battles > 0 ? Math.round((user.wins / user.total_battles) * 100) : 0;
                
                return (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-xl font-black ${index < 3 ? 'text-amber-400' : 'text-slate-500'}`}>#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{rank.emoji}</span>
                          <span className="text-lg font-bold truncate text-slate-100">{user.username || 'Unknown'}</span>
                          {user.win_streak >= 5 && (
                            <span className="text-[10px] uppercase tracking-widest font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30 shrink-0">
                              🔥 {user.win_streak} STREAK
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs uppercase tracking-widest font-bold ${rank.colorClass}`}>
                            [{rank.name}]
                          </span>
                          <span className="text-xs text-slate-500 font-mono italic truncate">
                            🌀 {user.bey_name || 'Default Bey'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-mono font-bold text-slate-300">
                        {user.wins}W - {user.losses}L
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{winRate}% WR</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm font-bold text-slate-300">{user.win_streak} 🔥</div>
                      <div className="text-xs text-slate-500 mt-1">Best: {user.highest_win_streak}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`text-xl font-black ${rank.colorClass}`}>{user.elo}</div>
                      <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{user.total_battles} Matches</div>
                    </td>
                  </tr>
                );
              })}
              
              {users?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold italic">
                    No ranked bladers yet. Let it rip!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
