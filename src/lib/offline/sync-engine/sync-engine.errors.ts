import { ErrorClassification } from "./sync-engine.types";

/**
 * Classifica um erro ocorrido durante a tentativa de sincronização de uma mutação.
 * Função pura e determinística.
 * 
 * Classificação:
 * - RETRYABLE: Falhas transitórias (rede, timeout, 5xx, 429). Devem sofrer retry com backoff.
 * - CONFLICT: Conflitos de versão OCC, atividade arquivada/concluída, número de OS duplicado. Não sofrem retry cego.
 * - TERMINAL: Erros de autorização (401/403), violações de validação/constraint, IDs inexistentes.
 *
 * @param error Erro capturado (exceção, PostgrestError, resposta HTTP ou objeto customizado)
 * @returns ErrorClassification
 */
export function classifySyncError(error: unknown): ErrorClassification {
  if (!error) {
    return {
      category: "TERMINAL",
      message: "Erro desconhecido ou nulo",
      originalError: error,
    };
  }

  // Extração de propriedades comuns de erros JS, Supabase/PostgREST ou HTTP
  let message = "";
  let code: string | undefined = undefined;
  let statusCode: number | undefined = undefined;
  let details: string | undefined = undefined;

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
    code = (error as { code?: string }).code;
    statusCode = (error as { status?: number; statusCode?: number }).status ||
                 (error as { status?: number; statusCode?: number }).statusCode;
  } else if (typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    message = typeof errObj.message === "string" ? errObj.message : "";
    code = typeof errObj.code === "string" ? errObj.code : undefined;
    statusCode = typeof errObj.status === "number" ? errObj.status :
                 typeof errObj.statusCode === "number" ? errObj.statusCode : undefined;
    details = typeof errObj.details === "string" ? errObj.details : undefined;

    // Supabase RPCs muitas vezes retornam objeto estruturado em data ou error
    if (!message && typeof errObj.error === "string") {
      message = errObj.error;
    }
  }

  const lowerMsg = message.toLowerCase();
  const lowerCode = (code || "").toLowerCase();
  const lowerDetails = (details || "").toLowerCase();

  // =========================================================================
  // 1. CONFLICT
  // =========================================================================
  // Conflito OCC (versão divergente), estados terminais de ciclo de vida ou duplicidades de negócio
  if (
    code === "CONCURRENT_MODIFICATION" ||
    code === "ACTIVITY_ARCHIVED" ||
    code === "ACTIVITY_CLOSED" ||
    code === "ACTIVITY_ALREADY_CANCELLED" ||
    code === "ACTIVITY_CANCELLED" ||
    code === "CANNOT_CANCEL_COMPLETED" ||
    code === "ORDER_NUMBER_DUPLICATE" ||
    code === "SESSION_OWNERSHIP_MISMATCH" ||
    code === "SESSION_ACTIVITY_MISMATCH" ||
    code === "INSUFFICIENT_STOCK" ||
    code === "NON_MONOTONIC_PROGRESS" ||
    lowerMsg.includes("concurrent_modification") ||
    lowerMsg.includes("activity_archived") ||
    lowerMsg.includes("activity_closed") ||
    lowerMsg.includes("order_number_duplicate") ||
    lowerMsg.includes("saldo insuficiente") ||
    lowerMsg.includes("insufficient stock") ||
    lowerMsg.includes("não pode ser inferior ao progresso anterior") ||
    lowerMsg.includes("atividade cancelada") ||
    statusCode === 409
  ) {
    return {
      category: "CONFLICT",
      code: code || (
        lowerMsg.includes("saldo insuficiente") || lowerMsg.includes("insufficient stock")
          ? "INSUFFICIENT_STOCK"
          : lowerMsg.includes("não pode ser inferior ao progresso anterior")
          ? "NON_MONOTONIC_PROGRESS"
          : lowerMsg.includes("atividade cancelada")
          ? "ACTIVITY_CANCELLED"
          : "CONFLICT"
      ),
      message: message || "Conflito detectado na sincronização",
      statusCode: statusCode || 409,
      originalError: error,
    };
  }

  // =========================================================================
  // 2. RETRYABLE (Transitório / Rede / Servidor / Rate Limit)
  // =========================================================================
  // Status HTTP específicos de retry
  if (
    statusCode === 429 || // Too Many Requests (Rate limit)
    statusCode === 500 || // Internal Server Error
    statusCode === 502 || // Bad Gateway
    statusCode === 503 || // Service Unavailable
    statusCode === 504 || // Gateway Timeout
    statusCode === 0      // Network failure / fetch aborted
  ) {
    return {
      category: "RETRYABLE",
      code: code || `HTTP_${statusCode}`,
      message: message || `Erro temporário de servidor (HTTP ${statusCode})`,
      statusCode,
      originalError: error,
    };
  }

  // Erros de conexão de rede, fetch, abort, timeout ou DNS
  if (
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("network error") ||
    lowerMsg.includes("networkrequestfailed") ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("aborted") ||
    lowerMsg.includes("connection refused") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("load failed") ||
    lowerCode.includes("aborterror") ||
    lowerCode.includes("timeout") ||
    lowerCode === "pgrst000" // PostgREST connection error
  ) {
    return {
      category: "RETRYABLE",
      code: code || "NETWORK_ERROR",
      message: message || "Falha transitória de conectividade ou rede",
      statusCode,
      originalError: error,
    };
  }

  // =========================================================================
  // 3. TERMINAL (Não-recuperável / Rejeição lógica ou de segurança)
  // =========================================================================
  // Autenticação e Autorização (401, 403, 42501 permission denied)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    code === "42501" || // PostgreSQL insufficient_privilege
    code === "INSUFFICIENT_PERMISSIONS" ||
    lowerMsg.includes("permission denied") ||
    lowerMsg.includes("unauthorized") ||
    lowerMsg.includes("forbidden") ||
    lowerMsg.includes("jwt expired")
  ) {
    return {
      category: "TERMINAL",
      code: code || `AUTH_${statusCode || 403}`,
      message: message || "Permissão negada ou autenticação inválida",
      statusCode: statusCode || 403,
      originalError: error,
    };
  }

  // Entidade não encontrada (404, P0002)
  if (
    statusCode === 404 ||
    code === "P0002" ||
    code === "ACTIVITY_NOT_FOUND" ||
    lowerMsg.includes("activity not found") ||
    lowerMsg.includes("não encontrada")
  ) {
    return {
      category: "TERMINAL",
      code: code || "NOT_FOUND",
      message: message || "Recurso não encontrado",
      statusCode: statusCode || 404,
      originalError: error,
    };
  }

  // Violações de constraint, schema ou tipos inválidos no PostgreSQL (códigos 23xxx e 22xxx)
  // Exemplos: 23505 (unique_violation que não é conflito OCC), 23502 (not_null_violation), 23503 (fk violation), 23514 (check_violation)
  if (
    code?.startsWith("23") ||
    code?.startsWith("22") ||
    lowerMsg.includes("constraint") ||
    lowerMsg.includes("violates") ||
    lowerDetails.includes("constraint")
  ) {
    return {
      category: "TERMINAL",
      code: code || "CONSTRAINT_VIOLATION",
      message: message || "Violação de integridade/constraint no banco de dados",
      statusCode,
      originalError: error,
    };
  }

  // Requisições inválidas no client (400 Bad Request)
  if (statusCode === 400 || lowerMsg.includes("invalid input") || lowerMsg.includes("dados inválidos")) {
    return {
      category: "TERMINAL",
      code: code || "INVALID_DATA",
      message: message || "Dados da requisição inválidos",
      statusCode: 400,
      originalError: error,
    };
  }

  // Fallback seguro: se não foi identificado como transitório ou conflito conhecido,
  // classifica como TERMINAL para evitar looping de retry infinito.
  return {
    category: "TERMINAL",
    code: code || "TERMINAL_ERROR",
    message: message || "Erro não recuperável",
    statusCode,
    originalError: error,
  };
}
