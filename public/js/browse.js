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
    if (!results[0]) {
        console.log('no results found');
    } else {
        searchLat = results[0].geometry.location.lat();
        searchLng = results[0].geometry.location.lng();
        document.getElementById("currSearchLoc").innerHTML = "Current Search Location: " + address;
    }
  });
}

var createPreview = function (row, browseContainer) {
	// get location as a city/town/locality:
	var latLng = new google.maps.LatLng(row.latitude, row.longitude);
	var location = 'Not found';
	var preview;
	geocoder.geocode({location: latLng}, function (results, status) {
		console.log(results);
		for (var i = 0; i < results.length; i++) {
			if (results[i].types.indexOf('locality') !== -1 || results.indexOf('neighborhood') !== -1) {
				location = results[i].formatted_address;
				break;
			}
		}
		console.log(location);
		preview = "<li>" +
					"<a href='../route/" + row.id + "'>" + row.route_name + "</a>" +
					"<ul>" +
					"<li>Created By: " + row.username + "</li>" +
					"<li>Location: " + location + "</li>" +
					"<li>Distance: " + row.distance + " km" + "</li>" +
					"<li>Elevation: " + row.elevation + " m" + "</li>" +
					"</ul>" + 
					"</li>";
		browseContainer.innerHTML += preview;
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
	xhttp.open("GET", "/browse?browseby=" + browseType + "&searchLat=" + searchLat + "&searchLng=" + searchLng + "&searchRadius=" + searchRadius, true);
	xhttp.send();
	xhttp.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			rows = JSON.parse(this.responseText);
			browseContainer = document.getElementById('browse_container');
			browseContainer.innerHTML = '';
			for (var i = 0; i < rows.length; i++) {
				createPreview(rows[i], browseContainer);
			}
		}
	}
}
