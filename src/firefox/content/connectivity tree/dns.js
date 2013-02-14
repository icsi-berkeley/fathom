(function (/*testDomain, dnsserver*/) {
	var num = 3;
	var loadTest = function(item) { 
		return eval("_text_" + item); 
	};
	
	/*domainName = testDomain;
	DNSserver = dnsserver;*/

	/* load the tests */
	var nameserver = loadTest("nameserver_js");
	var lookup_host = loadTest("lookup_host_js");
	var lookup_host_cd = loadTest("lookup_host_cd_js");
	var lookup_public = loadTest("lookup_public_js");
	var lookup_standard = loadTest("lookup_standard_js");

	/* create the test tree */
	var tree = new Tree();

	var t0 = tree.addRoot(new nameserver());
	var t1 = tree.addChild(t0, new lookup_host());
	var t2 = tree.addChild(t1, new lookup_host_cd());
	var t3 = tree.addChild(t2, new lookup_public());
	var t4 = tree.addChild(t3, new lookup_standard());

	/* add the visualization */
	var html = visualize(num, "DNS Analysis", tree.toJSON());
	$("#result").append(html);
	
	/* execute the tests */
	tree.traverse(null, num);

	/* delete tree to prevent memory leaks */
	delete tree;
})(/*"www.dnssec-failed.org", "149.20.64.20"*/);
