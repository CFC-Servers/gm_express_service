import { Hono } from "npm:hono@^4.6.0"
import { logger } from "npm:hono@^4.6.0/logger"
import { LRUCache } from "npm:lru-cache@^11.0.0"

const expiration = parseInt(Deno.env.get("GM_EXPRESS_EXPIRATION") || "") || 5 * 60
const tokenExpiration = 24 * 60 * 60
const store = new LRUCache({ ttl: expiration * 1000, max: 1024 })
const tokenStore = new LRUCache({ ttl: tokenExpiration * 1000, max: 4096 })
const bucketStore = new LRUCache({ ttl: expiration * 1000, max: 1024 })

// Emulates the GmodExpress KV namespace
const expressStub = {
  get: async (key, _metadata) => {
    if (key.startsWith("token:")) return tokenStore.get(key)
    return store.get(key)
  },

  put: async (key, value, _metadata) => {
    if (key.startsWith("token:")) {
      tokenStore.set(key, value)
    } else {
      store.set(key, value)
    }
  }
}

// Emulates the ExpressV1Bucket R2 bucket, values are stored as bytes
const bucketStub = {
  get: async (key) => {
    const value = bucketStore.get(key)
    if (value === undefined) return null

    return {
      arrayBuffer: async () => value.buffer,
      text: async () => new TextDecoder().decode(value)
    }
  },

  put: async (key, value) => {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)
    bucketStore.set(key, bytes)
  }
}

const app = new Hono()

app.use("*", logger())
app.use("*", async (c, next) => {
  c.env = { GmodExpress: expressStub, ExpressV1Bucket: bucketStub }
  await next()
})

const serve = (handler) => Deno.serve(handler)

export { app, serve, expiration }
