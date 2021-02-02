import querystring from 'querystring'
import { test } from '@ianwalter/bff'
import nrg from '@ianwalter/nrg'
import rqr from '../index.js'

const { requester, Requester } = rqr

test('GET request for empty response', async t => {
  const app = nrg.createApp({ log: false })
  app.use(ctx => (ctx.status = 204))
  const server = await app.serve()
  try {
    const response = await requester.get(server.url)
    t.expect(response.ok).toBe(true)
    t.expect(response.statusCode).toBe(204)
    t.expect(response.body).toBe(undefined)
  } finally {
    await server.close()
  }
})

test('GET request for text', async t => {
  const app = nrg.createApp({ log: false })
  app.use(ctx => (ctx.body = 'test'))
  const server = await app.serve()
  try {
    const response = await requester.get(server.url)
    t.expect(response.ok).toBe(true)
    t.expect(response.statusCode).toBe(200)
    t.expect(response.body).toBe('test')
  } finally {
    await server.close()
  }
})

test('GET request for JSON', async t => {
  const app = nrg.createApp({ log: false })
  const body = { message: 'test' }
  app.use(ctx => (ctx.body = body))
  const server = await app.serve()
  try {
    const response = await requester.get(server.url)
    t.expect(response.ok).toBe(true)
    t.expect(response.statusCode).toBe(200)
    t.expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('POST request with JSON', async t => {
  const app = nrg.createApp({ log: false })
  const body = { chef: 'Sanchez', born: new Date() }
  app.use(ctx => {
    ctx.status = ctx.request.body.chef === body.chef ? 201 : 400
    ctx.body = ctx.request.body
  })
  const server = await app.serve()
  try {
    const response = await requester.post(server.url, { body })
    t.expect(response.ok).toBe(true)
    t.expect(response.statusCode).toBe(201)
    t.expect(response.body).toEqual({ ...body, born: body.born.toISOString() })
  } finally {
    await server.close()
  }
})

test('POST request for form data', async t => {
  const body = { artist: 'Peter Bjorn and John', song: 'Music' }
  const app = nrg.createApp({ log: false })
  app.use(ctx => {
    ctx.set('content-type', 'application/x-www-form-urlencoded')
    ctx.body = querystring.stringify(body)
  })
  const server = await app.serve()
  try {
    const response = await requester.post(server.url)
    t.expect(response.ok).toBe(true)
    t.expect(response.statusCode).toBe(200)
    t.expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('Unauthorized GET request', async t => {
  const app = nrg.createApp({ log: false })
  app.use(ctx => (ctx.status = 401))
  const server = await app.serve()
  try {
    await requester.get(server.url)
  } catch (err) {
    t.expect(err.response.ok).toBe(false)
    t.expect(err.response.statusCode).toBe(401)
    t.expect(err.response.body).toBe('Unauthorized')
  } finally {
    await server.close()
  }
})

test('Bad Request with shouldThrow = false', async t => {
  const app = nrg.createApp({ log: false })
  const requester = new Requester({ shouldThrow: false })
  const body = { message: 'Ungodly gorgeous, buried in a chorus' }
  app.use(ctx => {
    ctx.status = 400
    ctx.body = body
  })
  const server = await app.serve()
  try {
    const response = await requester.get(server.url)
    t.expect(response.ok).toBe(false)
    t.expect(response.statusCode).toBe(400)
    t.expect(response.body).toEqual(body)
  } finally {
    await server.close()
  }
})

test('HTTPS request', async t => {
  const requestbin = 'https://en5femwzf9sry.x.pipedream.net'
  const body = { success: true }
  let response = await requester.get(requestbin)
  t.expect(response.statusCode).toBe(200)
  t.expect(response.body).toEqual(body)
  response = await requester.post(requestbin, { body })
  t.expect(response.statusCode).toBe(200)
  t.expect(response.body).toEqual(body)
})

test('Redirect', async t => {
  const app = nrg.createApp({ log: false })

  app.get('/', ctx => {
    ctx.set('location', server.url + '/a')
    ctx.status = 301
  })

  app.get('/a', ctx => (ctx.body = 'Success!'))

  const server = await app.serve()

  try {
    const response = await requester.get(server.url)
    t.expect(response.statusCode).toBe(200)
    t.expect(response.body).toBe('Success!')
  } finally {
    await server.close()
  }
})

test('Get request options from response', async t => {
  const app = nrg.createApp({ log: false })
  app.use(ctx => (ctx.status = 204))
  const server = await app.serve()
  const headers = { 'x-test': 123 }
  try {
    const { statusCode, request } = await requester.get(server.url, { headers })
    t.expect(statusCode).toBe(204)
    t.expect(request.options.headers['x-test']).toEqual(headers['x-test'])
  } finally {
    await server.close()
  }
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
