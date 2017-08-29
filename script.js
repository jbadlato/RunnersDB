var map;
function initialize() {
	var myLatlng = new google.maps.LatLng(47.6062,-122.3321);
	var myOptions = {
    	zoom: 10,
    	center: myLatlng,
    	mapTypeId: google.maps.MapTypeId.ROADMAP
  	}
  	map = new google.maps.Map(document.getElementById("map"), myOptions);

  	var directionsService = new google.maps.DirectionsService();
  	google.maps.event.addListener(map, 'click', function(e) {
  		var request = {
  			origin: e.latLng,
  			destination: e.latLng,
  			travelMode: google.maps.DirectionsTravelMode.WALKING
  		};

  		directionsService.route(request, function(response, status) {
  			if (status == google.maps.DirectionsStatus.OK) {
  				placeMarker(response.routes[0].legs[0].start_location)
  			} else {
  				alert('Error placing marker');
  			}
  		})
  	});

  	var card = document.getElementById('search_bar');
  	var input = document.getElementById('text_input');

  	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

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
}