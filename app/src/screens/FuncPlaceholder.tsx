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
  AlertTriangle 
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

export default function FuncPlaceholder() {
  const { user, logout } = useAuth();
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState<'venda' | 'produtos' | 'historico'>('venda');

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

  // Carrega produtos e histórico ao inicializar e trocar de aba
  useEffect(() => {
    loadProdutos();
    loadPendingSales();
    if (activeTab === 'historico') {
      loadHistorico();
    }
  }, [activeTab]);

  // Aplica filtros de pesquisa e categoria no catálogo
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
    } catch (error) {
      console.log('Erro ao carregar produtos:', error);
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
    } catch (error) {
      console.log('Erro ao carregar histórico:', error);
    } finally {
      setIsLoadingHistorico(false);
    }
  };

  // Carrega a fila offline de vendas pendentes do SecureStore
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

  // Salva a fila offline de vendas pendentes no SecureStore
  const savePendingSales = async (sales: PendingSale[]) => {
    try {
      await SecureStore.setItemAsync('pendingSales', JSON.stringify(sales));
      setPendingSales(sales);
    } catch (error) {
      console.log('Erro ao salvar fila offline:', error);
    }
  };

  // Sincroniza a fila de vendas offline com o backend
  const syncPendingSales = async () => {
    if (pendingSales.length === 0 || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;
    const remainingSales = [...pendingSales];

    for (let i = 0; i < pendingSales.length; i++) {
      const sale = pendingSales[i];
      try {
        // Envia para o backend. Se retornar duplicado por UUID, o service trata de forma idempotente
        await api.post('/vendas', {
          uuid: sale.uuid,
          formaPagamento: sale.formaPagamento,
          clienteNome: sale.clienteNome,
          clienteTelefone: sale.clienteTelefone,
          observacao: sale.observacao,
          itens: sale.itens
        });
        
        // Remove da lista se der certo
        successCount++;
        const index = remainingSales.findIndex(s => s.uuid === sale.uuid);
        if (index > -1) remainingSales.splice(index, 1);
      } catch (error: any) {
        console.log(`Erro ao sincronizar venda offline (${sale.uuid}):`, error);
        
        // Se for erro de validação/regra de negócio (status 400/404), remove para evitar travar a fila
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          const apiMsg = error.response.data?.message || 'Dados inválidos';
          Alert.alert(
            'Sincronização Rejeitada',
            `A venda para "${sale._localDetails.clienteNome}" foi descartada pela API: ${apiMsg}`
          );
          const index = remainingSales.findIndex(s => s.uuid === sale.uuid);
          if (index > -1) remainingSales.splice(index, 1);
        } else {
          // Erros de rede (5xx, timeout): interrompe sincronização dos próximos para tentar mais tarde
          Alert.alert('Erro de Rede', 'Não foi possível conectar ao servidor para sincronizar todas as vendas.');
          break;
        }
      }
    }

    await savePendingSales(remainingSales);
    setIsSyncing(false);

    if (successCount > 0) {
      Alert.alert('Sincronização Concluída', `${successCount} venda(s) foram enviadas com sucesso para o banco de dados.`);
      loadProdutos(); // Recarrega estoque atualizado
      if (activeTab === 'historico') {
        loadHistorico();
      }
    }
  };

  // Adiciona um produto ao carrinho
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

  // Decrementa a quantidade de um item no carrinho
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

  // Remove um item do carrinho
  const removeFromCart = (productId: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  // Calcula o valor total do carrinho
  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  };

  // Executa a finalização da venda (online com fallback offline)
  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Carrinho Vazio', 'Adicione pelo menos um produto para continuar.');
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
      // Tenta enviar para a API (Online)
      await api.post('/vendas', payload);
      
      Alert.alert('Venda Realizada', 'A venda foi registrada com sucesso no sistema!');
      resetSaleForm();
      loadProdutos(); // Atualiza catálogo de estoque
    } catch (error: any) {
      console.log('Erro ao enviar venda online:', error);

      // Se for erro do servidor (falha de rede / timeout), salva offline
      const isNetworkError = !error.response || error.message.includes('Network Error') || error.code === 'ECONNABORTED';

      if (isNetworkError) {
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
          'Sinal de rede indisponível. A venda foi guardada na fila local e será enviada quando restabelecer a conexão.'
        );
        resetSaleForm();
      } else {
        // Se for erro de validação (estoque insuficiente na API, etc), exibe a mensagem
        const apiMsg = error.response?.data?.message || 'Ocorreu um erro ao processar a venda.';
        Alert.alert('Falha no Registro', apiMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Limpa o formulário e carrinho após finalização
  const resetSaleForm = () => {
    setCart([]);
    setClienteNome('');
    setClienteTelefone('');
    setObservacao('');
    setFormaPagamento('PIX');
  };

  // Formata moeda para padrão brasileiro
  const formatCurrency = (val: number) => {
    return `R$ ${val.toFixed(2).replace('.', ',')}`;
  };

  // Formata data e hora ISO para exibição legível
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString('pt-BR');
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} às ${timeStr}`;
  };

  // Renderização de cada produto no catálogo
  const renderProdutoCard = ({ item }: { item: Produto }) => {
    const cartItem = cart.find(i => i.id === item.id);
    const hasStock = item.estoque > 0;

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-adorne-gold/10 shadow-sm flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center">
            <Text className="text-xs text-adorne-gold font-bold uppercase tracking-wider mr-2">{item.categoria}</Text>
            <View className={`px-2 py-0.5 rounded-full ${hasStock ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <Text className={`text-[9px] font-bold ${hasStock ? 'text-emerald-700' : 'text-red-600'}`}>
                {hasStock ? `${item.estoque} un` : 'Esgotado'}
              </Text>
            </View>
          </View>
          <Text className="text-sm font-bold text-adorne-text mt-1">{item.nome}</Text>
          <Text className="text-base font-extrabold text-adorne-teal mt-1">{formatCurrency(item.preco)}</Text>
        </View>
        
        {/* Controle de quantidade rápida */}
        {hasStock ? (
          cartItem ? (
            <View className="flex-row items-center bg-adorne-background rounded-xl border border-adorne-gold/20 p-1">
              <TouchableOpacity 
                onPress={() => cartItem.quantidade === 1 ? removeFromCart(item.id) : decreaseQuantity(item.id)}
                className="w-8 h-8 rounded-lg bg-white items-center justify-center shadow-sm"
              >
                {cartItem.quantidade === 1 ? (
                  <Trash2 size={14} color="#EF4444" />
                ) : (
                  <Minus size={14} color="#0B3A34" />
                )}
              </TouchableOpacity>
              <Text className="mx-3 text-sm font-bold text-adorne-teal">{cartItem.quantidade}</Text>
              <TouchableOpacity 
                onPress={() => addToCart(item)}
                className="w-8 h-8 rounded-lg bg-white items-center justify-center shadow-sm"
              >
                <Plus size={14} color="#0B3A34" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={() => addToCart(item)}
              className="bg-adorne-teal px-4 py-2.5 rounded-xl flex-row items-center"
            >
              <Plus size={14} color="#ffffff" className="mr-1" />
              <Text className="text-white text-xs font-bold">Adicionar</Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>
    );
  };

  // Renderização de cada venda no histórico
  const renderHistoricoCard = ({ item }: { item: any }) => {
    const isOffline = item._isOffline;
    const dataVenda = isOffline ? item.dataHora : item.dataHora;
    const valor = isOffline ? item.valorTotal : item.valorTotal;
    const cNome = isOffline ? item.clienteNome : (item.cliente?.nome || 'Cliente Avulso');
    const fPag = isOffline ? item.formaPagamento : item.formaPagamento;
    const itensSummary = isOffline 
      ? item.itensList 
      : item.itens.map((it: any) => `${it.quantidade}x ${it.produto.nome}`);

    return (
      <View className={`bg-white rounded-2xl p-4 mb-3 border shadow-sm ${isOffline ? 'border-dashed border-adorne-gold bg-amber-50/20' : 'border-adorne-gold/10'}`}>
        <View className="flex-row justify-between items-start mb-2">
          <View>
            <Text className="text-xs text-adorne-gray">{formatDate(dataVenda)}</Text>
            <View className="flex-row items-center mt-1">
              <User size={12} color="#607371" className="mr-1" />
              <Text className="text-sm font-bold text-adorne-text">{cNome}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-sm font-extrabold text-adorne-teal">{formatCurrency(valor)}</Text>
            {isOffline ? (
              <View className="flex-row items-center bg-amber-100 px-2 py-0.5 rounded-full mt-1 border border-amber-200">
                <AlertTriangle size={10} color="#B45309" className="mr-1" />
                <Text className="text-[9px] font-bold text-amber-700">Offline</Text>
              </View>
            ) : (
              <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-100">
                <Check size={10} color="#047857" className="mr-1" />
                <Text className="text-[9px] font-bold text-emerald-700">Sincronizado</Text>
              </View>
            )}
          </View>
        </View>

        <View className="border-t border-adorne-gold/10 pt-2 mt-2">
          <Text className="text-[10px] font-bold text-adorne-gray uppercase tracking-wider mb-1">Itens Vendidos</Text>
          {itensSummary.map((sumText: string, idx: number) => (
            <Text key={idx} className="text-xs text-adorne-text font-medium mb-0.5">• {sumText}</Text>
          ))}
        </View>

        {!isOffline && item.observacao ? (
          <View className="mt-2 bg-adorne-background p-2 rounded-lg border border-adorne-gold/10">
            <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Notas</Text>
            <Text className="text-xs text-adorne-gray italic mt-0.5">{item.observacao}</Text>
          </View>
        ) : null}

        {isOffline && item.observacao ? (
          <View className="mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100">
            <Text className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Notas</Text>
            <Text className="text-xs text-amber-800 italic mt-0.5">{item.observacao}</Text>
          </View>
        ) : null}
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

      {/* Aba de Nova Venda */}
      {activeTab === 'venda' && (
        <View className="flex-1">
          {/* Corpo com split: formulários e carrinho */}
          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            
            {/* Lista dos Produtos Selecionados */}
            <View className="p-6">
              <Text className="text-base font-bold text-adorne-teal mb-3 flex-row items-center">
                🛒 Carrinho de Compras
              </Text>
              
              {cart.length === 0 ? (
                <View className="bg-white border border-dashed border-adorne-gold/30 rounded-3xl p-8 items-center justify-center">
                  <ShoppingCart size={32} color="#C5A880" className="opacity-60 mb-2" />
                  <Text className="text-adorne-gray text-xs font-semibold text-center mb-1">Seu carrinho está vazio</Text>
                  <Text className="text-[10px] text-adorne-gray/70 text-center">Navegue pelas peças no catálogo e adicione itens para iniciar a venda.</Text>
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
                  
                  {/* Totalizador */}
                  <View className="flex-row justify-between items-center pt-3 mt-2 border-t border-adorne-background">
                    <Text className="text-xs font-bold text-adorne-gray uppercase">Valor Total</Text>
                    <Text className="text-lg font-black text-adorne-teal">{formatCurrency(getCartTotal())}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Formulário CRM e Pagamento */}
            {cart.length > 0 && (
              <View className="px-6">
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm">
                  <Text className="text-sm font-bold text-adorne-teal mb-4 uppercase tracking-wider border-b border-adorne-background pb-2">
                    Dados Adicionais da Venda
                  </Text>

                  {/* Nome do Cliente */}
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

                  {/* Telefone do Cliente */}
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

                  {/* Forma de Pagamento */}
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
                        <Text
                          className={`text-xs font-bold ${
                            formaPagamento === method ? 'text-white' : 'text-adorne-gray'
                          }`}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Observação */}
                  <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Observações (Opcional)</Text>
                  <View className="bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 py-2 mb-6">
                    <TextInput
                      value={observacao}
                      onChangeText={setObservacao}
                      placeholder="Alguma nota sobre a venda..."
                      placeholderTextColor="#A0B0AE"
                      multiline
                      numberOfLines={3}
                      className="text-adorne-text text-sm h-16 text-start"
                      style={{ textAlignVertical: 'top' }}
                    />
                  </View>

                  {/* Botão Finalizar */}
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

      {/* Aba de Catálogo de Peças */}
      {activeTab === 'produtos' && (
        <View className="flex-1 p-6">
          {/* Caixa de Busca */}
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Pesquisar peça ou categoria..."
            placeholderTextColor="#A0B0AE"
            className="bg-white border border-adorne-gold/20 rounded-2xl h-12 px-4 mb-4 text-adorne-text text-sm shadow-sm"
          />

          {/* Filtros de Categorias */}
          <View className="mb-4">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {categorias.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full mr-2 border ${
                    selectedCategory === cat
                      ? 'bg-adorne-teal border-adorne-teal'
                      : 'bg-white border-adorne-gold/20'
                  }`}
                >
                  <Text className={`text-xs font-bold ${selectedCategory === cat ? 'text-white' : 'text-adorne-gray'}`}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Lista de Peças */}
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

      {/* Aba de Histórico de Vendas */}
      {activeTab === 'historico' && (
        <View className="flex-1 p-6">
          <Text className="text-base font-bold text-adorne-teal mb-3 flex-row items-center">
            📜 Minhas Vendas Registradas
          </Text>

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
              // Concatena vendas offline no topo marcando-as como locais
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

      {/* Barra de Navegação Floating Premium */}
      <View className="bg-white border-t border-adorne-gold/15 py-3.5 px-8 flex-row justify-around items-center shadow-lg">
        {/* Aba Nova Venda */}
        <TouchableOpacity 
          onPress={() => setActiveTab('venda')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'venda' ? 'bg-adorne-teal/10' : ''}`}>
            <ShoppingCart size={20} color={activeTab === 'venda' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[10px] font-bold ${activeTab === 'venda' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Nova Venda
          </Text>
        </TouchableOpacity>

        {/* Aba Catálogo */}
        <TouchableOpacity 
          onPress={() => setActiveTab('produtos')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'produtos' ? 'bg-adorne-teal/10' : ''}`}>
            <Package size={20} color={activeTab === 'produtos' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[10px] font-bold ${activeTab === 'produtos' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Estoque
          </Text>
        </TouchableOpacity>

        {/* Aba Histórico */}
        <TouchableOpacity 
          onPress={() => setActiveTab('historico')}
          className="items-center"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'historico' ? 'bg-adorne-teal/10' : ''}`}>
            <History size={20} color={activeTab === 'historico' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[10px] font-bold ${activeTab === 'historico' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Histórico
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
