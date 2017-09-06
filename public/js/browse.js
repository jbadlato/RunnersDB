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
		preview = "<li>" +
					"<a href='../route/" + row.id + "'>" + row.route_name + "</a>" +
					"<ul>" +
					"<li>Created By: " + row.username + "</li>" +
					"<li>Location: " + location + "</li>" +
					"<li>Distance: " + row.distance + " km" + "</li>" +
					"<li>Elevation: " + row.elevation + " m" + "</li>" +
					"<li>Overall Rating: " + Math.round(row.overall_rating*100)/100 + "</li>" +
					"<li>Difficulty: " + Math.round(row.average_difficulty*100)/100 + "</li>" + 
					"<li>Safety: " + Math.round(row.average_safety*100)/100 + "</li>" +
					"<li>Scenery: " + Math.round(row.average_scenery*100)/100 + "</li>" +
					"</ul>" + 
					"</li>";
		browseContainer.innerHTML += preview;
		resolve();
	});
}

function setBrowse(browseType) {
	var xhttp = new XMLHttpRequest();
	var searchRadiusSelector = document.getElementsByName('searchRadius');
	var searchRadius;
	for (var i = 0; i < searchRadiusSelector.length; i++) {
		if (searchRadiusSelector[i].checked) {
			searchRadius = parseInt(searchRadiusSelector[i].value);
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
		'maxElev': maxElev
	}
	xhttp.setRequestHeader("Content-Type", "application/json");
	xhttp.send(JSON.stringify(params));
	xhttp.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			rows = JSON.parse(this.responseText);
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
