import { Test, TestingModule } from '@nestjs/testing';
import { RelatoriosService } from './relatorios.service';
import { PrismaService } from '../prisma.service';

describe('RelatoriosService', () => {
  let service: RelatoriosService;
  let prisma: PrismaService;

  const mockUser = {
    id: 1,
    lojaId: 1,
    filialId: 1,
    nome: 'Dona Adorne',
    role: 'DONO',
  };

  const mockPrismaService: any = {
    venda: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelatoriosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RelatoriosService>(RelatoriosService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getRelatorioMensal', () => {
    it('deve retornar faturamento, total de vendas, ticket médio e gráfico agrupado diariamente', async () => {
      // Mock das vendas do mês corrente (Agosto/2026 - 31 dias)
      // Venda 1: dia 05, valor 100
      // Venda 2: dia 05, valor 200
      // Venda 3: dia 15, valor 150
      const mockVendas = [
        { id: 1, valorTotal: 100, dataHora: new Date('2026-08-05T10:00:00-03:00') },
        { id: 2, valorTotal: 200, dataHora: new Date('2026-08-05T14:30:00-03:00') },
        { id: 3, valorTotal: 150, dataHora: new Date('2026-08-15T18:00:00-03:00') },
      ];
      mockPrismaService.venda.findMany.mockResolvedValue(mockVendas);

      // Mock do faturamento do mês anterior (R$ 300)
      mockPrismaService.venda.aggregate.mockResolvedValue({
        _sum: { valorTotal: 300 },
      });

      const result = await service.getRelatorioMensal(8, 2026, mockUser);

      expect(prisma.venda.findMany).toHaveBeenCalled();
      expect(prisma.venda.aggregate).toHaveBeenCalled();

      // Métricas gerais
      expect(result.faturamento).toBe(450); // 100 + 200 + 150
      expect(result.totalVendas).toBe(3);
      expect(result.ticketMedio).toBe(150); // 450 / 3
      expect(result.faturamentoAnterior).toBe(300);
      expect(result.variacaoPercentual).toBe(50); // ((450 - 300) / 300) * 100 = 50%

      // Verificação do gráfico
      const graficoDia05 = result.grafico.find(g => g.label === '05');
      const graficoDia15 = result.grafico.find(g => g.label === '15');
      const graficoDia01 = result.grafico.find(g => g.label === '01');

      expect(graficoDia05?.valor).toBe(300); // 100 + 200
      expect(graficoDia15?.valor).toBe(150);
      expect(graficoDia01?.valor).toBe(0);
      expect(result.grafico.length).toBe(31); // Agosto tem 31 dias
    });

    it('deve retornar variacaoPercentual negativo se o faturamento atual for menor que o anterior', async () => {
      mockPrismaService.venda.findMany.mockResolvedValue([
        { id: 1, valorTotal: 150, dataHora: new Date('2026-08-05T10:00:00-03:00') },
      ]);
      mockPrismaService.venda.aggregate.mockResolvedValue({
        _sum: { valorTotal: 300 },
      });

      const result = await service.getRelatorioMensal(8, 2026, mockUser);

      expect(result.faturamento).toBe(150);
      expect(result.faturamentoAnterior).toBe(300);
      expect(result.variacaoPercentual).toBe(-50); // ((150 - 300) / 300) * 100 = -50%
    });

    it('deve retornar variacaoPercentual nulo (null) se o faturamento do mês anterior for 0', async () => {
      mockPrismaService.venda.findMany.mockResolvedValue([
        { id: 1, valorTotal: 200, dataHora: new Date('2026-08-05T10:00:00-03:00') },
      ]);
      mockPrismaService.venda.aggregate.mockResolvedValue({
        _sum: { valorTotal: 0 },
      });

      const result = await service.getRelatorioMensal(8, 2026, mockUser);

      expect(result.faturamento).toBe(200);
      expect(result.faturamentoAnterior).toBe(0);
      expect(result.variacaoPercentual).toBeNull(); // Divisão por zero evitada, retorna null
    });
  });
});
