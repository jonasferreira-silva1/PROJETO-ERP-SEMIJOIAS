import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('produtos')
@UseGuards(JwtAuthGuard)
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  // Endpoint GET /produtos
  // Retorna o catálogo completo de peças associadas à loja do usuário autenticado
  @Get()
  async getProdutos(@Request() req: any) {
    const { lojaId } = req.user;
    return this.produtosService.findAll(lojaId);
  }
}
