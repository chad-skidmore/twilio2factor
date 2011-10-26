
/**
 * Module dependencies.
 */

var express = require('express'),
	mongoose = require('mongoose'),
	mongoStore = require('connect-mongodb'),
	sys = require('sys'),
	uuid = require('node-uuid'),
	random = require('mersenne'),
	models = require('./models'),
	db,
	User;


/**
 * Setup Twilio client
 */
var Client = require('twilio').Client,
	Twiml = require('twilio').Twiml,
	TwilioConfig = require('./config').TwilioConfig;

var t = new Client(TwilioConfig.sid, TwilioConfig.authToken, TwilioConfig.hostname),
	p = t.getPhoneNumber(TwilioConfig.number);

p.setup(function() {
	p.on('incomingSms', function(smsParams, response) {
	    console.log('SMS Received:');
	    console.log(smsParams)
	});
	
	p.on('incomingCall', function(reqParams, resp) {
		console.log('Got a voice call');
		console.log(reqParams);
		resp.append(new Twiml.Say("You've reached a robot, you have called a wrong number, thank you."));
		resp.send();
	});
});



var app = module.exports = express.createServer();
var pub = __dirname + '/public';

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
  app.use(express.cookieParser());
  app.use(express.session({ store: mongoStore(app.set('db-uri')), 
	secret: 'SOME-SECRET-KEY' }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(pub));
  app.use(express.compiler({ src: pub, enable: ['less'] }));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.set('db-uri', 'mongodb://localhost/twilio2factor');
});

app.configure('production', function(){
  app.use(express.errorHandler());
  app.set('db-uri', 'mongodb://localhost/twilio2factor');
});

models.defineModels(mongoose, function() {
	app.User = User = mongoose.model('User');
	app.LoginToken = LoginToken = mongoose.model('LoginToken');
	app.AuthKey = AuthKey = mongoose.model('AuthKey');
	app.BetaKey = BetaKey = mongoose.model('BetaKey');
	db = mongoose.connect(app.set('db-uri'));
})

// *************
// User Auth Session Mgmt
// *************

function authenticateFromLoginToken(req, res, next) {
  var cookie = JSON.parse(req.cookies.logintoken);

  LoginToken.findOne({ email: cookie.email,
                       series: cookie.series,
                       token: cookie.token }, (function(err, token) {
    if (!token) {
      res.redirect('/login');
      return;
    }

    User.findOne({ email: token.email }, function(err, user) {
      if (user) {
        req.session.user_id = user.id;
        req.currentUser = user;

        token.token = token.randomToken();
        token.save(function() {
          res.cookie('logintoken', token.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
          next();
        });
      } else {
        res.redirect('/login');
      }
    });
  }));
}

function loadUser(req, res, next) {
	if (req.session.user_id) {
		User.findById(req.session.user_id, function(err, user) {
			if (user) {
				req.currentUser = user;
				next();
			} else {
				res.redirect('/login');
			}
		});
	} else if (req.cookies.logintoken) {
		authenticateFromLoginToken(req, res, next);
	} else {
		res.redirect('/login');
	}
}

// *************
// Helper Functions
// *************



// *************
// Error handling
// *************

function NotFound(msg) {
  this.name = 'NotFound';
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
}

sys.inherits(NotFound, Error);

app.error(function(err, req, res, next) {
  if (err instanceof NotFound) {
    res.render('404.jade', { status: 404 });
  } else {
    next(err);
  }
});



// *************
// Routes
// *************

// Main Dashboard

app.get('/', loadUser, function(req, res){
  res.render('index', {
	locals: { currentUser: req.currentUser },
    title: 'Super Secret Stuff'
  });
});

app.get('/login', function(req, res){
	res.render('login', {
		locals: { user: new User() },
		title: 'Login'
	});
});

app.post('/loginkey', function(req, res){	
	User.findOne( { email: req.body.user.email.toLowerCase()}, function(err, user) {
		if (user && user.authenticate(req.body.user.password)) {
			AuthKey.findOne( { email: req.body.user.email.toLowerCase()}, function(err, key) {
				if (key && key.validatekey(req.body.user.key.toUpperCase())) {

					var datenow = Date.now();
					
					if (datenow - key.timestamp < 120000) {
						req.session.user_id = user.id;
						var _response = { status: 'redirect', url: '/' };
						var jsonResponse = JSON.stringify(_response);
						res.send(jsonResponse);
					} else {
						var _response = { status: 'error', message: 'Your Authorization Key has expired!', 
							url: '/login', action: 'reset'};
						var jsonResponse = JSON.stringify(_response);
						res.send(jsonResponse);
					}
				} else {
					var _response = { status: 'error', message: 'Invalid authorization key.'};
					var jsonResponse = JSON.stringify(_response);
					res.send(jsonResponse);
				}
			});
		} else {
			var _response = { status: 'redirect', url: '/login' };
			var jsonResponse = JSON.stringify(_response);
			res.send(jsonResponse);
		}
		
	});
	
});

app.post('/login', function(req, res){
	console.log('login post: ');
	console.log(req.body);
	User.findOne( { email: req.body.user.email.toLowerCase()}, function(err, user) {
		if (user && user.authenticate(req.body.user.password)) {
			var id = uuid();
			var _id = id.substr(-6);
			_id = _id.toUpperCase();
			if (req.body.form.authmode == 'sms') {		
				p.setup(function() {
					message = 'Authorization Key for ' + user.email + ': ' + _id;
					tonumber = '+1' + user.phone;
					p.sendSms(tonumber, message, null, function(sms) {
						sms.once('processed', function(reqParams, response) {

							AuthKey.findOne( { email: req.body.user.email.toLowerCase()}, function(err, key) {
								if (key) {
									key.key = _id;
									key.timestamp = Date.now();
									key.save(function(err) {
										if (err) {
											console.log('error saving key update');
											console.log(err);
										}
									});
								} else {
									//create new key entry
									var k = new AuthKey();
									k.key = _id;
									k.email = req.body.user.email.toLowerCase();
									k.timestamp = Date.now();
									k.save(function(err) {
										if (err) {
											console.log('new key save error');
											console.log(err);
										}
									});
								}
							});
							console.log('message sent');
							console.log(reqParams);
						});
					});
				});
			} else if (req.body.form.authmode == 'voice') {
				// Make a call to the user on their listed phone number
				// and provide them a PIN code to enter into the web form
				p.setup(function() {
					p.makeCall('+1' + user.phone, null, function(call) {
						// Call is an OutgoingCall object
						// It is an EventEmitter
						call.on('answered', function(callParams, response) {
							// callParams is simply a map of the POST vars
							// Twilio sends with its request.
							// response is a Twiml.Response object
							var rand1 = random.rand(10);
							var rand2 = random.rand(10);
							var rand3 = random.rand(10);
							var rand4 = random.rand(10);
							var _id = rand1.toString() +
								rand2.toString() +
								rand3.toString() +
								rand4.toString();
							console.log('voice id: ' + _id);
							AuthKey.findOne( { email: req.body.user.email.toLowerCase()}, function(err, key) {
								if (key) {
									key.key = _id;
									key.timestamp = Date.now();
									key.save(function(err) {
										if (err) {
											console.log('error saving key update');
											console.log(err);
										}
									});
								} else {
									//create new key entry
									var k = new AuthKey();
									k.key = _id;
									k.email = req.body.user.email.toLowerCase();
									k.timestamp = Date.now();
									k.save(function(err) {
										if (err) {
											console.log('new key save error');
											console.log(err);
										}
									});
								}
							});
							response.append(new Twiml.Say(",,Your one time PIN code is, " + rand1 +
								",, " + rand2 +
								",, " + rand3 +
								",, " + rand4 + "."));
							response.append(new Twiml.Say(",,Repeat, your one time PIN code is, " + rand1 +
								",, " + rand2 +
								",, " + rand3 +
								",, " + rand4 + "."));
							response.send();
						});
						call.on('ended', function(params) {
							console.log('Call ended');
						});
					});
				});
			}
			var _response = { status: 'ok', url: '/loginkey' };
		} else {
			var _response = { status: 'error', message: 'Username or password is incorrect! Please try again.'};
		}
		var jsonResponse = JSON.stringify(_response);
		res.send(jsonResponse);
	});
});

app.get('/logout', loadUser, function(req, res) {
  if (req.session) {
    LoginToken.remove({ email: req.currentUser.email }, function() {});
    res.clearCookie('logintoken');
    req.session.destroy(function() {});
  }
  res.redirect('/login');
});

app.del('/logout', loadUser, function(req, res) {
  if (req.session) {
    LoginToken.remove({ email: req.currentUser.email }, function() {});
    res.clearCookie('logintoken');
    req.session.destroy(function() {});
  }
  res.redirect('/login');
});


// Register

app.get('/register', function(req, res) {
  res.render('register', {
	locals: { user: new User() },
    title: 'Register'
  });
});

app.get('/validate/email-available', function(req, res) {
	user = new User();
	User.findOne( { email: req.query.fieldValue.toLowerCase()}, function(err, user) {
		if (err) {
			res.send('error');
		} else {
			var responseObject = new Array();
			responseObject[0] = req.query.fieldId;
			if (user) {
				responseObject[1] = false;
			} else {
				responseObject[1] = true;
			}
			res.send(JSON.stringify(responseObject));
		}
	});
});

app.post('/register', function(req, res){
	var u = new User(req.body.user);
	u.save(function(err) {
		if (err) {
			console.log('Error registering user');
			console.log(err);
			var _response = { status: 'error', 
				message: 'There was an error with your registration. Please wait a moment and try again.'};
			res.send(JSON.stringify(_response));
		} else {
			res.redirect('/login');
		}
	});
});

app.post('/register', function(req, res){
	BetaKey.findOne( { key: req.body.user.email.toLowerCase()}, function(err, betakey) {
		if (betakey && betakey.used == false) {
			var u = new User(req.body.user);
			u.save(function(err) {
				if (err) {
					console.log('Error registering user');
					console.log(err);
					var _response = { status: 'error', 
						message: 'There was an error with your registration. Please wait a moment and try again.'};
					res.send(JSON.stringify(_response));
				} else {				
					// Registration of a user was successful
					betakey.used = true;
					betakey.save(function(err) {
						if (err) {
							console.log('beta key save as used error');
							console.log(err);
						}
					});
					var _response = { status: 'ok', 
						message: 'Registration successful. You will receive a confirmation email shortly to activate your account.' };
					res.send(JSON.stringify(_response));
				}
			});
		} else {
			// Beta key was not found or has already been used.
			var _response = { status: 'error', 
				message: 'Your beta key was not found or is invalid.'};
			res.send(JSON.stringify(_response));
		}
	});
});



app.listen(8001);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
