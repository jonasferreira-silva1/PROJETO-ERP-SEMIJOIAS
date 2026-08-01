import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Request, 
  UseGuards, 
  UsePipes, 
  ValidationPipe 
} from '@nestjs/common';
import { CaixasService } from './caixas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AbrirCaixaDto, CreateMovimentacaoDto, FecharCaixaDto } from './dto/caixas.dto';

// Controlador protegido por JWT para auditorias e segurança
@Controller('caixas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaixasController {
  constructor(private readonly caixasService: CaixasService) {}

  // Endpoint POST /caixas/abrir
  // Permite que funcionários ou a dona abram o caixa da filial
  @Post('abrir')
  @Roles(Role.DONO, Role.FUNCIONARIA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async abrirCaixa(@Body() dto: AbrirCaixaDto, @Request() req: any) {
    return this.caixasService.abrirCaixa(dto, req.user);
  }

  // Endpoint GET /caixas/ativo
  // Retorna os dados resumidos do caixa que está atualmente ABERTO na filial do usuário
  @Get('ativo')
  @Roles(Role.DONO, Role.FUNCIONARIA)
  async getCaixaAtivo(@Request() req: any) {
    return this.caixasService.getCaixaAtivo(req.user);
  }

  // Endpoint POST /caixas/movimentar
  // Registra um Suprimento (Entrada) ou uma Sangria (Saída) no caixa ativo
  @Post('movimentar')
  @Roles(Role.DONO, Role.FUNCIONARIA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async registrarMovimentacao(@Body() dto: CreateMovimentacaoDto, @Request() req: any) {
    return this.caixasService.registrarMovimentacao(dto, req.user);
  }

  // Endpoint POST /caixas/fechar
  // Encerra o caixa ativo, calcula quebra/sobra e atualiza no banco
  @Post('fechar')
  @Roles(Role.DONO, Role.FUNCIONARIA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async fecharCaixa(@Body() dto: FecharCaixaDto, @Request() req: any) {
    return this.caixasService.fecharCaixa(dto, req.user);
  }
}
