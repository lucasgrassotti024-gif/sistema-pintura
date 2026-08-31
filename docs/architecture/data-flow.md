# Fluxo de Dados (Data Flow)

Este documento descreve conceitualmente como uma informação trafega e é processada através das camadas do sistema, garantindo consistência, validação e integridade.

---

## 1. Fluxo Conceitual Padrão

```text
[ Usuário ]
    │
    ▼
[ Interface (Componentes / Telas) ]
    │ (Dispara evento / Submete formulário)
    ▼
[ Hook / Controlador do Módulo ]
    │ (Encaminha payload)
    ▼
[ Regras de Negócio (Rules) ]
    │ (Validações estritas, cálculos determinísticos, verificações de integridade)
    ▼
[ Serviço (Services) ]
    │ (Executa chamada ao Supabase / PostgreSQL ou API segura)
    ▼
[ Banco de Dados (PostgreSQL / Supabase) ]
    │ (Persiste dados, aciona triggers de auditoria se aplicável)
    ▼
[ Retorno do Serviço ]
    │ (Sucesso ou erro estruturado)
    ▼
[ Atualização de Estado / Reatividade ]
    │
    ▼
[ Atualização da Interface (Feedback visual ao Usuário) ]
```

---

## 2. Descrição das Etapas

1. **Ação do Usuário:** O usuário interage com a interface (clica em um botão, preenche um formulário, seleciona um filtro).
2. **Interface (UI):** O componente captura o evento e delega a ação para o hook do módulo correspondente, sem executar lógica de negócio inline.
3. **Regras de Negócio (`rules/`):** Os dados são submetidos a funções puras de validação (ex.: verificar consistência de datas, checar consumo válido, validar formato técnico). Se inválidos, o fluxo é interrompido com erro explicativo.
4. **Camada de Serviço (`services/`):** Executa a transação ou requisição ao banco de dados (Supabase) de forma padronizada e segura.
5. **Persistência no Banco:** O PostgreSQL valida constraints, persiste os dados e registra histórico de rastreabilidade.
6. **Resposta e Atualização:** A interface recebe a confirmação e atualiza a visualização reativamente (estado local, lista ou dados em tempo real), fornecendo feedback claro e sem ambiguidades ao usuário.
