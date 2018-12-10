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
	fortune = require('./lib/fortune.js');

app.set('port', process.env.PORT || 3000);

//handlebars setting
app.engine('.hbs', handlebars.engine);
app.set('view engine', '.hbs');
app.use(require('body-parser')());
//app.use(require('body-parser').urlencoded({extended: true}));
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')());
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
};


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

app.post('/newsletter', function(req, res){
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

app.listen(app.get('port'),function(){
	console.log('Express stated on http://localhost:'+app.get('port')+'; press Ctrl+C to terminate.');
});
