import { Hono } from "hono"
const app = new Hono()
const expiration = 60 * 60 * 24
const maxDataSize = 24 * 1024 * 1024

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

  return !!expected
}

async function putData(c, data) {
  const id = crypto.randomUUID()
  const metadata = makeMetadata(c)

  await Promise.all([
    c.env.GmodExpress.put(`size:${id}`, data.byteLength, metadata),
    c.env.GmodExpress.put(`data:${id}`, data, { ...metadata, type: "arrayBuffer" })
  ])

  return id
}

async function putToken(c, token) {
  const now = Date.now().toString()
  await c.env.GmodExpress.put(`token:${token}`, now, makeMetadata(c))
}

async function getData(c, id) {
  return await c.env.GmodExpress.get(`data:${id}`, { type: "arrayBuffer" })
}

async function getSize(c, id) {
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
  return c.body(data, 200, { "Content-Type": "application/octet-stream" })
}

async function readSizeRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("", 401)
  }

  const id = c.req.param("id")
  return c.json({size: await getSize(c, id)})
}

async function writeRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("", 401)
  }

  const data = await c.req.arrayBuffer()
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
  console.log( c.env )
  return c.json({revision: 1});
});

app.get("*", async (c) => c.text("Not Found - you may need to update the gm_express addon!", 406))

console.log("yeet")
export default app
