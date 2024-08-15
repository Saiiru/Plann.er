import fastify from "fastify";

const app = fastify();

app.get('/test', () => {
  return "iniciado"
})

app.listen({port: 3001}).then(() => {
  console.log("Server started on port 3001");
});