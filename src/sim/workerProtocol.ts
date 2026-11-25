/**
 * Typed Worker <-> Main thread message contract.
 * Uses Ping-Pong Transferable ArrayBuffers (zero SharedArrayBuffer dependency).
 */
import type { GameCommand, InitScenarioPayload } from './core/GameCommand';
import type { TickerDispatch } from './core/SimEngine';
import type { ArmySystemSnapshot } from './systems/armyTypes';
import type { GovernanceSnapshot } from './systems/governanceTypes';
import type { IndustrySnapshot } from './systems/industryTypes';
import type { TechSnapshot } from './systems/techTypes';

export type MainToWorkerMessage =
  | { type: 'INIT'; payload: InitScenarioPayload }
  | { type: 'COMMAND'; command: GameCommand }
  | { type: 'STEP_ONCE' }
  | { type: 'RETURN_BUFFER'; buffer: ArrayBuffer };

export type WorkerToMainMessage =
  | { type: 'READY'; tagOrder: string[] }
  | {
      type: 'SNAPSHOT';
      buffer: ArrayBuffer;
      dispatches?: TickerDispatch[];
      industry?: IndustrySnapshot;
      governance?: GovernanceSnapshot;
      tech?: TechSnapshot;
      army?: ArmySystemSnapshot;
    };
