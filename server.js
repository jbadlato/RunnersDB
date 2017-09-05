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

function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        var copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        var copy = [];
        for (var q = 0, len = obj.length; q < len; q++) {
        	copy[q] = clone(obj[q]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

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
	db.run("CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY, username TEXT, route_name TEXT, path TEXT, latitude TEXT, longitude TEXT, distance TEXT, elevation TEXT)");
	db.run("CREATE TABLE IF NOT EXISTS saved_routes (save_id INTEGER PRIMARY KEY, username TEXT, route_id INTEGER)");
	db.run("CREATE TABLE IF NOT EXISTS reviews (comment_id INTEGER PRIMARY KEY, username TEXT, route_id INTEGER, comment TEXT, difficulty INTEGER, safety INTEGER, scenery INTEGER, upvotes INTEGER)");
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
	db.all("SELECT * FROM logins WHERE username = ? AND password = ?", [req.body.username, req.body.password], function (err, rows) {
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
		usermsg = sess.message;
		sess.message = null;
	}
	if (!sess.username) {
		usermsg = 'Please sign in first.';
	} else if (sess.username) {
		usermsg = 'Signed in as: ' + sess.username;
	}
	var rowsStore;
	db = new sqlite3.Database('runners.db');
	db.all("SELECT * FROM routes LIMIT 10", function (err, rows) {
		if (err) {
			console.log(err);
			db.close(function (err) {if (err) {console.log(err);}});
		} else {
			res.render('forum.ejs', {
				'usermsg': usermsg,
				'rows': rows
			});
			db.close(function (err) {if (err) {console.log(err);}});
		}
	});
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
	var sess = req.session;
	if (!req.body.path) {
		res.render('new_route.ejs', {msg: 'Please draw a route.'});
	} else if (req.body.path === '[]') {
		res.render('new_route.ejs', {msg: 'Please draw a route.'});
	} else {
		db = new sqlite3.Database('runners.db');
		var routeId;
		// Yes, this is callback hell, but I'm not sure there's a better way without additional libraries.
		db.run("INSERT INTO routes (username, route_name, path, latitude, longitude, distance, elevation) VALUES (?, ?, ?, ?, ?, ?, ?)", 
			[sess.username, req.body.route_name, req.body.path, req.body.avgLat, req.body.avgLng, req.body.dist, req.body.elevChange], 
			function (err) {
				routeId = this.lastID;
				if (!req.body.route_name) {
					defaultName = 'Route' + routeId;
					db.run("UPDATE routes SET route_name=? WHERE id=?", [defaultName, routeId]);
				}
			db.run("INSERT INTO reviews VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)",
				[sess.username, routeId, req.body.comment, req.body.difficulty, req.body.safety, req.body.scenery, 0], 
				function (err) {
					console.log(routeId);
					if (err) {
						console.log(err);
					} 
					db.close(function(err) {
					if (err) {
						console.log(err)
					} else {
						sess.message = 'New route created.';
						res.redirect('/route/' + routeId);
					}
					});
				});
			});
	}
});


app.get('/route/:routeId', function (req, res) {
	sess = req.session;
	if (sess.message) {
		messageStore = sess.message;
		sess.message = null;
	}
	routeId = req.params.routeId;
	db = new sqlite3.Database('runners.db');
	db.get("SELECT * FROM routes WHERE id = ?", routeId, function (err, row) {
		db.close();
		res.render('view_route.ejs', {
			msg: messageStore,
			'username': row.username,
			'route_name': row.route_name,
			initPath: row.path,
			distance: row.distance,
			elevation: row.elevation,
			initLat: row.latitude,
			initLng: row.longitude
		})
	});
}); 

app.post('/route/:routeId', function (req, res) {
	sess = req.session;
	if (!sess.username) {
		sess.message = "Please sign in first.";
		res.redirect('/sign_in');
	} else {
		routeId = req.params.routeId;
		db = new sqlite3.Database('runners.db');
		db.serialize(function() {
			db.get("SELECT * FROM saved_routes WHERE username=? AND route_id=?", [sess.username, routeId], function (err, row) {
				if (row === undefined) {
					db.run("INSERT INTO saved_routes (username, route_id) VALUES (?, ?)", [sess.username, routeId], function (err) {
						if (err) {
							console.log(err);
						}
						res.end();
					});
				}
			});
		});
	}
});

app.get('/user/:user', function (req, res) {
	sess = req.session;
	db = new sqlite3.Database('runners.db');
	db.get("SELECT * FROM logins WHERE username = ?", req.params.user, function (err, row) {
		if (row === undefined) {
			res.send('<p>User does not exist</p>')
		} else {
			db.serialize(function() {
				// get routes created by user:
				var routeNames = [];
				var routeIds = [];
				db.all("SELECT * FROM routes WHERE username = ?", req.params.user, function(err, rows) {
					for (var i=0; i<rows.length; i++) {
						routeNames.push(rows[i].route_name);
						routeIds.push(rows[i].id);
					}
				});
				var savedRouteIds = [];
				var savedRouteNames = [];
				db.all("SELECT * FROM saved_routes a JOIN routes b ON a.route_id = b.id AND a.username = ?",
					req.params.user, function (err, rows) {
						for (var i=0; i<rows.length; i++) {
							savedRouteIds.push(rows[i].route_id);
							savedRouteNames.push(rows[i].route_name);
						}
					});
				db.close(function(err) {
					if (err) {
						console.log(err);
					} else {
						res.render('view_user.ejs', {
							'username': row.username,
							'routeNames': routeNames,
							'routeIds': routeIds,
							'savedRouteNames': savedRouteNames,
							'savedRouteIds': savedRouteIds
						});
					}
				});
			});
		}
	});
});