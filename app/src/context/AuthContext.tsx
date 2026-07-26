import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from '../services/storage';
import api from '../services/api';

// Interface que descreve os dados do usuário conectado
export interface User {
  id: number;
  nome: string;
  email: string;
  role: 'DONO' | 'FUNCIONARIA';
  lojaId: number;
  filialId: number;
}

// Interface que define o formato do contexto de autenticação exposto globalmente
interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Cria o contexto de autenticação com valor padrão vazio
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Efeito executado na inicialização para recuperar a sessão persistida anteriormente
  useEffect(() => {
    async function loadStorageData() {
      try {
        const token = await SecureStore.getItemAsync('authToken');
        
        if (token) {
          // Se o token existe, valida-o buscando o perfil correspondente na API
          const response = await api.get('/perfil');
          setUser(response.data);
        }
      } catch (error) {
        // Se falhar (ex: token expirou), limpa o token corrompido
        await SecureStore.deleteItemAsync('authToken');
      } finally {
        setIsLoading(false);
      }
    }

    loadStorageData();
  }, []);

  // Lógica de login: chama o endpoint, salva o token no SecureStore e atualiza o estado
  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user: loggedUser } = response.data;

      // Guarda o token de forma criptografada na memória segura do dispositivo
      await SecureStore.setItemAsync('authToken', accessToken);
      setUser(loggedUser);
    } catch (error: any) {
      const message = error.response?.data?.message || 'E-mail ou senha inválidos';
      throw new Error(message);
    }
  };

  // Lógica de logout: descarta o token e zera o estado do usuário logado
  const logout = async () => {
    await SecureStore.deleteItemAsync('authToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook utilitário para facilitar o uso do contexto de login nas telas
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
