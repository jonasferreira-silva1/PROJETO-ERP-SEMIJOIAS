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

      for (const item of itens) {
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
}
