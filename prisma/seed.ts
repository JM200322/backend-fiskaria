import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Catálogo de permisos por módulo. El permiso efectivo es `modulo:accion`.
 * Se irá ampliando a medida que avancen los módulos del SDD.
 */
const PERMISOS: Record<string, string[]> = {
  dashboard: ['ver'],
  contribuyentes: ['ver', 'crear', 'editar', 'validar'], // alta/validación: solo Sirumatek
  'puntos-emision': ['ver', 'crear', 'editar'],
  facturas: ['ver', 'crear', 'anular'],
  ventas: ['ver', 'crear', 'anular'],
  compras: ['ver', 'crear', 'anular'],
  inventario: ['ver', 'ajustar'],
  productos: ['ver', 'crear', 'editar', 'eliminar'],
  terceros: ['ver', 'crear', 'editar', 'eliminar'], // clientes/proveedores (RN-104)
  contabilidad: ['ver', 'crear', 'cerrar_periodo'],
  seniat: ['ver', 'declarar'],
  municipales: ['ver', 'crear', 'pagar'],
  reportes: ['ver'],
  usuarios: ['ver', 'crear', 'editar', 'eliminar'],
  roles: ['ver', 'crear', 'editar', 'eliminar'],
  configuracion: ['ver', 'editar'],
};

/**
 * Roles semilla (RN-013 + ADR-0002). `modulos` define a qué módulos accede el rol
 * (con todas sus acciones), o 'TODOS', o una lista de permisos exactos en `permisos`.
 */
const ROLES: Record<
  string,
  {
    descripcion: string;
    modulos?: string[] | 'TODOS';
    soloLectura?: boolean;
    excepto?: string[]; // permisos exactos `modulo:accion` a excluir
  }
> = {
  Administrador: {
    descripcion: 'Gestión completa del comercio (todos los módulos)',
    modulos: 'TODOS',
    // El alta/edición/validación de comercios es exclusiva de Sirumatek (RN-134).
    excepto: ['contribuyentes:crear', 'contribuyentes:editar', 'contribuyentes:validar'],
  },
  Operador: {
    descripcion: 'Operación diaria: ventas, facturación, inventario, clientes',
    modulos: ['dashboard', 'facturas', 'ventas', 'inventario', 'productos', 'terceros'],
  },
  Fiscal: {
    descripcion: 'Inspección SENIAT: solo lectura de libros, documentos y declaraciones',
    soloLectura: true, // solo permisos de acción "ver"
  },
  Sirumatek: {
    descripcion: 'Soporte del sistema (acceso multi-comercio, auditado)',
    modulos: 'TODOS',
  },
};

async function main() {
  console.log('🌱 Permisos...');
  for (const [modulo, acciones] of Object.entries(PERMISOS)) {
    for (const accion of acciones) {
      await prisma.permiso.upsert({
        where: { modulo_accion: { modulo, accion } },
        update: {},
        create: { modulo, accion },
      });
    }
  }
  const todosLosPermisos = await prisma.permiso.findMany();

  console.log('🌱 Roles...');
  for (const [nombre, def] of Object.entries(ROLES)) {
    const rol = await prisma.rol.upsert({
      where: { nombre },
      update: { descripcion: def.descripcion },
      create: { nombre, descripcion: def.descripcion },
    });

    let permisosDelRol = todosLosPermisos;
    if (def.soloLectura) {
      permisosDelRol = todosLosPermisos.filter((p) => p.accion === 'ver');
    } else if (def.modulos && def.modulos !== 'TODOS') {
      const mods = def.modulos;
      permisosDelRol = todosLosPermisos.filter((p) => mods.includes(p.modulo));
    }
    if (def.excepto?.length) {
      const excluir = new Set(def.excepto);
      permisosDelRol = permisosDelRol.filter((p) => !excluir.has(`${p.modulo}:${p.accion}`));
    }

    for (const permiso of permisosDelRol) {
      await prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      });
    }
  }

  // Categorías fiscales (catálogo global, RN-102).
  // ⚠️ PROVISIONAL: lista por confirmar con el revisor fiscal (pregunta abierta módulo 5).
  console.log('🌱 Categorías fiscales...');
  const CATEGORIAS_FISCALES: { nombre: string; alicuotaIva: number }[] = [
    { nombre: 'Gravado general', alicuotaIva: 16 },
    { nombre: 'Gravado reducida', alicuotaIva: 8 },
    { nombre: 'Gravado adicional (lujo)', alicuotaIva: 31 },
    { nombre: 'Exento', alicuotaIva: 0 },
    { nombre: 'Exonerado', alicuotaIva: 0 },
  ];
  for (const cf of CATEGORIAS_FISCALES) {
    await prisma.categoriaFiscal.upsert({
      where: { nombre: cf.nombre },
      update: { alicuotaIva: cf.alicuotaIva },
      create: cf,
    });
  }

  console.log('🌱 Contribuyente demo...');
  const contribuyente = await prisma.contribuyente.upsert({
    where: { rif: 'J-00000000-0' },
    update: {},
    create: {
      rif: 'J-00000000-0',
      razonSocial: 'Comercio Demo, C.A.',
      tipoContribuyente: 'ORDINARIO',
      agenteRetencion: false,
      periodoIva: 'MENSUAL',
      domicilioFiscal: 'Caracas, Venezuela',
      validado: true, // en dev lo damos por validado; en real lo valida la API SENIAT (RN-101)
    },
  });

  // Punto de emisión por defecto del comercio demo + sus contadores (RN-123/128).
  console.log('🌱 Punto de emisión demo...');
  const punto = await prisma.puntoEmision.upsert({
    where: { contribuyenteId_codigo: { contribuyenteId: contribuyente.id, codigo: '01' } },
    update: {},
    create: { contribuyenteId: contribuyente.id, codigo: '01', nombre: 'Sucursal Principal' },
  });
  for (const tipo of [
    'FACTURA',
    'NOTA_CREDITO',
    'NOTA_DEBITO',
    'GUIA_DESPACHO',
    'RETENCION_IVA',
    'RETENCION_ISLR',
  ] as const) {
    await prisma.secuenciaDocumento.upsert({
      where: { puntoEmisionId_tipo: { puntoEmisionId: punto.id, tipo } },
      update: {},
      create: { puntoEmisionId: punto.id, tipo },
    });
  }

  console.log('🌱 Usuarios...');
  // Administrador del comercio demo.
  const adminComercio = await prisma.usuario.upsert({
    where: { email: 'admin@sirumatek.com' },
    update: {},
    create: {
      email: 'admin@sirumatek.com',
      nombre: 'Administrador Comercio',
      passwordHash: await bcrypt.hash('Admin1234', 10),
      contribuyenteId: contribuyente.id,
    },
  });
  await asignarRol(adminComercio.id, 'Administrador');

  // Usuario de soporte de Sirumatek (sin contribuyente: acceso multi-comercio, RN-125).
  const soporte = await prisma.usuario.upsert({
    where: { email: 'soporte@sirumatek.com' },
    update: {},
    create: {
      email: 'soporte@sirumatek.com',
      nombre: 'Soporte Sirumatek',
      passwordHash: await bcrypt.hash('Soporte1234', 10),
      contribuyenteId: null,
    },
  });
  await asignarRol(soporte.id, 'Sirumatek');

  console.log('\n✅ Seed completado.');
  console.log('   Comercio:  admin@sirumatek.com / Admin1234   (rol Administrador)');
  console.log('   Soporte:   soporte@sirumatek.com / Soporte1234 (rol Sirumatek)');
  console.log('   (cambiar contraseñas en producción)');
}

async function asignarRol(usuarioId: string, nombreRol: string) {
  const rol = await prisma.rol.findUnique({ where: { nombre: nombreRol } });
  if (!rol) return;
  await prisma.usuarioRol.upsert({
    where: { usuarioId_rolId: { usuarioId, rolId: rol.id } },
    update: {},
    create: { usuarioId, rolId: rol.id },
  });
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
