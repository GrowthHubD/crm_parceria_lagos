# Sistema Gerencial de Agência — Growth Hub (AMS)

---

**Lead responsável:** A definir
**Equipe envolvida:** A definir

---

## 🎯 Nível de Complexidade

**Muito Alta:** sistema interno completo com múltiplos módulos, níveis de permissão, integrações com WhatsApp, agentes IA, financeiro, CRM, kanban e blog interno.

Prazo estimado: **A definir**
Meta interna: **A definir**

---

## 🧠 Resumo do Fluxo

Usuário faz login com seu perfil (sócio, gerente ou operacional) → acessa as abas permitidas conforme seu nível de permissão → dashboard apresenta visão consolidada financeira e operacional da agência → cada módulo opera de forma independente mas conectado ao banco central → dados de clientes, contratos, financeiro, pipeline, CRM e tarefas alimentam o dashboard em tempo real → agente SDR reporta performance dos bots de prospecção → kanban distribui e monitora tarefas por responsável com envio automático via WhatsApp.

---

## 🛠️ Requisitos Técnicos

- Sistema de autenticação com níveis de permissão (sócios, gerentes, operacionais)
- Dashboard com métricas financeiras e operacionais em tempo real
- Módulo de Pipeline com etapas, tags e gestão de leads
- Módulo de Contratos com armazenamento de documentos e alertas de renovação
- Módulo Financeiro com lançamentos, projeções e distribuição entre sócios
- CRM com gerenciamento de conversas e números de WhatsApp da GH
- Módulo de Clientes com cadastro completo e anexo de arquivos (escopo, PRD, contratos)
- Módulo de Agente SDR com painel de métricas dos bots de prospecção IA
- Kanban estilo Notion com filtros por responsável e envio automático de tarefas via WhatsApp
- Blog interno com sistema de tags, busca e visualização em grid
- Sistema de permissões por módulo e por aba (incluindo blog)
- Banco de dados centralizado conectando todos os módulos

---

## 📋 Requisitos Funcionais

### 🏠 Dashboard
- MRR (mensal) e ARR (anual)
- Clientes ativos
- Contratos a vencer em 30 dias
- Receita, despesas e lucro do mês
- A receber e vencidos
- Total do ano até o momento, recebido e a receber
- Crescimento YOY
- Comparativo mensal vs. ano anterior
- Gráfico de crescimento de receita YOY
- Alertas e notificações dos demais módulos
- Funil de prospecção com etapas e quantidade de leads em cada uma (sem atendimento, em atendimento, reuniões, propostas, follow-up)
- Clientes recentes que entraram
- Ticket médio dos contratos ativos
- Taxa de Churn
- Comparativo mensal vs. mês anterior: faturamento geral, margem de lucro com meta ideal, receita por hora, concentração de receita

### 📊 Pipeline
- Visualização das etapas de cada lead
- Adição de novos leads
- Gerenciamento de etapas e tags (quente, frio, ativo, a vencer)
- Categorização e atualização de leads
- Criação e gerenciamento de tags customizadas

### 📄 Contratos
- Tela de gerenciamento com: nome da empresa, recorrência mensal, valor de implementação (se houver), vigência, tipo (mensal ou anual)
- Totais: contratos ativos, a vencer e inativos
- Leitura do contrato armazenado no banco de dados
- Informações completas do cliente vinculado
- Alerta próximo à data de renovação com opção de renovar e se comunicar com o lead diretamente
- Criação de contratos e cadastro de clientes pela própria aba

### 💰 Financeiro
- Total de caixa atual da empresa
- Resumo mensal: entrada total, saída total, lucro total, parcela dos sócios (33,33% cada) e parcela do caixa (10% por sócio)
- Data das transações
- Faturamento geral e do mês
- Despesas do mês
- Lançamentos financeiros completos com: nome, tipo de despesa (infraestrutura, interno, educação etc.), data, tipo de cobrança (mensal/anual), valor, status (pago ou a pagar)
- Projeção de faturamento anual

### 💬 CRM / WhatsApp
- Gerenciamento dos números da GH
- Visualização de conversas por número
- Quantidade de conversas por número
- Filtros: lead quente, frio, aquecido, cliente ativo
- Tagueamento de conversas
- Filtros por classificação para busca rápida

### 👥 Clientes
- Total de clientes, ativos, inativos e contratos a vencer
- Informações por cliente: nome da empresa, CNPJ, responsável, e-mail, início e fim do contrato, dia de pagamento, ID do grupo, telefone, valor mensal
- Edição e exclusão de clientes
- Acesso ao escopo do projeto, PRD, responsáveis e arquivos importantes anexados por cliente

### 🤖 Agente SDR
- Painel de gestão dos agentes SDR (bots IA) ativos na operação
- Métricas de entrada e volume: leads prospectados, mensagens por reunião, total de mensagens, leads novos
- Taxa de resposta, agendamentos feitos, MRR gerado
- Drop-off por etapa e % de leads que não avançaram do SLA configurado
- Impacto no negócio: conversão real, receita atribuída, MRR e ARR do bot, qualidade do lead
- Engajamento inicial: tempo de primeira resposta, leads que recusaram, qualificação dos leads
- Agendamento e show rate: taxa de agendamento, reagendamentos, no-show, cancelamentos
- Filtros por período: hoje, semana, mês e total

### 📋 Kanban
- Gerenciamento de tarefas estilo Notion
- Filtros por sócio e por operacional (gestor de tráfego, gestor de automação, social media)
- Adição de tarefas, marcação como concluídas e lembretes
- Envio automático toda segunda-feira das tarefas da semana e do dia no WhatsApp privado de cada responsável
- Tela de ADM para sócios visualizarem todas as tarefas e o que cada colaborador está fazendo

### 📝 Blog Interno
- Visualização em grid estilo portal de notícias
- Tipos de conteúdo: listas, artigos, guias e estudos
- Título, imagem ilustrativa, sistema de tags e busca
- Categorias já mapeadas: Plugins Claude Code, Antigravity Plugins, Efeitos/Códigos, Sites de Referência, Efeitos de Referência para Sites, Boas Práticas, Skills
- Controle de permissão por categoria e artigo

### 🔐 Sistema de Login e Permissões
- Perfis: sócios, gerentes e operacionais (gestor de tráfego, gestor de automação, social media etc.)
- Controle de acesso por módulo e por aba
- Financeiro acessível apenas por sócios e contador
- Blog com permissões por categoria
- Tela de ADM restrita a sócios

---

## 🚫 Restrições Técnicas

- Sistema interno — não é produto SaaS público, mas deve ser escalável para o crescimento da equipe
- Evitar dependências frágeis ou não auditáveis
- Dados financeiros e de clientes devem ser isolados por nível de permissão
- Integrações com WhatsApp devem prever instabilidades sem comprometer os demais módulos
- Arquitetura deve permitir adição de novos módulos sem refatoração estrutural

---

## ⛔ Restrições Funcionais

- Usuários operacionais não acessam módulo financeiro
- Nenhum usuário acessa dados de clientes além do seu nível de permissão
- Agente SDR apenas reporta métricas — não gerencia os bots diretamente pelo sistema
- Blog com categorias restritas não pode ser acessado por perfis sem permissão

---

## 📝 Observações

- Referências de UX/UI: ClickUp, Monday, Notion, Trello
- A distribuição financeira entre sócios (33,33% cada + 10% ao caixa) deve ser parametrizável
- O kanban deve funcionar de forma autônoma no envio de tarefas via WhatsApp sem intervenção manual
- O módulo de contratos é o hub central — conecta clientes, financeiro e pipeline
- O plano Ultimate do módulo de planos está em aberto e a arquitetura deve prever um terceiro tier
- O blog interno é estratégico para organização de conhecimento da agência e deve ser de fácil edição

---

## ✅ Checklist de Testes

### 🔐 Login e Permissões
- [ ] Login funcionando para todos os perfis
- [ ] Sócios acessam todos os módulos
- [ ] Operacionais bloqueados no financeiro e ADM
- [ ] Permissões do blog respeitadas por categoria
- [ ] Logout e controle de sessão funcionando

### 🏠 Dashboard
- [ ] MRR, ARR e demais métricas calculadas corretamente
- [ ] Funil de prospecção exibindo etapas e quantidades corretas
- [ ] Alertas de contratos a vencer aparecendo corretamente
- [ ] Gráfico YOY renderizando com dados reais
- [ ] Comparativo mensal vs. mês anterior funcionando
- [ ] Taxa de Churn calculada corretamente
- [ ] Ticket médio dos contratos ativos correto

### 📊 Pipeline
- [ ] Adição de novos leads funcionando
- [ ] Movimentação entre etapas funcionando
- [ ] Tags criadas, editadas e aplicadas corretamente
- [ ] Filtros de leads funcionando

### 📄 Contratos
- [ ] Criação de contrato funcionando
- [ ] Leitura do contrato armazenado funcionando
- [ ] Alerta de renovação disparado no prazo correto
- [ ] Fluxo de renovação e comunicação com o lead funcionando
- [ ] Vínculo com cadastro de cliente funcionando

### 💰 Financeiro
- [ ] Lançamentos financeiros registrados corretamente
- [ ] Distribuição entre sócios calculada corretamente (33,33% + 10% caixa)
- [ ] Projeção anual calculada com base nos lançamentos
- [ ] Filtros por tipo de despesa funcionando
- [ ] Status de pagamento (pago/a pagar) atualizado corretamente

### 💬 CRM / WhatsApp
- [ ] Números da GH gerenciados corretamente
- [ ] Conversas exibidas por número
- [ ] Tags aplicadas às conversas
- [ ] Filtros por classificação funcionando

### 👥 Clientes
- [ ] Cadastro completo de clientes funcionando
- [ ] Edição e exclusão funcionando
- [ ] Anexo de arquivos (escopo, PRD, documentos) funcionando
- [ ] Responsáveis vinculados ao cliente corretamente

### 🤖 Agente SDR
- [ ] Métricas de volume e engajamento exibidas corretamente
- [ ] Filtros por período (hoje, semana, mês, total) funcionando
- [ ] MRR e ARR atribuídos ao bot calculados corretamente
- [ ] Drop-off por etapa calculado corretamente
- [ ] Show rate e cancelamentos registrados corretamente

### 📋 Kanban
- [ ] Adição e conclusão de tarefas funcionando
- [ ] Filtros por responsável funcionando
- [ ] Lembretes de tarefas funcionando
- [ ] Envio automático de tarefas via WhatsApp toda segunda-feira
- [ ] Tela de ADM exibindo todas as tarefas para os sócios

### 📝 Blog Interno
- [ ] Criação de artigos, guias, listas e estudos funcionando
- [ ] Visualização em grid funcionando
- [ ] Tags e busca funcionando
- [ ] Permissões por categoria respeitadas
- [ ] Imagem ilustrativa vinculada ao conteúdo corretamente

### ⚙️ Estabilidade e Segurança
- [ ] Nenhum usuário acessa dados acima do seu nível de permissão
- [ ] Sistema mantém performance com múltiplos módulos ativos
- [ ] Logs de ações críticas registrados
- [ ] Deploy em produção estável