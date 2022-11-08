import { Hono } from "hono"
const app = new Hono()

async function validateRequest(c, access) {
  const expected = await c.env.GmodExpress.get(`token:${access}`)

  return !!expected
}

async function putToken(c, token) {
  const now = Date.now()
  await c.env.GmodExpress.put(`token:${token}`, now)
}

async function putData(c, data) {
  const id = crypto.randomUUID()
  await Promise.all([
    c.env.GmodExpress.put(`data:${id}`, data),
    c.env.GmodExpress.put(`size:${id}`, data.length)
  ])

  return id
}

async function getData(c, id) {
  return await c.env.GmodExpress.get(`data:${id}`)
}

async function getSize(c, id) {
  return await c.env.GmodExpress.get(`size:${id}`)
}

async function splitData(c, data) {
  const chunks = []
  const promises = []

  for (let i = 0; i < data.length; i += maxDataSize) {
    const slice = data.slice(i, i + maxDataSize)
    const id = await putData(c, slice)
    chunks.push(id)
  }

  await Promise.all(promises)

  console.log( "Split into " + chunks.length + " pieces" )

  const responseId = crypto.randomUUID()
  let combined = chunks.join(",")
  combined = `multi:${combined}`

  await putData(c, combined)

  return c.json({id: responseId})
}

app.get("/", async () => Response.redirect("https://github.com/CFC-Servers/gm_express", 302));

// Returns two keys, one for the server and one to send to clients
app.get("/register", async (c) => {
  const server = crypto.randomUUID()
  const client = crypto.randomUUID()

  await Promise.all([
    putToken(c, server),
    putToken(c, client)
  ])

  return c.json({server: server, client: client})
})

app.get("/:access/:id", async (c) => {
  const access = c.req.param("access")
  const id = c.req.param("id")
  const isValid = await validateRequest(c, access)

  if (!isValid) {
    return c.text("", 403)
  }

  let data = await getData(c, id)

  // If data starts with multi: then download and combine all pieces
  if (data.startsWith("multi:")) {
    const pieces = data.substring(6).split(",")
    const promises = pieces.map((piece) => getData(c, piece))
    await Promise.all(promises).then((results) => data = results.join(""))
  }

  return c.json({data: data})
})

app.get("/:access/:id/size", async (c) => {
  const access = c.req.param("access")
  const id = c.req.param("id")
  const isValid = await validateRequest(c, access)

  return c.json({size: await getSize(c, id)})
})

const maxDataSize = 24 * 1024 * 1024

app.post("/:access", async (c) => {
  const access = c.req.param("access")
  const isValid = await validateRequest(c, access)

  if (!isValid) {
    return c.text("", 403)
  }

  const struct = await c.req.json()
  const data = struct.data

  if (data.length < maxDataSize) {
    const id = await putData(c, data)
    return c.json({id: id})
  }

  const remoteCloudflareIP = c.req.header("CF-Connecting-IP")
  console.log( "Data is too large (" + data.length + " bytes from " + remoteCloudflareIP + "), splitting into pieces..." )
  return await splitData(c, data)
})

export default app
