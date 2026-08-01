import './global.css';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Platform, useWindowDimensions } from 'react-native';

// Ponto de entrada do aplicativo mobile Expo
export default function App() {
  const { width } = useWindowDimensions();
  // Mostra o frame do iPhone apenas se for navegador Web e largura maior que um celular comum (>500px)
  const isDesktopWeb = Platform.OS === 'web' && width > 500;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          {isDesktopWeb ? (
            <View className="flex-1 min-h-screen bg-[#F0F5F4] justify-center items-center py-8">
              {/* iPhone Container Simulado */}
              <View 
                style={{
                  width: 390,
                  height: 844,
                  borderRadius: 48,
                  borderWidth: 12,
                  borderColor: '#18181b', // zinc-900 bezel
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  position: 'relative',
                  shadowColor: '#0b3a34',
                  shadowOffset: { width: 0, height: 15 },
                  shadowOpacity: 0.1,
                  shadowRadius: 30,
                  elevation: 10,
                }}
              >
                {/* Ilha Dinâmica / Notch */}
                <View 
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: '50%',
                    transform: [{ translateX: -55 }],
                    width: 110,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#18181b',
                    zIndex: 1000,
                  }}
                />
                
                {/* Conteúdo do App */}
                <View style={{ flex: 1 }}>
                  <RootNavigator />
                </View>

                {/* Home Indicator Bar */}
                <View 
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: [{ translateX: -65 }],
                    width: 130,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#a1a1aa', // zinc-400
                    zIndex: 1000,
                  }}
                />
              </View>
            </View>
          ) : (
            <RootNavigator />
          )}
          {/* Barra de status superior adaptada ao tema claro */}
          <StatusBar style="dark" />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
