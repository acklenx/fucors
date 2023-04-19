const express = require( 'express' ),
	request = require( 'request' ),
	fucors  = express();

fucors.all( '*', function( req, res, next )
{
	console.log("request received");
	// Set CORS headers: allow all origins, methods, and headers: you may want to lock this down in a production environment
	res.header( "Access-Control-Allow-Origin", "*" );
	res.header( "Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE" );
	res.header( "Access-Control-Allow-Headers", req.header( 'access-control-request-headers' ) );

	if( req.method === 'OPTIONS' )
	{
		res.send(); // CORS Preflight
	}
	else
	{
		const targetURL = req.header( 'url' );
		if( !targetURL )
		{
			res.send( 500, { error: 'FU! There is no Target-Endpoint header in the request (url)' } );
		}
		else
		{
			const authKey = req.header( 'qla' );
			console.log( "authKey", authKey );
			if( !authKey )
			{
				res.send( 500, { error: "FU!  -hugs and kisses, CORS" } );
			}
			else if( authKey.length !== 7 )
			{
				if( authKey.length < 10 )
				{
					res.send( 500, { error: "FU! API key too short. (hint: they are at least 10 alphanumeric characters" } );
				}
				else
				{
					res.send( 500, { error: "FU! Bad API key. Has it expired?" } );
				}
			}
			else
			{

				console.log( "req.url", req.url );
				request(
					{ url: targetURL + req.url, method: req.method, json: req.body },
					function( error, response, body )
					{
						if( error )
						{
							console.error( 'error: ' + response.statusCode );
						}
					}
				).pipe( res );
			}
		}
	}
} );

module.exports = {
	fucors
};
