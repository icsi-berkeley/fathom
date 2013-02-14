/* -*- mode: javascript; js-indent-level: 2; js-expr-indent-offset: 2; -*-
 * ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (c) 2011-2012 International Computer Science Institute (ICSI).
 * All rights reserved.
 *
 * See LICENSE for license and terms of usage. 
 *
 * ***** END LICENSE BLOCK *****
 */

/* test states */
const NOT_STARTED = 0;
const BEGIN = 1;
const INCOMPLETE = 2;
const ERROR = 3;
const FINISHED = 4;

var Base = function () {
};

Base.extend = function(object) {
	return Base.prototype.extend.call(new Base(), object);
}

Base.prototype = {
	
	/* some basic properties of each test */
	id: null,
	shortDesc: null,				/* short description of the test */
	longDesc: null,					/* long description of the test */
	input: null,					/* array */
	output: null,					/* object */
	test: null,						/* function */
	execChildren: false,			/* boolean: execute children irrespective of the result of the parent test */
	
	shortcut: null,					/* shortcut function */
	shortcutExecuted: false,		/* boolean */
	shortcutResult: false,			/* boolean */
	
	cbFunction: null,				/* function */
	cbExecuted: false,				/* boolean */
	cbTimeout: 10000,
	
	status: false,					/* boolean: test succeeded/failed */
	msg: "",
	successMsg: "",					/* string: log message */
	failureMsg: "",					/* string: log message */
	
	beginTime: null,				/* timestamp */
	endTime: null,					/* timestamp */
	timeout: null,					/* time out period */
	
	progress: NOT_STARTED,			/* progress of the test */
		
	/* some utility functions */
	run: function() {
		/* set the begin time and progress */
		this.progress = BEGIN;
		this.beginTime = (new Date()).getTime();

		/* set output, progress, timeout and msg within the test */
		this.status = this.test.apply(this, this.input);
		if(!this.status)
			this.progress = ERROR;
		else
			this.progress = INCOMPLETE;
		
		/* set the end time */
		this.endTime = (new Date()).getTime();		
			
		return this.status;
	},
	
	checkProgress: function() {
		if(this.cbExecuted) {
			this.progress = FINISHED;
			return true;
		}
		this.progress = INCOMPLETE;		
		var currTime = (new Date()).getTime();
		if((currTime - this.beginTime) <= this.timeout)
			return true;
		return false;
	},
	
	/* extend the base class */
	extend: function(instance) {
		for(var key in instance) {
			this[key] = instance[key];
		}
		return this;
	}
};
