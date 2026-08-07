import { Controller, Get, Query, Request, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosMensalDto } from './dto/relatorios-mensal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('relatorios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  // Endpoint GET /relatorios/mensal?mes=&ano=
  // Retorna o fechamento mensal da loja para o Dono autenticado
  @Get('mensal')
  @Roles(Role.DONO)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getRelatorioMensal(@Query() query: RelatoriosMensalDto, @Request() req: any) {
    const { mes, ano } = query;
    return this.relatoriosService.getRelatorioMensal(mes, ano, req.user);
  }
}
