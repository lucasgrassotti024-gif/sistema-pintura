# AGENTS.md — REGRAS ARQUITETURAIS E OPERACIONAIS PERMANENTES

Este arquivo é a **Memória Arquitetural Permanente** do **Sistema de Pintura Industrial**.
Estas regras devem ser respeitadas em **TODA E QUALQUER INTERAÇÃO** de desenvolvimento.

---

## PARTE 1 — DIRETRIZES DE ATUAÇÃO E ESCOPO

### 1. Regra Principal
- **Faça somente o que foi solicitado.**
- Não implemente funcionalidades, melhorias, refatorações ou alterações adicionais por iniciativa própria.
- Se identificar algo importante fora do escopo: (1) explique o que identificou; (2) justifique; (3) aguarde autorização; (4) somente então implemente.

### 2. Não Inventar Regras de Negócio
- Não invente regras nem assuma o funcionamento de operações indefinidas (estoque, consumo, cronograma, progresso, etc.).
- Na dúvida sobre regras de negócio: **pergunte antes**.

### 3. Uma Tarefa Principal por Vez
- Trabalhe em uma única frente controlável por vez. Não misture múltiplos módulos ou alterações massivas no mesmo passo.

### 4. Método de Desenvolvimento Obrigatório
Sempre siga o ciclo:
$$\text{INVESTIGAR} \longrightarrow \text{IDENTIFICAR CAUSA} \longrightarrow \text{PROPOR SOLUÇÃO} \longrightarrow \text{VALIDAR ARQUITETURA} \longrightarrow \text{IMPLEMENTAR} \longrightarrow \text{TESTAR} \longrightarrow \text{VALIDAR BUILD}$$
- **Postura Crítica:** Se uma proposta do usuário apresentar risco técnico, inconsistência ou solução inferior, **não obedeça cegamente**. Aponte os riscos e proponha a melhor alternativa.

### 5. Reutilização e Não-Duplicação
- Antes de criar componentes, hooks, services, helpers, tabelas ou permissões, **verifique se já existe algo equivalente**.
- Reutilize funções e componentes existentes. Evite duplicação de lógica e código monolítico.

---

## PARTE 2 — REGRAS ARQUITETURAIS PERMANENTES

### 1. Fonte de Verdade
- O banco PostgreSQL real é a fonte de verdade para o estado atual do banco. O código-fonte e as migrations existentes são a fonte de verdade para a implementação e o histórico das alterações. Nunca assumir que uma migration foi aplicada apenas porque ela existe no repositório. Quando necessário, verificar o estado real do banco.
- Nunca invente tabelas, colunas, chaves estrangeiras, RPCs ou permissões. Antes de utilizar uma estrutura do banco, verificar o schema real quando essa informação for relevante.
- Sempre revise o `AGENTS.md` antes de propor qualquer intervenção técnica.

### 2. Banco de Dados e Migrations
- **Autorização Prévia:** NUNCA aplique nem execute migrations no Supabase sem autorização explícita do usuário.
- **Rastreabilidade de Migrations:** Sempre verifique a lista e o último número de migration antes de criar uma nova. Nunca duplique números de migration.
- **Sem Alterações Silenciosas:** Nenhuma modificação em schema, RLS, triggers ou índices pode ser feita sem apresentação prévia.

### 3. Segurança e Autorização (RLS e Grants)
- **RLS Obrigatório:** Toda tabela exposta ao cliente deve possuir Row Level Security habilitado e políticas estritas. Objetos do Supabase Storage devem possuir policies adequadas em `storage.objects`, respeitando o princípio do menor privilégio.
- **Validação no Banco:** A autorização nunca depende apenas da interface frontend. Operações sensíveis são protegidas via RLS e RPCs com `SECURITY DEFINER`.
- **Search Path Seguro:** Toda função PostgreSQL com `SECURITY DEFINER` deve definir explicitamente `SET search_path = public, auth, pg_temp`.
- **Catálogo de Permissões Híbrido:** A autorização deve consultar a função `public.has_permission(p_permission text)`, respeitando o status ativo, o cargo em `role_base_permissions` e overrides em `user_custom_permissions`.
- **Menor Privilégio:** Não amplie permissões de forma genérica apenas para contornar bloqueios operacionais.

### 4. Resiliência de Dados e Tratamento de Erros
- **Dados Reais:** Nunca utilize mocks ou fallbacks silenciosos para mascarar erros do banco ou simular funcionamento.
- **Diagnóstico Transparente:** Se uma query, Storage ou RPC falhar, o erro real retornado pelo Supabase deve ser registrado e tratado adequadamente.
- **$0 \neq \text{Sem Informação}$:** Um valor zero (ex: `0 L`, `0%`) representa um valor real aferido. Ausência de dado deve ser explicitamente representada como nula/desconhecida.

### 5. Auditoria, Rastreabilidade e Ciclo de Vida
- **Auditoria Operacional:** Toda alteração relevante (criação, edição, avanço de progresso, cancelamento, arquivamento, registro fotográfico) deve ser registrada em `public.activity_audit_logs` utilizando estritamente as colunas reais do schema.
- **Distinção Operacional:**
  - **Cancelamento:** Interrupção motivada da atividade via RPC `cancel_activity`, exigindo justificativa e permissão `atividades.cancelar`. Mantém imutável o escopo anterior.
  - **Arquivamento (Soft Delete):** Remoção da tela operacional ativa mantendo a atividade no histórico via RPC `archive_activity`, preenchendo `archived_at` e exigindo permissão `atividades.arquivar`.
  - **Exclusão Física (`DELETE`):** Proibida para entidades operacionais históricas.

### 6. Imutabilidade Histórica
- Registros que representam marcos históricos (auditorias, apontamentos de consumo, registros fotográficos de evolução) devem ser **imutáveis**.
- O percentual de progresso e demais dados de contexto devem ser congelados no momento do registro. Nunca recalcule retrospectivamente snapshots históricos.

### 7. Identidade Visual Permanente: Dark Premium Industrial
- **Paleta:** Fundo escuro/grafite (`#0a0e17`, `#0f172a`), bordas sutis (`white/10`), texto claro (`slate-100` / `slate-200`) e destaque em verde esmeralda industrial (`#10b981`).
- **Padrão:** Badges e identificadores em fonte mono, iluminação/glow discreto, profundidade com sombras escuras.
- **Consistência:** Proibido reintroduzir cards brancos, modais claros ou dropdowns descontextualizados do tema Dark. Não faça redesign global sem autorização.

### 8. Qualidade de Código e Validação
- **TypeScript Rigoroso:** Tipagem estrita em todas as camadas. Não utilize `any` nem mascare erros de tipagem.
- **Validação de Build:** Após alterações relevantes, execute e valide `npm run build`.
- **Comunicação Concisa:** Ao finalizar uma tarefa, relate objetivamente: o que foi alterado, arquivos modificados, decisões tomadas e o que foi validado.

### 9. Governança da Documentação Permanente
- Este arquivo deve conter exclusivamente **diretrizes perenes** do projeto.
- NÃO registrar nele pendências efêmeras de chat, tarefas pontuais de sessão ou dados voláteis.
- Sempre que uma nova decisão arquitetural com caráter permanente for consolidada, ela deve ser formalizada neste documento.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
