/**
 * Shared Authentic 14-Second Hong Kong Transport Department Traffic Signal Clock.
 *
 * Uses phase offset +2.1s so hero t = 0.25 (sigT = 2.35s) remains in
 * Vehicle RED + Pedestrian STEADY GREEN MAN.
 *
 * 5-stage (4-vehicle-phase) authentic HK cycle with ZERO overlap between
 * Vehicle Red+Amber and Pedestrian Flashing Green Man:
 *   - 0.0 <= sigT < 5.2 : Vehicle RED       | Ped STEADY_GREEN   (1.25 Hz crossing audio, puddle red)
 *   - 5.2 <= sigT < 7.7 : Vehicle RED       | Ped FLASHING_GREEN (2.8 Hz flash, 6.25 Hz audio, puddle red)
 *   - 7.7 <= sigT < 9.0 : Vehicle RED_AMBER | Ped RED            (pre-green warning, silent, puddle amber-red)
 *   - 9.0 <= sigT < 12.6: Vehicle GREEN     | Ped RED            (silent, puddle green)
 *   - 12.6 <= sigT < 14.0: Vehicle AMBER    | Ped RED            (silent, puddle amber)
 */

export type HKVehicleSignalPhase = 'RED' | 'RED_AMBER' | 'GREEN' | 'AMBER';
export type HKPedSignalPhase = 'STEADY_GREEN' | 'FLASHING_GREEN' | 'RED';

export interface HKSignalState {
  sigClock: number;
  sigT: number;
  cycleIndex: number;
  vehicle: HKVehicleSignalPhase;
  ped: HKPedSignalPhase;
  pedFlashOn: boolean;
  crossingAudioActive: boolean;
  crossingAudioUrgent: boolean;
  crossingAudioInterval: number;
}

export const HK_SIGNAL_CYCLE_SEC = 14.0;
export const HK_SIGNAL_PHASE_OFFSET_SEC = 2.1;
export const HK_PED_FLASH_START_SEC = 5.2;

export function getHKSignalState(simTime: number): HKSignalState {
  const sigClock = simTime + HK_SIGNAL_PHASE_OFFSET_SEC;
  const sigT = ((sigClock % HK_SIGNAL_CYCLE_SEC) + HK_SIGNAL_CYCLE_SEC) % HK_SIGNAL_CYCLE_SEC;
  const cycleIndex = Math.floor(sigClock / HK_SIGNAL_CYCLE_SEC);

  if (sigT < HK_PED_FLASH_START_SEC) {
    return {
      sigClock,
      sigT,
      cycleIndex,
      vehicle: 'RED',
      ped: 'STEADY_GREEN',
      pedFlashOn: true,
      crossingAudioActive: true,
      crossingAudioUrgent: false,
      crossingAudioInterval: 0.80 // 1.25 Hz steady green man piezo cadence
    };
  }

  if (sigT < 7.7) {
    return {
      sigClock,
      sigT,
      cycleIndex,
      vehicle: 'RED',
      ped: 'FLASHING_GREEN',
      pedFlashOn: Math.sin(simTime * Math.PI * 5.6) > 0, // 2.8 Hz visual flash
      crossingAudioActive: true,
      crossingAudioUrgent: true,
      crossingAudioInterval: 0.16 // 6.25 Hz urgent flashing green man piezo cadence
    };
  }

  if (sigT < 9.0) {
    return {
      sigClock,
      sigT,
      cycleIndex,
      vehicle: 'RED_AMBER',
      ped: 'RED',
      pedFlashOn: false,
      crossingAudioActive: false,
      crossingAudioUrgent: false,
      crossingAudioInterval: 0
    };
  }

  if (sigT < 12.6) {
    return {
      sigClock,
      sigT,
      cycleIndex,
      vehicle: 'GREEN',
      ped: 'RED',
      pedFlashOn: false,
      crossingAudioActive: false,
      crossingAudioUrgent: false,
      crossingAudioInterval: 0
    };
  }

  return {
    sigClock,
    sigT,
    cycleIndex,
    vehicle: 'AMBER',
    ped: 'RED',
    pedFlashOn: false,
    crossingAudioActive: false,
    crossingAudioUrgent: false,
    crossingAudioInterval: 0
  };
}
