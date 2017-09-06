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
	db.run("CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY, username TEXT, route_name TEXT, path TEXT, latitude REAL, longitude REAL, distance REAL, elevation REAL)");
	db.run("CREATE TABLE IF NOT EXISTS saved_routes (save_id INTEGER PRIMARY KEY, username TEXT, route_id INTEGER)");
	db.run("CREATE TABLE IF NOT EXISTS reviews (comment_id INTEGER PRIMARY KEY, username TEXT, route_id INTEGER, comment TEXT, difficulty INTEGER, safety INTEGER, scenery INTEGER, upvotes INTEGER)");
	db.run("CREATE INDEX IF NOT EXISTS idx_location ON routes (latitude, longitude)");
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
			res.redirect('/browse');
		}
	});
});

app.get('/browse', function(req, res) {
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
	if (Object.keys(req.query).length === 0) {	
		res.render('browse.ejs', {
			'usermsg': usermsg
		});
	} else {
		// Approximate conversions:
		// Latitude: 1 deg = 110.574 km
		// Longitude: 1 deg = 111.320*cos(latitude) km
		var searchLat = parseFloat(req.query['searchLat']);
		var searchLng = parseFloat(req.query['searchLng']);
		var searchRad = parseFloat(req.query['searchRadius']);
		var minLat = searchLat - searchRad / 110.574;
		var maxLat = searchLat + searchRad / 110.574;
		var minLng = searchLng - Math.abs(searchRad / (111.320 * Math.cos(searchLat/180*Math.PI)));
		var maxLng = searchLng + Math.abs(searchRad / (111.320 * Math.cos(searchLat/180*Math.PI)));
	}
	db = new sqlite3.Database('runners.db');
	if (req.query['browseby'] === 'old') {
		db.all("SELECT * FROM routes WHERE latitude > ? AND latitude < ? AND longitude > ? AND longitude < ? LIMIT 10",
			[minLat, maxLat, minLng, maxLng],
			function (err, rows) {	
				if (err) {
					console.log(err);
					db.close(function (err) {if (err) {console.log(err);}});
				} else {
					db.close(function (err) {if (err) {console.log(err);}});
					res.send(JSON.stringify(rows));
				}
			});
	} else if (req.query['browseby'] === 'new') {
		db.all("SELECT * FROM routes ORDER BY id DESC LIMIT 10", function (err, rows) {
			if (err) {
				console.log(err);
				db.close(function (err) {if (err) {console.log(err);}});
			} else {
				db.close(function (err) {if (err) {console.log(err);}});
				res.send(JSON.stringify(rows));
			}
		});
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
	var sess = req.session;
	if (!req.body.path) {
		res.render('new_route.ejs', {msg: 'Please draw a route.'});
	} else if (req.body.path === '[]') { // Find a better way to do this without refreshing page & deleting users input.
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
	var rowStore;
	db.serialize(function() {
		db.get("SELECT * FROM routes WHERE id = ?", routeId, function (err, row) {
			rowStore = row;
		});
		db.all("SELECT * FROM reviews WHERE route_id = ? ORDER BY upvotes", routeId, function (err, rows) { // Limit/paginate this
			var avgDifficulty = 0;
			var avgSafety = 0;
			var avgScenery = 0;
			for (var i = 0; i < rows.length; i++) {
				avgDifficulty += rows[i].difficulty;
				avgSafety += rows[i].safety;
				avgScenery += rows[i].scenery;
			}
			avgDifficulty = avgDifficulty / rows.length;
			avgSafety = avgSafety / rows.length;
			avgScenery = avgScenery / rows.length;
			res.render('view_route.ejs', {
				msg: messageStore,
				'username': rowStore.username,
				'route_name': rowStore.route_name,
				initPath: rowStore.path,
				distance: rowStore.distance,
				elevation: rowStore.elevation,
				initLat: rowStore.latitude,
				initLng: rowStore.longitude,
				'avgDifficulty': avgDifficulty,
				'avgSafety': avgSafety,
				'avgScenery': avgScenery,
				'rows': rows
			});
		});
		db.close(function (err) {
			if (err) {
				console.log(err);
			}
		});
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
						sess.message = 'Route saved.';
						res.redirect('/route/' + routeId);
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