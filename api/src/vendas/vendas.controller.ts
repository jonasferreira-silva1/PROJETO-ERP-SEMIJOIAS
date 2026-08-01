import { Controller, Post, Get, Body, Query, Request, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { VendasService } from './vendas.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { VendasResumoDto } from './dto/vendas-resumo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('vendas')
@UseGuards(JwtAuthGuard)
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  // Endpoint POST /vendas
  // Registra uma nova venda validando estoque, idempotência e integridade do cliente
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async registrarVenda(@Body() createVendaDto: CreateVendaDto, @Request() req: any) {
    return this.vendasService.create(createVendaDto, req.user);
  }

  // Endpoint GET /vendas/resumo
  // Retorna o consolidado analítico (KPIs e gráfico) de faturamento da loja (restrito a Donos)
  @Get('resumo')
  @UseGuards(RolesGuard)
  @Roles(Role.DONO)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getResumo(@Query() query: VendasResumoDto, @Request() req: any) {
    return this.vendasService.getResumo(query.periodo, req.user);
  }

  // Endpoint GET /vendas/historico
  // Retorna o histórico de vendas do usuário autenticado no momento (com regras de visibilidade)
  @Get('historico')
  async getHistorico(@Request() req: any) {
    const { id, role, lojaId } = req.user;
    return this.vendasService.findHistorico(id, role, lojaId);
  }
}
