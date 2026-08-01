import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Platform, 
  Alert,
  ScrollView
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
  TrendingDown,
  Award
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
  
  // Controle de Período Selecionado
  const [periodo, setPeriodo] = useState<'hoje' | 'ontem' | '7dias'>('hoje');
  const periodoRef = useRef(periodo);

  // Sincroniza a ref do período com o estado para evitar stale closure no socket listener
  useEffect(() => {
    periodoRef.current = periodo;
  }, [periodo]);

  // Estados dos KPIs Analíticos
  const [faturamento, setFaturamento] = useState(0);
  const [totalVendas, setTotalVendas] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [graficoData, setGraficoData] = useState<GraficoItem[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Estados do feed de vendas recentes
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Referência do debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    } catch (err) {
      console.log('Erro ao carregar dados do dashboard:', err);
    } finally {
      setIsLoadingDashboard(false);
    }
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
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString('pt-BR');
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} às ${timeStr}`;
  };

  // Encontra o maior valor do gráfico para calibrar o faturamento proporcionalmente
  const maxGraficoValue = Math.max(...graficoData.map(item => item.valor), 1);

  return (
    <View className="flex-1 bg-adorne-background">
      {/* Header Premium */}
      <View className="bg-white px-6 pt-12 pb-4 shadow-sm border-b border-adorne-gold/10 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-full border border-adorne-gold items-center justify-center bg-adorne-background mr-2.5">
            <Gem size={16} color="#0B3A34" />
          </View>
          <View>
            <Text className="text-xs text-adorne-gray font-semibold">Semijoias Adorne</Text>
            <Text className="text-sm font-bold text-adorne-teal">{user?.nome} (Dona)</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={logout}
          className="w-9 h-9 rounded-xl border border-red-100 items-center justify-center bg-red-50/40 active:opacity-75"
        >
          <LogOut size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        
        {/* Painel de Status */}
        <View className="px-6 pt-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className={`w-2.5 h-2.5 rounded-full mr-2 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
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
                      <View key={index} className="items-center flex-1 mx-0.5">
                        
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
                      </View>
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
                  <View 
                    key={item.id} 
                    className="bg-white rounded-2xl p-4 mb-2.5 border border-adorne-gold/15 shadow-xs flex-row justify-between items-center"
                  >
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center mb-1">
                        <Clock size={10} color="#607371" className="mr-1" />
                        <Text className="text-[9px] text-adorne-gray font-semibold">{formatDate(item.createdAt)}</Text>
                      </View>
                      <Text className="text-xs font-bold text-adorne-text">{item.cliente?.nome || 'Cliente Avulso'}</Text>
                      <Text className="text-[10px] text-adorne-gray mt-0.5">Vendedora: {item.usuario?.nome || 'Funcionária'}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-black text-emerald-600">{formatCurrency(item.valorTotal)}</Text>
                      <Text className="text-[9px] text-adorne-gray uppercase font-bold mt-1 tracking-wider">{item.formaPagamento}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

          </View>
        )}
      </ScrollView>
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
