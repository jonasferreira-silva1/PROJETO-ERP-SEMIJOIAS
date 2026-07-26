const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Carrega as configurações padrões do Metro do Expo
const config = getDefaultConfig(__dirname);

// Estende a configuração com o NativeWind integrando o CSS global
module.exports = withNativeWind(config, { input: "./global.css" });
