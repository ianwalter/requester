const http = require('http')
const https = require('https')
const { URL } = require('url')
const BaseError = require('@ianwalter/base-error')
const { Print } = require('@ianwalter/print')
const { version } = require('./package.json')

const headers = {
  'user-agent': `@ianwalter/requester/${version}`
}
const methods = [
  'get',
  'post',
  'put',
  'delete'
]

class HttpError extends BaseError {
  constructor (response) {
    super(response.statusText)
    this.response = response
  }
}

class Requester {
  constructor (options = {}) {
    // Set the base options for the requester instance.
    this.options = Object.assign({ headers, shouldThrow: true }, options)

    // Set up a print instance used for printing debug statements.
    this.print = new Print({ level: options.logLevel || 'info' })

    // Add convenience methods to the requester instance.
    methods.forEach(method => {
      this[method] = async (url, opts) => this.request(url, { method, ...opts })
    })
  }

  request (url, options) {
    // Combine the base options and argument options into a single object.
    options = Object.assign({}, this.options, options)

    // If a base URL has been configured, use it to build the complete URL.
    url = new URL(url, options.baseUrl)

    // Set the host header.
    options.headers.host = url.host

    // If a body object or array was passed, automatically stringify it and add
    // a JSON Content-Type header.
    if (options.body && typeof options.body === 'object') {
      options.headers['content-type'] = 'application/json'
      options.body = JSON.stringify(options.body)
      options.headers['content-length'] = `${Buffer.byteLength(options.body)}`
    }

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

        this.print.debug('Response', response)

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
          this.print.debug('Response end event', response)

          // Add the .ok convenience property.
          response.ok = response.statusCode < 400 && response.statusCode > 199

          if (bodyChunks.length) {
            // Concatenate the buffers in the bodyChunks array into a single
            // buffer.
            response.rawBody = Buffer.concat(bodyChunks)

            // Convert the body buffer into a string.
            response.body = response.rawBody.toString()

            // Automatically parse the response body as JSON if the Content-Type
            // header is application/json.
            if (
              response.headers &&
              response.headers['content-type'] &&
              response.headers['content-type'].includes('application/json')
            ) {
              response.body = JSON.parse(response.body)
            }
          }

          if (options.shouldThrow && !response.ok) {
            reject(new HttpError(response))
          } else {
            resolve(response)
          }
        })
      })

      request.on('socket', () => this.print.debug('Request socket event'))

      request.on('close', () => this.print.debug('Request close event'))

      // If a request body was passed, write it to the request.
      if (options.body) {
        request.write(options.body)
      }

      // Execute the request.
      request.end()
    })
  }
}

module.exports = { Requester, requester: new Requester(), HttpError }
