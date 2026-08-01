import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AbrirCaixaDto, CreateMovimentacaoDto, FecharCaixaDto } from './dto/caixas.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CaixasService {
  constructor(private readonly prisma: PrismaService) {}

  // Abre um novo caixa para a filial do usuário logado
  async abrirCaixa(dto: AbrirCaixaDto, user: any) {
    try {
      // Tenta criar o caixa com status ABERTO
      return await this.prisma.caixa.create({
        data: {
          lojaId: user.lojaId,
          filialId: user.filialId,
          usuarioAberturaId: user.id,
          saldoInicial: dto.saldoInicial,
          status: 'ABERTO',
        },
      });
    } catch (error) {
      // Captura violação de restrição única do Prisma (Código P2002) que é disparada pelo índice único parcial no Postgres
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Já existe um caixa aberto para esta filial');
      }
      throw error;
    }
  }

  // Consulta o caixa ativo na filial e consolida os saldos atuais
  async getCaixaAtivo(user: any) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        filialId: user.filialId,
        status: 'ABERTO',
      },
      include: {
        usuarioAbertura: {
          select: { id: true, nome: true },
        },
      },
    });

    if (!caixa) {
      return null; // Retorna null para o app saber que precisa exibir o form de abertura
    }

    // Soma todas as vendas em DINHEIRO associadas a este caixa ativo
    const vendasDinheiro = await this.prisma.venda.aggregate({
      where: {
        caixaId: caixa.id,
        formaPagamento: 'DINHEIRO',
      },
      _sum: {
        valorTotal: true,
      },
    });
    const totalVendasDinheiro = vendasDinheiro._sum.valorTotal || 0;

    // Busca todas as movimentações (suprimentos e sangrias) deste caixa
    const movimentacoes = await this.prisma.movimentacaoCaixa.findMany({
      where: {
        caixaId: caixa.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalEntradas = movimentacoes
      .filter((m) => m.tipo === 'ENTRADA')
      .reduce((sum, m) => sum + m.valor, 0);

    const totalSaidas = movimentacoes
      .filter((m) => m.tipo === 'SAIDA')
      .reduce((sum, m) => sum + m.valor, 0);

    // Saldo esperado em dinheiro = saldo inicial + vendas em dinheiro + suprimentos - sangrias
    const saldoFinalEsperado = caixa.saldoInicial + totalVendasDinheiro + totalEntradas - totalSaidas;

    // Busca também o total de vendas em outros meios para exibição analítica no fechamento
    const vendasOutrosMeios = await this.prisma.venda.groupBy({
      by: ['formaPagamento'],
      where: {
        caixaId: caixa.id,
        NOT: { formaPagamento: 'DINHEIRO' },
      },
      _sum: {
        valorTotal: true,
      },
    });

    return {
      ...caixa,
      totalVendasDinheiro,
      totalEntradas,
      totalSaidas,
      saldoFinalEsperado,
      movimentacoes,
      vendasOutrosMeios: vendasOutrosMeios.map((v) => ({
        formaPagamento: v.formaPagamento,
        valorTotal: v._sum.valorTotal || 0,
      })),
    };
  }

  // Registra movimentações avulsas de caixa (Entradas/Suprimentos ou Saídas/Sangrias)
  async registrarMovimentacao(dto: CreateMovimentacaoDto, user: any) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        filialId: user.filialId,
        status: 'ABERTO',
      },
    });

    if (!caixa) {
      throw new BadRequestException('Não há nenhum caixa aberto nesta filial para movimentar');
    }

    return await this.prisma.movimentacaoCaixa.create({
      data: {
        caixaId: caixa.id,
        tipo: dto.tipo,
        valor: dto.valor,
        descricao: dto.descricao,
      },
    });
  }

  // Fecha o caixa ativo consolidando saldos e registrando quebras/sobras com Lock SELECT FOR UPDATE
  async fecharCaixa(dto: FecharCaixaDto, user: any) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Busca e trava a linha do caixa ativo no fuso de banco via SELECT FOR UPDATE para evitar vendas ou movimentações concorrentes
      const caixasAtivos = await tx.$queryRaw<any[]>`
        SELECT * FROM "Caixa"
        WHERE "filialId" = ${user.filialId} AND status = 'ABERTO'
        LIMIT 1
        FOR UPDATE
      `;

      if (caixasAtivos.length === 0) {
        throw new BadRequestException('Não há nenhum caixa aberto nesta filial para fechar');
      }

      const caixa = caixasAtivos[0];

      // 2. Consolida vendas em dinheiro dentro da transação travada
      const vendasDinheiro = await tx.venda.aggregate({
        where: {
          caixaId: caixa.id,
          formaPagamento: 'DINHEIRO',
        },
        _sum: {
          valorTotal: true,
        },
      });
      const totalVendasDinheiro = vendasDinheiro._sum.valorTotal || 0;

      // 3. Consolida suprimentos/sangrias dentro da transação travada
      const movimentacoes = await tx.movimentacaoCaixa.findMany({
        where: {
          caixaId: caixa.id,
        },
      });

      const totalEntradas = movimentacoes
        .filter((m) => m.tipo === 'ENTRADA')
        .reduce((sum, m) => sum + m.valor, 0);

      const totalSaidas = movimentacoes
        .filter((m) => m.tipo === 'SAIDA')
        .reduce((sum, m) => sum + m.valor, 0);

      // 4. Calcula saldo final esperado e a diferença (quebra ou sobra)
      const saldoFinalEsperado = caixa.saldoInicial + totalVendasDinheiro + totalEntradas - totalSaidas;
      const diferenca = dto.saldoFinalReal - saldoFinalEsperado;

      // 5. Atualiza o caixa para o status FECHADO e grava os dados de conciliação
      return await tx.caixa.update({
        where: {
          id: caixa.id,
        },
        data: {
          status: 'FECHADO',
          dataFechamento: new Date(),
          usuarioFechamentoId: user.id,
          saldoFinalEsperado,
          saldoFinalReal: dto.saldoFinalReal,
          diferenca,
          observacao: dto.observacao,
        },
      });
    });
  }
}
