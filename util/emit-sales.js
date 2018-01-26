'use strict';

var mongoose	= require('mongoose')
	, moment		= require('moment-timezone')
	, Order			= mongoose.model('Order');

module.exports = function(socket) {
	Order.aggregate([
		{
			$match : {
				canceled: null,
				"dispatch.after": {
					$gte: moment().tz('America/Los_Angeles').startOf('day').toDate(),
					$lte: moment().tz('America/Los_Angeles').endOf('day').toDate()
				}
			}
		},
		{
			$group: {
				_id: null,
				earnings: { $sum: '$price.earnings'},
				count: { $sum: 1}
			}
		}
	]).exec(function(err, sales) {
		var sales = err || !sales.length ? {earnings: 0, count: 0} : {earnings: sales[0].earnings, count: sales[0].count};
		socket.emit('sales', sales);
	});
};