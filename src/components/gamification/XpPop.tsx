/** The one small celebratory flourish per contribution — floats up and fades over
 * 700ms (spec §35's .xp-pop keyframes), then disappears. Re-mount with a fresh `key` to
 * replay it for a new award. */
export function XpPop({ amount }: { amount: number }) {
  return <span className="xp-pop">+{amount} XP</span>;
}
