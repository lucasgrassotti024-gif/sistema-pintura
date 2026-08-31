# Visão Geral da Arquitetura (Overview)

## 1. Objetivo do Sistema
O sistema tem como objetivo gerenciar e controlar de forma precisa e integrada as operações de pintura industrial e predial, incluindo planejamento de atividades, programação operacional, controle de catálogo técnico de materiais, movimentação e saldo real de estoque, central de alertas/notificações e integração com inteligência artificial para apoio a decisões operacionais.

---

## 2. Visão Geral da Arquitetura
A arquitetura do sistema foi projetada seguindo os princípios de modularidade, desacoplamento e isolamento de responsabilidades. O sistema é unificado, eliminando a necessidade de subsistemas externos e garantindo que toda a operação ocorra em um ambiente centralizado, confiável e rastreável.

---

## 3. Tecnologias Escolhidas
- **Frontend & Backend Integrado:** Next.js (App Router)
- **Linguagem:** TypeScript (tipagem estrita ponta a ponta)
- **Estilização:** Tailwind CSS
- **Banco de Dados & BaaS:** Supabase / PostgreSQL
- **Integração de IA:** APIs de LLM executadas com segurança no servidor

---

## 4. Princípio de Modularidade
O sistema adota uma divisão estrita por módulos funcionais (ex.: atividades, programação, materiais, estoque, notificações, IA, dashboard). Cada módulo encapsula:
- Componentes de interface dedicados;
- Regras de validação e cálculos determinísticos;
- Serviços de comunicação e persistência;
- Tipos de domínio próprios.

Módulos não acessam diretamente as regras internas de outros módulos; as integrações ocorrem por interfaces de serviços e tipos padronizados.

---

## 5. Separação de Responsabilidades
A aplicação é organizada em camadas estritas:
1. **Interface (UI / Pages & Components):** Responsável exclusivamente pela exibição e captura de eventos do usuário. Não contém lógica de negócio complexa ou cálculos de engenharia inline.
2. **Regras de Negócio (Rules):** Funções puras e determinísticas para validações, cálculo de consumo teórico, regras de prazos e restrições operacionais.
3. **Serviços (Services):** Camada de integração com o Supabase, banco de dados e APIs externas.
4. **Banco de Dados (Database / Migrations):** PostgreSQL gerenciado via Supabase com rastreabilidade total de alterações estruturais e histórico de auditoria.

---

## 6. Expansão Futura para Outras Áreas
A estrutura modular e o modelo de domínio foram desenhados para que, no momento adequado, novas frentes e áreas operacionais possam ser acopladas sem necessidade de refatoração da base central do projeto.
