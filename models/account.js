var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    passportLocalMongoose = require('../passport-local-mongoose.js');

var Account = new Schema({
    nickname: String,
    birthdate: Date
});

Account.plugin(passportLocalMongoose);

module.exports = mongoose.model('Account', Account);