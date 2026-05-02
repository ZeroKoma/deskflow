/**
 * DeskFlow Crypto Utilities
 * Encapsula la lógica de Web Crypto API para AES-GCM (Cifrado Autenticado)
 */
export const cryptoUtils = {
  // Deriva una clave de 256 bits a partir de una contraseña y un salt
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  },

  async encrypt(data, key) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Vector de Inicialización
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    return {
      iv: Array.from(iv),
      content: Array.from(new Uint8Array(encrypted)),
    };
  },

  async decrypt(encryptedData, key) {
    const decoder = new TextDecoder();
    const iv = new Uint8Array(encryptedData.iv);
    const content = new Uint8Array(encryptedData.content);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, content);
    return JSON.parse(decoder.decode(decrypted));
  },

  // Genera una clave aleatoria de 256 bits para la bóveda (Vault Key)
  async generateVaultKey() {
    const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const raw = await crypto.subtle.exportKey("raw", key);
    return new Uint8Array(raw);
  },

  // Importa una clave en bruto para usarla en operaciones de cifrado
  async importVaultKey(raw) {
    return await crypto.subtle.importKey(
      "raw",
      raw,
      "AES-GCM",
      true,
      ["encrypt", "decrypt"]
    );
  },

  // Genera un hash SHA-256 (hex) para identificar contraseñas sin almacenarlas
  async hash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};