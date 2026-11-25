/**
 * Transient non-blocking 「合围歼灭 ×N 旅」 battle report badge.
 * Auto-hides after 4.5s so it never obstructs the map.
 */
import { useEffect, useState } from 'preact/hooks';
import { autotestModeSig, simCombatSig, simTickSig } from '../store/simStore';

export function WipeoutBanner() {
  const combat = simCombatSig.value;
  const tick = simTickSig.value;
  const autotest = autotestModeSig.value;
  const latest = combat?.recentWipeouts[0] ?? null;
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  useEffect(() => {
    if (!latest || autotest) return;
    const t = setTimeout(() => setDismissedId(latest.id), 4500);
    return () => clearTimeout(t);
  }, [latest?.id, autotest]);

  if (!latest || dismissedId === latest.id) return null;
  // Only show recent wipeouts (within last 8 ticks / 2 sim days)
  if (tick - latest.tick > 8) return null;

  const capTotal = Object.values(latest.equipmentCaptured).reduce((s, n) => s + (n ?? 0), 0);

  return (
    <div class="wipeout-toast-wrap" role="status" aria-live="polite">
      <div class="wipeout-seal-badge">
        <span>合围歼灭 ×{latest.brigadeCount} 旅</span>
        <span class="wipeout-seal-sub">
          {latest.provinceNameZh} · 缴获装备 {capTotal} 件
        </span>
        <button
          type="button"
          class="wipeout-close-btn"
          onClick={() => setDismissedId(latest.id)}
          title="关闭战报徽章"
        >
          ×
        </button>
      </div>
    </div>
  );
}
