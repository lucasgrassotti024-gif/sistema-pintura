# Estrutura de Pastas (Folder Structure)

A estrutura de diretórios do projeto foi definida para garantir organização clara, alta manutenibilidade e isolamento de responsabilidades.

```text
sistema-pintura/
├── AGENTS.md                          # Regras permanentes do projeto
├── docs/                              # Documentação do sistema, decisões e arquitetura
│   ├── architecture/                  # Documentos de visão geral, fluxo e estrutura
│   └── decisions/                     # Registros de Decisão de Arquitetura (ADRs)
├── supabase/                          # Infraestrutura e scripts do banco de dados
│   └── migrations/                    # Scripts SQL de migração versionados e rastreáveis
├── public/                            # Arquivos estáticos (ícones, logos, imagens)
├── tests/                             # Testes unitários e de integração
└── src/
    ├── app/                           # Camada de rotas do Next.js (App Router)
    │   ├── api/                       # Endpoints backend e rotas seguras (Route Handlers)
    │   ├── globals.css                # Estilos globais e tokens do Tailwind CSS
    │   ├── layout.tsx                 # Root layout da aplicação
    │   └── page.tsx                   # Ponto de entrada / página raiz
    ├── components/                    # Componentes reutilizáveis globais (UI, layout, feedback)
    ├── modules/                       # Módulos funcionais de negócio (domínios isolados)
    ├── lib/                           # Clientes centrais (Supabase), utilitários e constantes
    ├── hooks/                         # React hooks globais e compartilhados
    ├── types/                         # Tipagens TypeScript globais e esquemas do banco
    └── config/                        # Configurações gerais da aplicação
```

---

## Responsabilidade de Cada Pasta

- **`docs/`**: Centraliza toda a documentação técnica, fluxos operacionais, regras de negócio e ADRs (*Architecture Decision Records*).
- **`supabase/`**: Guarda migrações estruturais do PostgreSQL, mantendo o histórico e rastreabilidade do banco.
- **`src/app/`**: Responsável unicamente por definir o roteamento e a montagem das páginas através da composição de componentes.
- **`src/components/`**: Contém componentes visuais reutilizáveis (botões, modais, tabelas, cabeçalhos) sem regras de negócio acopladas.
- **`src/modules/`**: Isola o código de cada módulo de negócio (atividades, programação, materiais, estoque, notificações, IA, dashboard). Cada módulo pode conter seus próprios componentes, hooks, regras e serviços.
- **`src/lib/`**: Centraliza clientes de integração (ex.: cliente Supabase no cliente/servidor) e funções utilitárias puras.
- **`src/hooks/`**: Hooks genéricos reutilizáveis entre diferentes módulos.
- **`src/types/`**: Interfaces e tipos TypeScript globais e tipagem gerada do banco de dados.
- **`src/config/`**: Variáveis e parâmetros de configuração estáticos do sistema.
- **`tests/`**: Testes unitários de regras de negócio e testes de integração de serviços.
- **`public/`**: Recursos estáticos servidos diretamente pelo servidor web.
