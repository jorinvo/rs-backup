var fs = require('fs');
var _ = require('underscore');
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

var db = mongoose.createConnection.apply(mongoose, process.env.MONGOHQ_URL ? [process.env.MONGOHQ_URL] : ['localhost', 'rs-backup']);

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

var nodemailer = require("nodemailer");
var transport = nodemailer.createTransport("SMTP", require('./mail.json'));
// var transport = nodemailer.createTransport("sendmail");

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
  User.findOne(match(data), function(err, user) {
    if (user === null) return;
    data.mail = user.mail;
    data.inteval = user.interval;
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
  User.findOne(match(data), function(err, user) {
    if (user === null) {
      res.send(404, 'We are sorry. Something went wrong.');
      return;
    }
    user.remove(function(err) {
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
  User.find(function(err, users) {
    // console.log('found users: ', users)
    sendData(users);
  });
});


function match(data) {
  return {
    storageHref: new RegExp('^'+data.storageHref+'$', "i"),
    bearerToken: new RegExp('^'+data.bearerToken+'$', "i")
  };
}

function sendData(users) {
  interate(users, function(user, next) {
    // console.log('user: ', user)
    //TODO: zip data
    getRemoteData({
      user: user,
      cb: sendMail,
      next: next
    });

      next();
  });
}

function getRemoteData(optn) {
  remoteStorage.nodeConnect.setStorageInfo(optn.user.storageType, optn.user.storageHref);
  remoteStorage.nodeConnect.setBearerToken(optn.user.bearerToken);
  remoteStorage.claimAccess('root', 'r');
  remoteStorage.root.use('/');
  //TODO: fullSync needs to be faster
  remoteStorage.fullSync(function() {
  //TODO: fullSync should call callback first when everything is fetch
  setTimeout(function() {
    optn.data = _.reduce(remoteStorage.root.getListing('/'), function(data, modulePath) {
      data[modulePath.slice(0, -1)] = _.reduce(remoteStorage.root.getListing('/' + modulePath), function(module, listPath) {
        module[listPath.slice(0, -1)] = _.reduce(remoteStorage.root.getListing('/' + modulePath + listPath), function(list, document) {
          list[document] = remoteStorage.root.getObject('/' + modulePath + listPath + document);
          return list;
        }, []);
        return module;
      }, {});
      return data;
    }, {});
    remoteStorage.flushLocal();
    optn.cb(optn);
  }, 15000);
  });
}

function sendMail(optn) {
  //TODO: add directly unsubscribe link to mail
  transport.sendMail({
      from: "rs backup <remotestore.backup@gmail.com>",
      // to: "hey@jorin-vogel.com",
      to: optn.user.mail,
      subject: "hi",
      html: JSON.stringify(optn.data),
      // html: "hello world!",
      generateTextFromHTML: true
  }, function(error, response) {
    if (error) {
      console.log('jorins err: ', error);
    } else {
      console.log("Message sent: " + response.message);
    }
  });
}

function interate(arr, fn) {
  var i = 0, l = arr.length;
  function next() {
    if (i < l) {
      fn(arr[i++], next);
    }
  }
  next();
}


var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port ', port);