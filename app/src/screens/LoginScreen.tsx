import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Gem, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F4F9F8' }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }}>

          {/* ── Logo ── */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{
              width: 96, height: 96,
              borderRadius: 48,
              borderWidth: 2,
              borderColor: '#C5A880',
              backgroundColor: '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
              shadowColor: '#0B3A34',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
            }}>
              <Gem size={32} color="#0B3A34" />
              <Text style={{ color: '#0B3A34', fontSize: 14, fontWeight: '700', letterSpacing: 2, marginTop: 4 }}>
                Adorne
              </Text>
              <Text style={{ color: '#C5A880', fontSize: 8, letterSpacing: 3, fontWeight: '600', textTransform: 'uppercase' }}>
                Semijoias
              </Text>
            </View>
            <Text style={{ color: '#0B3A34', fontSize: 12, fontStyle: 'italic', textAlign: 'center', letterSpacing: 0.5 }}>
              Realce sua beleza com brilho e sofisticação
            </Text>
          </View>

          {/* ── Card do formulário ── */}
          <View style={{
            backgroundColor: '#ffffff',
            width: '100%',
            maxWidth: 380,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(197,168,128,0.15)',
            shadowColor: '#0B3A34',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 4,
          }}>

            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0B3A34', textAlign: 'center', marginBottom: 4 }}>
              Bem-vinda de volta!
            </Text>
            <Text style={{ fontSize: 13, color: '#607371', textAlign: 'center', marginBottom: 24 }}>
              Faça login para continuar
            </Text>

            {/* Erro */}
            {errorMsg ? (
              <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* E-mail */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#607371', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginLeft: 4 }}>
              E-mail
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F4F9F8', borderWidth: 1, borderColor: 'rgba(197,168,128,0.25)',
              borderRadius: 12, paddingHorizontal: 12, marginBottom: 16,
            }}>
              <Mail size={16} color="#607371" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#A0B0AE"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ flex: 1, height: 48, marginLeft: 8, color: '#0F211F', fontSize: 14 }}
              />
            </View>

            {/* Senha */}
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#607371', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginLeft: 4 }}>
              Senha
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F4F9F8', borderWidth: 1, borderColor: 'rgba(197,168,128,0.25)',
              borderRadius: 12, paddingHorizontal: 12, marginBottom: 20,
            }}>
              <Lock size={16} color="#607371" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor="#A0B0AE"
                autoCapitalize="none"
                style={{ flex: 1, height: 48, marginLeft: 8, color: '#0F211F', fontSize: 14 }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                {showPassword
                  ? <EyeOff size={16} color="#607371" />
                  : <Eye size={16} color="#607371" />
                }
              </TouchableOpacity>
            </View>

            {/* Lembrar de mim + Esqueci senha — cada um na sua linha em telas pequenas */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{
                  width: 16, height: 16, borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: rememberMe ? '#0B3A34' : 'rgba(197,168,128,0.5)',
                  backgroundColor: rememberMe ? '#0B3A34' : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 8,
                }}>
                  {rememberMe && <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 12, color: '#607371' }}>Lembrar de mim</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => Alert.alert('Recuperação de Senha', 'Solicite a redefinição ao administrador da sua loja.')}>
                <Text style={{ fontSize: 12, color: '#0B3A34', fontWeight: '700' }}>Esqueci minha senha</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Entrar */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              style={{
                backgroundColor: '#0B3A34',
                height: 52,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#0B3A34',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
              activeOpacity={0.85}
            >
              {isLoading
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>Entrar</Text>
              }
            </TouchableOpacity>

            {/* Criar conta */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#607371' }}>Não tem uma conta? </Text>
              <TouchableOpacity onPress={() => Alert.alert('Criar Conta', 'Para cadastrar sua loja, entre em contato com nossa equipe comercial.')}>
                <Text style={{ fontSize: 12, color: '#0B3A34', fontWeight: '800' }}>Criar conta</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Rodapé discreto */}
          <Text style={{ marginTop: 32, fontSize: 10, color: '#A0B0AE', letterSpacing: 0.5, textAlign: 'center' }}>
            Semijoias Adorne © {new Date().getFullYear()}
          </Text>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
