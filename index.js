const http = require('http')
const { version } = require('./package.json')
const BaseError = require('@ianwalter/base-error')

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
  constructor (options) {
    // Set the base options for the requester instance.
    this.options = Object.assign({ headers, shouldThrow: true }, options)

    // Add convenience methods to the requester instance.
    methods.forEach(method => {
      this[method] = async (url, opts) => this.request(url, { method, ...opts })
    })
  }

  request (url, options) {
    // Combine the base options and argument options into a single object.
    options = Object.assign({}, this.options, options)

    // If a base URL has been configured, use it to build the complete URL.
    if (options.baseUrl) {
      url = options.baseUrl + url
    }

    // If a body object or array was passed, automatically stringify it and add
    // a JSON Content-Type header.
    if (options.body && typeof options.body === 'object') {
      options.headers['content-type'] = 'application/json'
      options.body = JSON.stringify(options.body)
      options.headers['content-length'] = `${Buffer.byteLength(options.body)}`
    }

    return new Promise((resolve, reject) => {
      // Create the request.
      const request = http.request(url, options, response => {
        const bodyChunks = []

        // Listen to the data event to receive the response body as one or more
        // buffers and collect them into the bodyChunks array.
        response.on('data', data => bodyChunks.push(data))

        // When the response is complete, resolve the returned Promise with the
        // response.
        response.on('end', () => {
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
            if (response.headers['content-type'].includes('application/json')) {
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

      // If an error event was received, reject the returned Promise.
      request.on('error', reject)

      // If a request body was passed, write it to the request.
      if (options.body) {
        request.write(options.body)
      }

      // Complete the request.
      request.end()
    })
  }
}

module.exports = { Requester, requester: new Requester(), HttpError }
