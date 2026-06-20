import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CategoriasService } from './categorias.service';
import { CrearCategoriaComercialDto } from './dto/crear-categoria-comercial.dto';

@ApiTags('categorias')
@ApiBearerAuth()
@Controller()
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}

  @Get('categorias-fiscales')
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Catálogo de categorías fiscales (determinan el IVA)' })
  listarFiscales() {
    return this.categorias.listarFiscales();
  }

  @Get('categorias-comerciales')
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Categorías comerciales del comercio' })
  listarComerciales(@CurrentUser() actor: AuthenticatedUser) {
    return this.categorias.listarComerciales(actor);
  }

  @Post('categorias-comerciales')
  @RequierePermisos('productos:crear')
  @ApiOperation({ summary: 'Crear una categoría comercial' })
  crearComercial(
    @Body() dto: CrearCategoriaComercialDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.categorias.crearComercial(dto.nombre, actor);
  }
}
