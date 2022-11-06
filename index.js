import { Router } from 'itty-router'

const router = Router()

async function validateRequest(req, access) {
  const expected = await GmodExpress.get(`token:${access}`)

  return !!expected
}

async function putData(data) {
  const id = crypto.randomUUID()
  await GmodExpress.put(`data:${id}`, data.data)

  return id
}

router.get("/", async () => {
  return Response.redirect("https://github.com/CFC-Servers/gm_express", 302);
})


// Returns two keys, one for the server and one to send to clients
router.get("/register", async () => {
  const server = crypto.randomUUID()
  const client = crypto.randomUUID()
  const now = Date.now()

  await GmodExpress.put(`token:${server}`, now)
  await GmodExpress.put(`token:${client}`, now)

  const response = JSON.stringify({ server: server, client: client })
  return new Response(response, {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })
})

router.get("/:access/:id", async (request) => {
  const { access, id } = request.params
  const isValid = await validateRequest(request, access)

  if (!isValid) {
    return new Response("", { status: 403 })
  }

  let data = await GmodExpress.get(`data:${id}`)

  // If data starts with multi: then download and combine all pieces
  if (data.startsWith("multi:")) {
    let combined = ""

    const pieces = data.substring(6).split(",")
    for (const id of pieces) {
      const piece = await GmodExpress.get(`data:${id}`)
      combined += piece
    }

    data = combined
  }

  const response = JSON.stringify({ data: data })

  return new Response(response, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    }
  })
})

const maxDataSize = 24 * 1024 * 1024

router.post("/:access", async request => {
  const { access } = request.params
  const isValid = await validateRequest(request, access)

  if (!isValid) {
    return new Response("", { status: 403 })
  }

  const struct = await request.json()
  const data = struct.data

  let responseId

  if (data.length < maxDataSize) {
    responseId = crypto.randomUUID()
    await GmodExpress.put(`data:${responseId}`, data)
  } else {
    const chunks = []

    for (let i = 0; i < data.length; i += maxDataSize) {
      const slice = data.slice(i, i + maxDataSize)
      const id = crypto.randomUUID()
      await GmodExpress.put(`data:${id}`, slice)
      chunks.push(id)
    }

    responseId = crypto.randomUUID()
    let combined = chunks.join(",")
    combined = `multi:${combined}`

    await GmodExpress.put(`data:${responseId}`, combined)
  }

  const response = JSON.stringify({ id: responseId })
  return new Response(response, {
    status: 201,
    headers: {
      "Content-Type": "application/json"
    }
  })
})

addEventListener('fetch', (e) => {
  e.respondWith(router.handle(e.request))
})
