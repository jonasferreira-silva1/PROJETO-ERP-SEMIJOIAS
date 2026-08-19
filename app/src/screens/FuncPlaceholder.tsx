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
  Platform,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getLocalItemAsync, setLocalItemAsync, migrateKeyFromSecureToLocal } from '../services/storage';
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
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Clock,
  Edit3,
  X,
  Check,
  Star,
  Zap,
  ChevronRight,
  Phone,
  Mail,
  Building2,
  Tag,
  Hash,
} from 'lucide-react-native';

// Interfaces
interface Produto {
  id: number;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
}

interface CartItem extends Produto {
  quantidade: number;
}

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

interface Movimentacao {
  id: number;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: number;
  descricao: string;
  createdAt: string;
}

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

const CATEGORIAS = ['Todos', 'Brincos', 'Colares', 'Anéis', 'Pulseiras'];

const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });


export default function FuncPlaceholder() {
  const { user, logout } = useAuth();
  const isDona = user?.role === 'DONO';

  // Abas
  const [activeTab, setActiveTab] = useState<'venda' | 'produtos' | 'historico' | 'caixa' | 'perfil'>('venda');

  // Modal de confirmação de logout
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Catálogo
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Carrinho
  const [cart, setCart] = useState<CartItem[]>([]);

  // Formulário de Venda
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'DINHEIRO' | 'CREDITO' | 'DEBITO' | 'PIX'>('PIX');
  const [observacao, setObservacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Histórico
  const [historico, setHistorico] = useState<any[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);

  // Fila Offline
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Caixa
  const [caixaAtivo, setCaixaAtivo] = useState<CaixaAtivo | null>(null);
  const [isLoadingCaixa, setIsLoadingCaixa] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [saldoInicialAbertura, setSaldoInicialAbertura] = useState('');
  const [valorMovimentacao, setValorMovimentacao] = useState('');
  const [descricaoMovimentacao, setDescricaoMovimentacao] = useState('');
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [saldoFinalRealFechamento, setSaldoFinalRealFechamento] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');
  const [submittingCaixa, setSubmittingCaixa] = useState(false);

  // Modal Editar/Criar Produto (apenas Dona)
  const [isProdutoModalVisible, setIsProdutoModalVisible] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState('Brincos');
  const [formPreco, setFormPreco] = useState('');
  const [formEstoque, setFormEstoque] = useState('');
  const [isSavingProduto, setIsSavingProduto] = useState(false);


  // Effects
  useEffect(() => {
    loadProdutos();
    loadPendingSales();
    loadCaixaAtivo();
  }, []);

  useEffect(() => {
    if (activeTab === 'historico') loadHistorico();
  }, [activeTab]);

  useEffect(() => {
    let result = produtos;
    if (selectedCategory !== 'Todos') result = result.filter(p => p.categoria === selectedCategory);
    if (searchQuery.trim()) result = result.filter(p =>
      p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoria.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProdutos(result);
  }, [produtos, selectedCategory, searchQuery]);

  // API calls
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

  const loadPendingSales = async () => {
    try {
      // 1. Migra dados da fila offline persistidos na versão antiga (SecureStore)
      await migrateKeyFromSecureToLocal('pendingSales');
      
      // 2. Carrega os dados do AsyncStorage não-seguro
      const stored = await getLocalItemAsync('pendingSales');
      setPendingSales(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.log('Erro ao carregar fila offline:', error);
    }
  };

  const savePendingSales = async (sales: PendingSale[]) => {
    try {
      // Salva no AsyncStorage não-seguro
      await setLocalItemAsync('pendingSales', JSON.stringify(sales));
      setPendingSales(sales);
    } catch (error) {
      console.log('Erro ao salvar fila offline:', error);
    }
  };

  const loadCaixaAtivo = async () => {
    setIsLoadingCaixa(true);
    try {
      const response = await api.get('/caixas/ativo');
      setCaixaAtivo(response.data);
      setIsOnline(true);
    } catch (error: any) {
      const isNetError = !error.response || error.message.includes('Network Error') || error.code === 'ECONNABORTED';
      if (isNetError) setIsOnline(false);
    } finally {
      setIsLoadingCaixa(false);
    }
  };


  // Gestão de Produtos (Dona)
  const openCreateProduto = () => {
    setEditingProduto(null);
    setFormNome('');
    setFormCategoria('Brincos');
    setFormPreco('');
    setFormEstoque('');
    setIsProdutoModalVisible(true);
  };

  const openEditProduto = (produto: Produto) => {
    setEditingProduto(produto);
    setFormNome(produto.nome);
    setFormCategoria(produto.categoria);
    setFormPreco(produto.preco.toString().replace('.', ','));
    setFormEstoque(produto.estoque.toString());
    setIsProdutoModalVisible(true);
  };

  const handleSaveProduto = async () => {
    const nome = formNome.trim();
    const preco = parseFloat(formPreco.replace(',', '.'));
    const estoque = parseInt(formEstoque, 10);

    if (!nome || nome.length < 2) {
      Alert.alert('Campo obrigatório', 'Informe o nome da peça (mínimo 2 caracteres).');
      return;
    }
    if (isNaN(preco) || preco <= 0) {
      Alert.alert('Preço inválido', 'Informe um preço maior que R$ 0,00.');
      return;
    }
    if (isNaN(estoque) || estoque < 0) {
      Alert.alert('Estoque inválido', 'Informe um estoque válido (0 ou mais).');
      return;
    }

    setIsSavingProduto(true);
    try {
      if (editingProduto) {
        await api.patch(`/produtos/${editingProduto.id}`, { nome, categoria: formCategoria, preco, estoque });
        Alert.alert('Sucesso', 'Peça atualizada com sucesso!');
      } else {
        await api.post('/produtos', { nome, categoria: formCategoria, preco, estoque });
        Alert.alert('Sucesso', 'Nova peça cadastrada!');
      }
      setIsProdutoModalVisible(false);
      loadProdutos();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao salvar a peça.';
      Alert.alert('Erro', msg);
    } finally {
      setIsSavingProduto(false);
    }
  };

  const handleDeleteProduto = (produto: Produto) => {
    Alert.alert(
      'Excluir Peça',
      `Tem certeza que deseja excluir "${produto.nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/produtos/${produto.id}`);
              Alert.alert('Excluído', 'Peça removida do catálogo.');
              loadProdutos();
            } catch (error: any) {
              const msg = error.response?.data?.message || 'Erro ao excluir a peça.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ]
    );
  };


  // Caixa
  const handleAbrirCaixa = async () => {
    if (!isOnline) { Alert.alert('Modo Offline', 'Operações de caixa exigem conexão ativa.'); return; }
    const saldo = parseFloat(saldoInicialAbertura.replace(',', '.'));
    if (isNaN(saldo) || saldo < 0) { Alert.alert('Valor Inválido', 'Insira um valor válido para o saldo inicial.'); return; }
    setSubmittingCaixa(true);
    try {
      await api.post('/caixas/abrir', { saldoInicial: saldo });
      Alert.alert('Sucesso', 'Caixa aberto!');
      setSaldoInicialAbertura('');
      loadCaixaAtivo();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha ao abrir o caixa.');
    } finally { setSubmittingCaixa(false); }
  };

  const handleRegistrarMovimentacao = async () => {
    if (!isOnline) { Alert.alert('Modo Offline', 'Operações de caixa exigem conexão ativa.'); return; }
    const valor = parseFloat(valorMovimentacao.replace(',', '.'));
    const desc = descricaoMovimentacao.trim();
    if (isNaN(valor) || valor <= 0) { Alert.alert('Valor Inválido', 'Insira um valor maior que R$ 0,00.'); return; }
    if (desc.length < 3) { Alert.alert('Descrição Curta', 'Descreva o motivo (mínimo 3 caracteres).'); return; }
    setSubmittingCaixa(true);
    try {
      await api.post('/caixas/movimentar', { tipo: tipoMovimentacao, valor, descricao: desc });
      Alert.alert('Sucesso', 'Movimentação registrada!');
      setValorMovimentacao('');
      setDescricaoMovimentacao('');
      loadCaixaAtivo();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao registrar movimentação.');
    } finally { setSubmittingCaixa(false); }
  };

  const handleFecharCaixa = async () => {
    if (!isOnline) { Alert.alert('Modo Offline', 'Operações de caixa exigem conexão ativa.'); return; }
    const saldoReal = parseFloat(saldoFinalRealFechamento.replace(',', '.'));
    if (isNaN(saldoReal) || saldoReal < 0) { Alert.alert('Valor Inválido', 'Insira o dinheiro contado na gaveta.'); return; }
    setSubmittingCaixa(true);
    try {
      const res = await api.post('/caixas/fechar', { saldoFinalReal: saldoReal, observacao: observacaoFechamento.trim() || undefined });
      const dif = res.data.diferenca;
      let msg = 'Caixa fechado!\n';
      if (dif === 0) msg += 'Saldos conferem. Diferença: R$ 0,00.';
      else if (dif > 0) msg += `Sobra: R$ ${dif.toFixed(2).replace('.', ',')}`;
      else msg += `Quebra: R$ ${Math.abs(dif).toFixed(2).replace('.', ',')}`;
      Alert.alert('Caixa Encerrado 🔒', msg);
      setSaldoFinalRealFechamento('');
      setObservacaoFechamento('');
      setCaixaAtivo(null);
      loadCaixaAtivo();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao fechar o caixa.');
    } finally { setSubmittingCaixa(false); }
  };


  // Sync offline
  const syncPendingSales = async () => {
    if (pendingSales.length === 0 || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;
    const remaining = [...pendingSales];
    for (let i = 0; i < pendingSales.length; i++) {
      const sale = pendingSales[i];
      try {
        await api.post('/vendas', { uuid: sale.uuid, formaPagamento: sale.formaPagamento, clienteNome: sale.clienteNome, clienteTelefone: sale.clienteTelefone, observacao: sale.observacao, itens: sale.itens });
        successCount++;
        const idx = remaining.findIndex(s => s.uuid === sale.uuid);
        if (idx > -1) remaining.splice(idx, 1);
      } catch (error: any) {
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          Alert.alert('Sincronização Rejeitada', `A venda de "${sale._localDetails.clienteNome}" foi descartada: ${error.response.data?.message || 'Dados inválidos'}`);
          const idx = remaining.findIndex(s => s.uuid === sale.uuid);
          if (idx > -1) remaining.splice(idx, 1);
        } else { Alert.alert('Erro de Rede', 'Não foi possível sincronizar todas as vendas.'); break; }
      }
    }
    await savePendingSales(remaining);
    setIsSyncing(false);
    if (successCount > 0) { Alert.alert('Sincronização Concluída', `${successCount} venda(s) enviadas!`); loadProdutos(); loadCaixaAtivo(); }
  };

  // Carrinho
  const addToCart = (produto: Produto) => {
    if (produto.estoque <= 0) { Alert.alert('Estoque Esgotado', 'Este item não possui estoque.'); return; }
    setCart(prev => {
      const existing = prev.find(item => item.id === produto.id);
      if (existing) {
        if (existing.quantidade >= produto.estoque) { Alert.alert('Limite Atingido', `Estoque máximo: ${produto.estoque} un.`); return prev; }
        return prev.map(item => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      }
      return [...prev, { ...produto, quantidade: 1 }];
    });
  };

  const decreaseQuantity = (productId: number) => {
    setCart(prev => prev.map(item => item.id === productId ? { ...item, quantidade: Math.max(1, item.quantidade - 1) } : item));
  };

  const removeFromCart = (productId: number) => setCart(prev => prev.filter(item => item.id !== productId));

  const getCartTotal = () => cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) { Alert.alert('Carrinho Vazio', 'Adicione pelo menos um produto.'); return; }
    if (isOnline && !caixaAtivo) { Alert.alert('Caixa Fechado! 🔒', 'Acesse a aba "Caixa" e abra o caixa do dia antes de vender.'); return; }
    setIsSubmitting(true);
    const saleUUID = generateUUID();
    const payload = { uuid: saleUUID, formaPagamento, clienteNome: clienteNome.trim() || undefined, clienteTelefone: clienteTelefone.trim() || undefined, observacao: observacao.trim() || undefined, itens: cart.map(item => ({ produtoId: item.id, quantidade: item.quantidade })) };
    try {
      await api.post('/vendas', payload);
      Alert.alert('Venda Realizada', 'Registrada com sucesso!');
      resetSaleForm();
      loadProdutos();
      loadCaixaAtivo();
    } catch (error: any) {
      const isNetworkError = !error.response || error.message.includes('Network Error') || error.code === 'ECONNABORTED';
      if (isNetworkError) {
        const local: PendingSale = { ...payload, _localDetails: { clienteNome: clienteNome.trim() || 'Cliente Avulso', valorTotal: getCartTotal(), dataHora: new Date().toISOString(), itensList: cart.map(item => `${item.quantidade}x ${item.nome}`) } };
        await savePendingSales([...pendingSales, local]);
        Alert.alert('Venda Salva Offline', 'Será sincronizada quando a conexão voltar.');
        resetSaleForm();
      } else {
        Alert.alert('Falha no Registro', error.response?.data?.message || 'Erro ao processar a venda.');
      }
    } finally { setIsSubmitting(false); }
  };

  const resetSaleForm = () => { setCart([]); setClienteNome(''); setClienteTelefone(''); setObservacao(''); setFormaPagamento('PIX'); };

  // Utils
  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return 'Data inválida';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch (e) {
      return 'Data inválida';
    }
  };


  // Renders
  const renderProdutoCard = ({ item }: { item: Produto }) => {
    const isOutOfStock = item.estoque <= 0;
    return (
      <View className="bg-white rounded-2xl p-4 mb-2.5 border border-adorne-gold/15 shadow-xs">
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-2">
            <Text className="text-xs font-bold text-adorne-text">{item.nome}</Text>
            <View className="flex-row items-center mt-0.5">
              <Tag size={10} color="#C5A880" />
              <Text className="text-[10px] text-adorne-gray ml-1">{item.categoria}</Text>
            </View>
            <Text className="text-[11px] font-bold text-adorne-teal mt-1">{formatCurrency(item.preco)}</Text>
          </View>
          <View className="items-end">
            <Text className={`text-[10px] font-bold mb-2 ${isOutOfStock ? 'text-red-500' : 'text-adorne-gray'}`}>
              {isOutOfStock ? 'Sem estoque' : `${item.estoque} un.`}
            </Text>
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => openEditProduto(item)} className="w-7 h-7 rounded-lg bg-adorne-background border border-adorne-gold/20 items-center justify-center mr-1.5">
                <Edit3 size={12} color="#0B3A34" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteProduto(item)} className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 items-center justify-center mr-1.5">
                <Trash2 size={12} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => addToCart(item)}
                disabled={isOutOfStock}
                className={`px-3 py-1.5 rounded-lg flex-row items-center ${isOutOfStock ? 'bg-adorne-gray/20' : 'bg-adorne-teal active:opacity-90'}`}
              >
                <Plus size={12} color="#ffffff" />
                <Text className="text-white text-[10px] font-bold ml-1">Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderHistoricoCard = ({ item }: { item: any }) => {
    const isOffline = item._isOffline;
    return (
      <View className={`bg-white rounded-2xl p-4 mb-2.5 border shadow-xs ${isOffline ? 'border-amber-200 bg-amber-50/20' : 'border-adorne-gold/15'}`}>
        <View className="flex-row justify-between items-start mb-2 pb-2 border-b border-adorne-background">
          <View>
            <View className="flex-row items-center">
              <Clock size={10} color="#607371" />
              <Text className="text-[9px] text-adorne-gray font-semibold ml-1">{isOffline ? formatDate(item._localDetails.dataHora) : formatDate(item.createdAt)}</Text>
            </View>
            <Text className="text-xs font-extrabold text-adorne-text mt-1">{isOffline ? item._localDetails.clienteNome : (item.cliente?.nome || 'Cliente Avulso')}</Text>
          </View>
          {isOffline && (
            <View className="bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              <Text className="text-amber-800 text-[8px] font-extrabold uppercase">Offline</Text>
            </View>
          )}
        </View>
        <View className="mb-2">
          {isOffline
            ? item._localDetails.itensList.map((str: string, idx: number) => <Text key={idx} className="text-[10px] text-adorne-gray italic">• {str}</Text>)
            : item.itens?.map((it: any, idx: number) => <Text key={idx} className="text-[10px] text-adorne-gray">• {it.quantidade}x {it.produto?.nome || 'Peça Excluída'}</Text>)
          }
        </View>
        <View className="flex-row justify-between items-center pt-2 border-t border-adorne-background">
          <Text className="text-[9px] text-adorne-gray font-bold uppercase tracking-wider">{item.formaPagamento}</Text>
          <Text className="text-sm font-black text-emerald-600">{formatCurrency(isOffline ? item._localDetails.valorTotal : item.valorTotal)}</Text>
        </View>
      </View>
    );
  };


  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-adorne-background">

      {/* Header */}
      <View className="bg-white px-6 pt-12 pb-4 shadow-sm border-b border-adorne-gold/10 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => setActiveTab('perfil')} className="flex-row items-center active:opacity-75">
          <View className="w-9 h-9 rounded-full border border-adorne-gold items-center justify-center bg-adorne-background mr-2.5">
            <Gem size={16} color="#0B3A34" />
          </View>
          <View>
            <Text className="text-xs text-adorne-gray font-semibold">Semijoias Adorne</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text className="text-sm font-bold text-adorne-teal">{user?.nome}</Text>
              <Text className="text-[10px] font-normal text-adorne-gray ml-1.5">({isDona ? 'Dona' : 'Funcionária'})</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => setActiveTab('perfil')} className="w-9 h-9 rounded-xl border border-adorne-gold/20 items-center justify-center bg-adorne-background/60 mr-2 active:opacity-75">
            <User size={16} color="#0B3A34" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLogoutConfirm(true)} className="w-9 h-9 rounded-xl border border-red-100 items-center justify-center bg-red-50/40 active:opacity-75">
            <LogOut size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner offline / sync */}
      {pendingSales.length > 0 && (
        <View className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-3">
            <AlertTriangle size={18} color="#D97706" />
            <Text className="text-xs text-amber-800 font-semibold flex-1 ml-2">{pendingSales.length} venda(s) offline pendentes.</Text>
          </View>
          <TouchableOpacity onPress={syncPendingSales} disabled={isSyncing} className="bg-amber-600 px-3 py-1.5 rounded-lg flex-row items-center">
            {isSyncing ? <ActivityIndicator size="small" color="#ffffff" /> : <RefreshCw size={12} color="#ffffff" />}
            <Text className="text-white text-[10px] font-bold ml-1">Sincronizar</Text>
          </TouchableOpacity>
        </View>
      )}


      {/* ===== ABA NOVA VENDA ===== */}
      {activeTab === 'venda' && (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="p-6">
            <Text className="text-base font-bold text-adorne-teal mb-3">🛒 Carrinho de Compras</Text>

            {cart.length === 0 ? (
              <View className="bg-white border border-dashed border-adorne-gold/30 rounded-3xl p-8 items-center justify-center mb-5">
                <ShoppingCart size={32} color="#C5A880" />
                <Text className="text-adorne-gray text-xs font-semibold text-center mt-2 mb-1">Seu carrinho está vazio</Text>
                <Text className="text-[10px] text-adorne-gray/70 text-center">Adicione peças no catálogo e finalize o registro por aqui.</Text>
              </View>
            ) : (
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-4 shadow-sm mb-4">
                {cart.map(item => (
                  <View key={item.id} className="flex-row items-center justify-between py-2 border-b border-adorne-background last:border-b-0">
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-bold text-adorne-text">{item.nome}</Text>
                      <Text className="text-[10px] text-adorne-gray font-semibold mt-0.5">{formatCurrency(item.preco)} cada</Text>
                    </View>
                    <View className="flex-row items-center">
                      <TouchableOpacity onPress={() => decreaseQuantity(item.id)} className="w-6 h-6 rounded bg-adorne-background items-center justify-center">
                        <Minus size={12} color="#0B3A34" />
                      </TouchableOpacity>
                      <Text className="mx-2 text-xs font-bold text-adorne-teal">{item.quantidade}</Text>
                      <TouchableOpacity onPress={() => addToCart(item)} className="w-6 h-6 rounded bg-adorne-background items-center justify-center">
                        <Plus size={12} color="#0B3A34" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeFromCart(item.id)} className="ml-3 p-1">
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View className="flex-row justify-between items-center pt-3 mt-2 border-t border-adorne-background">
                  <Text className="text-xs font-bold text-adorne-gray uppercase">Total</Text>
                  <Text className="text-lg font-black text-adorne-teal">{formatCurrency(getCartTotal())}</Text>
                </View>
              </View>
            )}

            {/* Área preenchida — Destaques do Estoque */}
            {cart.length === 0 && produtos.length > 0 && (
              <View>
                {/* Atalhos rápidos */}
                <View className="flex-row justify-between mb-4">
                  <TouchableOpacity onPress={() => setActiveTab('produtos')} className="flex-1 bg-white border border-adorne-gold/15 rounded-2xl p-4 items-center justify-center mr-2 shadow-xs active:opacity-85">
                    <Package size={22} color="#0B3A34" />
                    <Text className="text-[10px] font-bold text-adorne-teal mt-1.5">Ver Catálogo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveTab('historico')} className="flex-1 bg-white border border-adorne-gold/15 rounded-2xl p-4 items-center justify-center mx-1 shadow-xs active:opacity-85">
                    <History size={22} color="#0B3A34" />
                    <Text className="text-[10px] font-bold text-adorne-teal mt-1.5">Histórico</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveTab('caixa')} className="flex-1 bg-white border border-adorne-gold/15 rounded-2xl p-4 items-center justify-center ml-2 shadow-xs active:opacity-85">
                    {caixaAtivo ? <Unlock size={22} color="#059669" /> : <Lock size={22} color="#DC2626" />}
                    <Text className={`text-[10px] font-bold mt-1.5 ${caixaAtivo ? 'text-emerald-600' : 'text-red-600'}`}>
                      {caixaAtivo ? 'Caixa Aberto' : 'Abrir Caixa'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Produtos em destaque — os com mais estoque */}
                <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-3 flex-row items-center">
                  ✨ Adicionar rapidamente
                </Text>
                {produtos
                  .filter(p => p.estoque > 0)
                  .sort((a, b) => b.estoque - a.estoque)
                  .slice(0, 4)
                  .map(item => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => addToCart(item)}
                      className="bg-white rounded-2xl p-3.5 mb-2 border border-adorne-gold/15 shadow-xs flex-row justify-between items-center active:opacity-85"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-adorne-text">{item.nome}</Text>
                        <View className="flex-row items-center mt-0.5">
                          <Tag size={9} color="#C5A880" />
                          <Text className="text-[9px] text-adorne-gray ml-1">{item.categoria}</Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs font-bold text-adorne-teal">{formatCurrency(item.preco)}</Text>
                        <Text className="text-[9px] text-adorne-gray mt-0.5">{item.estoque} un.</Text>
                      </View>
                      <View className="ml-3 w-7 h-7 rounded-lg bg-adorne-teal items-center justify-center">
                        <Plus size={14} color="#ffffff" />
                      </View>
                    </TouchableOpacity>
                  ))
                }
                <TouchableOpacity onPress={() => setActiveTab('produtos')} className="flex-row items-center justify-center mt-2 py-2">
                  <Text className="text-xs text-adorne-teal font-bold mr-1">Ver todas as peças</Text>
                  <ChevronRight size={14} color="#0B3A34" />
                </TouchableOpacity>
              </View>
            )}

          </View>

          {/* Formulário de checkout */}
          {cart.length > 0 && (
            <View className="px-6">
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm">
                <Text className="text-sm font-bold text-adorne-teal mb-4 uppercase tracking-wider border-b border-adorne-background pb-2">Dados da Venda</Text>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Cliente (Opcional)</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
                  <User size={16} color="#607371" />
                  <TextInput value={clienteNome} onChangeText={setClienteNome} placeholder="Nome da Cliente" placeholderTextColor="#A0B0AE" className="flex-1 h-12 ml-2 text-adorne-text text-sm" />
                </View>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Telefone (Opcional)</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
                  <FileText size={16} color="#607371" />
                  <TextInput value={clienteTelefone} onChangeText={setClienteTelefone} placeholder="(DD) 99999-9999" placeholderTextColor="#A0B0AE" keyboardType="phone-pad" className="flex-1 h-12 ml-2 text-adorne-text text-sm" />
                </View>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-2 ml-1">Forma de Pagamento</Text>
                <View className="flex-row flex-wrap mb-4 justify-between">
                  {(['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'] as const).map(method => (
                    <TouchableOpacity key={method} onPress={() => setFormaPagamento(method)} className={`w-[48%] py-3 mb-2 rounded-xl border items-center justify-center ${formaPagamento === method ? 'bg-adorne-teal border-adorne-teal' : 'bg-white border-adorne-gold/20'}`}>
                      <Text className={`text-xs font-bold ${formaPagamento === method ? 'text-white' : 'text-adorne-gray'}`}>{method}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Observações</Text>
                <View className="bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 py-2 mb-6">
                  <TextInput value={observacao} onChangeText={setObservacao} placeholder="Notas..." placeholderTextColor="#A0B0AE" multiline numberOfLines={3} className="text-adorne-text text-sm h-16" style={{ textAlignVertical: 'top' }} />
                </View>
                <TouchableOpacity onPress={handleCheckout} disabled={isSubmitting} className="w-full bg-adorne-teal h-14 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90">
                  {isSubmitting ? <ActivityIndicator color="#ffffff" /> : (
                    <>
                      <Send size={16} color="#ffffff" />
                      <Text className="text-white font-bold text-base ml-2">Finalizar Venda · {formatCurrency(getCartTotal())}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}


      {/* ===== ABA ESTOQUE ===== */}
      {activeTab === 'produtos' && (
        <View className="flex-1 p-6">
          <View className="flex-row items-center mb-4">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Pesquisar peça ou categoria..."
              placeholderTextColor="#A0B0AE"
              className="bg-white border border-adorne-gold/20 rounded-2xl h-12 px-4 text-adorne-text text-sm shadow-sm flex-1"
            />
            <TouchableOpacity onPress={openCreateProduto} className="ml-3 w-12 h-12 rounded-2xl bg-adorne-teal items-center justify-center shadow-sm active:opacity-90">
              <Plus size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-grow-0">
            <View className="flex-row">
              {CATEGORIAS.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full mr-2 border ${selectedCategory === cat ? 'bg-adorne-teal border-adorne-teal' : 'bg-white border-adorne-gold/20'}`}>
                  <Text className={`text-xs font-bold ${selectedCategory === cat ? 'text-white' : 'text-adorne-gray'}`}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View className="bg-adorne-teal/5 border border-adorne-teal/15 rounded-2xl px-4 py-3 mb-4 flex-row items-center">
            <Edit3 size={14} color="#0B3A34" />
            <Text className="text-[10px] text-adorne-teal font-bold ml-2">Toque em ✏️ para editar ou 🗑️ para excluir uma peça. Toque em + para cadastrar nova.</Text>
          </View>

          {isLoadingProdutos ? (
            <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#0B3A34" /></View>
          ) : filteredProdutos.length === 0 ? (
            <View className="flex-1 justify-center items-center p-8 bg-white border border-adorne-gold/10 rounded-3xl shadow-sm">
              <Package size={40} color="#C5A880" />
              <Text className="text-adorne-gray text-xs text-center font-bold mt-2">Nenhum produto encontrado</Text>
              <TouchableOpacity onPress={openCreateProduto} className="mt-4 bg-adorne-teal px-5 py-2.5 rounded-xl"><Text className="text-white text-xs font-bold">Cadastrar Peça</Text></TouchableOpacity>
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


      {/* ===== ABA HISTÓRICO ===== */}
      {activeTab === 'historico' && (
        <View className="flex-1 p-6">
          <Text className="text-base font-bold text-adorne-teal mb-3">📜 Minhas Vendas</Text>
          {isLoadingHistorico ? (
            <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#0B3A34" /></View>
          ) : historico.length === 0 && pendingSales.length === 0 ? (
            <View className="flex-1 justify-center items-center p-8 bg-white border border-adorne-gold/10 rounded-3xl shadow-sm">
              <History size={40} color="#C5A880" />
              <Text className="text-adorne-gray text-xs text-center font-bold mt-2">Nenhuma venda encontrada</Text>
            </View>
          ) : (
            <FlatList
              data={[...pendingSales.map(s => ({ ...s, _isOffline: true, id: `offline-${s.uuid}` })), ...historico]}
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

      {/* ===== ABA CAIXA ===== */}
      {activeTab === 'caixa' && (
        <View className="flex-1 p-6">
          {!isOnline ? (
            <View className="bg-red-50 border border-red-200 rounded-3xl p-6 items-center justify-center flex-1">
              <AlertTriangle size={48} color="#DC2626" />
              <Text className="text-red-800 text-sm font-bold text-center mt-3">Conexão Necessária</Text>
              <Text className="text-red-700 text-xs text-center mt-2">Operações de caixa exigem validação online.</Text>
              <TouchableOpacity onPress={loadCaixaAtivo} className="mt-6 bg-red-600 px-6 py-2.5 rounded-xl"><Text className="text-white text-xs font-bold">Tentar Reconectar</Text></TouchableOpacity>
            </View>
          ) : isLoadingCaixa ? (
            <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#0B3A34" /></View>
          ) : !caixaAtivo ? (
            <ScrollView className="flex-1" contentContainerStyle={{ justifyContent: 'center', paddingVertical: 12 }}>
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm">
                <View className="items-center mb-6">
                  <View className="bg-adorne-background w-12 h-12 rounded-full border border-adorne-gold items-center justify-center mb-3"><Lock size={20} color="#0B3A34" /></View>
                  <Text className="text-base font-bold text-adorne-teal">Caixa Fechado</Text>
                  <Text className="text-[10px] text-adorne-gray mt-1 text-center">Informe o fundo de troco para abrir o caixa do dia.</Text>
                </View>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Saldo Inicial (R$)</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-6">
                  <Text className="text-sm font-bold text-adorne-teal mr-1">R$</Text>
                  <TextInput value={saldoInicialAbertura} onChangeText={setSaldoInicialAbertura} placeholder="100,00" placeholderTextColor="#A0B0AE" keyboardType="numeric" className="flex-1 h-12 text-adorne-text font-bold text-sm" />
                </View>
                <TouchableOpacity onPress={handleAbrirCaixa} disabled={submittingCaixa} className="w-full bg-adorne-teal h-13 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90">
                  {submittingCaixa ? <ActivityIndicator color="#ffffff" /> : (<><Unlock size={16} color="#ffffff" /><Text className="text-white font-bold text-sm ml-2">Abrir Caixa do Dia</Text></>)}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
                <View className="flex-row justify-between items-center mb-4 border-b border-adorne-background pb-3">
                  <View className="flex-row items-center"><Unlock size={14} color="#059669" /><Text className="text-xs font-extrabold text-emerald-600 ml-1">CAIXA ABERTO</Text></View>
                  <Text className="text-[9px] text-adorne-gray font-bold">Início: {formatDate(caixaAtivo.dataAbertura)}</Text>
                </View>
                <View className="flex-row justify-between flex-wrap">
                  <View className="w-[48%] mb-3"><Text className="text-[8px] font-bold text-adorne-gray uppercase">Troco Inicial</Text><Text className="text-sm font-bold text-adorne-teal">{formatCurrency(caixaAtivo.saldoInicial)}</Text></View>
                  <View className="w-[48%] mb-3"><Text className="text-[8px] font-bold text-adorne-gray uppercase">Vendas Dinheiro</Text><Text className="text-sm font-bold text-emerald-600">+{formatCurrency(caixaAtivo.totalVendasDinheiro)}</Text></View>
                  <View className="w-[48%]"><Text className="text-[8px] font-bold text-adorne-gray uppercase">Suprimentos</Text><Text className="text-sm font-bold text-blue-600">+{formatCurrency(caixaAtivo.totalEntradas)}</Text></View>
                  <View className="w-[48%]"><Text className="text-[8px] font-bold text-adorne-gray uppercase">Sangrias</Text><Text className="text-sm font-bold text-red-500">-{formatCurrency(caixaAtivo.totalSaidas)}</Text></View>
                </View>
                <View className="bg-adorne-background rounded-xl p-3.5 mt-4 border border-adorne-gold/10">
                  <Text className="text-[9px] font-extrabold text-adorne-gray uppercase tracking-wider">Saldo Físico Esperado</Text>
                  <Text className="text-xl font-black text-adorne-teal mt-0.5">{formatCurrency(caixaAtivo.saldoFinalEsperado)}</Text>
                </View>
                {caixaAtivo.vendasOutrosMeios.length > 0 && (
                  <View className="mt-4 border-t border-adorne-background pt-3">
                    <Text className="text-[8px] font-bold text-adorne-gray uppercase mb-2">Pix / Cartões</Text>
                    {caixaAtivo.vendasOutrosMeios.map((m, idx) => (
                      <View key={idx} className="flex-row justify-between py-0.5">
                        <Text className="text-[10px] text-adorne-gray font-bold">{m.formaPagamento}</Text>
                        <Text className="text-[10px] text-adorne-teal font-extrabold">{formatCurrency(m.valorTotal)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
                <Text className="text-xs font-bold text-adorne-teal uppercase mb-3">Movimentar Dinheiro</Text>
                <View className="flex-row justify-between mb-3">
                  <TouchableOpacity onPress={() => setTipoMovimentacao('ENTRADA')} className={`flex-1 py-2 rounded-xl border items-center mr-1 ${tipoMovimentacao === 'ENTRADA' ? 'bg-blue-50 border-blue-500' : 'border-adorne-gold/15 bg-white'}`}>
                    <Text className={`text-xs font-bold ${tipoMovimentacao === 'ENTRADA' ? 'text-blue-700' : 'text-adorne-gray'}`}>Suprimento</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setTipoMovimentacao('SAIDA')} className={`flex-1 py-2 rounded-xl border items-center ml-1 ${tipoMovimentacao === 'SAIDA' ? 'bg-red-50 border-red-500' : 'border-adorne-gold/15 bg-white'}`}>
                    <Text className={`text-xs font-bold ${tipoMovimentacao === 'SAIDA' ? 'text-red-700' : 'text-adorne-gray'}`}>Sangria</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row mb-3">
                  <TextInput value={valorMovimentacao} onChangeText={setValorMovimentacao} placeholder="R$ 0,00" placeholderTextColor="#A0B0AE" keyboardType="numeric" className="bg-adorne-background border border-adorne-gold/15 rounded-xl h-11 px-3 w-[30%] text-adorne-text font-bold text-xs mr-2" />
                  <TextInput value={descricaoMovimentacao} onChangeText={setDescricaoMovimentacao} placeholder="Motivo..." placeholderTextColor="#A0B0AE" className="bg-adorne-background border border-adorne-gold/15 rounded-xl h-11 px-3 flex-1 text-adorne-text text-xs" />
                </View>
                <TouchableOpacity onPress={handleRegistrarMovimentacao} disabled={submittingCaixa} className="w-full bg-adorne-teal h-11 rounded-xl items-center justify-center active:opacity-90">
                  <Text className="text-white text-xs font-bold">Registrar Lançamento</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
                <Text className="text-xs font-bold text-red-600 uppercase mb-3">🔒 Fechar Caixa</Text>
                <Text className="text-[9px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Dinheiro Contado na Gaveta</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-3">
                  <Text className="text-xs font-bold text-adorne-teal mr-1">R$</Text>
                  <TextInput value={saldoFinalRealFechamento} onChangeText={setSaldoFinalRealFechamento} placeholder="Contagem física..." placeholderTextColor="#A0B0AE" keyboardType="numeric" className="flex-1 h-11 text-adorne-text font-bold text-xs" />
                </View>
                <TextInput value={observacaoFechamento} onChangeText={setObservacaoFechamento} placeholder="Notas opcionais..." placeholderTextColor="#A0B0AE" className="bg-adorne-background border border-adorne-gold/15 rounded-xl h-11 px-3 text-adorne-text text-xs mb-4" />
                <TouchableOpacity onPress={handleFecharCaixa} disabled={submittingCaixa} className="w-full bg-red-600 h-11 rounded-xl items-center justify-center active:opacity-90">
                  <Text className="text-white text-xs font-bold">Fechar e Conciliar Caixa</Text>
                </TouchableOpacity>
              </View>
              <View>
                <Text className="text-xs font-bold text-adorne-teal uppercase mb-3 ml-1">Extrato do Caixa</Text>
                {caixaAtivo.movimentacoes.length === 0 ? (
                  <View className="bg-white rounded-2xl p-6 items-center justify-center border border-adorne-gold/10">
                    <Text className="text-adorne-gray text-xs italic">Nenhuma movimentação neste turno</Text>
                  </View>
                ) : caixaAtivo.movimentacoes.map(mov => (
                  <View key={mov.id} className="bg-white rounded-2xl p-3 mb-2 border border-adorne-gold/15 flex-row justify-between items-center shadow-xs">
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-bold text-adorne-text">{mov.descricao}</Text>
                      <Text className="text-[9px] text-adorne-gray mt-0.5">{formatDate(mov.createdAt)}</Text>
                    </View>
                    <View className="items-end">
                      <Text className={`text-xs font-extrabold ${mov.tipo === 'ENTRADA' ? 'text-blue-600' : 'text-red-500'}`}>{mov.tipo === 'ENTRADA' ? '+' : '-'}{formatCurrency(mov.valor)}</Text>
                      <Text className="text-[8px] text-adorne-gray font-bold uppercase mt-0.5">{mov.tipo === 'ENTRADA' ? 'Suprimento' : 'Sangria'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}


      {/* ===== ABA PERFIL ===== */}
      {activeTab === 'perfil' && (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="p-6">

            {/* Avatar e nome */}
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-adorne-teal border-4 border-adorne-gold/30 items-center justify-center mb-3 shadow-lg">
                <Text className="text-3xl font-black text-white">{user?.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
              <Text className="text-xl font-black text-adorne-teal">{user?.nome}</Text>
              <View className={`mt-1.5 px-4 py-1 rounded-full ${isDona ? 'bg-adorne-teal/10 border border-adorne-teal/20' : 'bg-adorne-gold/15 border border-adorne-gold/30'}`}>
                <Text className={`text-[11px] font-extrabold uppercase tracking-wider ${isDona ? 'text-adorne-teal' : 'text-adorne-gold'}`}>
                  {isDona ? '👑 Proprietária' : '💎 Funcionária'}
                </Text>
              </View>
            </View>

            {/* Dados do perfil */}
            <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
              <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-4 pb-2 border-b border-adorne-background">Informações do Perfil</Text>

              <View className="flex-row items-center py-3 border-b border-adorne-background">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3">
                  <User size={16} color="#0B3A34" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Nome Completo</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">{user?.nome || '—'}</Text>
                </View>
              </View>

              <View className="flex-row items-center py-3 border-b border-adorne-background">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3">
                  <Mail size={16} color="#0B3A34" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">E-mail</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">{user?.email || '—'}</Text>
                </View>
              </View>

              <View className="flex-row items-center py-3 border-b border-adorne-background">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3">
                  <Building2 size={16} color="#0B3A34" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Loja</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">Semijoias Adorne</Text>
                </View>
              </View>

              <View className="flex-row items-center py-3">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3">
                  <Hash size={16} color="#0B3A34" />
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Cargo</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">{isDona ? 'Proprietária / Dona' : 'Funcionária'}</Text>
                </View>
              </View>
            </View>

            {/* Status do sistema */}
            <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
              <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-4 pb-2 border-b border-adorne-background">Status do Sistema</Text>

              <View className="flex-row items-center justify-between py-2.5 border-b border-adorne-background">
                <Text className="text-xs text-adorne-gray font-semibold">Conexão</Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <Text className={`text-xs font-bold ${isOnline ? 'text-emerald-600' : 'text-red-600'}`}>{isOnline ? 'Online' : 'Offline'}</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between py-2.5 border-b border-adorne-background">
                <Text className="text-xs text-adorne-gray font-semibold">Caixa do Dia</Text>
                <View className="flex-row items-center">
                  {caixaAtivo ? <Unlock size={12} color="#059669" /> : <Lock size={12} color="#DC2626" />}
                  <Text className={`text-xs font-bold ml-1 ${caixaAtivo ? 'text-emerald-600' : 'text-red-600'}`}>{caixaAtivo ? 'Aberto' : 'Fechado'}</Text>
                </View>
              </View>

              <View className="flex-row items-center justify-between py-2.5">
                <Text className="text-xs text-adorne-gray font-semibold">Vendas Offline Pendentes</Text>
                <View className={`px-2.5 py-0.5 rounded-full ${pendingSales.length > 0 ? 'bg-amber-100' : 'bg-emerald-50'}`}>
                  <Text className={`text-xs font-bold ${pendingSales.length > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>{pendingSales.length}</Text>
                </View>
              </View>
            </View>

            {/* Acoes rapidas */}
            {pendingSales.length > 0 && (
              <TouchableOpacity onPress={syncPendingSales} disabled={isSyncing} className="bg-amber-500 rounded-2xl p-4 mb-3 flex-row items-center justify-center shadow-sm active:opacity-90">
                {isSyncing ? <ActivityIndicator color="#ffffff" /> : <RefreshCw size={16} color="#ffffff" />}
                <Text className="text-white font-bold text-sm ml-2">Sincronizar Vendas Offline</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setShowLogoutConfirm(true)}
              className="bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-center justify-center active:opacity-90"
            >
              <LogOut size={16} color="#EF4444" />
              <Text className="text-red-600 font-bold text-sm ml-2">Encerrar Sessão</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      )}


      {/* ===== BOTTOM NAV ===== */}
      <View className="bg-white border-t border-adorne-gold/15 py-3.5 px-4 flex-row justify-around items-center shadow-lg">
        {[
          { key: 'venda', icon: ShoppingCart, label: 'Nova Venda' },
          { key: 'produtos', icon: Package, label: 'Estoque' },
          { key: 'caixa', icon: caixaAtivo ? Unlock : Lock, label: 'Caixa' },
          { key: 'historico', icon: History, label: 'Histórico' },
          { key: 'perfil', icon: User, label: 'Perfil' },
        ].map(({ key, icon: Icon, label }) => (
          <TouchableOpacity key={key} onPress={() => setActiveTab(key as any)} className="items-center flex-1">
            <View className={`w-10 h-7 rounded-full items-center justify-center mb-0.5 ${activeTab === key ? 'bg-adorne-teal/10' : ''}`}>
              <Icon
                size={18}
                color={activeTab === key ? '#0B3A34' : key === 'caixa' && caixaAtivo ? '#059669' : '#607371'}
              />
            </View>
            <Text className={`text-[9px] font-bold ${activeTab === key ? 'text-adorne-teal' : 'text-adorne-gray'}`}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== MODAL PRODUTO (Criar/Editar) ===== */}
      <Modal visible={isProdutoModalVisible} animationType="slide" transparent onRequestClose={() => setIsProdutoModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Platform.OS === 'ios' ? 34 : 24 }}>
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-base font-bold text-adorne-teal">{editingProduto ? '✏️ Editar Peça' : '➕ Nova Peça'}</Text>
              <TouchableOpacity onPress={() => setIsProdutoModalVisible(false)} className="w-8 h-8 rounded-full bg-adorne-background items-center justify-center">
                <X size={16} color="#607371" />
              </TouchableOpacity>
            </View>

            <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Nome da Peça *</Text>
            <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
              <Gem size={16} color="#C5A880" />
              <TextInput value={formNome} onChangeText={setFormNome} placeholder="Ex: Anel Riviera Zircônia" placeholderTextColor="#A0B0AE" className="flex-1 h-12 ml-2 text-adorne-text text-sm" />
            </View>

            <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-2 ml-1">Categoria *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-grow-0">
              <View className="flex-row">
                {['Brincos', 'Colares', 'Anéis', 'Pulseiras', 'Outros'].map(cat => (
                  <TouchableOpacity key={cat} onPress={() => setFormCategoria(cat)} className={`px-4 py-2 rounded-full mr-2 border ${formCategoria === cat ? 'bg-adorne-teal border-adorne-teal' : 'bg-white border-adorne-gold/20'}`}>
                    <Text className={`text-xs font-bold ${formCategoria === cat ? 'text-white' : 'text-adorne-gray'}`}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Preço (R$) *</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3">
                  <DollarSign size={14} color="#607371" />
                  <TextInput value={formPreco} onChangeText={setFormPreco} placeholder="65,00" placeholderTextColor="#A0B0AE" keyboardType="numeric" className="flex-1 h-11 ml-1 text-adorne-text font-bold text-sm" />
                </View>
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Estoque (un.) *</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3">
                  <Hash size={14} color="#607371" />
                  <TextInput value={formEstoque} onChangeText={setFormEstoque} placeholder="20" placeholderTextColor="#A0B0AE" keyboardType="numeric" className="flex-1 h-11 ml-1 text-adorne-text font-bold text-sm" />
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={handleSaveProduto} disabled={isSavingProduto} className="w-full bg-adorne-teal h-13 rounded-2xl items-center justify-center flex-row shadow-sm active:opacity-90">
              {isSavingProduto ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <Check size={16} color="#ffffff" />
                  <Text className="text-white font-bold text-sm ml-2">{editingProduto ? 'Salvar Alterações' : 'Cadastrar Peça'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de Logout */}
      <Modal visible={showLogoutConfirm} animationType="fade" transparent onRequestClose={() => setShowLogoutConfirm(false)}>
        <View className="flex-1 justify-center items-center bg-black/60 px-8">
          <View className="bg-white w-full rounded-3xl p-6 border border-adorne-gold/15 shadow-2xl">
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-50 border border-red-100 items-center justify-center mb-3">
                <LogOut size={22} color="#EF4444" />
              </View>
              <Text className="text-base font-bold text-adorne-text">Encerrar sessão?</Text>
              <Text className="text-xs text-adorne-gray text-center mt-1">
                Você será desconectada e precisará fazer login novamente.
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => { setShowLogoutConfirm(false); await logout(); }}
              className="w-full bg-red-600 h-12 rounded-xl items-center justify-center mb-2 active:opacity-90"
            >
              <Text className="text-white font-bold text-sm">Sair</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowLogoutConfirm(false)}
              className="w-full h-12 rounded-xl items-center justify-center border border-adorne-gold/20 bg-adorne-background active:opacity-90"
            >
              <Text className="text-adorne-gray font-bold text-sm">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}
