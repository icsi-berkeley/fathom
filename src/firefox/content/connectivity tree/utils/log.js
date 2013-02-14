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
 
var mLog = function () {
}

mLog.prototype = {
	/* consts */
	ALL: 0,
	NONE: 1,

	log: function(level, test, val) {
		if(level != this.NONE)
			test.msg += "<br></br>" + val;
	},
	
	print: function(test, val) {
		var div = document.getElementById("result");
		if(val)
			div.innerHTML = val;
		else	
			div.innerHTML = test.msg;
	},
	
	text: function(test, val) {
		var retval = test.msg;
		if(val)
			retval = val;
		test.msg = "";
		return retval.trim();
	}
}
