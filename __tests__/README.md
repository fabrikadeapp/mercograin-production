# Testes Automatizados

## Estrutura

```
__tests__/
├── utils/
│   ├── formatters.test.ts
│   └── validators.test.ts
└── README.md
```

## Execução

### Executar todos os testes:
```bash
npm run test
```

### Executar testes específicos:
```bash
npx ts-node __tests__/utils/formatters.test.ts
npx ts-node __tests__/utils/validators.test.ts
```

## Testes Implementados

### Formatadores (formatters.test.ts)
- ✅ Formatação de moeda (R$)
- ✅ Formatação de datas
- ✅ Formatação de CPF
- ✅ Formatação de CNPJ

### Validadores (validators.test.ts)
- ✅ Validação de CPF
- ✅ Validação de CNPJ
- ✅ Validação de Email

## Próximos Passos

Testes a implementar:
- [ ] Testes de API (clientes, propostas, contratos, boletos)
- [ ] Testes de autenticação
- [ ] Testes de integração
- [ ] Testes E2E (com Playwright/Cypress)

## Tecnologias

- **Framework**: TypeScript + Node.js assert nativo
- **Execução**: ts-node
- **Cobertura**: Manual

## Notas

Este é um setup minimalista de testes para manter a simplicidade do projeto. Para projetos maiores, considere:
- Jest
- Vitest
- Cypress
- Playwright
