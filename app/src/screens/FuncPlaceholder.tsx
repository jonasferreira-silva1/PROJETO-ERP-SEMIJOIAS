import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import * as SecureStore from '../services/storage';
import { 
  Gem, 
  ShoppingCart, 
  History, 
  Package, 
  LogOut, 
  Plus, 
  Minus, 
  Trash2, 
  RefreshCw, 
  Send, 
  User, 
  FileText, 
  Check, 
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Clock
} from 'lucide-react-native';

// Tipo que define a estrutura de um produto no catálogo
interface Produto {
  id: number;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
}

// Tipo que define a estrutura de um item no carrinho de compras
interface CartItem extends Produto {
  quantidade: number;
}

// Tipo que define os dados da venda salva localmente para sincronização offline
interface PendingSale {
  uuid: string;
  formaPagamento: 'DINHEIRO' | 'CREDITO' | 'DEBITO' | 'PIX';
  clienteNome?: string;
  clienteTelefone?: string;
  observacao?: string;
  itens: { produtoId: number; quantidade: number }[];
  _localDetails: {
    clienteNome: string;
    valorTotal: number;
    dataHora: string;
    itensList: string[];
  };
}

// Interface para as movimentações de caixa
interface Movimentacao {
  id: number;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: number;
  descricao: string;
  createdAt: string;
}

// Interface do Caixa Ativo retornado pela API
interface CaixaAtivo {
  id: number;
  saldoInicial: number;
  saldoFinalEsperado: number;
  totalVendasDinheiro: number;
  totalEntradas: number;
  totalSaidas: number;
  status: 'ABERTO' | 'FECHADO';
  dataAbertura: string;
  usuarioAbertura: { id: number; nome: string };
  movimentacoes: Movimentacao[];
  vendasOutrosMeios: { formaPagamento: string; valorTotal: number }[];
}

export default function FuncPlaceholder() {
  const { user, logout } = useAuth();
  
  // Controle de Abas (Adicionada a aba 'caixa')
  const [activeTab, setActiveTab] = useState<'venda' | 'produtos' | 'historico' | 'caixa'>('venda');

  // Estados do Catálogo
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados do Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Estados do Formulário de Venda
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'DINHEIRO' | 'CREDITO' | 'DEBITO' | 'PIX'>('PIX');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Histórico
  const [historico, setHistorico] = useState<any[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);

  // Fila Offline
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados do Caixa do Dia (Sprint 5)
  const [caixaAtivo, setCaixaAtivo] = useState<CaixaAtivo | null>(null);
  const [isLoadingCaixa, setIsLoadingCaixa] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Formulários de Caixa
  const [saldoInicialAbertura, setSaldoInicialAbertura] = useState('');
  const [valorMovimentacao, setValorMovimentacao] = useState('');
  const [descricaoMovimentacao, setDescricaoMovimentacao] = useState('');
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [saldoFinalRealFechamento, setSaldoFinalRealFechamento] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');
  const [submittingCaixa, setSubmittingCaixa] = useState(false);

  // Categorias para filtro rápido
  const categorias = ['Todos', 'Brincos', 'Colares', 'Anéis', 'Pulseiras'];

  // Função utilitária para gerar UUID no dispositivo (idempotência)
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Carrega produtos, histórico e dados de caixa
  useEffect(() => {
    loadProdutos();
    loadPendingSales();
    loadCaixaAtivo();
    if (activeTab === 'historico') {
      loadHistorico();
    }
  }, [activeTab]);

  // Filtros de pesquisa no catálogo
  useEffect(() => {
    let result = produtos;
    if (selectedCategory !== 'Todos') {
      result = result.filter(p => p.categoria === selectedCategory);
    }
    if (searchQuery.trim() !== '') {
      result = result.filter(p => 
        p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setFilteredProdutos(result);
  }, [produtos, selectedCategory, searchQuery]);

  // Busca o catálogo de produtos na API
  const loadProdutos = async () => {
    setIsLoadingProdutos(true);
    try {
      const response = await api.get('/produtos');
      setProdutos(response.data);
      setIsOnline(true);
    } catch (error) {
      console.log('Erro ao carregar produtos:', error);
      setIsOnline(false);
    } finally {
      setIsLoadingProdutos(false);
    }
  };

  // Busca o histórico de vendas na API
  const loadHistorico = async () => {
    setIsLoadingHistorico(true);
    try {
      const response = await api.get('/vendas/historico');
      setHistorico(response.data);
      setIsOnline(true);
    } catch (error) {
      console.log('Erro ao carregar histórico:', error);
      setIsOnline(false);
    } finally {
      setIsLoadingHistorico(false);
    }
  };

  // Carrega a fila offline de vendas pendentes
  const loadPendingSales = async () => {
    try {
      const stored = await SecureStore.getItemAsync('pendingSales');
      if (stored) {
        setPendingSales(JSON.parse(stored));
      } else {
        setPendingSales([]);
      }
    } catch (error) {
      console.log('Erro ao carregar fila offline:', error);
    }
  };

  // Salva a fila offline
  const savePendingSales = async (sales: PendingSale[]) => {
    try {
      await SecureStore.setItemAsync('pendingSales', JSON.stringify(sales));
      setPendingSales(sales);
    } catch (error) {
      console.log('Erro ao salvar fila offline:', error);
    }
  };

  // Busca o estado do caixa ativo no backend (Sprint 5)
  const loadCaixaAtivo = async () => {
    setIsLoadingCaixa(true);
    try {
      const response = await api.get('/caixas/ativo');
      setCaixaAtivo(response.data);
      setIsOnline(true);
    } catch (error: any) {
      console.log('Erro ao carregar caixa ativo:', error);
      // Se não houver conexão, marca como offline
      const isNetError = !error.response || error.message.includes('Network Error') || error.code === 'ECONNABORTED';
      if (isNetError) {
        setIsOnline(false);
      }
    } finally {
      setIsLoadingCaixa(false);
    }
  };

  // Abertura do Caixa (Sprint 5)
  const handleAbrirCaixa = async () => {
    if (!isOnline) {
      Alert.alert('Modo Offline', 'Operações de caixa exigem conexão ativa com a internet.');
      return;
    }
    const saldo = parseFloat(saldoInicialAbertura.replace(',', '.'));
    if (isNaN(saldo) || saldo < 0) {
      Alert.alert('Valor Inválido', 'Insira um valor válido para o saldo inicial de abertura.');
      return;
    }

    setSubmittingCaixa(true);
    try {
      await api.post('/caixas/abrir', { saldoInicial: saldo });
      Alert.alert('Sucesso', 'Caixa aberto com sucesso!');
      setSaldoInicialAbertura('');
      loadCaixaAtivo();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Falha ao abrir o caixa.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingCaixa(false);
    }
  };

  // Lança Sangria ou Suprimento (Sprint 5)
  const handleRegistrarMovimentacao = async () => {
    if (!isOnline) {
      Alert.alert('Modo Offline', 'Operações de caixa exigem conexão ativa com a internet.');
      return;
    }
    const valor = parseFloat(valorMovimentacao.replace(',', '.'));
    const desc = descricaoMovimentacao.trim();

    if (isNaN(valor) || valor <= 0) {
      Alert.alert('Valor Inválido', 'Insira um valor maior que R$ 0,00.');
      return;
    }
    if (desc.length < 3) {
      Alert.alert('Descrição Curta', 'Descreva o motivo da movimentação (mínimo 3 caracteres).');
      return;
    }

    setSubmittingCaixa(true);
    try {
      await api.post('/caixas/movimentar', {
        tipo: tipoMovimentacao,
        valor,
        descricao: desc,
      });
      Alert.alert('Sucesso', 'Movimentação registrada!');
      setValorMovimentacao('');
      setDescricaoMovimentacao('');
      loadCaixaAtivo();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao registrar movimentação.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingCaixa(false);
    }
  };

  // Encerramento do Caixa (Sprint 5)
  const handleFecharCaixa = async () => {
    if (!isOnline) {
      Alert.alert('Modo Offline', 'Operações de caixa exigem conexão ativa com a internet.');
      return;
    }
    const saldoReal = parseFloat(saldoFinalRealFechamento.replace(',', '.'));
    if (isNaN(saldoReal) || saldoReal < 0) {
      Alert.alert('Valor Inválido', 'Insira o dinheiro físico total contado na gaveta.');
      return;
    }

    setSubmittingCaixa(true);
    try {
      const res = await api.post('/caixas/fechar', {
        saldoFinalReal: saldoReal,
        observacao: observacaoFechamento.trim() || undefined,
      });
      const diferenca = res.data.diferenca;
      
      let alertMsg = 'Caixa fechado com sucesso!\n';
      if (diferenca === 0) {
        alertMsg += 'Saldos conciliados perfeitamente (Diferença: R$ 0,00).';
      } else if (diferenca > 0) {
        alertMsg += `Sobrou dinheiro na gaveta! Sobra de: R$ ${diferenca.toFixed(2).replace('.', ',')}`;
      } else {
        alertMsg += `Faltou dinheiro na gaveta! Quebra de: R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')}`;
      }

      Alert.alert('Caixa Encerrado 🔒', alertMsg);
      setSaldoFinalRealFechamento('');
      setObservacaoFechamento('');
      setCaixaAtivo(null);
      loadCaixaAtivo();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao fechar o caixa.';
      Alert.alert('Erro', msg);
    } finally {
      setSubmittingCaixa(false);
    }
  };

  // Sincroniza a fila de vendas offline
  const syncPendingSales = async () => {
    if (pendingSales.length === 0 || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;
    const remainingSales = [...pendingSales];

    for (let i = 0; i < pendingSales.length; i++) {
      const sale = pendingSales[i];
      try {
        await api.post('/vendas', {
          uuid: sale.uuid,
          formaPagamento: sale.formaPagamento,
          clienteNome: sale.clienteNome,
          clienteTelefone: sale.clienteTelefone,
          observacao: sale.observacao,
          itens: sale.itens
        });
        
        successCount++;
        const index = remainingSales.findIndex(s => s.uuid === sale.uuid);
        if (index > -1) remainingSales.splice(index, 1);
      } catch (error: any) {
        console.log(`Erro ao sincronizar venda offline (${sale.uuid}):`, error);
        
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          const apiMsg = error.response.data?.message || 'Dados inválidos';
          Alert.alert(
            'Sincronização Rejeitada',
            `A venda para "${sale._localDetails.clienteNome}" foi descartada pela API: ${apiMsg}`
          );
          const index = remainingSales.findIndex(s => s.uuid === sale.uuid);
          if (index > -1) remainingSales.splice(index, 1);
        } else {
          Alert.alert('Erro de Rede', 'Não foi possível conectar ao servidor para sincronizar todas as vendas.');
          break;
        }
      }
    }

    await savePendingSales(remainingSales);
    setIsSyncing(false);

    if (successCount > 0) {
      Alert.alert('Sincronização Concluída', `${successCount} venda(s) foram enviadas com sucesso para o banco de dados.`);
      loadProdutos();
      loadCaixaAtivo();
      if (activeTab === 'historico') {
        loadHistorico();
      }
    }
  };

  // Carrinho e Checkout
  const addToCart = (produto: Produto) => {
    if (produto.estoque <= 0) {
      Alert.alert('Estoque Esgotado', 'Este item não possui estoque disponível.');
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === produto.id);
      if (existing) {
        if (existing.quantidade >= produto.estoque) {
          Alert.alert('Limite Atingido', `Estoque máximo para este produto é ${produto.estoque} unidades.`);
          return prevCart;
        }
        return prevCart.map(item => 
          item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [...prevCart, { ...produto, quantidade: 1 }];
    });
  };

  const decreaseQuantity = (productId: number) => {
    setCart(prevCart => 
      prevCart.map(item => {
        if (item.id === productId) {
          return { ...item, quantidade: Math.max(1, item.quantidade - 1) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  };

  // Checkout integrado com regras de validação de Caixa Aberto
  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrinho Vazio', 'Adicione pelo menos um produto para continuar.');
      return;
    }

    // Validação de caixa ativo (Bloqueia se online e caixa estiver fechado)
    if (isOnline && !caixaAtivo) {
      Alert.alert(
        'Caixa Fechado! 🔒',
        'Não é possível registrar vendas com o caixa fechado. Acesse a aba "Caixa" e faça a abertura com o saldo de troco.'
      );
      return;
    }

    setIsSubmitting(true);
    const saleUUID = generateUUID();
    const cleanNome = clienteNome.trim() || undefined;
    const cleanTelefone = clienteTelefone.trim() || undefined;
    const cleanObs = observacao.trim() || undefined;
    const total = getCartTotal();

    const payload = {
      uuid: saleUUID,
      formaPagamento,
      clienteNome: cleanNome,
      clienteTelefone: cleanTelefone,
      observacao: cleanObs,
      itens: cart.map(item => ({ produtoId: item.id, quantidade: item.quantidade }))
    };

    try {
      // Tenta enviar online
      await api.post('/vendas', payload);
      Alert.alert('Venda Realizada', 'A venda foi registrada com sucesso no sistema!');
      resetSaleForm();
      loadProdutos();
      loadCaixaAtivo(); // Atualiza faturamento do caixa
    } catch (error: any) {
      console.log('Erro ao enviar venda online:', error);

      const isNetworkError = !error.response || error.message.includes('Network Error') || error.code === 'ECONNABORTED';

      if (isNetworkError) {
        // Se for falha de sinal, permite o fallback offline (será conciliado depois)
        const localSale: PendingSale = {
          ...payload,
          _localDetails: {
            clienteNome: cleanNome || 'Cliente Avulso',
            valorTotal: total,
            dataHora: new Date().toISOString(),
            itensList: cart.map(item => `${item.quantidade}x ${item.nome}`)
          }
        };

        const newQueue = [...pendingSales, localSale];
        await savePendingSales(newQueue);

        Alert.alert(
          'Venda Salva Offline',
          'Conexão de internet indisponível. A venda foi arquivada localmente e será sincronizada assim que possível.'
        );
        resetSaleForm();
      } else {
        const apiMsg = error.response?.data?.message || 'Ocorreu um erro ao processar a venda.';
        Alert.alert('Falha no Registro', apiMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSaleForm = () => {
    setCart([]);
    setClienteNome('');
    setClienteTelefone('');
    setObservacao('');
    setFormaPagamento('PIX');
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toFixed(2).replace('.', ',')}`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString('pt-BR');
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} às ${timeStr}`;
  };

  // Renderizador de cada item do catálogo de produtos
  const renderProdutoCard = ({ item }: { item: Produto }) => {
    const isOutOfStock = item.estoque <= 0;
    return (
      <View className="bg-white rounded-2xl p-4 mb-2.5 border border-adorne-gold/15 shadow-xs flex-row justify-between items-center">
        <View className="flex-1 pr-2">
          <Text className="text-xs font-bold text-adorne-text">{item.nome}</Text>
          <Text className="text-[10px] text-adorne-gray mt-0.5">{item.categoria}</Text>
          <Text className="text-[11px] font-bold text-adorne-teal mt-1">{formatCurrency(item.preco)}</Text>
        </View>
        <View className="items-end">
          <Text className={`text-[10px] font-bold mb-2 ${isOutOfStock ? 'text-red-500' : 'text-adorne-gray'}`}>
            {isOutOfStock ? 'Sem estoque' : `${item.estoque} un. disponíveis`}
          </Text>
          <TouchableOpacity 
            onPress={() => addToCart(item)}
            disabled={isOutOfStock}
            className={`px-3 py-1.5 rounded-lg flex-row items-center ${isOutOfStock ? 'bg-adorne-gray/20' : 'bg-adorne-teal active:opacity-90'}`}
          >
            <Plus size={12} color="#ffffff" className="mr-1" />
            <Text className="text-white text-[10px] font-bold">Adicionar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Renderizador de cada item do histórico de vendas
  const renderHistoricoCard = ({ item }: { item: any }) => {
    const isOffline = item._isOffline;
    return (
      <View className={`bg-white rounded-2xl p-4 mb-2.5 border shadow-xs ${isOffline ? 'border-amber-200 bg-amber-50/20' : 'border-adorne-gold/15'}`}>
        <View className="flex-row justify-between items-start mb-2 pb-2 border-b border-adorne-background">
          <View>
            <View className="flex-row items-center">
              <Clock size={10} color="#607371" className="mr-1" />
              <Text className="text-[9px] text-adorne-gray font-semibold">
                {isOffline ? formatDate(item._localDetails.dataHora) : formatDate(item.createdAt)}
              </Text>
            </View>
            <Text className="text-xs font-extrabold text-adorne-text mt-1">
              {isOffline ? item._localDetails.clienteNome : (item.cliente?.nome || 'Cliente Avulso')}
            </Text>
          </View>
          {isOffline && (
            <View className="bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              <Text className="text-amber-800 text-[8px] font-extrabold uppercase">Offline</Text>
            </View>
          )}
        </View>

        {/* Itens listados */}
        <View className="space-y-1 mb-2">
          {isOffline ? (
            item._localDetails.itensList.map((str: string, idx: number) => (
              <Text key={idx} className="text-[10px] text-adorne-gray italic">• {str}</Text>
            ))
          ) : (
            item.itens?.map((it: any, idx: number) => (
              <Text key={idx} className="text-[10px] text-adorne-gray">• {it.quantidade}x {it.produto?.nome || 'Peça Excluída'}</Text>
            ))
          )}
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-adorne-background">
          <Text className="text-[9px] text-adorne-gray font-bold uppercase tracking-wider">
            {item.formaPagamento}
          </Text>
          <Text className="text-sm font-black text-emerald-600">
            {formatCurrency(isOffline ? item._localDetails.valorTotal : item.valorTotal)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-adorne-background"
    >
      {/* Header Institucional */}
      <View className="bg-white px-6 pt-12 pb-4 shadow-sm border-b border-adorne-gold/10 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-full border border-adorne-gold items-center justify-center bg-adorne-background mr-2.5">
            <Gem size={16} color="#0B3A34" />
          </View>
          <View>
            <Text className="text-xs text-adorne-gray font-semibold">Semijoias Adorne</Text>
            <Text className="text-sm font-bold text-adorne-teal">{user?.nome}</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={logout}
          className="w-9 h-9 rounded-xl border border-red-100 items-center justify-center bg-red-50/40 active:opacity-75"
        >
          <LogOut size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Alerta de Sincronização Offline */}
      {pendingSales.length > 0 && (
        <View className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-3">
            <AlertTriangle size={18} color="#D97706" className="mr-2" />
            <Text className="text-xs text-amber-800 font-semibold flex-1">
              Possui {pendingSales.length} venda(s) offline pendentes.
            </Text>
          </View>
          <TouchableOpacity 
            onPress={syncPendingSales}
            disabled={isSyncing}
            className="bg-amber-600 px-3 py-1.5 rounded-lg flex-row items-center"
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#ffffff" className="mr-1" />
            ) : (
              <RefreshCw size={12} color="#ffffff" className="mr-1" />
            )}
            <Text className="text-white text-[10px] font-bold">Sincronizar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. ABA NOVA VENDA */}
      {activeTab === 'venda' && (
        <View className="flex-1">
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View className="p-6">
              <Text className="text-base font-bold text-adorne-teal mb-3">🛒 Carrinho de Compras</Text>
              
              {cart.length === 0 ? (
                <View className="bg-white border border-dashed border-adorne-gold/30 rounded-3xl p-8 items-center justify-center">
                  <ShoppingCart size={32} color="#C5A880" className="opacity-60 mb-2" />
                  <Text className="text-adorne-gray text-xs font-semibold text-center mb-1">Seu carrinho está vazio</Text>
                  <Text className="text-[10px] text-adorne-gray/70 text-center">Adicione peças no catálogo e finalize o registro por aqui.</Text>
                </View>
              ) : (
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-4 shadow-sm">
                  {cart.map(item => (
                    <View key={item.id} className="flex-row items-center justify-between py-2 border-b border-adorne-background last:border-b-0">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-adorne-text">{item.nome}</Text>
                        <Text className="text-[10px] text-adorne-gray font-semibold mt-0.5">{formatCurrency(item.preco)} cada</Text>
                      </View>
                      <View className="flex-row items-center">
                        <TouchableOpacity 
                          onPress={() => decreaseQuantity(item.id)}
                          className="w-6 h-6 rounded bg-adorne-background items-center justify-center"
                        >
                          <Minus size={12} color="#0B3A34" />
                        </TouchableOpacity>
                        <Text className="mx-2 text-xs font-bold text-adorne-teal">{item.quantidade}</Text>
                        <TouchableOpacity 
                          onPress={() => addToCart(item)}
                          className="w-6 h-6 rounded bg-adorne-background items-center justify-center"
                        >
                          <Plus size={12} color="#0B3A34" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => removeFromCart(item.id)}
                          className="ml-3 p-1"
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  
                  <View className="flex-row justify-between items-center pt-3 mt-2 border-t border-adorne-background">
                    <Text className="text-xs font-bold text-adorne-gray uppercase">Valor Total</Text>
                    <Text className="text-lg font-black text-adorne-teal">{formatCurrency(getCartTotal())}</Text>
                  </View>
                </View>
              )}
            </View>

            {cart.length > 0 && (
              <View className="px-6">
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm">
                  <Text className="text-sm font-bold text-adorne-teal mb-4 uppercase tracking-wider border-b border-adorne-background pb-2">
                    Dados Adicionais da Venda
                  </Text>

                  <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Cliente (Opcional)</Text>
                  <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
                    <User size={16} color="#607371" />
                    <TextInput
                      value={clienteNome}
                      onChangeText={setClienteNome}
                      placeholder="Nome da Cliente"
                      placeholderTextColor="#A0B0AE"
                      className="flex-1 h-12 ml-2 text-adorne-text text-sm"
                    />
                  </View>

                  <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Telefone da Cliente (Opcional)</Text>
                  <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
                    <FileText size={16} color="#607371" />
                    <TextInput
                      value={clienteTelefone}
                      onChangeText={setClienteTelefone}
                      placeholder="(DD) 99999-9999"
                      placeholderTextColor="#A0B0AE"
                      keyboardType="phone-pad"
                      className="flex-1 h-12 ml-2 text-adorne-text text-sm"
                    />
                  </View>

                  <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-2 ml-1">Forma de Pagamento</Text>
                  <View className="flex-row flex-wrap mb-4 justify-between">
                    {(['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'] as const).map((method) => (
                      <TouchableOpacity
                        key={method}
                        onPress={() => setFormaPagamento(method)}
                        className={`w-[48%] py-3 mb-2 rounded-xl border items-center justify-center ${
                          formaPagamento === method
                            ? 'bg-adorne-teal border-adorne-teal'
                            : 'bg-white border-adorne-gold/20'
                        }`}
                      >
                        <Text className={`text-xs font-bold ${formaPagamento === method ? 'text-white' : 'text-adorne-gray'}`}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Observações</Text>
                  <View className="bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 py-2 mb-6">
                    <TextInput
                      value={observacao}
                      onChangeText={setObservacao}
                      placeholder="Notas..."
                      placeholderTextColor="#A0B0AE"
                      multiline
                      numberOfLines={3}
                      className="text-adorne-text text-sm h-16 text-start"
                      style={{ textAlignVertical: 'top' }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={handleCheckout}
                    disabled={isSubmitting}
                    className="w-full bg-adorne-teal h-14 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Send size={16} color="#ffffff" className="mr-2" />
                        <Text className="text-white font-bold text-base">Finalizar Venda - {formatCurrency(getCartTotal())}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* 2. ABA ESTOQUE/PRODUTOS */}
      {activeTab === 'produtos' && (
        <View className="flex-1 p-6">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Pesquisar peça ou categoria..."
            placeholderTextColor="#A0B0AE"
            className="bg-white border border-adorne-gold/20 rounded-2xl h-12 px-4 mb-4 text-adorne-text text-sm shadow-sm"
          />

          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {categorias.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full mr-2 border ${
                    selectedCategory === cat ? 'bg-adorne-teal border-adorne-teal' : 'bg-white border-adorne-gold/20'
                  }`}
                >
                  <Text className={`text-xs font-bold ${selectedCategory === cat ? 'text-white' : 'text-adorne-gray'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {isLoadingProdutos ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0B3A34" />
            </View>
          ) : filteredProdutos.length === 0 ? (
            <View className="flex-1 justify-center items-center p-8 bg-white border border-adorne-gold/10 rounded-3xl shadow-sm">
              <Package size={40} color="#C5A880" className="opacity-50 mb-2" />
              <Text className="text-adorne-gray text-xs text-center font-bold">Nenhum produto encontrado</Text>
            </View>
          ) : (
            <FlatList
              data={filteredProdutos}
              renderItem={renderProdutoCard}
              keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              onRefresh={loadProdutos}
              refreshing={isLoadingProdutos}
            />
          )}
        </View>
      )}

      {/* 3. ABA HISTÓRICO */}
      {activeTab === 'historico' && (
        <View className="flex-1 p-6">
          <Text className="text-base font-bold text-adorne-teal mb-3">📜 Minhas Vendas Registradas</Text>

          {isLoadingHistorico ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0B3A34" />
            </View>
          ) : historico.length === 0 && pendingSales.length === 0 ? (
            <View className="flex-1 justify-center items-center p-8 bg-white border border-adorne-gold/10 rounded-3xl shadow-sm">
              <History size={40} color="#C5A880" className="opacity-50 mb-2" />
              <Text className="text-adorne-gray text-xs text-center font-bold">Nenhuma venda encontrada</Text>
            </View>
          ) : (
            <FlatList
              data={[
                ...pendingSales.map(s => ({ ...s, _isOffline: true, id: `offline-${s.uuid}` })),
                ...historico
              ]}
              renderItem={renderHistoricoCard}
              keyExtractor={item => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              onRefresh={loadHistorico}
              refreshing={isLoadingHistorico}
            />
          )}
        </View>
      )}

      {/* 4. ABA CAIXA (Sprint 5) */}
      {activeTab === 'caixa' && (
        <View className="flex-1 p-6">
          {/* Validação de Fila Offline para Caixa */}
          {!isOnline ? (
            <View className="bg-red-50 border border-red-200 rounded-3xl p-6 items-center justify-center flex-1">
              <AlertTriangle size={48} color="#DC2626" className="mb-3" />
              <Text className="text-red-800 text-sm font-bold text-center">Conexão Necessária ⚠️</Text>
              <Text className="text-red-700 text-xs text-center mt-2">
                As operações de abertura, movimentação e fechamento de caixa dependem de validações online imediatas para auditoria. Restabeleça o sinal para operar.
              </Text>
              <TouchableOpacity 
                onPress={loadCaixaAtivo}
                className="mt-6 bg-red-600 px-6 py-2.5 rounded-xl"
              >
                <Text className="text-white text-xs font-bold">Tentar Reconectar</Text>
              </TouchableOpacity>
            </View>
          ) : isLoadingCaixa ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0B3A34" />
            </View>
          ) : !caixaAtivo ? (
            // Form de Abertura de Caixa
            <ScrollView className="flex-1" contentContainerStyle={{ justifyContent: 'center', paddingVertical: 12 }}>
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm">
                <View className="items-center mb-6">
                  <View className="bg-adorne-background w-12 h-12 rounded-full border border-adorne-gold items-center justify-center mb-3">
                    <Lock size={20} color="#0B3A34" />
                  </View>
                  <Text className="text-base font-bold text-adorne-teal">O Caixa está Fechado</Text>
                  <Text className="text-[10px] text-adorne-gray mt-1 text-center">Insira o saldo inicial em dinheiro (troco) para abrir a gaveta de vendas do dia.</Text>
                </View>

                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Fundo de Troco Inicial (Dinheiro)</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-6">
                  <Text className="text-sm font-bold text-adorne-teal mr-1">R$</Text>
                  <TextInput
                    value={saldoInicialAbertura}
                    onChangeText={setSaldoInicialAbertura}
                    placeholder="100,00"
                    placeholderTextColor="#A0B0AE"
                    keyboardType="numeric"
                    className="flex-1 h-12 text-adorne-text font-bold text-sm"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleAbrirCaixa}
                  disabled={submittingCaixa}
                  className="w-full bg-adorne-teal h-13 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90"
                >
                  {submittingCaixa ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Unlock size={16} color="#ffffff" className="mr-2" />
                      <Text className="text-white font-bold text-sm">Abrir Caixa do Dia</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            // Caixa Aberto: Visualização e Movimentações
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              
              {/* Card Resumo do Caixa */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
                <View className="flex-row justify-between items-center mb-4 border-b border-adorne-background pb-3">
                  <View className="flex-row items-center">
                    <Unlock size={14} color="#059669" className="mr-1" />
                    <Text className="text-xs font-extrabold text-emerald-600">CAIXA ABERTO</Text>
                  </View>
                  <Text className="text-[9px] text-adorne-gray font-bold">Início: {formatDate(caixaAtivo.dataAbertura)}</Text>
                </View>

                {/* Grid Saldos */}
                <View className="flex-row justify-between flex-wrap">
                  <View className="w-[48%] mb-3">
                    <Text className="text-[8px] font-bold text-adorne-gray uppercase">Troco Inicial</Text>
                    <Text className="text-sm font-bold text-adorne-teal">{formatCurrency(caixaAtivo.saldoInicial)}</Text>
                  </View>
                  <View className="w-[48%] mb-3">
                    <Text className="text-[8px] font-bold text-adorne-gray uppercase">Vendas Dinheiro</Text>
                    <Text className="text-sm font-bold text-emerald-600">+{formatCurrency(caixaAtivo.totalVendasDinheiro)}</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-[8px] font-bold text-adorne-gray uppercase">Suprimentos</Text>
                    <Text className="text-sm font-bold text-blue-600">+{formatCurrency(caixaAtivo.totalEntradas)}</Text>
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-[8px] font-bold text-adorne-gray uppercase">Sangrias</Text>
                    <Text className="text-sm font-bold text-red-500">-{formatCurrency(caixaAtivo.totalSaidas)}</Text>
                  </View>
                </View>

                {/* Total Esperado */}
                <View className="bg-adorne-background rounded-xl p-3.5 mt-4 border border-adorne-gold/10">
                  <Text className="text-[9px] font-extrabold text-adorne-gray uppercase tracking-wider">Saldo Físico Esperado (Gaveta)</Text>
                  <Text className="text-xl font-black text-adorne-teal mt-0.5">{formatCurrency(caixaAtivo.saldoFinalEsperado)}</Text>
                </View>

                {/* Outros Meios de Pagamento */}
                {caixaAtivo.vendasOutrosMeios.length > 0 && (
                  <View className="mt-4 border-t border-adorne-background pt-3">
                    <Text className="text-[8px] font-bold text-adorne-gray uppercase mb-2">Pix / Cartões (Auditoria Digital)</Text>
                    {caixaAtivo.vendasOutrosMeios.map((m, idx) => (
                      <View key={idx} className="flex-row justify-between py-0.5">
                        <Text className="text-[10px] text-adorne-gray font-bold">{m.formaPagamento}</Text>
                        <Text className="text-[10px] text-adorne-teal font-extrabold">{formatCurrency(m.valorTotal)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Seção Suprimento/Sangria (Apenas Online) */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
                <Text className="text-xs font-bold text-adorne-teal uppercase mb-3">Movimentar Dinheiro</Text>
                
                <View className="flex-row justify-between mb-3">
                  <TouchableOpacity
                    onPress={() => setTipoMovimentacao('ENTRADA')}
                    className={`flex-1 py-2 rounded-xl border items-center justify-center mr-1 ${tipoMovimentacao === 'ENTRADA' ? 'bg-blue-50 border-blue-500' : 'border-adorne-gold/15 bg-white'}`}
                  >
                    <Text className={`text-xs font-bold ${tipoMovimentacao === 'ENTRADA' ? 'text-blue-700' : 'text-adorne-gray'}`}>Suprimento (Entrada)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setTipoMovimentacao('SAIDA')}
                    className={`flex-1 py-2 rounded-xl border items-center justify-center ml-1 ${tipoMovimentacao === 'SAIDA' ? 'bg-red-50 border-red-500' : 'border-adorne-gold/15 bg-white'}`}
                  >
                    <Text className={`text-xs font-bold ${tipoMovimentacao === 'SAIDA' ? 'text-red-700' : 'text-adorne-gray'}`}>Sangria (Retirada)</Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row mb-3">
                  <TextInput
                    value={valorMovimentacao}
                    onChangeText={setValorMovimentacao}
                    placeholder="R$ 0,00"
                    placeholderTextColor="#A0B0AE"
                    keyboardType="numeric"
                    className="bg-adorne-background border border-adorne-gold/15 rounded-xl h-11 px-3 w-[30%] text-adorne-text font-bold text-xs mr-2"
                  />
                  <TextInput
                    value={descricaoMovimentacao}
                    onChangeText={setDescricaoMovimentacao}
                    placeholder="Motivo..."
                    placeholderTextColor="#A0B0AE"
                    className="bg-adorne-background border border-adorne-gold/15 rounded-xl h-11 px-3 flex-1 text-adorne-text text-xs"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleRegistrarMovimentacao}
                  disabled={submittingCaixa}
                  className="w-full bg-adorne-teal h-11 rounded-xl items-center justify-center active:opacity-90"
                >
                  <Text className="text-white text-xs font-bold">Registrar Lançamento</Text>
                </TouchableOpacity>
              </View>

              {/* Seção Fechamento de Caixa */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
                <Text className="text-xs font-bold text-red-600 uppercase mb-3 flex-row items-center">
                  🔒 Fechamento e Conciliação Diária
                </Text>
                
                <Text className="text-[9px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Total de Dinheiro Contado na Gaveta</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-3">
                  <Text className="text-xs font-bold text-adorne-teal mr-1">R$</Text>
                  <TextInput
                    value={saldoFinalRealFechamento}
                    onChangeText={setSaldoFinalRealFechamento}
                    placeholder="Contagem física..."
                    placeholderTextColor="#A0B0AE"
                    keyboardType="numeric"
                    className="flex-1 h-11 text-adorne-text font-bold text-xs"
                  />
                </View>

                <TextInput
                  value={observacaoFechamento}
                  onChangeText={setObservacaoFechamento}
                  placeholder="Notas adicionais sobre o caixa (opcional)..."
                  placeholderTextColor="#A0B0AE"
                  className="bg-adorne-background border border-adorne-gold/15 rounded-xl h-11 px-3 text-adorne-text text-xs mb-4"
                />

                <TouchableOpacity
                  onPress={handleFecharCaixa}
                  disabled={submittingCaixa}
                  className="w-full bg-red-600 h-11 rounded-xl items-center justify-center active:opacity-90"
                >
                  <Text className="text-white text-xs font-bold">Fechar e Conciliar Caixa</Text>
                </TouchableOpacity>
              </View>

              {/* Lista de Movimentações Atuais */}
              <View>
                <Text className="text-xs font-bold text-adorne-teal uppercase mb-3 ml-1">Extrato do Caixa Atual</Text>
                {caixaAtivo.movimentacoes.length === 0 ? (
                  <View className="bg-white rounded-2xl p-6 items-center justify-center border border-adorne-gold/10">
                    <Text className="text-adorne-gray text-xs italic">Nenhum suprimento ou sangria neste turno</Text>
                  </View>
                ) : (
                  caixaAtivo.movimentacoes.map((mov) => (
                    <View key={mov.id} className="bg-white rounded-2xl p-3 mb-2 border border-adorne-gold/15 flex-row justify-between items-center shadow-xs">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-adorne-text">{mov.descricao}</Text>
                        <Text className="text-[9px] text-adorne-gray mt-0.5">{formatDate(mov.createdAt)}</Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-xs font-extrabold ${mov.tipo === 'ENTRADA' ? 'text-blue-600' : 'text-red-500'}`}>
                          {mov.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(mov.valor)}
                        </Text>
                        <Text className="text-[8px] text-adorne-gray font-bold uppercase tracking-wider mt-0.5">
                          {mov.tipo === 'ENTRADA' ? 'Suprimento' : 'Sangria'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

            </ScrollView>
          )}
        </View>
      )}

      {/* Barra de Navegação Floating Premium */}
      <View className="bg-white border-t border-adorne-gold/15 py-3.5 px-6 flex-row justify-around items-center shadow-lg">
        {/* Aba Nova Venda */}
        <TouchableOpacity 
          onPress={() => setActiveTab('venda')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'venda' ? 'bg-adorne-teal/10' : ''}`}>
            <ShoppingCart size={18} color={activeTab === 'venda' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'venda' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Nova Venda
          </Text>
        </TouchableOpacity>

        {/* Aba Catálogo */}
        <TouchableOpacity 
          onPress={() => setActiveTab('produtos')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'produtos' ? 'bg-adorne-teal/10' : ''}`}>
            <Package size={18} color={activeTab === 'produtos' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'produtos' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Estoque
          </Text>
        </TouchableOpacity>

        {/* Aba Caixa */}
        <TouchableOpacity 
          onPress={() => setActiveTab('caixa')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'caixa' ? 'bg-adorne-teal/10' : ''}`}>
            <Unlock size={18} color={activeTab === 'caixa' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'caixa' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Caixa
          </Text>
        </TouchableOpacity>

        {/* Aba Histórico */}
        <TouchableOpacity 
          onPress={() => setActiveTab('historico')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'historico' ? 'bg-adorne-teal/10' : ''}`}>
            <History size={18} color={activeTab === 'historico' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'historico' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Histórico
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
