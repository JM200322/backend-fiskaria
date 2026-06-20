import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones: formato de error uniforme para toda la API.
 * Útil para el frontend y para la trazabilidad (Épica 22).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Formato de error uniforme del SDD: { error, mensaje } (+ contexto).
    let error = 'INTERNAL_ERROR';
    let mensaje: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        mensaje = res;
        error = exception.name.replace(/Exception$/, '');
      } else {
        const obj = res as Record<string, unknown>;
        mensaje = (obj.message as string | string[]) ?? exception.message;
        error = (obj.error as string) ?? exception.name.replace(/Exception$/, '');
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      error,
      mensaje,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
