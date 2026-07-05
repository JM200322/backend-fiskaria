import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TipoProducto } from '@prisma/client';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequierePermisos } from '../auth/decorators/require-permisos.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ReponerStockDto } from './dto/reponer-stock.dto';
import { ProductosService } from './productos.service';

const IMAGENES_PERMITIDAS = ['.jpg', '.jpeg', '.png', '.webp'];

@ApiTags('productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Post()
  @RequierePermisos('productos:crear')
  @ApiOperation({ summary: 'Crear producto/servicio (IVA por categoría fiscal + override)' })
  crear(
    @Body() dto: CrearProductoDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.productos.crear(dto, actor, ip);
  }

  @Get()
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Listar/buscar productos' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoProducto })
  @ApiQuery({ name: 'bajoStock', required: false, type: Boolean })
  @ApiQuery({ name: 'categoriaComercialId', required: false })
  listar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('tipo') tipo?: TipoProducto,
    @Query('bajoStock') bajoStock?: string,
    @Query('categoriaComercialId') categoriaComercialId?: string,
  ) {
    return this.productos.listar(actor, {
      q,
      tipo,
      bajoStock: bajoStock === 'true',
      categoriaComercialId,
    });
  }

  @Get(':id')
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Detalle de un producto' })
  obtener(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.productos.obtener(id, actor);
  }

  @Patch(':id')
  @RequierePermisos('productos:editar')
  @ApiOperation({ summary: 'Actualizar un producto' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarProductoDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.productos.actualizar(id, dto, actor, ip);
  }

  @Post(':id/reponer')
  @RequierePermisos('productos:editar')
  @ApiOperation({ summary: 'Reponer stock (entrada de inventario) — genera asiento automático' })
  reponerStock(
    @Param('id') id: string,
    @Body() dto: ReponerStockDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.productos.reponerStock(id, dto, actor, ip);
  }

  @Get(':id/movimientos')
  @RequierePermisos('productos:ver')
  @ApiOperation({ summary: 'Historial de reposiciones de un producto' })
  historialMovimientos(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.productos.historialMovimientos(id, actor);
  }

  @Post(':id/imagen')
  @RequierePermisos('productos:editar')
  @ApiOperation({ summary: 'Sube la foto del producto (jpg/png/webp, máx. 5MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: diskStorage({
        destination: 'uploads/productos',
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, IMAGENES_PERMITIDAS.includes(extname(file.originalname).toLowerCase()));
      },
    }),
  )
  subirImagen(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Imagen inválida — solo jpg, png o webp, máx. 5MB');
    return this.productos.guardarImagen(id, `/uploads/productos/${file.filename}`, actor);
  }
}
