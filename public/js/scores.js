
var username = '';

$(document).ready(function() {
	getTopScores();
	username = $('#username').text();
	console.log('Username is ' + username);
	if(username != 'anonymous' && username.trim() != '') {
		getPersonalScores();
	}
});

function getTopScores() {
	$('#allTable').remove();
	var allScores = $('#allScores');
	allScores.append('<h3><p class="centerText">All-Time Highscores</p></h3>');
	var allTable = $('<table id="allTable"></table>');
	
	allTable.append('<tr class="topRow"><td><h4>Player</h4></td><td><h4>Score</h4></td><td><h4>Date</h4></td></tr>');
	$.ajax({
		type: 'GET',
		url: '/topScores',
		dataType: 'json',
		success: function(data) {
			console.log('Data is ' + data);
			for(var j = 0; j < data.length && j < 10; j++) {
				console.log('Top length ' + data.length);
				if(data[j].username == 'anonymous') {
					console.log('Error: anonymous is saved');
					continue;
				}		
				var modDate = data[j].date.substring(0, 10);
				if(data[j].highScore > 0) {
					allTable.append('<tr><td class="user">' + data[j].username 
						+ '</td><td class="score">' + data[j].highScore + '</td>'
						+ '<td class="date">' + modDate + '</td></tr>');
				}
			}
			allScores.append(allTable);
		},
		error: function() {
			console.log('Error retrieving all high scores.');
		}
	});
}

function getPersonalScores() {
	$('#personalTable').remove();
	var personalScores = $('#personalScores');	
	var personalTable = $('<table id="personalTable"></table>');
	personalScores.append('<h3><p class="centerText">Personal Highscores</p></h3>');
	personalTable.append('<tr class="topRow"><td><h4>Score</h4><td><h4>Date</h4></td></tr>');

	$.ajax({
		type: 'POST',
		url: '/personalScores',
		dataType: 'json',
		data: {username: username},
		success: function(data) {
			console.log('Personal scores array length is ' + data.length);
			for(var i = 0; i < data.length && i < 10; i++) {
				var modDate = data[i].date.substring(0,10);
				personalTable.append('<tr><td class="score">' + data[i].highScore
					+ '</td><td class="date">' + modDate + '</td></tr>');
			}
		},
		error: function(xhr, ajaxOptions, thrownError) {
			console.log('No personal scores exist for this user.');
		}

	});
	personalScores.append(personalTable);
}
