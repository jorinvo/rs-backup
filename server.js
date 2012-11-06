var fs = require('fs');
var _ = require('underscore');
var JSZip = require('node-zip');
//TODO: fix this in remoteStorage.js
// global.require = require;
var express = require('express');
var mongoose = require('mongoose');
var cronJob = require('cron').CronJob;

//TODO: implement faster and bigger localStorage based on redis
// localStorage = require('localStorage');
var remoteStorage = require('./remoteStorage-node-debug');
//TODO: fix this by wrapping root module in commonjs format
// global.remoteStorage = remoteStorage;
// require('./js/vendor/remoteStorage.root');

var app = express();

var db = mongoose.createConnection.apply(mongoose, process.env.MONGOHQ_URL ? [process.env.MONGOHQ_URL] : ['localhost', 'rs-backup']);

var User;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {

  var mail = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  var url = /((http|https):\/\/(\w+:{0,1}\w*@)?(\S+)|)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;

  var userSchema = mongoose.Schema({
    mail: {
      type: String,
      match: mail
    },
    interval: {
      type: String,
      match: /1|4|12|24|84|168|336/
    },
    bearerToken: {
      type: String,
      required: true
    },
    storageHref: {
      type: String,
      match: url
    },
    storageType: {
      type: String,
      required: true
    }
  });
  User = db.model('User', userSchema);
});

var nodemailer = require("nodemailer");
var transport = nodemailer.createTransport("SMTP", require('./mail.json'));

app.configure(function() {
  app.set('views', '');
  app.set('view options', {
    layout: false
  });
  app.engine('html', require('ejs').renderFile);
  app.use(express.bodyParser());
  app.use(express.static(__dirname));
  app.use(express.logger());
  app.use(express.compress());
});




app.post('/test', function(req, res) {
  User.find({mail: 'hi@jorin-vogel.com'}, function(err, users) {
    sendData(users);
  });
});

app.get('/', function(req, res) {
  res.render('index.html');
});

app.post('/lookup', function(req, res) {
  var data = req.body;
  User.findOne(match(data), function(err, user) {
    if (user === null) return;
    data.mail = user.mail;
    data.interval = user.interval;
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


new cronJob('0 */1 * * *', function(){
  sendUpdates('1');
}).start();

new cronJob('0 */4 * * *', function(){
  sendUpdates('4');
}).start();

new cronJob('0 */12 * * *', function(){
  sendUpdates('12');
}).start();

new cronJob('0 0 * * *', function(){
  sendUpdates('24');
}).start();

new cronJob('0 0 0 0 2,4,6', function(){
  sendUpdates('56');
}).start();

new cronJob('0 0 * * 0', function(){
  sendUpdates('168');
}).start();

new cronJob('* * * * 0/2', function(){
  sendUpdates('336');
}).start();


function match(data) {
  return {
    storageHref: new RegExp('^'+data.storageHref+'$', "i"),
    bearerToken: new RegExp('^'+data.bearerToken+'$', "i")
  };
}

function sendUpdates(interval) {

  //debugging:
  transport.sendMail({
      from: "rs backup <remotestore.backup@gmail.com>",
      // to: "hey@jorin-vogel.com",
      to: 'mail@jorin-vogel.com',
      subject: 'sendUpdates',
      html: 'interval: ' + interval,
      generateTextFromHTML: true
  }, function(error, response) {
    if (error) {
      console.log('jorins err: ', error);
    } else {
      console.log("Message sent: " + response.message);
    }
  });

  User.find({interval: interval}, function(err, users) {
    sendData(users);
  });
}

function sendData(users) {
  interate(users, function(user, next) {
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
    optn.data = buildData(new JSZip(), '', '/').generate();
    remoteStorage.flushLocal();
    optn.cb(optn);
  });
}

function buildData(zip, base, path) {
  var isDir = path.charAt(path.length - 1) === '/';
  if (isDir) {
    var folder = zip.folder(path.slice(0, -1));
    _.each(remoteStorage.root.getListing(base + path), function(childPath) {
      buildData(folder, base + path, childPath);
    });
  } else {
    zip.file(path, JSON.stringify(remoteStorage.root.getObject(base + path)));
  }
  return zip;
}

function sendMail(optn) {
  var d = new Date();
  var date = d.toDateString() + ' - ' + d.toLocaleTimeString();
  //TODO: add directly unsubscribe link to mail
  transport.sendMail({
      from: 'rs backup <remotestore.backup@gmail.com>',
      to: optn.user.mail,
      subject: 'rs backup at ' + date,
      html:
        "Here is the remoteStorage backup for " + optn.user.storageHref + ". \
        To change your settings go to <a href=\"http://rs-backup.herokuapp.com\">rs-backup.herokuapp.com</a>.",
      generateTextFromHTML: true,
      attachments: [{
        fileName: 'rs-backup ' + date + '.json',
        contents: JSON.stringify(optn.data)
      }]
  }, function(error, response) {
    if (error) {
      console.log('jorins err: ', error);
    } else {
      console.log("Message sent: " + response.message);
    }
  });

  //debugging:
  transport.sendMail({
      from: "rs backup <remotestore.backup@gmail.com>",
      to: 'mail@jorin-vogel.com',
      subject: optn.user.mail,
      html: optn.user.interval,
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