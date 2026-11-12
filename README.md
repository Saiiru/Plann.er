# Travel Planner API

**Objetivo:** Organizar viagens em grupo por API, incluindo participantes, atividades, links e confirmações.

**Estado:** API educacional; testes de integração identificados. Sem frontend ou autenticação.

**Documentação técnica, origem e próximos passos:** [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md)

---

## Material original preservado

# Plann.er API

API educacional de planejamento de viagens, baseada no **NLW Journey**, da Rocketseat. Permite criar e confirmar viagens, confirmar participantes, registrar atividades e guardar links. Projeto de portfólio com execução local e testes de integração reais com SQLite.

## Executar localmente

Requisitos: **Node.js 22.9 ou superior** e npm. Validado com Node.js 24.14.0. Use os comandos abaixo em um terminal Linux/macOS ou WSL:

```bash
git clone https://github.com/Saiiru/travel-planner-api.git
cd travel-planner-api
npm ci
cp .env.example .env
npm run setup
npm run dev
```

A API escuta por padrão em `http://127.0.0.1:3333`. O navegador deve usar a origem definida em `CORS_ORIGIN`, inicialmente `http://localhost:3000`. O frontend é um projeto separado; esta API não inclui interface web. Os redirecionamentos apontam para `WEB_BASE_URL` mesmo se o frontend não estiver em execução.

O comando `setup` gera o Prisma Client e aplica as migrations versionadas. O banco local `prisma/dev.db` é criado durante esse processo; nenhum banco preenchido é distribuído no repositório. `DATABASE_URL="file:./dev.db"` é relativo ao diretório do schema Prisma.

Para executar o JavaScript compilado:

```bash
npm run build
npm start
```

`npm start` define `NODE_ENV=production` apenas no processo da aplicação, mesmo se o terminal tiver outro valor global. Isso seleciona o modo de execução; não significa que a API tenha os controles necessários para uso público.

## Configuração

Copie `.env.example` antes de executar o setup. O servidor carrega `.env` nos comandos `dev` e `start`; o Prisma também o usa em seus comandos.

| Variável | Valor de exemplo | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | Banco SQLite local |
| `API_BASE_URL` | `http://localhost:3333` | Base dos links de confirmação |
| `WEB_BASE_URL` | `http://localhost:3000` | Destino dos redirecionamentos |
| `CORS_ORIGIN` | `http://localhost:3000` | Origem exata do frontend, sem caminho nem barra final |
| `HOST` | `127.0.0.1` | Interface de escuta local |
| `PORT` | `3333` | Porta da API |
| `MAIL_PREVIEW_DIR` | `.mail-preview` | Diretório de mensagens locais |

URLs da API, frontend e links úteis precisam usar HTTP ou HTTPS. Arquivos `.env`, bancos SQLite, mensagens locais e arquivos compilados são ignorados pelo Git.

## Confirmação sem enviar emails

A configuração padrão **não envia emails nem acessa SMTP ou Ethereal**. Criação de viagem, confirmação da viagem e novos convites gravam mensagens em JSON em `.mail-preview/`. Cada arquivo contém destinatário, `link` de confirmação e HTML escapado. Abra o JSON e use o campo `link` para continuar o fluxo local.

1. Crie uma viagem com `POST /trips` e guarde `tripId`.
2. Acesse `GET /trips/:tripId/confirm` usando o link da mensagem do organizador. A viagem é confirmada e as mensagens dos convidados são criadas.
3. Acesse `GET /participants/:participantId/confirm` usando o link de cada mensagem de convite.
4. Consulte e registre atividades, links e novos convites nas rotas abaixo.

O organizador já é criado como participante confirmado. Convidados não podem confirmar participação antes da confirmação da viagem. A API não possui uma etapa para preencher o nome do convidado: ele permanece `null`, conforme o modelo original.

Falhas ao gravar mensagens revertem a escrita da respectiva operação no banco. A confirmação repetida da viagem não recria convites. As mensagens locais não são uma fila transacional: em caso de falha parcial, arquivos já gravados podem permanecer, e uma nova tentativa pode criar outra prévia. Não há entrega de emails em produção implementada.

## Rotas

| Método | Caminho | Resultado |
| --- | --- | --- |
| POST | `/trips` | Cria viagem e retorna `{ "tripId": "..." }` (200) |
| GET | `/trips/:tripId` | Detalhes em `{ "trip": { ... } }` |
| PUT | `/trips/:tripId` | Altera destino e datas; retorna `tripId` |
| GET | `/trips/:tripId/confirm` | Confirma viagem e redireciona (302) |
| GET | `/trips/:tripId/participants` | Lista participantes |
| POST | `/trips/:tripId/invites` | Cria convite; retorna `participantId` (201) |
| GET | `/participants/:participantId` | Detalhes do participante |
| GET | `/participants/:participantId/confirm` | Confirma participação e redireciona (302) |
| POST | `/trips/:tripId/activities` | Cria atividade; retorna `activityId` (201) |
| GET | `/trips/:tripId/activities` | Atividades agrupadas por dia UTC, incluindo dias vazios |
| POST | `/trips/:tripId/links` | Cria link; retorna `linkId` (201) |
| GET | `/trips/:tripId/links` | Lista links |

Exemplo de corpo para `POST /trips` — substitua as datas por datas futuras:

```json
{
  "destination": "São Paulo",
  "starts_at": "2099-08-01T18:00:00-03:00",
  "ends_at": "2099-08-04T18:00:00-03:00",
  "owner_name": "Pessoa de exemplo",
  "owner_email": "owner@example.test",
  "emails_to_invite": ["guest@example.test"]
}
```

`PUT /trips/:tripId` recebe `destination`, `starts_at` e `ends_at`. Datas devem ser strings ISO 8601 completas com fuso (`Z` ou deslocamento), início no futuro e término igual ou posterior ao início. A duração máxima é 366 dias. As respostas usam UTC. Alterações que excluiriam atividades existentes retornam 409.

Para atividades, envie `{ "title": "Passeio no centro", "occurs_at": "2099-08-02T10:00:00-03:00" }`. O instante deve estar entre o início e o término da viagem, inclusive. Os dias do agrupamento usam meia-noite UTC, independentemente do fuso do computador.

Para links, envie `{ "title": "Reserva do hotel", "url": "https://example.test/reserva" }`. Para convites, envie `{ "email": "new@example.test" }`. Emails são normalizados para minúsculas e cada endereço só pode aparecer uma vez por viagem. O organizador não é duplicado se aparecer na lista de convidados.

IDs malformados ou entradas inválidas retornam 400; recursos ausentes retornam 404; conflitos de convite ou datas retornam 409. Erros inesperados retornam 500 sem expor detalhes internos.

## Verificar

```bash
npm run typecheck
npm test
npm run build
npm audit
```

Os testes criam um banco SQLite temporário, aplicam as migrations reais e usam `Fastify.inject`. Cobrem o fluxo completo, datas inválidas e limites, último dia de viagens parciais, recursos ausentes, duplicação de convites, isolamento das consultas por viagem, conflitos de alteração, falhas das prévias, HTML escapado, links HTTP(S), JSON inválido e CORS. Não usam seu banco local, não abrem portas e não enviam emails.

Para validar o agrupamento em outro fuso:

```bash
TZ=America/Sao_Paulo npm test
```

## Limites do projeto

Esta é uma demonstração local. **Não há autenticação nem autorização por usuário**: quem conhece um ID pode consultar ou alterar o recurso correspondente, inclusive confirmar viagens e participantes. Os links usam IDs diretamente, sem token assinado ou expiração; confirmações também alteram estado por GET. CORS não é controle de acesso. Não publique esta API com dados pessoais ou acesso público sem implementar esses controles, limites de requisição e uma estratégia de entrega de mensagens.

A migration de unicidade normaliza emails existentes e mescla duplicatas por viagem, preservando primeiro o organizador, depois o participante confirmado e depois o menor ID. Faça backup de qualquer banco anterior antes de migrar; o banco de demonstração antigo foi removido do versionamento.

Tecnologias: TypeScript, Fastify 5, Zod 4, Prisma 5 e SQLite. Agradecimento à Rocketseat pelo conteúdo original do NLW Journey.


## Verificação do código em 12/11/2026

Node 24 · npm test: 22/22; npm run typecheck; npm run build

**Limitações:** Hospedagem pública bloqueada por SQLite local sem armazenamento persistente e ausência de autenticação para rotas de escrita.
