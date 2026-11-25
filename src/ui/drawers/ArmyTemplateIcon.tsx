/**
 * Crisp inline SVG miniature NATO-inspired tactical symbol icon for F6 Army Drawer.
 */
import type { BrigadeType } from '../../sim/data/brigadeTemplates';

interface Props {
  type: BrigadeType;
  width?: number;
  height?: number;
}

export function ArmyTemplateIcon({ type, width = 26, height = 18 }: Props) {
  return (
    <svg
      class="army-nato-svg"
      viewBox="0 0 26 18"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="24.5" height="16.5" rx="2" fill="#F8F4E9" stroke="#1E1A16" stroke-width="1.3" />
      {type === 'INF' && (
        <path d="M2.5,2.5 L23.5,15.5 M23.5,2.5 L2.5,15.5" stroke="#1C1814" stroke-width="1.6" stroke-linecap="round" />
      )}
      {type === 'MTN' && (
        <>
          <path d="M2.5,2.5 L23.5,15.5 M23.5,2.5 L2.5,15.5" stroke="#1C1814" stroke-width="1.4" stroke-linecap="round" />
          <polygon points="13,8.2 7.5,16.2 18.5,16.2" fill="#1C1814" />
        </>
      )}
      {type === 'MOT' && (
        <>
          <path d="M2.5,2.5 L23.5,12.5 M23.5,2.5 L2.5,12.5" stroke="#1C1814" stroke-width="1.4" stroke-linecap="round" />
          <circle cx="8.2" cy="14.2" r="2.1" fill="none" stroke="#1C1814" stroke-width="1.35" />
          <circle cx="17.8" cy="14.2" r="2.1" fill="none" stroke="#1C1814" stroke-width="1.35" />
        </>
      )}
      {type === 'ARM' && (
        <rect x="4.5" y="4.5" width="17" height="9" rx="4.5" fill="none" stroke="#1C1814" stroke-width="1.8" />
      )}
      {type === 'ART' && <circle cx="13" cy="9" r="3.9" fill="#1C1814" />}
      {type === 'GAR' && (
        <>
          <path
            d="M7.5,3 H18.5 V10.2 C18.5,13.2 13,15.5 13,15.5 C13,15.5 7.5,13.2 7.5,10.2 Z"
            fill="none"
            stroke="#1C1814"
            stroke-width="1.35"
            stroke-linejoin="round"
          />
          <line x1="8.2" y1="13.8" x2="17.8" y2="4.2" stroke="#1C1814" stroke-width="1.5" stroke-linecap="round" />
        </>
      )}
    </svg>
  );
}
