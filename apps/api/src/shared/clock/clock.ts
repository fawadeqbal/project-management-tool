import { SystemClock, type Clock } from '@hearth/domain';

/** Injection token for the domain `Clock` port. Handlers inject it instead of calling `new Date()`. */
export const CLOCK = Symbol('Clock');
export type { Clock };

export const clockProvider = { provide: CLOCK, useClass: SystemClock };
