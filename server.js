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
	db.run("CREATE TABLE IF NOT EXISTS upvotes (upvote_id INTEGER PRIMARY KEY, username TEXT, review_id INTEGER)");
	db.run("CREATE INDEX IF NOT EXISTS idx_upvotes ON upvotes (username, review_id)");
})
db.close();

app.get('/', function(req, res) {
	sess = req.session;
	res.render('home.ejs');
});

app.get('/free_draw', function(req, res) {
	res.render('draw_route.ejs');
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
	res.render('browse.ejs', {
		'usermsg': usermsg
	});
});

app.post('/browse', function(req, res) {
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
	// Approximate conversions:
	// Latitude: 1 deg = 110.574 km
	// Longitude: 1 deg = 111.320*cos(latitude) km
	var searchLat = parseFloat(req.body.searchLat);
	var searchLng = parseFloat(req.body.searchLng);
	var searchRad = parseFloat(req.body.searchRadius);
	var minLat = searchLat - searchRad / 110.574;
	var maxLat = searchLat + searchRad / 110.574;
	var minLng = searchLng - Math.abs(searchRad / (111.320 * Math.cos(searchLat/180*Math.PI)));
	var maxLng = searchLng + Math.abs(searchRad / (111.320 * Math.cos(searchLat/180*Math.PI)));
	var minDist = req.body.minDist;
	var maxDist = req.body.maxDist;
	var minElev = req.body.minElev;
	var maxElev = req.body.maxElev;
	var sortBy, query;
	var offset = ((req.body.offset - 1) * 10).toString();
	if (req.body.browseby === 'rating') {
		sortBy = 'overall_rating DESC';
	} else if (req.body.browseby === 'old') {
		sortBy = 'id ASC';
	} else if (req.body.browseby === 'new') {
		sortBy = 'id DESC';
	} else if (req.body.browseby === 'distance') {
		sortBy = 'distance ASC';
	} else if (req.body.browseby === 'elevation') {
		sortBy = 'elevation ASC';
	} else {
		console.log('invalid browseby parameter.');
		return;
	}
	query = "SELECT routes.*, (AVG(reviews.difficulty) + AVG(reviews.safety) + AVG(reviews.scenery))/3 AS overall_rating, " + 
		"AVG (reviews.difficulty) AS average_difficulty, " +
		"AVG (reviews.safety) AS average_safety, " +
		"AVG (reviews.scenery) AS average_scenery " +
		"FROM routes " +
		"INNER JOIN reviews ON routes.id = reviews.route_id " +
		"WHERE routes.latitude BETWEEN ? AND ? AND routes.longitude BETWEEN ? AND ? " +
		"AND routes.distance BETWEEN ? AND ? AND routes.elevation BETWEEN ? AND ? " +
		"GROUP BY id " +
		"ORDER BY " + sortBy + " LIMIT 10 OFFSET " + offset;
	db = new sqlite3.Database('runners.db');
	db.all(query, [minLat, maxLat, minLng, maxLng, minDist, maxDist, minElev, maxElev], function (err, rows) {	
		if (err) {
			console.log(err);
			db.close(function (err) {if (err) {console.log(err);}});
		} else {
			res.send(JSON.stringify(rows));
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
	db.get("SELECT routes.*, AVG(reviews.difficulty) AS average_difficulty, AVG(reviews.safety) AS average_safety, " + 
		"AVG(reviews.scenery) AS average_scenery FROM routes " + 
		"INNER JOIN reviews ON routes.id = reviews.route_id WHERE id = " + routeId, 
		function (err, row) {
		res.render('view_route.ejs', {
			msg: messageStore,
			'username': row.username,
			'route_name': row.route_name,
			initPath: row.path,
			distance: row.distance,
			elevation: row.elevation,
			initLat: row.latitude,
			initLng: row.longitude,
			avgDifficulty: Math.round(row.average_difficulty*100)/100,
			avgSafety: Math.round(row.average_safety*100)/100,
			avgScenery: Math.round(row.average_scenery*100)/100
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

app.post('/reviews', function (req, res) {
	var offset = (req.body.page - 1) * 5;
	db = new sqlite3.Database('runners.db');
	db.all("SELECT * FROM reviews WHERE route_id = " + req.body.routeId + " ORDER BY upvotes DESC LIMIT 5 OFFSET " + offset, 
		function (err, rows) {
			if (err) {
				console.log(err);
			}
			res.send(JSON.stringify(rows));
	});
});

app.post('/upvote', function (req, res) {
	sess = req.session;
	if (!sess.username) {
		sess.message = "Please sign in before upvoting.";
		return res.send('Sign In');
	}
	comment_id = req.body.comment_id;
	db = new sqlite3.Database('runners.db');
	db.get("SELECT * FROM upvotes WHERE username = ? AND review_id = ?", [sess.username, comment_id], function (err, row) {
		if (err) {
			console.log(err);
		} else if (row !== undefined) {
			res.send('Duplicate');
		} else {
			db.run("UPDATE reviews SET upvotes = upvotes + 1 WHERE comment_id = " + comment_id, function (err) {
				if (err) {
					console.log(err);
					db.close();
				}
				db.run("INSERT INTO upvotes (username, review_id) VALUES (?, ?)", [sess.username, comment_id], function (err) {
					if (err) {
						console.log(err);
						db.close();
					} else {
						res.send('Success');
					}
				});
			});
		}
	});

});

app.post('/submitReview', function (req, res) {
	sess = req.session;
	if (!sess.username) {
		sess.message = "Please sign in before submitting a review.";
		return res.send('Sign In');
	}
	var route_id = parseInt(req.body.route_id);
	var comment = req.body.comment;
	var difficulty = parseInt(req.body.difficulty);
	var safety = parseInt(req.body.safety);
	var scenery = parseInt(req.body.scenery);
	db = new sqlite3.Database('runners.db');
	db.get("SELECT * FROM reviews WHERE username=? AND route_id=?", [sess.username, route_id], function (err, row) {
		if (err) {
			console.log(err);
		} else if (row !== undefined) {
			res.send('Duplicate');
		} else {
			db.run("INSERT INTO reviews (username, route_id, comment, difficulty, safety, scenery, upvotes) VALUES (?, ?, ?, ?, ?, ?, ?)", 
				[sess.username, route_id, comment, difficulty, safety, scenery, 0],
				function (err) {
					if (err) {
						console.log(err);
						res.send('Failure');
					}
					res.send('Success');
				});
		}
	});

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