// base on https://github.com/Freeboard/thingproxy
const http = require( 'http' ); // Will likely remove or replace uses of this for native http server
const https = require( 'https' );
const config = require( "./config" );
const url = require( "url" );
const request = require( "request" ); // This will be used to make outbound requests

// Helper function to build Netlify-compatible response
function buildResponse(statusCode, body, headers = {}) {
	return {
		statusCode,
		headers,
		body: body || '',
	};
}

function getClientAddress( eventHeaders ) {
	// Netlify provides client IP in 'x-nf-client-connection-ip'
	// Or use 'x-forwarded-for' as a fallback
	return eventHeaders['x-nf-client-connection-ip'] || ( eventHeaders[ 'x-forwarded-for' ] || '' ).split( ',' )[ 0 ];
}

function addCORSHeaders( eventHeaders, responseHeaders = {} ) {
	if (eventHeaders["origin"]) {
		responseHeaders["Access-Control-Allow-Origin"] = eventHeaders["origin"];
	} else {
		responseHeaders["Access-Control-Allow-Origin"] = "*";
	}

	if (eventHeaders["access-control-request-headers"]) {
		responseHeaders["Access-Control-Allow-Headers"] = eventHeaders["access-control-request-headers"];
	}

	if (eventHeaders["access-control-request-method"]) {
		responseHeaders["Access-Control-Allow-Methods"] = eventHeaders["access-control-request-method"];
	}
	return responseHeaders;
}

function sendInvalidURLResponse() {
	return buildResponse(404, "url must be in the form of /<b>GET</b>/{some_url_here}");
}

function sendTooBigResponse() {
	return buildResponse(413, "the content in the request or response cannot exceed " + config.max_request_length + " characters.");
}


// Main handler function for Netlify
exports.handler = async (event, context) => {
	const clientIP = getClientAddress(event.headers);
	// TODO: Log clientIP if needed, or use it for specific logic

	let responseHeaders = addCORSHeaders(event.headers);

	// Return options pre-flight requests right away
	if (event.httpMethod.toUpperCase() === "OPTIONS") {
		return buildResponse(204, null, responseHeaders);
	}

	// Construct the URL from the event path, similar to how req.url was used
	// Netlify event.path usually starts with /.netlify/functions/your-function-name/
	// We need to strip that prefix or adjust the regex.
	// For now, assuming the path is passed correctly or will be adjusted.
	// Example: /GET/http://example.com -> event.path might be /.netlify/functions/server/GET/http://example.com
	// Need to extract the relevant part for fetch_regex

	// Simplistic path extraction, assuming function name is 'server'
    // This might need to be more robust depending on actual Netlify path structure
    const pathForRegex = event.path.replace(/^\/\.netlify\/functions\/[^/]+\//, "/");


	const result = config.fetch_regex.exec(pathForRegex);
//	console.log( { result, pathForRegex, originalPath: event.path } ); // For debugging

	if (result && result.length > 1 && result[2])
	{
	{
		let remoteURL;

		try {
			remoteURL = url.parse(decodeURI(result[2]));
		} catch (e) {
			return sendInvalidURLResponse();
		}

		// We don't support relative links
		if (!remoteURL.host) {
			return buildResponse(404, "relative URLS are not supported", responseHeaders);
		}

		// Naughty, naughty— deny requests to blacklisted hosts
		if (config.blacklist_hostname_regex.test(remoteURL.hostname)) {
			return buildResponse(400, "naughty, naughty...", responseHeaders);
		}

		// We only support http and https
		if (remoteURL.protocol !== "http:" && remoteURL.protocol !== "https:") {
			return buildResponse(400, "only http and https are supported", responseHeaders);
		}

		// Prepare headers for the outgoing request
		const outgoingHeaders = { ...event.headers };
		// Make sure the host header is to the URL we're requesting, not thingproxy
		if (outgoingHeaders["host"]) {
			outgoingHeaders["host"] = remoteURL.host;
		}

		// Remove origin and referer headers.
		delete outgoingHeaders["origin"];
		delete outgoingHeaders["referer"];
		// Remove Netlify specific headers before sending to target
		Object.keys(outgoingHeaders).forEach(key => {
			if (key.startsWith('x-nf-') || key === 'x-forwarded-host' || key === 'x-forwarded-proto') {
				delete outgoingHeaders[key];
			}
		});


		let httpMethod = event.httpMethod;
		if (httpMethod === "GET" && (result[1].toUpperCase().indexOf("POST") === 0)) {
			httpMethod = "POST";
		}

		// TODO: The core request piping logic needs to be refactored
		// to buffer the response from `request()` and then return it
		// in the `buildResponse` format.
		// This is a placeholder for the next step.
		// For now, let's return a message indicating this part is not yet implemented.

		return new Promise((resolve, reject) => {
			const proxyRequestOptions = {
				url: remoteURL,
				method: httpMethod,
				headers: outgoingHeaders,
				timeout: config.proxy_request_timeout_ms,
				strictSSL: false,
				encoding: null, // Important for binary data & correct response buffering
				// body: event.body // Will be added if method is POST/PUT etc.
			};

			if (event.body && (httpMethod === "POST" || httpMethod === "PUT" || httpMethod === "PATCH")) {
                if (event.isBase64Encoded) {
                    proxyRequestOptions.body = Buffer.from(event.body, 'base64');
                } else {
                    proxyRequestOptions.body = event.body;
                }
            }

			// Placeholder: old piping logic removed, new buffered logic to be added
			// For now, return a success message or an error if something basic fails.
			// resolve(buildResponse(200, `Request to ${url.format(remoteURL)} would be made with method ${httpMethod}. Body: ${event.body ? event.body.substring(0,100) + "..." : "empty"}`, responseHeaders));

			// Actual request making and response buffering will go here in the next iteration.
			// This is a complex part.
			console.log(`Making ${httpMethod} request to ${remoteURL.href}`);

			let requestSize = 0;
			if (proxyRequestOptions.body) {
				requestSize = Buffer.byteLength(proxyRequestOptions.body);
				if (requestSize >= config.max_request_length) {
					return resolve(sendTooBigResponse());
				}
			}


			request(proxyRequestOptions, (error, response, body) => {
				if (error) {
					if (error.code === "ENOTFOUND") {
						return resolve(buildResponse(502, `Host for ${url.format(remoteURL)} cannot be found.`, responseHeaders));
					} else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
						console.log("Proxy Request Timeout/Connection Reset (" + url.format(remoteURL) + "): " + error.toString());
						return resolve(buildResponse(504, `Request to ${url.format(remoteURL)} timed out.`, responseHeaders));
					}
					else {
						console.log("Proxy Request Error (" + url.format(remoteURL) + "): " + error.toString());
						return resolve(buildResponse(500, "Proxy request error", responseHeaders));
					}
				}

				if (body.length >= config.max_request_length) {
					return resolve(sendTooBigResponse());
				}

				// Copy all headers from the proxy response to the Netlify response
                // But, ensure our CORS headers are present and take precedence if needed.
                const finalResponseHeaders = { ...responseHeaders };
                for (const [key, value] of Object.entries(response.headers)) {
                    // content-encoding is often problematic with Netlify, let Netlify handle it.
                    // transfer-encoding is also problematic.
                    if (key.toLowerCase() === 'transfer-encoding' || key.toLowerCase() === 'content-encoding') {
                        continue;
                    }
                    finalResponseHeaders[key] = value;
                }


				resolve(buildResponse(response.statusCode, body.toString('base64'), finalResponseHeaders));
			});
		});

	} else {
		return sendInvalidURLResponse();
	}
};

// Remove original server creation and listening
// http.createServer(
//	 function( req, res )
//	 {
//		 req.clientIP = getClientAddress( req );
//		 processRequest( req, res );
//	 } ).listen( config.port );
// console.log( "fucors process started (PID " + process.pid + ") on PORT: " + config.port );
