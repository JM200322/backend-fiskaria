import { ACTIVIDADES_ECONOMICAS, METODOS_PAGO, resolverCatalogo } from './sigat.catalogos';

describe('resolverCatalogo', () => {
  it('resuelve códigos conocidos a su nombre', () => {
    expect(resolverCatalogo(METODOS_PAGO, [4, 1])).toEqual([
      { id: 4, nombre: 'Pago móvil' },
      { id: 1, nombre: 'Pago en línea' },
    ]);
    expect(resolverCatalogo(ACTIVIDADES_ECONOMICAS, [1])).toEqual([
      { id: 1, nombre: 'Actividades Económicas' },
    ]);
  });

  it('degrada códigos desconocidos a "Código N" sin perderlos', () => {
    expect(resolverCatalogo(METODOS_PAGO, [999])).toEqual([{ id: 999, nombre: 'Código 999' }]);
  });

  it('acepta undefined como lista vacía', () => {
    expect(resolverCatalogo(METODOS_PAGO, undefined)).toEqual([]);
  });
});
