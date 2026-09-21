/**
 * Configuração de cálculo de retry exponencial com jitter
 */
export interface RetryConfig {
  baseDelayMs: number; // Intervalo base inicial (padrão: 1000ms)
  maxDelayMs: number;  // Teto máximo de espera (padrão: 30000ms)
  jitterRatio: number; // Fator de aleatoriedade para evitar thundering herd (padrão: 0.25)
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterRatio: 0.25,
};

/**
 * Calcula o atraso em milissegundos para a próxima tentativa utilizando
 * recuo exponencial (exponential backoff) com jitter.
 *
 * Fórmula:
 * delay = min(maxDelayMs, baseDelayMs * (2 ^ retryCount))
 * jitter = delay * jitterRatio * random(-1, 1)
 * resultado = max(baseDelayMs, delay + jitter)
 *
 * @param retryCount Quantidade de tentativas anteriores (0, 1, 2, ...)
 * @param config Configuração de retry
 * @returns Tempo de espera em milissegundos
 */
export function calculateNextRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  if (retryCount < 0) retryCount = 0;

  // 2 ^ retryCount (limitado a 10 para evitar overflow numérico)
  const safeExponent = Math.min(retryCount, 10);
  const exponentialDelay = config.baseDelayMs * Math.pow(2, safeExponent);

  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Aplica jitter proporcional (-jitterRatio .. +jitterRatio)
  const jitterFactor = (Math.random() * 2 - 1) * config.jitterRatio;
  const withJitter = Math.round(cappedDelay + cappedDelay * jitterFactor);

  // Garante limite inferior não menor que a metade da base e não superior ao teto com jitter
  return Math.max(Math.round(config.baseDelayMs * 0.5), withJitter);
}

/**
 * Calcula o timestamp ISO da próxima tentativa com base no delay
 *
 * @param retryCount Quantidade de tentativas anteriores
 * @param now Data/hora base de cálculo (padrão: new Date())
 * @param config Configuração de retry
 * @returns String ISO (ex: "2026-09-17T19:30:00.000Z")
 */
export function calculateNextRetryTimestamp(
  retryCount: number,
  now: Date = new Date(),
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): string {
  const delayMs = calculateNextRetryDelay(retryCount, config);
  return new Date(now.getTime() + delayMs).toISOString();
}

/**
 * Verifica se a mutação já atingiu o limite de tentativas.
 *
 * @param retryCount Tentativas já executadas
 * @param maxRetries Limite máximo de retries configurado
 */
export function hasExceededMaxRetries(
  retryCount: number,
  maxRetries: number
): boolean {
  return retryCount >= maxRetries;
}
