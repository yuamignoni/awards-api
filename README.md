# Awards API

API REST em Node.js e TypeScript para calcular os produtores com o menor e o maior intervalo entre vitórias consecutivas no Golden Raspberry Awards.

## Fluxo planejado:

```text
CSV → validação → SQLite → consulta SQL → resposta HTTP
```

## Tecnologias

- Node.js 22+
- TypeScript
- Fastify
- SQLite com `better-sqlite3`
- `csv-parse`
- Zod
- Vitest

## Instalação

```bash
npm ci
```

## Execução

```bash
npm run build
npm start
```

O servidor utiliza por padrão:

```text
http://localhost:3000
```

## Comandos

| Comando | Descrição |
|---|---|
| `npm test` | Executa os testes de integração |
| `npm run typecheck` | Verifica os tipos do código e dos testes |
| `npm run build` | Compila o código de produção para `dist/` |
| `npm start` | Executa a aplicação compilada |

## Endpoint planejado

```http
GET /api/v1/producers/award-intervals
```

Formato esperado da resposta:

```json
{
  "min": [
    {
      "producer": "Producer A",
      "interval": 1,
      "previousWin": 2008,
      "followingWin": 2009
    }
  ],
  "max": [
    {
      "producer": "Producer B",
      "interval": 13,
      "previousWin": 2002,
      "followingWin": 2015
    }
  ]
}
```
