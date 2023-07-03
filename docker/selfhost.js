import { Hono } from "https://deno.land/x/hono@v3.2.7/mod.ts"
import { connect } from "https://deno.land/x/redis@v0.27.4/mod.ts"
import { serve } from "https://deno.land/std@0.167.0/http/server.ts"
import { compress } from "https://deno.land/x/hono@v3.2.7/middleware/compress/index.ts"
import { logger } from "https://deno.land/x/hono@v3.2.7/middleware/logger/index.ts"

const expiration = 60 * 60 * 24
const redis = await connect({ hostname: "kv" })

const expressStub = {
  get: async (key, metadata) => {
    const isBuffer = metadata?.type === "arrayBuffer"
    const data = await redis.executor.exec("GET", key)
    return isBuffer ? data.buffer() : data
  },

  put: async (key, value, metadata) => {
    let ttl = expiration * 2
    if (metadata) {
      if (metadata.expirationTtl) {
        ttl = metadata.expirationTtl
      }
      if (metadata.type === "arrayBuffer") {
        value = new Uint8Array(value)
      }
    }

    await redis.sendCommand("SET", key, value, "EX", ttl)
  }
}

const app = new Hono()

app.use("*", logger())
app.use("*", async (c, next) => {
  c.env.GmodExpress = expressStub
  await next()
})

export { app, serve }
