'use strict';

module.exports = {
	port				:		process.env.PORT || 1234,
	mongoURL		:		process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/mealmade',
	cookieSecret:		process.env.COOKIE_SECRET || '#ILikeTurtles !9365$@-+?',
	shopifySecret:	process.env.SHOPIFY_SECRET || '093ea7f51f80efd57ac704bbf9f9f7c3',
	sidecarSecret:	process.env.SIDECAR_SECRET || 'fdb89a5253b657187d07cc832eddd7b2',
	googleKey:			process.env.GOOGLE_KEY,
	mandrillKey:		process.env.MANDRILL_KEY || 'CBKi0mf0tD8ZGQLG-6sSqA',
	sidecarKey:			process.env.SIDECAR_KEY || 'sc_test_j07Qc4oSQWUkkyS0d3wT',
	sendsonarKey:		process.env.SENDSONAR_KEY || '',
	shopifyAPI:			{
		store:		process.env.SHOPIFY_API_STORE || 'mealmade-dev.myshopify.com',
		key:			process.env.SHOPIFY_API_KEY || 'd6d6995669d3a9caef63a599b9bff993',
		password:	process.env.SHOPIFY_API_PASSWORD || '720477ec0adefa459ce5a6aa22205388'
	},
	pickup: {
		address: {
			street1:	'685 Harrison Street',
			street2:	'',
			company:	'Mealmade',
			name:			'',
			city:			'San Francisco',
			zip:			'94107',
			state:		'CA',
			country:	'US',
			location:	{
				latitude:		37.7826998,
				longitude:	-122.3968007
			}
		},
		instructions: 'Crepe-Madame Building. Park at yellow curb in front or lot across street. Go through garage for pickup.'
	},
	errorEmail: 'dennisvan902@yahoo.com'
};