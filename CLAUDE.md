## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes -- don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -- then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management
1. Plan First: Write plan to tasks/todo.md with checkable items
2. Verify Plan: Check in before starting implementation
3. Track Progress: Mark items complete as you go
4. Explain Changes: High-level summary at each step
5. Document Results: Add review section to tasks/todo.md
6. Capture Lessons: Update tasks/lessons.md after corrections

## Core Principles
- Simplicity First: Make every change as simple as possible. Impact minimal code.
- No Laziness: Find root causes. No temporary fixes. Senior developer standards.
- Minimal Impact: Only touch what's necessary. No side effects with new bugs.

# REGRA PERMANENTE DE IMPLEMENTAÇÃO

Sempre implemente funcionalidades completas, reais e integradas.

Não entregue apenas interface visual. Todo botão, formulário, modal, dashboard, filtro, importação, exportação, PDF, CSV, impressão, integração e processo exibido na UI deve funcionar de verdade, com handler, validação, API/service, persistência real, tratamento de erro, loading state, feedback de sucesso e testes quando relevante.

É proibido usar mocks, snapshots, dados hardcoded ou placeholders como substitutos de funcionalidade de produção.

Antes de finalizar qualquer tarefa, audite a cadeia completa:

UI → ação → service/API → backend → banco ou integração → resposta → atualização da interface → erro/sucesso → teste.

Se alguma parte não puder funcionar por falta de credencial, regra de negócio ou decisão externa, documente claramente como pendência real. Não finja funcionamento.

Preserve a arquitetura atual, não quebre funcionalidades existentes, não crie arquivos desnecessários, reutilize padrões do projeto e implemente com máxima qualidade economizando tokens, sem reduzir a precisão, robustez ou completude da programação.