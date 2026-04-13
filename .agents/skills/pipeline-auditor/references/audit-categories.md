# Categorias de Auditoria — Definições, Heurísticas e Severidade

Este documento define as 6 categorias fixas de problemas que a skill Pipeline Auditor avalia em toda auditoria. Para cada categoria: definição precisa, exemplos reais, heurísticas de detecção e critérios objetivos de severidade.

---

## 1. Gaps de Tradução

**Definição:** Informação que é gerada, capturada ou disponível em uma etapa do pipeline, mas que não é corretamente transmitida para a etapa seguinte que precisa dela. A informação existe — mas se perde na "tradução" entre etapas.

**Exemplos reais:**
- Um formulário captura CPF, nome e telefone, mas a API de cadastro só recebe nome e telefone — CPF desaparece
- O webhook recebe um payload com `order_id` como string, mas o banco espera integer — a conversão nunca acontece
- Um n8n workflow extrai dados de um PDF, mas o nó seguinte referencia campos com nomes diferentes dos extraídos
- Uma API retorna dados paginados, mas o consumidor só processa a primeira página
- O evento do webhook inclui timezone, mas o processamento assume UTC sem converter

**Heurísticas de detecção:**
- Para cada output de um nó, verifique: o nó seguinte consome TODOS os campos necessários?
- Compare schemas/contratos de saída vs. entrada entre nós adjacentes
- Procure transformações de tipo implícitas (string→int, date formats, encodings)
- Verifique se dados opcionais em uma etapa são tratados como obrigatórios na seguinte
- Mapeie campos por nome: mudanças de nomenclatura entre etapas são gaps potenciais

**Critérios de severidade:**

| Severidade | Critério |
|---|---|
| **Crítico** | Dado essencial para a funcionalidade core é perdido. O pipeline falha silenciosamente (sem erro, mas resultado incorreto) |
| **Alto** | Dado importante é perdido, causando degradação funcional visível ao usuário ou perda parcial de informação |
| **Médio** | Dado complementar é perdido, afetando features secundárias ou relatórios |
| **Baixo** | Dado de conveniência é perdido (ex: metadata para logging que não impacta funcionalidade) |

---

## 2. Saltos Lógicos

**Definição:** Uma etapa do pipeline assume como verdadeiro ou disponível algo que NENHUMA etapa anterior produziu, validou ou garantiu. A lógica "pula" uma premissa necessária sem justificativa.

**Exemplos reais:**
- "Envia notificação para o cliente" sem definir: por qual canal? com qual template? disparado por qual evento?
- "Atualiza o status do pedido para 'pago'" sem verificar se o pagamento foi realmente confirmado pela gateway
- "Gera relatório mensal" sem especificar: de onde vêm os dados? qual a query? qual o período exato?
- "Redireciona usuário autenticado" sem definir o fluxo de autenticação
- "Aplica desconto" sem regra de negócio que determine quando e quanto

**Heurísticas de detecção:**
- Para cada ação descrita, pergunte: "O que precisaria ser verdade para essa ação funcionar?"
- Verifique se cada premissa tem uma etapa anterior que a garante
- Procure verbos de ação sem seus pré-requisitos (enviar sem endereço, cobrar sem valor, notificar sem canal)
- Identifique "mágica" — resultados que aparecem sem processo que os produza
- Desconfie de etapas que "simplesmente funcionam" em descrições vagas

**Critérios de severidade:**

| Severidade | Critério |
|---|---|
| **Crítico** | Salto que torna uma funcionalidade core impossível de implementar como descrita. O desenvolvedor não tem informação suficiente para construir |
| **Alto** | Salto que gera ambiguidade significativa — múltiplas interpretações possíveis, cada uma levando a implementações diferentes |
| **Médio** | Salto em feature secundária que pode ser inferida com razoável confiança pelo contexto |
| **Baixo** | Salto em detalhe operacional que tem um padrão óbvio (ex: não especificou formato de data, mas o stack tem um default claro) |

---

## 3. Alucinações Arquiteturais

**Definição:** Referência a uma capacidade, endpoint, feature ou comportamento de uma tecnologia (API, biblioteca, serviço) que NÃO existe na realidade ou que não funciona como descrito no pipeline.

**Exemplos reais:**
- "Usa webhook do Bradesco para notificar pagamento em tempo real" — a API Bradesco REST não oferece webhooks nativos para todos os produtos
- "Conecta via API do Instagram para enviar DMs automaticamente" — a Graph API tem restrições severas para DMs programáticas
- "Usa GPT-4 para processar o PDF diretamente" — sem especificar que precisa de extração de texto antes
- "Webhook do Mercado Pago notifica instantaneamente" — sem considerar o delay real e retentativas
- "n8n node nativo para [serviço X]" quando o node não existe na versão usada

**Heurísticas de detecção:**
- Para CADA integração externa mencionada, pesquise via web se a API/serviço oferece exatamente o que o pipeline descreve
- Verifique versões: a feature existe na versão que o projeto vai usar?
- Procure "too good to be true" — integrações descritas como triviais que na prática são complexas
- Compare o que o pipeline diz com a documentação oficial do serviço
- Verifique rate limits, quotas e pricing que podem inviabilizar o uso descrito

**Critérios de severidade:**

| Severidade | Critério |
|---|---|
| **Crítico** | A feature/API simplesmente não existe. O pipeline é impossível como descrito. Requer redesign |
| **Alto** | A feature existe mas com limitações severas não mencionadas (rate limits, pricing proibitivo, aprovação necessária) que inviabilizam o uso pretendido |
| **Médio** | A feature existe mas funciona diferente do descrito — requer adaptação significativa mas não redesign |
| **Baixo** | Imprecisão menor na descrição que não afeta a viabilidade (ex: nome do endpoint ligeiramente diferente) |

---

## 4. Dependências Fantasma

**Definição:** Referência a um serviço, módulo, API, variável de ambiente, credencial, infraestrutura ou componente que é USADO pelo pipeline mas que NUNCA foi definido, provisionado ou explicado em nenhum lugar do escopo.

**Exemplos reais:**
- Pipeline referencia `REDIS_URL` mas nenhuma instância Redis é mencionada na infraestrutura
- "Dados são salvos no data lake" mas nenhum data lake foi definido ou provisionado
- Código importa `@company/auth-service` mas esse pacote interno nunca é descrito
- "Consulta o cache" sem definir qual tecnologia de cache, onde roda, como é invalidado
- "Envia para a fila" sem definir qual message broker, qual tópico/queue, quem consome

**Heurísticas de detecção:**
- Liste TODOS os componentes referenciados no pipeline (serviços, bancos, filas, caches, APIs, env vars, pacotes)
- Para cada um, verifique: ele é definido/provisionado em algum lugar do escopo?
- Procure referências a variáveis de ambiente sem um `.env.example` ou documentação equivalente
- Identifique imports de módulos internos que não aparecem na estrutura do projeto
- Verifique se infraestrutura referenciada (DNS, SSL, load balancer, CDN) está coberta

**Critérios de severidade:**

| Severidade | Critério |
|---|---|
| **Crítico** | Componente core do pipeline (banco principal, message broker, serviço de auth) não definido. Pipeline não funciona sem ele |
| **Alto** | Componente importante referenciado múltiplas vezes sem definição (cache, worker, fila secundária) |
| **Médio** | Componente auxiliar referenciado uma vez sem definição, mas cuja natureza é inferível |
| **Baixo** | Variável de ambiente ou configuração não documentada mas padrão no ecossistema |

---

## 5. Loops sem Saída

**Definição:** Fluxo que pode entrar em ciclo infinito, recursão sem base case, retry sem limite, ou qualquer padrão que repete indefinidamente sem uma condição de saída garantida.

**Exemplos reais:**
- Retry de envio de email que tenta novamente a cada falha sem limite máximo de tentativas
- Webhook que falha, é reenviado, falha de novo — sem dead letter queue ou circuit breaker
- Workflow que monitora um status e reagenda a si mesmo indefinidamente enquanto o status não muda
- Processamento de fila onde mensagens com erro voltam para a mesma fila sem contagem de tentativas
- Polling de API que nunca para se a condição esperada nunca ocorre

**Heurísticas de detecção:**
- Para cada retry/loop/polling, verifique: existe um limite máximo explícito?
- Procure padrões de "tenta de novo" sem backoff ou cap
- Identifique fluxos circulares no grafo do pipeline (A→B→C→A)
- Verifique se existe timeout global para processos longos
- Para cada condição de loop, pergunte: "É possível que essa condição NUNCA seja satisfeita?"

**Critérios de severidade:**

| Severidade | Critério |
|---|---|
| **Crítico** | Loop infinito que consome recursos progressivamente (memória, CPU, chamadas de API com custo), podendo causar crash ou billing descontrolado |
| **Alto** | Loop que bloqueia um worker/thread indefinidamente, impedindo processamento de outros itens |
| **Médio** | Loop que se resolve eventualmente mas de forma ineficiente (ex: polling a cada 1s por horas) |
| **Baixo** | Possibilidade teórica de loop que na prática é improvável dado o domínio |

---

## 6. Pontos Cegos de Erro

**Definição:** Etapa do pipeline que não define o que acontece quando algo dá errado. Não há tratamento de falha, fallback, retry strategy, logging de erro, alerta ou qualquer mecanismo de resiliência para cenários de falha.

**Exemplos reais:**
- Chamada HTTP para API externa sem timeout definido, sem retry, sem fallback
- Processamento de lote que falha no item 47 de 100 — o que acontece com os 53 restantes?
- Escrita no banco falha — a transação foi revertida? Os passos anteriores ficam em estado inconsistente?
- Serviço externo fica fora do ar por 2 horas — o pipeline pára? enfileira? perde dados?
- Upload de arquivo falha no meio — arquivo parcial fica no storage?

**Heurísticas de detecção:**
- Para CADA integração externa (API, banco, file system, serviço), pergunte: "E se isso falhar?"
- Verifique se existe uma estratégia de erro documentada (retry, circuit breaker, DLQ, fallback)
- Procure operações não-atômicas que podem deixar o sistema em estado parcial
- Identifique operações que podem dar timeout sem timeout explícito
- Para processos em lote: o que acontece com itens parcialmente processados?
- Verifique se erros são logados de forma que permita debug e monitoramento

**Critérios de severidade:**

| Severidade | Critério |
|---|---|
| **Crítico** | Falha causa perda irreversível de dados ou estado inconsistente no banco/sistema principal |
| **Alto** | Falha causa indisponibilidade do serviço sem mecanismo de recuperação automática |
| **Médio** | Falha causa degradação de experiência do usuário sem perda de dados (ex: notificação não enviada, mas pode ser reenviada manualmente) |
| **Baixo** | Falha em componente não essencial sem impacto funcional direto (ex: log não registrado, metric não coletada) |

---

## Nota sobre Critérios Dinâmicos

As 6 categorias acima são aplicadas a TODA auditoria. Além delas, a Fase 1 do workflow gera critérios DINÂMICOS específicos para o domínio e tecnologias do pipeline sendo avaliado. Esses critérios dinâmicos seguem a mesma estrutura de severidade mas são documentados separadamente no relatório, com justificativa de por que foram gerados.
