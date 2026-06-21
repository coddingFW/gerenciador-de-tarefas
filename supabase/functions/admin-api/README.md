# admin-api

Backend do painel **admin** (Fase 1 §9/§12). Ao contrário das outras Edge
Functions (server-to-server com `service_role`), esta é chamada pelo **browser**
de um administrador.

## Autorização (dupla)
1. Autentica pelo **JWT do usuário** (`Authorization: Bearer <access_token>`).
2. Exige `profiles.role = 'admin'`. Só então usa o `service_role` para ler as
   views administrativas — que são **revogadas de `authenticated`** (0004) — e
   para gravar `audit_logs`.

Como faz a própria verificação, `verify_jwt` fica desligado no gateway.

## Endpoints
| Método | Corpo                                   | Retorno                                  |
| ------ | --------------------------------------- | ---------------------------------------- |
| `GET`  | —                                       | métricas (total de contas, DAU/WAU/MAU, conclusão, top hábitos, retenção) + feature flags |
| `POST` | `{ action: "set-flag", key, patch }`    | flag atualizada; grava `audit_logs`      |

`patch` aceita apenas: `enabled_global`, `rollout_percentage`,
`enabled_for_roles`, `enabled_for_plans`, `enabled_for_users`.

```bash
# visão geral
curl "$SUPABASE_URL/functions/v1/admin-api" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN"

# habilitar uma flag para 25% via rollout
curl -X POST "$SUPABASE_URL/functions/v1/admin-api" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "action": "set-flag", "key": "ai_suggestions", "patch": { "rollout_percentage": 25 } }'
```

## Deploy
```bash
supabase functions deploy admin-api
```
A autorização por role e as policies de `feature_flags`/views estão cobertas
pelo teste pgTAP [`admin_access.test.sql`](../../tests/admin_access.test.sql).
