function Uri(url) {
    var localFlag = false;
    var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    if (!regexp.test(url)) {
        // if url is does not match the regexp, then check if it is a local file
        var local = /([\w.\/])(\w+|(\w+.\w+))/;
        if (!local.test(url)) {
            alert("return uri as null");
            return;
        }
        localFlag = true;
    }

    if (!localFlag) {
        var src = url.split(/\/+/);
        this.scheme = src[0].split(/:/)[0];
        var domainInfo = src[1].split(/:(\d+)/);
        this.host = domainInfo[0];
        this.port = domainInfo[1];
        this.localPath = "";
        if (src.length > 2) {
            for (var i = 2; i < src.length; i++)
                this.localPath += "/" + src[i];
        } else {
            this.localPath += "/";
        }
    } else if (url.match("about:blank")) {
        this.scheme = null;
        this.host = null;
        this.port = null;   // some random port??
        this.localPath = null;
    } else {
        this.scheme = "file";
        var i = url.lastIndexOf("/");
        this.host = url.substr(0, i);
        this.localPath = url.substr(i + 1, url.length - i - 1);
        this.port = -1;
    }
    if (!this.port)
        this.port = 80; // for now just default to port 80
}

Uri.prototype = {
    host: null,
    port: null,
    scheme: null,
    localPath: null
};
