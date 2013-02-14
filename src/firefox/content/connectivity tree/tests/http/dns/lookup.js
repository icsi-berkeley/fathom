var object = {
	DEST_PORT: 53,
	domain: null,
	protocol: null,
	callback: null,
	dns: null,
	output: null
}

function update(res, domain) {

	object.output = [];
	var resp = JSON.parse(res);
	if(!resp || !resp.questions || resp.questions.length == 0 || !resp.questions[0].name)
		return;
	var dom = resp.questions[0].name;
	if((domain + ".") != dom)
		return;

	for(var i = 0; i < resp.answers.length; i++)
		if(resp.answers[i] && resp.answers[i].address)
			object.output.push(resp.answers[i].address);
	
	object.callback(object.output[0]);
}


function recordSend(result) {
	if (result && result['error']) {
		//log('Send failed: ' + result['error']);
	} else {
		//log('Send succeeded');
	}
}

function recordReceive(result) {
	if (result && result['error']) {
		//log('Receive failed: ' + result['error']);
	} else {
		if(object.protocol == "udp")
			var data = result.data;
		else
			var data = result;
		//log('Received: ' + data);
		fathom.proto.dns.response(dns, data, object.domain, update);
	}
}

/*----------------------------------------------------------------------------*/

function lookup(name, srv, proto, callback) {
	object.domain = name;
	object.protocol = proto;
	object.callback = callback;
	dns = fathom.proto.dns.create(proto);
	var data = fathom.proto.dns.query(dns, object.domain, 1, 1, 0x0100);
	fathom.proto.dns.sendRecv(dns, srv, object.DEST_PORT, data, recordSend, recordReceive);
}
