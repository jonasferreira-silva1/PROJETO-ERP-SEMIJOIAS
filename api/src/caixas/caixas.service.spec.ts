import { Test, TestingModule } from '@nestjs/testing';
import { CaixasService } from './caixas.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException } from '@nestjs/common';
import { StatusCaixa, TipoMovimentacao } from '@prisma/client';

describe('CaixasService', () => {
  let service: CaixasService;
  let prisma: PrismaService;

  const mockUser = {
    id: 1,
    lojaId: 1,
    filialId: 1,
    nome: 'Jonas Ferreira',
    role: 'DONO',
  };

  const mockPrismaService: any = {
    caixa: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    venda: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    movimentacaoCaixa: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaixasService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CaixasService>(CaixasService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('abrirCaixa', () => {
    it('deve abrir um caixa com sucesso', async () => {
      const dto = { saldoInicial: 150 };
      const createdCaixa = { id: 1, ...dto, status: StatusCaixa.ABERTO };
      mockPrismaService.caixa.create.mockResolvedValue(createdCaixa);

      const result = await service.abrirCaixa(dto, mockUser);

      expect(prisma.caixa.create).toHaveBeenCalledWith({
        data: {
          lojaId: mockUser.lojaId,
          filialId: mockUser.filialId,
          usuarioAberturaId: mockUser.id,
          saldoInicial: dto.saldoInicial,
          status: 'ABERTO',
        },
      });
      expect(result).toEqual(createdCaixa);
    });
  });

  describe('getCaixaAtivo', () => {
    it('deve retornar null se não houver caixa aberto', async () => {
      mockPrismaService.caixa.findFirst.mockResolvedValue(null);

      const result = await service.getCaixaAtivo(mockUser);

      expect(result).toBeNull();
    });

    it('deve consolidar os saldos do caixa ativo com sucesso', async () => {
      const activeCaixa = {
        id: 1,
        saldoInicial: 100,
        status: StatusCaixa.ABERTO,
        usuarioAbertura: { id: 1, nome: 'Jonas' },
      };
      mockPrismaService.caixa.findFirst.mockResolvedValue(activeCaixa);

      // Simula R$ 200 de vendas em dinheiro
      mockPrismaService.venda.aggregate.mockResolvedValue({
        _sum: { valorTotal: 200 },
      });

      // Simula movimentações: 1 Suprimento de R$ 50 e 1 Sangria de R$ 30
      const movs = [
        { tipo: TipoMovimentacao.ENTRADA, valor: 50, descricao: 'Troco' },
        { tipo: TipoMovimentacao.SAIDA, valor: 30, descricao: 'Despesa Café' },
      ];
      mockPrismaService.movimentacaoCaixa.findMany.mockResolvedValue(movs);

      // Simula vendas em Pix
      mockPrismaService.venda.groupBy.mockResolvedValue([
        { formaPagamento: 'PIX', _sum: { valorTotal: 150 } },
      ]);

      const result = await service.getCaixaAtivo(mockUser);

      expect(result?.saldoFinalEsperado).toBe(320); // 100 + 200 + 50 - 30
      expect(result?.totalVendasDinheiro).toBe(200);
      expect(result?.totalEntradas).toBe(50);
      expect(result?.totalSaidas).toBe(30);
    });
  });

  describe('fecharCaixa', () => {
    it('deve travar, consolidar e fechar o caixa registrando a diferença', async () => {
      const activeCaixa = {
        id: 1,
        saldoInicial: 100,
        status: StatusCaixa.ABERTO,
      };
      mockPrismaService.$queryRaw.mockResolvedValue([activeCaixa]);

      // R$ 100 em vendas
      mockPrismaService.venda.aggregate.mockResolvedValue({
        _sum: { valorTotal: 100 },
      });

      // R$ 0 em movimentações
      mockPrismaService.movimentacaoCaixa.findMany.mockResolvedValue([]);

      const dto = {
        saldoFinalReal: 190, // Faltaram R$ 10 (esperado: 200)
        observacao: 'Falta de troco',
      };

      await service.fecharCaixa(dto, mockUser);

      // Verifica se a atualização de encerramento foi gravada com a diferença negativa
      expect(prisma.caixa.update).toHaveBeenCalledWith({
        where: { id: activeCaixa.id },
        data: {
          status: 'FECHADO',
          dataFechamento: expect.any(Date),
          usuarioFechamentoId: mockUser.id,
          saldoFinalEsperado: 200,
          saldoFinalReal: 190,
          diferenca: -10,
          observacao: dto.observacao,
        },
      });
    });
  });
});
