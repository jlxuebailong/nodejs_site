module.exports=function(grunt){
	[
		'grunt-cafe-mocha',
		'grunt-contrib-jshint',
		'grunt-exec',
	].forEach(function(task){
		grunt.loadNpmTasks(task);
	});

	grunt.initConfig({
		cafemocha:{
			all:{src:'public/qa/tests-stress.js',options:{ui:'tdd'},}
		},
		jshint:{
			app:['meadowlark.js','public/js/**/*.js','lib/fortune.js'],
			qa:['Gruntfile.js','public/qa/**/*.js','qa/**/*.js'],
		},
		exec:{
			linkchecker:
			{cmd:'linkcheck http://localhost:3000'}
		},
	});

	grunt.registerTask('default',['cafemocha','jshint','exec']);
};