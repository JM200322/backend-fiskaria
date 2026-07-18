import type { Contribuyente } from '@prisma/client';

/** Respuesta pública de contribuyente — nunca incluye el token de imprenta. */
export type ContribuyentePublico = Omit<Contribuyente, 'imprentaApiToken'> & {
  imprentaTokenConfigurado: boolean;
};

export function sanitizarContribuyente(c: Contribuyente): ContribuyentePublico {
  const { imprentaApiToken, ...rest } = c;
  return {
    ...rest,
    imprentaTokenConfigurado: Boolean(imprentaApiToken?.trim()),
  };
}
