import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

// Controller geral com rotas de testes para validar nossa autenticação e autorização
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
