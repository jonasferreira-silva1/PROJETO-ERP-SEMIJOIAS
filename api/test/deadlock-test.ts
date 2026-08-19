import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis do arquivo .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/adorne_erp?schema=public';
console.log('Usando DATABASE_URL:', connectionString);

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runDeadlockTest(useSorting: boolean) {
  console.log(`\n--- Iniciando Teste de Concorrência (Ordenação: ${useSorting ? 'ATIVADA' : 'DESATIVADA'}) ---`);
  
  // 1. Criar dados de teste limpos
  const loja = await prisma.loja.create({
    data: { nome: 'Loja Teste Concorrência' },
  });
  
  const filial1 = await prisma.filial.create({
    data: { lojaId: loja.id, nome: 'Filial Centro' },
  });
  const filial2 = await prisma.filial.create({
    data: { lojaId: loja.id, nome: 'Filial Shopping' },
  });
  
  const user1 = await prisma.usuario.create({
    data: {
      lojaId: loja.id,
      filialId: filial1.id,
      nome: 'Vendedora 1',
      email: 'vendedora1@teste.com',
      senhaHash: 'dummy',
      role: 'FUNCIONARIA',
    },
  });
  const user2 = await prisma.usuario.create({
    data: {
      lojaId: loja.id,
      filialId: filial2.id,
      nome: 'Vendedora 2',
      email: 'vendedora2@teste.com',
      senhaHash: 'dummy',
      role: 'FUNCIONARIA',
    },
  });
  
  const caixa1 = await prisma.caixa.create({
    data: {
      lojaId: loja.id,
      filialId: filial1.id,
      usuarioAberturaId: user1.id,
      saldoInicial: 100,
      status: 'ABERTO',
    },
  });
  const caixa2 = await prisma.caixa.create({
    data: {
      lojaId: loja.id,
      filialId: filial2.id,
      usuarioAberturaId: user2.id,
      saldoInicial: 100,
      status: 'ABERTO',
    },
  });
  
  const prodA = await prisma.produto.create({
    data: { lojaId: loja.id, nome: 'Produto A (Brinco)', categoria: 'Brincos', preco: 100, estoque: 10 },
  });
  const prodB = await prisma.produto.create({
    data: { lojaId: loja.id, nome: 'Produto B (Anel)', categoria: 'Anéis', preco: 150, estoque: 10 },
  });
  
  console.log(`Dados de teste criados:
    - Loja ID: ${loja.id}
    - Caixa 1 ID: ${caixa1.id} (Filial 1)
    - Caixa 2 ID: ${caixa2.id} (Filial 2)
    - Produto A ID: ${prodA.id}
    - Produto B ID: ${prodB.id}`);

  // Define os itens das duas transações concorrentes
  // Transação A quer comprar A depois B (ou ordenado se ativado)
  const itensVendaA = [
    { produtoId: prodA.id, quantidade: 1 },
    { produtoId: prodB.id, quantidade: 1 },
  ];
  
  // Transação B quer comprar B depois A (ordem oposta para causar deadlock caso não ordenado)
  const itensVendaB = [
    { produtoId: prodB.id, quantidade: 1 },
    { produtoId: prodA.id, quantidade: 1 },
  ];

  // Simulação da transação concorrente de vendas
  const executeVendaTransaction = async (
    caixaId: number,
    usuarioId: number,
    filialId: number,
    itens: { produtoId: number; quantidade: number }[],
    txLabel: string
  ) => {
    return await prisma.$transaction(async (tx) => {
      // 1. Lock Caixa
      console.log(`[${txLabel}] Lock no Caixa ${caixaId}`);
      await tx.$queryRaw`SELECT id FROM "Caixa" WHERE id = ${caixaId} FOR UPDATE`;
      
      // 2. Ordenar itens se ativado
      const finalItens = useSorting 
        ? [...itens].sort((a, b) => a.produtoId - b.produtoId)
        : itens;
        
      console.log(`[${txLabel}] Ordem de lock de produtos: ${finalItens.map(i => i.produtoId).join(' -> ')}`);
      
      // 3. Travar produtos em loop com delay artificial para propiciar concorrência
      for (let i = 0; i < finalItens.length; i++) {
        const item = finalItens[i];
        console.log(`[${txLabel}] Lock no Produto ID ${item.produtoId}`);
        await tx.$queryRaw`SELECT * FROM "Produto" WHERE id = ${item.produtoId} FOR UPDATE`;
        
        // Insere delay de 200ms após travar o primeiro produto para forçar o cruzamento de concorrência
        if (i === 0) {
          console.log(`[${txLabel}] Sleep 200ms...`);
          await tx.$executeRaw`SELECT pg_sleep(0.2)`;
        }
      }
      
      // Simula fim da gravação da venda
      console.log(`[${txLabel}] Sucesso! Gravação de venda finalizada.`);
      return true;
    }, { timeout: 10000 });
  };

  let errorOccurred = false;
  
  try {
    // Executa as duas transações em paralelo concorrentemente
    await Promise.all([
      executeVendaTransaction(caixa1.id, user1.id, filial1.id, itensVendaA, 'Transação A'),
      executeVendaTransaction(caixa2.id, user2.id, filial2.id, itensVendaB, 'Transação B'),
    ]);
    console.log(`\n✅ Ambas as transações foram finalizadas com sucesso!`);
  } catch (err: any) {
    errorOccurred = true;
    console.log(`\n❌ Falha detectada durante a execução concorrente:`);
    console.error(err.message || err);
  } finally {
    // 4. Cleanups
    console.log('\nLimpando registros de teste...');
    await prisma.caixa.deleteMany({ where: { lojaId: loja.id } });
    await prisma.produto.deleteMany({ where: { lojaId: loja.id } });
    await prisma.usuario.deleteMany({ where: { lojaId: loja.id } });
    await prisma.filial.deleteMany({ where: { lojaId: loja.id } });
    await prisma.loja.delete({ where: { id: loja.id } });
    console.log('Cleanups finalizados!');
  }

  return errorOccurred;
}

async function run() {
  try {
    // 1. Primeiro executa o teste SEM a ordenação (deve falhar com deadlock)
    const deadlocked = await runDeadlockTest(false);
    
    if (deadlocked) {
      console.log('\n[Resultado] O deadlock foi reproduzido com sucesso sem ordenação! 🚨');
    } else {
      console.log('\n[Resultado] Não ocorreu deadlock (falso negativo ou banco rápido).');
    }

    // 2. Agora executa o teste COM a ordenação ativa (deve passar com sucesso)
    const errorWithSorting = await runDeadlockTest(true);
    
    if (!errorWithSorting) {
      console.log('\n[Resultado] Sucesso! A ordenação evitou o deadlock de concorrência completamente! 🎉');
    } else {
      console.log('\n[Resultado] O teste falhou mesmo com ordenação ativa.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
