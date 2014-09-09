var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');

// Database
var mySql = require('mssql'); 
var config = {
    user: 'AppSimOfficeUser',
    password: '0(2v2k7L',
    server: 'dev-db.simchart.ptgels.com', 
    database: 'SimOfficeProd',
    options: {
        appName : 'DemoSimulation' // Use this if you're on Windows Azure
    }   
}
mySql.connect(config, function(err) {
    var request = new mySql.Request();
    request.query('select Count(1) from asd as number', function(err, recordset) {
        if(err){
                var requestLog = new mySql.Request();
                requestLog.input('AppName',  mySql.NVarChar, config.options.appName);
                requestLog.input('Message',  mySql.NVarChar, err.message +recordset);
                requestLog.execute('procedure_name', function(err, recordsets, returnValue) {
                    //Do Nothing
                    console.dir(recordset);
                });
            }
       console.dir(recordset);
    });
});



var routes = require('./routes/index');

var app = express();
app.set('port', process.env.PORT || 3000);


app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(express.static(path.join(__dirname, 'public')));

// Make our db accessible to our router
app.use(function(req,res,next){
    req.db = mySql;
    next();
});

app.use('/', routes);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});