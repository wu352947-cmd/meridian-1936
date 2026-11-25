/**
 * Deterministic unidirectional command queue (UI -> SimulationWorker).
 * Pure JSON-serializable payloads for replayability and desync-free simulation.
 */
import type { SimSpeed } from './ClockCalendar';

export type CommandType =
  | 'INIT_SCENARIO'
  | 'SELECT_COUNTRY'
  | 'SET_SPEED'
  | 'TOGGLE_PAUSE'
  | 'SET_DATE';

export interface InitScenarioPayload {
  scenarioId: '1936';
  countryTag: string;
  seed: number;
  startDate?: string;
  paused?: boolean;
  speed?: SimSpeed;
}

export interface SelectCountryPayload {
  countryTag: string;
}

export interface SetSpeedPayload {
  speed: SimSpeed;
}

export interface TogglePausePayload {
  paused?: boolean;
}

export interface SetDatePayload {
  isoDate: string;
}

export type GameCommandPayload =
  | InitScenarioPayload
  | SelectCountryPayload
  | SetSpeedPayload
  | TogglePausePayload
  | SetDatePayload;

export interface GameCommand<T extends CommandType = CommandType> {
  tick: number;
  actorTag: string;
  type: T;
  payload: GameCommandPayload;
}

export class CommandQueue {
  private readonly pending: GameCommand[] = [];
  private readonly history: GameCommand[] = [];

  enqueue(cmd: GameCommand): void {
    this.pending.push(cmd);
  }

  /** Drain commands scheduled at or before currentTick in FIFO order. */
  drainDue(currentTick: number): GameCommand[] {
    if (this.pending.length === 0) return [];
    const due: GameCommand[] = [];
    let writeIdx = 0;
    for (let i = 0; i < this.pending.length; i++) {
      const cmd = this.pending[i]!;
      if (cmd.tick <= currentTick) {
        due.push(cmd);
        this.history.push(cmd);
      } else {
        this.pending[writeIdx++] = cmd;
      }
    }
    this.pending.length = writeIdx;
    return due;
  }

  getHistory(): readonly GameCommand[] {
    return this.history;
  }

  clear(): void {
    this.pending.length = 0;
    this.history.length = 0;
  }
}
