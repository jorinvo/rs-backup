var express = require('express');
var app = express();

app.configure(function() {
  app.set('views', '');
  app.set('view options', {
    layout: false
  });
  app.engine('html', require('ejs').renderFile);
  // app.use(express.bodyParser());
  // app.use(express.methodOverride());
  // app.use(app.router);
  app.use(express.static(__dirname));
  app.use(express.logger());
  app.use(express.compress());
});

app.get('/', function(req, res){
  res.render('index.html');
});

var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port 3000');