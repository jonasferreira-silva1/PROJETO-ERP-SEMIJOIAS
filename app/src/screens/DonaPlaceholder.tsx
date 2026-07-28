import React, { useState, useEffect } from 'react';
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
  User 
} from 'lucide-react-native';

// Dependências dinâmicas do Expo para evitar quebras em ambiente Web puro
let Notifications: any = null;
let Device: any = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');

    // Configura o comportamento padrão do Push Notification com o app aberto
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log('Expo Notifications/Device não disponível neste ambiente.');
  }
}

export default function DonaPlaceholder() {
  const { user, logout } = useAuth();
  
  // Feed de vendas em tempo real
  const [liveSales, setLiveSales] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [faturamentoHoje, setFaturamentoHoje] = useState(0);

  useEffect(() => {
    let socketInstance: any = null;

    async function initRealTime() {
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) return;

      // 1. Inicializa Conexão WebSocket Segura (Auth Object)
      socketInstance = getSocket(token);
      socketInstance.connect();

      // Monitora status da conexão
      socketInstance.on('connect', () => {
        setIsConnected(true);
        console.log('[Dona] WebSocket Conectado!');
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
        console.log('[Dona] WebSocket Desconectado!');
      });

      // 2. Escuta eventos de novas vendas em tempo real
      socketInstance.on('nova_venda', (novaVenda: any) => {
        console.log('[Dona] Nova venda recebida via socket:', novaVenda);
        
        setLiveSales(prev => [novaVenda, ...prev]);
        setFaturamentoHoje(prev => prev + novaVenda.valorTotal);
        
        // Alerta visual discreto na tela
        Alert.alert(
          'Nova Venda! 💎',
          `Vendedora: ${novaVenda.usuario?.nome || 'Funcionária'}\nCliente: ${novaVenda.cliente?.nome || 'Cliente Avulso'}\nTotal: R$ ${novaVenda.valorTotal.toFixed(2).replace('.', ',')}`
        );
      });

      // 3. Registro de Push Notifications Nativo
      if (Platform.OS !== 'web' && Notifications && Device) {
        registerForPush(token);
      }
    }

    // Busca vendas passadas para iniciar o faturamento e histórico da dona
    async function loadInitialData() {
      try {
        const response = await api.get('/vendas/historico'); // No futuro, endpoint de faturamento da dona, por hora usamos histórico dela
        setLiveSales(response.data);
        const total = response.data.reduce((sum: number, v: any) => sum + v.valorTotal, 0);
        setFaturamentoHoje(total);
      } catch (err) {
        console.log('Erro ao carregar dados analíticos iniciais:', err);
      }
    }

    loadInitialData();
    initRealTime();

    // Cleanup: encerra o socket ao desmontar a tela
    return () => {
      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('disconnect');
        socketInstance.off('nova_venda');
      }
      disconnectSocket();
    };
  }, []);

  // Registra as credenciais de Push Notification do dispositivo
  const registerForPush = async (authToken: string) => {
    try {
      if (!Device.isDevice) {
        console.log('[Push] Notificações exigem dispositivo físico real.');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permissão negada.');
        return;
      }

      // Obtém o token do Expo
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('[Push] Token gerado com sucesso:', token);

      // Envia para o backend salvar na tabela PushToken (Relação 1-N)
      await api.post('/perfil/push-token', { token });
      console.log('[Push] Token cadastrado no backend!');
    } catch (error: any) {
      console.log('[Push] Falha ao registrar notificações:', error.message);
    }
  };

  const formatCurrency = (val: number) => {
    return `R$ ${val.toFixed(2).replace('.', ',')}`;
  };

  const renderLiveSaleItem = ({ item }: { item: any }) => {
    const vendedora = item.usuario?.nome || 'Funcionária';
    const cliente = item.cliente?.nome || 'Cliente Avulso';
    const hora = new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-adorne-gold/15 shadow-sm flex-row justify-between items-center">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center mb-1">
            <Clock size={12} color="#607371" className="mr-1" />
            <Text className="text-[10px] text-adorne-gray font-semibold">{hora} • Venda em tempo real</Text>
          </View>
          <Text className="text-sm font-bold text-adorne-text">{cliente}</Text>
          <View className="flex-row items-center mt-1">
            <User size={10} color="#C5A880" className="mr-1" />
            <Text className="text-[11px] text-adorne-gray font-medium">Vendedora: {vendedora}</Text>
          </View>
        </View>
        <Text className="text-base font-extrabold text-emerald-600">{formatCurrency(item.valorTotal)}</Text>
      </View>
    );
  };

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

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Status de Conexão WebSocket */}
        <View className="flex-row items-center mb-6">
          <View className={`w-2.5 h-2.5 rounded-full mr-2 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <Text className="text-xs text-adorne-gray font-bold">
            {isConnected ? 'Painel Conectado (Tempo Real Ativo)' : 'Reconectando canal de tempo real...'}
          </Text>
        </View>

        {/* Dashboard Teaser Cards */}
        <View className="flex-row justify-between mb-6">
          {/* Card Faturamento */}
          <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 w-[48%] shadow-sm">
            <View className="bg-emerald-50 w-8 h-8 rounded-lg items-center justify-center mb-3">
              <DollarSign size={16} color="#059669" />
            </View>
            <Text className="text-[10px] font-bold text-adorne-gray uppercase tracking-wider">Faturamento Total</Text>
            <Text className="text-lg font-black text-adorne-teal mt-1 leading-none">
              {formatCurrency(faturamentoHoje)}
            </Text>
          </View>

          {/* Card Atividade */}
          <View className="bg-white border border-adorne-gold/15 rounded-3xl p-5 w-[48%] shadow-sm">
            <View className="bg-blue-50 w-8 h-8 rounded-lg items-center justify-center mb-3">
              <TrendingUp size={16} color="#2563EB" />
            </View>
            <Text className="text-[10px] font-bold text-adorne-gray uppercase tracking-wider">Vendas Hoje</Text>
            <Text className="text-lg font-black text-adorne-teal mt-1 leading-none">
              {liveSales.length}
            </Text>
          </View>
        </View>

        {/* Live Feed Title */}
        <View className="flex-row items-center mb-4">
          <Bell size={16} color="#0B3A34" className="mr-1.5" />
          <Text className="text-sm font-bold text-adorne-teal">Feed de Vendas ao Vivo</Text>
          <Sparkles size={12} color="#C5A880" className="ml-1" />
        </View>

        {/* Feed List */}
        {liveSales.length === 0 ? (
          <View className="bg-white border border-dashed border-adorne-gold/30 rounded-3xl p-10 items-center justify-center">
            <ActivityIndicator size="small" color="#C5A880" className="mb-2" />
            <Text className="text-adorne-gray text-xs font-semibold text-center">
              Aguardando atividades de vendas...
            </Text>
            <Text className="text-[9px] text-adorne-gray/70 text-center mt-1">
              As vendas concluídas pelas funcionárias aparecerão aqui instantaneamente.
            </Text>
          </View>
        ) : (
          <FlatList
            data={liveSales}
            renderItem={renderLiveSaleItem}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            scrollEnabled={false} // Roda dentro do ScrollView principal
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </ScrollView>
    </View>
  );
}
