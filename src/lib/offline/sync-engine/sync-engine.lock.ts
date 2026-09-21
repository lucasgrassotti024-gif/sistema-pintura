/**
 * Estratégia de Lock para sincronização exclusiva entre abas/instâncias.
 *
 * Utiliza preferencialmente a Web Locks API (`navigator.locks`) quando disponível
 * no navegador moderno. Fornece fallback seguro baseado em storage/in-memory para
 * ambientes que não suportam Web Locks ou durante testes SSR/Node.js.
 */

export const SYNC_ENGINE_LOCK_NAME = "sistema_pintura_sync_engine_lock";

export interface SyncLockManager {
  /**
   * Tenta adquirir o lock e executar o callback exclusivo.
   * Retorna false se o lock já estiver ocupado por outra instância/aba.
   *
   * @param fn Função a ser executada enquanto o lock estiver ativo
   * @returns true se executou a função com o lock; false se lock estava indisponível
   */
  withLock<T>(fn: () => Promise<T>): Promise<{ executed: boolean; result?: T }>;
  
  /**
   * Informa se há suporte nativo à Web Locks API
   */
  hasNativeSupport(): boolean;
}

class DefaultSyncLockManager implements SyncLockManager {
  private inMemoryLocked = false;
  private readonly fallbackStorageKey = "sistema_pintura_sync_lock_ts";
  private readonly fallbackTtlMs = 45000; // 45 segundos para liberar lock órfão de aba fechada abruptamente

  hasNativeSupport(): boolean {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.locks !== "undefined" &&
      typeof navigator.locks.request === "function"
    );
  }

  async withLock<T>(fn: () => Promise<T>): Promise<{ executed: boolean; result?: T }> {
    // 1. Web Locks API (Nativo do navegador - Suporte Chrome, Edge, Safari 15.4+, Firefox 96+)
    if (this.hasNativeSupport()) {
      try {
        let executed = false;
        let result: T | undefined = undefined;

        await navigator.locks.request(
          SYNC_ENGINE_LOCK_NAME,
          { ifAvailable: true }, // Não bloqueia indefinidamente: se indisponível, sai imediatamente
          async (lock) => {
            if (!lock) {
              // Outra aba já detém o lock
              executed = false;
              return;
            }

            executed = true;
            result = await fn();
          }
        );

        return { executed, result };
      } catch (err) {
        console.warn("[SyncLock] Erro ao solicitar Web Lock, usando fallback:", err);
      }
    }

    // 2. Fallback de Lock: localStorage + memória (Para navegadores legados ou ambientes sem Web Locks)
    return this.withFallbackLock(fn);
  }

  private async withFallbackLock<T>(
    fn: () => Promise<T>
  ): Promise<{ executed: boolean; result?: T }> {
    if (this.inMemoryLocked) {
      return { executed: false };
    }

    // Se temos acesso a localStorage (navegador)
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const now = Date.now();
      const existingLock = localStorage.getItem(this.fallbackStorageKey);

      if (existingLock) {
        const lockTime = parseInt(existingLock, 10);
        // Se ainda estiver dentro do TTL, lock pertence a outra aba
        if (!isNaN(lockTime) && now - lockTime < this.fallbackTtlMs) {
          return { executed: false };
        }
      }

      // Adquire lock gravando timestamp
      localStorage.setItem(this.fallbackStorageKey, now.toString());
    }

    this.inMemoryLocked = true;
    try {
      const result = await fn();
      return { executed: true, result };
    } finally {
      this.inMemoryLocked = false;
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.removeItem(this.fallbackStorageKey);
      }
    }
  }
}

export const syncLockManager: SyncLockManager = new DefaultSyncLockManager();
