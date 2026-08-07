import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CreateProdutoDto {
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
}

export interface UpdateProdutoDto {
  nome?: string;
  categoria?: string;
  preco?: number;
  estoque?: number;
}

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  // Retorna todos os produtos do catálogo da loja vinculada ao usuário autenticado
  async findAll(lojaId: number) {
    return this.prisma.produto.findMany({
      where: { lojaId },
      orderBy: { nome: 'asc' },
    });
  }

  // Cria um novo produto para a loja (apenas Dono)
  async create(lojaId: number, dto: CreateProdutoDto) {
    return this.prisma.produto.create({
      data: {
        lojaId,
        nome: dto.nome.trim(),
        categoria: dto.categoria.trim(),
        preco: dto.preco,
        estoque: dto.estoque,
      },
    });
  }

  // Atualiza nome, categoria, preço ou estoque de um produto (apenas Dono)
  async update(lojaId: number, produtoId: number, dto: UpdateProdutoDto) {
    const produto = await this.prisma.produto.findUnique({ where: { id: produtoId } });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (produto.lojaId !== lojaId) {
      throw new ForbiddenException('Produto não pertence à sua loja.');
    }

    return this.prisma.produto.update({
      where: { id: produtoId },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome.trim() }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria.trim() }),
        ...(dto.preco !== undefined && { preco: dto.preco }),
        ...(dto.estoque !== undefined && { estoque: dto.estoque }),
      },
    });
  }

  // Exclui um produto da loja (apenas Dono)
  async remove(lojaId: number, produtoId: number) {
    const produto = await this.prisma.produto.findUnique({ where: { id: produtoId } });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (produto.lojaId !== lojaId) {
      throw new ForbiddenException('Produto não pertence à sua loja.');
    }

    await this.prisma.produto.delete({ where: { id: produtoId } });
    return { message: 'Produto excluído com sucesso.' };
  }
}
