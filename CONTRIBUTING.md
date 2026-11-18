# Cómo contribuir

Estas reglas existen para que cualquier persona (el equipo, el profesor o quien evalúe el proyecto) pueda seguir cada cambio desde el requisito hasta la prueba que lo respalda.

## Flujo

1. **Issue primero.** Todo cambio empieza en un issue (plantillas «Requisito» o «Error»). Los requisitos llevan un ID de [docs/trazabilidad.md](docs/trazabilidad.md) (`RF-xx` o `RNF-xx`); los riesgos, uno de [docs/ia-responsable.md](docs/ia-responsable.md) (`Rxx`).
2. **Una rama por issue**, creada desde `main`:
   - `feat/<tema>` para funcionalidades, `fix/<tema>` para correcciones, `docs/<tema>`, `ci/<tema>`, `chore/<tema>`.
3. **Commits pequeños**, uno por cambio lógico, hechos mientras se trabaja (no al final). El historial debe contar cómo evolucionó el proyecto.
4. **Pull request a `main`** con la plantilla. El PR se fusiona solo con el CI en verde.
5. **Versiones:** al cerrar una entrega se actualiza [CHANGELOG.md](CHANGELOG.md), se sube `version` en `package.json` y se crea un tag anotado (`git tag -a v2.1.0 -m "..."`).

## Mensajes de commit

[Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), en español:

```
tipo(ámbito): resumen en presente y en minúscula

Qué cambia y, sobre todo, por qué. Cifras si las hay.

Refs: #12, RF-06
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `chore`, `perf`.
- Ámbitos frecuentes: `motor`, `ia`, `form`, `datos`, `admin`, `ui`, `analitica`, `evals`.
- `Refs:` enlaza el issue y el requisito o riesgo.

## Uso de asistentes de IA

Cuando un asistente de IA (Claude, Copilot, etc.) escriba o modifique código, el commit lo declara con un trailer `Co-Authored-By:`. Así el uso de IA queda registrado de forma uniforme en el historial y no solo en algunos commits.

## Identidad de git

Configure su nombre y correo una sola vez para que todos sus commits queden con la misma identidad:

```bash
git config --global user.name "Su nombre"
git config --global user.email "su-correo@ejemplo.com"   # o el correo noreply de GitHub
```

## Antes de abrir el PR

```bash
npm run typecheck && npm run lint && npm test          # lo mismo que el CI
npm run evals && npm run evals -- --dataset evals/dataset-prueba.json && npm run evals:umbrales
npm run test:e2e                                       # E2E (no corre en el CI)
```

- Si el cambio toca un requisito, actualice su fila en `docs/trazabilidad.md`.
- Si cambia una cifra que aparece en el README, actualícela con la fecha de la medición.
- No suba `evals/resultados/*.json` si solo cambió la fecha.
