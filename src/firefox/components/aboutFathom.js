const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutFathom() {
}

AboutFathom.prototype = {
	classDescription: "about:fathom",
	contractID: "@mozilla.org/network/protocol/about;1?what=fathom",
	classID: Components.ID("{e3cec815-a8ae-4826-9963-c7516e988de9}"),
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

	getURIFlags: function(aURI) {
		return Ci.nsIAboutModule.ALLOW_SCRIPT;
	},

	newChannel: function(aURI) {
		let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		let channel = ios.newChannel("chrome://fathom/content/aboutFathom.html", null, null);
		channel.originalURI = aURI;
		return channel;
	}
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutFathom]);
