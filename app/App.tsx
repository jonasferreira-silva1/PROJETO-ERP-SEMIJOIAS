import './global.css';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Ponto de entrada do aplicativo mobile Expo
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          {/* Gerenciador dinâmico de telas baseadas na autenticação */}
          <RootNavigator />
          {/* Barra de status superior adaptada ao tema claro */}
          <StatusBar style="dark" />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
