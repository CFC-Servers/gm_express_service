import { Hono } from "hono"

const app = new Hono()

async function validateRequest(c, access) {
  const expected = await c.env.GmodExpress.get(`token:${access}`)

  return !!expected
}

async function putData(c, data) {
  const id = crypto.randomUUID()
  await c.env.GmodExpress.put(`data:${id}`, data.data)

  return id
}

app.get("/", async () => Response.redirect("https://github.com/CFC-Servers/gm_express", 302));

// Returns two keys, one for the server and one to send to clients
app.get("/register", async (c) => {
  const server = crypto.randomUUID()
  const client = crypto.randomUUID()
  const now = Date.now()

  await c.env.GmodExpress.put(`token:${server}`, now)
  await c.env.GmodExpress.put(`token:${client}`, now)

  return c.json({server: server, client: client})
})

app.get("/:access/:id", async (c) => {
  const access = c.req.param("access")
  const id = c.req.param("id")
  const isValid = await validateRequest(c, access)

  if (!isValid) {
    return c.text("", 403)
  }

  let data = await c.env.GmodExpress.get(`data:${id}`)

  // If data starts with multi: then download and combine all pieces
  if (data.startsWith("multi:")) {
    let combined = ""

    const pieces = data.substring(6).split(",")
    const promises = pieces.map((piece) => c.env.GmodExpress.get(`data:${piece}`))
    await Promise.all(promises).then((results) => data = results.join(""))
  }

  return c.json({data: data})
})

const maxDataSize = 24 * 1024 * 1024

app.post("/:access", async (c) => {
  const access = c.req.param("access")
  const isValid = await validateRequest(c, access)

  if (!isValid) {
    return c.text("", 403)
  }

  const struct = await request.json()
  const data = struct.data

  let responseId

  if (data.length < maxDataSize) {
    responseId = crypto.randomUUID()
    await c.env.GmodExpress.put(`data:${responseId}`, data)
  } else {
    const chunks = []
    const promises = []

    for (let i = 0; i < data.length; i += maxDataSize) {
      const slice = data.slice(i, i + maxDataSize)
      const id = crypto.randomUUID()
      promises.push(c.env.GmodExpress.put(`data:${id}`, slice))
      chunks.push(id)
    }

    await Promise.all(promises)

    responseId = crypto.randomUUID()
    let combined = chunks.join(",")
    combined = `multi:${combined}`

    await c.env.GmodExpress.put(`data:${responseId}`, combined)
  }

  return c.json({id: responseId})
})

export default app
