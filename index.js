import { Hono } from "hono"

const app = new Hono()
const expiration = 60 * 60 * 24
const maxDataSize = 24 * 1024 * 1024

const isSelfHost = process.env.SELF_HOST === "1"
console.log(process.env.SELF_HOST, isSelfHost)

if (isSelfHost === true) {
  console.log("Is self host, setting env")
  // If self hosting, use our KeyDB in place of KV

  const Database = require("bun:sqlite").Database
  const db = new Database(":memory:")
  db.run(
    "CREATE TABLE express (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, value BLOB, expiration INTEGER)"
  )

  const expressStub = {
    get: (key, metadata) => {
      return new Promise((resolve, reject) => {
        console.log("(db) GET", key)
        const row = db.query("SELECT value FROM express WHERE key = $key").get({ $key: key })
        console.log(row)

        const isBuffer = metadata && (metadata.type === "arrayBuffer")

        const val = row.value
        if (isBuffer) {
          console.log("Returning buffer", key)
          resolve(Buffer.from(val, "base64"))
        } else {
          console.log("Returning string", key)
          resolve(val)
        }
      })
    },

    put: (key, value, metadata) => {
      console.log("(db) PUT", key, metadata)
      let ttl = expiration
      let isbuffer = false
      if (metadata) {
        if (metadata.expirationTtl) {
          ttl = metadata.expirationTtl
        }
        if (metadata.type === "arrayBuffer") {
          isbuffer = true
        }
      }
      return new Promise((resolve, reject) => {
        const ex = Date.now() + ttl
        if (isbuffer === true) {
          value = Buffer.from(value)
        }
        db.run( "INSERT INTO express (key, value, expiration) VALUES ($key, $value, $expiration)", { $key: key, $value: value, $expiration: ex })
        resolve()
      })
    }
  }

  // setInterval(() => {
  //   db.run("DELETE FROM express WHERE expiration < ?", Date.now())
  // }, 1000 * 10 )

  app.use("*", async (c, next) => {
    c.env.GmodExpress = expressStub

    await next()
  })
} else {
  console.log("Is not self host, using KV")
}

const makeMetadata = (c, extraMetadata) => {
  return {
    expirationTtl: expiration,
    metadata: {
      ...extraMetadata,
      remote: c.req.header("CF-Connecting-IP")
    }
  }
}

async function validateRequest(c, token) {
  // TODO: Do a sanity check on expiration time too
  const expected = await c.env.GmodExpress.get(`token:${token}`)
  console.log("Allowed", !!expected)

  return !!expected
}

async function putData(c, data) {
  const id = crypto.randomUUID()
  const metadata = makeMetadata(c)

  console.log("PUT", `size:${id}`, data.byteLength)
  console.log("PUT", `data:${id}`)

  await Promise.all([
    c.env.GmodExpress.put(`size:${id}`, data.byteLength, metadata),
    c.env.GmodExpress.put(`data:${id}`, data, { ...metadata, type: "arrayBuffer" })
  ])

  return id
}

async function putToken(c, token) {
  const now = Date.now().toString()
  console.log("PUT", `token:${token}`, now)
  await c.env.GmodExpress.put(`token:${token}`, now, makeMetadata(c))
}

async function getData(c, id) {
  console.log("GET", `data:${id}`)
  return await c.env.GmodExpress.get(`data:${id}`, { type: "arrayBuffer" })
}

async function getSize(c, id) {
  console.log("GET", `size:${id}`)
  return await c.env.GmodExpress.get(`size:${id}`)
}

async function registerRequest(c) {
  const server = crypto.randomUUID()
  const client = crypto.randomUUID()

  await Promise.all([
    putToken(c, server),
    putToken(c, client)
  ])

  return c.json({server: server, client: client})
}

async function readRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("", 401)
  }

  const id = c.req.param("id")
  const data = await getData(c, id)
  console.log("Retrieved data, preparing to send", data.byteLength)
  return c.body(data, 200, { "Content-Type": "application/octet-stream" })
}

async function readSizeRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("", 401)
  }

  const id = c.req.param("id")
  console.log("Getting size for", id)
  return c.json({size: await getSize(c, id)})
}

async function writeRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("", 401)
  }

  console.log(c.req)
  const data = await c.req.arrayBuffer()
  console.log(data)
  console.log("Got data", data.byteLength)
  if (data.byteLength > maxDataSize) {
    return c.text("Data exceeds maximum size of " + maxDataSize, 413)
  }

  const id = await putData(c, data)
  return c.json({id: id})
}

app.get("/", async () => Response.redirect("https://github.com/CFC-Servers/gm_express", 302));

// V1 Routes
app.get("/v1/register", registerRequest)
app.get("/v1/read/:token/:id", readRequest)
app.get("/v1/size/:token/:id", readSizeRequest)
app.post("/v1/write/:token", writeRequest)
app.get("/v1/revision", async (c) => {
  return c.json({revision: 1});
});

app.get("*", async (c) => c.text("Not Found - you may need to update the gm_express addon!", 406))

const exported = isSelfHost ? { port: 3000, fetch: app.fetch } : app
console.log(exported)
export default (isSelfHost ? { port: 3000, fetch: app.fetch } : app)
