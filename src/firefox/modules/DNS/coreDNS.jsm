
var EXPORTED_SYMBOLS = ["DNSOutgoing", "DNSIncoming", "Response", "DNSConstants"];

const DNSConstants = {
    FLAGS_QUERY :0x0100,
    FLAGS_RESPONSE : 0x8000,

	MAX_MSG_TYPICAL : 1460
};

const DNSLabel = {
	Compressed : 0xC0,
    
    LABEL_MASK : 0xC0,
	LABEL_NOT_MASK : 0x3F
}

const DNSRecordClass = {
    CLASS_UNKNOWN : 0,//"?",
    CLASS_IN : 1,//"in",
    CLASS_CS : 2,//"cs",
    CLASS_CH : 3,//"ch",
    CLASS_HS : 4,//"hs",
    CLASS_NONE : 254,//"none",
    CLASS_ANY : 255,//"any",
    
    CLASS_MASK : 0x7FFF,
	CLASS_UNIQUE : 0x8000,
}

const DNSRecordType = {
	A:            1, // a host address                               [RFC1035]
	NS:           2, // an authoritative name server                 [RFC1035]
	MD:           3, // a mail destination (OBSOLETE - use MX)       [RFC1035]
	MF:           4, // a mail forwarder (OBSOLETE - use MX)         [RFC1035]
	CNAME:        5, // the canonical name for an alias              [RFC1035]
	SOA:          6, // marks the start of a zone of authority       [RFC1035]
	MB:           7, // a mailbox domain name (EXPERIMENTAL)         [RFC1035]
	MG:           8, // a mail group member (EXPERIMENTAL)           [RFC1035]
	MR:           9, // a mail rename domain name (EXPERIMENTAL)     [RFC1035]
	NULL:         10, // a null RR (EXPERIMENTAL)                    [RFC1035]
	WKS:          11, // a well known service description            [RFC1035]
	PTR:          12, // a domain name pointer                       [RFC1035]
	HINFO:        13, // host information                            [RFC1035]
	MINFO:        14, // mailbox or mail list information            [RFC1035]
	MX:           15, // mail exchange                               [RFC1035]
	TXT:          16, // text strings                                [RFC1035]
	RP:           17, // for Responsible Person                      [RFC1183]
	AFSDB:        18, // for AFS Data Base location                  [RFC1183][RFC5864]
	X25:          19, // for X.25 PSDN address                       [RFC1183]
	ISDN:         20, // for ISDN address                            [RFC1183]
	RT:           21, // for Route Through                           [RFC1183]
	NSAP:         22, // for NSAP address, NSAP style A record       [RFC1706]
	NSAP_PTR:     23, // for domain name pointer, NSAP style         [RFC1348][RFC1637][RFC1706]
	SIG:          24, // for security signature                      [RFC4034][RFC3755][RFC2535][RFC2536][RFC2537][RFC2931][RFC3110][RFC3008]
	KEY:          25, // for security key                            [RFC4034][RFC3755][RFC2535][RFC2536][RFC2537][RFC2539][RFC3008][RFC3110]
	PX :          26, // X.400 mail mapping information              [RFC2163]
	GPOS:         27, // Geographical Position                       [RFC1712]
	AAAA:         28, // IP6 Address                                 [RFC3596]
	LOC :         29, // Location Information                        [RFC1876]
	NXT:          30, // Next Domain (OBSOLETE)                      [RFC3755][RFC2535]
	EID :         31, // Endpoint Identifier                         [Patton][Patton1995]
	NIMLOC:       32, // Nimrod Locator                              [Patton][Patton1995]
	SRV :         33, // Server Selection                            [RFC2782]
	ATMA :        34, // ATM Address                                 [ATMDOC]
	NAPTR:        35, // Naming Authority Pointer                    [RFC2915][RFC2168][RFC3403]
	KX   :        36, // Key Exchanger                               [RFC2230]
	CERT:         37, // CERT                                        [RFC4398]
	A6   :        38, // A6 (OBSOLETE - use AAAA)                    [RFC3226][RFC2874][RFC6563]
	DNAME :       39, // DNAME                                       [RFC6672]
	SINK  :       40, // SINK                                        [Eastlake][Eastlake2002]
	OPT :         41, // OPT                                         [RFC2671][RFC3225]
	APL :         42, // APL                                         [RFC3123]
	DS  :         43, // Delegation Signer                           [RFC4034][RFC3658]
	SSHFP:        44, // SSH Key Fingerprint                         [RFC4255]
	IPSECKEY :    45, // IPSECKEY                                    [RFC4025]
	RRSIG   :     46, // RRSIG                                       [RFC4034][RFC3755]
	NSEC  :       47, // NSEC                                        [RFC4034][RFC3755]
	DNSKEY :      48, // DNSKEY                                      [RFC4034][RFC3755]
	DHCID :       49, // DHCID                                       [RFC4701]
	NSEC3  :      50, // NSEC3                                       [RFC5155]
	NSEC3PARAM :  51, // NSEC3PARAM                                  [RFC5155]
	TLSA  :       52, // TLSA                                        [Kumari]
	//Unassigned   53-54
	HIP  :        55, // Host Identity Protocol                      [RFC5205]
	NINFO :       56, // NINFO                                       [Reid]
	RKEY  :       57, // RKEY                                        [Reid]
	TALINK :      58, // Trust Anchor LINK                           [Wijngaards]
	CDS    :      59, // Child DS                                    [Barwood]
	//Unassigned   60-98
	SPF   :       99, //                                             [RFC4408]
	UINFO :       100, //                                            [IANA-Reserved]
	UID   :       101, //                                            [IANA-Reserved]
	GID   :       102, //                                            [IANA-Reserved]
	UNSPEC :      103, //                                            [IANA-Reserved]
	//Unassigned   104-248
	TKEY  :       249, // Transaction Key                            [RFC2930]
	TSIG  :       250, // Transaction Signature                      [RFC2845]
	IXFR  :       251, // incremental transfer                       [RFC1995]
	AXFR   :      252, // transfer of an entire zone                 [RFC1035][RFC5936]
	MAILB  :      253, // mailbox-related RRs (MB, MG or MR)         [RFC1035]
	MAILA  :      254, // mail agent RRs (OBSOLETE - see MX)         [RFC1035]
	ANY    :      255, // A request for all records                  [RFC1035]
	URI  :        256, // URI                                        [Faltstrom]
	CAA  :        257, // Certification Authority Authorization      [Hallam-Baker]
	//Unassigned   258-32767
	TA    :       32768, //   DNSSEC Trust Authorities               [Weiler]           2005-12-13
	DLV   :       32769, //   DNSSEC Lookaside Validation            [RFC4431]
	//Unassigned   32770-65279  
	//Private use  65280-65534
	//Reserved     65535 
}


function inherit(child, parent) {
    child.prototype.__proto__ = parent.prototype;
}

function getDNSLabel(index) {
	return (index & DNSLabel.LABEL_MASK);
}

function getDNSLabelValue(index) {
	return (index & DNSLabel.LABEL_NOT_MASK);
}

function newQuestion(_name, type, recordClass, unique) {

    switch (type) {
        case DNSRecordType.A:
            return new DNS4Address(_name, type, recordClass, unique);
        case DNSRecordType.A6:
        case DNSRecordType.AAAA:
            return new DNS6Address(_name, type, recordClass, unique);
        case DNSRecordType.HINFO:
            return new HostInformation(_name, type, recordClass, unique);
        case DNSRecordType.PTR:
            return new Pointer(_name, type, recordClass, unique);
        case DNSRecordType.SRV:
            return new Service(_name, type, recordClass, unique);
        case DNSRecordType.TXT:
            return new Text(_name, type, recordClass, unique);
        case DNSRecordType.NS:
        	return new NS(_name, type, recordClass, unique);
        case DNSRecordType.SOA:
        	return new SOA(_name, type, recordClass, unique);
        case DNSRecordType.CNAME:
			return new Cname(_name, type, recordClass, unique);
		case DNSRecordType.ANY:
        default:
            return new DNSEntry(_name, type, recordClass, unique);
    }
}

function getDNSRecordClass(val) {
	switch(val) {
		case DNSRecordClass.CLASS_IN:
			return "IN";
		case DNSRecordClass.CLASS_CS:
			return "CS";
		case DNSRecordClass.CLASS_CH:
			return "CH";
		case DNSRecordClass.CLASS_HS:
			return "HS";
		case DNSRecordClass.CLASS_NONE:
			return "NONE";
		case DNSRecordClass.CLASS_ANY:
			return "ANY";
		case DNSRecordClass.CLASS_UNKNOWN:
		default:
			return "?";
	}
}

function getDNSRecordType(val) {

	switch(val) {
		case DNSRecordType.A:
			return "A";
		case DNSRecordType.A6:
			return "A6";
		case DNSRecordType.AAAA:
			return "AAAA";
		case DNSRecordType.ANY:
			return "ANY";
		case DNSRecordType.HINFO:
			return "HINFO";
		case DNSRecordType.PTR:
			return "PTR";
		case DNSRecordType.TXT:
			return "TXT";
	  	case DNSRecordType.SRV:
			return "SRV";
		case DNSRecordType.NSEC:
			return "NSEC";
		case DNSRecordType.CNAME:
			return "CNAME";
		case DNSRecordType.NS:
			return "NS";
		case DNSRecordType.SOA:
			return "SOA";				
		default:
			return "?";
	}
}

function DNSMessage(flags, id, multicast) {
	this.id = id;
	this.multicast = multicast;
	this.flags = flags;
	this.questions = [];
    this.answers = [];
    this.authoritatives = [];
    this.additionals = [];
}

DNSMessage.prototype = {
	id : null,
	multicast : false,
	flags: null,
	questions : null,
    answers : null,
    authoritatives : null,
    additionals : null
}

function DNSEntry(name, type, recordClass, unique) {
	
    this.name = name;
    this.recordType = type;
    this.dnsClass = recordClass;
    this.unique = unique;
}

DNSEntry.prototype = {

	name : null,
	recordType : null,
	dnsClass : null,
	unique : null
}

function DNSRecord(name, type, recordClass, unique, ttl) {
	DNSEntry.call(this, name, type, recordClass, unique);
	this.ttl = ttl;
}

DNSRecord.prototype = {
	ttl : null,
};

inherit(DNSRecord, DNSEntry);


function Message(_size, _out) {
	this.arr = [];
	this.size = _size;
	this.out = _out;
}

Message.prototype = {
	size : null,
	arr : null,
	out : null,
	
	writeByte : function(value) {
		if(this.arr.length > this.size)
			return;
		var tmp = value & 0xFF;
		this.arr.push(tmp);
    },

    writeBytes : function(str, off, len) {
        for (var i = 0; i < len; i++) {
            this.writeByte(str.charCodeAt(off + i));
        }
    },

    writeBytesArray : function(data) {
        if (data != null) {
            this.writeBytes(data, 0, data.length);
        }
    },

    writeBytesArrayOffset : function(data, off, len) {
        for (var i = 0; i < len; i++) {
            this.writeBytesArray(data[off + i]);
        }
    },

    writeShort : function(value) {
        this.writeByte(value >> 8);
        this.writeByte(value);
    },

    writeInt : function(value) {
        this.writeShort(value >> 16);
        this.writeShort(value);
    },

    writeUTF : function(str, off, len) {
        var utflen = 0;
        for (var i = 0; i < len; i++) {
            var ch = str.charCodeAt(off + i); 
            if ((ch >= 0x0001) && (ch <= 0x007F)) {
                utflen += 1;
            } else {
                if (ch > 0x07FF) {
                    utflen += 3;
                } else {
                    utflen += 2;
                }
            }
        }
        
        this.writeByte(utflen);
        
        for (var i = 0; i < len; i++) {
            var ch = str.charCodeAt(off + i);
            if ((ch >= 0x0001) && (ch <= 0x007F)) {
                this.writeByte(ch);
            } else {
                if (ch > 0x07FF) {
                    this.writeByte(0xE0 | ((ch >> 12) & 0x0F));
                    this.writeByte(0x80 | ((ch >> 6) & 0x3F));
                    this.writeByte(0x80 | ((ch >> 0) & 0x3F));
                } else {
                    this.writeByte(0xC0 | ((ch >> 6) & 0x1F));
                    this.writeByte(0x80 | ((ch >> 0) & 0x3F));
                }
            }
        }
    },

    writeName : function(_name) {
        var aName = _name;
        while (true) {
            var n = aName.indexOf('.');
            if (n < 0) {
                n = aName.length;
            }
            if (n <= 0) {
                this.writeByte(0);
                return;
            }
            var label = aName.substring(0, n);
            this.writeUTF(label, 0, label.length);

            aName = aName.substring(n);
            if (aName[0] == ".") {
                aName = aName.substring(1);
            }
        }
    },
    
    writeNameSpecial : function(_name) {
        var aName = _name;
        while (true) {
            var n = aName.indexOf('.');
            if (n < 0) {
                n = aName.length;
            }
            if (n <= 0) {
                this.writeByte(0);
                return;
            }
            var label = aName.substring(0, n);
            this.writeUTF(label, 0, label.length);

            aName = aName.substring(n);
            if (aName[0] == ".") {
                aName = aName.substring(1);
            }
        }
    },

    writeQuestion : function(question) {
    	//alert(question.getName() + " :: " + question.getRecordType() + " :: " + question.getDNSClass());
        this.writeName(question.name);
        this.writeShort(question.recordType);
        this.writeShort(question.dnsClass);
    },
    
    writeAnswer : function(answer) {
    	var len = 0;
    	this.writeName(answer.name);
        this.writeShort(answer.recordType);
        this.writeShort((answer.unique ? answer.dnsClass | DNSRecordClass.CLASS_UNIQUE : answer.dnsClass));
        this.writeInt(answer.ttl);
        switch(answer.recordType){
        	case DNSRecordType.PTR:
        		len = answer.alias.length + 2;
        		this.writeShort(len);
        		this.writeNameSpecial(answer.alias);
        		break;
        	case DNSRecordType.A:
        		var addr = answer.address.split(".");
        		this.writeShort(4);
        		this.writeByte(addr[0]);
        		this.writeByte(addr[1]);
        		this.writeByte(addr[2]);
        		this.writeByte(addr[3]);
        		break;
			case DNSRecordType.A6:
				break;
			case DNSRecordType.AAAA:
				break;
			case DNSRecordType.ANY:
				break;
			case DNSRecordType.HINFO:
				var str = answer.cpu + " " + answer.os;
				len = str.length + 2;
        		this.writeShort(len);
        		this.writeNameSpecial(str);
				break;
			case DNSRecordType.TXT:
				len = answer.text.length + 2;
        		this.writeShort(len);
        		this.writeNameSpecial(answer.text);
        		break;
		  	case DNSRecordType.SRV:
		  		len = answer.target.length + 8;	// sizeof short is 2, so 2 * 3 and + 1 for target len
		  		this.writeShort(len);
        		this.writeShort(answer.priority);
        		this.writeShort(answer.weight);
        		this.writeShort(answer.port);
        		this.writeNameSpecial(answer.target);
        		break;
			case DNSRecordType.NSEC:
			default:
				break;
        }
    }
}

function DNSOutgoing(proto, flags, multicast, senderUDPPayload) {
	DNSMessage.call(this, flags, 0, multicast);
	
	this._proto = proto;	
    this._names = [];
    this._maxUDPPayload = (senderUDPPayload > 0 ? senderUDPPayload : DNSConstants.MAX_MSG_TYPICAL);
    this._questionsBytes = new Message(senderUDPPayload, this);
    this._answersBytes = new Message(senderUDPPayload, this);
    this._authoritativeAnswersBytes = new Message(senderUDPPayload, this);
    this._additionalsAnswersBytes = new Message(senderUDPPayload, this);
}

DNSOutgoing.prototype = {
	_proto: null,
	_names : null,
	_maxUDPPayload : null,
    _questionsBytes : null,
    _answersBytes : null,
    _authoritativeAnswersBytes : null,
    _additionalsAnswersBytes : null,
    
    createRequest : function(domain, type, recordClass, unique) {
    	this.addQuestion(newQuestion(domain, type, recordClass, unique));
    	return this;
    },
    
    createRecord: function (domain, type, recordClass, unique, ttl, value) {
    	var record = null;
    	switch (type) {
            case DNSRecordType.A:
                record = new DNS4Address(domain, type, recordClass, unique, ttl, value[0]);
                break;
            case DNSRecordType.AAAA:
                record = new DNS6Address(domain, type, recordClass, unique, ttl, value[0]);
                break;
            case DNSRecordType.PTR:
                record = new Pointer(domain, type, recordClass, unique, ttl, value[0]);
                break;
            case DNSRecordType.TXT:
            	var buf = [];
            	buf.push(value[0].length & 0xFF);
            	for(var i = 0; i < value[0].length; i++)
            		buf.push(value[0].charCodeAt(i) & 0xFF);
                record = new Text(domain, type, recordClass, unique, ttl, buf);
                break;
            case DNSRecordType.SRV:
                record = new Service(domain, type, recordClass, unique, ttl, value[0], value[1], value[2], value[3]);
                break;
            case DNSRecordType.HINFO:
                record = new HostInformation(domain, type, recordClass, unique, ttl, value[0], value[1]);
                break;
            default:
                break;
        }
        return record;
    },
    
    // value is an array
    createResponse : function(record, queueName) {
    	var queue = null;
        switch(queueName) {
        	case "Questions":
        		queue = this.questions;
        		break;
        	case "Answer":
        		queue = this.answers;
        		break;
        	case "Authority":
        		queue = this.authoritatives;
        		break;
        	case "Additional":
        		queue = this.additionals;
        		break;
        }
        if(record && queue)
	    	this.addAnswer(record, queue);
    	return this;
    },
    
    addQuestion : function(rec) {
        var record = new Message(512, this);
        record.writeQuestion(rec);
        this.questions.push(rec);
    },
    
    addAnswer : function(rec, queue) {
    	var record = new Message(512, this);
    	record.writeAnswer(rec);
        queue.push(rec);
    },
    
    getHexString : function() {
    	var q = 0;
        var msg = new Message(this._maxUDPPayload, this);
        if(this._proto == "tcp")
        	msg.writeShort(32);
        msg.writeShort(this.multicast ? 0 : this.id);
        msg.writeShort(this.flags);
        msg.writeShort(this.questions.length);
        msg.writeShort(this.answers.length);
        msg.writeShort(this.authoritatives.length);
        msg.writeShort(this.additionals.length);
        for (q = 0; q < this.questions.length; q++) {
        	msg.writeQuestion(this.questions[q]);
        }
        for (q = 0; q < this.answers.length; q++) {
        	msg.writeAnswer(this.answers[q]);
        }
        for (q = 0; q < this.authoritatives.length; q++) {
        	msg.writeAnswer(this.authoritatives[q]);
        }
        for (q = 0; q < this.additionals.length; q++) {
        	msg.writeAnswer(this.additionals[q]);
        }
        return msg.arr;
    }
}

inherit(DNSOutgoing, DNSMessage);


function Response(buf, proto, offset, len) {
	this.buffer = buf;
	this.proto = proto;
	this.offset = offset;
	this.len = len;
	this.idx = this.offset;
}

Response.prototype = {

	buffer : null,
	proto: null,
	len : null,
	offset : null,
	idx : null,
	old : null,
	ext : null,
	
	rewind : function(l) {
		this.idx = this.idx - l;
	},
	
	read : function() {
		if(this.idx == this.len) {
			//Log("** End of buffer reached **");
			return;
		}
		return (this.buffer[this.idx++] & 0xFF);
	},
	
	readBuf : function(bytes, off, l) {
		for (var i = 0; i < l; i++) {
            bytes[off + i] = this.read();
        }
        return bytes;
	},

	readByte : function() {
        return this.read();
    },

    readUnsignedShort : function() {
        return (this.read() << 8) | this.read();
    }, 

    readInt : function() {
        return (this.readUnsignedShort() << 16) | this.readUnsignedShort();
    },

    readBytes : function(len) {
        var bytes = new Array(len);
        this.readBuf(bytes, 0, len);
        return bytes;
    },

	readUTF : function(len) {
        var buffer = new String();
        for (var index = 0; index < len; index++) {
            var ch = this.read();
            switch (ch >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    // 0xxxxxxx
                    break;
                case 12:
                case 13:
                    // 110x xxxx 10xx xxxx
                    ch = ((ch & 0x1F) << 6) | (this.read() & 0x3F);
                    index++;
                    break;
                case 14:
                    // 1110 xxxx 10xx xxxx 10xx xxxx
                    ch = ((ch & 0x0f) << 12) | ((this.read() & 0x3F) << 6) | (this.read() & 0x3F);
                    index++;
                    index++;
                    break;
                default:
                    // 10xx xxxx, 1111 xxxx
                    ch = ((ch & 0x3F) << 4) | (this.read() & 0x0f);
                    index++;
                    break;
            }
            buffer += String.fromCharCode(ch);
        }
        return buffer;
    },
    
    readValueAtIndex : function(ix) {
    	var buffer = new String(), tmpBuf = "";
    	var id = ix;
    	var finished = false, flag = false;
        while (!finished) {
        	flag = false;
        	tmpBuf = "";
            var len = this.buffer[id] & 0xFF;
            //Log("1 len = " + len);
            if (len == 0) {
                finished = true;
                break;
            } else if (getDNSLabel(len) == DNSLabel.Compressed) {
            	id = this.buffer[id+1] & 0xFF;
            	//Log("compressed id = " + id);
            	flag = true;
            }
            tmpBuf = this.specialUTFRead(id);
           	buffer += tmpBuf + ".";
           	if(flag == true)
           		len = tmpBuf.length;
           	id += len + 1;
        }
    	return buffer;
    },
    
    specialUTFRead : function(ix) {
    	
    	var len = this.buffer[ix] & 0xFF;
    	//Log("2 len = " + len);
    	var next = ix;
    	var buffer = new String();
        for (var index = 0; index < len; index++) {
            var ch = this.buffer[++next] & 0xFF;
            switch (ch >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    // 0xxxxxxx
                    break;
                case 12:
                case 13:
                    // 110x xxxx 10xx xxxx
                    ch = ((ch & 0x1F) << 6) | (this.buffer[++next] & 0xFF & 0x3F);
                    index++;
                    break;
                case 14:
                    // 1110 xxxx 10xx xxxx 10xx xxxx
                    ch = ((ch & 0x0f) << 12) | ((this.buffer[++next] & 0xFF & 0x3F) << 6) | (this.buffer[++next] & 0xFF & 0x3F);
                    index++;
                    index++;
                    break;
                default:
                    // 10xx xxxx, 1111 xxxx
                    ch = ((ch & 0x3F) << 4) | (this.buffer[++next] & 0xFF & 0x0f);
                    index++;
                    break;
            }
            buffer += String.fromCharCode(ch);
        }
        //Log("returning " + buffer);
        return buffer;
    },
    
    readName : function() {
    	//var savingIndex = this.idx - 1;
        var buffer = new String();
        var finished = false;
        while (!finished) {
            var len = this.read();
            //Log("readName Length = " + len);
            if (len == 0) {
                finished = true;
                //Log("Saving [" + buffer + "] at " + savingIndex);
		        //this.setValueAtIndex([savingIndex, buffer]);
                break;
            }
            if(getDNSLabel(len) == DNSLabel.Compressed) {
                var index = (getDNSLabelValue(len) << 8) | this.read();
                //Log("compressed index = " + index);
                //savingIndex = this.idx - 1;
                //buffer += this.getValueAtIndex(index);
                buffer += this.readValueAtIndex(index);
                finished = true;
            } else {
            	buffer += this.readUTF(len) + ".";
            }
        }
        //Log("Saving [" + buffer + "] at " + savingIndex);
        //this.setValueAtIndex([savingIndex, buffer]);
        //Log("readName : buffer = " + buffer);
        return buffer;
    }
}

function DNSIncoming(flags, id, multicast, resp, parentDomain) {

	DNSMessage.call(this, flags, id, multicast);

	var i = 0, rec = null;
	
	this.response = resp;
	this.parent = parentDomain;
	
	var nQues = this.response.readUnsignedShort();
	var nAnsw = this.response.readUnsignedShort();
	var nAuth = this.response.readUnsignedShort();
	var nAddn = this.response.readUnsignedShort();
	
	//Log(nQues + " :: " + nAnsw + " :: " + nAuth + " :: " + nAddn);
	
    for (i = 0; i < nQues; i++) {
    	rec = this.readQuestion();
    	if(rec != null)
			this.questions.push(rec);
    }

    for (i = 0; i < nAnsw; i++) {
        rec = this.readAnswer("Answ");
        if (rec != null)
            this.answers.push(rec);
    }

    for (i = 0; i < nAuth; i++) {
        rec = this.readAnswer("Auth");
        if (rec != null)
            this.authoritatives.push(rec);
    }

    for (i = 0; i < nAddn; i++) {
        rec = this.readAnswer("Addn");
        if (rec != null)
            this.additionals.push(rec);
    }
    
    //alert(nQues + " :: " + nAnsw + " :: " + nAuth + " :: " + nAddn);
    
    return this;
}

DNSIncoming.prototype = {

	response : null,
	parent : null,
	
	readQuestion : function() {
		//Log("Question");
		var domain = this.response.readName();
        var type = this.response.readUnsignedShort();
        var recIdx = this.response.readUnsignedShort() & DNSRecordClass.CLASS_MASK;
        var recordClass = getDNSRecordClass(recIdx);
        var unique = (recIdx != DNSRecordClass.CLASS_UNKNOWN) && ((recIdx & DNSRecordClass.CLASS_UNIQUE) != 0);
        //Log("Ques :: " + domain + " :: " + type + " :: " + recordClass + " :: " + unique);
        return newQuestion(domain, type, recordClass, unique);
	},
	
	readAnswer : function(rT) {
		//Log("Answer Type = " + rT);
        var domain = this.response.readName();
        var type = this.response.readUnsignedShort();
        var tmp = this.response.readUnsignedShort();
        var recIdx = tmp & DNSRecordClass.CLASS_MASK;
        var cacheFlush = tmp & DNSRecordClass.CLASS_UNIQUE;
        var recordClass = getDNSRecordClass(recIdx);
        var unique = (recIdx != DNSRecordClass.CLASS_UNKNOWN) && ((recIdx & DNSRecordClass.CLASS_UNIQUE) != 0);
        var ttl = this.response.readInt();
        var len = this.response.readUnsignedShort();
        
        var record = null;
		//Log(rT + " :: " + domain + " :: " + type + " :: " + recordClass + " :: " + unique + " :: " + ttl + " :: " + len);
        
        switch (type) {
            case DNSRecordType.A:
                record = new DNS4Address(domain, type, recordClass, unique, ttl, this.response.readBytes(len));
                break;
            case DNSRecordType.AAAA:
                record = new DNS6Address(domain, type, recordClass, unique, ttl, this.response.readBytes(len));
                break;
            case DNSRecordType.PTR:
                var service = this.response.readName();
                if (service.length > 0) {
                    record = new Pointer(domain, type, recordClass, unique, ttl, service);
        		}
                //Log(rT + " :: PTR :: Domain = " + domain + " :: Service = " + service);
                break;
            case DNSRecordType.TXT:
                record = new Text(domain, type, recordClass, unique, ttl, this.response.readBytes(len));
                break;
            case DNSRecordType.SRV:
                var priority = this.response.readUnsignedShort();
                var weight = this.response.readUnsignedShort();
                var port = this.response.readUnsignedShort();
                var target = this.response.readName();
                //Log(rT + " :: SRV :: Domain = " + domain + " :: Target = " + target);
                record = new Service(domain, type, recordClass, unique, ttl, priority, weight, port, target);
                break;
            case DNSRecordType.HINFO:
                var buf = new String();
                buf += this.response.readUTF(len);
                var index = buf.indexOf(" ");
                var cpu = (index > 0 ? buf.substring(0, index) : buf.toString()).trim();
                var os = (index > 0 ? buf.substring(index + 1) : "").trim();
                record = new HostInformation(domain, type, recordClass, unique, ttl, cpu, os);
                //Log(rT + " :: HINFO :: Domain = " + domain + " :: buf = " + buf);
                break;
            case DNSRecordType.CNAME:
            	var cname = this.response.readName();
                record = new Cname(domain, type, recordClass, unique, ttl, cname);
                break;
            case DNSRecordType.NS:
            	var nsdname = this.response.readName();
                record = new NS(domain, type, recordClass, unique, ttl, nsdname);
                break;
            case DNSRecordType.SOA:
            	var mname = this.response.readName();
				var rname = this.response.readName();
				var serial = this.response.readInt();
				var refresh = this.response.readInt();
				var retry = this.response.readInt();
				var expire = this.response.readInt();
				var minimum = this.response.readInt();
                record = new SOA(domain, type, recordClass, unique, ttl, mname, rname, serial, refresh, retry, expire, minimum);
                break;
            default:
                this.response.readBytes(len);
                //Log("always here");
                break;
        }
        return record;
    }
}

inherit(DNSIncoming, DNSMessage);


function DNS4Address(name, type, recordClass, unique, ttl, addr) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	if(addr)
		this.address  = addr[0] + "." + addr[1] + "." + addr[2] + "." + addr[3];
}

DNS4Address.prototype = {
	address : null
}

inherit(DNS4Address, DNSRecord);

function DNS6Address(name, type, recordClass, unique, ttl, addr) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	if(!addr)
		return;
	
	var str = "", s = "";
	
	for(var i = 0; i < addr.length; i++) {
		var tmp = addr[i].toString(16);
		if(tmp == "0")
			str += "00";
		else if(tmp.length < 2)
			str += "0" + tmp;
		else str += tmp;
	}
	
	for(var j = 1; j <= str.length; j++){
		s += str[j-1];
		if(j > 0 && j < str.length && (j % 4 == 0))
			s += ":";
	}
	
	var t = s.split(":");
	str = new Array(8);
	
	for(i = 0; i < t.length; i++) {
		str[i] = t[i].replace(/^[0]+/g,"");
	}

	s = str[0] + ":" + str[1] + ":" + str[2] + ":" + str[3] + str[4] + ":" + str[5] + ":" + str[6] + ":" + str[7];
	
	this.address = s.replace(/::+/gi, "::");
}

DNS6Address.prototype = {
	address : null
}

inherit(DNS6Address, DNSRecord);

function HostInformation(name, type, recordClass, unique, ttl, cpu, os) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	this.cpu = cpu;
	this.os = os;
}

HostInformation.prototype = {
	cpu : null,
	os : null
}

inherit(HostInformation, DNSRecord);

function Pointer(name, type, recordClass, unique, ttl, alias) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	this.alias = alias;
}

Pointer.prototype = {
	alias : null
}

inherit(Pointer, DNSRecord);

function Service(name, type, recordClass, unique, ttl, priority, weight, port, target) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	this.priority = priority;
	this.weight = weight;
	this.port = port;
	this.target = target;
}

Service.prototype = {
	priority : null,
	weight : null,
	port : null,
	target : null
}

inherit(Service, DNSRecord);

function Text(name, type, recordClass, unique, ttl, text) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	if(!text)
		return;
		
	var str = "";
	var j = 0, finished = false;
	while (!finished) {
        var len = parseInt(text[j]) & 0xFF;
        if (len == 0) {
            finished = true;
            break;
        } else {
			var buffer = new String();
		    for (var index = 0; index < len; index++) {
		        var ch = text[++j] & 0xFF;
		        switch (ch >> 4) {
		            case 0:
		            case 1:
		            case 2:
		            case 3:
		            case 4:
		            case 5:
		            case 6:
		            case 7:
		                // 0xxxxxxx
		                break;
		            case 12:
		            case 13:
		                // 110x xxxx 10xx xxxx
		                ch = ((ch & 0x1F) << 6) | (text[++j] & 0xFF & 0x3F);
		                j++;
		                break;
		            case 14:
		                // 1110 xxxx 10xx xxxx 10xx xxxx
		                ch = ((ch & 0x0f) << 12) | ((text[++j] & 0xFF & 0x3F) << 6) | (text[++j] & 0xFF & 0x3F);
		                j++;
		                j++;
		                break;
		            default:
		                // 10xx xxxx, 1111 xxxx
		                ch = ((ch & 0x3F) << 4) | (text[++j] & 0xFF & 0x0f);
		                j++;
		                break;
		        }
		        buffer += String.fromCharCode(ch);
		    }
		    str += buffer + "<br>";
		    j++;
		}
    }
	this.text = str.substring(0, str.length - 4);
	//log(name + " :: " + text + " :: " + this.text + " :: len = " + (parseInt(text[0]) & 0xFF));
}

Text.prototype = {
	text : null
}

inherit(Text, DNSRecord);

function Cname(name, type, recordClass, unique, ttl, alias) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	this.cname = alias;
}

Cname.prototype = {
	cname : null
}

inherit(Cname, DNSRecord);

function NS(name, type, recordClass, unique, ttl, alias) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	this.nsdname = alias;
}

NS.prototype = {
	nsdname : null
}

inherit(NS, DNSRecord);


function SOA(name, type, recordClass, unique, ttl, mname, rname, serial, refresh, retry, expire, minimum) {
	DNSRecord.call(this, name, type, recordClass, unique, ttl);
	this.mname = mname;
	this.rname = rname;
	this.serial = serial;
	this.refresh = refresh;
	this.retry = retry;
	this.expire = expire;
	this.minimum = minimum;
}

SOA.prototype = {
	mname : null,
	rname : null,
	serial : null,
	refresh : null,
	retry : null,
	expire : null,
	minimum : null
}

inherit(SOA, DNSRecord);

