//TODO: fix this in remoteStorage.js
global.require = require;
var express = require('express');
var mongoose = require('mongoose');
//TODO: implement faster and bigger localStorage based on redis
// localStorage = require('localStorage');
var remoteStorage = require('./remoteStorage-node-debug');
//TODO: fix this by wrapping root module in commonjs format
global.remoteStorage = remoteStorage;
require('./js/vendor/remoteStorage.root');

var app = express();

var db = mongoose.createConnection('localhost', 'rs-backup');
var User;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  var userSchema = mongoose.Schema({
    mail: String,
    interval: String,
    bearerToken: String,
    storageHref: String,
    storageType: String
  });
  User = db.model('User', userSchema);
});

app.configure(function() {
  app.set('views', '');
  app.set('view options', {
    layout: false
  });
  app.engine('html', require('ejs').renderFile);
  app.use(express.bodyParser());
  // app.use(express.methodOverride());
  // app.use(app.router);
  app.use(express.static(__dirname));
  app.use(express.logger());
  app.use(express.compress());
});


app.get('/', function(req, res) {
  res.render('index.html');
});

app.post('/lookup', function(req, res) {
  var data = req.body;
  User.findOne(match(data), function(err, doc) {
    if (doc === null) return;
    data.mail = doc.mail;
    data.inteval = doc.interval;
    res.send(data);
  });
});

app.post('/update', function(req, res) {
  var data = req.body;
  //TODO: validate data here
  User.findOne(match(data), function(err, doc) {
    var user = (doc === null) ? new User() : doc;
    user.mail = data.mail;
    user.interval = data.interval;
    user.storageHref = data.storageHref;
    user.storageType = data.storageType;
    user.bearerToken = data.bearerToken;
    user.save(function (err) {
      if (err) {
        res.send(500, 'We are sorry. Something went wrong.');
      } else {
        res.send(doc === null ?
          'Subscribtion was successful.'
        : 'Settings were successfully updated.'
        );
      }
    });
  });
});

//TODO: remove /download
app.post('/download', function(req, res) {
    // res.attachment('tmp/' + filename);
});

app.post('/leave', function(req, res) {
  var data = req.body;
  User.findOne(match(data), function(err, doc) {
    if (doc === null) {
      res.send(404, 'We are sorry. Something went wrong.');
      return;
    }
    doc.remove(function(err) {
      if (err) {
        console.log(err);
        res.send(500, 'We are sorry. Something went wrong.');
      } else {
        res.send(200, 'Your data was successfully removed from rs-backup.');
      }
    });
  });
});

//TODO: remove /test and implement cron scheduling
app.post('/test', function(req, res) {
  User.find(function(err, docs) {
    docs.forEach(function(doc) {
      remoteStorage.nodeConnect.setStorageInfo(doc.storageType, doc.storageHref);
      remoteStorage.nodeConnect.setBearerToken(doc.bearerToken);
      remoteStorage.claimAccess('root', 'r');
      remoteStorage.root.use('/');
      //TODO: fillSync needs to be faster
      remoteStorage.fullSync(function() {
        var data = {};
        remoteStorage.root.getListing('/').forEach(function(modulePath) {
          var module = modulePath.slice(0, -1);
          data[module] = {};
          remoteStorage.root.getListing('/' + modulePath).forEach(function(listPath) {
            var list = listPath.slice(0, -1);
            data[module][list] = [];
            remoteStorage.root.getListing('/' + modulePath + listPath).forEach(function(document) {
              data[module][list][document] = remoteStorage.root.getObject('/' + modulePath + listPath + document);
            });
          });
        });
        //TODO: ensure all data is ready before you continue
        //TODO: send mail
        //TODO: zip data
      });

    });
  });
});


function match(data) {
  return {
    storageHref: new RegExp('^'+data.storageHref+'$', "i"),
    bearerToken: new RegExp('^'+data.bearerToken+'$', "i")
  };
}


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port ', port);