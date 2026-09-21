import { isBrowserOnline } from "../network-status";

export type NetworkChangeCallback = (isOnline: boolean) => void;

/**
 * Monitor do estado de rede para o Sync Engine.
 * 
 * Reage a eventos do navegador `window.online` e `window.offline`.
 * Quando volta a ficar online, notifica os ouvintes para acionar o Sync Engine.
 * Quando offline, impede tentativas desnecessárias de rede.
 * Não faz polling agressivo nem cria intervalos contínuos desnecessários.
 */
export class SyncNetworkWatcher {
  private listeners: Set<NetworkChangeCallback> = new Set();
  private isListening = false;
  private onlineHandler = () => this.handleNetworkChange(true);
  private offlineHandler = () => this.handleNetworkChange(false);

  /**
   * Retorna se a rede está atualmente considerada disponível pelo navegador.
   */
  isOnline(): boolean {
    return isBrowserOnline();
  }

  /**
   * Inicia a escuta dos eventos do navegador (online/offline).
   */
  start(): void {
    if (this.isListening || typeof window === "undefined") return;

    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
    this.isListening = true;
  }

  /**
   * Interrompe a escuta dos eventos do navegador.
   */
  stop(): void {
    if (!this.isListening || typeof window === "undefined") return;

    window.removeEventListener("online", this.onlineHandler);
    window.removeEventListener("offline", this.offlineHandler);
    this.isListening = false;
  }

  /**
   * Registra um callback para mudanças de estado de rede.
   * Retorna uma função de cancelamento (unsubscribe).
   */
  subscribe(callback: NetworkChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private handleNetworkChange(online: boolean): void {
    for (const listener of this.listeners) {
      try {
        listener(online);
      } catch (err) {
        console.error("[SyncNetworkWatcher] Erro no listener de rede:", err);
      }
    }
  }
}

export const syncNetworkWatcher = new SyncNetworkWatcher();
