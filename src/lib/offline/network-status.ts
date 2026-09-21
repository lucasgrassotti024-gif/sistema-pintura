/**
 * Utilitário de detecção de conectividade e resiliência de rede.
 * Não confia unicamente em navigator.onLine, permitindo testes
 * de disponibilidade efetiva das chamadas de API.
 */

export interface NetworkState {
  isOnline: boolean;
  lastOnlineAt?: string;
  lastOfflineAt?: string;
}

/**
 * Verifica se o ambiente do cliente tem sinal de conexão do navegador.
 * Seguro para SSR (retorna true por padrão no servidor).
 */
export function isBrowserOnline(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

/**
 * Determina se um erro capturado em uma requisição ao Supabase
 * representa indisponibilidade de rede, timeout, conexão recusada ou offline.
 */
export function isNetworkOrOfflineError(error: unknown): boolean {
  if (!error) return false;

  // 1. Se o navegador já declarou offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  // 2. Erros de fetch do browser (TypeError: Failed to fetch, NetworkError, etc.)
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return true;
  }

  // 3. Inspeção de mensagens de erro comuns de rede / timeout
  if (typeof error === "object" && error !== null) {
    const errObj = error as { message?: string; code?: string; name?: string; status?: number };
    const msg = (errObj.message || "").toLowerCase();
    const name = (errObj.name || "").toLowerCase();

    if (
      msg.includes("failed to fetch") ||
      msg.includes("network error") ||
      msg.includes("networkrequestfailed") ||
      msg.includes("timeout") ||
      msg.includes("aborted") ||
      msg.includes("connection refused") ||
      msg.includes("offline") ||
      msg.includes("econnrefused") ||
      name.includes("aborterror") ||
      errObj.status === 0 ||
      errObj.status === 503 ||
      errObj.status === 504
    ) {
      return true;
    }
  }

  return false;
}
