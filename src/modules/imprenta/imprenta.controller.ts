import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ImprentaService } from './imprenta.service';

@ApiTags('imprenta')
@ApiBearerAuth()
@Controller('imprenta')
export class ImprentaController {
  constructor(private readonly imprenta: ImprentaService) {}

  @Get('estado')
  @RequierePermisos('facturas:ver')
  @ApiOperation({ summary: 'Estado de conexión con la imprenta digital Sirumatek' })
  estado(@CurrentUser() actor: AuthenticatedUser) {
    const contribuyenteId = actor.contribuyenteId;
    if (!contribuyenteId) {
      throw new ForbiddenException('Solo usuarios de comercio pueden consultar la imprenta');
    }
    return this.imprenta.verificarConexion(contribuyenteId);
  }
}
