import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ApiErrorBody } from '@hearth/contracts';
import type { ZodTypeAny, z } from 'zod';

/**
 * Validates a body or query against a contract schema from @hearth/contracts and returns the
 * parsed (coerced, defaulted) value. Usage: `@Body(new ZodValidationPipe(CreateTaskSchema))`.
 */
@Injectable()
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const flat = result.error.flatten();
    const fieldErrors = flat.fieldErrors as Record<string, string[]>;
    const first = flat.formErrors[0] ?? Object.values(fieldErrors)[0]?.[0] ?? 'Some fields need another look.';
    const body: ApiErrorBody = { error: { code: 'validation.failed', kind: 'validation', message: first, fieldErrors } };
    throw new BadRequestException(body);
  }
}
