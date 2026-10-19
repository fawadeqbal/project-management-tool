import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDomainError, type DomainErrorKind } from '@hearth/domain';
import type { ApiErrorBody } from '@hearth/contracts';
import type { Response } from 'express';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  validation: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  conflict: HttpStatus.CONFLICT,
  limit_reached: HttpStatus.PAYMENT_REQUIRED,
  invariant: HttpStatus.UNPROCESSABLE_ENTITY,
};

const KIND_BY_STATUS: Record<number, ApiErrorBody['error']['kind']> = {
  400: 'validation',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
};

/**
 * Maps every error to the single `ApiErrorBody` envelope. Domain errors keep their code and
 * human message; infrastructure errors become calm, non-leaky messages.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(status).json(body);
  }

  private toResponse(e: unknown): { status: number; body: ApiErrorBody } {
    if (isDomainError(e))
      return {
        status: STATUS_BY_KIND[e.kind],
        body: { error: { code: e.code, kind: e.kind, message: e.message, details: e.details } },
      };

    if (e instanceof HttpException) {
      const status = e.getStatus();
      const response = e.getResponse();
      if (
        typeof response === 'object' &&
        response &&
        'error' in response &&
        typeof (response as ApiErrorBody).error === 'object'
      )
        return { status, body: response as ApiErrorBody };
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? e.message);
      return {
        status,
        body: {
          error: {
            code: `http.${status}`,
            kind: KIND_BY_STATUS[status] ?? 'internal',
            message: Array.isArray(message) ? message.join(' ') : message,
          },
        },
      };
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025')
        return {
          status: 404,
          body: {
            error: {
              code: 'record.not_found',
              kind: 'not_found',
              message: 'We couldn’t find that. It may have been deleted.',
            },
          },
        };
      if (e.code === 'P2002')
        return {
          status: 409,
          body: {
            error: {
              code: 'record.duplicate',
              kind: 'conflict',
              message: 'Something with that name already exists.',
            },
          },
        };
      if (e.code === 'P2003')
        return {
          status: 400,
          body: {
            error: {
              code: 'record.reference',
              kind: 'validation',
              message: 'That refers to something that doesn’t exist.',
            },
          },
        };
    }

    return {
      status: 500,
      body: {
        error: {
          code: 'internal',
          kind: 'internal',
          message: 'Something went wrong on our side. We’ve logged it — please try again.',
        },
      },
    };
  }
}
