import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;
  private readonly ivLength = 12;
  private readonly saltLength = 16;

  constructor() {}

  /**
   * Valida si un token tiene formato JWT válido
   */
  private isValidJWT(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Verificar que las partes sean base64 válido
      for (const part of parts) {
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(part)) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Genera una clave de encriptación más segura
   */
  private async generateKey(): Promise<CryptoKey> {
    const domain = window.location.hostname;
    const secretKey = environment.encryptionSecret || 'default-secret-key';
    const timestamp = Math.floor(Date.now() / (24 * 60 * 60 * 1000)); // Cambia diariamente

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(domain + secretKey + timestamp),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('auth-salt-v2'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.algorithm, length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encripta datos sensibles con validación
   */
  async encrypt(data: string): Promise<string> {
    try {
      // Validar que los datos no estén vacíos
      if (!data || data.trim().length === 0) {
        console.error('❌ [ENCRYPTION] Datos vacíos para encriptar');
        throw new Error('Datos vacíos para encriptar');
      }

      // Si es un token JWT, validar formato
      if (data.includes('.') && this.isValidJWT(data)) {
        console.log('🔍 [ENCRYPTION] Token JWT válido detectado');
      }

      const key = await this.generateKey();
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

      const encrypted = await crypto.subtle.encrypt(
        { name: this.algorithm, iv },
        key,
        new TextEncoder().encode(data)
      );

      const encryptedArray = new Uint8Array(encrypted);
      const result = new Uint8Array(iv.length + encryptedArray.length);
      result.set(iv);
      result.set(encryptedArray, iv.length);

      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('❌ [ENCRYPTION] Error encriptando datos:', error);
      return data; // Fallback a texto plano si falla la encriptación
    }
  }

  /**
   * Desencripta datos sensibles con validación
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      // Validar que los datos no estén vacíos
      if (!encryptedData || encryptedData.trim().length === 0) {
        console.error('❌ [ENCRYPTION] Datos vacíos para desencriptar');
        throw new Error('Datos vacíos para desencriptar');
      }

      const key = await this.generateKey();
      const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

      const iv = data.slice(0, this.ivLength);
      const encrypted = data.slice(this.ivLength);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.algorithm, iv },
        key,
        encrypted
      );

      const result = new TextDecoder().decode(decrypted);

      // Validar resultado desencriptado
      if (!result || result.trim().length === 0) {
        console.error('❌ [ENCRYPTION] Resultado desencriptado vacío');
        throw new Error('Resultado desencriptado vacío');
      }

      return result;
    } catch (error) {
      console.error('❌ [ENCRYPTION] Error desencriptando datos:', error);
      return encryptedData; // Fallback al texto original si falla la desencriptación
    }
  }

  /**
   * Encripta un objeto completo
   */
  async encryptObject(obj: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(obj);
      return this.encrypt(jsonString);
    } catch (error) {
      console.error('❌ [ENCRYPTION] Error encriptando objeto:', error);
      return JSON.stringify(obj); // Fallback sin encriptar
    }
  }

  /**
   * Desencripta un objeto completo
   */
  async decryptObject(encryptedData: string): Promise<any> {
    try {
      const decryptedString = await this.decrypt(encryptedData);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('❌ [ENCRYPTION] Error desencriptando objeto:', error);
      return null;
    }
  }

  /**
   * Verifica si los datos están encriptados
   */
  isEncrypted(data: string): boolean {
    try {
      // Intentar decodificar base64
      const decoded = atob(data);
      // Verificar que tenga el formato esperado (IV + datos encriptados)
      return decoded.length > this.ivLength;
    } catch {
      return false;
    }
  }
}
