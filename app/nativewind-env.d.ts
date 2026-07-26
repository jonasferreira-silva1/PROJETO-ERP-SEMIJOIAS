/// <reference types="nativewind/types" />

// Declaração de tipo para permitir importação direta de arquivos CSS (NativeWind) no TypeScript
declare module "*.css" {
  const content: any;
  export default content;
}
