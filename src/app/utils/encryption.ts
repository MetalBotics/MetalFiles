// Client-side encryption utilities using Web Crypto API

export class FileEncryption {  public static isCryptoAvailable(): boolean {
    return typeof window !== 'undefined' && 
           window.crypto && 
           window.crypto.subtle && 
           typeof window.crypto.subtle.generateKey === 'function';
  }

  private static ensureCryptoAvailable(): void {
    if (!this.isCryptoAvailable()) {
      throw new Error('Web Crypto API is not available. Please ensure you are running in a secure context (HTTPS) and your browser supports the Web Crypto API.');
    }
  }

  private static async generateKey(): Promise<CryptoKey> {
    this.ensureCryptoAvailable();
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private static async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    this.ensureCryptoAvailable();
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  public static async encryptFile(file: File): Promise<{
    encryptedData: ArrayBuffer;
    key: string;
    iv: Uint8Array;
    salt: Uint8Array;
  }> {
    try {
      this.ensureCryptoAvailable();
      
      // Generate a random password for this file
      const password = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Generate salt and IV
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Derive key from password
      const cryptoKey = await this.deriveKeyFromPassword(password, salt);

      // Read file as array buffer
      const fileBuffer = await file.arrayBuffer();      // Encrypt the file
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        cryptoKey,
        fileBuffer
      );

      return {
        encryptedData,
        key: password,
        iv,
        salt,
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt file');
    }
  }
  public static async decryptFile(
    encryptedData: ArrayBuffer,
    password: string,
    iv: Uint8Array,
    salt: Uint8Array
  ): Promise<ArrayBuffer> {
    try {
      this.ensureCryptoAvailable();
      
      // Derive key from password
      const cryptoKey = await this.deriveKeyFromPassword(password, salt);      // Decrypt the data
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        cryptoKey,
        encryptedData
      );

      return decryptedData;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt file');
    }
  }

  public static async encryptMetadata(
    metadata: { fileName: string; size: number; type: string },
    key: string,
    salt: Uint8Array
  ): Promise<{ encryptedMetadata: ArrayBuffer; iv: Uint8Array }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await this.deriveKeyFromPassword(key, salt);
    
    const encoder = new TextEncoder();
    const metadataBuffer = encoder.encode(JSON.stringify(metadata));
      const encryptedMetadata = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      cryptoKey,
      metadataBuffer
    );

    return { encryptedMetadata, iv };
  }

  public static async decryptMetadata(
    encryptedMetadata: ArrayBuffer,
    key: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<{ fileName: string; size: number; type: string }> {
    const cryptoKey = await this.deriveKeyFromPassword(key, salt);
      const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      cryptoKey,
      encryptedMetadata
    );

    const decoder = new TextDecoder();
    const metadataJson = decoder.decode(decryptedBuffer);
    return JSON.parse(metadataJson);
  }
}
