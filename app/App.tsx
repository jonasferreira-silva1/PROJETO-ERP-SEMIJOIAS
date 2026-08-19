import './global.css';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Platform, useWindowDimensions } from 'react-native';

// Dimensões base do frame simulado
const FRAME_WIDTH = 390;
const FRAME_HEIGHT = 844;

// Ponto de entrada do aplicativo mobile Expo
export default function App() {
  const { width, height } = useWindowDimensions();

  // Mostra o frame do iPhone apenas se for browser Web
  const isWeb = Platform.OS === 'web';

  // Calcula escala para caber na tela com margem de 32px em cada lado
  const scaleX = (width - 64) / FRAME_WIDTH;
  const scaleY = (height - 64) / FRAME_HEIGHT;
  const scale = Math.min(scaleX, scaleY, 1); // nunca maior que 1:1

  const frameW = FRAME_WIDTH * scale;
  const frameH = FRAME_HEIGHT * scale;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          {isWeb ? (
            <View
              style={{
                flex: 1,
                minHeight: '100vh' as any,
                backgroundColor: '#F0F5F4',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 16,
              }}
            >
              {/* iPhone Container — escala proporcional */}
              <View
                style={{
                  width: frameW,
                  height: frameH,
                  borderRadius: 48 * scale,
                  borderWidth: Math.max(4, 12 * scale),
                  borderColor: '#18181b',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  position: 'relative',
                  shadowColor: '#0b3a34',
                  shadowOffset: { width: 0, height: 15 },
                  shadowOpacity: 0.12,
                  shadowRadius: 30,
                  elevation: 10,
                }}
              >
                {/* Ilha Dinâmica / Notch — escala proporcional */}
                {scale > 0.4 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 12 * scale,
                      left: '50%',
                      transform: [{ translateX: -55 * scale }],
                      width: 110 * scale,
                      height: 28 * scale,
                      borderRadius: 14 * scale,
                      backgroundColor: '#18181b',
                      zIndex: 1000,
                    }}
                  />
                )}

                {/* Conteúdo do App */}
                <View style={{ flex: 1 }}>
                  <RootNavigator />
                </View>

                {/* Home Indicator */}
                {scale > 0.4 && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 8 * scale,
                      left: '50%',
                      transform: [{ translateX: -65 * scale }],
                      width: 130 * scale,
                      height: Math.max(3, 5 * scale),
                      borderRadius: 3,
                      backgroundColor: '#a1a1aa',
                      zIndex: 1000,
                    }}
                  />
                )}
              </View>
            </View>
          ) : (
            <RootNavigator />
          )}
          <StatusBar style="dark" />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
