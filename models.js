var bcrypt = require("bcrypt");
var sys = require('util');
var zoneinfo = require('zoneinfo'),
	TZDate = zoneinfo.TZDate,
	countrycodes = zoneinfo.countrycodes;

function localizeEpoch(seconds, tz) {
	var timezone = TimeZone.getTimeZone(tz);
	var formatter = new SimpleDateFormat("MM/dd/yyyy  HH:mm:ss z'('Z')'");
	formatter.setTimeZone(timezone);
	var localdate = new Date( epoch * 1000 );
	var localtimestamp = formatter.format(localdate);
	return localtimestamp;
}

function localizeJavaEpoch(seconds, tz) {
	var timezone = TimeZone.getTimeZone(tz);
	var formatter = new SimpleDateFormat("MM/dd/yyyy  HH:mm:ss z'('Z')'");
	formatter.setTimeZone(timezone);
	var localdate = new Date( seconds );
	var localtimestamp = formatter.format(localdate);
	return localtimestamp;
}

function localizeMongooseTime(timestamp, tz) {
	var d = new TZDate('now');
	d._date = timestamp;
	d.setTimezone(tz);
	return d.format("F j, Y g:i A");
}

function defineModels(mongoose, fn) {
	var Schema = mongoose.Schema,
		ObjectId = Schema.ObjectId;

	function toLower (v) {
	  return v.toLowerCase();
	}
	
	function validatePresenceOf(value) {
		return value && value.length;
	}
	
	function hashPassword(value) {
		var salt = bcrypt.gen_salt_sync(12);
		var hash = bcrypt.encrypt_sync(value, salt);
		return hash;
	}
	
	function validatePassword(plainPassword, passHash) {
		return bcrypt.compare_sync(plainPassword, passHash);
	}

	/**
	  * User Object
	  */
	User = new Schema({
		'userid' : ObjectId,
		'email' : { type: String, set: toLower, validate: [validatePresenceOf, 'an email is required'],
		 	index: { unique: true } },
		'password' : String,
		'firstname' : String,
		'lastname' : String,
		'tz' : String,
		'register_date' : { type: Date, default: Date.now },
		'phone' : String
	});
	
	User.virtual('localTimestamp')
	.get( function () {
		return localizeMongooseTime(this.register_date, this.tz);
	});
	
	User.pre('save', function(next) {
		this.password = hashPassword(this.password);
		next();
	});
	
	User.method('authenticate', function(plainText) {
		return validatePassword(plainText, this.password);
	});
	
	/**
	  * Auth Key Object
	  */
	AuthKey = new Schema({
		'key' : String,
		'email' : { type: String, index: { unique: true } },
		'timestamp' : Number
	});
	
	AuthKey.pre('save', function(next) {
		this.key = hashPassword(this.key);
		next();
	});
	
	AuthKey.method('validatekey', function(plainText) {
		return validatePassword(plainText, this.key);
	});
	
	
	/**
	  * Beta Key Object
	  */
	BetaKey = new Schema({
		'key' : { type: String, index: { unique: true } },
		'used' : Boolean
	});
	
	/**
	  * Model: LoginToken
	  *
	  * Used for session persistence.
	  */
	LoginToken = new Schema({
		email: { type: String, index: true },
		series: { type: String, index: true },
		token: { type: String, index: true }
	});

	LoginToken.method('randomToken', function() {
		return Math.round((new Date().valueOf() * Math.random())) + '';
	});

	LoginToken.pre('save', function(next) {
		// Automatically create the tokens
		this.token = this.randomToken();

		if (this.isNew)
			this.series = this.randomToken();
		
		next();
	});

	LoginToken.virtual('id')
		.get(function() {
			return this._id.toHexString();
	});

	LoginToken.virtual('cookieValue')
		.get(function() {
			return JSON.stringify({ email: this.email, token: this.token, series: this.series });
	});

	mongoose.model('User', User);
	mongoose.model('LoginToken', LoginToken);
	mongoose.model('AuthKey', AuthKey);
	mongoose.model('BetaKey', BetaKey);
	
	fn();
}

exports.defineModels = defineModels;