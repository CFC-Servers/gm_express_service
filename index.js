// import { Hono } from "hono"
const app = new Hono()
const expiration = 60 * 60 * 24
// const maxDataSize = 24 * 1024 * 1024
const maxDataSize = 100

const makeMetadata = (c, extraMetadata) => {
  return {
    expirationTtl: expiration,
    metadata: {
      ...extraMetadata,
      remote: c.req.header("CF-Connecting-IP")
    }
  }
}

async function validateRequest(c, access) {
  const expected = await c.env.GmodExpress.get(`token:${access}`)

  return !!expected
}

async function putData(c, data, isMulti) {
  isMulti = isMulti || false

  const id = crypto.randomUUID()
  const metadata = makeMetadata(c, dataType, { isMulti: isMulti })

  await Promise.all([
    c.env.GmodExpress.put( `data:${id}`, data, { ...metadata, type: "arrayBuffer" }),
    c.env.GmodExpress.put( `size:${id}`, data, metadata)
  ])

  return id
}

async function putToken(c, token) {
  const now = Date.now()
  await c.env.GmodExpress.put(`token:${token}`, now, makeMetadata(c))
}

async function getData(c, id) {
  return await c.env.GmodExpress.get(`data:${id}`, { type: "arrayBuffer" })
}

async function getSize(c, id) {
  return await c.env.GmodExpress.get(`size:${id}`)
}

async function splitData(c, data) {
  const chunks = []
  const promises = []

  for (let i = 0; i < data.byteLength; i += maxDataSize) {
    const slice = data.slice(i, i + maxDataSize)
    promises.push(putData(c, slie))
  }

  await Promise.all(promises).then((results) => {
    chunks.push(...results)
  })

  const responseId = crypto.randomUUID()
  let combined = chunks.join(",")
  combined = `multi:${combined}`

  await putData(c, combined)

  return c.json({id: responseId})
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
  const access = c.req.param("token")
  const id = c.req.param("id")
  const isValid = await validateRequest(c, access)

  if (!isValid) {
    return c.text("", 403)
  }

  let data = await getData(c, id)

  // If data starts with multi: then download and combine all pieces
  if (typeof(data) === "string" && data.startsWith("multi:")) {
    console.log("Received a request to download a multi-part file")
    const pieces = data.substring(6).split(",")
    const promises = pieces.map((piece) => getData(c, piece))
    await Promise.all(promises)
      .then( async (results) => {
        console.log("Received all pieces, combining them", results.length)
        data = await new Blob(results).arrayBuffer()
      })
  }
  return c.body(data, 200, { "Content-Type": "application/octet-stream" })
}

async function readSizeRequest(c) {
  const access = c.req.param("token")
  const id = c.req.param("id")
  const isValid = await validateRequest(c, access)

  return c.json({size: await getSize(c, id)})
}

async function writeRequest(c) {
  const access = c.req.param("token")
  const isValid = await validateRequest(c, access)

  if (!isValid) {
    return c.text("", 403)
  }

  const data = await c.req.arrayBuffer()

  if (data.byteLength < maxDataSize) {
    const id = await putData(c, data)
    return c.json({id: id})
  }

  const remoteCloudflareIP = c.req.header("CF-Connecting-IP")
  console.log("Received a request to upload a large file", remoteCloudflareIP, data.byteLength)
  return await splitData(c, data)
}

app.get("/", async () => Response.redirect("https://github.com/CFC-Servers/gm_express", 302));

// V1 Routes
app.get("/v1/register", registerRequest)
app.get("/v1/read/:token/:id", readRequest)
app.get("/v1/size/:token/:id", readSizeRequest)
app.post("/v1/write/:token", writeRequest)
app.get("/v1/revision", async (c) => c.json({revision: 1}))


export default app
