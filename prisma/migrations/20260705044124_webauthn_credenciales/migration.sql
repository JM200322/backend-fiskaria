-- CreateTable
CREATE TABLE "credenciales_webauthn" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "device_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "credenciales_webauthn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "challenge" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_webauthn_credential_id_key" ON "credenciales_webauthn"("credential_id");

-- CreateIndex
CREATE INDEX "credenciales_webauthn_usuario_id_idx" ON "credenciales_webauthn"("usuario_id");

-- AddForeignKey
ALTER TABLE "credenciales_webauthn" ADD CONSTRAINT "credenciales_webauthn_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
