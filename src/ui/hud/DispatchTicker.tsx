import { simDispatchesSig, tickerExpandedSig, type AppActions } from '../store/simStore';

interface Props {
  actions: AppActions;
}

const KIND_ICON: Record<'info' | 'alert' | 'routine', string> = {
  info: '✦',
  alert: '⚡',
  routine: '◈',
};

export function DispatchTicker({ actions }: Props) {
  const items = simDispatchesSig.value.slice(0, 3);
  const expanded = tickerExpandedSig.value;
  if (items.length === 0) return null;

  return (
    <aside class="dispatch-ticker" aria-label="参谋电报流水纸带">
      <div class="ticker-head">
        <span class="ticker-title">电报流水纸带</span>
        <button
          type="button"
          class="ticker-toggle"
          onClick={() => {
            tickerExpandedSig.value = !expanded;
          }}
        >
          {expanded ? '收起 ▴' : `展开 (${items.length}) ▾`}
        </button>
      </div>

      {expanded && (
        <div class="ticker-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              class={`ticker-row ticker-${item.kind}`}
              onClick={() => {
                if (item.focusTag) actions.focusCountry(item.focusTag, true);
              }}
              title="点击定位相关国家首都"
            >
              <span class="ticker-icon">{KIND_ICON[item.kind]}</span>
              <span class="ticker-date mono-num">{item.dateIso}</span>
              <span class="ticker-text">{item.textZh}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
