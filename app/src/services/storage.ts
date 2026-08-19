import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getItemAsync = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {}
    return;
  }
  return SecureStore.setItemAsync(key, value);
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {}
    return;
  }
  return SecureStore.deleteItemAsync(key);
};

// --- Armazenamento Local Não-Seguro (AsyncStorage / localStorage) ---

export const getLocalItemAsync = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return AsyncStorage.getItem(key);
};

export const setLocalItemAsync = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {}
    return;
  }
  return AsyncStorage.setItem(key, value);
};

export const deleteLocalItemAsync = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {}
    return;
  }
  return AsyncStorage.removeItem(key);
};

// --- Utilitário de Migração de Chaves do SecureStore para AsyncStorage ---

export const migrateKeyFromSecureToLocal = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') return; // Web já usa localStorage para ambos, sem necessidade de migração

    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue !== null) {
      // Salva no AsyncStorage
      await AsyncStorage.setItem(key, secureValue);
      // Remove do SecureStore
      await SecureStore.deleteItemAsync(key);
      console.log(`[StorageMigration] Chave '${key}' migrada com sucesso do SecureStore para o AsyncStorage.`);
    }
  } catch (error: any) {
    console.log(`[StorageMigration] Falha ao migrar chave '${key}':`, error.message);
  }
};
