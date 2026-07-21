import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

// Módulo responsável por agrupar e configurar os serviços de Autenticação JWT
@Module({
  imports: [
    PassportModule,
    // Registra e configura a chave secreta do JWT e tempo de expiração vindos do .env
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key-adorne-semijoias',
      signOptions: { expiresIn: (process.env.JWT_EXPIRATION as any) || '7d' },
    }),
  ],
  controllers: [AuthController],         // Disponibiliza o controller de Login (/auth/login)
  providers: [AuthService, JwtStrategy], // Registra a lógica de login e decodificação do JWT
  exports: [AuthService],                // Permite exportar o serviço de login para outros módulos
})
export class AuthModule {}
