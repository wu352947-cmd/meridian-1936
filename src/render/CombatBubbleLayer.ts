/**
 * Screen-space PixiJS CombatBubbleLayer: original crossed-bayonet staff stamps
 * colored by advantage side, displaying attacker advantage score. Click opens BattleReportDrawer.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ProvinceBattleSnap } from '../sim/systems/combatTypes';
import type { EuropeMapMeta, ProvinceRecord } from '../types/map';

const SCORE_STYLE = new TextStyle({
  fontFamily: 'MeridianMono, "JetBrains Mono", monospace',
  fontSize: 10.5,
  fontWeight: '700',
  fill: '#FAF3E4',
});

interface StampHitBox {
  battle: ProvinceBattleSnap;
  sx: number;
  sy: number;
  r: number;
}

export class CombatBubbleLayer {
  readonly root = new Container();
  private readonly provById = new Map<number, ProvinceRecord>();
  private battles: ProvinceBattleSnap[] = [];
  private playerTag = 'GER';
  private selectedProvId: number | null = null;
  private hitBoxes: StampHitBox[] = [];
  private cam = { x: 1880, y: 1580, zoom: 1.0, vw: 1440, vh: 900 };

  constructor(meta: EuropeMapMeta) {
    for (const p of meta.provinces) this.provById.set(p.id, p);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  setData(battles: ProvinceBattleSnap[], playerTag: string, selectedProvId: number | null): void {
    this.battles = battles;
    this.playerTag = playerTag;
    this.selectedProvId = selectedProvId;
    this.rebuild();
  }

  updateCamera(camX: number, camY: number, zoom: number, vw: number, vh: number): void {
    this.cam = { x: camX, y: camY, zoom, vw, vh };
    this.rebuild();
  }

  hitTestPoint(sx: number, sy: number): ProvinceBattleSnap | null {
    if (!this.root.visible) return null;
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const h = this.hitBoxes[i]!;
      if (Math.hypot(sx - h.sx, sy - h.sy) <= h.r + 5) return h.battle;
    }
    return null;
  }

  private toScreen(wx: number, wy: number): [number, number] {
    const { x, y, zoom, vw, vh } = this.cam;
    return [vw * 0.5 + (wx - x) * zoom, vh * 0.5 + (wy - y) * zoom];
  }

  private rebuild(): void {
    this.root.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.hitBoxes = [];
    if (!this.root.visible || this.battles.length === 0) return;

    const { vw, vh } = this.cam;
    const placed: Array<{ battle: ProvinceBattleSnap; x: number; y: number }> = [];
    for (const b of this.battles) {
      const p = this.provById.get(b.provinceId);
      if (!p) continue;
      const [sx, sy] = this.toScreen(p.cx, p.cy);
      if (sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;
      // Offset cleanly below province counter center so stamp and counter never collide
      placed.push({ battle: b, x: sx, y: sy + 16 });
    }

    // Gentle repulsion between adjacent combat stamps
    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!, b = placed[j]!;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < 42) {
            const nx = d < 0.5 ? 1 : dx / d;
            const ny = d < 0.5 ? 0 : dy / d;
            const push = (42 - d) * 0.52;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
      }
    }

    for (const item of placed) {
      const { battle, x, y } = item;
      const cx = Math.round(x);
      const cy = Math.round(y);
      const r = 15;
      this.hitBoxes.push({ battle, sx: cx, sy: cy, r });

      // Advantage color from player perspective (green winning, brass contested, cinnabar losing)
      const relScore = battle.defenderTag === this.playerTag ? -battle.advantageScore : battle.advantageScore;
      const sealColor = relScore >= 12 ? 0x457d4e : relScore <= -12 ? 0xb5392c : 0xc08a36;
      const selected = this.selectedProvId === battle.provinceId;

      const cont = new Container();
      const g = new Graphics();

      // Shadow + optional gold selection ring
      g.circle(1.5, 2.5, r + 1).fill({ color: 0x100d0a, alpha: 0.48 });
      if (selected) {
        g.circle(0, 0, r + 3.5).stroke({ width: 2.4, color: 0xf2cb6c, alpha: 0.98 });
      }

      // Wax/mineral colored outer stamp ring + linen parchment center
      g.circle(0, 0, r).fill(sealColor).stroke({ width: 1.5, color: 0x1c1713 });
      g.circle(0, 0, r - 3.6).fill(0xf5eedf).stroke({ width: 0.9, color: 0x3b3128, alpha: 0.72 });

      // Original crossed bayonets vector motif inside the seal
      g.moveTo(-6.2, 6.2).lineTo(6.5, -6.5).stroke({ width: 1.85, color: 0x1e1813, cap: 'round' });
      g.moveTo(6.2, 6.2).lineTo(-6.5, -6.5).stroke({ width: 1.85, color: 0x1e1813, cap: 'round' });
      // Crossguards near hilts
      g.moveTo(-5.8, 2.6).lineTo(-2.6, 5.8).stroke({ width: 1.4, color: sealColor, cap: 'round' });
      g.moveTo(5.8, 2.6).lineTo(2.6, 5.8).stroke({ width: 1.4, color: sealColor, cap: 'round' });

      // Bottom numeric advantage score pill (shows attacker advantage value)
      const scoreText = battle.advantageScore >= 0 ? `+${battle.advantageScore}` : `${battle.advantageScore}`;
      g.roundRect(-16, r - 4.5, 32, 13, 3.5).fill(0x211b16).stroke({ width: 1.1, color: sealColor });

      const txt = new Text({ text: scoreText, style: SCORE_STYLE });
      txt.resolution = 2;
      txt.anchor.set(0.5, 0.5);
      txt.position.set(0, r + 2);

      cont.addChild(g, txt);
      cont.position.set(cx, cy);
      this.root.addChild(cont);
    }
  }
}
