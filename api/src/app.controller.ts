import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

// Controller geral com rotas de testes para validar nossa autenticação e autorização
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  // Rota pública simples de boas-vindas
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Rota para pegar os dados do usuário autenticado no momento.
  // Protegida pelo JwtAuthGuard (exige token de acesso Bearer válido)
  @UseGuards(JwtAuthGuard)
  @Get('perfil')
  getPerfil(@Request() req: any) {
    return req.user;
  }

  // Endpoint POST /perfil/push-token
  // Registra um novo token de push notification nativa para o usuário logado
  @UseGuards(JwtAuthGuard)
  @Post('perfil/push-token')
  async registerPushToken(@Body('token') token: string, @Request() req: any) {
    if (!token) {
      return { success: false, message: 'Token não fornecido' };
    }

    // Associa o token ao usuário de forma resiliente
    await this.prisma.pushToken.upsert({
      where: { token },
      update: { usuarioId: req.user.id },
      create: {
        token,
        usuarioId: req.user.id,
      },
    });

    return { success: true };
  }

  // Rota restrita. Exige token JWT e cargo (role) de DONO
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DONO)
  @Get('dono-only')
  getDonoData(@Request() req: any) {
    return {
      message: 'Acesso concedido apenas para Dono da Loja',
      user: req.user,
    };
  }

  // Rota restrita. Exige token JWT e cargo (role) de FUNCIONARIA
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FUNCIONARIA)
  @Get('func-only')
  getFuncData(@Request() req: any) {
    return {
      message: 'Acesso concedido apenas para Funcionárias',
      user: req.user,
    };
  }
}
