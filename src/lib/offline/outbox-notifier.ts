/**
 * Notificador de eventos da Outbox para desacoplamento e reatividade imediata na UI.
 * 
 * Permite que a camada de UI (hooks) reaja instantaneamente quando operações locais
 * forem adicionadas à Outbox ou alteradas, sem polling contínuo agressivo e sem
 * acoplar a UI ao ciclo de vida interno do Sync Engine.
 */

export type OutboxMutationEventType = "enqueued" | "updated" | "deleted";

export interface OutboxMutationEvent {
  type: OutboxMutationEventType;
  entityType: string;
  entityId: string;
  mutationId?: string;
  timestamp: string;
}

export type OutboxEventListener = (event: OutboxMutationEvent) => void;

class OutboxEventNotifier {
  private listeners: Set<OutboxEventListener> = new Set();

  /**
   * Inscreve um ouvinte para receber notificações de mudanças na Outbox.
   * Retorna a função de desinscrição.
   */
  subscribe(listener: OutboxEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emite um evento de alteração na fila da Outbox.
   */
  notify(event: OutboxMutationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[OutboxEventNotifier] Erro no listener:", err);
      }
    }
  }
}

export const outboxNotifier = new OutboxEventNotifier();
