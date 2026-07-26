import axios from 'axios';
import * as SecureStore from './storage';

// NOTA: Em testes no Android Emulator, use 'http://10.0.2.2:3000'.
// Em dispositivos físicos (Expo Go), use o IP local do seu computador (ex: 'http://192.168.1.50:3000').
export const API_URL = 'http://localhost:3000';

// Cria a instância do Axios pré-configurada com a URL da API do backend
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Interceptor que anexa o token JWT armazenado de forma automática no cabeçalho HTTP de cada chamada
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
