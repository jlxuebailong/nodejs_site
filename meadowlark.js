var express = require('express'),
	handlebars = require('express-handlebars').create(
		{
			defaultLayout:'main',
			extname: '.hbs',
			helpers:{
				section:function(name,options){
					if(!this._sections) this._sections={};
					this._sections[name]=options.fn(this);
					return null;
				}
			}
	}),
	app = express(),
    credentials = require('./credentials.js'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    vhost = require('vhost'),
	fortune = require('./lib/fortune.js'),
    Vacation = require('./models/vacation.js'),
    VacationInSeasonListener = require('./models/vacationInSeasonListener.js');

app.set('port', process.env.PORT || 3000);

// use domains for better error handling
app.use(function(req, res, next){
    // create a domain for this request
    var domain = require('domain').create();
    // handle errors on this domain
    domain.on('error', function(err){
        console.error('DOMAIN ERROR CAUGHT\n', err.stack);
        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function(){
                console.error('Failsafe shutdown.');
                process.exit(1);
            }, 5000);

            // disconnect from the cluster
            var worker = require('cluster').worker;
            if(worker) worker.disconnect();

            // stop taking new requests
            server.close();

            try {
                // attempt to use Express error route
                next(err);
            } catch(error){
                // if Express error route failed, try
                // plain Node response
                console.error('Express error mechanism failed.\n', error.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error.');
            }
        } catch(error){
            console.error('Unable to send 500 response.\n', error.stack);
        }
    });

    // add the request and response objects to the domain
    domain.add(req);
    domain.add(res);

    // execute the rest of the request chain in the domain
    domain.run(next);
});

// logging
switch(app.get('env')){
    case 'development':
        // compact, colorful dev logging
        app.use(require('morgan')('dev'));
        break;
    case 'production':
        // module 'express-logger' supports daily log rotation
        app.use(require('express-logger')({ path: __dirname + '/log/requests.log'}));
        break;
}

//handlebars setting
app.engine('.hbs', handlebars.engine);
app.set('view engine', '.hbs');
app.use(require('body-parser')());
//app.use(require('body-parser').urlencoded({extended: true}));
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')());

// database configuration
var mongoose = require('mongoose');
var options = {
    server: {
        socketOptions: { keepAlive: 1 }
    }
};
switch(app.get('env')){
    case 'development':
        mongoose.connect(credentials.mongo.development.connectionString, options);
        break;
    case 'production':
        mongoose.connect(credentials.mongo.production.connectionString, options);
        break;
    default:
        throw new Error('Unknown execution environment: ' + app.get('env'));
}


// initialize vacations
Vacation.find(function(err, vacations){
    if(vacations.length) return;

    new Vacation({
        name: 'Hood River Day Trip',
        slug: 'hood-river-day-trip',
        category: 'Day Trip',
        sku: 'HR199',
        description: 'Spend a day sailing on the Columbia and ' +
        'enjoying craft beers in Hood River!',
        priceInCents: 9995,
        tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
        inSeason: true,
        maximumGuests: 16,
        available: true,
        packagesSold: 0,
    }).save();

    new Vacation({
        name: 'Oregon Coast Getaway',
        slug: 'oregon-coast-getaway',
        category: 'Weekend Getaway',
        sku: 'OC39',
        description: 'Enjoy the ocean air and quaint coastal towns!',
        priceInCents: 269995,
        tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
        inSeason: false,
        maximumGuests: 8,
        available: true,
        packagesSold: 0,
    }).save();

    new Vacation({
        name: 'Rock Climbing in Bend',
        slug: 'rock-climbing-in-bend',
        category: 'Adventure',
        sku: 'B99',
        description: 'Experience the thrill of rock climbing in the high desert.',
        priceInCents: 289995,
        tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing', 'hiking', 'skiing'],
        inSeason: true,
        requiresWaiver: true,
        maximumGuests: 4,
        available: false,
        packagesSold: 0,
        notes: 'The tour guide is currently recovering from a skiing accident.',
    }).save();
});


//test
app.use(function(req,res,next){
	res.locals.showTests = app.get('env')!='production' && req.query.test==='1';
	next();
});

//static
app.use(express.static(__dirname + '/public'));

// flash message middleware
app.use(function(req, res, next){
    // if there's a flash message, transfer
    // it to the context, then clear it
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    next();
});

//partials
function getWeatherData(){
	return {
		locations:[
			{
				name:'Portland',
				forecastUrl:'http://www.wunderground.com/US/OR/Portland.html',
				iconUrl:'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
				weather:'Overcast',
				temp:'54.1 F (12.3 C)'
			},
			{
				name:'Bend',
				forecastUrl:'http://www.wunderground.com/US/OR/Bend.html',
				iconUrl:'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
				weather:'Partly Cloudy',
				temp:'55.0 F (12.8 C)'
			},
			{
				name:'Manzanita',
				forecastUrl:'http://www.wunderground.com/US/OR/Manzanita.html',
				iconUrl:'http://icons-ak.wxug.com/i/c/k/rain.gif',
				weather:'Light Rain',
				temp:'55.0 F (12.8 C)'
			}
		]
	};
}


app.use(function(req,res,next){
	if(!res.locals.partials) res.locals.partials={};
	res.locals.partials.weathers=getWeatherData();
	next();
});

//route
app.get('/',function(req,res){
	//res.type('text/plain');
	//res.send('Meadowlark Travel');
	res.render('home');
});

app.get('/about',function(req,res){
	//res.type('text/plain');
	//res.send('About Meadowlark Travel');

	res.render('about',{
		fortune:fortune.getFortune(),
		pageTestScript:'/qa/tests-about.js'
	});


});

app.get('/contact',function(req,res){
	//res.type('text/plain');
	//res.send('About Meadowlark Travel');

	res.render('contact',{
		layout:'layout_index'
	});
});

//section test
app.get('/jquerytest',function(req,res){
	//res.type('text/plain');
	//res.send('About Meadowlark Travel');

	res.render('jquerytest');
});

app.get('/nursery-rhyme',function(req,res){
	res.render('nursery-rhyme');
});
app.get('/data/nursery-rhyme',function(req,res){
	res.json({
		animal:'squirrel',
		bodyPart:'tail',
		adjective:'bushy',
		noun:'heck'
	});
});

app.get('/newsletter',function(req,res){
    res.cookie('monster','nnom nom');
    res.cookie('signed_monster','nnom nom',{signed:true});
    
    req.session.userName='Anonymous';
    var colorScheme = req.session.colorScheme||'dark';
    
    res.render('newsletter',{csrf:'CSRF token goes here',colorScheme:colorScheme});
});
/*app.post('/process',function(req,res){
    console.log('Form(from querystring):'+req.query.form);
    console.log('CSRF token(from hidden form field):'+req.body._csrf);
    console.log('Name(from visible from field):'+req.body.name);
    console.log('Email(from visible from field):'+req.body.email);
    res.redirect(303,'/thank-you');
});*/

app.post('/process',function(req,res){
   if(req.xhr || req.accepts('json,html')==='json'){
       res.json({success:true});
   }else{
       res.redirect(303,'/thank-you');
   }
    console.log(req.cookies.monster);
    console.log(req.signedCookies.signed_monster);

    req.session.userName = null;
    delete req.session.colorScheme;
});

// for now, we're mocking NewsletterSignup:
function NewsletterSignup(){
}
NewsletterSignup.prototype.save = function(cb){
    cb();
};

var VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

app.post('/newsletter', function(req, res,next){
    var name = req.body.name || '', email = req.body.email || '';
    // input validation
    if(!email.match(VALID_EMAIL_REGEX)) {
        if(req.xhr) return res.json({ error: 'Invalid name email address.' });
        req.session.flash = {
            type: 'danger',
            intro: 'Validation error!',
            message: 'The email address you entered was  not valid.',
        };
        return res.redirect(303, '/newsletter/archive');
    }
    new NewsletterSignup({ name: name, email: email }).save(function(err){
        if(err) {
            if(req.xhr) return res.json({ error: 'Database error.' });
            req.session.flash = {
                type: 'danger',
                intro: 'Database error!',
                message: 'There was a database error; please try again later.',
            };
            return res.redirect(303, '/newsletter/archive');
        }
        if(req.xhr) return res.json({ success: true });
        req.session.flash = {
            type: 'success',
            intro: 'Thank you!',
            message: 'You have now been signed up for the newsletter.',
        };
        return res.redirect(303, '/newsletter/archive');
    });
});
app.get('/newsletter/archive', function(req, res){
    res.render('newsletter/archive');
});

app.get('/thank-you',function(req,res){
    res.render('thank-you');
});

app.get('/fail',function(req,res){
    throw new Error('Nope!');
});
app.get('/epic-fail',function(req,res){
    process.nextTick(function () {
        throw new Error('Kaboom!');
    });

});


app.get('/vacation/:vacation', function(req, res, next){
    Vacation.findOne({ slug: req.params.vacation }, function(err, vacation){
        if(err) return next(err);
        if(!vacation) return next();
        res.render('vacation', { vacation: vacation });
    });
});

function convertFromUSD(value, currency){
    switch(currency){
        case 'USD': return value * 1;
        case 'GBP': return value * 0.6;
        case 'BTC': return value * 0.0023707918444761;
        default: return NaN;
    }
}

app.get('/vacations', function(req, res){
    Vacation.find({ available: true }, function(err, vacations){
        var currency = req.session.currency || 'USD';
        var context = {
            currency: currency,
            vacations: vacations.map(function(vacation){
                return {
                    sku: vacation.sku,
                    name: vacation.name,
                    description: vacation.description,
                    inSeason: vacation.inSeason,
                    price: convertFromUSD(vacation.priceInCents/100, currency),
                    qty: vacation.qty,
                };
            })
        };
        switch(currency){
            case 'USD': context.currencyUSD = 'selected'; break;
            case 'GBP': context.currencyGBP = 'selected'; break;
            case 'BTC': context.currencyBTC = 'selected'; break;
        }
        res.render('vacations', context);
    });
});

app.post('/vacations', function(req, res){
    Vacation.findOne({ sku: req.body.purchaseSku }, function(err, vacation){
        if(err || !vacation) {
            req.session.flash = {
                type: 'warning',
                intro: 'Ooops!',
                message: 'Something went wrong with your reservation; ' +
                'please <a href="/contact">contact us</a>.',
            };
            return res.redirect(303, '/vacations');
        }
        vacation.packagesSold++;
        vacation.save();
        req.session.flash = {
            type: 'success',
            intro: 'Thank you!',
            message: 'Your vacation has been booked.',
        };
        res.redirect(303, '/vacations');
    });
});


app.get('/notify-me-when-in-season', function(req, res){
    res.render('notify-me-when-in-season', { sku: req.query.sku });
});

app.post('/notify-me-when-in-season', function(req, res){
    VacationInSeasonListener.update(
        { email: req.body.email },
        { $push: { skus: req.body.sku } },
        { upsert: true },
        function(err){
            if(err) {
                console.error(err.stack);
                req.session.flash = {
                    type: 'danger',
                    intro: 'Ooops!',
                    message: 'There was an error processing your request.',
                };
                return res.redirect(303, '/vacations');
            }
            req.session.flash = {
                type: 'success',
                intro: 'Thank you!',
                message: 'You will be notified when this vacation is in season.',
            };
            return res.redirect(303, '/vacations');
        }
    );
});

app.get('/set-currency/:currency', function(req,res){
    req.session.currency = req.params.currency;
    return res.redirect(303, '/vacations');
});

//404
app.use(function(req, res){
	//res.type('text/plain');
	res.status(404);
	//res.send('404 - Not Found');
	res.render('404');
});

//500
app.use(function(err, req, res, next){
	console.error(err.stack);
	//res.type('text/plain');
	res.status(500);
	//res.send('500 - Server Error');
	res.render('500');
});


var server;

function startServer() {
    /*server = http.createServer(app).listen(app.get('port'), function(){
        console.log( 'Express started in ' + app.get('env') +
            ' mode on http://localhost:' + app.get('port') +
            '; press Ctrl-C to terminate.' );
    });*/

    var keyFile = __dirname + '/ssl/meadowlark.pem',
        certFile = __dirname + '/ssl/meadowlark.crt';
    if(!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
        console.error('\n\nERROR: One or both of the SSL cert or key are missing:\n' +
            '\t' + keyFile + '\n' +
            '\t' + certFile + '\n' +
            'You can generate these files using openssl; please refer to the book for instructions.\n');
        process.exit(1);
    }
    var options = {
        key: fs.readFileSync(__dirname + '/ssl/meadowlark.pem'),
        cert: fs.readFileSync(__dirname + '/ssl/meadowlark.crt'),
    };
    server = https.createServer(options, app).listen(app.get('port'), function(){
        console.log( 'Express started in ' + app.get('env') +
            ' mode on port ' + app.get('port') + ' using HTTPS' +
            '; press Ctrl-C to terminate.' );
    });
}

if(require.main === module){
    // application run directly; start app server
    startServer();
} else {
    // application imported as a module via "require": export function to create server
    module.exports = startServer;
}
