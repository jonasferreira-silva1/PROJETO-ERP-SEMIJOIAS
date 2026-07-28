import { Controller, Post, Get, Body, Request, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { VendasService } from './vendas.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  // Endpoint GET /vendas/historico
  // Retorna o histórico de vendas do usuário autenticado no momento (com regras de visibilidade)
  @Get('historico')
  async getHistorico(@Request() req: any) {
    const { id, role, lojaId } = req.user;
    return this.vendasService.findHistorico(id, role, lojaId);
  }
}
