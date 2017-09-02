/*
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname));

// views is directory for all template files
app.set('views', __dirname);
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
*/

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var bodyParser = require('body-parser');
var session = require('express-session');
var messageStore; // used for temporary storage

// Start server:
app.set('port', process.env.PORT || 5000);
server.listen(app.get('port'), function () {
	console.log('Server is running on port ' + app.get('port'));
});

app.use(express.static(__dirname));

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(session({secret: 'ssshhhhh',
	resave: true,
	saveUninitialized: true
}));
var sess;

// Set up sqlite3 database:
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('runners.db');
db.serialize(function() {
	db.run("CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY, username TEXT, password TEXT)");
	db.run("CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY, username TEXT, route_name TEXT, path TEXT, location TEXT, elevation TEXT, distance TEXT)");
})
db.close();

app.get('/', function(req, res) {
	sess = req.session;
	res.render('home.html');
});

app.get('/free_draw', function(req, res) {
	res.render('index.html');
});

app.get('/sign_up', function(req, res) {
	res.render('sign_up.ejs', {msg: null});
});

app.post('/sign_up', function(req, res) {
	db = new sqlite3.Database('runners.db');
	if (req.body.password !== req.body.password2) {
		// passwords don't match
		res.render('sign_up.ejs', {msg: 'Passwords do not match!'});
	} else if (req.body.username.length < 5) {
		// username too short
		res.render('sign_up.ejs', {msg: 'Username must be at least 5 characters.'});
	} else if (req.body.password.length < 5) {
		// password is too short
		res.render('sign_up.ejs', {msg: 'Password must be at least 5 characters.'});
	} else {
		db.all("SELECT * FROM logins WHERE username = ?", [req.body.username], function (err, rows) {
			if (rows.length > 0) {
				// username already taken
				db.close();
				res.render('sign_up.ejs', {msg: 'Username already taken!'});
			} else {
				db.run("INSERT INTO logins (username, password) VALUES (?, ?)", [req.body.username, req.body.password]);
				db.close();
				res.render('sign_up.ejs', {msg: 'You have created a new account.'});
			}
		});
	}
});

app.get('/sign_in', function(req, res) {
	sess = req.session;
	if (sess.message) {
		messageStore = sess.message;
		sess.message = null;
		res.render('sign_in.ejs', {msg: messageStore});
	} else if (sess.username) {
		res.render('sign_in.ejs', {msg: 'You are already signed in as: ' + sess.username});
	} else {
		res.render('sign_in.ejs', {msg: null});
	}
});

app.post('/sign_in', function(req, res) {
	sess = req.session;
	// check if login is valid
	db = new sqlite3.Database('runners.db');
	db.all("SELECT * FROM logins WHERE username = ? and password = ?", [req.body.username, req.body.password], function (err, rows) {
		if (rows.length === 0) {
			// sign in failed.
			db.close();
			res.render('sign_in.ejs', {msg: 'Wrong username and/or password.'});
		} else {
			// sign the user in.
			sess.username = req.body.username;
			db.close();
			res.redirect('/forum');
		}
	});
});

app.get('/forum', function(req, res) {
	sess = req.session;
	if (sess.message) {
		messageStore = sess.message;
		sess.message = null;
		res.render('forum.ejs', {usermsg: 'Signed in as: ' + sess.username, actionmsg: messageStore});
	} else if (sess.username) {
		res.render('forum.ejs', {usermsg: 'Signed in as: ' + sess.username, actionmsg: null});
	} else {
		res.render('forum.ejs', {usermsg: "Please sign in first.", actionmsg: null});
	}
});

app.get('/new_route', function (req, res) {
	sess = req.session;
	if (!sess.username) {
		sess.message = 'Please sign in before creating a route.';
		res.redirect('/sign_in');
	} else {
		res.render('new_route.ejs', {msg: null});
	}
});

app.post('/new_route', function(req, res) {
	sess = req.session;
	if (!req.body.path) {
		res.render('new_route.ejs', {msg: 'Please draw a route.'});
	} else if (req.body.path === '[]') {
		res.render('new_route.ejs', {msg: 'Please draw a route.'});
	} else {
		db = new sqlite3.Database('runners.db');
		db.run("INSERT INTO routes (username, route_name, path) VALUES (?, ?, ?)", [sess.username, req.body.route_name, req.body.path], function (req, res) {
			db.close();
		});
		sess.message = 'New route created.';
		res.redirect('/forum');
	}
});