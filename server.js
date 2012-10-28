var express = require('express');
var app = express();
var mongoose = require('mongoose');
var db = mongoose.createConnection('localhost', 'rs-backup');
var User;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  var userSchema = mongoose.Schema({
    mail: String,
    bearerToken: String,
    storageHref: String,
    interval: String
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
  var data = req.body;
  User.findOne({storageHref: new RegExp('^'+data.storageHref+'$', "i")}, function(err, res) {
    if (res === null) {
      return;
    }

    remoteStorage.nodeConnect.setUserAddress(data.storageHref, function(err) {
      if(!err) {
        remoteStorage.nodeConnect.setBearerToken(data.bearerToken);
        console.log("rs connected!");
        remoteStorage.claimAccess('root', 'r');
      }
    });

    // res.attachment('tmp/' + filename);
  });

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

function match(data) {
  return {
    storageHref: new RegExp('^'+data.storageHref+'$', "i"),
    bearerToken: new RegExp('^'+data.bearerToken+'$', "i")
  };
}

var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port ', port);