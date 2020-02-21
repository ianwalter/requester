const http = require('http')
const https = require('https')
const util = require('util')
const { URL } = require('url')
const zlib = require('zlib')
const BaseError = require('@ianwalter/base-error')
const { Print } = require('@ianwalter/print')
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
const defaults = {
  shouldThrow: true,
  logLevel: 'info',
  headers,
  timeout: 60000
}

class HttpError extends BaseError {
  constructor (response) {
    super(response.statusText || 'Request failed')
    this.response = response
  }
}

class Requester {
  constructor (options) {
    // Set the base options for the requester instance.
    this.options = merge({}, defaults, options)

    // Set up a print instance used for printing debug statements.
    this.print = new Print({ level: this.options.logLevel })

    // Add convenience methods to the requester instance.
    methods.forEach(method => {
      this[method] = async (url, opts) => this.request(url, { method, ...opts })
    })
  }

  static shapeRequest (options) {
    // If a body object or array was passed, automatically stringify it and add
    // a JSON Content-Type header.
    if (options.body && typeof options.body === 'object') {
      options.headers['content-type'] = 'application/json'
      options.body = JSON.stringify(options.body)
      options.headers['content-length'] = `${Buffer.byteLength(options.body)}`
    }

    return options
  }

  static shapeResponse (response) {
    // Add the .ok convenience property.
    response.ok = response.statusCode < 400 && response.statusCode > 199

    if (response.body) {
      // Decompress the response if it has a content-encoding header indicating
      // the body is encoded using gzip, deflate, or brotli.
      const encoding = response.headers && response.headers['content-encoding']
      if (encoding) {
        if (encoding === 'gzip') {
          response.body = zlib.gunzipSync(response.body)
        } else if (encoding === 'br') {
          response.body = zlib.brotliDecompressSync(response.body)
        } else if (encoding === 'deflate') {
          response.body = zlib.deflateSync(response.body)
        }
      }

      // If the response content type is text or JSON, set the body Buffer to
      // rawBody and the stringified version of it to body on the response.
      const contentType = response.headers && response.headers['content-type']
      const isJson = contentType && contentType.includes('application/json')
      if (
        !contentType ||
        (contentType && contentType.includes('text/')) ||
        isJson
      ) {
        response.rawBody = response.body
        response.body = response.body.toString()
      }

      // Automatically parse the response body as JSON if the Content-Type
      // header is application/json.
      if (isJson) {
        try {
          response.body = JSON.parse(response.body)
        } catch (err) {
          this.print.error(err)
        }
      }
    }

    return response
  }

  request (url, options) {
    // Combine the base options and argument options into a single object.
    options = merge({}, this.options, options)

    // If a base URL has been configured, use it to build the complete URL.
    url = new URL(url, options.baseUrl)

    // Automatically add request headers based on the request body.
    Requester.shapeRequest(options)
    this.print.debug('Request options', util.inspect(options))

    return new Promise((resolve, reject) => {
      // Create the request.
      const client = url.protocol === 'https:' ? https : http
      const request = client.request(url, options)

      // If an error event was received, reject the returned Promise.
      request.once('error', err => {
        this.print.debug('Request error event', err)
        reject(err)
      })

      request.once('response', response => {
        const bodyChunks = []

        const { statusCode, statusText, headers } = response
        this.print.debug('Response', { statusCode, statusText, headers })

        // Listen to the data event to receive the response body as one or more
        // buffers and collect them into the bodyChunks array.
        response.on('data', data => {
          if (this.options.logLevel === 'debug') {
            this.print.debug('Response data event', data.toString())
          }
          bodyChunks.push(data)
        })

        // When the response is complete, resolve the returned Promise with the
        // response.
        response.on('end', () => {
          this.print.debug('Response end event')

          // Set the response body to a single Buffer by concatenating the
          // chunks in the bodyChunks array.
          if (bodyChunks.length) {
            response.body = Buffer.concat(bodyChunks)
          }

          // Shape the response based on the received response headers.
          Requester.shapeResponse(response)

          if (options.shouldThrow && !response.ok) {
            reject(new HttpError(response))
          } else {
            resolve(response)
          }
        })
      })

      request.on('socket', () => this.print.debug('Request socket event'))

      request.on('close', () => this.print.debug('Request close event'))

      request.on('timeout', () => {
        this.print.debug('Request timeout event')
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
