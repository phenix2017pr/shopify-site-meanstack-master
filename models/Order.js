'use strict';

var mongoose      = require('mongoose')
  , Schema        = mongoose.Schema;

var OrderSchema = new Schema({
	id:					{ type: Number, required: true, unique: true, index: true },
	number:			{ type: Number, required: true, unique: true },
	status:			{ type: String, required: true, default: 'pending', enum: ['pending', 'dispatching', 'dispatched', 'fulfilled', 'canceled'] },
	created:		{ type: Date, default: Date.now },
	updated:		{ type: Date, default: null },
	canceled:		{ type: Date, default: null },
	fulfilled:	{ type: Boolean, default: false },
	price:			{
		subtotal:	{ type: Number, default: 0 },
		discount:	{ type: Number, default: 0 },
		delivery:	{ type: Number, default: 0 },
		tax:			{ type: Number, default: 0 },
		total:		{ type: Number, default: 0 },
		earnings:	{ type: Number, default: 0 }
	},
	tracking:		{
		id:			{ type: String, default: null }, // something like a "secret id"
		cart:		{ type: String }, // cart_token
		notify:	{ type: Boolean, default: false }
	},
	customer:		{
		id:					{ type: Number },
		first_name:	{ type: String },
		last_name:	{ type: String }
	},
	items:			[{
		id:				{ type: Number, required: true }, // product_id
		quantity:	{ type: Number, required: true },
		price:		{ type: Number, default: 0 }
	}],
	discounts:	[{
		code:		{ type: String },
		amount:	{ type: Number },
		type:		{ type: String }
	}],
	dispatch:		{
		id:			{ type: Number },
		// submitted, assigned, denied, at_pickup, otw_active, otw_rejected, at_dropoff, done_cannot_pickup, done_returned, done_cancelled, done_delivered
		status: { type: String, default: null },
		after:	{ type: Date, default: Date.now }, 
		eta:		{
			pickup:	{ type: Date, default: null },
			dropoff:{ type: Date, default: null }
		},
		location:	{ // driver location
			latitude:		{ type: Number, default: null },
			longitude:	{ type: Number, default: null },
			time:				{ type: Date, default: null }, 
			actively_delivering_this_order: { type: Boolean, default: false },
		},
		pickup:	{
			arrive_after:		{ type: Date, default: null }, 
			arrive_before:	{ type: Date, default: null }, 
		},
		dropoff:{
			address: {
				street1:	{ type: String }, // address1
				street2:	{ type: String }, // address2
				company:	{ type: String },
				phone:		{ type: String },
				email:		{ type: String }, // contact_email
				name:			{ type: String },
				city:			{ type: String },
				zip:			{ type: String },
				state:		{ type: String },	// province_code
				country:	{ type: String },	// country_code
				location:	{
					latitude:		{ type: Number },
					longitude:	{ type: Number }
				}
			},
			instructions: { type: String } // note
		},
	}
});

mongoose.model('Order', OrderSchema);