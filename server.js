var express = require('express');
var app = express();
var server = require('http').createServer(app);
var bodyParser = require('body-parser');
var session = require('express-session');
const { Client } = require('pg');
var conString = process.env.DATABASE_URL;
var messageStore; // used for temporary storage

// Start server:
app.set('port', process.env.PORT || 5000);
server.listen(app.get('port'), function () {
	console.log('Server is running on port ' + app.get('port'));
	createTables();
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

function createTables() {
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		/* To reset the database:
		.then(() => client.query("DROP TABLE IF EXISTS logins;"))
		.then(result => client.query("DROP TABLE IF EXISTS routes;"))
		.then(result => client.query("DROP TABLE IF EXISTS saved_routes;"))
		.then(result => client.query("DROP TABLE IF EXISTS reviews;"))
		.then(result => client.query("DROP TABLE IF EXISTS upvotes;"))
		//*/
		.then(() => client.query("CREATE TABLE IF NOT EXISTS logins (id SERIAL PRIMARY KEY, username TEXT, password TEXT);"))
		.then(result => client.query("CREATE TABLE IF NOT EXISTS routes (id SERIAL PRIMARY KEY, username TEXT, route_name TEXT, path TEXT, latitude REAL, longitude REAL, distance REAL, elevation REAL);"))
		.then(result => client.query("CREATE TABLE IF NOT EXISTS saved_routes (save_id SERIAL PRIMARY KEY, username TEXT, route_id INTEGER);"))
		.then(result => client.query("CREATE TABLE IF NOT EXISTS reviews (comment_id SERIAL PRIMARY KEY, username TEXT, route_id INTEGER, comment TEXT, difficulty INTEGER, safety INTEGER, scenery INTEGER, upvotes INTEGER);"))
		.then(result => client.query("CREATE INDEX IF NOT EXISTS idx_location ON routes (latitude, longitude);"))
		.then(result => client.query("CREATE TABLE IF NOT EXISTS upvotes (upvote_id SERIAL PRIMARY KEY, username TEXT, review_id INTEGER);"))
		.then(result => client.query("CREATE INDEX IF NOT EXISTS idx_upvotes ON upvotes (username, review_id);"))
		.then(() => client.end());
}

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
	sess = req.session;	
	if (sess.username) {
		res.redirect('/sign_in');
	}
	else if (req.body.password !== req.body.password2) {
		// passwords don't match
		res.render('sign_up.ejs', {msg: 'Passwords do not match!'});
	} else if (req.body.username.length < 5) {
		// username too short
		res.render('sign_up.ejs', {msg: 'Username must be at least 5 characters.'});
	} else if (req.body.password.length < 5) {
		// password is too short
		res.render('sign_up.ejs', {msg: 'Password must be at least 5 characters.'});
	} else {
		const client = new Client({
			connectionString: conString,
			ssl: true
		});
		client.connect()
			.then(() => client.query("SELECT * FROM logins WHERE username = $1", [req.body.username]))
			.then(function(result) {
				if (result.rows.length > 0) {
					client.end()
						.then(() => res.render('sign_up.ejs', {msg: 'Username already taken!'}));
				} else {
					client.query("INSERT INTO logins (username, password) VALUES ($1, $2)", [req.body.username, req.body.password])
						.then(function(result) {
							var promise = new Promise(function(resolve, reject) {
								sess.username = req.body.username;
								resolve();
							});
							return promise;
						})
						.then(() => client.end())
						.then(() => res.redirect('/browse'));
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
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query("SELECT * FROM logins WHERE username = $1 AND password = $2", [req.body.username, req.body.password]))
		.then(function(result) {
			if (result.rows.length === 0) {
				// sign in failed.
				client.end()
					.then(() => res.render('sign_in.ejs', {msg: 'Wrong username and/or password.'}));
			} else {
				// sign the user in.
				sess.username = req.body.username;
				client.end()
					.then(() => res.redirect('/browse'));
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
		usermsg = 'Sign In';
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
		sortBy = 'routes.id ASC';
	} else if (req.body.browseby === 'new') {
		sortBy = 'routes.id DESC';
	} else if (req.body.browseby === 'distance') {
		sortBy = 'routes.distance ASC';
	} else if (req.body.browseby === 'elevation') {
		sortBy = 'routes.elevation ASC';
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
		"WHERE routes.latitude BETWEEN $1 AND $2 AND routes.longitude BETWEEN $3 AND $4 " +
		"AND routes.distance BETWEEN $5 AND $6 AND routes.elevation BETWEEN $7 AND $8 " +
		"GROUP BY routes.id " +
		"ORDER BY " + sortBy + " LIMIT 10 OFFSET " + offset;

	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query(query, [minLat, maxLat, minLng, maxLng, minDist, maxDist, minElev, maxElev]))
		.then(function(result) {
			client.end()
				.then(() => res.send(JSON.stringify(result.rows)));
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
		const client = new Client({
			connectionString: conString,
			ssl: true
		});
		var routeId;
		client.connect()
			.then(() => client.query("INSERT INTO routes (username, route_name, path, latitude, longitude, distance, elevation) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
				[sess.username, req.body.route_name, req.body.path, req.body.avgLat, req.body.avgLng, req.body.dist, req.body.elevChange]))
			.then(function(result) {
				var promise = new Promise(function(resolve, reject) {
					routeId = result.rows[0].id;
					if (!req.body.route_name) {
						defaultName = 'Route' + routeId;
						client.query("UPDATE routes SET route_name=$1 WHERE id=$2", [defaultName, routeId]);
					}
					resolve();
				});
				return promise;
			})
			.then(() => client.query("INSERT INTO reviews (username, route_id, comment, difficulty, safety, scenery, upvotes) VALUES ($1, $2, $3, $4, $5, $6, $7)",
				[sess.username, routeId, req.body.comment, req.body.difficulty, req.body.safety, req.body.scenery, 0]))
			.then(function(result) {
				client.end().then(function () {
					sess.message = 'New route created.';
					res.redirect('/route/' + routeId);
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
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query("SELECT routes.*, AVG(reviews.difficulty) AS average_difficulty, AVG(reviews.safety) AS average_safety, " +
			"AVG(reviews.scenery) AS average_scenery FROM routes " +
			"INNER JOIN reviews ON routes.id = reviews.route_id WHERE routes.id = " + routeId + " GROUP BY routes.id;"))
		.then(function(result) {
			if (result.rows.length === 0) {
				client.end()
					.then(() => res.send("<p>Route not found.</p>"));
			} else {
				client.end()
				.then(() => res.render("view_route.ejs", {
					msg: messageStore,
					'username': result.rows[0].username,
					'route_name': result.rows[0].route_name,
					initPath: result.rows[0].path,
					distance: result.rows[0].distance,
					elevation: result.rows[0].elevation,
					initLat: result.rows[0].latitude,
					initLng: result.rows[0].longitude,
					avgDifficulty: Math.round(result.rows[0].average_difficulty*100)/100,
					avgSafety: Math.round(result.rows[0].average_safety*100)/100,
					avgScenery: Math.round(result.rows[0].average_scenery*100)/100
				}));

			}
		});
});

app.post('/route/:routeId', function (req, res) {
	sess = req.session;
	if (!sess.username) {
		sess.message = "Please sign in first.";
		res.redirect('/sign_in');
	} else {
		var routeId = req.params.routeId;
		const client = new Client({
			connectionString: conString,
			ssl: true
		});
		client.connect()
			.then(() => client.query("SELECT * FROM saved_routes WHERE username=$1 AND route_id=$2", [sess.username, routeId]))
			.then(function(result) {
				if (result.rows.length === 0) {
					client.query("INSERT INTO saved_routes (username, route_id) VALUES ($1, $2)", [sess.username, routeId])
						.then(result => client.end())
						.then(function () {
							sess.message = 'Route saved.';
							res.redirect('/route/' + routeId);
						});
				} else {
					client.end()
						.then(function () {
							sess.message = 'Route could not be saved.';
							res.redirect('/route/' + routeId);
						});
				}
			});
	}
});

app.post('/reviews', function (req, res) {
	var offset = (req.body.page - 1) * 5;
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query("SELECT * FROM reviews WHERE route_id = " + req.body.routeId + " ORDER BY upvotes DESC LIMIT 5 OFFSET " + offset))
		.then(function(result) {
			client.end()
				.then(() => res.send(JSON.stringify(result.rows)));
		});
});

app.post('/upvote', function (req, res) {
	sess = req.session;
	if (!sess.username) {
		sess.message = "Please sign in before upvoting.";
		return res.send('Sign In');
	}
	comment_id = req.body.comment_id;
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query("SELECT * FROM upvotes WHERE username = $1 AND review_id = $2", [sess.username, comment_id]))
		.then(function (result) {
			if (result.rows.length > 0) {
				res.send('Duplicate');
			} else {
				client.query("UPDATE reviews SET upvotes = upvotes + 1 WHERE comment_id = " + comment_id)
					.then(result => client.query("INSERT INTO upvotes (username, review_id) VALUES ($1, $2)", [sess.username, comment_id]))
					.then(result => client.end())
					.then(() => res.send('Success'));
			}
		})
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
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query("SELECT * FROM reviews WHERE username=$1 AND route_id=$2", [sess.username, route_id]))
		.then(function(result) {
			if (result.rows.length > 0) {
				client.end()
					.then(() => res.send('Duplicate'));
			} else {
				client.query("INSERT INTO reviews (username, route_id, comment, difficulty, safety, scenery, upvotes) VALUES ($1, $2, $3, $4, $5, $6, $7)",
					[sess.username, route_id, comment, difficulty, safety, scenery, 0])
					.then(result => client.end())
					.then(() => res.send('Success'));
			}
		})
});

app.get('/user/:user', function (req, res) {
	sess = req.session;
	const client = new Client({
		connectionString: conString,
		ssl: true
	});
	client.connect()
		.then(() => client.query("SELECT * FROM logins WHERE username = $1", [req.params.user]))
		.then(function(result) {
			if (result.rows.length === 0) {
				client.end()
					.then(() => res.send('<p>User does not exist</p>'));
			} else {
				var routeNames = [];
				var routeIds = [];
				var savedRouteIds = [];
				var savedRouteNames = [];
				client.query("SELECT * FROM routes WHERE username = $1", [req.params.user])
					.then(function(result) {
						var promise = new Promise(function(resolve, reject) {
							for (var i=0; i<result.rows.length; i++) {
								routeNames.push(result.rows[i].route_name);
								routeIds.push(result.rows[i].id);
							}
							resolve();
						});
						return promise;
					})
					.then(() => client.query("SELECT * FROM saved_routes a JOIN routes b ON a.route_id = b.id AND a.username = $1", [req.params.user]))
					.then(function(result) {
						var promise = new Promise(function (resolve, reject) {
							for (var i=0; i<result.rows.length; i++) {
								savedRouteIds.push(result.rows[i].route_id);
								savedRouteNames.push(result.rows[i].route_name);
							}
							resolve();
						})
						return promise;
					})
					.then(() => client.end())
					.then(() => res.render('view_user.ejs', {
						'username': req.params.user,
						'routeNames': routeNames,
						'routeIds': routeIds,
						'savedRouteNames': savedRouteNames,
						'savedRouteIds': savedRouteIds
					}));
			}
		})
});