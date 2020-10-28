const http = require('http')
const https = require('https')
const { URL } = require('url')
const zlib = require('zlib')
const querystring = require('querystring')
const { createPrint } = require('@ianwalter/print')
const { version } = require('./package.json')
const merge = require('@ianwalter/merge')

const methods = [
  'get',
  'post',
  'put',
  'delete'
]
const headers = {
  'user-agent': `@ianwalter/requester/${version}`
}
const urlencoded = 'application/x-www-form-urlencoded'
const defaults = {
  shouldThrow: true,
  logLevel: 'info',
  headers,
  timeout: 60000
}
const print = createPrint({ level: 'info', namespace: 'requester' })

class HttpError extends Error {
  constructor (response) {
    super(response?.statusText || 'Request failed')
    this.name = this.constructor.name
    this.response = response

    // Remove rawBody so that it doesn't get printed and flood the console.
    delete this.response?.body?.rawBody
  }
}

class Requester {
  constructor (options) {
    // Set the base options for the requester instance.
    this.options = merge({}, defaults, options)

    // Add convenience methods to the requester instance.
    methods.forEach(method => {
      this[method] = async (url, opts) => this.request(url, { method, ...opts })
    })
  }

  shapeRequest (options) {
    // If a body object or array was passed, automatically stringify it and add
    // a JSON Content-Type header.
    if (options.body && typeof options.body === 'object') {
      print.debug('Request body is JSON', { body: options.body })
      options.headers['content-type'] = 'application/json'
      options.body = JSON.stringify(options.body)
      options.headers['content-length'] = `${Buffer.byteLength(options.body)}`
    }
  }

  shapeResponse (response) {
    // Add the .ok convenience property.
    response.ok = response.statusCode < 400 && response.statusCode > 199

    if (response.body) {
      // Decompress the response if it has a content-encoding header indicating
      // the body is encoded using gzip, deflate, or brotli.
      const encoding = response.headers && response.headers['content-encoding']
      if (encoding) {
        if (encoding === 'gzip') {
          print.debug('Response body is encoded using gzip')
          response.body = zlib.gunzipSync(response.body)
        } else if (encoding === 'br') {
          print.debug('Response body is encoded using brotli')
          response.body = zlib.brotliDecompressSync(response.body)
        } else if (encoding === 'deflate') {
          print.debug('Response body is encoded using deflate')
          response.body = zlib.deflateSync(response.body)
        }
      }

      // If the response content type is text or JSON, set the body Buffer to
      // rawBody and the stringified version of it to body on the response.
      const contentType = response.headers && response.headers['content-type']
      const isJson = contentType && contentType.includes('application/json')
      const isUrlEncoded = contentType && contentType.includes(urlencoded)
      if (
        !contentType ||
        (contentType && contentType.includes('text/')) ||
        isJson ||
        isUrlEncoded
      ) {
        response.rawBody = response.body
        response.body = response.body.toString()
      }

      // Automatically parse the response body as JSON if the Content-Type
      // header is application/json.
      if (isJson) {
        print.debug('Response body is JSON')
        try {
          response.body = JSON.parse(response.body)
        } catch (err) {
          print.error(err)
        }
      } else if (isUrlEncoded) {
        response.body = querystring.parse(response.body)
      }
    }
  }

  request (url, { body, ...options }) {
    // Combine the base options and argument options into a single object.
    options = merge({ body }, this.options, options)

    // If a base URL has been configured, use it to build the complete URL.
    if (options.baseUrl) {
      url = new URL(url, options.baseUrl).toString()
    }

    // Automatically add request headers based on the request body.
    this.shapeRequest(options)
    print.debug('Request', { url, options })

    return new Promise((resolve, reject) => {
      // Create the request.
      const client = url.indexOf('http://') === 0 ? http : https
      const request = client.request(url, options)

      // If an error event was received, reject the returned Promise.
      request.once('error', err => {
        err.request = { url, options }
        reject(err)
      })

      request.once('response', response => {
        const bodyChunks = []

        const { statusCode, statusText, headers } = response
        print.debug('Response', { statusCode, statusText, headers })

        // Listen to the data event to receive the response body as one or more
        // buffers and collect them into the bodyChunks array.
        response.on('data', data => {
          if (this.options.logLevel === 'debug') {
            print.debug('Response data event', data.toString())
          }
          bodyChunks.push(data)
        })

        // When the response is complete, resolve the returned Promise with the
        // response.
        response.on('end', () => {
          print.debug('Response end event')

          // Set the response body to a single Buffer by concatenating the
          // chunks in the bodyChunks array.
          if (bodyChunks.length) {
            response.body = Buffer.concat(bodyChunks)
          }

          // Shape the response based on the received response headers.
          this.shapeResponse(response)

          // Add a request object to the repsonse that has the requested URL
          // and options.
          response.request = { url, options }

          if (options.shouldThrow && !response.ok) {
            reject(new HttpError(response))
          } else {
            resolve(response)
          }
        })
      })

      request.once('timeout', () => {
        print.debug('Request timeout event')
        request.abort()
      })

      // If a request body was passed, write it to the request stream.
      if (options.body) {
        request.write(options.body)
      }

      // Execute the request by ending the stream.
      request.end()
    })
  }
}

module.exports = { Requester, requester: new Requester(), HttpError }
