export function buildShareText(score, rating, gameCode) {
  const lines = [
    `${score.total}点`,
    `${rating.playerName}級`,
    "",
    "【スコア内訳】",
    `素点 ${score.baseScore}`,
    `連続正解ボーナス ${score.streakBonus}`,
    `1位的中ボーナス ${score.firstBonus}`,
    `最下位的中ボーナス ${score.lastBonus}`,
    "",
    `ゲームコード：${gameCode}`,
    "",
    "#MuchiRank"
  ];
  return lines.join("\n");
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function twitterIntent(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
