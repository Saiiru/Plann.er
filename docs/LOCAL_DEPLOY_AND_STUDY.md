# Travel Planner API — execução, arquitetura e laboratório

**Tipo:** backend educacional independente de KORA. Stack: Fastify 5, Zod, Prisma 5, SQLite.

## Problema que resolve

Organizar uma viagem em grupo com destino, datas, participantes, confirmação de convites, agenda diária e links úteis. A API oferece recursos JSON; **não** contém frontend, autenticação real ou envio de e-mails. As mensagens de confirmação são geradas como prévias locais.

## Mapa para ler o código

1. `src/server.ts`: inicia o servidor somente após verificar o banco.
2. `src/app.ts`: registra Fastify, Zod, CORS e as rotas.
3. `src/routes/`: cada endpoint possui validação, caso de uso e resultado.
4. `src/lib/validation.ts`: campos e invariantes de datas.
5. `prisma/schema.prisma`: tabelas Trip, Participant, Activity e Link e suas relações.
6. `prisma/migrations/`: evolução versionada do banco; não substitua por scripts ad hoc.
7. `src/lib/mail.ts`: geração das prévias e links de confirmação. Não chama um servidor SMTP.
8. `tests/api.test.ts`: casos completos, erros, idempotência, limites de datas, falhas de e-mail e migração.
9. `src/routes/health.ts`: prontidão; retorna HTTP 200 apenas quando uma consulta ao schema está funcional.

## Rodar localmente por Docker (persistência real no volume)

Requisitos: Docker Engine e Docker Compose. A porta é publicada **apenas em 127.0.0.1**, sem exposição pública.

1. Na raiz do repositório, execute `TRAVEL_DEMO_PORT=4357 docker compose -p sairu-travel-study up -d --build`.
2. Verifique `curl -fsS http://127.0.0.1:4357/health`. Esperado: `{"status":"ok","service":"travel-planner-api"}`.
3. Crie um registro **fictício** com `POST /trips`. Use `starts_at` e `ends_at` em ISO 8601 com fuso, datas futuras e intervalo de até 366 dias.
4. Salve o `tripId` da resposta e consulte `GET /trips/:tripId`.
5. Reinicie com `docker compose -p sairu-travel-study restart` e repita o GET. O registro deve continuar, pois o banco vive no volume nomeado `trip_data`.
6. Para parar, use `docker compose -p sairu-travel-study down`; **não use `down -v`** se quiser preservar os dados fictícios.

O container aplica migrations antes de iniciar a API. Sua pasta `/app/data` também guarda as prévias de convite em JSON. Os redirecionamentos de confirmação apontam para `WEB_BASE_URL`; não existe frontend nesse repositório, então o destino do navegador pode não responder.

## Contrato resumido (versão local)

| Método | Rota | Ação |
| --- | --- | --- |
| GET | `/health` | Verificar prontidão do banco; 200 ou 503 |
| POST | `/trips` | Criar viagem, dono e convidados; retorna `tripId` |
| GET | `/trips/:tripId` | Dados da viagem |
| PUT | `/trips/:tripId` | Atualizar destino e datas válidas |
| GET | `/trips/:tripId/confirm` | Confirmar viagem e gerar convites locais; redireciona |
| GET | `/trips/:tripId/participants` | Listar participantes |
| POST | `/trips/:tripId/invites` | Convidar participante em viagem confirmada |
| GET | `/participants/:participantId` | Consultar convidado |
| GET | `/participants/:participantId/confirm` | Confirmar convidado; redireciona |
| POST | `/trips/:tripId/activities` | Incluir atividade dentro das datas da viagem |
| GET | `/trips/:tripId/activities` | Agenda organizada por dia UTC |
| POST | `/trips/:tripId/links` | Incluir link HTTP(S) |
| GET | `/trips/:tripId/links` | Consultar links |

Resposta de criação de viagem (use valores fictícios; as datas abaixo são um exemplo válido em novembro de 2026):

```http
POST /trips HTTP/1.1
Content-Type: application/json

{
  "destination": "Cidade Exemplo",
  "starts_at": "2027-01-15T09:00:00-03:00",
  "ends_at": "2027-01-18T18:00:00-03:00",
  "owner_name": "Pessoa Exemplo",
  "owner_email": "owner@example.test",
  "emails_to_invite": ["guest@example.test"]
}
```

**Resultado obtido nesta rodada:** imagem Docker compilada, `/health` HTTP 200, viagem fictícia criada por HTTP 200 e encontrada por GET após reinício do container. O servidor de testes foi desligado; o volume de estudo mantém os registros sintéticos até ser apagado deliberadamente.

**Critérios de aceitação:** criação retorna UUID; confirmação da viagem é idempotente; convidados duplicados são normalizados; atividades fora do intervalo falham; URLs que não sejam HTTP(S) falham; uma viagem sobrevive ao reinício do container com volume.

## Segurança e limites

Não publique esta versão diretamente na Internet. As rotas atuais **não** possuem autorização por usuário e as confirmações são acessíveis por identificadores; CORS não substitui autenticação. Uma implantação em Vercel Functions não preservaria o SQLite em disco. Para disponibilizar um backend público, uma etapa separada deve implementar banco durável gerenciado, autenticação/autorização, política de privacidade de convidados, limites de requisição e entrega real de e-mail.

**Não há integração com a KORA ou com bancos financeiros.** O Docker Compose aqui é para demonstração local de engenharia e testes, não uma infraestrutura pública.

## Exercício de leitura do código (para realizar depois)

1. Onde o código impede que uma atividade seja agendada fora das datas?
2. Por que os links de convite são criados dentro de uma transação do Prisma?
3. Por que o endpoint `/health` deve testar o banco, e não simplesmente responder "ok"?
4. Qual é a diferença entre persistir SQLite num volume e migrar para PostgreSQL num serviço público?

**Gabarito:** (1) `src/routes/create-activity.ts`; (2) atomicidade entre estado e geração da prévia, sob as limitações de escrita em arquivo; (3) distingue processo iniciado de banco pronto/migrado; (4) volume prende o estado à instância e ao host, enquanto banco gerenciado fornece durabilidade independente do ciclo de vida da função.
