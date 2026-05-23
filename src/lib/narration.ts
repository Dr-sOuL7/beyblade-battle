export function getRoundNarration(p1: string, p2: string, act1: string, act2: string, isClimax: boolean = false): string {
  const key = `${act1}-${act2}`;
  
  const narrations: Record<string, ((p1: string, p2: string) => string)[]> = {
    'attack-attack': [
      (a, b) => `💥 Violent clash! <b>${a}</b> and <b>${b}</b> trade heavy blows!`,
      (a, b) => `⚔️ Sparks fly as <b>${a}</b> and <b>${b}</b> collide head-on!`,
      (a, b) => `⚡ Massive impact! Both <b>${a}</b> and <b>${b}</b> refuse to back down!`,
    ],
    'attack-defend': [
      (a, b) => `💥 <b>${a}</b> smashes heavily into <b>${b}</b>'s guard!`,
      (a, b) => `🛡️ <b>${b}</b> braces for impact against <b>${a}</b>'s assault!`,
      (a, b) => `⚔️ <b>${a}</b>'s attack rattles <b>${b}</b>'s defenses!`,
    ],
    'attack-evade': [
      (a, b) => `💨 <b>${b}</b> swiftly dodges <b>${a}</b>'s attack!`,
      (a, b) => `✨ <b>${a}</b> strikes empty air as <b>${b}</b> slips away!`,
      (a, b) => `🌀 <b>${b}</b> circles around <b>${a}</b>'s aggressive rush!`,
    ],
    'defend-attack': [
      (a, b) => `💥 <b>${b}</b> smashes heavily into <b>${a}</b>'s guard!`,
      (a, b) => `🛡️ <b>${a}</b> braces for impact against <b>${b}</b>'s assault!`,
      (a, b) => `⚔️ <b>${b}</b>'s attack rattles <b>${a}</b>'s defenses!`,
    ],
    'defend-defend': [
      (a, b) => `🛡️ Both <b>${a}</b> and <b>${b}</b> take a defensive stance. The arena is tense.`,
      (a, b) => `👁️ <b>${a}</b> and <b>${b}</b> circle each other, waiting for an opening.`,
    ],
    'defend-evade': [
      (a, b) => `💨 <b>${b}</b> backs away while <b>${a}</b> holds their guard.`,
      (a, b) => `🛡️ <b>${a}</b> plays it safe while <b>${b}</b> keeps their distance.`,
    ],
    'evade-attack': [
      (a, b) => `💨 <b>${a}</b> swiftly dodges <b>${b}</b>'s attack!`,
      (a, b) => `✨ <b>${b}</b> strikes empty air as <b>${a}</b> slips away!`,
      (a, b) => `🌀 <b>${a}</b> circles around <b>${b}</b>'s aggressive rush!`,
    ],
    'evade-defend': [
      (a, b) => `💨 <b>${a}</b> backs away while <b>${b}</b> holds their guard.`,
      (a, b) => `🛡️ <b>${b}</b> plays it safe while <b>${a}</b> keeps their distance.`,
    ],
    'evade-evade': [
      (a, b) => `💨 Both <b>${a}</b> and <b>${b}</b> create distance.`,
      (a, b) => `🌀 A highly evasive dance between <b>${a}</b> and <b>${b}</b>.`,
    ],
  };

  const climaxNarrations: Record<string, ((p1: string, p2: string) => string)[]> = {
    'attack-attack': [
      (a, b) => `💥 <b>B-B-BREAK!</b> A deafening clash shakes the stadium as <b>${a}</b> and <b>${b}</b> collide!`,
      (a, b) => `⚔️ <b>F-F-FURIOUS!</b> Sparks ignite the arena! <b>${a}</b> and <b>${b}</b> are going all out!`,
    ],
    'attack-defend': [
      (a, b) => `💥 <b>S-S-SMASH!</b> <b>${a}</b> ruthlessly hammers into <b>${b}</b>'s critical defense!`,
    ],
    'attack-evade': [
      (a, b) => `💨 <b>W-W-WHOOSH!</b> <b>${b}</b> barely avoids a catastrophic hit from <b>${a}</b>!`,
    ],
    'defend-attack': [
      (a, b) => `💥 <b>S-S-SMASH!</b> <b>${b}</b> ruthlessly hammers into <b>${a}</b>'s critical defense!`,
    ],
    'evade-attack': [
      (a, b) => `💨 <b>W-W-WHOOSH!</b> <b>${a}</b> barely avoids a catastrophic hit from <b>${b}</b>!`,
    ]
  };

  if (act1 === 'special' && act2 === 'special') {
    return `✨💥 <b>U-U-ULTIMATE CLASH!</b> Both <b>${p1}</b> and <b>${p2}</b> unleash their specials!`;
  }
  
  if (act1 === 'special') {
    return `✨ <b>${p1}</b> unleashes a devastating Special Move!`;
  }

  if (act2 === 'special') {
    return `✨ <b>${p2}</b> unleashes a devastating Special Move!`;
  }

  let options = narrations[key];
  
  // Upgrade to climax narrations if available and applicable
  if (isClimax && climaxNarrations[key]) {
    options = climaxNarrations[key];
  }

  if (!options) return `⚔️ <b>${p1}</b> (${act1}) vs <b>${p2}</b> (${act2})`;

  const choice = options[Math.floor(Math.random() * options.length)];
  return choice(p1, p2);
}
