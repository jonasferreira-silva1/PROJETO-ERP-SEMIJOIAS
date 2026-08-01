import { Test, TestingModule } from '@nestjs/testing';
import { VendasService } from './vendas.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException } from '@nestjs/common';
import { FormaPagamento } from '@prisma/client';
import { VendasGateway } from './vendas.gateway';

describe('VendasService', () => {
  let service: VendasService;
  let prisma: PrismaService;

  const mockUser = {
    id: 2,
    lojaId: 1,
    filialId: 1,
    nome: 'Maria Silva',
    role: 'FUNCIONARIA',
  };

  const mockPrismaService: any = {
    venda: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    produto: {
      update: jest.fn(),
    },
    cliente: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    $queryRaw: jest.fn(),
  };

  const mockVendasGateway = {
    emitNewVenda: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendasService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: VendasGateway,
          useValue: mockVendasGateway,
        },
      ],
    }).compile();

    service = module.get<VendasService>(VendasService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should return existing sale on idempotency match', async () => {
      const existingSale = { id: 10, uuid: 'uuid-1234', valorTotal: 100 };
      mockPrismaService.venda.findUnique.mockResolvedValue(existingSale);

      const dto = {
        uuid: 'uuid-1234',
        formaPagamento: FormaPagamento.PIX,
        itens: [{ produtoId: 1, quantidade: 2 }],
      };

      const result = await service.create(dto, mockUser);

      expect(prisma.venda.findUnique).toHaveBeenCalledWith({
        where: { uuid: 'uuid-1234' },
        include: {
          itens: { include: { produto: true } },
          cliente: true,
        },
      });
      expect(result).toEqual(existingSale);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if cart is empty', async () => {
      mockPrismaService.venda.findUnique.mockResolvedValue(null);

      const dto = {
        uuid: 'uuid-1234',
        formaPagamento: FormaPagamento.PIX,
        itens: [],
      };

      await expect(service.create(dto, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      mockPrismaService.venda.findUnique.mockResolvedValue(null);
      
      // Simula retorno do produto travado com FOR UPDATE (estoque: 1, solicitado: 2)
      mockPrismaService.$queryRaw.mockResolvedValue([
        { id: 1, nome: 'Brinco Ouro', preco: 50, estoque: 1, lojaId: 1 },
      ]);

      const dto = {
        uuid: 'uuid-1234',
        formaPagamento: FormaPagamento.PIX,
        itens: [{ produtoId: 1, quantidade: 2 }],
      };

      await expect(service.create(dto, mockUser)).rejects.toThrow(
        'Estoque insuficiente para o produto: Brinco Ouro (Estoque atual: 1, Solicitado: 2)'
      );
    });
  });

  describe('getResumo', () => {
    it('should aggregate sales and group by hour for periodo = hoje', async () => {
      const salesMock = [
        { id: 1, valorTotal: 100, dataHora: new Date('2026-07-28T13:30:00-03:00') },
        { id: 2, valorTotal: 150, dataHora: new Date('2026-07-28T15:45:00-03:00') },
      ];
      mockPrismaService.venda.findMany.mockResolvedValue(salesMock);

      const result = await service.getResumo('hoje', mockUser);

      expect(result.faturamento).toBe(250);
      expect(result.totalVendas).toBe(2);
      expect(result.ticketMedio).toBe(125);

      // Bucket 12:00 (que engloba 13h30)
      const b12 = result.grafico.find(g => g.label === '12:00');
      expect(b12?.valor).toBe(100);

      // Bucket 14:00 (que engloba 15h45)
      const b14 = result.grafico.find(g => g.label === '14:00');
      expect(b14?.valor).toBe(150);
    });
  });
});
