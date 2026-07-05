import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { ImprentaService } from './imprenta.service';

@ApiTags('imprenta')
@ApiBearerAuth()
@Controller('imprenta')
export class ImprentaController {
  constructor(private readonly imprenta: ImprentaService) {}

  @Get('estado')
  @RequierePermisos('facturas:ver')
  @ApiOperation({ summary: 'Estado de conexión con la imprenta digital Sirumatek' })
  estado() {
    return this.imprenta.verificarConexion();
  }
}
