import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Request,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ProdutosService } from './produtos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('produtos')
@UseGuards(JwtAuthGuard)
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  // GET /produtos — Catálogo completo (qualquer usuário autenticado)
  @Get()
  async getProdutos(@Request() req: any) {
    const { lojaId } = req.user;
    return this.produtosService.findAll(lojaId);
  }

  // POST /produtos — Cria novo produto (qualquer usuário autenticado)
  @Post()
  async createProduto(
    @Request() req: any,
    @Body() body: { nome: string; categoria: string; preco: number; estoque: number },
  ) {
    const { lojaId } = req.user;
    return this.produtosService.create(lojaId, body);
  }

  // PATCH /produtos/:id — Edita nome, preço, estoque ou categoria (qualquer usuário autenticado)
  @Patch(':id')
  async updateProduto(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nome?: string; categoria?: string; preco?: number; estoque?: number },
  ) {
    const { lojaId } = req.user;
    return this.produtosService.update(lojaId, id, body);
  }

  // DELETE /produtos/:id — Exclui produto (qualquer usuário autenticado)
  @Delete(':id')
  async deleteProduto(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { lojaId } = req.user;
    return this.produtosService.remove(lojaId, id);
  }
}
