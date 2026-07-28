import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { Prisma, Produto } from '@prisma/client';

@Injectable()
export class VendasService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.$transaction(async (tx) => {
      
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
  }

  // Busca o histórico de vendas efetuadas pelo usuário logado (funcionária)
  async findHistorico(usuarioId: number) {
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
