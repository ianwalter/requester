const http = require('http')

const methods = [
  'get',
  'post',
  'put',
  'delete'
]

class Requester {
  constructor (options) {
    // Set the base options for the requester instance.
    this.options = Object.assign({ headers: {} }, options)

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
        // Listen to the data event in order to receive the response body.
        response.on('data', data => {
          // Convert the response body from a Buffer to a String.
          response.rawBody = data
          response.body = data.toString()

          // Automatically parse the response body as JSON if the Content-Type
          // header is application/json.
          if (response.headers['content-type'].includes('application/json')) {
            response.body = JSON.parse(response.body)
          }
        })

        // When the response is complete, resolve the returned Promise with the
        // response.
        response.on('end', () => resolve(response))
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

module.exports = { Requester, requester: new Requester() }
