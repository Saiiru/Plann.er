# Travel Planner API

> Curadoria técnica · 12/11/2026 · **projeto independente**, não integrado à KORA.

**Repositório atual:** https://github.com/Saiiru/travel-planner-api
**Nome anterior:** `Plann.er`
**Tecnologias observadas:** TypeScript · Fastify · SQLite
**Estado verificado por inspeção:** API educacional; testes de integração identificados. Sem frontend ou autenticação.

## Problema e objetivo

Organizar viagens em grupo por API, incluindo participantes, atividades, links e confirmações.

Este é um estudo/experimento de engenharia de software; não é declarado como serviço comercial, produto em produção ou solução universal.

## O que existe atualmente

API educacional; testes de integração identificados. Sem frontend ou autenticação. Os arquivos originais, licenças, histórico e eventuais instruções de instalação permanecem no repositório. Esta curadoria não executou todas as dependências nem comprovou operação funcional. Para executar, use as instruções originais do README se disponíveis; quando ausentes, a preparação do ambiente é uma tarefa pendente, não um comando inventado.

## Projeto, autoria e referências

Trilha NLW Journey da Rocketseat. Créditos, fontes de tutoriais e colaboradores devem continuar associados ao trabalho original. O fato de um repositório estar nesta conta não significa que todo o conteúdo foi escrito individualmente.

## Próximo incremento verificável

**Primeiro passo:** Reproduzir os testes existentes, adicionar validação de timezone e documentação OpenAPI.

**Critério de conclusão:** README com setup reproduzível, pelo menos uma verificação automatizada que detecte falhas relevantes, tratamento de entradas inválidas e demonstração com dados fictícios. Só alegar testes aprovados após execução registrada.

## Como apresentar no portfólio

**Nome editorial:** Travel Planner API
**Problema:** Organizar viagens em grupo por API, incluindo participantes, atividades, links e confirmações.
**Evidência:** código público no branch padrão; estado e limitações declarados nesta nota.
**Ainda não é:** sistema integrado à KORA, serviço em produção ou prova de maturidade sem testes.

[Voltar ao portfólio SAIRU/BLACKSITE](https://saiiru.github.io/#projetos-independentes)


## Verificação de funcionamento — 12/11/2026

**Estado confirmado:** API validada localmente

**Evidência:** Node 24 · npm test: 22/22; npm run typecheck; npm run build

**Limites e bloqueios:** Hospedagem pública bloqueada por SQLite local sem armazenamento persistente e ausência de autenticação para rotas de escrita.

Esta validação não implica integração à KORA nem certificação de produção. Não alterar histórico, licença e autoria dos tutoriais.
