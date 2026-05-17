import { Hono } from "https://deno.land/x/hono@v3.2.7/mod.ts"
import { serve } from "https://deno.land/std@0.167.0/http/server.ts"
import { compress } from "https://deno.land/x/hono@v3.2.7/middleware/compress/index.ts"
import { logger } from "https://deno.land/x/hono@v3.2.7/middleware/logger/index.ts"
import LRUCache from "https://deno.land/x/lru_cache@6.0.0-deno.4/mod.ts"

const expiration = parseInt(Deno.env.get("GM_EXPRESS_EXPIRATION") || "") || 5 * 60
const store = new LRUCache({ maxAge: expiration * 1000, max: 1024 })

const expressStub = {
  get: async (key, _metadata) => {
    return store.get(key)
  },

  put: async (key, value, _metadata) => {
    store.set(key, value)
  }
}

const app = new Hono()

app.use("*", logger())
app.use("*", async (c, next) => {
  c.env.GmodExpress = expressStub
  await next()
})

export { app, serve, expiration }
