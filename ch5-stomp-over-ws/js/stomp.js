// Generated by CoffeeScript 1.3.3

/*
Copyright (C) 2010 Jeff Mesnil -- http://jmesnil.net/
Copyright (C) 2012 FuseSource, Inc. -- http://fusesource.com
*/


(function() {
  var Client, Stomp,
    __hasProp = {}.hasOwnProperty;

  Stomp = {
    frame: function(command, headers, body) {
      if (headers == null) {
        headers = [];
      }
      if (body == null) {
        body = '';
      }
      return {
        command: command,
        headers: headers,
        body: body,
        id: headers.id,
        receipt: headers.receipt,
        transaction: headers.transaction,
        destination: headers.destination,
        subscription: headers.subscription,
        error: null,
        toString: function() {
          var lines, name, value;
          lines = [command];
          for (name in headers) {
            if (!__hasProp.call(headers, name)) continue;
            value = headers[name];
            lines.push("" + name + ":" + value);
          }
          lines.push('\n' + body);
          return lines.join('\n');
        }
      };
    },
    unmarshal: function(data) {
      var body, chr, command, divider, headerLines, headers, i, idx, line, trim, _i, _j, _ref, _ref1, _ref2;
      divider = data.search(/\n\n/);
      headerLines = data.substring(0, divider).split('\n');
      command = headerLines.shift();
      headers = {};
      body = '';
      trim = function(str) {
        return str.replace(/^\s+/g, '').replace(/\s+$/g, '');
      };
      line = idx = null;
      for (i = _i = 0, _ref = headerLines.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        line = headerLines[i];
        idx = line.indexOf(':');
        headers[trim(line.substring(0, idx))] = trim(line.substring(idx + 1));
      }
      chr = null;
      for (i = _j = _ref1 = divider + 2, _ref2 = data.length; _ref1 <= _ref2 ? _j < _ref2 : _j > _ref2; i = _ref1 <= _ref2 ? ++_j : --_j) {
        chr = data.charAt(i);
        if (chr === '\x00') {
          break;
        }
        body += chr;
      }
      return Stomp.frame(command, headers, body);
    },
    unmarshal_multi: function(multi_datas) {
      var data, datas;
      datas = (function() {
        var _i, _len, _ref, _results;
        _ref = multi_datas.split(/\x00\n*/);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          data = _ref[_i];
          if (data && data.length > 0) {
            _results.push(Stomp.unmarshal(data));
          }
        }
        return _results;
      })();
      return datas;
    },
    marshal: function(command, headers, body) {
      return Stomp.frame(command, headers, body).toString() + '\x00';
    },
    client: function(url) {
      var klass, ws;
      klass = Stomp.WebSocketClass || WebSocket;
      ws = new klass(url);
      return new Client(ws);
    },
    over: function(ws) {
      return new Client(ws);
    }
  };

  Client = (function() {

    function Client(ws) {
      this.ws = ws;
      this.ws.binaryType = "arraybuffer";
      this.counter = 0;
      this.connected = false;
      this.subscriptions = {};
    }

    Client.prototype._transmit = function(command, headers, body) {
      var out;
      out = Stomp.marshal(command, headers, body);
      if (typeof this.debug === "function") {
        this.debug(">>> " + out);
      }
      return this.ws.send(out);
    };

    Client.prototype.connect = function(login_, passcode_, connectCallback, errorCallback, vhost_) {
      var _this = this;
      if (typeof this.debug === "function") {
        this.debug("Opening Web Socket...");
      }
      this.ws.onmessage = function(evt) {
        var data, frame, i, onreceive, view, _i, _len, _ref, _results;
        data = (function() {
          var _i, _len;
          if (typeof ArrayBuffer !== 'undefined' && evt.data instanceof ArrayBuffer) {
            view = new Uint8Array(evt.data);
            if (typeof this.debug === "function") {
              this.debug('--- got data length: ' + view.length);
            }
            data = "";
            for (_i = 0, _len = view.length; _i < _len; _i++) {
              i = view[_i];
              data += String.fromCharCode(i);
            }
            return data;
          } else {
            return evt.data;
          }
        }).call(_this);
        if (typeof _this.debug === "function") {
          _this.debug('<<< ' + data);
        }
        _ref = Stomp.unmarshal_multi(data);
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          frame = _ref[_i];
          if (frame.command === "CONNECTED" && connectCallback) {
            _this.connected = true;
            _results.push(connectCallback(frame));
          } else if (frame.command === "MESSAGE") {
            onreceive = _this.subscriptions[frame.headers.subscription];
            _results.push(typeof onreceive === "function" ? onreceive(frame) : void 0);
          } else if (frame.command === "ERROR") {
            _results.push(typeof errorCallback === "function" ? errorCallback(frame) : void 0);
          } else {
            _results.push(typeof _this.debug === "function" ? _this.debug("Unhandled frame: " + frame) : void 0);
          }
        }
        return _results;
      };
      this.ws.onclose = function() {
        var msg;
        msg = "Whoops! Lost connection to " + _this.url;
        if (typeof _this.debug === "function") {
          _this.debug(msg);
        }
        return typeof errorCallback === "function" ? errorCallback(msg) : void 0;
      };
      this.ws.onopen = function() {
        var headers;
        if (typeof _this.debug === "function") {
          _this.debug('Web Socket Opened...');
        }
        headers = {
          login: login_,
          passcode: passcode_
        };
        if (vhost_) {
          headers["host"] = vhost_;
        }
        return _this._transmit("CONNECT", headers);
      };
      return this.connectCallback = connectCallback;
    };

    Client.prototype.disconnect = function(disconnectCallback) {
      this._transmit("DISCONNECT");
      this.ws.close();
      this.connected = false;
      return typeof disconnectCallback === "function" ? disconnectCallback() : void 0;
    };

    Client.prototype.send = function(destination, headers, body) {
      if (headers == null) {
        headers = {};
      }
      if (body == null) {
        body = '';
      }
      headers.destination = destination;
      return this._transmit("SEND", headers, body);
    };

    Client.prototype.subscribe = function(destination, callback, headers) {
      var id;
      if (headers == null) {
        headers = {};
      }
      if (typeof headers.id === 'undefined' || headers.id.length === 0) {
        id = "sub-" + this.counter++;
        headers.id = id;
      } else {
        id = headers.id;
      }
      headers.destination = destination;
      this.subscriptions[id] = callback;
      this._transmit("SUBSCRIBE", headers);
      return id;
    };

    Client.prototype.unsubscribe = function(id, headers) {
      if (headers == null) {
        headers = {};
      }
      headers.id = id;
      delete this.subscriptions[id];
      return this._transmit("UNSUBSCRIBE", headers);
    };

    Client.prototype.begin = function(transaction, headers) {
      if (headers == null) {
        headers = {};
      }
      headers.transaction = transaction;
      return this._transmit("BEGIN", headers);
    };

    Client.prototype.commit = function(transaction, headers) {
      if (headers == null) {
        headers = {};
      }
      headers.transaction = transaction;
      return this._transmit("COMMIT", headers);
    };

    Client.prototype.abort = function(transaction, headers) {
      if (headers == null) {
        headers = {};
      }
      headers.transaction = transaction;
      return this._transmit("ABORT", headers);
    };

    Client.prototype.ack = function(message_id, headers) {
      if (headers == null) {
        headers = {};
      }
      headers["message-id"] = message_id;
      return this._transmit("ACK", headers);
    };

    return Client;

  })();

  if (typeof window !== "undefined" && window !== null) {
    window.Stomp = Stomp;
  } else {
    exports.Stomp = Stomp;
    Stomp.WebSocketClass = require('./test/server.mock.js').StompServerMock;
  }

}).call(this);
