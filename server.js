//Version restructure, trying to redo the canned games
var HashMap = require('hashmap').HashMap,
	express = require('express'),
	app = express(),
	fs = require('fs'),
	http = require('http').createServer(app),
	io = require('socket.io').listen(http),
	_ = require('underscore'),
	flash = require('connect-flash'),
	passport = require('passport'),
	util = require('util'),
	LocalStrategy = require('passport-local').Strategy,
	path = require('path'),
	pngparse = require('pngparse'),
	mongoose = require('mongoose'),
	Account = require('./models/account'),
	sets = require('simplesets'),
	winston = require('winston');
	Tokenizer = require('sentence-tokenizer');
    lemmatizer = require('lemmatizer').lemmatizer;
    bodyParser = require('body-parser');
    morgan = require('morgan');
    methodOverride = require('method-override');
    cookieParser = require('cookie-parser');
    session = require('express-session');

io.configure(function() {
    io.set('log level', 2);
});

//Redirect console.log
var logger = new (winston.createLogger)({
	transports: [
		new (winston.transports.Console)({ json: false, timestamp: true }),
    	new winston.transports.File({ filename: __dirname + '/debug.log', json: false })
	],
	exceptionHandlers: [
	    new (winston.transports.Console)({ json: false, timestamp: true }),
	    new winston.transports.File({ filename: __dirname + '/exceptions.log', json: false })
	  ],
	  exitOnError: false
});

//The index and totalIndex are passed as command line parameters
var index = 1;
var totalIndex = 100;
var maxIndex = 200000;
var cannedGamesEnabled = true;
console.log('Parameters: index is ' + index + ' and totalIndex is ' + totalIndex);

if(isNaN(index) || isNaN(totalIndex)) {
	logger.error('Cannot parse the command line argument as the index or totalIndex (NaN).');
	//process.exit(1);
    // licheng: I will initialize index and totalIndex
    logger.info('Licheng initializes index and totalIndex with 0')
    index = 0;
    totalIndex = 0;
}
if(typeof(index) == 'undefined' || typeof(totalIndex) == 'undefined') {
	logger.error('Cannot parse the command line argument as the index or totalIndex (undefined).');
	process.exit(1);
}

var imageArray = new Array; //Defines the image order for real games
var labeledImageArray = new Array; //Already-labeled images to be used in canned game
var singleMap = new HashMap(); //Maps from socketid to null ("hashset")
var pairedMap = new HashMap(); //Maps from socketid to socketid
var nameMap = new HashMap(); //Maps from socket id to username
var addressMap = new HashMap(); //Maps from socket id to IP address

//Server configuration
app.set('ipaddr', '127.0.0.1');
app.set('port', 8030);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static('public')); // old: app.use(express.static('public', __dirname + '/public'));
app.use(bodyParser.json());  // old: app.use(express.bodyParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.enable('trust proxy');

//Passport configuration for logging in
app.set('view options', {layout: false});
app.use(morgan()); // old: app.use(express.logger());
app.use(methodOverride()); // old: app.use(express.methodOverride());
app.use(cookieParser('your secret here')); // old: app.use(express.cookieParser('your secret here'));
app.use(session()) // old: app.use(express.session());
app.use(passport.initialize());
app.use(passport.session());
// old: app.use(app.router); This has been deprecated!

passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

//Setup routes
require('./routes')(app);

//Start the http server at port and IP defined before
// http.listen(app.get('port'), app.get('ipaddr'), function() {
// 	console.log('Server up and running. Go to http://' + app.get('ipaddr') + ":" + app.get('port'));
// });
http.listen(app.get('port'))
console.log('Server up and running at port: ' + app.get('port'));

// Tokenize and lemmatize words in a sentence.
function lemmatize(sentence, callback) {
    var tokenizer = new Tokenizer('Chunk');
    tokenizer.setEntry(sentence);
    tokenizer.getSentences();
    var tokens_all = tokenizer.getTokens();
    console.log(tokens_all);
    var mtoks = [];
    for (var i = 0; i < tokens_all.length; i++) {
        mtoks[i] = lemmatizer(tokens_all[i]);
    }
    console.log(mtoks);
    callback(mtoks);
}
// Helper function to concatenate calls sequentially.
function phrase_similarity_helper(set_A, sentences_B, similarities, position, callback) {
    if(position == sentences_B.length) {
        callback(similarities);
        return;
    }   
    //logger.info('\nSentence_B: ' + sentences_B[position]);
    lemmatize(sentences_B[position], function(tokens_B) {
        // logger.info('Tokens_B: ' + tokens_B);
        var set_B = new sets.Set([]);
        for(i = 0; i < tokens_B.length; ++i)
            set_B.add(tokens_B[i]); 
        intersection = set_A.intersection(set_B);
        similarities[position] = intersection.size() / 
                           (Math.sqrt(set_A.size()) * Math.sqrt(set_B.size()));
        // logger.info('Similarity: ' + similarities[position]);
        phrase_similarity_helper(set_A, sentences_B, similarities, position + 1, callback);
    });
}
// Compute the similarity between two sentences and handle the result
// by providing a callback function.
function phrase_similarity(sentence_A, sentences_B, callback) {
    var set_A = new sets.Set([]);
    var similarities = new Array(sentences_B.length);

    // Compute distance between sentences.
    //logger.info('Sentence_A: ' + sentence_A);
    lemmatize(sentence_A, function(tokens_A){
       // logger.info('Tokens_A: ' + tokens_A);
        for(i = 0; i < tokens_A.length; ++i)
            set_A.add(tokens_A[i]);
        phrase_similarity_helper(set_A, sentences_B, similarities, 0, callback);
    });
}

//Database connections and schemas
//mongoose.set('debug', false);
mongoose.connect('mongodb://localhost/accounts_coco', { useNewUrlParser: true });
var sessionConn = mongoose.createConnection('mongodb://localhost/sessions_coco');
var personalConn = mongoose.createConnection('mongodb://localhost/personals_coco'); //Used for personal high scores
var scoreConn = mongoose.createConnection('mongodb://localhost/topscores_coco'); //Used for all-time high scores

//Defines the schema for entries in the Games collection. These are "real games."
var gameSchema = new mongoose.Schema({
	imageNumber: {type: String},
	expression: {type: String},
	accuracy: {type: String},
	click: {type: String},
	player: {type: String},
	opponent: {type: String},
	playerIP: {type: String},
	opponentIP: {type: String},
	time: {type: Number},
	timeStamp: {type: Date},
	workerId: {type: String},
	assignmentId: {type: String}
}, {collection: 'Games'});

//Defines the schema for entries in the CannedGames collection. 
var cannedGameSchema = new mongoose.Schema({
	imageNumber: {type: String},
	expression: {type: String},
	accuracy: {type: String},
	closestMatch: {type: String},
	player: {type: String},
	playerIP: {type: String},
	time: {type: Number},
	timeStamp: {type: Date},
	workerId: {type: String},
	assignmentId: {type: String}
}, {collection: 'CannedGames'});

//Defines the schema for personal highscore entries in the Personals collection
var personalScoreSchema = new mongoose.Schema({
	highScore: {type: Number},
	date: {type: Date},
	username: {type: String}
}, {collection: 'Personals'});

//Defines the schema for all-time highscores in the TopScores collection
var topScoreSchema = new mongoose.Schema({
	username: {type: String},
	highScore: {type: Number},
	date: {type: Date}
}, {collection: 'TopScores'});

//Define the model variable for each of the collections
var gameModel = sessionConn.model('GameModel', gameSchema);
var cannedGameModel = sessionConn.model('CannedGameModel', cannedGameSchema);
var topScoreModel = scoreConn.model('TopScoreModel', topScoreSchema);
var personalModel = personalConn.model('PersonalScore', personalScoreSchema);

//Reads the input file containing image order for real games
fs.readFile('NewestOrder.txt', 'utf-8', function(err, data) {
	if(err) logger.error(err);
	imageArray = data.toString().split('\n');
});

fs.readFile('LabeledImages.txt', 'utf-8', function(err, data) {
	if(err) logger.error(err);
	labeledImageArray = data.toString().split('\n');
});

//Socket.io events
io.on('connection', function(socket) {

	//When a new user connects, pair them with another unmatched player 
	//if one exists. Otherwise, start them with a canned game
	socket.on('newUser', function(data) {
		 // logger.info('Got a new user with socketId: ' + data.socketId + 
			// ' and name ' + data.username);
		// logger.info('Current player count: ' + pairedMap.count());
		nameMap.set(data.socketId, data.username); 
		//Pair this player
		if(singleMap.count() > 0) {
			pairPlayers(data.socketId);
		}
		//Add this player to the queue
		else {
			logger.info('No other player found');
			enqueue(data.socketId);
		}
	});

	//When a player disconnects, also disconnect their opponent if they were playing a real game
	socket.on('disconnect', function() {
		var disconnectedId = socket.id;
		// logger.info('DisconnectedId is ' + disconnectedId);
		singleMap.remove(disconnectedId);
		if(typeof(pairedMap.get(disconnectedId)) != 'undefined') {
			var opponentId = pairedMap.get(disconnectedId);
			addressMap.remove(disconnectedId);
			addressMap.remove(opponentId);
			pairedMap.remove(disconnectedId);
			pairedMap.remove(opponentId);
			nameMap.remove(disconnectedId);
			disconnectOpponent(opponentId);
		}
	});

	//Save the object submitted by the player in the Games collection
	socket.on('game', function(data) {
		if(typeof(data.expression) == undefined) {
			console.log('Type of data.expression is undefined for game.');
			return;
		}
		var imageNumber = data.imageNumber;
		var expression = data.expression;
		var accuracy = data.accuracy;
		var click = data.click;
		var player = data.player;
		var opponent = data.opponent;
		var playerIP = addressMap.get(socket.id);
		var opponentId = pairedMap.get(socket.id);
		var opponentIP = addressMap.get(opponentId);
		var time = data.time;
		var workerId = data.workerId; //only for Mechanical Turk players
		var assignmentId = data.assignmentId;

		// logger.info('PlayerIP is ' + playerIP + ' and opponentIP is ' + opponentIP + ' and worker id is ' + workerId + ' and assignmentId ' + assignmentId);
		// logger.info('Player socketid is ' + socket.id + ' and opponent id is ' + opponentId);
		var entry = new gameModel({
			imageNumber: imageNumber,
			expression: expression,
			accuracy: accuracy,
			click: click,
			player: player,
			opponent: opponent,
			playerIP: playerIP,
			opponentIP: opponentIP,
			time: time,
			timeStamp: new Date(),
			workerId: workerId,
			assignmentId: assignmentId
		});

		entry.save(function(err, entry) {
			if(err) logger.error(err);
		});
	});

	//Handles Player 1 requests for the next image.
	//Gives the player the image number and the corresponding parsed PNG
	//data for the object so that the accuracy for Player 2's click
	//can be determine on the client-side

	socket.on('nextImage', function(data) {
		// logger.info('Sending next image.');
		var imageNumber = imageArray[index];
		if(typeof(imageNumber) == undefined) {
			logger.info('ImageNumber ' + imageNumber + ' is unefined.');
			return;
		}
		var pngName = 'public/PNGImages/' + imageNumber.split('.jpg')[0] + '.png';
		logger.info('PNGNAME is ' + pngName + ' and imageNumber is ' + imageNumber);
		
		var workerId = data.workerId;
		index++;
		if(index > maxIndex) {
			process.exit(0);
		}
		logger.info(index + ' ' + totalIndex);
	
		//Ensure that the same user hasn't entered an expression for this same object before
		//so we can get analyze speaker variability across expressions for the same object
		while(true) {
			var currentImage = imageArray[index];
			var pastUser = false;
			gameModel.find({}).where('imageNumber').equals(currentImage).exec(function(err, docs) {
				if(err) logger.error(err);
				docs.forEach(function(entry) {
					// logger.info('Past user for imNumber ' + doc.imageNumber + ' is ' + doc.workerId);
					if(entry.workerId == workerId) {
						// logger.info('Matching workerIds of ' + workerId);
						pastUser = true;
					}
				});
			});	
			if(!pastUser) break;
			index++;
			if(index > maxIndex) {
				process.exit(0);
			}
			logger.info(index + ' ' + totalIndex);
		}
		totalIndex++;
		//logger.info('Index is now ' + index + ' for needImages (Round 1)');
        logger.info(index + ' ' + totalIndex);
		pngparse.parseFile(pngName, function(err, pixels) {
            if(err) logger.error(err);

            var num_zeros = 0, num_ones = 0;
            for (var i = 0; i < pixels.data.length; i++){
                if (pixels.data[i] == 0) {
                    num_zeros += 1;
                }else{
                    num_ones += 1;
                }
            }
            console.log('num_zeros: ', num_zeros, 'num_ones: ', num_ones);

			// logger.info('About to send next image response to ' + data.socketId);
			io.sockets.sockets[data.socketId].emit('nextImageResponse', {imageNumber: imageNumber, totalIndex: totalIndex, pixels: pixels.data});
		});		
	});

	//This gives the next image for Player 1 in a canned game
	//However for these we don't get expression validation through a second player's click
	socket.on('nextFakeImage1', function(data) {
		var randomIndex = Math.floor((Math.random() * labeledImageArray.length));
        var cannedImageNumber = labeledImageArray[randomIndex];
		//Find an object for which another player has already written a valid expression
		gameModel.findOne({}).where('imageNumber').equals(cannedImageNumber).where('accuracy').equals('Correct!').exec(function(err, result) {
			if(err) logger.error(err);
			totalIndex++;
			// logger.info('Sending next fake image 1, found random with imageNumber ' + cannedImageNumber);
			io.sockets.sockets[data.socketId].emit('nextFakeImage1Response', {imageNumber: cannedImageNumber, totalIndex: totalIndex});
		});
	});

	//The server finds an expression for that image and sends it to Player 2 in the canned game
	//along with the pixels for client-side evaluation
	socket.on('nextFakeImage2', function(data) {
		// logger.info('Sending next fake image 2, new version.');
		var randomIndex = Math.floor((Math.random() * labeledImageArray.length));
		var cannedImageNumber = labeledImageArray[randomIndex];
		gameModel.findOne({}).where('imageNumber').equals(cannedImageNumber).where('accuracy').equals('Correct!').exec(function(err, result) {
			if(err) logger.error(err);
			if(result == null) {
				logger.error('Result is null. ' + err);
				return;
			}
			var expression = result.expression;
			var pngFile = 'public/PNGImages/' + cannedImageNumber.split('.jpg')[0] + '.png';
			pngparse.parseFile(pngFile, function(err, pixels) {
				if(err) logger.error(err);
				io.sockets.sockets[data.socketId].emit('nextFakeImage2Response', {imageNumber: cannedImageNumber, expression: expression, pixels: pixels.data, totalIndex: totalIndex});
			});
		});
	});

	socket.on('message', function(data) {
		var message = data.message;
		var target = data.target;
		var keyword = data.keyword;
		// logger.info('Message is ' + message + ' and target is ' + target + ' and keyword is ' + keyword);
		io.sockets.sockets[target].emit('incomingMessage', {message: message, target: target, keyword: keyword});
	});

	//When Player 1 submits an expression in the canned game, we find the closest
	//matching expression that's already been written for that object 
	//and send the (x,y) coordinates of the click that was used in that round
	//to mimic the role of Player 2. If there is no closest match, we tell the 
	//player to generate click coordinates randomly

	socket.on('fakeExpression', function(data) {
		//io.sockets.sockets[playerId].emit('fakeExpressionResponse', {accuracy: 'Correct!', xClick: .5, yClick: .5});
		//return;	
		if(typeof(data.expression) == undefined) {
			console.log('Type of data.expression is undefined for fakeExpression.');
			return;
		}
		var imageNumber = data.imageNumber;
		var expression = data.expression;
		var accuracy; //TODO
		var closestMatch = null; //TODO
		var player = data.player;
		var playerId = data.playerId;
		var playerIP = addressMap.get(playerId);
		var time = data.time;
		var workerId = data.workerId;
		var assignmentId = data.assignmentId;
		// logger.info('WorkerId for canned game is ' + workerId + ' and assignmentId' + assignmentId);

		gameModel.find({}).where('imageNumber').equals(imageNumber).exec(function(err, docs) {
            if(err) logger.error(err);
			var sentenceA = expression;
			var sentencesB = [];
			var sentenceDetails = [];
			var bestCorrectness;
			var bestClick;

			docs.forEach(function(entry) {
				if(entry == null) {
					logger.error('Entry retrieved for image number ' + imageNumber + ' is null.');
					return;
				}
				// logger.info('!!! !! Pushing ' + entry + ' to sentencesB and Details. !!! ');
				sentencesB.push(entry.expression);
				sentenceDetails.push(entry);
			});

			phrase_similarity(sentenceA, sentencesB, findBestMatch);	
			function findBestMatch(similarities) {
				var bestMatch = 0;
				// logger.info('Phrase A: ' + sentenceA);
				for(i = 0; i < sentencesB.length; ++i) {
					if(isNaN(similarities[i])) {
						similarities[i] = 0;
					}
					// logger.info('Phrase B[' + i + ']:' + sentencesB[i] + 
					//	', similarity = ' + similarities[i]);
					if(similarities[i] > similarities[bestMatch]) {
						bestMatch = i;
					}
				}
				
				if(similarities[bestMatch] == 0) {
					bestCorrectness = 'None';
					accuracy = 'Incorrect!';
				}
				/*
				else if(bestMatch < 0) { //TODO sentenceDetails is not always filled 
					logger.info('BestMatch is < 0 at ' + bestMatch);
					bestCorrectness = 'None';
					accuracy = 'Incorrect!';
				}
				*/
				else {
					// logger.info('SentenceDetails length is ' + sentenceDetails.length + '. BestMatch is ' +
					//	bestMatch + ' and sentence[bestMatch] is ' + sentenceDetails[bestMatch]);
					bestCorrectness = sentenceDetails[bestMatch].accuracy;
					bestClick = sentenceDetails[bestMatch].click;
					//var details = sentenceDetails[bestMatch].split('_,_');
					accuracy = bestCorrectness;
					closestMatch = sentencesB[bestMatch];
					// logger.info('Accuracy is ' + accuracy + ' and closestMatch is ' + closestMatch + 
						//' and bestClick is ' + bestClick);
				}
				
				var entry = new cannedGameModel({
					imageNumber: imageNumber,
					expression: expression,
					accuracy: accuracy,
					closestMatch: closestMatch,
					player: player,
					playerIP: playerIP,
					time: time,
					timeStamp: new Date(),
					workerId: workerId,
					assignmentId: assignmentId
				});

				entry.save(function(err, entry) {  
					if(err) logger.error(err);
					//There is no similar matching expression, so we 
					//tell the player to randomly generate click coordinates
					if(similarities[bestMatch] == 0) {
						// logger.info('No match found for ' + expression);
						var pngFile = 'public/PNGImages/' + imageNumber.split('.jpg')[0] + '.png';
						pngparse.parseFile(pngFile, function(err, pixels) {
							if(err) logger.error(err);
							io.sockets.sockets[playerId].emit('fakeExpressionResponse', {accuracy: 'Incorrect!', pixels: pixels.data});
						});
					}

					//The closest matching expression produced a correct click,
					//so we send those coordinates to the player
					if(accuracy == 'Correct!') {
						xClick = bestClick.split('.')[1];
						xClick = parseFloat('.' + xClick);
						yClick = bestClick.split('.')[2];
						yClick = parseFloat('.' + yClick);
						io.sockets.sockets[playerId].emit('fakeExpressionResponse', {accuracy: 'Correct!', xClick: xClick, yClick: yClick});
					}
					//The closest matching expression produced an incorrect click, so we 
					//tell the player to randomly generate click coordinates
					else {
						var pngFile = 'public/PNGImages/' + imageNumber.split('.jpg')[0] + '.png';
						pngparse.parseFile(pngFile, function(err, pixels) {
							if(err) logger.error(err);
							io.sockets.sockets[playerId].emit('fakeExpressionResponse', {accuracy: 'Incorrect!', pixels: pixels.data});
						});
					}
				});
			}
		});	
	});
});

//Inform opponent that user has disconnected, and start new game for opponent
function disconnectOpponent(opponentId) {
	// logger.info('Opponent id is' + opponentId);
	io.sockets.sockets[opponentId].emit('opponentDisconnected', {player: opponentId});
}

//Pair two players
function pairPlayers(player) {
        logger.info('Trying to pair player..');
	var keys = [];
	singleMap.forEach(function(value, key) {
		keys.push(key);
	});
	var playerIP = addressMap.get(player); //invariant at this point must have registered IP
	// logger.info('PlayerIP is ' + playerIP);
	for(var i = 0; i < keys.length; i++) {
                logger.info('looking ' + i);
		var potentialOpponent = keys[i];
		var potentialOpponentIP = addressMap.get(potentialOpponent);
		if(playerIP != potentialOpponentIP || playerIP == '127.0.0.1') {
			opponent = keys[i];
			singleMap.remove(opponent);
			pairedMap.set(player,opponent);
			pairedMap.set(opponent,player);
			// logger.info('Paired player ' +  player + ' with' + opponent);
			var playerUsername = nameMap.get(player);
			var opponentUsername = nameMap.get(opponent);
			io.sockets.sockets[player].emit('pairPlayers', 
                {player: player, opponent: opponent, opponentUsername: opponentUsername, turn: 1});
			io.sockets.sockets[opponent].emit('pairPlayers', 
                {player: opponent, opponent: player, opponentUsername: playerUsername, turn: 2});
            logger.info('Players were paired!' + playerIP + ", " + potentialOpponentIP);
            logger.info('Players were paired!' + player + ", " + opponent);
			return;
		}
		else {
			//Only other potential opponent is from the same IP, 
            // so we don't want to pair them so we start a canned game
			// logger.info('Setting to canned game b/c only potential opponent is from same IP');
				enqueue(player);
	            logger.info('No good match ' + playerIP + ", " + potentialOpponentIP);	
		}

	}
}

//Start player on a canned game
function enqueue(player) {
	singleMap.set(player,null);
        logger.info('Set to canned game.');
	if(cannedGamesEnabled) { 
		io.sockets.sockets[player].emit('cannedGame');
	}
}

//AJAX calls
app.post('/score', function(request, response) {
	var score = request.body.score;
	var player = request.body.player;
	var opponent = request.body.opponent;
	/*if(player != 'anonymous')
		savePersonalScore(player,score);
	if(opponent != 'anonymous')
		savePersonalScore(opponent,score);
	*/
	//updateTopScores(player,score);
	//updateTopScores(opponent,score);
});

app.get('/topScores', function(request, response) {
	var allRecords = [];
	topScoreModel.find({}).sort({highScore: -1}).exec(function(err, docs) {
		docs.forEach(function(doc) {
			var entry = {
				username: doc.username,
				highScore: doc.highScore,
				date: doc.date
			}
			if(doc.highScore > 0)
				allRecords.push(entry);
		});
		response.send(allRecords);
	});
});

app.post('/initializeUser', function(request, response) {
	var sessionId = request.body.id;
	var ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
	addressMap.set(sessionId, ip);
	// logger.info('Saving to addressMap. For client ' + sessionId + ' value is ' + addressMap.get(sessionId));
	response.json(200);
});

//Sends the totalGames count to the player
app.get('/progress', function(request, response) {
	response.json(200, {progress: totalIndex});
});

//Sends the top 10 scores for logged-in players
app.post('/personalScores', function(request, response) {
	var username = request.body.username;
	var personalRecords = [];

	personalModel.find({}).where('username').equals(username).sort({highScore: -1}).exec(function(err, docs) {
		docs.forEach(function(doc) {
			var entry = {
				highScore: doc.highScore,
				date: doc.date
			}
			if(doc.highScore > 0)
				personalRecords.push(entry);
		});
		response.send(personalRecords);
	});
});

//Update the leaderboard if an incoming score from a logged-in player qualifies
function updateTopScores(player,score) {
	if(player == 'anonymous' || score <= 0) return;
	var minScore = -1; var minId = ''; var day = new Date();

	topScoreModel.count({}, function(err, count) {
		if(err) logger.error(err);
		else if(count < 10) {
			var entry = new topScoreModel({
				username: player,
				highScore: score,
				date: day
			});
			entry.save(function(err, entry) {
				if(err) logger.error(err);
			});
		}
		else {
			//Find minimum high-score for this player
			docs.forEach(function(entry) {
				if(entry.highScore < minScore) {
					minScore = entry.highScore;
					minId = entry._id;
				}
			});
			//Delete old record and insert new one
			if(score > minScore) {
				topScoreModel.findByIdAndRemove(minId, function(err, doc) {
					if(err) logger.error(err);
				});
				var entry = new topScoreModel({
					highScore: score,
					date: day,
					username: player
				});
				entry.save(function(err, docs) {
					if(err) logger.error(err);
					// logger.info('New topscore for ' + player + ' of ' + score); 
				});
			}
		}
	});
}

//Update a player's highscore board it's in their top 10
function savePersonalScore(player, score) {
	// logger.info('Saving personal score for ' + player);
	if(score <= 0) return;
	var minScore = -1; var minId = ''; var day = new Date();

	personalModel.find({}).where('username').equals(player).exec(function(err, docs) {
		if(err) logger.error(err);
		if(docs.length < 10) {
			var entry = new personalModel({
				highScore: score,
				date: day,
				username: player
			});
			entry.save(function(err, entry) {
				if(err) logger.error(err);
				// logger.info('New personal highscore for ' + player + ' of ' + score);
			});
		}
		else {
			//Find minimum high-score for this player
			docs.forEach(function(entry) {
				if(entry.highScore < minScore) {
					minScore = entry.highScore;
					minId = entry._id;
				}
			});
			//Delete old record and insert new one
			if(score > minScore) {
				personalModel.findByIdAndRemove(minId, function(err, doc) {
					if(err) logger.error(err);
				});
				var entry = new personalModel({
					highScore: score,
					date: day,
					username: player
				});
				entry.save(function(err, docs) {
					if(err) logger.error(err);
					// logger.info('New personal highscore for ' + player + ' of ' + score); 
				});
			}
		}
	});
}