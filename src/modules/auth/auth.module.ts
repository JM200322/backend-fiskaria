import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WebauthnController } from './webauthn/webauthn.controller';
import { WebauthnService } from './webauthn/webauthn.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), AuditoriaModule],
  controllers: [AuthController, WebauthnController],
  providers: [AuthService, JwtStrategy, WebauthnService],
  exports: [AuthService],
})
export class AuthModule {}
