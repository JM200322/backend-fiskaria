import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { SigatError } from './sigat.types';

/**
 * Traduce los fallos del adaptador SIGAT a HTTP: un 404 upstream se refleja como
 * 404; el resto (timeout, red, error del API municipal) es un 502 Bad Gateway —
 * el problema está aguas arriba, no en el cliente de Fiskaria.
 */
@Catch(SigatError)
export class SigatExceptionFilter implements ExceptionFilter {
  catch(exception: SigatError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception.codigo === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;

    response.status(status).json({
      error: 'SIGAT',
      mensaje: exception.message,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
