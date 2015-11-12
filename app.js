var express  = require('express');                                   
var morgan = require('morgan');     
var bodyParser = require('body-parser'); 
var cookieParser = require('cookie-parser')
var routes = require('./server/routes/index');
var app = express();    

app.use(express.static(__dirname + '/public'));                 
app.use(morgan('dev'));                                         
app.use(bodyParser.urlencoded({'extended':'true'}));            
app.use(bodyParser.json());                                     
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
app.use(cookieParser());
app.listen(8080);
console.log('server listen');
app.use('/', routes);

module.exports=app;