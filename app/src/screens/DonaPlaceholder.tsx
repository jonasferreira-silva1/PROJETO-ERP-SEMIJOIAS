import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';

// Tela de espaço reservado para a interface da Dona da Loja
export default function DonaPlaceholder() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 justify-center items-center bg-adorne-background p-6">
      <View className="bg-white w-full max-w-sm rounded-3xl p-8 items-center shadow-lg border border-adorne-gold/20">
        <Text className="text-2xl font-bold text-adorne-teal mb-2">Painel da Dona</Text>
        <Text className="text-adorne-gray mb-6 text-center">Bem-vinda, {user?.nome}!</Text>
        
        <View className="w-full bg-adorne-background rounded-2xl p-4 mb-6">
          <Text className="text-xs text-adorne-gray font-semibold uppercase tracking-wider mb-1">E-mail</Text>
          <Text className="text-adorne-text font-bold mb-3">{user?.email}</Text>
          
          <Text className="text-xs text-adorne-gray font-semibold uppercase tracking-wider mb-1">Nível de Acesso</Text>
          <Text className="text-adorne-teal font-bold">{user?.role}</Text>
        </View>

        <TouchableOpacity 
          onPress={logout}
          className="w-full bg-adorne-teal py-4 rounded-2xl items-center active:opacity-90"
        >
          <Text className="text-white font-bold text-base">Encerrar Sessão</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
