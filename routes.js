var passport = require('passport'),
    Account = require('./models/account');

module.exports = function (app) {

    var opts = new Object();
    opts.failureRedirect = '/falseLogin';
    
    app.get('/', function (req, res) {
        res.render('index', { user : req.user });
    });

    app.get('/truth', function(req, res) {
        res.render('truth', {});
    });

    app.get('/register', function(req, res) {
        res.render('register', { });
    });

    app.get('/mturk1', function(req, res) {
        res.render('mturk1', {});
    }); 

    app.get('/mturk2', function(req, res) {
        res.render('mturk2', {});
    });

    app.get('/test', function(req, res) {
        res.render('test', { });
    })

    app.get('/visualize', function(req, res) {
        res.render('visualize');
    })

    app.post('/register', function(req, res) {
        Account.register(new Account({ username : req.body.username }), req.body.password, function(err, account) {
            if (err) {
                console.log('Registration error!');
                return res.render('register', { account : account });
            }
            res.redirect('/');
        });
    });

    app.get('/faq', function(req, res) {
        res.render('faq', {user: req.user});
    });

    app.get('/login', function(req, res) {
         console.log("executing login" + req.user);
        res.render('login', { user : req.user });
    });
   
    app.post('/login', passport.authenticate('local', opts), function(req, res) {
        res.redirect('/home');
    });

    app.get('/falseLogin', function(req, res) {
        res.render('falseLogin', {user: req.user});
    });

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/play', function(req, res) {
        res.render('game', { user: req.user, loc: 'play' });
    });

    app.get('/home', function(req, res) {
        res.render('home', {user: req.user});
    });
};