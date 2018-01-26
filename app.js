'use strict';

var config					= require('./config')
	, express         = require('express')
  , mongoose        = require('mongoose')
  , http            = require('http')
  , path            = require('path')
  , morgan          = require('morgan')
  , bodyParser      = require('body-parser')
  , methodOverride  = require('method-override')
  , cookieParser    = require('cookie-parser')
  , session         = require('express-session')
  , mongoStore      = require('connect-mongo')(session)
  , fs              = require('fs')
	, passport				= require('passport')
	, passportSocketIo= require('passport.socketio')
	, async						= require('async')
	, moment					= require('moment-timezone');

var app							= express()
  , server					= http.createServer(app)
	, io							= require('socket.io')(server)
	, sessionStore		= new mongoStore({ mongooseConnection: mongoose.connection, collection : '_session' });
	
// Bootstrap models
fs.readdirSync(path.join(__dirname, 'models')).forEach(function (file) {
  if (~file.indexOf('.js')) require(path.join(__dirname, 'models/') + file);
});

var User		= mongoose.model('User')
	, Product	= mongoose.model('Product')
	, Order		= mongoose.model('Order');

app.disable('x-powered-by');

app.use(require('compression')());
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));

app.set('port', config.port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride());
app.use(cookieParser(config.cookieSecret));
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: config.cookieSecret,
  key: 'session',
  store: sessionStore
}));


/**
 * Passport
 */
app.use(passport.initialize());
app.use(passport.session());

passport.use(User.authenticate());
passport.serializeUser(User.serialize());
passport.deserializeUser(User.deserialize());

/**
 * Routes
 */
app.get('/', function(req, res) {
	// "hide" admin panel for mealma.de root
	if (req.hostname.indexOf('mealma.de') > -1) {
		return res.redirect('http://www.mealmade.com/');
	}
	
	var user = req.isAuthenticated() ? req.user.toObject() : {};
	delete user.password;
	delete user.reset;
	
	res.status(200).render('index', { user: JSON.stringify(user) });
});

app.use('/api/account', require('./routes/account'));
app.use('/api/track', require('./routes/track'));
app.use('/webhook', require('./routes/webhook')(io));

// mealma.de tracking token shortlink
app.get('/:token([0-9]{4}[-]{1}[A-Za-z0-9]{6})', function(req, res) {
	res.redirect('http://www.mealmade.com/pages/track/' + req.params.token);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
	var output = {
		message	: err.message,
		error		: app.get('env') === 'development' ? err : {}
	};

  res.status(err.status || 500);

	// !check err stack leak?
	if ( req.headers.accept && req.headers.accept.indexOf('application/json') !== -1 ) {
		res.json(output);
	} else {
		res.render('error', output);
	}
});

/** 
 * socket.io
 */
io.use(passportSocketIo.authorize({
  cookieParser: cookieParser,
  key: 'session',
  secret: config.cookieSecret,
  store: sessionStore
}));

io.on('connection', function (socket) {
	// NOTE: use passportSocketIo.filterSocketsByUser when multi vendor gets added
	
	socket.emit('pickup', config.pickup);
	
	Product.find({}).select('name type id -_id').exec(function (err, products) {
		if (err) { return; } // emit error mb?
		socket.emit('products', products);
	});
	
	Order.find({
		$or: [{
			"status": {
				$in: ['pending', 'dispatching', 'dispatched']
			}
		}, {
			"dispatch.after": {
				$gte: moment().tz('America/Los_Angeles').startOf('day').toDate(),
				$lte: moment().tz('America/Los_Angeles').endOf('day').toDate()
			}
		}]
	}).lean().exec(function(err, orders) {
		if (err) { return; } // emit error mb?
	
		// how many orders customer has had
		async.forEachOf(orders, function (order, key, callback) {
			Order.count({
				'customer.id': order.customer.id
			}, function(err, count) {
				order.customer.total_orders = count;
				
				callback();
			});
		}, function (err) {
			socket.emit('orders', orders);
		});
	});
	
	require('./util/emit-sales')(socket); // emit sales(earnings)
	
	// dispatch request
	socket.on('dispatch', function(dispatch, callback) {
		Order.findOne({ id: dispatch.id }, function(err, order) {
			if (err) {
				return callback('Unexpected sys error, please try again.');
			}
			
			order.status = 'dispatched';
			order.dispatch.status	= 'submitted';

			order.save(function(err) {
				if (!err) {
					require('./util/emit-order')(io, order); // emit order (including how many orders customer has had)
				}
				callback(err);
			});
		});
	});
	
	// fulfill order
	socket.on('fulfill', function(order) {
		// fulfill order @Shopify
		
		var request = require('request');

		request({
			url: 'https://' + config.shopifyAPI.store + '/admin/orders/' + order + '/fulfillments.json',
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + new Buffer(config.shopifyAPI.key + ':' + config.shopifyAPI.password).toString('base64')
			},
			json: {
				fulfillment: { 
					//tracking_number: order.dispatch.id, 
					//tracking_url: 'https://delivery.side.cr/shipper/v0/ui/details?id=' + order.dispatch.id + '&api_key=' + config.sidecarKey,
					notify_customer: false 
				} 
			}
		});
	});
	
});

// start stuff
mongoose.connect(config.mongoURL);
mongoose.connection.on('error', function(err){
  console.log('Mongoose ERROR: ' + err);
  process.exit(1);
});
mongoose.connection.once('open', function() {
  server.listen(config.port);
});

server.on('error', function(err) {
  console.log('Express ERROR: ' + err);
  process.exit(1);
});
server.on('listening', function() {
  console.log('Express app started on port ' + config.port);
});