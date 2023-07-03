const expiration = 60 * 60 * 24
const maxDataSize = 24 * 1024 * 1024

import { app, serve } from "./setup_app.js"

const makeMetadata = (c) => {
  return {
    expirationTtl: expiration * 2,
    metadata: {
      remote: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")
    }
  }
}

const makeUUID = () => {
  return crypto.randomUUID({ disableEntropyCache: true })
}

const parseRange = (total, range) => {
    if (!range || range.indexOf('=') == -1) {
        return null;
    }

    const ranges = range.replace(/bytes=/, "").split(",");

    return ranges.map((part) => {
        const subParts = part.split("-");
        const start = parseInt(subParts[0], 10);
        const end = subParts[1]
            ? parseInt(subParts[1], 10)
            : total;

        const finalStart = isNaN(start) ? 0 : Math.min(Math.max(start, 0), total);
        const finalEnd = isNaN(end) ? total : Math.min(Math.max(end, finalStart), total);

        return { start: finalStart, end: finalEnd };
    });
}


async function validateRequest(c, token) {
  // TODO: Do a sanity check on expiration time too
  const expected = await c.env.GmodExpress.get(`token:${token}` )
  return !!expected
}

async function putData(c, data) {
  const id = makeUUID()
  const metadata = makeMetadata(c)

  try {
    await Promise.all([
      c.env.GmodExpress.put(`size:${id}`, data.byteLength.toString(), metadata),
      c.env.GmodExpress.put(`data:${id}`, data, { ...metadata, type: "arrayBuffer" })
    ])
  } catch (e) {
    console.log("Failed to put data", e)
    return null
  }

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
  const server = makeUUID()
  const client = makeUUID()

  try {
    await Promise.all([
      putToken(c, server),
      putToken(c, client)
    ])

    return c.json({server: server, client: client})

  } catch (e) {
    console.log("Failed to register request", e)
    return c.text("Failed to register request", 500)
  }
}

async function readRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("Invalid Request Parameters", 401)
  }

  const id = c.req.param("id")
  let data = await getData(c, id)
  if (data === null) {
    console.log("No data found for id", id)
    return c.notFound()
  }

  const fullSize = data.byteLength

  let responseCode = 200
  const responseHeaders = {
    "Content-Type": "application/octet-stream",
  }

  const rangeHeader = c.req.header("Range")
  if (rangeHeader) {
    const dataRanges = parseRange(fullSize, rangeHeader)

    if (dataRanges && dataRanges.length > 0) {
      const range = dataRanges[0]

      data = data.slice(range.start, range.end + 1)

      responseCode = 206
      responseHeaders["Accept-Ranges"] = "bytes"
      responseHeaders["Content-Range"] = `bytes ${range.start}-${range.end - 1}/${fullSize}`
    }
  }

  responseHeaders["Content-Length"] = data.byteLength.toString()

  return c.body(data, responseCode, responseHeaders)
}

async function readSizeRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("", 401)
  }

  const id = c.req.param("id")
  const size = await getSize(c, id)
  if (size === null) {
    console.log("No size found for id", id)
    return c.text("Size not found", 404)
  }

  return c.json({size: size})
}

async function writeRequest(c) {
  const token = c.req.param("token")
  const isValid = await validateRequest(c, token)
  if (!isValid) {
    return c.text("Invalid Request Parameters", 401)
  }

  const data = await c.req.arrayBuffer()
  if (data.byteLength > maxDataSize) {
    return c.text("Data exceeds maximum size of " + maxDataSize, 413)
  }

  const id = await putData(c, data)
  if (id === null) {
    return c.text("Failed to store data", 500)
  }

  return c.json({id: id})
}

app.get("/", async () => Response.redirect("https://github.com/CFC-Servers/gm_express", 302));

// V1 Routes
app.get("/v1/register", registerRequest)
app.get("/v1/read/:token/:id", readRequest)
app.get("/v1/size/:token/:id", readSizeRequest)
app.post("/v1/write/:token", writeRequest)
app.get("/v1/revision", async (c) => {
  // NOTE: A revision change does not necessarily imply a breaking change
  //       but it does imply that the user should update
  return c.json({revision: 1});
});

app.get("*", async (c) => c.text("Not Found - you may need to update the gm_express addon!", 406))

export default app
serve(app.fetch)
