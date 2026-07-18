-- Configuración de imprenta Sirumatek por comercio (URL + token en BD, no hardcode).
ALTER TABLE "contribuyentes" ADD COLUMN "imprenta_base_url" TEXT;
ALTER TABLE "contribuyentes" ADD COLUMN "imprenta_api_token" TEXT;
