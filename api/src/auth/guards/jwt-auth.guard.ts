import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guarda que impede o acesso de usuários não autenticados (sem token JWT válido)
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
