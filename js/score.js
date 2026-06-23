export function calculateScore(playerRanking, answerRanking) {
  const answerIndex = makeRankIndex(answerRanking);
  const playerIndex = makeRankIndex(playerRanking);
  let correctPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < answerRanking.length; i += 1) {
    for (let j = i + 1; j < answerRanking.length; j += 1) {
      const a = answerRanking[i].scoreId;
      const b = answerRanking[j].scoreId;
      const answerOrder = answerIndex.get(a) < answerIndex.get(b);
      const playerOrder = playerIndex.get(a) < playerIndex.get(b);
      if (answerOrder === playerOrder) correctPairs += 1;
      totalPairs += 1;
    }
  }

  const baseScore = Math.floor((correctPairs / totalPairs) * 100);
  const streak = longestCorrectStreak(playerRanking, answerRanking);
  const streakBonus = streak * 2;
  const firstBonus = samePlayer(playerRanking[0], answerRanking[0]) ? 10 : 0;
  const lastBonus = samePlayer(playerRanking[playerRanking.length - 1], answerRanking[answerRanking.length - 1]) ? 20 : 0;
  const total = baseScore + streakBonus + firstBonus + lastBonus;

  return {
    baseScore,
    streakBonus,
    firstBonus,
    lastBonus,
    total,
    correctPairs,
    totalPairs
  };
}

export function rankForScore(score) {
  if (score === 150) return { label: "サッカーの王様級", min: null, max: null, pele: true };
  if (score >= 140) return { label: "OVR90以上級", min: 90, max: 99 };
  if (score >= 120) return { label: "OVR85以上90未満級", min: 85, max: 89 };
  if (score >= 100) return { label: "OVR80以上85未満級", min: 80, max: 84 };
  if (score >= 80) return { label: "OVR75以上80未満級", min: 75, max: 79 };
  if (score >= 60) return { label: "OVR70以上75未満級", min: 70, max: 74 };
  if (score >= 40) return { label: "OVR65以上70未満級", min: 65, max: 69 };
  if (score >= 20) return { label: "OVR60以上65未満級", min: 60, max: 64 };
  return { label: "OVR60未満級", min: 0, max: 59 };
}

function makeRankIndex(ranking) {
  return new Map(ranking.map((player, index) => [player.scoreId, index]));
}

function longestCorrectStreak(playerRanking, answerRanking) {
  let current = 0;
  let longest = 0;
  for (let i = 0; i < answerRanking.length; i += 1) {
    if (samePlayer(playerRanking[i], answerRanking[i])) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function samePlayer(a, b) {
  return a?.scoreId === b?.scoreId;
}
