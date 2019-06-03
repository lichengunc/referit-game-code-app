const express = require('express')
const app = express()
var Tokenizer = require('sentence-tokenizer');
var lemmatizer = require('lemmatizer').lemmatizer;

lemmatize('The left child running on the road.', console.log)

app.get('/', function(req, res) {
    res.send('Hello World!');
})

app.listen(3000, function () {
    console.log('Example app listening to port 3000!')
})

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