import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProdutosService {
  constructor(private prisma: PrismaService) {}

  // Retorna todos os produtos do catálogo da loja vinculada ao usuário autenticado
  async findAll(lojaId: number) {
    return this.prisma.produto.findMany({
      where: {
        lojaId,
      },
      orderBy: {
        nome: 'asc',
      },
    });
  }
}
