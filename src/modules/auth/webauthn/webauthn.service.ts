import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../types/authenticated-user';
import { VerificarLoginPasskeyDto, VerificarRegistroPasskeyDto } from './dto/webauthn.dto';

const CHALLENGE_TTL_MS = 5 * 60_000;

/**
 * Login biométrico (WebAuthn/passkeys, huella o Face ID del dispositivo).
 * Dos ceremonias: registro (requiere sesión ya autenticada, vincula una
 * passkey a la cuenta) y login (usernameless/discoverable: el navegador
 * pregunta al SO qué passkey usar sin que el usuario escriba su correo).
 */
@Injectable()
export class WebauthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get rpId(): string {
    return this.config.get<string>('webauthn.rpId') ?? 'localhost';
  }
  private get rpName(): string {
    return this.config.get<string>('webauthn.rpName') ?? 'Fiskaria';
  }
  private get origin(): string[] {
    return this.config.get<string[]>('webauthn.origin') ?? ['http://localhost:3001'];
  }

  // ── Registro (enrolar un dispositivo) ───────────────────────────────────
  async generarOpcionesRegistro(actor: AuthenticatedUser) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: actor.id } });
    const existentes = await this.prisma.credencialWebAuthn.findMany({
      where: { usuarioId: actor.id },
      select: { credentialId: true },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: usuario.email,
      userDisplayName: usuario.nombre,
      attestationType: 'none',
      excludeCredentials: existentes.map((c) => ({ id: c.credentialId })),
      authenticatorSelection: {
        residentKey: 'required', // discoverable: el login no pide correo
        userVerification: 'required', // exige biometría real, no solo "presencia"
        authenticatorAttachment: 'platform', // sensor del dispositivo, no llave USB
      },
    });

    await this.guardarChallenge(options.challenge, actor.id);
    return options;
  }

  async verificarRegistro(actor: AuthenticatedUser, dto: VerificarRegistroPasskeyDto) {
    const verificacion = await verifyRegistrationResponse({
      response: dto.response,
      expectedChallenge: (challenge) => this.consumirChallenge(challenge, actor.id),
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
    });

    if (!verificacion.verified || !verificacion.registrationInfo) {
      throw new BadRequestException('No se pudo verificar la passkey');
    }

    const { credential } = verificacion.registrationInfo;
    await this.prisma.credencialWebAuthn.create({
      data: {
        usuarioId: actor.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceLabel: dto.deviceLabel,
      },
    });

    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: actor.contribuyenteId,
      accion: 'webauthn_registrar',
      entidad: 'credencial_webauthn',
      entidadId: credential.id,
    });

    return { mensaje: 'Passkey registrada' };
  }

  // ── Login (usernameless / discoverable credential) ──────────────────────
  async generarOpcionesLogin() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'required',
      // Sin allowCredentials: el navegador deja elegir al SO cualquier passkey
      // guardada para este rpID (flujo "sin usuario" que dispara el botón).
    });

    await this.guardarChallenge(options.challenge, null);
    return options;
  }

  async verificarLogin(dto: VerificarLoginPasskeyDto, ip?: string) {
    const credencial = await this.prisma.credencialWebAuthn.findUnique({
      where: { credentialId: dto.response.id },
      include: { usuario: true },
    });
    if (!credencial) {
      throw new UnauthorizedException('Passkey no reconocida');
    }
    const { usuario } = credencial;
    if (!usuario.activo || usuario.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const verificacion = await verifyAuthenticationResponse({
      response: dto.response,
      expectedChallenge: (challenge) => this.consumirChallenge(challenge, null),
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      credential: {
        id: credencial.credentialId,
        publicKey: new Uint8Array(credencial.publicKey),
        counter: Number(credencial.counter),
      },
    });

    if (!verificacion.verified) {
      throw new UnauthorizedException('No se pudo verificar la passkey');
    }

    await this.prisma.credencialWebAuthn.update({
      where: { id: credencial.id },
      data: { counter: BigInt(verificacion.authenticationInfo.newCounter), lastUsedAt: new Date() },
    });
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });
    await this.auditoria.registrar({
      usuarioId: usuario.id,
      contribuyenteId: usuario.contribuyenteId,
      ip,
      accion: 'login_webauthn',
      entidad: 'usuario',
      entidadId: usuario.id,
    });

    const tokens = await this.auth.emitirTokens(usuario.id, usuario.email);
    return { ...tokens, passwordTemporal: usuario.passwordTemporal };
  }

  // ── Gestión de dispositivos enrolados ────────────────────────────────────
  listarCredenciales(actor: AuthenticatedUser) {
    return this.prisma.credencialWebAuthn.findMany({
      where: { usuarioId: actor.id },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revocarCredencial(actor: AuthenticatedUser, id: string) {
    const { count } = await this.prisma.credencialWebAuthn.deleteMany({
      where: { id, usuarioId: actor.id },
    });
    if (count === 0) {
      throw new BadRequestException('Passkey no encontrada');
    }
    await this.auditoria.registrar({
      usuarioId: actor.id,
      contribuyenteId: actor.contribuyenteId,
      accion: 'webauthn_revocar',
      entidad: 'credencial_webauthn',
      entidadId: id,
    });
    return { mensaje: 'Passkey eliminada' };
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private async guardarChallenge(challenge: string, usuarioId: string | null) {
    await this.prisma.webAuthnChallenge.create({
      data: { challenge, usuarioId, expiraEn: new Date(Date.now() + CHALLENGE_TTL_MS) },
    });
  }

  /** Verifica que el challenge exista, no haya expirado y sea de este usuario (o de nadie, en login). Lo consume (single-use). */
  private async consumirChallenge(challenge: string, usuarioId: string | null): Promise<boolean> {
    const fila = await this.prisma.webAuthnChallenge.findFirst({
      where: { challenge, usuarioId, expiraEn: { gt: new Date() } },
    });
    if (!fila) return false;
    await this.prisma.webAuthnChallenge.delete({ where: { id: fila.id } });
    return true;
  }
}
