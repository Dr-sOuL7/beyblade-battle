export type RankTier = {
  name: string;
  colorClass: string;
  emoji: string;
};

export function getRankDetails(elo: number, totalBattles: number): RankTier {
  if (totalBattles < 5) {
    return { name: 'Placement', colorClass: 'text-slate-400', emoji: '⏳' };
  }
  
  if (elo < 1100) return { name: 'Rookie', colorClass: 'text-zinc-400', emoji: '🔰' };
  if (elo < 1300) return { name: 'Rising Blader', colorClass: 'text-blue-400', emoji: '⭐' };
  if (elo < 1500) return { name: 'Spin Warrior', colorClass: 'text-purple-400', emoji: '⚔️' };
  if (elo < 1800) return { name: 'Arena Legend', colorClass: 'text-amber-400', emoji: '🏆' };
  return { name: 'Bey Monarch', colorClass: 'text-rose-500', emoji: '👑' };
}

export function calculateEloChange(player1Elo: number, player2Elo: number, winner: 'p1' | 'p2' | 'draw') {
  const K = 32;
  const p1Expected = 1 / (1 + Math.pow(10, (player2Elo - player1Elo) / 400));
  const p2Expected = 1 / (1 + Math.pow(10, (player1Elo - player2Elo) / 400));

  if (winner === 'draw') {
    // Draws have very little effect to avoid punishment
    const drawK = 8;
    const p1Delta = Math.round(drawK * (0.5 - p1Expected));
    const p2Delta = Math.round(drawK * (0.5 - p2Expected));
    return { p1Delta, p2Delta, newP1Elo: player1Elo + p1Delta, newP2Elo: player2Elo + p2Delta };
  }

  const p1Score = winner === 'p1' ? 1 : 0;
  const p2Score = winner === 'p2' ? 1 : 0;

  let p1Delta = Math.round(K * (p1Score - p1Expected));
  let p2Delta = Math.round(K * (p2Score - p2Expected));

  // Cap extreme punishments to reduce ladder anxiety
  if (p1Delta < -20) p1Delta = -20;
  if (p2Delta < -20) p2Delta = -20;

  return {
    p1Delta,
    p2Delta,
    newP1Elo: player1Elo + p1Delta,
    newP2Elo: player2Elo + p2Delta
  };
}
