# ADR 001: Adoção de Next.js, TypeScript, Tailwind CSS e Supabase (PostgreSQL)

## Status
Aprovado

## Contexto
O projeto consiste em um sistema de controle e gestão para operações de pintura industrial e predial. O sistema exige:
- Interface reativa, rápida e de alta usabilidade;
- Tipagem estrita e código previsível;
- Camada segura no servidor para chamadas de IA e operações restritas;
- Banco de dados relacional robusto com histórico, integridade referencial e suporte a tempo real;
- Capacidade de expansão modular.

---

## Decisão

Adotar a seguinte combinação de tecnologias:
1. **Next.js com App Router:** Proporciona unificação entre frontend reativo e rotas de backend (Route Handlers/Server Actions), permitindo proteger chaves de API e isolar lógicas sensíveis sem a necessidade de manter múltiplos projetos separados.
2. **TypeScript:** Garante tipagem estrita de ponta a ponta, reduzindo bugs em tempo de execução e facilitando a manutenção e refatoração assistida por IA.
3. **Tailwind CSS:** Fornece um sistema de estilização rápido, consistente e sem sobrecarga de classes arbitrárias ou arquivos CSS monolíticos.
4. **Supabase com PostgreSQL:** Oferece um banco de dados relacional maduro, suporte a migrações versionadas, flexibilidade para consultas complexas, recursos de auditoria e capacidades de sincronização em tempo real.

---

## Consequências
- Código organizado e centralizado em um único repositório (*monorepo leve*).
- Segurança no consumo de serviços externos e APIs de Inteligência Artificial.
- Facilidade de deploy, testes e evolução futura para novas áreas operacionais.
