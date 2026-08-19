import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Platform, 
  Alert,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as SecureStore from '../services/storage';
import { getSocket, disconnectSocket } from '../services/websocket';
import api from '../services/api';
import { 
  Gem, 
  LogOut, 
  Bell, 
  DollarSign, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  User, 
  ChevronRight,
  ChevronLeft,
  TrendingDown,
  Award,
  X,
  Calendar,
  Mail,
  Building2,
  Hash,
  Shield,
  Edit3,
  Trash2,
  Plus,
  Check,
  Tag,
  Package,
} from 'lucide-react-native';

// Interface para os itens do gráfico de faturamento
interface GraficoItem {
  label: string;
  valor: number;
}

// Dependências do Expo
let Notifications: any = null;
let Device: any = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log('Expo Notifications não disponível.');
  }
}

export default function DonaPlaceholder() {
  const { user, logout } = useAuth();
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relatorios' | 'perfil'>('dashboard');

  // Modal de confirmação de logout
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Controle de Período Selecionado
  const [periodo, setPeriodo] = useState<'hoje' | 'ontem' | '7dias'>('hoje');
  const periodoRef = useRef(periodo);

  // Sincroniza a ref do período com o estado para evitar stale closure no socket listener
  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  // Estados para as Modais de Detalhe e Gráfico
  const [allSales, setAllSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isSaleModalVisible, setIsSaleModalVisible] = useState(false);
  const [selectedChartBarLabel, setSelectedChartBarLabel] = useState<string | null>(null);
  const [isChartSalesModalVisible, setIsChartSalesModalVisible] = useState(false);

  // Estados dos KPIs Analíticos
  const [faturamento, setFaturamento] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [graficoData, setGraficoData] = useState<GraficoItem[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Estados do feed de vendas recentes
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Estados dos Relatórios Mensais
  const [reportData, setReportData] = useState<any>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportMes, setReportMes] = useState<number>(new Date().getMonth() + 1);
  const [reportAno, setReportAno] = useState<number>(new Date().getFullYear());

  // Referência do debounce timer
  const debounceTimerRef = useRef<any | null>(null);

  // Estados de Gestão de Produtos (Dona)
  interface Produto { id: number; nome: string; categoria: string; preco: number; estoque: number; }
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false);
  const [isProdutoModalVisible, setIsProdutoModalVisible] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formCategoria, setFormCategoria] = useState('Brincos');
  const [formPreco, setFormPreco] = useState('');
  const [formEstoque, setFormEstoque] = useState('');
  const [isSavingProduto, setIsSavingProduto] = useState(false);

  // Inicializa o WebSocket e os listeners ao montar
  useEffect(() => {
    let socketInstance: any = null;

    async function initRealTime() {
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) return;

      // Conexão via Handshake Auth Object (Seguro)
      socketInstance = getSocket(token);
      socketInstance.connect();

      socketInstance.on('connect', () => {
        setIsConnected(true);
        console.log('[Dona] WebSocket Conectado!');
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
        console.log('[Dona] WebSocket Desconectado!');
      });

      // Ouvinte de nova venda com debounce de 500ms e guard de período
      socketInstance.on('nova_venda', (novaVenda: any) => {
        console.log('[Dona] Nova venda recebida via socket:', novaVenda);
        
        // Notificação visual Toast discreta
        Alert.alert(
          'Venda Registrada! 💎',
          `Vendedora: ${novaVenda.usuario?.nome || 'Funcionária'}\nCliente: ${novaVenda.cliente?.nome || 'Cliente Avulso'}\nTotal: R$ ${novaVenda.valorTotal.toFixed(2).replace('.', ',')}`
        );

        // Se o período ativo for "hoje", agenda o re-fetch debounced
        if (periodoRef.current === 'hoje') {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            console.log('[Dona] Disparando re-fetch debounced...');
            loadDashboardData('hoje');
          }, 500);
        }
      });

      // Registro nativo de push
      if (Platform.OS !== 'web' && Notifications && Device) {
        registerForPush(token);
      }
    }

    initRealTime();

    return () => {
      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('nova_venda');
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      disconnectSocket();
    };
  }, []);

  // Recarrega o Dashboard sempre que o período mudar
  useEffect(() => {
    loadDashboardData(periodo);
  }, [periodo]);

  // Carrega todos os dados do dashboard unificados
  const loadDashboardData = async (selectedPeriod: 'hoje' | 'ontem' | '7dias') => {
    setIsLoadingDashboard(true);
    try {
      // 1. Busca resumo analítico no backend
      const resumoResponse = await api.get('/vendas/resumo', {
        params: { periodo: selectedPeriod }
      });
      const { faturamento: fat, totalVendas: tv, ticketMedio: tm, grafico } = resumoResponse.data;
      
      setFaturamento(fat);
      setTotalVendas(tv);
      setTicketMedio(tm);
      setGraficoData(grafico);

      // 2. Busca lista de histórico bruto para o feed recente
      const histResponse = await api.get('/vendas/historico');
      setRecentSales(histResponse.data.slice(0, 5)); // Exibe apenas as 5 mais recentes no dashboard
      setAllSales(histResponse.data); // Mantém todo o histórico para ações interativas
    } catch (err) {
      console.log('Erro ao carregar dados do dashboard:', err);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  // Recarrega o Relatório Mensal quando a aba ou mês/ano mudar
  useEffect(() => {
    if (activeTab === 'relatorios') {
      loadReportData();
    }
    if (activeTab === 'perfil') {
      loadProdutos();
    }
  }, [activeTab, reportMes, reportAno]);
  const loadReportData = async () => {
    setIsLoadingReport(true);
    try {
      const response = await api.get('/relatorios/mensal', {
        params: { mes: reportMes, ano: reportAno }
      });
      setReportData(response.data);
    } catch (err) {
      console.log('Erro ao carregar dados do relatório mensal:', err);
      Alert.alert('Erro', 'Não foi possível carregar os relatórios mensais.');
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handlePrevMonth = () => {
    setReportMes((prevMes) => {
      if (prevMes === 1) {
        setReportAno((prevAno) => prevAno - 1);
        return 12;
      }
      return prevMes - 1;
    });
  };

  const handleNextMonth = () => {
    setReportMes((prevMes) => {
      if (prevMes === 12) {
        setReportAno((prevAno) => prevAno + 1);
        return 1;
      }
      return prevMes + 1;
    });
  };

  const getNomeMes = (m: number) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[m - 1] || '';
  };

  // Registra as credenciais de Push Notification do dispositivo
  const registerForPush = async (authToken: string) => {
    try {
      if (!Device.isDevice) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await api.post('/perfil/push-token', { token });
      console.log('[Push] Token registrado com sucesso no backend!');
    } catch (error: any) {
      console.log('[Push] Erro ao registrar notificações:', error.message);
    }
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toFixed(2).replace('.', ',')}`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
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

  // ── Gestão de Produtos ──────────────────────────────────────────────────────

  const loadProdutos = async () => {
    setIsLoadingProdutos(true);
    try {
      const response = await api.get('/produtos');
      setProdutos(response.data);
    } catch (err) {
      console.log('Erro ao carregar produtos:', err);
    } finally {
      setIsLoadingProdutos(false);
    }
  };

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
    if (!nome || nome.length < 2) { Alert.alert('Campo obrigatório', 'Informe o nome da peça (mínimo 2 caracteres).'); return; }
    if (isNaN(preco) || preco <= 0) { Alert.alert('Preço inválido', 'Informe um preço maior que R$ 0,00.'); return; }
    if (isNaN(estoque) || estoque < 0) { Alert.alert('Estoque inválido', 'Informe um estoque válido (0 ou mais).'); return; }
    setIsSavingProduto(true);
    try {
      if (editingProduto) {
        await api.patch(`/produtos/${editingProduto.id}`, { nome, categoria: formCategoria, preco, estoque });
        Alert.alert('Sucesso', 'Peça atualizada!');
      } else {
        await api.post('/produtos', { nome, categoria: formCategoria, preco, estoque });
        Alert.alert('Sucesso', 'Peça cadastrada!');
      }
      setIsProdutoModalVisible(false);
      loadProdutos();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao salvar a peça.');
    } finally {
      setIsSavingProduto(false);
    }
  };

  const handleDeleteProduto = (produto: Produto) => {
    Alert.alert(
      'Excluir Peça',
      `Excluir "${produto.nome}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/produtos/${produto.id}`);
            loadProdutos();
          } catch (error: any) {
            Alert.alert('Erro', error.response?.data?.message || 'Erro ao excluir.');
          }
        }},
      ]
    );
  };

  // ────────────────────────────────────────────────────────────────────────────

  // Filtra as vendas pertencentes a uma barra do gráfico selecionada
  const getFilteredSalesForChart = () => {
    if (!selectedChartBarLabel) return [];
    
    return allSales.filter(venda => {
      const dateObj = new Date(venda.createdAt);
      
      if (periodo === '7dias') {
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
          }).formatToParts(dateObj);

          const day = parts.find(p => p.type === 'day')?.value || '00';
          const month = parts.find(p => p.type === 'month')?.value || '00';
          const label = `${day}/${month}`;
          return label === selectedChartBarLabel;
        } catch (e) {
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          return `${day}/${month}` === selectedChartBarLabel;
        }
      } else {
        try {
          const horaStr = dateObj.toLocaleTimeString('en-US', {
            timeZone: 'America/Sao_Paulo',
            hour12: false,
            hour: '2-digit',
          });
          const hora = parseInt(horaStr, 10);
          
          let targetBucket = '08:00';
          if (hora >= 22) targetBucket = '22:00';
          else if (hora >= 20) targetBucket = '20:00';
          else if (hora >= 18) targetBucket = '18:00';
          else if (hora >= 16) targetBucket = '16:00';
          else if (hora >= 14) targetBucket = '14:00';
          else if (hora >= 12) targetBucket = '12:00';
          else if (hora >= 10) targetBucket = '10:00';
          
          return targetBucket === selectedChartBarLabel;
        } catch (e) {
          const hora = dateObj.getHours();
          let targetBucket = '08:00';
          if (hora >= 22) targetBucket = '22:00';
          else if (hora >= 20) targetBucket = '20:00';
          else if (hora >= 18) targetBucket = '18:00';
          else if (hora >= 16) targetBucket = '16:00';
          else if (hora >= 14) targetBucket = '14:00';
          else if (hora >= 12) targetBucket = '12:00';
          else if (hora >= 10) targetBucket = '10:00';
          return targetBucket === selectedChartBarLabel;
        }
      }
    });
  };

  // Encontra o maior valor do gráfico para calibrar o faturamento proporcionalmente
  const maxGraficoValue = Math.max(...graficoData.map(item => item.valor), 1);

  return (
    <View className="flex-1 bg-adorne-background">
      {/* Header Premium */}
      <View className="bg-white px-6 pt-12 pb-4 shadow-sm border-b border-adorne-gold/10 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => setActiveTab('perfil')} className="flex-row items-center active:opacity-75">
          <View className="w-9 h-9 rounded-full border border-adorne-gold items-center justify-center bg-adorne-background mr-2.5">
            <Gem size={16} color="#0B3A34" />
          </View>
          <View>
            <Text className="text-xs text-adorne-gray font-semibold">Semijoias Adorne</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text className="text-sm font-bold text-adorne-teal">{user?.nome}</Text>
              <Text className="text-[10px] font-normal text-adorne-gray ml-1.5">(Dona)</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => setActiveTab('perfil')} className="w-9 h-9 rounded-xl border border-adorne-gold/20 items-center justify-center bg-adorne-background/60 mr-2 active:opacity-75">
            <User size={16} color="#0B3A34" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowLogoutConfirm(true)}
            className="w-9 h-9 rounded-xl border border-red-100 items-center justify-center bg-red-50/40 active:opacity-75"
          >
            <LogOut size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== ABA DASHBOARD ===== */}
      {activeTab === 'dashboard' && (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          
          {/* Painel de Status */}
          <View className="px-6 pt-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View 
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  marginRight: 8,
                  backgroundColor: isConnected ? '#10B981' : '#EF4444',
                }} 
              />
              <Text className="text-xs text-adorne-gray font-bold">
                {isConnected ? 'Canal de tempo real ativo' : 'Reconectando canal...'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => loadDashboardData(periodo)}
              className="p-1 rounded-lg border border-adorne-gold/20 bg-white"
            >
              <RefreshCwIcon size={12} color="#0B3A34" />
            </TouchableOpacity>
          </View>

          {/* Seletores de Período (Tabs Estilo Chip) */}
          <View className="px-6 pt-4 flex-row justify-between">
            {(['hoje', 'ontem', '7dias'] as const).map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriodo(p)}
                className={`px-6 py-2.5 rounded-full border flex-1 mx-1 items-center justify-center ${
                  periodo === p 
                    ? 'bg-adorne-teal border-adorne-teal shadow-sm' 
                    : 'bg-white border-adorne-gold/20'
                }`}
              >
                <Text className={`text-xs font-bold ${periodo === p ? 'text-white' : 'text-adorne-gray'}`}>
                  {p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : '7 Dias'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPIs Grid */}
          {isLoadingDashboard ? (
            <View className="py-24 justify-center items-center">
              <ActivityIndicator size="large" color="#0B3A34" />
            </View>
          ) : (
            <View className="p-6">
              
              {/* KPI Destaque: Faturamento Total */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="bg-emerald-50 w-10 h-10 rounded-xl items-center justify-center">
                    <DollarSign size={20} color="#059669" />
                  </View>
                  <View className="bg-adorne-background px-3 py-1 rounded-full border border-adorne-gold/10">
                    <Text className="text-[10px] text-adorne-teal font-extrabold uppercase">Faturamento</Text>
                  </View>
                </View>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase tracking-wider">Faturamento do Período</Text>
                <Text className="text-3xl font-black text-adorne-teal mt-1 tracking-tight">
                  {formatCurrency(faturamento)}
                </Text>
              </View>

              {/* Grid Secundária: Vendas e Ticket Médio */}
              <View className="flex-row justify-between">
                
                {/* Card Vendas */}
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 w-[48%] shadow-sm">
                  <View className="bg-blue-50 w-9 h-9 rounded-lg items-center justify-center mb-3">
                    <TrendingUp size={18} color="#2563EB" />
                  </View>
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Quantidade Vendas</Text>
                  <Text className="text-xl font-black text-adorne-teal mt-1">{totalVendas}</Text>
                </View>

                {/* Card Ticket Médio */}
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 w-[48%] shadow-sm">
                  <View className="bg-purple-50 w-9 h-9 rounded-lg items-center justify-center mb-3">
                    <Award size={18} color="#7C3AED" />
                  </View>
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Ticket Médio</Text>
                  <Text className="text-xl font-black text-adorne-teal mt-1 leading-none">
                    {formatCurrency(ticketMedio)}
                  </Text>
                </View>

              </View>

              {/* Gráfico de Barras Customizado Responsivo */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm mt-4">
                <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-4 border-b border-adorne-background pb-2">
                  📈 Curva de Desempenho ({periodo === '7dias' ? 'Dia a Dia' : 'Faixas Horárias'})
                </Text>
                
                {graficoData.length === 0 ? (
                  <View className="py-12 items-center justify-center">
                    <Text className="text-xs text-adorne-gray italic">Sem dados gráficos para exibir</Text>
                  </View>
                ) : (
                  <View className="h-44 flex-row items-end justify-between pt-6 px-1">
                    {graficoData.map((item, index) => {
                      // Calcula altura proporcional de até 120 pixels
                      const alturaBarra = maxGraficoValue > 0 ? (item.valor / maxGraficoValue) * 110 : 0;
                      
                      return (
                        <TouchableOpacity 
                          key={index} 
                          className="items-center flex-1 mx-0.5"
                          onPress={() => {
                            if (item.valor > 0) {
                              setSelectedChartBarLabel(item.label);
                              setIsChartSalesModalVisible(true);
                            }
                          }}
                          disabled={item.valor === 0}
                          activeOpacity={0.7}
                        >
                          
                          {/* Indicador do valor da barra */}
                          {item.valor > 0 && (
                            <Text className="text-[7px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded-sm mb-1 text-center leading-none">
                              {item.valor.toFixed(0)}
                            </Text>
                          )}

                          {/* Barra Reativa */}
                          <View 
                            style={{ height: Math.max(alturaBarra, 4) }} // Altura mínima de 4px se for 0 pra manter visual estruturado
                            className={`w-full rounded-t-md ${
                              item.valor > 0 ? 'bg-adorne-teal shadow-xs' : 'bg-adorne-gold/20'
                            }`}
                          />

                          {/* Label do Eixo X */}
                          <Text className="text-[8px] text-adorne-gray font-bold mt-2 text-center" style={{ fontSize: 8 }}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Feed ao Vivo / Últimas Atividades */}
              <View className="mt-6">
                <View className="flex-row items-center mb-3">
                  <Bell size={14} color="#0B3A34" className="mr-1.5" />
                  <Text className="text-sm font-bold text-adorne-teal">Vendas Recentes</Text>
                </View>

                {recentSales.length === 0 ? (
                  <View className="bg-white border border-dashed border-adorne-gold/30 rounded-3xl p-8 items-center justify-center">
                    <Text className="text-adorne-gray text-xs font-semibold">Nenhuma venda registrada</Text>
                  </View>
                ) : (
                  recentSales.map((item) => (
                    <TouchableOpacity 
                      key={item.id} 
                      onPress={() => {
                        setSelectedSale(item);
                        setIsSaleModalVisible(true);
                      }}
                      className="bg-white rounded-2xl p-4 mb-2.5 border border-adorne-gold/15 shadow-xs flex-row justify-between items-center active:opacity-90"
                    >
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center mb-1">
                          <Clock size={10} color="#607371" className="mr-1" />
                          <Text className="text-[9px] text-adorne-gray font-semibold">{formatDate(item.createdAt)}</Text>
                        </View>
                        <Text className="text-xs font-bold text-adorne-text">{item.cliente?.nome || 'Cliente Avulso'}</Text>
                        <Text className="text-[10px] text-adorne-gray mt-0.5">Vendedora: {item.usuario?.nome || 'Funcionária'}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <View className="items-end mr-2">
                          <Text className="text-sm font-black text-emerald-600">{formatCurrency(item.valorTotal)}</Text>
                          <Text className="text-[9px] text-adorne-gray uppercase font-bold mt-1 tracking-wider">{item.formaPagamento}</Text>
                        </View>
                        <ChevronRight size={14} color="#A0B0AE" />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

            </View>
          )}
        </ScrollView>
      )}

      {/* ===== ABA RELATÓRIOS ===== */}
      {activeTab === 'relatorios' && (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          
          {/* Cabeçalho do Relatório */}
          <View className="px-6 pt-4 flex-row items-center justify-between">
            <Text className="text-base font-bold text-adorne-teal">Relatório Mensal</Text>
            <TouchableOpacity 
              onPress={loadReportData}
              className="p-1 rounded-lg border border-adorne-gold/20 bg-white"
            >
              <RefreshCwIcon size={12} color="#0B3A34" />
            </TouchableOpacity>
          </View>

          {/* Seletor de Mês e Ano */}
          <View className="px-6 pt-4 flex-row justify-between items-center">
            <TouchableOpacity 
              onPress={handlePrevMonth}
              className="w-10 h-10 rounded-full border border-adorne-gold/20 bg-white items-center justify-center active:opacity-75"
            >
              <ChevronLeft size={20} color="#0B3A34" />
            </TouchableOpacity>

            <View className="flex-row items-center">
              <Calendar size={18} color="#0B3A34" className="mr-2" />
              <Text className="text-base font-extrabold text-adorne-teal">
                {getNomeMes(reportMes)} {reportAno}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={handleNextMonth}
              className="w-10 h-10 rounded-full border border-adorne-gold/20 bg-white items-center justify-center active:opacity-75"
            >
              <ChevronRight size={20} color="#0B3A34" />
            </TouchableOpacity>
          </View>

          {/* Dados do Relatório */}
          {isLoadingReport ? (
            <View className="py-24 justify-center items-center">
              <ActivityIndicator size="large" color="#0B3A34" />
            </View>
          ) : reportData ? (
            <View className="p-6">
              
              {/* KPI Faturamento */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="bg-emerald-50 w-10 h-10 rounded-xl items-center justify-center">
                    <DollarSign size={20} color="#059669" />
                  </View>
                  <View className="bg-adorne-background px-3 py-1 rounded-full border border-adorne-gold/10">
                    <Text className="text-[10px] text-adorne-teal font-extrabold uppercase">Faturamento</Text>
                  </View>
                </View>
                <Text className="text-[10px] font-bold text-adorne-gray uppercase tracking-wider">Faturamento do Mês</Text>
                <Text className="text-3xl font-black text-adorne-teal mt-1 tracking-tight">
                  {formatCurrency(reportData.faturamento)}
                </Text>
              </View>

              {/* Grid Secundária */}
              <View className="flex-row justify-between mb-4">
                
                {/* Comparação com Mês Anterior */}
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 w-[48%] shadow-sm justify-between">
                  <View className="bg-blue-50 w-8 h-8 rounded-lg items-center justify-center mb-3">
                    {reportData.variacaoPercentual !== null && reportData.variacaoPercentual < 0 ? (
                      <TrendingDown size={16} color="#EF4444" />
                    ) : (
                      <TrendingUp size={16} color="#059669" />
                    )}
                  </View>
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Comparação Mês Ant.</Text>
                  {reportData.variacaoPercentual == null ? (
                    <Text className="text-[10px] font-bold text-adorne-gray/70 italic mt-1">Sem dados do mês anterior</Text>
                  ) : (
                    <Text className={`text-base font-black mt-1 ${reportData.variacaoPercentual >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {reportData.variacaoPercentual >= 0 ? '+' : ''}{reportData.variacaoPercentual.toFixed(1).replace('.', ',')}%
                    </Text>
                  )}
                </View>

                {/* Vendas Realizadas */}
                <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 w-[48%] shadow-sm justify-between">
                  <View className="bg-purple-50 w-8 h-8 rounded-lg items-center justify-center mb-3">
                    <Award size={16} color="#7C3AED" />
                  </View>
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Vendas Realizadas</Text>
                  <Text className="text-base font-black text-adorne-teal mt-1">{reportData.totalVendas}</Text>
                </View>

              </View>

              {/* Ticket Médio */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4 flex-row justify-between items-center">
                <View>
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Ticket Médio das Peças</Text>
                  <Text className="text-xl font-black text-adorne-teal mt-1">{formatCurrency(reportData.ticketMedio)}</Text>
                </View>
                <View className="bg-amber-50 w-10 h-10 rounded-xl items-center justify-center">
                  <Sparkles size={20} color="#D97706" />
                </View>
              </View>

              {/* Gráfico Diário Scrollable */}
              <View className="bg-white border border-adorne-gold/15 rounded-3xl p-6 shadow-sm">
                <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-4 border-b border-adorne-background pb-2">
                  📈 Faturamento Diário no Mês
                </Text>
                
                {reportData.grafico.length === 0 ? (
                  <View className="py-12 items-center justify-center">
                    <Text className="text-xs text-adorne-gray italic">Sem dados para exibir</Text>
                  </View>
                ) : (
                  <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="pt-2">
                    <View className="h-44 flex-row items-end pb-2">
                      {reportData.grafico.map((item: any, index: number) => {
                        const maxVal = Math.max(...reportData.grafico.map((g: any) => g.valor), 1);
                        const alturaBarra = maxVal > 0 ? (item.valor / maxVal) * 110 : 0;
                        const hasVenda = item.valor > 0;
                        return (
                          <View key={index} className="items-center w-10 mx-1">
                            {/* Indicador do valor da barra */}
                            {hasVenda && (
                              <Text className="text-[7px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded-sm mb-1 text-center leading-none">
                                {item.valor.toFixed(0)}
                              </Text>
                            )}

                            {/* Barra */}
                            <View 
                              style={{ height: Math.max(alturaBarra, 4) }}
                              className={`w-5 rounded-t-md ${
                                hasVenda ? 'bg-adorne-teal shadow-xs' : 'bg-adorne-gold/20'
                              }`}
                            />

                            {/* Label do Eixo X */}
                            <Text className="text-[8px] text-adorne-gray font-bold mt-2 text-center" style={{ fontSize: 8 }}>
                              {item.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>

            </View>
          ) : (
            <View className="py-24 items-center justify-center">
              <Text className="text-xs text-adorne-gray italic">Não foi possível recuperar dados de relatório</Text>
            </View>
          )}

        </ScrollView>
      )}

      {/* ===== ABA PERFIL ===== */}
      {activeTab === 'perfil' && (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="p-6">

            {/* Avatar */}
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-adorne-teal border-4 border-adorne-gold/30 items-center justify-center mb-3 shadow-lg">
                <Text className="text-3xl font-black text-white">{user?.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
              <Text className="text-xl font-black text-adorne-teal">{user?.nome}</Text>
              <View className="mt-1.5 px-4 py-1 rounded-full bg-adorne-teal/10 border border-adorne-teal/20">
                <Text className="text-[11px] font-extrabold uppercase tracking-wider text-adorne-teal">👑 Proprietária</Text>
              </View>
            </View>

            {/* Dados */}
            <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
              <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-4 pb-2 border-b border-adorne-background">Informações do Perfil</Text>

              <View className="flex-row items-center py-3 border-b border-adorne-background">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3"><User size={16} color="#0B3A34" /></View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Nome Completo</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">{user?.nome || '—'}</Text>
                </View>
              </View>

              <View className="flex-row items-center py-3 border-b border-adorne-background">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3"><Mail size={16} color="#0B3A34" /></View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">E-mail</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">{user?.email || '—'}</Text>
                </View>
              </View>

              <View className="flex-row items-center py-3 border-b border-adorne-background">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3"><Building2 size={16} color="#0B3A34" /></View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Loja</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">Semijoias Adorne</Text>
                </View>
              </View>

              <View className="flex-row items-center py-3">
                <View className="w-8 h-8 rounded-lg bg-adorne-background items-center justify-center mr-3"><Shield size={16} color="#0B3A34" /></View>
                <View className="flex-1">
                  <Text className="text-[9px] font-bold text-adorne-gray uppercase tracking-wider">Nível de Acesso</Text>
                  <Text className="text-sm font-bold text-adorne-text mt-0.5">Administrador Total</Text>
                </View>
              </View>
            </View>

            {/* Acesso rápido */}
            <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
              <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-3 pb-2 border-b border-adorne-background">Acesso Rápido</Text>
              <TouchableOpacity onPress={() => setActiveTab('dashboard')} className="flex-row items-center justify-between py-3 border-b border-adorne-background active:opacity-75">
                <Text className="text-sm text-adorne-text font-semibold">📊 Painel Analítico</Text>
                <ChevronRight size={16} color="#607371" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('relatorios')} className="flex-row items-center justify-between py-3 active:opacity-75">
                <Text className="text-sm text-adorne-text font-semibold">📅 Relatórios Mensais</Text>
                <ChevronRight size={16} color="#607371" />
              </TouchableOpacity>
            </View>

            {/* ── Gerenciar Peças ── */}
            <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 shadow-sm mb-4">
              <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-adorne-background">
                <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider">💎 Gerenciar Peças</Text>
                <TouchableOpacity
                  onPress={() => {
                    setEditingProduto(null);
                    setFormNome(''); setFormCategoria('Brincos'); setFormPreco(''); setFormEstoque('');
                    setIsProdutoModalVisible(true);
                  }}
                  className="flex-row items-center bg-adorne-teal px-3 py-1.5 rounded-xl active:opacity-90"
                >
                  <Plus size={13} color="#ffffff" />
                  <Text className="text-white text-[11px] font-bold ml-1">Nova Peça</Text>
                </TouchableOpacity>
              </View>

              {isLoadingProdutos ? (
                <View className="py-8 items-center"><ActivityIndicator size="small" color="#0B3A34" /></View>
              ) : produtos.length === 0 ? (
                <View className="py-8 items-center">
                  <Package size={32} color="#C5A880" />
                  <Text className="text-adorne-gray text-xs text-center mt-2 font-semibold">Nenhuma peça cadastrada</Text>
                  <TouchableOpacity
                    onPress={() => { setEditingProduto(null); setFormNome(''); setFormCategoria('Brincos'); setFormPreco(''); setFormEstoque(''); setIsProdutoModalVisible(true); }}
                    className="mt-3 bg-adorne-teal px-4 py-2 rounded-xl"
                  >
                    <Text className="text-white text-xs font-bold">Cadastrar Primeira Peça</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {produtos.map((produto, idx) => (
                    <View key={produto.id} className={`flex-row items-center justify-between py-3 ${idx < produtos.length - 1 ? 'border-b border-adorne-background' : ''}`}>
                      <View className="flex-1 pr-3">
                        <Text className="text-xs font-bold text-adorne-text" numberOfLines={1}>{produto.nome}</Text>
                        <View className="flex-row items-center mt-0.5">
                          <Tag size={9} color="#C5A880" />
                          <Text className="text-[9px] text-adorne-gray ml-1">{produto.categoria}</Text>
                          <Text className="text-[9px] text-adorne-gray mx-1">·</Text>
                          <Text className="text-[9px] font-bold text-adorne-teal">R$ {produto.preco.toFixed(2).replace('.', ',')}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        <View className={`px-2 py-0.5 rounded-full mr-2 ${produto.estoque <= 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                          <Text className={`text-[9px] font-bold ${produto.estoque <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>{produto.estoque} un.</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingProduto(produto);
                            setFormNome(produto.nome);
                            setFormCategoria(produto.categoria);
                            setFormPreco(produto.preco.toString().replace('.', ','));
                            setFormEstoque(produto.estoque.toString());
                            setIsProdutoModalVisible(true);
                          }}
                          className="w-7 h-7 rounded-lg bg-adorne-background border border-adorne-gold/20 items-center justify-center mr-1"
                        >
                          <Edit3 size={12} color="#0B3A34" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => Alert.alert('Excluir Peça', `Excluir "${produto.nome}"? Esta ação não pode ser desfeita.`, [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Excluir', style: 'destructive', onPress: async () => {
                              try { await api.delete(`/produtos/${produto.id}`); loadProdutos(); }
                              catch (e: any) { Alert.alert('Erro', e.response?.data?.message || 'Erro ao excluir.'); }
                            }},
                          ])}
                          className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 items-center justify-center"
                        >
                          <Trash2 size={12} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity onPress={loadProdutos} className="mt-3 pt-3 border-t border-adorne-background flex-row items-center justify-center">
                    <Text className="text-[10px] text-adorne-gray font-bold">↻  Atualizar lista</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

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
                Você será desconectado e precisará fazer login novamente.
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

      {/* Modal Criar / Editar Produto */}      <Modal visible={isProdutoModalVisible} animationType="slide" transparent onRequestClose={() => setIsProdutoModalVisible(false)}>
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
              <TextInput
                value={formNome}
                onChangeText={setFormNome}
                placeholder="Ex: Anel Riviera Zircônia"
                placeholderTextColor="#A0B0AE"
                className="flex-1 h-12 ml-2 text-adorne-text text-sm"
              />
            </View>

            <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-2 ml-1">Categoria *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-grow-0">
              <View className="flex-row">
                {['Brincos', 'Colares', 'Anéis', 'Pulseiras', 'Outros'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setFormCategoria(cat)}
                    className={`px-4 py-2 rounded-full mr-2 border ${formCategoria === cat ? 'bg-adorne-teal border-adorne-teal' : 'bg-white border-adorne-gold/20'}`}
                  >
                    <Text className={`text-xs font-bold ${formCategoria === cat ? 'text-white' : 'text-adorne-gray'}`}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row mb-5">
              <View className="flex-1 mr-2">
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Preço (R$) *</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3">
                  <Text className="text-sm font-bold text-adorne-teal">R$</Text>
                  <TextInput
                    value={formPreco}
                    onChangeText={setFormPreco}
                    placeholder="65,00"
                    placeholderTextColor="#A0B0AE"
                    keyboardType="numeric"
                    className="flex-1 h-11 ml-2 text-adorne-text font-bold text-sm"
                  />
                </View>
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Estoque (un.) *</Text>
                <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3">
                  <Hash size={14} color="#607371" />
                  <TextInput
                    value={formEstoque}
                    onChangeText={setFormEstoque}
                    placeholder="20"
                    placeholderTextColor="#A0B0AE"
                    keyboardType="numeric"
                    className="flex-1 h-11 ml-2 text-adorne-text font-bold text-sm"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleSaveProduto}
              disabled={isSavingProduto}
              className="w-full bg-adorne-teal rounded-2xl h-13 items-center justify-center flex-row shadow-sm active:opacity-90"
            >
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

      {/* Modal de Detalhes da Venda */}
      <Modal
        visible={isSaleModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsSaleModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-adorne-gold/15">
            
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-adorne-background">
              <View className="flex-row items-center">
                <Gem size={18} color="#0B3A34" className="mr-1.5" />
                <Text className="text-sm font-bold text-adorne-teal">Detalhes da Venda</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsSaleModalVisible(false)}
                className="w-7 h-7 rounded-full bg-adorne-background items-center justify-center"
              >
                <X size={14} color="#607371" />
              </TouchableOpacity>
            </View>

            {/* Informações Gerais */}
            {selectedSale && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
                {/* ID da Venda */}
                <View className="bg-adorne-background p-3 rounded-2xl mb-3 flex-row justify-between items-center border border-adorne-gold/10">
                  <Text className="text-[10px] font-bold text-adorne-gray uppercase">Código / UUID</Text>
                  <Text className="text-[9px] font-bold text-adorne-teal uppercase tracking-wider">{selectedSale.uuid ? selectedSale.uuid.substring(0, 8) : `#${selectedSale.id}`}</Text>
                </View>

                {/* Grid */}
                <View className="mb-4">
                  <View className="flex-row justify-between py-1.5 border-b border-adorne-background">
                    <Text className="text-xs text-adorne-gray">Data e Hora</Text>
                    <Text className="text-xs font-bold text-adorne-text">{formatDate(selectedSale.createdAt)}</Text>
                  </View>
                  <View className="flex-row justify-between py-1.5 border-b border-adorne-background">
                    <Text className="text-xs text-adorne-gray">Cliente</Text>
                    <Text className="text-xs font-bold text-adorne-text">{selectedSale.cliente?.nome || 'Cliente Avulso'}</Text>
                  </View>
                  {selectedSale.cliente?.telefone && (
                    <View className="flex-row justify-between py-1.5 border-b border-adorne-background">
                      <Text className="text-xs text-adorne-gray">Telefone</Text>
                      <Text className="text-xs font-bold text-adorne-text">{selectedSale.cliente.telefone}</Text>
                    </View>
                  )}
                  <View className="flex-row justify-between py-1.5 border-b border-adorne-background">
                    <Text className="text-xs text-adorne-gray">Vendedora</Text>
                    <Text className="text-xs font-bold text-adorne-text">{selectedSale.usuario?.nome || 'Funcionária'}</Text>
                  </View>
                  <View className="flex-row justify-between py-1.5 border-b border-adorne-background">
                    <Text className="text-xs text-adorne-gray">Forma de Pagamento</Text>
                    <Text className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md uppercase text-[10px]">
                      {selectedSale.formaPagamento}
                    </Text>
                  </View>
                  {selectedSale.observacao && (
                    <View className="py-1.5">
                      <Text className="text-xs text-adorne-gray mb-1">Observações</Text>
                      <View className="bg-adorne-background p-2 rounded-xl border border-adorne-gold/5">
                        <Text className="text-xs text-adorne-text italic">{selectedSale.observacao}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Itens da Venda */}
                <Text className="text-xs font-bold text-adorne-teal uppercase tracking-wider mb-2">Peças Vendidas</Text>
                {selectedSale.itens && selectedSale.itens.map((item: any, idx: number) => (
                  <View key={idx} className="bg-adorne-background p-3 rounded-2xl mb-1.5 flex-row justify-between items-center border border-adorne-gold/5">
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-bold text-adorne-text">{item.produto?.nome || 'Peça Excluída'}</Text>
                      <Text className="text-[10px] text-adorne-gray mt-0.5">
                        {item.quantidade}x {formatCurrency(item.valorUnitario)}
                      </Text>
                    </View>
                    <Text className="text-xs font-bold text-adorne-teal">
                      {formatCurrency(item.quantidade * item.valorUnitario)}
                    </Text>
                  </View>
                ))}

                {/* Total consolidado */}
                <View className="mt-4 pt-3 border-t border-adorne-gold/15 flex-row justify-between items-center">
                  <Text className="text-sm font-bold text-adorne-text">Total da Venda</Text>
                  <Text className="text-lg font-black text-emerald-600">
                    {formatCurrency(selectedSale.valorTotal)}
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Botão Fechar */}
            <TouchableOpacity
              onPress={() => setIsSaleModalVisible(false)}
              className="mt-6 w-full bg-adorne-teal h-11 rounded-xl items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-bold text-sm">Fechar</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Modal de Vendas Filtradas do Gráfico */}
      <Modal
        visible={isChartSalesModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsChartSalesModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-4">
          <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-adorne-gold/15 h-[500px] flex-column justify-between">
            
            <View className="flex-1">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-adorne-background">
                <View className="flex-row items-center">
                  <Calendar size={18} color="#0B3A34" className="mr-1.5" />
                  <Text className="text-sm font-bold text-adorne-teal">
                    Vendas ({selectedChartBarLabel})
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setIsChartSalesModalVisible(false)}
                  className="w-7 h-7 rounded-full bg-adorne-background items-center justify-center"
                >
                  <X size={14} color="#607371" />
                </TouchableOpacity>
              </View>

              {/* Lista de Vendas */}
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {getFilteredSalesForChart().length === 0 ? (
                  <View className="py-24 items-center justify-center">
                    <Text className="text-xs text-adorne-gray italic">Nenhuma venda neste período</Text>
                  </View>
                ) : (
                  getFilteredSalesForChart().map((venda) => (
                    <TouchableOpacity
                      key={venda.id}
                      onPress={() => {
                        setSelectedSale(venda);
                        setIsSaleModalVisible(true);
                      }}
                      className="bg-adorne-background rounded-2xl p-3.5 mb-2 border border-adorne-gold/5 flex-row justify-between items-center active:opacity-80"
                    >
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center mb-1">
                          <Clock size={9} color="#607371" className="mr-1" />
                          <Text className="text-[8px] text-adorne-gray font-bold">{formatDate(venda.createdAt)}</Text>
                        </View>
                        <Text className="text-xs font-bold text-adorne-text">{venda.cliente?.nome || 'Cliente Avulso'}</Text>
                        <Text className="text-[9px] text-adorne-gray mt-0.5">Vendedora: {venda.usuario?.nome || 'Funcionária'}</Text>
                      </View>
                      <View className="items-end flex-row items-center">
                        <View className="items-end mr-1">
                          <Text className="text-xs font-black text-emerald-600">{formatCurrency(venda.valorTotal)}</Text>
                          <Text className="text-[8px] text-adorne-gray uppercase font-bold mt-0.5 tracking-wider">{venda.formaPagamento}</Text>
                        </View>
                        <ChevronRight size={12} color="#A0B0AE" />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Botão Fechar */}
            <TouchableOpacity
              onPress={() => setIsChartSalesModalVisible(false)}
              className="mt-4 w-full bg-adorne-teal h-11 rounded-xl items-center justify-center active:opacity-90"
            >
              <Text className="text-white font-bold text-sm">Fechar</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Barra de Navegação Floating Premium */}
      <View className="bg-white border-t border-adorne-gold/15 py-3.5 px-6 flex-row justify-around items-center shadow-lg">
        {/* Aba Painel */}
        <TouchableOpacity 
          onPress={() => setActiveTab('dashboard')}
          className="items-center flex-1"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'dashboard' ? 'bg-adorne-teal/10' : ''}`}>
            <TrendingUp size={18} color={activeTab === 'dashboard' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'dashboard' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Painel
          </Text>
        </TouchableOpacity>

        {/* Aba Relatórios */}
        <TouchableOpacity 
          onPress={() => setActiveTab('relatorios')}
          className="items-center flex-1"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'relatorios' ? 'bg-adorne-teal/10' : ''}`}>
            <Calendar size={18} color={activeTab === 'relatorios' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'relatorios' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Relatórios
          </Text>
        </TouchableOpacity>

        {/* Aba Perfil */}
        <TouchableOpacity 
          onPress={() => setActiveTab('perfil')}
          className="items-center flex-1"
        >
          <View className={`w-12 h-8 rounded-full items-center justify-center mb-0.5 ${activeTab === 'perfil' ? 'bg-adorne-teal/10' : ''}`}>
            <User size={18} color={activeTab === 'perfil' ? '#0B3A34' : '#607371'} />
          </View>
          <Text className={`text-[9px] font-bold ${activeTab === 'perfil' ? 'text-adorne-teal' : 'text-adorne-gray'}`}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Pequeno ícone SVG de Refresh re-declarado para manter as importações enxutas
function RefreshCwIcon({ size, color }: { size: number; color: string }) {
  return (
    <View className="w-5 h-5 items-center justify-center">
      <Text className="text-[9px] font-bold text-adorne-teal" style={{ color }}>↻</Text>
    </View>
  );
}
