(function (/*testUrl*/) {
	var num = 4;
	var loadTest = function(item) { 
		return eval("_text_" + item); 
	};
	
	/*url = testUrl;*/
	DNSServer = DNSserver;

	/* load the tests */
	var reset = loadTest("reset_js");
	var entity = loadTest("entity_js");
	var local_proxy = loadTest("local_proxy_js");
	var https = loadTest("https_js");
	var connect_proxy = loadTest("connect_proxy_js");
	var another_site_via_proxy = loadTest("another_site_via_proxy_js");

	/* create the test tree */
	var tree = new Tree();

	var t0 = tree.addRoot(new reset());
	var t1 = tree.addChild(t0, new entity());
	var t2 = tree.addChild(t1, new local_proxy());
	var t3 = tree.addChild(t1, new https());
	var t4 = tree.addChild(t2, new connect_proxy());
	var t5 = tree.addChild(t4, new another_site_via_proxy());

	/* add the visualization */
	var html = visualize(num, "HTTP Tests", tree.toJSON());
	$("#result").append(html);
	
	/* execute the tests */
	tree.traverse(null, num);

	/* delete tree to prevent memory leaks */
	delete tree;
})(/*"http://www.bbc.com/qwerty"*/);
