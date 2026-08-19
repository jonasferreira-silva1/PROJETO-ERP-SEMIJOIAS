import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { Prisma, Produto } from '@prisma/client';
import { VendasGateway } from './vendas.gateway';

@Injectable()
export class VendasService {
  constructor(
    private prisma: PrismaService,
    private vendasGateway: VendasGateway,
  ) {}

  // Cria uma nova venda aplicando validação de idempotência, trava de estoque e CRM
  async create(createVendaDto: CreateVendaDto, user: any) {
    const { uuid, formaPagamento, clienteNome, clienteTelefone, observacao, itens } = createVendaDto;

    // 1. Verificação de Idempotência (UUID)
    const existingVenda = await this.prisma.venda.findUnique({
      where: { uuid },
      include: {
        itens: {
          include: {
            produto: true,
          },
        },
        cliente: true,
      },
    });

    if (existingVenda) {
      // Se a venda com este UUID já existe, retorna o objeto completo imediatamente
      return existingVenda;
    }

    if (!itens || itens.length === 0) {
      throw new BadRequestException('A venda precisa conter pelo menos um item');
    }

    // 2. Transação atômica do Prisma
    const novaVenda = await this.prisma.$transaction(async (tx) => {
      
      // A0. Validação e trava (FOR UPDATE) do caixa ativo para evitar concorrência com o fechamento
      const caixasAtivos = await tx.$queryRaw<any[]>`
        SELECT id FROM "Caixa"
        WHERE "filialId" = ${user.filialId} AND status = 'ABERTO'
        LIMIT 1
        FOR UPDATE
      `;

      if (caixasAtivos.length === 0) {
        throw new BadRequestException('Não há nenhum caixa aberto nesta filial. Abra o caixa antes de realizar vendas.');
      }

      const caixaId = caixasAtivos[0].id;

      // A. Resolução de CRM - Cliente
      let clienteId: number | null = null;
      const sanitizedNome = clienteNome?.trim();
      const sanitizedTelefone = clienteTelefone?.trim();

      if (sanitizedNome) {
        if (sanitizedTelefone) {
          try {
            // Busca se o cliente já existe por lojaId + telefone
            let cliente = await tx.cliente.findUnique({
              where: {
                lojaId_telefone: {
                  lojaId: user.lojaId,
                  telefone: sanitizedTelefone,
                },
              },
            });

            if (!cliente) {
              // Se não existir, tenta criar
              cliente = await tx.cliente.create({
                data: {
                  lojaId: user.lojaId,
                  nome: sanitizedNome,
                  telefone: sanitizedTelefone,
                },
              });
            }
            clienteId = cliente.id;
          } catch (error) {
            // Tratamento de colisão concorrente (erro P2002 no unique index)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              // Em caso de colisão, recuperamos o cliente que foi inserido concorrentemente
              const cliente = await tx.cliente.findUnique({
                where: {
                  lojaId_telefone: {
                    lojaId: user.lojaId,
                    telefone: sanitizedTelefone,
                  },
                },
              });
              if (cliente) {
                clienteId = cliente.id;
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        } else {
          // Cliente sem telefone: cria um novo registro avulso
          const cliente = await tx.cliente.create({
            data: {
              lojaId: user.lojaId,
              nome: sanitizedNome,
            },
          });
          clienteId = cliente.id;
        }
      }

      // B. Validação de estoque e trava de concorrência (FOR UPDATE)
      let valorTotal = 0;
      const itemsToCreate = [];

      // Ordena os itens pelo produtoId de forma ascendente para evitar deadlocks
      const sortedItens = [...itens].sort((a, b) => a.produtoId - b.produtoId);

      for (const item of sortedItens) {
        // Bloqueia a linha do produto selecionado no PostgreSQL para prevenir race conditions
        const produtos: Produto[] = await tx.$queryRaw`
          SELECT * FROM "Produto" 
          WHERE id = ${item.produtoId} 
          FOR UPDATE
        `;

        if (!produtos || produtos.length === 0) {
          throw new NotFoundException(`Produto com ID ${item.produtoId} não encontrado`);
        }

        const produto = produtos[0];

        // Valida se o produto pertence à mesma loja do usuário
        if (produto.lojaId !== user.lojaId) {
          throw new BadRequestException(`Produto ${produto.nome} não pertence à sua loja`);
        }

        // Valida quantidade disponível em estoque
        if (produto.estoque < item.quantidade) {
          throw new BadRequestException(
            `Estoque insuficiente para o produto: ${produto.nome} (Estoque atual: ${produto.estoque}, Solicitado: ${item.quantidade})`
          );
        }

        // Deduz a quantidade do produto no estoque
        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            estoque: {
              decrement: item.quantidade,
            },
          },
        });

        // Calcula o subtotal e armazena informações do valor unitário no momento da venda
        const valorUnitario = produto.preco;
        valorTotal += valorUnitario * item.quantidade;

        itemsToCreate.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          valorUnitario,
        });
      }

      // C. Criação da Venda e itens de forma aninhada
      const novaVenda = await tx.venda.create({
        data: {
          uuid,
          lojaId: user.lojaId,
          filialId: user.filialId,
          usuarioId: user.id,
          clienteId,
          caixaId,
          valorTotal,
          formaPagamento,
          observacao,
          itens: {
            create: itemsToCreate.map((it) => ({
              produtoId: it.produtoId,
              quantidade: it.quantidade,
              valorUnitario: it.valorUnitario,
            })),
          },
        },
        include: {
          itens: {
            include: {
              produto: true,
            },
          },
          cliente: true,
        },
      });

      return novaVenda;
    });

    // 3. Emissão do evento de tempo real no WebSocket (Multi-Tenant)
    this.vendasGateway.emitNewVenda(user.lojaId, novaVenda);

    // 4. Envio de notificações push para dispositivos em background
    this.sendPushNotifications(user.lojaId, novaVenda, user.nome).catch((err) => {
      console.log('[Push] Erro em background ao processar notificações:', err.message);
    });

    return novaVenda;
  }

  // Método assíncrono para despachar notificações push via Expo
  private async sendPushNotifications(lojaId: number, venda: any, vendedorNome: string) {
    try {
      // Busca todos os donos da loja com algum push token registrado
      const donos = await this.prisma.usuario.findMany({
        where: {
          lojaId,
          role: 'DONO',
          pushTokens: {
            some: {},
          },
        },
        include: {
          pushTokens: true,
        },
      });

      const tokens = donos.flatMap((d) => d.pushTokens.map((t) => t.token));

      if (tokens.length === 0) return;

      const itensDesc = venda.itens.map((it: any) => `${it.quantidade}x ${it.produto.nome}`).join(', ');
      const totalFormatado = `R$ ${venda.valorTotal.toFixed(2).replace('.', ',')}`;

      const messages = tokens.map((token) => ({
        to: token,
        sound: 'default',
        title: 'Nova Venda Registrada! 💍',
        body: `${vendedorNome} vendeu: ${itensDesc}. Total: ${totalFormatado}`,
        data: { vendaId: venda.id },
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();

      // Varre os recibos de entrega para remover tokens que expiraram ou foram deletados (DeviceNotRegistered)
      if (result && result.data && Array.isArray(result.data)) {
        for (let i = 0; i < result.data.length; i++) {
          const receipt = result.data[i];
          const token = tokens[i];

          if (
            receipt.status === 'error' || 
            (receipt.details && receipt.details.error === 'DeviceNotRegistered')
          ) {
            console.log(`[Push] Token inválido/morto detectado (${token}). Removendo do banco...`);
            await this.prisma.pushToken.delete({
              where: { token },
            }).catch((err) => {
              console.log('[Push] Erro ao deletar token morto:', err.message);
            });
          }
        }
      }
    } catch (error) {
      console.error('[Push] Falha ao enviar notificações push para o Expo:', error.message);
    }
  }

  // Busca o histórico de vendas baseando-se no papel (Role) do usuário
  async findHistorico(usuarioId: number, role: string, lojaId: number) {
    if (role === 'DONO') {
      // Dono vê todas as vendas associadas à loja (Tenant) para consolidar no faturamento
      return this.prisma.venda.findMany({
        where: {
          lojaId,
        },
        include: {
          itens: {
            include: {
              produto: true,
            },
          },
          cliente: true,
          usuario: true, // Importante para sabermos qual funcionária fez a venda
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // Funcionária vê apenas suas próprias vendas no histórico pessoal
      return this.prisma.venda.findMany({
        where: {
          usuarioId,
        },
        include: {
          itens: {
            include: {
              produto: true,
            },
          },
          cliente: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }
  }

  // Consolida o faturamento, ticket médio, quantidade de vendas e dados do gráfico
  async getResumo(periodo: 'hoje' | 'ontem' | '7dias', user: any) {
    const { start, end } = this.getDateRange(periodo);

    // Consulta todas as vendas da loja no período de datas estabelecido
    const vendas = await this.prisma.venda.findMany({
      where: {
        lojaId: user.lojaId,
        dataHora: {
          gte: start,
          lte: end,
        },
      },
    });

    const totalVendas = vendas.length;
    const faturamento = vendas.reduce((sum, v) => sum + v.valorTotal, 0);
    const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

    // Agrupador do gráfico reativo
    const graficoMap = new Map<string, number>();

    if (periodo === 'hoje' || periodo === 'ontem') {
      // buckets comerciais de 2 em 2 horas
      const buckets = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
      buckets.forEach(b => graficoMap.set(b, 0));

      for (const venda of vendas) {
        // Converte data UTC para a hora local correspondente em SP (ex: "13")
        const horaStr = venda.dataHora.toLocaleTimeString('en-US', {
          timeZone: 'America/Sao_Paulo',
          hour12: false,
          hour: '2-digit',
        });
        const hora = parseInt(horaStr, 10);

        // Agrupa na faixa correta
        let targetBucket = '08:00';
        if (hora >= 22) targetBucket = '22:00';
        else if (hora >= 20) targetBucket = '20:00';
        else if (hora >= 18) targetBucket = '18:00';
        else if (hora >= 16) targetBucket = '16:00';
        else if (hora >= 14) targetBucket = '14:00';
        else if (hora >= 12) targetBucket = '12:00';
        else if (hora >= 10) targetBucket = '10:00';

        graficoMap.set(targetBucket, (graficoMap.get(targetBucket) || 0) + venda.valorTotal);
      }
    } else {
      // últimos 7 dias em datas DD/MM locais ordenadas
      const pad = (num: number) => String(num).padStart(2, '0');
      const dataLabels: string[] = [];

      for (let i = 6; i >= 0; i--) {
        const localDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
        }).formatToParts(localDate);

        const day = parts.find(p => p.type === 'day')?.value || '00';
        const month = parts.find(p => p.type === 'month')?.value || '00';
        const label = `${day}/${month}`;
        dataLabels.push(label);
        graficoMap.set(label, 0);
      }

      for (const venda of vendas) {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
        }).formatToParts(venda.dataHora);

        const day = parts.find(p => p.type === 'day')?.value || '00';
        const month = parts.find(p => p.type === 'month')?.value || '00';
        const label = `${day}/${month}`;

        if (graficoMap.has(label)) {
          graficoMap.set(label, (graficoMap.get(label) || 0) + venda.valorTotal);
        }
      }
    }

    const grafico = Array.from(graficoMap.entries()).map(([label, valor]) => ({
      label,
      valor,
    }));

    return {
      faturamento,
      totalVendas,
      ticketMedio,
      grafico,
    };
  }

  // Gera limites de data e hora UTC para a consulta baseada no timezone de Brasília
  private getDateRange(periodo: 'hoje' | 'ontem' | '7dias'): { start: Date; end: Date } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(new Date());
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const year = parseInt(getValue('year'), 10);
    const month = parseInt(getValue('month') || '1', 10) - 1;
    const day = parseInt(getValue('day') || '1', 10);

    const pad = (num: number) => String(num).padStart(2, '0');
    const yyyy = year;
    const mm = pad(month + 1);
    const dd = pad(day);

    let startIso: string;
    let endIso: string;

    if (periodo === 'hoje') {
      startIso = `${yyyy}-${mm}-${dd}T00:00:00-03:00`;
      endIso = `${yyyy}-${mm}-${dd}T23:59:59-03:00`;
    } else if (periodo === 'ontem') {
      const yesterday = new Date(Date.UTC(year, month, day - 1));
      const yyyyY = yesterday.getUTCFullYear();
      const mmY = pad(yesterday.getUTCMonth() + 1);
      const ddY = pad(yesterday.getUTCDate());

      startIso = `${yyyyY}-${mmY}-${ddY}T00:00:00-03:00`;
      endIso = `${yyyyY}-${mmY}-${ddY}T23:59:59-03:00`;
    } else {
      const startDay = new Date(Date.UTC(year, month, day - 6));
      const yyyyS = startDay.getUTCFullYear();
      const mmS = pad(startDay.getUTCMonth() + 1);
      const ddS = pad(startDay.getUTCDate());

      startIso = `${yyyyS}-${mmS}-${ddS}T00:00:00-03:00`;
      endIso = `${yyyy}-${mm}-${dd}T23:59:59-03:00`;
    }

    return {
      start: new Date(startIso),
      end: new Date(endIso),
    };
  }
}
