# Regras de Negócio: Atividades (Activities)

Este documento registra as diretrizes operacionais e regras de negócio para o módulo de Atividades, em conformidade com as regras gerais do [AGENTS.md](file:///c:/Users/lucas/OneDrive/Desktop/Pastas/Sistema-Pintura/AGENTS.md).

---

## 1. Criação e Identificação da Atividade

### 1.1 Identificadores Operacionais (Nota e Tag)
- **Nota (Ordem de Serviço / Nota de Manutenção):** Código identificador de origem do serviço.
- **Tag:** Identificador do equipamento, tubulação, estrutura ou componente que receberá o tratamento de pintura.
- **Múltiplas Tags:** Uma mesma atividade/serviço pode estar associada a uma ou múltiplas Tags simultaneamente.

### 1.2 Localização Física e Atribuição
A identificação física da atividade contempla a seguinte hierarquia:
- **Área:** Grande setor operacional da planta/instalação.
- **Local:** Subsetor, pavimento, sala ou coordenada específica dentro da Área.
- **Equipamento / Estrutura:** O item físico específico objeto da intervenção.
- **Opção "Outro" para Informações Físicas:** Quando uma Área, Local ou Equipamento/Estrutura não estiver previamente cadastrado nas listas padrão do sistema, deve ser disponibilizada a opção **"Outro"**, permitindo a especificação manual do novo valor no ato do registro sem travar o cadastro.

---

## 2. Programação Operacional e Ciclo Temporal

### 2.1 Programação
- A atividade deve possuir planejamento temporal de execução (datas previstas).
- [DECISÃO PENDENTE]: Definição se a programação trabalhará com granularidade por turno/horário ou apenas por data (dia/semana).

### 2.2 Atividades Atrasadas e Reprogramação
- Uma atividade é considerada atrasada quando o prazo planejado expira e o status não é concluído.
- [DECISÃO PENDENTE]: Regra exata para reprogramação de datas (se a nova data substitui a anterior mantendo log ou se cria um registro explícito de revisão de cronograma).

### 2.3 Retirada da Programação após o Período
- Atividades que ultrapassam a janela temporal de sua programação devem ter seu comportamento de exibição ajustado na grade operacional ativa.
- [DECISÃO PENDENTE]: Definição do critério exato para retirada automática da grade da semana/dia (se passa para fila de pendências ou se exige ação manual do programador).

---

## 3. Status e Progresso

### 3.1 Status da Atividade
- A atividade transita por estados bem definidos durante seu ciclo de vida.
- [DECISÃO PENDENTE]: Lista exata dos status permitidos e regras de transição (ex.: *Planejada, Em Andamento, Pausada, Concluída, Cancelada*).

### 3.2 Progresso
- O percentual de progresso reflete o avanço físico da atividade.
- **Regra Fundamental:** O percentual de progresso **NUNCA** deve ser assumido como percentual de consumo de materiais (Regra 15 do AGENTS.md).

---

## 4. Consumo Real e Atualização de Estoque

### 4.1 Registro de Consumo Real
- O consumo de tintas, solventes e insumos deve ser registrado separadamente por apontamento físico real (quantidade efetivamente aberta/aplicada).
- **Não assumir:** quantidade planejada = quantidade consumida.

### 4.2 Atualização do Estoque
- O saldo físico em estoque é deduzido apenas a partir do registro formal de consumo ou movimentação de saída.
- [DECISÃO PENDENTE]: Definição do momento exato da dedução física (se no apontamento diário da atividade ou na requisição de saída do almoxarifado).

---

## 5. Conclusão, Cancelamento e Preservação de Dados

### 5.1 Conclusão
- A conclusão de uma atividade requer a finalização de todas as etapas e validações técnicas pertinentes.
- [DECISÃO PENDENTE]: Definição se a conclusão exige validação obrigatória de inspeção/checklist ou apenas preenchimento do responsável.

### 5.2 Cancelamento e Não Exclusão
- Atividades canceladas são marcadas com status de cancelamento e justificativa.
- **Regra Fundamental (Regra 11 do AGENTS.md):** É vedada a exclusão física definitiva de atividades cadastradas. Todos os dados operacionais devem permanecer arquivados/inativados.

---

## 6. Histórico, Rastreabilidade e Auditoria

### 6.1 Histórico de Atividades Antigas
- Todas as atividades executadas e encerradas permanecem disponíveis para consulta em base histórica para fins de garantia técnica, relatórios e auditoria.

### 6.2 Rastreabilidade de Alterações
- Conforme as Regras 12 e 34 do AGENTS.md, qualquer criação ou alteração em uma atividade deve obrigatoriamente registrar:
  - **Quem realizou** a alteração;
  - **Quando realizou** (data e hora exata);
  - **O que foi alterado** (campo, valor anterior e novo valor).
