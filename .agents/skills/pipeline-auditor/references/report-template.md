# Template do Relatório de Auditoria — Pipeline Auditor

Este documento define a estrutura exata do relatório híbrido (findings + interrogatório). O relatório é entregue como um arquivo .md estruturado.

---

## Estrutura do Relatório

```markdown
# Auditoria de Pipeline: [Nome do Pipeline/Sistema]

**Data:** [data da auditoria]
**Input avaliado:** [tipo de input — PRD, workflow JSON, texto livre, etc.]
**Escopo:** [breve descrição do que foi avaliado]

---

## Resumo Executivo

[2-3 parágrafos que sintetizam: o que foi avaliado, quantos problemas foram encontrados por severidade, e a avaliação geral de integridade]

### Contagem de Findings

| Severidade | Quantidade |
|---|---|
| Crítico | X |
| Alto | X |
| Médio | X |
| Baixo | X |
| **Total** | **X** |

---

## Parte 1 — Findings

### Findings Críticos

#### [FC-001] [Título descritivo curto]

- **Categoria:** [uma das 6 fixas ou "Critério Dinâmico: nome"]
- **Localização:** [onde no pipeline — seção do PRD, nó do workflow, trecho de código]
- **Evidência:** [citação ou descrição exata do que está errado]
- **Impacto:** [o que acontece se não corrigir]
- **Sugestão de correção:** [como resolver, com o máximo de especificidade possível]

[Repetir para cada finding crítico]

### Findings Altos

#### [FA-001] [Título descritivo curto]
[Mesmo formato]

### Findings Médios

#### [FM-001] [Título descritivo curto]
[Mesmo formato]

### Findings Baixos

#### [FB-001] [Título descritivo curto]
[Mesmo formato]

---

## Parte 2 — Interrogatório Estratégico

[Introdução breve: estas perguntas existem porque a auditoria identificou zonas de ambiguidade que não puderam ser resolvidas apenas com a análise do material fornecido. As respostas podem revelar novos problemas ou invalidar findings existentes.]

### Área: [Nome da área do pipeline]

**P1:** [Pergunta específica e direta]
- **Contexto:** [por que essa pergunta está sendo feita]
- **Findings relacionados:** [IDs dos findings que podem ser afetados — ex: FC-001, FA-003]

**P2:** [Próxima pergunta]
[Mesmo formato]

### Área: [Outra área]
[Repetir]

---

## Parte 3 — Scorecard

### Nota Geral de Integridade

**[XX/100]** — [APROVADO / APROVADO COM RESSALVAS / REPROVADO]

### Score por Categoria

| Categoria | Score | Observação |
|---|---|---|
| Gaps de Tradução | X/100 | [nota curta] |
| Saltos Lógicos | X/100 | [nota curta] |
| Alucinações Arquiteturais | X/100 | [nota curta] |
| Dependências Fantasma | X/100 | [nota curta] |
| Loops sem Saída | X/100 | [nota curta] |
| Pontos Cegos de Erro | X/100 | [nota curta] |
| Critérios Dinâmicos | X/100 | [nota curta] |

### Áreas Não Avaliadas

[Lista de partes do pipeline que não puderam ser auditadas e por quê. Ex: "Módulo de IA — descrito apenas como 'processa com IA' sem detalhes de prompt, modelo ou lógica de decisão."]

### Critérios Dinâmicos Aplicados

[Lista dos critérios extras que foram gerados para esta auditoria específica, com justificativa de por que cada um foi criado]

---

## Apêndice: Grafo do Pipeline

[Representação textual ou mermaid do grafo extraído na Fase 0, mostrando nós, arestas e onde os findings foram localizados]
```

---

## Regras do Relatório

1. **IDs são obrigatórios.** Todo finding tem um ID único (FC-001 para crítico, FA-001 para alto, FM-001 para médio, FB-001 para baixo). Isso permite referência cruzada nas perguntas.

2. **Findings primeiro, perguntas depois.** O relatório é estruturado para que o leitor veja primeiro o que está errado de forma objetiva, e depois as zonas de incerteza.

3. **Scorecard usa lógica, não arbitrariedade.** O score é calculado com base nos findings:
   - Base: 100 pontos
   - Cada finding Crítico: -15 pontos
   - Cada finding Alto: -8 pontos
   - Cada finding Médio: -3 pontos
   - Cada finding Baixo: -1 ponto
   - Mínimo: 0 pontos
   - Cada área não avaliada: não subtrai pontos, mas é listada como risco desconhecido

4. **Classificação final:**
   - 80-100: APROVADO
   - 50-79: APROVADO COM RESSALVAS
   - 0-49: REPROVADO

5. **O grafo do apêndice é opcional mas recomendado.** Para pipelines complexos (>10 nós), incluir um diagrama mermaid ajuda o leitor a visualizar onde os problemas estão concentrados.

6. **Perguntas são numeradas e rastreáveis.** Cada pergunta referencia os findings que podem ser afetados, criando uma cadeia de rastreabilidade entre dúvidas e problemas concretos.

7. **Sugestões de correção são o mais concretas possível.** Em vez de "implemente tratamento de erro", prefira "adicione try/catch com retry (3x, backoff exponencial base 2s) e envie falhas para fila DLQ no Redis após esgotar tentativas". Se não for possível ser específico (falta contexto), indique o que precisaria saber para dar uma sugestão concreta.
