import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

// Serviço que contém toda a lógica de validação de login e assinatura do token
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Executa o login validando e-mail, senha e assinando o JWT final
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Busca o usuário no banco pelo email
    const user = await this.prisma.usuario.findUnique({
      where: { email },
    });

    // Lança erro caso o usuário não exista
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    // Compara a senha enviada com a senha criptografada (hash) gravada no banco
    const isPasswordValid = await bcrypt.compare(password, user.senhaHash);

    // Lança erro caso a senha não confira
    if (!isPasswordValid) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    // Define os dados (payload) que serão embutidos no token JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      lojaId: user.lojaId,
      filialId: user.filialId,
    };

    // Assina e retorna o JWT junto dos dados resumidos do perfil logado
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        lojaId: user.lojaId,
        filialId: user.filialId,
      },
    };
  }
}
