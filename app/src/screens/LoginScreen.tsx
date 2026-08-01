import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Gem, Mail, Lock, Eye, EyeOff, Fingerprint } from 'lucide-react-native';

// Tela de Login com formulário e identidade visual institucional
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Executa o envio dos dados de login
  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à API');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-adorne-background"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center items-center px-6 py-12">
          
          {/* Logo Circular da Adorne */}
          <View className="items-center mb-10">
            <View className="w-28 h-28 rounded-full border-2 border-adorne-gold items-center justify-center bg-white shadow-sm mb-4">
              <Gem size={40} color="#0B3A34" />
              <Text className="text-adorne-teal font-serif text-lg tracking-widest mt-1">Adorne</Text>
              <Text className="text-[8px] text-adorne-gold tracking-[0.25em] font-semibold uppercase">Semijoias</Text>
            </View>
            <Text className="text-adorne-teal text-center text-xs tracking-wider italic font-medium">
              Realce sua beleza com brilho e sofisticação
            </Text>
          </View>

          {/* Card do Formulário */}
          <View className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-md border border-adorne-gold/10">
            <Text className="text-xl font-bold text-adorne-teal mb-1 text-center">Bem-vinda de volta!</Text>
            <Text className="text-adorne-gray text-xs mb-6 text-center">Faça login para continuar</Text>

            {/* Mensagem de Erro de Validação/API */}
            {errorMsg ? (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <Text className="text-red-600 text-xs font-semibold text-center">{errorMsg}</Text>
              </View>
            ) : null}

            {/* Input de Email */}
            <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">E-mail</Text>
            <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
              <Mail size={16} color="#607371" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor="#A0B0AE"
                keyboardType="email-address"
                autoCapitalize="none"
                className="flex-1 h-12 ml-2 text-adorne-text text-sm"
              />
            </View>

            {/* Input de Senha */}
            <Text className="text-[10px] font-bold text-adorne-gray uppercase mb-1.5 ml-1">Senha</Text>
            <View className="flex-row items-center bg-adorne-background border border-adorne-gold/20 rounded-xl px-3 mb-4">
              <Lock size={16} color="#607371" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor="#A0B0AE"
                autoCapitalize="none"
                className="flex-1 h-12 ml-2 text-adorne-text text-sm"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-1">
                {showPassword ? <EyeOff size={16} color="#607371" /> : <Eye size={16} color="#607371" />}
              </TouchableOpacity>
            </View>

            {/* Checkbox "Lembrar de mim" e link "Esqueci senha" */}
            <View className="flex-row justify-between items-center mb-6">
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                className="flex-row items-center"
              >
                <View className={`w-4 h-4 rounded border mr-2 items-center justify-center ${rememberMe ? 'bg-adorne-teal border-adorne-teal' : 'border-adorne-gold/40'}`}>
                  {rememberMe ? <Text className="text-white text-[8px] font-bold">✓</Text> : null}
                </View>
                <Text className="text-xs text-adorne-gray">Lembrar de mim</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Recuperação de Senha', 'Funcionalidade em desenvolvimento. Por favor, solicite a redefinição de sua senha ao administrador da sua loja.')}>
                <Text className="text-xs text-adorne-teal font-semibold">Esqueci minha senha</Text>
              </TouchableOpacity>
            </View>

            {/* Botão de Entrar */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className="w-full bg-adorne-teal h-12 rounded-xl items-center justify-center active:opacity-90 shadow-sm"
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-sm">Entrar</Text>
              )}
            </TouchableOpacity>

            {/* Link para Criar Conta */}
            <View className="flex-row justify-center mt-4">
              <Text className="text-xs text-adorne-gray">Não tem uma conta?</Text>
              <TouchableOpacity onPress={() => Alert.alert('Criar Conta', 'Para cadastrar sua loja no ERP Semijoias Adorne, entre em contato com a nossa equipe comercial.')}>
                <Text className="text-xs text-adorne-teal font-bold ml-1">Criar conta</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Opção Biométrica */}
          <View className="items-center mt-8">
            <TouchableOpacity className="w-12 h-12 rounded-full border border-adorne-gold/30 items-center justify-center bg-white shadow-sm mb-2 active:opacity-90">
              <Fingerprint size={24} color="#0B3A34" />
            </TouchableOpacity>
            <Text className="text-[10px] text-adorne-gray tracking-wider">
              Segurança e proteção para você
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
