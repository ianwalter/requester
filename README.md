# @ianwalter/requester
> A convenience wrapper around the Node.js [http.request][nodeUrl] API

[![npm page][npmImage]][npmUrl]
[![CI][ciImage]][ciUrl]

## Installation

```console
yarn add @ianwalter/requester
```

## Usage

Simple example GET request:

```js
const { requester } = require('@ianwalter/requester')

const response = await requester.get('http://example.com/api/v1/cats')
```

Example POST request with custom base options:

```js
const { Requester } = require('@ianwalter/requester')

const requester = new Requester({ baseUrl: 'http://example.com/api' })

const response = await requester.post('/v1/cats', { name: 'Nibblet' })
```

Example GET request with a custom request header:

```js
const { requester } = require('@ianwalter/requester')

const options = { headers: { authorization: 'Bearer abc123' } }
const response = await requester.get('http://example.com/api/v1/cats', options)
```

## License

Hippocratic License - See [LICENSE][licenseUrl]

&nbsp;

Created by [Ian Walter](https://ianwalter.dev)

[nodeUrl]: https://nodejs.org/api/http.html#http_http_request_url_options_callback
[npmImage]: https://img.shields.io/npm/v/@ianwalter/requester.svg
[npmUrl]: https://www.npmjs.com/package/@ianwalter/requester
[ciImage]: https://github.com/ianwalter/requester/workflows/CI/badge.svg
[ciUrl]: https://github.com/ianwalter/requester/actions
[licenseUrl]: https://github.com/ianwalter/requester/blob/main/LICENSE
