import { Injectable, PipeTransform } from '@nestjs/common';

const BOOLEAN_KEYS = ['overdue', 'includeDone', 'includeSubtasks'] as const;

/**
 * The contract coerces query booleans with `z.coerce.boolean()`, for which the string "false"
 * is truthy. Runs before the contract pipe so `?includeDone=false` (and "0", "no", "") means false.
 */
@Injectable()
export class QueryBooleansPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const query = { ...(value as Record<string, unknown>) };
    for (const key of BOOLEAN_KEYS) {
      const v = query[key];
      if (typeof v === 'string' && ['false', '0', 'no', 'off', ''].includes(v.trim().toLowerCase())) query[key] = false;
    }
    return query;
  }
}
