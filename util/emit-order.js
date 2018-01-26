'use strict';

var mongoose	= require('mongoose')
	, Order			= mongoose.model('Order');

module.exports = function(socket, order) {
	order = order.toObject();
		
	Order.count({
		'customer.id': order.customer.id
	}, function(err, count) {
		order.customer.total_orders = count;
		
		socket.emit('orders', order);
	});
};