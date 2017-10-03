var geocoder;
var autocomplete;
function initialize() {
  geocoder = new google.maps.Geocoder();
  var input = document.getElementById("address");
  var autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.addListener('place_changed', function () {
  	codeAddress();
  });
}

var searchLat = 0;
var searchLng = 0;
function codeAddress() {
  var address = document.getElementById("address").value;
  geocoder.geocode( { 'address': address }, function(results, status) {
    if (!results) {
        console.log('no results found during geocode');
    } else {
        searchLat = results[0].geometry.location.lat();
        searchLng = results[0].geometry.location.lng();
        document.getElementById("currSearchLoc").innerHTML = "Current Search Location: " + address;
    }
  });
}

var ratingToStars = function (rating) {
	var stars = '';
	for (var i = 0; i < 5; i++) {
		if (i < rating) {
			stars += '&#x2605';
		} else {
			stars += '&#x2606';
		}
	}
	return stars;
}

var createPreview = function (row, browseContainer, resolve) {
	// get location as a city/town/locality:
	var latLng = new google.maps.LatLng(row.latitude, row.longitude);
	var location = 'Not found';
	var preview;
	geocoder.geocode({location: latLng}, function (results, status) {
		if (!results) {
			console.log('no results found during reverse geocode');
			location = row.latitude + ', ' + row.longitude;
		} else {
			for (var i = 0; i < results.length; i++) {
				if (results[i].types.indexOf('locality') !== -1 || results.indexOf('neighborhood') !== -1) {
					location = results[i].formatted_address;
					break;
				}
			}
		}
		//show stars:
		var overall_rating = Math.round(row.overall_rating);
		var overall_stars = ratingToStars(overall_rating);
		var difficulty_rating = Math.round(row.average_difficulty);
		var difficulty_stars = ratingToStars(difficulty_rating);
		var safety_rating = Math.round(row.average_safety);
		var safety_stars = ratingToStars(safety_rating);
		var scenery_rating = Math.round(row.average_scenery);
		var scenery_stars = ratingToStars(scenery_rating);
		var staticMapURL = "https://maps.googleapis.com/maps/api/staticmap?center=" + row.latitude + "," + row.longitude +
			"&zoom=14&size=300x300&maptype=roadmap" +
			"&markers=" + row.latitude + "," + row.longitude +
			"&key=AIzaSyDXvHQwe44-dcP4-8-b90Ly2ut4LWbb4ug"
		preview = "<li class='route_details'>" +
					"<a class='route_link' href='../route/" + row.id + "'>" + row.route_name + "</a>" +
					" by " + row.username + " " +  overall_stars +
					"<ul>" +
					"<img src=" + staticMapURL + " class='map_preview'/>" +
					"<li class='route_param'>" + location + "</li>" +
					"<li class='route_param'>Distance: " + row.distance + " km" + "</li>" +
					"<li class='route_param'>Elevation: " + row.elevation + " m" + "</li>" +
					"<li class='route_param'>Difficulty: " + difficulty_stars + "</li>" + 
					"<li class='route_param'>Safety: " + safety_stars + "</li>" +
					"<li class='route_param'>Scenery: " + scenery_stars + "</li>" +
					"</ul>" + 
					"</li>";
		browseContainer.innerHTML += preview;
		resolve();
	});
}

var page = 0;
function setBrowse() {
	if (page === 1) {
		document.getElementById('prev_button').style = "display: none;";
	} else {
		document.getElementById('prev_button').style = "display: inline-block;";
	}
	var xhttp = new XMLHttpRequest();
	var searchRadiusSelector = document.getElementsByName('searchRadius');
	var searchRadius;
	for (var i = 0; i < searchRadiusSelector.length; i++) {
		if (searchRadiusSelector[i].checked) {
			searchRadius = parseInt(searchRadiusSelector[i].value);
			break;
		}
	}
	var browseBySelector = document.getElementsByName('browseBy');
	var browseType;
	for (var i = 0; i < browseBySelector.length; i++) {
		if (browseBySelector[i].checked) {
			browseType = browseBySelector[i].value;
			break;
		}
	}
	var minDist = document.getElementById('min_dist').value;
	var maxDist = document.getElementById('max_dist').value;
	var minElev = document.getElementById('min_elev').value;
	var maxElev = document.getElementById('max_elev').value;
	xhttp.open("POST", "/browse");
	params = {
		browseby: browseType,
		'searchLat': searchLat,
		'searchLng': searchLng,
		'searchRadius': searchRadius,
		'minDist': minDist,
		'maxDist': maxDist,
		'minElev': minElev,
		'maxElev': maxElev,
		offset: page
	}
	xhttp.setRequestHeader("Content-Type", "application/json");
	xhttp.send(JSON.stringify(params));
	xhttp.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			rows = JSON.parse(this.responseText);
			console.log(rows);
			if (rows.length < 10) {
				document.getElementById('next_button').style = "display: none;";
			} else {
				document.getElementById('next_button').style = "display: inline-block";
			}
			browseContainer = document.getElementById('browse_container');
			browseContainer.innerHTML = '';
			(async function loop() {
				for (var i = 0; i < rows.length; i++) {
					blength = browseContainer.innerHTML.length;
					await new Promise(resolve => createPreview(rows[i], browseContainer, resolve));
				}
			})();
		}
	}
}

var nextPage = function () {
	page++;
	setBrowse();
}

var prevPage = function () {
	page--;
	setBrowse();
}

var newSearch = function () {
	document.getElementById('browse_container').innerHTML = '';
	page = 1;
	setBrowse();
}