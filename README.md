# Awards API

API REST em Node.js e TypeScript que calcula os produtores com o menor e o maior intervalo entre vitórias consecutivas no Golden Raspberry Awards.

## Requisitos

- Node.js 22 ou superior
- npm

## Instalação

Instale também as `devDependencies` necessárias aos testes, typecheck e build:

```bash
npm ci --include=dev
```

## Execução

```bash
npm run build
npm start
```

O servidor lê `data/Movielist.csv` durante o startup e fica disponível em `http://localhost:3000`. A carga utiliza um banco SQLite em memória e uma única transação. Se o CSV for inválido ou a carga falhar, o servidor não começa a escutar requisições.

Após uma carga bem-sucedida, a aplicação registra um log estruturado com o caminho do CSV e as quantidades de filmes, produtores e relacionamentos importados.

## Endpoint

```http
GET /api/v1/producers/award-intervals
```

Resposta `200`:

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

A consulta considera apenas filmes vencedores, compara vitórias adjacentes de cada produtor e preserva todos os empates. Quando não existem intervalos elegíveis, `min` e `max` são arrays vazios.

## Validação

```bash
npm test
npm run typecheck
npm run build
```

Os testes são de integração e percorrem CSV, validação, SQLite, consulta SQL e endpoint Fastify sem abrir uma porta real.

## Tecnologias

- TypeScript
- Fastify
- SQLite com `better-sqlite3`
- `csv-parse`
- Zod
- Vitest
