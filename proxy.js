const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Set up a simple proxy server
app.get('/', async (req, res) => {
	try {
		// Forward the request to the desired API endpoint
		const url = req.query.url;
		const response = await fetch(url);

		// Set the CORS headers to allow any origin to access the API
		res.set('Access-Control-Allow-Origin', '*');
		res.set('Access-Control-Allow-Methods', 'GET');
		res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

		// Send the API response back to the client
		const data = await response.json();
		res.json(data);
	} catch (error) {
		console.error(error);
		res.status(500).send(error.message);
	}
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
