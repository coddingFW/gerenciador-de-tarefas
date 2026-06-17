# ADR-0006 — Tema claro/escuro: `darkMode: 'class'` + anti-FOUC + persist local/perfil

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 3 (Perfil e preferências) — Etapa 1

## Contexto
O app era light hardcoded. A Fase 3 adiciona tema Claro/Escuro/Sistema, com
default seguindo o SO, persistido por usuário e cross-device.

## Decisões
1. **Estratégia `class`** (Tailwind `darkMode: 'class'`) — o tema é controlado pela
   classe `.dark` no `<html>`, não por `prefers-color-scheme` puro. Permite override
   explícito (Claro/Escuro) além de Sistema. As telas usam variantes `dark:`.
2. **Anti-FOUC** — script inline no `<head>` aplica a classe ANTES do primeiro
   paint (lê localStorage + `prefers-color-scheme`), evitando flash de tela clara.
3. **Persistência local + perfil** — localStorage é o cache anti-FOUC; o valor
   também vai para `profiles.theme` (sincroniza cross-device). Conflito de sync usa
   o **merge consistente** do projeto (`_sync = 0` local pendente vence); ao chegar
   um valor novo pelo pull/realtime, o tema é **reaplicado silenciosamente**.
4. **Barra de status** — `<meta theme-color>` é atualizada ao trocar de tema.

## Alternativas rejeitadas
- `darkMode: 'media'` (só `prefers-color-scheme`): não permite override manual.
- LWW por `profiles.updated_at`: introduziria um 2º modelo de merge só para um
  campo cosmético — inconsistente com o resto. Mantido o merge único.
- Tokens semânticos via CSS vars: mais refactor que `dark:` direto, sem ganho
  proporcional no tamanho atual do app.

## Consequências
- ✅ Override explícito + respeito ao SO; sem flash; preferência cross-device.
- ✅ Build de produção já nasce com a config; **dev server precisa reiniciar** ao
  mudar `tailwind.config.js` (Vite não recarrega a config em HMR) — observado no
  smoke test.
- ⚠️ Cada componente carrega variantes `dark:` (custo mecânico); novas telas devem
  seguir o padrão para não "vazar" superfícies claras no escuro.
