import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import DonaPlaceholder from '../screens/DonaPlaceholder';
import FuncPlaceholder from '../screens/FuncPlaceholder';

// Cria a pilha (stack) de navegação do React Navigation
const Stack = createStackNavigator();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  // Exibe um carregador centralizado enquanto verifica o token local no SecureStore e API
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F9F8' }}>
        <ActivityIndicator size="large" color="#0B3A34" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user === null ? (
        // Fluxo de não-autenticado: exibe tela de login
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : user.role === 'DONO' ? (
        // Fluxo de Dono da Loja: exibe painel restrito analítico
        <Stack.Screen name="DonaDashboard" component={DonaPlaceholder} />
      ) : (
        // Fluxo de Funcionária: exibe painel restrito de vendas
        <Stack.Screen name="FuncDashboard" component={FuncPlaceholder} />
      )}
    </Stack.Navigator>
  );
}
