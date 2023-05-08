// base on https://github.com/Freeboard/thingproxy
const http = require( 'http' );
const https = require( 'https' );
const config = require( "./config" );
const url = require( "url" );
const request = require( "request" );

function addCORSHeaders( req, res )
{

	if( req.method.toUpperCase() === "OPTIONS" )
	{
		if( req.headers[ "access-control-request-headers" ] )
		{
			res.setHeader( "Access-Control-Allow-Headers", req.headers[ "access-control-request-headers" ] );
		}

		if( req.headers[ "access-control-request-method" ] )
		{
			res.setHeader( "Access-Control-Allow-Methods", req.headers[ "access-control-request-method" ] );
		}
	}

	if( req.headers[ "origin" ] )
	{
		res.setHeader( "Access-Control-Allow-Origin", req.headers[ "origin" ] );
	}
	else
	{
		res.setHeader( "Access-Control-Allow-Origin", "*" );
	}
}

function writeResponse( res, httpCode, body )
{
	res.statusCode = httpCode;
	res.end( body );
}

function sendInvalidURLResponse( res )
{
	return writeResponse( res, 404, "url must be in the form of /<b>GET</b>/{some_url_here}" );
}

function sendTooBigResponse( res )
{
	return writeResponse( res, 413, "the content in the request or response cannot exceed " + config.max_request_length + " characters." );
}

function getClientAddress( req )
{
	return ( req.headers[ 'x-forwarded-for' ] || '' ).split( ',' )[ 0 ]
		|| req.connection.remoteAddress;
}

function processRequest( req, res )
{
	addCORSHeaders( req, res );

	// Return options pre-flight requests right away
	if( req.method.toUpperCase() === "OPTIONS" )
	{
		return writeResponse( res, 204 );
	}

	const result = config.fetch_regex.exec( req.url );
//	console.log( { result } );
	if( result && result.length > 1 && result[ 2 ] )
	{
		let remoteURL;

		try
		{
			remoteURL = url.parse( decodeURI( result[ 2 ] ) );
		}
		catch( e )
		{
			return sendInvalidURLResponse( res );
		}

		// We don't support relative links
		if( !remoteURL.host )
		{
			return writeResponse( res, 404, "relative URLS are not supported" );
		}

		// Naughty, naughty— deny requests to blacklisted hosts
		if( config.blacklist_hostname_regex.test( remoteURL.hostname ) )
		{
			return writeResponse( res, 400, "naughty, naughty..." );
		}

		// We only support http and https
		if( remoteURL.protocol !== "http:" && remoteURL.protocol !== "https:" )
		{
			return writeResponse( res, 400, "only http and https are supported" );
		}

		// Make sure the host header is to the URL we're requesting, not thingproxy
		if( req.headers[ "host" ] )
		{
			req.headers[ "host" ] = remoteURL.host;
		}

		// Remove origin and referer headers. TODO: This is a bit naughty, we should remove at some point.
		delete req.headers[ "origin" ];
		delete req.headers[ "referer" ];

		if( req.method === "GET" && ( result[ 1 ].toUpperCase().indexOf( "POST" ) === 0 ) )
		{
			//console.log( `setting ${ req.method } to POST for request: ${ result[ 0 ] } ` );
			req.method = "POST";
		}

		const proxyRequest = request( {
										  url: remoteURL,
										  headers: req.headers,
										  method: req.method,
										  timeout: config.proxy_request_timeout_ms,
										  strictSSL: false
									  } );

		proxyRequest.on( 'error', function( err )
		{

			if( err.code === "ENOTFOUND" )
			{
				return writeResponse( res, 502, "Host for " + url.format( remoteURL ) + " cannot be found." );
			}
			else
			{
				console.log( "Proxy Request Error (" + url.format( remoteURL ) + "): " + err.toString() );
				return writeResponse( res, 500 );
			}

		} );

		let requestSize = 0;
		let proxyResponseSize = 0;

		req.pipe( proxyRequest ).on( 'data', function( data )
		{

			requestSize += data.length;

			if( requestSize >= config.max_request_length )
			{
				proxyRequest.end();
				return sendTooBigResponse( res );
			}
		} ).on( 'error', function( err )
		{
			writeResponse( res, 500, "Stream Error" + err.toString() );
		} );

		proxyRequest.pipe( res ).on( 'data', function( data )
		{

			proxyResponseSize += data.length;

			if( proxyResponseSize >= config.max_request_length )
			{
				proxyRequest.end();
				return sendTooBigResponse( res );
			}
		} ).on( 'error', function( err )
		{
			writeResponse( res, 500, "Stream Error" + err.toString() );
		} );
	}
	else
	{
		return sendInvalidURLResponse( res );
	}
}


http.createServer(
	function( req, res )
	{
		req.clientIP = getClientAddress( req );
		processRequest( req, res );
	} ).listen( config.port );
console.log( "fucors process started (PID " + process.pid + ") on PORT: " + config.port );
