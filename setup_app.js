// This file is replaced by docker/selfhost.js in a self-hosted environment
import { Hono } from "hono"

const app = new Hono()
const serve = () => {}
const expiration = 60 * 60 * 48

export { app, serve, expiration }
