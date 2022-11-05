import { Router } from "itty-router"

// Create a new router
const router = Router()

async function validateRequest(req, access) {
  const expected = await GmodExpress.get(`token:${access}`)

  return !!expected
}

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

  const data = await GmodExpress.get(`data:${id}`)
  const response = JSON.stringify({ data: data })

  return new Response(response, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    }
  })
})

router.post("/:access", async request => {
  const { access } = request.params
  const isValid = await validateRequest(request, access)

  if (!isValid) {
    return new Response("", { status: 403 })
  }

  const data = await request.json()
  const id = crypto.randomUUID()
  await GmodExpress.put(`data:${id}`, data.data)

  const response = JSON.stringify({ id: id })

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
