const querystring = require('querystring')
const { test } = require('@ianwalter/bff')
const { createApp } = require('@ianwalter/nrg')
const { requester, Requester } = require('..')

test('GET request for empty response', async ({ expect }) => {
  const app = createApp({ log: false })
  app.use(ctx => (ctx.status = 204))
  const { server } = await app.start()
  try {
    const response = await requester.get(server.url)
    expect(response.ok).toBe(true)
    expect(response.statusCode).toBe(204)
    expect(response.body).toBe(undefined)
  } finally {
    await server.close()
  }
})

test('GET request for text', async ({ expect }) => {
  const app = createApp({ log: false })
  app.use(ctx => (ctx.body = 'test'))
  const { server } = await app.start()
  try {
    const response = await requester.get(server.url)
    expect(response.ok).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('test')
  } finally {
    await server.close()
  }
})

test('GET request for JSON', async ({ expect }) => {
  const app = createApp({ log: false })
  const body = { message: 'test' }
  app.use(ctx => (ctx.body = body))
  const { server } = await app.start()
  try {
    const response = await requester.get(server.url)
    expect(response.ok).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('POST request with JSON', async ({ expect }) => {
  const app = createApp({ log: false })
  const body = { chef: 'Sanchez' }
  app.use(ctx => {
    ctx.status = ctx.request.body.chef === body.chef ? 201 : 400
    ctx.body = ctx.request.body
  })
  const { server } = await app.start()
  try {
    const response = await requester.post(server.url, { body })
    expect(response.ok).toBe(true)
    expect(response.statusCode).toBe(201)
    expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('POST request for form data', async ({ expect }) => {
  const body = { artist: 'Peter Bjorn and John', song: 'Music' }
  const app = createApp({ log: false })
  app.use(ctx => {
    ctx.set('content-type', 'application/x-www-form-urlencoded')
    ctx.body = querystring.stringify(body)
  })
  const { server } = await app.start()
  try {
    const response = await requester.post(server.url)
    expect(response.ok).toBe(true)
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('Unauthorized GET request', async ({ expect }) => {
  const app = createApp({ log: false })
  app.use(ctx => (ctx.status = 401))
  const { server } = await app.start()
  try {
    await requester.get(server.url)
  } catch (err) {
    expect(err.response.ok).toBe(false)
    expect(err.response.statusCode).toBe(401)
    expect(err.response.body).toBe('Unauthorized')
  } finally {
    await server.close()
  }
})

test('Bad Request with shouldThrow = false', async ({ expect }) => {
  const app = createApp({ log: false })
  const requester = new Requester({ shouldThrow: false })
  const body = { message: 'Ungodly gorgeous, buried in a chorus' }
  app.use(ctx => {
    ctx.status = 400
    ctx.body = body
  })
  const { server } = await app.start()
  try {
    const response = await requester.get(server.url)
    expect(response.ok).toBe(false)
    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('HTTPS request', async ({ expect }) => {
  const requestbin = 'https://en5femwzf9sry.x.pipedream.net'
  const body = { success: true }
  let response = await requester.get(requestbin)
  expect(response.statusCode).toBe(200)
  expect(response.body).toEqual(body)
  response = await requester.post(requestbin, { body })
  expect(response.statusCode).toBe(200)
  expect(response.body).toEqual(body)
})

// TODO:
// test('GET gzipped response', async ({ expect }) => {
//   const largeJsonBody = require('./largeJsonBody.json')
//   const server = await createExpressServer()
//   const headers = { 'accept-encoding': 'gzip, deflate, br' }
//   server.use((req, res) => res.json(largeJsonBody))
//   const response = await requester.get(server.url, { headers })
//   expect(typeof response.body).toBe('object')
//   await server.close()
// })
