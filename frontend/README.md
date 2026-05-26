# Frontend

Aplicação React + Vite + TypeScript do DevFast Manager.

## Desenvolvimento

```bash
npm install
npm run dev
```

Por padrão, o frontend usa rotas relativas para a API. Ao rodar backend e frontend em portas diferentes, defina:

```bash
VITE_API_URL=http://localhost:3001
```

## Scripts

- `npm run dev` - inicia o servidor Vite.
- `npm run build` - compila TypeScript e gera o build de produção.
- `npm run lint` - executa ESLint.
- `npm run preview` - serve o build localmente para prévia.
