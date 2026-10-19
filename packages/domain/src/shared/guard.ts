import { ValidationError } from './errors';

/** Small assertion helpers that throw ValidationErrors in the Hearth voice. */
export const Guard = {
  notBlank(value: string | null | undefined, field: string): string {
    const v = (value ?? '').trim();
    if (!v) throw new ValidationError(`${field}.required`, `Add a ${field} — it can’t be empty.`, { field });
    return v;
  },
  maxLength(value: string, max: number, field: string): string {
    if (value.length > max)
      throw new ValidationError(`${field}.too_long`, `Keep the ${field} under ${max} characters.`, { field, max });
    return value;
  },
  inRange(value: number, min: number, max: number, field: string): number {
    if (!Number.isFinite(value) || value < min || value > max)
      throw new ValidationError(`${field}.out_of_range`, `${field} must be between ${min} and ${max}.`, { field, min, max });
    return value;
  },
};
