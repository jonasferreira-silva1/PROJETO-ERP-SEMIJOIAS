import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';

// Interface representando a estrutura de dados que está embutida no Token JWT
interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  lojaId: number;
  filialId: number;
}

// Classe que decodifica o token JWT e valida o usuário correspondente
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    // Configura a leitura do token no cabeçalho 'Authorization: Bearer <token>'
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Rejeita tokens expirados
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-adorne-semijoias',
    });
  }

  // Método executado automaticamente pelo NestJS após a validação do token
  // O retorno deste método será anexado na propriedade 'req.user' de toda requisição
  async validate(payload: JwtPayload) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nome: true,
        role: true,
        lojaId: true,
        filialId: true,
      },
    });

    // Se o usuário não existir no banco de dados, barra a requisição com 401
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo');
    }

    return user;
  }
}
