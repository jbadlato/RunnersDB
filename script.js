var map;
function initialize() {
	var myLatlng = new google.maps.LatLng(47.6062,-122.3321);
	var myOptions = {
    	zoom: 17,
    	center: myLatlng,
    	mapTypeId: google.maps.MapTypeId.TERRAIN
  	}
  	map = new google.maps.Map(document.getElementById("map"), myOptions);

  	// Set up directions objects:
  	var directionsService = new google.maps.DirectionsService();
  	var directionsDisplay = new google.maps.DirectionsRenderer({
  		suppressMarkers: true,
  		preserveViewport: true
  	});
  	directionsDisplay.setMap(map);

  	// Add listener to add markers to map where user clicks (snaps to nearest road):
  	google.maps.event.addListener(map, 'click', function(e) {
  		var request = {
  			origin: e.latLng,
  			destination: e.latLng,
  			travelMode: google.maps.DirectionsTravelMode.WALKING
  		};

  		directionsService.route(request, function(response, status) {
  			if (status == google.maps.DirectionsStatus.OK) {
  				placeMarker(response.routes[0].legs[0].start_location);
  				calculateAndDisplayRoute(directionsService, directionsDisplay);
  			} else {
  				alert('Error placing marker');
  			}
  		})
  	});

  	// Add listener for the autocomplete "jump to location" search bar:
  	var card = document.getElementById('search_bar');
  	var input = document.getElementById('text_input');
  	var distance_display = document.getElementById('distance_display');
  	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);
  	map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(distance_display);
  	var autocomplete = new google.maps.places.Autocomplete(input);
  	autocomplete.bindTo('bounds', map);
  	autocomplete.addListener('place_changed', function() {
  		var place = autocomplete.getPlace();
  		if(!place.geometry) {
  			window.alert("No details available for input: '" + place.name + "'");
  			return;
  		}

  		if (place.geometry.viewport) {
  			map.fitBounds(place.geometry.viewport);
  		} else {
  			map.setCenter(place.geometry.location);
  			map.setZoom(17);
  		}
  	});
}

var markers = []; // stores the marker locations
function placeMarker(location) {
  	var marker = new google.maps.Marker({
      position: location, 
      icon: {
      	path: google.maps.SymbolPath.CIRCLE,
      	scale: 1,
      	strokeColor: "#00F",
      	strokeWeight: 3.0
      },
      map: map
 	 });
  	markers.push({
  		latitude: location.lat(),
  		longitude: location.lng()
  	});
}

function calculateAndDisplayRoute(directionsService, directionsDisplay) {
	start = new google.maps.LatLng(markers[0].latitude, markers[0].longitude);
	end = new google.maps.LatLng(markers[markers.length-1].latitude, markers[markers.length-1].longitude);
	ways = [];
	for (var i = 1; i < markers.length-1; i++) {
		newWay = new google.maps.LatLng(markers[i].latitude, markers[i].longitude);
		ways.push({
			location: newWay,
			stopover: true
		});
	}
	directionsService.route({
		origin: start,
		destination: end,
		waypoints: ways,
		optimizeWaypoints: false,
		travelMode: 'WALKING'
	}, function(response, status) {
		if (status === 'OK') {
			directionsDisplay.setDirections(response);
			routeDistance = 0;
			legs = response.routes[0].legs;
			for (var i = 0; i < legs.length; i++) {
				routeDistance += legs[i].distance.value;
			}
			document.getElementById('distance_display').innerHTML = routeDistance + ' m';
		} else {
			alert('Directions request failed due to ' + status);
		}
	});
}