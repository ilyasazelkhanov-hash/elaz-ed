import { createGateway } from '../_shared/gateway.ts'
import { createHandler } from '../_shared/handler.ts'
import type { ServerEnv } from '../_shared/handler.ts'
import {readServiceKey} from '../_shared/env.ts'

const names = ['APP_URL','BOT_TOKEN','ADMIN_TELEGRAM_IDS','OIDC_CLIENT_ID','OIDC_CLIENT_SECRET','ALLOWED_ORIGINS','WEBHOOK_SECRET','CRON_SECRET','SUPABASE_URL','INTEGRATION_WEBHOOK_SECRET','ADMIN_RETURN_PATH','API_PUBLIC_PATH']
const env = Object.fromEntries(names.map(name => [name,Deno.env.get(name) || ''])) as unknown as ServerEnv
const key = readServiceKey(name=>Deno.env.get(name))
Deno.serve(createHandler({env,gateway:createGateway(env.SUPABASE_URL,key)}))
