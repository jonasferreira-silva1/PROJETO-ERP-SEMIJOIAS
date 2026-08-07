import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  // Retorna o faturamento e métricas mensais comparados com o mês anterior
  async getRelatorioMensal(mes: number | undefined, ano: number | undefined, user: any) {
    const { mes: currentMonth, ano: currentYear } = this.getCurrentMonthAndYear();
    const targetMes = mes !== undefined ? mes : currentMonth;
    const targetAno = ano !== undefined ? ano : currentYear;

    const pad = (num: number) => String(num).padStart(2, '0');

    // 1. Define os limites do mês selecionado
    const startIso = `${targetAno}-${pad(targetMes)}-01T00:00:00-03:00`;
    const lastDay = new Date(targetAno, targetMes, 0).getDate();
    const endIso = `${targetAno}-${pad(targetMes)}-${pad(lastDay)}T23:59:59.999-03:00`;
    const start = new Date(startIso);
    const end = new Date(endIso);

    // 2. Define os limites do mês anterior para comparação
    let prevMes = targetMes - 1;
    let prevAno = targetAno;
    if (targetMes === 1) {
      prevMes = 12;
      prevAno = targetAno - 1;
    }
    const prevStartIso = `${prevAno}-${pad(prevMes)}-01T00:00:00-03:00`;
    const prevLastDay = new Date(prevAno, prevMes, 0).getDate();
    const prevEndIso = `${prevAno}-${pad(prevMes)}-${pad(prevLastDay)}T23:59:59.999-03:00`;
    const prevStart = new Date(prevStartIso);
    const prevEnd = new Date(prevEndIso);

    // 3. Busca todas as vendas do mês corrente
    const vendas = await this.prisma.venda.findMany({
      where: {
        lojaId: user.lojaId,
        dataHora: {
          gte: start,
          lte: end,
        },
      },
    });

    // 4. Busca o faturamento do mês anterior
    const resumoAnterior = await this.prisma.venda.aggregate({
      where: {
        lojaId: user.lojaId,
        dataHora: {
          gte: prevStart,
          lte: prevEnd,
        },
      },
      _sum: {
        valorTotal: true,
      },
    });
    const faturamentoAnterior = resumoAnterior._sum.valorTotal || 0;

    // 5. Consolida métricas gerais do mês atual
    const totalVendas = vendas.length;
    const faturamento = vendas.reduce((sum, v) => sum + v.valorTotal, 0);
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

    // 6. Calcula a variação percentual (retorna null se o faturamento anterior for 0)
    let variacaoPercentual: number | null = null;
    if (faturamentoAnterior > 0) {
      const variacao = ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100;
      variacaoPercentual = Math.round(variacao * 100) / 100; // Arredonda para 2 casas decimais
    }

    // 7. Agrupa o faturamento por dia do mês (gráfico)
    const graficoMap = new Map<string, number>();
    for (let d = 1; d <= lastDay; d++) {
      graficoMap.set(pad(d), 0);
    }

    for (const venda of vendas) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
      }).formatToParts(venda.dataHora);
      const dayStr = parts.find((p) => p.type === 'day')?.value || '00';

      if (graficoMap.has(dayStr)) {
        graficoMap.set(dayStr, (graficoMap.get(dayStr) || 0) + venda.valorTotal);
      }
    }

    const grafico = Array.from(graficoMap.entries()).map(([label, valor]) => ({
      label,
      valor,
    }));

    return {
      faturamento,
      faturamentoAnterior,
      variacaoPercentual,
      totalVendas,
      ticketMedio,
      grafico,
    };
  }

  // Obtém o mês e ano atuais no fuso de Brasília/SP
  private getCurrentMonthAndYear(): { mes: number; ano: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    const getValue = (type: string) => parts.find((p) => p.type === type)?.value || '0';
    const year = parseInt(getValue('year'), 10);
    const month = parseInt(getValue('month') || '1', 10);
    return { mes: month, ano: year };
  }
}
