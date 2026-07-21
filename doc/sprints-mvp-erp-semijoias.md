# Plano de Sprints — MVP ERP Mobile Semijoias Adorne

Referência: este plano segue a Seção 8 da documentação mestre do projeto ([documentacao-erp-semijoias.md](file:///c:/DEV/Erp-semijoias/doc/documentacao-erp-semijoias.md)).

> [!TIP]
> **Convenção de commits:** Usar Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) para manter o histórico do Git limpo, legível e organizado.

---

## Sprint 0 — Fundação (Backend + Infra)

**Objetivo:** Ter a base do backend rodando localmente, com banco modelado e autenticação JWT funcional.

### Tarefas
- [ ] Criar repositórios no GitHub (`erp-semijoias-api` e `erp-semijoias-app`, ou monorepo).
- [ ] Inicializar o projeto com NestJS.
- [ ] Configurar o ambiente com Docker Compose executando PostgreSQL.
- [ ] Modelar o schema Prisma com as entidades: `Loja`, `Filial`, `Usuario`, `Produto`, `Venda` e `ItemVenda`.
- [ ] Criar e executar a migration inicial do banco de dados.
- [ ] Desenvolver o módulo de autenticação (JWT): endpoint de login, criptografia de senha (hash) e guards baseados em `role`.
- [ ] Criar seed de banco de dados para desenvolvimento: uma Loja, uma Filial (Matriz), um usuário Dono e um Funcionária para testes.

### Critérios de Aceitação
- [ ] A execução do comando `docker compose up` inicia a API e o banco de dados PostgreSQL sem falhas.
- [ ] O endpoint `POST /auth/login` retorna um token JWT válido tanto para credenciais de Dono quanto de Funcionária.
- [ ] Endpoints protegidos por autenticação retornam status `401 Unauthorized` na ausência do token e `200 OK` com token válido.
- [ ] Roteamento restrito com Role-Based Access Control (RBAC): rotas exclusivas do Dono retornam `403 Forbidden` ao serem acessadas com token de Funcionária.

### Commits Sugeridos
```bash
chore: setup projeto NestJS com Docker e PostgreSQL
feat: modelagem inicial do banco com Prisma (Loja, Filial, Usuario, Produto, Venda)
feat: autenticação JWT com guards por role
chore: seed inicial de dados para ambiente de desenvolvimento
```

---

## Sprint 1 — Login e Navegação Mobile

**Objetivo:** Autenticar o usuário no aplicativo mobile e direcioná-lo para a área de navegação exclusiva de sua respectiva `role`.

### Tarefas
- [ ] Inicializar o projeto mobile utilizando Expo, NativeWind para estilização e React Navigation.
- [ ] Desenvolver a tela de login (e-mail/senha) integrada à API do backend.
- [ ] Configurar armazenamento seguro do token JWT através do `Expo SecureStore`.
- [ ] Configurar o cliente TanStack Query com interceptor para injetar o token JWT nos cabeçalhos HTTP.
- [ ] Criar e gerenciar duas stacks de navegação: `FuncionariaStack` e `DonaStack`, selecionadas de forma dinâmica pós-login com base na claim do JWT.

### Critérios de Aceitação
- [ ] O login com perfil de Dono redireciona e exibe a interface exclusiva da Dona (`DonaStack`).
- [ ] O login com perfil de Funcionária redireciona e exibe a interface exclusiva da Funcionária (`FuncionariaStack`).
- [ ] Fechar e reabrir o app mantém o usuário logado (persistência de sessão segura).
- [ ] A ação de logout descarta as credenciais locais com segurança e retorna o fluxo à tela de login.

### Commits Sugeridos
```bash
chore: setup projeto Expo com NativeWind e React Navigation
feat: tela de login integrada à API
feat: navegação condicional por role (dona/funcionária)
```

---

## Sprint 2 — Registro de Venda (lado Funcionária)

**Objetivo:** Permitir que a funcionária registre vendas completas e acompanhe seu próprio histórico.

### Tarefas
- [ ] Criar endpoint `POST /vendas` no backend (registra `Venda` + `ItensVenda`, vinculando à filial e ID do usuário autenticado).
- [ ] Criar endpoint `GET /vendas/minhas` no backend para obter o histórico individual de vendas da funcionária logada.
- [ ] Desenvolver tela mobile "Nova Venda" contendo: seleção de produtos, quantidade, valor unitário/total, forma de pagamento, nome do cliente (campo de texto opcional) e observações.
- [ ] Desenvolver tela mobile "Histórico de Vendas" da funcionária com listagem ordenada.
- [ ] Adicionar validações de dados nas entradas de formulários (ex: usando Zod e React Hook Form).

### Critérios de Aceitação
- [ ] Registrar venda com múltiplos produtos calcula o valor final total de forma correta e automática no backend.
- [ ] As vendas finalizadas aparecem instantaneamente na listagem de histórico próprio da funcionária.
- [ ] Isolamento de dados: funcionárias não possuem privilégio para acessar dados de vendas de outros colaboradores (validar na UI e na API).

### Commits Sugeridos
```bash
feat: endpoint de criação de venda com itens
feat: endpoint de histórico de vendas por usuário
feat: tela de registro de nova venda
feat: tela de histórico de vendas da funcionária
```

---

## Sprint 3 — Sincronização em Tempo Real

**Objetivo:** Garantir a recepção instantânea das vendas realizadas pela funcionária no aplicativo da dona.

### Tarefas
- [ ] Configurar gateway de WebSocket (Socket.io) no NestJS com gerenciamento de conexões em salas segregadas por `lojaId` e `filialId`.
- [ ] Acionar emissão do evento `venda.criada` no barramento do WebSocket ao salvar novas vendas na API.
- [ ] Integrar o aplicativo mobile ao canal WebSocket com autenticação ativa do JWT.
- [ ] Integrar serviço Expo Notifications para emitir notificações push para a dona quando o aplicativo estiver em background.
- [ ] Desenvolver fallback de polling leve no TanStack Query (refetch a cada 30-60s) se a conexão de rede ou WebSocket cair.
- [ ] Desenvolver sistema de persistência offline (fila local no app) para guardar vendas e reenviar automaticamente ao restabelecer conexão de rede.

### Critérios de Aceitação
- [ ] Com ambos os apps logados em telas ativas, registrar uma venda no terminal da funcionária atualiza as estatísticas no terminal da dona instantaneamente, sem refresh manual.
- [ ] Com o aplicativo da dona minimizado ou fechado, uma notificação push avisa sobre a nova venda gerada.
- [ ] Simular queda na conexão WebSocket e verificar se o sistema de polling temporizado entra em execução como fallback de segurança.

### Commits Sugeridos
```bash
feat: gateway WebSocket para eventos de venda em tempo real
feat: integração do app com socket.io para atualização instantânea
feat: push notifications para novas vendas
feat: fallback de polling e fila local de vendas offline
```

---

## Sprint 4 — Dashboard da Dona

**Objetivo:** Permitir à administradora analisar o balanço consolidado e indicadores diários do negócio.

### Tarefas
- [ ] Criar endpoint `GET /dashboard/hoje` que compila dados financeiros e de vendas da data corrente (faturamento total, quantidade de itens, ticket médio e distribuição por método de pagamento).
- [ ] Criar tela mobile de "Dashboard" consumindo o endpoint e vinculando a reatividade ao evento do WebSocket (`venda.criada`).

### Critérios de Aceitação
- [ ] Os dados e valores do dashboard batem matematicamente com o somatório de todas as vendas do banco para o dia.
- [ ] O dashboard reflete em tempo real novos registros de venda sem necessidade de recarregar a visualização.

### Commits Sugeridos
```bash
feat: endpoint de agregação de dashboard diário
feat: tela de dashboard da dona com atualização em tempo real
```

---

## Sprint 5 — Caixa do Dia

**Objetivo:** Permitir a conferência física e cruzamento de valores recebidos categorizados por forma de pagamento.

### Tarefas
- [ ] Criar endpoint `GET /caixa/hoje` que segmenta faturamento por métodos de recebimento (Pix, Dinheiro, Débito, Crédito).
- [ ] Desenvolver tela "Caixa do Dia" no fluxo da funcionária com dados específicos de sua filial correspondente.
- [ ] Desenvolver tela "Caixa do Dia" no fluxo da dona mostrando visões unificadas ou detalhadas por filial.

### Critérios de Aceitação
- [ ] A conciliação de métodos de pagamento bate com a receita global do dashboard.
- [ ] O acesso aos dados respeita o escopo: funcionária vê apenas dados locais; dona vê todos os canais de recebimento.

### Commits Sugeridos
```bash
feat: endpoint de fechamento de caixa por forma de pagamento
feat: tela de caixa do dia (funcionária e dona)
```

---

## Sprint 6 — Relatório Mensal + Comparação

**Objetivo:** Apresentar relatórios agregados e comparativos mensais para tomadas de decisão.

### Tarefas
- [ ] Criar endpoint `GET /relatorios/mensal?mes=&ano=` calculando o faturamento do mês especificado e gerando comparação percentual com o período anterior.
- [ ] Desenvolver tela "Relatórios" com gráficos simples e indicadores consolidados no fluxo da dona.

### Critérios de Aceitação
- [ ] Os relatórios do mês batem com o volume total de transações efetuadas e registradas em banco para o período de referência.
- [ ] A análise percentual de ganho/perda em relação ao mês anterior está correta.

### Commits Sugeridos
```bash
feat: endpoint de relatório mensal com comparação
feat: tela de relatório mensal da dona
```

---

## Encerramento do MVP

- [ ] Gerar tag de versão final do MVP no repositório (`v0.1.0-mvp`).
- [ ] Colocar o sistema em ambiente real de homologação para testes do dia a dia por algumas semanas antes de iniciar as features listadas no roadmap pós-MVP.