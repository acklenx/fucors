# FUCORS Proxy

## Overview

FUCORS (Forwarding URLs for CORS) Proxy is a simple proxy server designed to help you access external APIs that don't support HTTPS or don't send the necessary CORS (Cross-Origin Resource Sharing) headers. This is particularly useful for client-side JavaScript applications that need to fetch data from such APIs but are restricted by browser security policies.

This version is specifically refactored to run as a serverless function on Netlify.

## How it Works

The proxy takes a target URL and an HTTP method via its path. When a request is made to the proxy URL:
1. It parses the desired HTTP method and target URL from the request path.
2. It makes a request to the target URL using the specified method, forwarding most headers and the request body (for methods like POST).
3. It then takes the response (headers and body) from the target URL.
4. It adds the necessary CORS headers (e.g., `Access-Control-Allow-Origin: *`) to this response.
5. Finally, it returns this modified response to the original client.

This allows your browser to successfully make cross-origin requests to APIs that would otherwise be blocked.

## Usage

The proxy is accessed via a specific URL format. Once deployed to Netlify, your proxy URL will look like this:

`https://<your-netlify-site-name>.netlify.app/api/{METHOD}/{target_URL}`

Where:
-   `<your-netlify-site-name>` is the name of your site on Netlify.
-   `/api/` is the path configured in `netlify.toml` to route to this function.
-   `{METHOD}`: Specifies the HTTP method to be used for the request to the target API. This can be:
    -   `GET`: For GET requests.
    -   `POST`: For POST requests.
    -   `FETCH`: Can also be used (interchangeably with `GET` or `POST` depending on context, as per original `thingproxy` logic).
-   `{target_URL}`: The full, URL-encoded URL of the API endpoint you want to proxy. For example, if you want to access `http://example.com/data?id=123`, this part would be `http%3A%2F%2Fexample.com%2Fdata%3Fid%3D123`.

    **Note on URL Encoding**: The `{target_URL}` (e.g., `http://example.com/api?query=value`) should be provided directly as part of the path. Your browser or HTTP client will handle any necessary URL encoding for the overall proxy request path. For example, `http://` within the `{target_URL}` part will remain `http://` and does not need to be manually changed to `http%3A%2F%2F` by you when constructing the proxy URL. The examples below show the `target_URL` part already encoded as it would appear in the *final* proxy URL path.

**Examples:**

**GET Request:**
To make a GET request to `http://api.example.com/users/1`:
`https://<your-netlify-site-name>.netlify.app/api/GET/http%3A%2F%2Fapi.example.com%2Fusers%2F1`

You can use this URL directly in your browser, `curl`, or JavaScript `fetch`:
```javascript
fetch('https://<your-netlify-site-name>.netlify.app/api/GET/http%3A%2F%2Fapi.example.com%2Fusers%2F1')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

**POST Request:**
To make a POST request to `http://api.example.com/submit`:
`https://<your-netlify-site-name>.netlify.app/api/POST/http%3A%2F%2Fapi.example.com%2Fsubmit`

Using JavaScript `fetch`:
```javascript
fetch('https://<your-netlify-site-name>.netlify.app/api/POST/http%3A%2F%2Fapi.example.com%2Fsubmit', {
  method: 'POST', // The outer request to the proxy can be POST or GET
  headers: {
    'Content-Type': 'application/json',
    // Add any other headers the target API expects
  },
  body: JSON.stringify({ key: 'value' })
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```
Note: The actual HTTP method used for the request *to the proxy itself* (the outer `fetch` in the example above) can be `GET` or `POST`. The `{METHOD}` part in the URL path determines the method used for the *proxied request* to the `{target_URL}`.

## Deployment

This proxy is designed to be deployed as a serverless function on Netlify.
-   The server logic is in `netlify/functions/server.js`.
-   Netlify's build process will automatically detect and deploy this function.
-   The `netlify.toml` file configures the routing: requests to `/api/*` on your Netlify site will be directed to this serverless function.

## Configuration

Several server-side configurations can be adjusted by modifying the `config.js` file before deployment:
-   `proxy_request_timeout_ms`: Timeout for requests to the target URL (default: 10000ms).
-   `max_request_length`: Maximum allowed length for request or response bodies (default: 100000 characters).
-   `blacklist_hostname_regex`: A regex to blacklist certain hostnames from being proxied (e.g., internal IPs).

Remember to redeploy your Netlify function if you change `config.js`.

## Authentication

The currently deployed version of this proxy on Netlify does not implement any specific authentication mechanism. The experimental `proxy.js` file in the repository contains some authentication logic, but that file is not part of the active Netlify deployment.

## Based On

This project is based on the original `thingproxy` by Freeboard: [thingproxy.freeboard.io](https://github.com/Freeboard/thingproxy).

## License

This project is released under the MIT License. See the `LICENSE` file for details.
