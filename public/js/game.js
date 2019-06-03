var username; //This player's username. Defaults to "anonymous"
var myId; //This player's socket id
var opponentId; //Opponent's socket id
var opponentUsername; //Opponent's username.
var turn; //1 or 2
var pixels = new Array; //1D array storing the  RGB values for the parsed PNG representation for the object
var correct = true; //Accuracy of the most recently sent expression or generated expression
var waiting = false; // Current player waiting for other player response?
var imageNumber; //Image name
var imageCount; //Total number of objects that have been played

var imagePath; //Path to the image on the server
var naturalWidth; //The image's width before resizing
var naturalHeight; //The image'height before resizing
var progress; //Total number of objects played for the progress bar

var timerId;
var totalTimer;
var totalTime = 0;
var time = 0;
var score = 0;
var dotDrawn = false;
var round = 0;
var maxRespondingTime = 60;

//For evaluation
var correct;
var pixelXClick;
var pixelYClick;
var accuracy = '';

var fakeGame = true;
var gameStarted = false;
var transition = false; //True when transitioning between canned and real game
var firstContact = true;

var fakeOutput = '';
var awaitingPlayerMessage = 'Waiting for a new player to join';
var waitingMessage = 'Waiting for other player...';
var enterMessage = 'Enter a description:';
var invalidExpression = 'Please enter a description.'
var carolinaBlue = '#56A0D3';
var lightBlue = '#89BCE0';
var yellow = '#d1bf47';
var red = '#ff4747';
var orange = '#ff931f';

//Mechanical Turk variables
var workerId;
var mTurkInstructions = 'Welcome to <span class="branding">ReferIt Game</span>! In moments you and another player will both be shown the same picture. If you see an item bounded in red, then your goal is to describe the object as best as possible (ex: "Red car in front of the lamppost"). If you are the other player, then your goal is to select the object that the first player describes. <br><br>You both earn points and swap roles if the second player selects the correct object. The faster you play, the more points you win. Please write the first phrase that comes to your mind--don\'t overspecify or underspecify; rather, write natural phrases that you would use if you were talking to a friend.\nYou will receive credit for correct games, and each HIT will consist of 10-20 games.';
var bannedPlayerMessage = 'We have detected that you have tried to cheat the game in the past. This made us sad, so you are no longer able to play. If you believe you are receiving this message in error, please contact us.';
var bannedWorkersArray = [];
var submitThreshold = 5; //number of correct rounds needed to submit results to MTurk

$(document).ready(function() {
    if (gup('remaining') != null) {
        round = submitThreshold - parseInt(gup('remaining'));
        roundsRemaining = submitThreshold - round;
    	$('#timeDisplay').html(roundsRemaining);
    }
	$('#tutorialButton').click(function() {
        $('.overlay').hide();
        $('.whiteContent').hide();

        //Try to extract the assignment id from the URL. Returns null if not on MTurk.
       	var assignmentId = gup('assignmentId');
       	//Not on Mechanical Turk
        if(assignmentId == null) {
            loadFile();
        	gameStarted = true;
        	timerId = setInterval(countdown, 1000);
        }
        //On Mechanical Turk
        else {
        	//The worker has not accepted the HIT and must accept before the game starts
        	if(assignmentId == 'ASSIGNMENT_ID_NOT_AVAILABLE') {
        		$('.overlay').show();
                alert('You have to accept the HIT before pressing start');
                return;
        	}
        	//The worker has accepted the HIT
        	else {
                loadFile();
        		var workerId = gup('workerId');
        		//Detect if this is a bad player
        		for(var k = 0; k < bannedWorkersArray.length; k++) {
        			if(workerId == bannedWorkersArray[k]) {
        				console.log('This is a banned player.');
        				$('.text p').html(bannedPlayerMessage);
        				$('.whiteContent').show();
        				$('.overlay').show();
        				$('#tutorialButton').hide();
        				submitButton.css('visibility', 'hidden');
        			}
        		}

        		$('#assignmentId').val(assignmentId);
        		gameStarted = true;
        		//timerId = setInterval(countdown, 1000);
        		var form = $('#turkForm');
        		if(document.referrer && (document.referrer.indexOf('workersandbox') != -1)) {
        			// console.log('Want to change form action to sandbox, but not going to.');
					//form.action = 'https://workersandbox.mturk.com/mturk/externalSubmit';	
				}		
        	}
        }
    });

    $('#submitButton').click(function() {
    	fadeSubmitButton();
    	var expression = $('#expression').text();
    	if(expression == '' || expression == waitingMessage) {
    		alert('You must wait for the other player\'s description');
    		darkenSubmitButton();
    	}
    	else if(!dotDrawn) {
    		alert('You must make a selection.');
    		darkenSubmitButton();
    	}
    	else {
    		//For Player 2 to submit the click to the server so it can be evaluated
			//in a canned game and forwarded to Player 1 in a real game
    		if(!fakeGame) {
    			sendClick();
    		}
    		else {
    			sendFakeClick();
    		}
    	} 
    });

    //Handles click event on the image
    $('#mainImage').click(function(event) {
    	if((turn == 2)) {
			if(dotDrawn) resetDot();

		    //To account for padding and margins
	        var jThis = $(this);
	        var offsetFromParent = jThis.position();
	        var topThickness = (jThis.outerHeight(true) - jThis.height())/2;
	        var leftThickness = (jThis.outerWidth(true) - jThis.width())/2;

	        x = Math.round(event.pageX - offsetFromParent.left - leftThickness);
	        y = Math.round(event.pageY - offsetFromParent.top - topThickness);

	        w = $('#mainImage').width();
	        h = $('#mainImage').height();

	        //Use ratio of click coordinates to account for different image sizes
	        xClick = x/w;
	        yClick = y/h;
	        drawDot();

	        if(!fakeGame) {
	        	var expression = $('#expression').text();
	        	if(expression != '' && expression != waitingMessage) {
	        		sendDot();
	        	}
	        }
		}
    });
});

//Establish the socket connection when the page loads
function loadFile() {
	var assignmentId = gup('assignmentId');
	//Change the popup content for MTurk players
	if(assignmentId != null) {
		$('.text p').html(mTurkInstructions);
	}
	setLoadScreen();
	loadProgressBar();

	//Connect to the server
	var serverBaseUrl = document.domain;
	socket = io.connect(serverBaseUrl);

	socket.on('connect', function() {
		var tempUsername = $('#username').text();
		username = tempUsername;
		myId = socket.socket.sessionid;
		initializeUser(emitNewUser);
		totalTimer = setInterval(totalCountdown, 1000);
	});

	//Receive opponent's data and start the game. 
	socket.on('pairPlayers', function(data) {
		var messageTarget = data.player;
		if(myId == messageTarget) {
			fakeGame = false;
			opponentId = data.opponent;
			opponentUsername = data.opponentUsername;
			//alert('Your opponent is now ' + opponentId);
			turn = data.turn;
			if(firstContact) {
				firstContact = false;
				startGame();
			}
			//Fake game already in procession
			else {
				transition = true;
			}
		}
	});

	//Server says there's no opponent to play with. Start a canned game.
	socket.on('cannedGame', function() {
		firstContact = false;
		startGame();
	});

	//Opponent has disconnected, so submit the MTurk form and restart the game
	socket.on('opponentDisconnected', function(data) {
		var messageTarget = data.player;
		if(myId == messageTarget) {					
			alert('The other player disconnected. A new game will now start.');
			sendScores();
			var assignmentId = gup('assignmentId');
			if(assignmentId != null && round >= Math.ceil(submitThreshold/2)) {
				$('#turkForm').submit();
			}
			else {
				setTimeout(function() {
                        url_target = window.location.href + "?remaining=" + (submitThreshold);
                        console.log(url_target);
                        window.location.assign(url_target);
						//location.reload();
				}, 4000);	
			}	
		}
	});

	// Server has broadcasted a message to all players. 
    // Process if the target socket id matches this player's
	socket.on('incomingMessage', function(data) {
		var target = data.target;
		//The target client id matches this one, so the message is meant for this player
		if(target == myId) {
			var keyword = data.keyword;
			var message = data.message;
			//console.log('Message for me received with keyword ' + 
            //  keyword + ' and message ' + message);
			if(keyword == 'imageNumber') {
				msg = message.split(',')[0];
				msg_toks = msg.split('_');
				m_image_name = msg.substring(0, msg.length - msg_toks[msg_toks.length - 1].length - 1);
				// VICENTE: Fix so that you can use images from other datasets 
                // that might have underscores
                                //          in the file name.
				imagePath = 'ImagesP2/' + m_image_name + '.jpg';
				turn2Visibility();
				setImage();	
			}
			else if(keyword == 'expression' && turn == 2) {
                console.log('Message received from player 1: ' + message);
				$('#expression').html(message);
			}
			else if(keyword == 'sendDot' && turn == 1) {
				xClick = message.split(',')[0];
				yClick = message.split(',')[1];
				if(dotDrawn) resetDot();
				drawDot();
			}
			else if(keyword == 'sendClick' && turn == 1) {
				xClick = message.split(',')[0];
				yClick = message.split(',')[1];
				evaluateClick();
				sendEvaluation();
				recordEntry();
				displayOutput();
				setTimeout('roundComplete();', 1500);
			}
			else if(keyword == 'evaluation' && turn == 2) {
				if(message == 'Correct!') {
					correct = true; accuracy = message;
				}
				else {
					correct = false; accuracy = 'Incorrect!';
				}
				displayOutput();
				setTimeout('roundComplete();', 1500);
			}
		}
	});

	//The server has responded with the next image number and pixel data for player 1 in a real game
	socket.on('nextImageResponse', function(data) {
		turn1Visibility();
		imageNumber = data.imageNumber.split(',')[0];
		pixels = data.pixels.data;  // old: pixels = data.pixels;
		progress = data.totalIndex;
		imagePath = 'ImagesP4/' + imageNumber;
		setImage();
        updateProgressBar();
		sendImageNumber();
	});

	//The server has responded with the next image number for player 1 in a canned game
	socket.on('nextFakeImage1Response', function(data) {
		turn1Visibility();
        imageNumber = data.imageNumber;
        progress = data.totalIndex;
		imagePath = 'ImagesP4/' + imageNumber;
		setImage();
        updateProgressBar();
	});

	//The server has responded with the pixel data for player 2 in a canned game
	//Now we can evaluate whether the click is correct
	socket.on('nextFakeImage2Response', function(data) {
		turn2Visibility();
		//imageNumber = data.imageNumber.split('_')[0] + '.jpg';
		msg = data.imageNumber.split(',')[0];
		msg_toks = data.imageNumber.split('_');
		m_image_name = msg.substring(0, msg.length - msg_toks[msg_toks.length - 1].length - 1);
		imagePath = 'ImagesP2/' + m_image_name + '.jpg';
		setImage();
        updateProgressBar();
		pixels = data.pixels.data;  // old: pixels = data.pixels;
		setTimeout(function() {
			$('#expression').html(data.expression);
		}, 5000);
	});

	//The server has responded with an evaluation of player 1's expression in a canned game
	socket.on('fakeExpressionResponse', function(data) {
		if(data.accuracy == 'Correct!') {
				correct = true; accuracy = 'Correct!';
				xClick = data.xClick;
				yClick = data.yClick;
			}
			else {
				correct = false; accuracy = 'Incorrect!';
				pixels = data.pixels.data;  // old: pixels = data.pixels;
				randomizeClick(); //TODO implement this using pixels
			}			
			setTimeout(function() {
				drawDot();
				setTimeout(function() {
					displayOutput();
					setTimeout(function() {
						roundComplete();
					}, 1500);
				}, 500);			
			}, 3500);
	});
}

//Let the server now that a new user has just connected
function emitNewUser() {
	socket.emit('newUser', {socketId: myId, username: username});
}

//Draw a green dot on the image showing where player 2 clicked
function drawDot() {
    w = $('#mainImage').width();
    h = $('#mainImage').height();

    var boxPos = getElementPosition(document.getElementById("mainImage"));
    var size = '11px';
    var pointTop = yClick*h + boxPos.y - 3;
    var pointLeft = xClick*w + boxPos.x - 3;
    $('#dotContainer').append(
        $('<div></div>')
            .css('position', 'absolute')
            .css('top', yClick*h + boxPos.y - 3 + 'px')
            .css('left', xClick*w + boxPos.x - 3 + 'px')
            .css('width', size)
            .css('height', size)
            .css('background-color', 'red')
            .css('z-index', 50)
    );
   dotDrawn = true;
}

//Removes the dot from the image
function resetDot() {
    $('#dotContainer').html('');
    dotDrawn = false;
    x = -1;
    y = -1;
    w = -1;
    h = -1;
}

//Helper function for drawDot(). Gets the absolute position of the image
function getElementPosition(theElement) {
    var posX = 0;
    var posY = 0;

    while(theElement != null) {
        posX += theElement.offsetLeft;
        posY += theElement.offsetTop;
        theElement = theElement.offsetParent;
    }
    return {x: posX, y:posY};
}

function startGame() {
    console.log('Starting game');
	if(fakeGame) {
		turn = 1;
		getFakeImage1();
	}
	//Real game
	else if(turn == 1) {
		getImage();
	}
	//var textBox = $('#textBox');
    //textBox.prop('disabled', false);
}

//For player 1 to request the next image from the server in a real game
function getImage() {
	var workerId = 'n/a';
	if(isMTurkPlayer) {
		workerId = gup('workerId');
	}
	socket.emit('nextImage', {socketId: myId, workerId: workerId});
}

//For player 1 to request the next image in a canned game
function getFakeImage1() {
	socket.emit('nextFakeImage1', {socketId: myId});
}

//For player 2 to request the next image in a canned game
function getFakeImage2() {
	socket.emit('nextFakeImage2', {socketId: myId});
}

//For player 1 to send the current image number to the server so it can be forwarded to the opponent 
function sendImageNumber() {
	socket.emit('message', {message: imageNumber, target: opponentId, keyword: 'imageNumber'});
}

//For player 2 to send the click coordinates to the server so it can be forwarded to the opponent 
function sendClick() {
	socket.emit('message', {message: xClick.toString() + ',' + yClick.toString(), target: opponentId, keyword: 'sendClick'});
}

//For player 2 to send the dot coordinates to the server so it can be forwarded to player 1
function sendDot() {
	socket.emit('message', {message: xClick.toString() + ',' + yClick.toString(), target: opponentId, keyword: 'sendDot'});
}

//For player 1 to send the click evaluation to the server so it can be forwarded to player 1
function sendEvaluation() {
	socket.emit('message', {message: accuracy, target: opponentId, keyword: 'evaluation'});
}

//For player 1 to send the expression to the server so it can be forwarded to player 1
function sendExpression(expression) {
	socket.emit('message', {message: expression, target: opponentId, keyword: 'expression'});
}

//For player 1 to send the expression to the server for evaluation in a canned game
function sendFakeExpression(expression) {
	var workerId = gup('workerId');
	var assignmentId = gup('assignmentId');
	console.log('Sending fake expression with image number ' + imageNumber + ' with workerid ' + workerId + ' and assignmentId ' + assignmentId);
	socket.emit('fakeExpression', {imageNumber: imageNumber, expression: expression, player: username, time: time, playerId: myId, workerId: workerId, assignmentId: assignmentId});
}

//Randomize click coordinates in a canned game when there is no closely matching expression.
//TODO: recheck 
function randomizeClick() {
	while(true) {
		var randomX = Math.random();
		var randomY = Math.random();
		pixelXClick = Math.floor(naturalWidth*randomX);
		pixelYClick = Math.floor(naturalHeight*randomY);
		var idx = Math.floor(naturalWidth*randomY*naturalHeight + naturalWidth*randomX);
		console.log('Idx is ' + idx + '  and pixels[idx] is ' + pixels[idx]);
		console.log('Pixels length is ' + pixels.length);
		if(idx >= pixels.length) continue;
		if(pixels[idx] != 255) {		
			xClick = randomX;
			yClick = randomY;
			return;
		}
	}
}

function loadProgressBar() {
    $('#gamesPlayed').css('color', red);
 
	$.ajax({
		url: '/progress',
		type: 'GET',
		dataType: 'json',
		success: function(data) {
			progress = data.progress;
			var progressWidth = (progress/50000)*100;
			$('#progressBarInner').width(progressWidth + '%');
		},
		error: function() {
			console.log('Error retrieving progress bar information.');
		}
	});
}

function initializeUser(callback) {
	$.ajax({
		url: '/initializeUser',
		type: 'POST',
		dataType: 'json',
		data: {id: myId},
		success: function() {
			callback();
		},
		error: function() {
			console.log('Error initializing user.');
		}
	});
	
}

function updateProgressBar() {
   $('#gamesPlayed').text(progress);
}

//Called when player 1 enters an expression
function enterText() {
	var textBox = $('#textBox');
	var expression = textBox.val();
	textBox.val('');
	$('#expression').html(expression);

	if(expression == '' || expression == enterMessage)
		alert(invalidExpression);
	else {

		if(turn == 1) {
			if(fakeGame) {
				console.log('Sending fake expression: ' + expression);
				sendFakeExpression(expression);
				textBox.prop('disabled', true);
			}
			else {
				console.log('Sending expression to player 2: ' + expression);
				sendExpression(expression);
				textBox.prop('disabled', true);
			}
		}
	}
}

//Evaluate player 2's click based on the pixel data
function evaluateClick() {
	pixelXClick = Math.floor(naturalWidth*xClick);
    pixelYClick = Math.floor(naturalHeight*yClick);
	var idx = Math.floor(naturalWidth*pixelYClick + pixelXClick);
     if(pixels[idx] == 255) {
        correct = true;
        accuracy = 'Correct!';
    }       
    else {
        correct = false;
        accuracy = 'Incorrect!';
    }
}
 
//Page layout
function turn1Visibility() {
    var textBoxDiv = $('#container');
    var textBox = $('#textBox');
    var textMessage = $('#textMessage');
    var buttonDiv = $('#submitContainerButton');
    var submitButton = $('#submitButton');
    var expression = $('#expression');
    var rightWrong = $('#rightWrong');

    textBoxDiv.css('visibility', 'visible');
    textBox.css('visibility', 'visible');
    textMessage.css('visibility', 'visible');
    //console.log('Enabling text box here');
    //console.log(textBox);
    textBox.prop('disabled', false);
    //console.log(textBox);
    buttonDiv.css('visibility', 'hidden');
    submitButton.css('visibility', 'hidden');
    expression.html(enterMessage);
    console.log(textMessage); 
}

function turn2Visibility() {
    var textBoxDiv = $('#container');
    var textBox = $('#textBox');
    var textMessage = $('#textMessage');
    var buttonDiv = $('#submitContainerButton');
    var submitButton = $('#submitButton');
    var expression = $('#expression');
    var textBoxDiv2 = document.getElementById('container');
    var rightWrong = $('#rightWrong');
    var img = $('#mainImage');

    textBoxDiv.css('visibility', 'hidden');
    textBox.css('visibility', 'hidden');
    textMessage.css('visibility', 'hidden');
    buttonDiv.css('visibility', 'visible');
    submitButton.css('visibility', 'visible');
    
    if(turn == 2 && imageCount == 0 && !fakeGame) {
        expression.html(awaitingPlayerMessage);
        img.attr('src', 'img/loadScreen.jpg');
    }
    else {
        expression.html(waitingMessage);
    }
}

function setImage() {
	var img = $('#mainImage');
	var photo = new Image();
	photo.src = imagePath;
	photo.onload = function() {
		naturalWidth = photo.width;
		naturalHeight = photo.height;
	}
	img.attr('src', imagePath);
	if(typeof(timerId) != 'undefined')
		clearInterval(timerId);
	time = 0;  // Vicente: Why was this 15?
	if(gameStarted) {
		timerId = setInterval(countdown, 1000);
    }
}


//Display the score and time for each player
function countdown() {
    var scoreDisplay = $('#scoreDisplay');
    var timeDisplay = $('#timeDisplay');
    var timeHeader = $('#timeHeader');
    var scoreHeader = $('#scoreHeader');
    var timeString = time.toString();

    if(time == 1) timeString += ' second';
    else timeString += ' seconds';
    if(time > 15) {
       timeHeader.css('background-color', red);
       scoreHeader.css('background-color', red);
    }
    else if(time > 10) {
        timeHeader.css('background-color', orange);
        scoreHeader.css('background-color', orange);
    }
    else if(time > 5) {
        timeHeader.css('background-color', yellow);
        scoreHeader.css('background-color', yellow);
    }
    scoreDisplay.html(score.toString() + "<br/><span style='font-size:0.8em'>time: " + timeString + "</span>");
    time++;
    //Force quit if other player isn't responding
    if(time == maxRespondingTime) {
    	restart();
		clearInterval(timerId);
    }
    else if($('#mainImage').attr('src') == 'img/loadScreen.jpg') {
    	clearInterval(timerId);
    }
}

function restart() {
	alert('The other player disconnected. A new game will now start.');
    sendScores();
    if(assignmentId != null && round >= Math.ceil(submitThreshold/2)) {
        $('#turkForm').submit();
    } else {
	//socket.emit('disconnect'); // Disconnect this user.
    //console.log('Emitting disconnect message');
	setTimeout(function() {
        url_target = window.location.href + "?remaining=" + (submitThreshold);
        console.log(url_target);
        window.location.assign(url_target);
		//location.reload(true);
		}, 4000);
    }	
}

function fadeSubmitButton() {
    $('#submitButton').css('background-color', lightBlue);
    document.getElementById('submitButton').disabled = true;
}

function darkenSubmitButton() {
    $('#submitButton').css('background-color', carolinaBlue);
    document.getElementById('submitButton').disabled = false;
}

function displayOutput() {
    var display = $('#rightWrong');
    if(correct) {
        assignScore(); 
        display.css('color', 'green');   
    }
    else display.css('color', 'red');
        
    display.css('z-index', 999);
    display.css('visibility', 'visible');
    display.html(accuracy);
    display.animate({opacity: 1}, {duration: 500});
    display.animate({opacity: 0}, {duration: 2500});
}

function setLoadScreen() {   
    $('#submitButton').css('visibility', 'hidden');
    $('#textBox').css('visibility', 'hidden');
    $('#rightWrong').css('z-index', -100);
    $('#rightWrong').css('visibility', 'hidden');
	$('#rightWrong').css('visibility', 'hidden');
    $('#expression').html(awaitingPlayerMessage);
    $('#mainImage').attr('src', 'img/loadScreen.jpg');
}

function assignScore() {
    if(time < 10) {
        score += 15;
    }
    else if(time >= 10 && time < 20) {
        score += 10;
    }
    else if(time >= 20 && time < 30) {
        score += 7;
    }
    else if(time >= 30 && time < 40) {
        score += 3;
    }
    else {
        score ++;
    }
}

//Finish processing this round and go on to the next one
function roundComplete() {
	darkenSubmitButton();
	resetDot();
	assignTurn();	
	if(!fakeGame) {
		imageCount++;
	}
	if(correct) {
		round++;
		var roundsRemaining = submitThreshold - round;
    	$('#timeDisplay').html(roundsRemaining);
	}
	$('#rightWrong').css('visibility', 'hidden');
	if(!fakeGame && transition) {
		transition = false;
		if(turn == 1) {
			getImage();
		}
	}
	else if(!fakeGame && turn == 1) {
		getImage();
	}
	else if(fakeGame && turn == 1) {
		getFakeImage1();
	}
	else if(fakeGame && turn == 2) {
		getFakeImage2();
	}
	var assignmentId = gup('assignmentId');
	//MTurk Player
	if(assignmentId != null) {
		if(round >= submitThreshold) {
			$('#turkForm').submit();
		}
	}
}

function assignTurn() {
	if(correct) {
		if(turn == 1) turn = 2;
		else turn = 1;
	}
}

//Everything for this object has been evaluated. Now save it!
function recordEntry() {
	var expression = $('#expression').text();
	var click = xClick.toString() + yClick.toString();
	var workerId = gup('workerId');
	var assignmentId = gup('assignmentId');
	console.log('Recording entry with expression ' + expression + ' and workerId is ' + workerId + ' and assignmentId is ' + assignmentId);
	socket.emit('game', {imageNumber: imageNumber, expression: expression, accuracy: accuracy, click: click, player: username, opponent: opponentUsername, time: time, workerId: workerId, assignmentId: assignmentId});
}

function sendScores() {
	$.ajax({
		url: '/score',
		type: 'POST',
		dataType: 'json',
		data: {score: score, player: username, opponent: opponentUsername},
		error: function() {
			console.log('Error sending scores to the server.');
		}
	});
}

function sendFakeClick() {
	evaluateClick();
	displayOutput();
	setTimeout('roundComplete();', 1500);
}

//Mechanical Turk
// Gets parameters 
function gup(name) {
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var tempURL = window.location.href;
  var results = regex.exec(tempURL);
  if(results == null) return null;
  else return results[1];
}

function isMTurkPlayer() {
	if(gup('assignmentId') == null) {
		return false;
	}
	else return true;
}


//Workers have complained that the other player disconnects
//right before HIT is to be submitted, so in fairness, 
//make it submit if they have been playing for at least 4 minutes and have 7 correct rounds
function totalCountdown() {
	totalTime++;
}
