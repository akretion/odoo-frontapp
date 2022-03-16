odoo.define('web.simple_ajax', function (require) {
"use strict";

// similar to web/static/src/js/core/ajax.js but with simplified dependencies
// only kept jsonrpc methods
// depends on web.Bus instead of web.core
// also see new Odoo version here:
// https://github.com/odoo-dev/odoo/blob/master-wowl/addons/web/static/src/core/network/rpc_service.js
// also see https://github.com/odoo-dev/odoo/blob/master-wowl/addons/web/static/src/core/orm_service.js

var Bus = require('web.Bus');
var time = require('web.time');

var bus = new Bus();

var simple_ajax = {};

function _genericJsonRpc (fct_name, params, settings, fct) {
    var shadow = settings.shadow || false;
    delete settings.shadow;
    if (!shadow) {
        bus.trigger('rpc_request');
    }

    var data = {
        jsonrpc: "2.0",
        method: fct_name,
        params: params,
        id: Math.floor(Math.random() * 1000 * 1000 * 1000)
    };
    var xhr = fct(data);
    var result = xhr.then(function(result) {
        bus.trigger('rpc:result', data, result);
        $('#error')[0].innerHTML = "";
        if (result.error !== undefined) {
            if (result.error.data.arguments[0] !== "bus.Bus not available in test mode") {
                console.debug(
                    "Server application error\n",
                    "Error code:", result.error.code, "\n",
                    "Error message:", result.error.message, "\n",
                    "Error data message:\n", result.error.data.message, "\n",
                    "Error data debug:\n", result.error.data.debug
                );
                if (result.error.message == "Odoo Session Expired") {
                  $('#error')[0].innerHTML = "You should login in Odoo to get the Odoo Frontapp plugin to work!";
                }
            }
            return Promise.reject({type: "server", error: result.error});
        } else {
            return result.result;
        }
    }, function() {
        //console.error("JsonRPC communication error", _.toArray(arguments));
        var reason = {
            type: 'communication',
            error: arguments[0],
            textStatus: arguments[1],
            errorThrown: arguments[2],
        };
        return Promise.reject(reason);
    });

    var rejection;
    var promise = new Promise(function (resolve, reject) {
        rejection = reject;

        result.then(function (result) {
            if (!shadow) {
                bus.trigger('rpc_response');
            }
            resolve(result);
        }, function (reason) {
            var type = reason.type;
            var error = reason.error;
            var textStatus = reason.textStatus;
            var errorThrown = reason.errorThrown;
            if (type === "server") {
                if (!shadow) {
                    bus.trigger('rpc_response');
                }
                if (error.code === 100) {
                    bus.trigger('invalidate_session');
                }
                reject({message: error, event: $.Event()});
            } else {
                if (!shadow) {
                    bus.trigger('rpc_response_failed');
                }
                var nerror = {
                    code: -32098,
                    message: "XmlHttpRequestError " + errorThrown,
                    data: {
                        type: "xhr"+textStatus,
                        debug: error.responseText,
                        objects: [error, errorThrown],
                        arguments: [reason || textStatus]
                    },
                };
                reject({message: nerror, event: $.Event()});
            }
        });
    });

    // FIXME: jsonp?
    promise.abort = function () {
        rejection({
            message: "XmlHttpRequestError abort",
            event: $.Event('abort')
        });
        if (xhr.abort) {
            xhr.abort();
        }
    };
    promise.guardedCatch(function (reason) { // Allow promise user to disable rpc_error call in case of failure
        setTimeout(function () {
            // we want to execute this handler after all others (hence
            // setTimeout) to let the other handlers prevent the event
            if (!reason.event.isDefaultPrevented()) {
                bus.trigger('rpc_error', reason.message, reason.event);
            }
        }, 0);
    });
    return promise;
};

function jsonRpc(url, fct_name, params, settings) {
    settings = settings || {};
    return _genericJsonRpc(fct_name, params, settings, function(data) {
        return $.ajax(url, _.extend({}, settings, {
            url: url,
            dataType: 'json',
            type: 'POST',
            data: JSON.stringify(data, time.date_to_utc),
            contentType: 'application/json'
        }));
    });
}

// helper function to make a rpc with a function name hardcoded to 'call'
function rpc(url, params, settings) {
    return jsonRpc(url, 'call', params, settings);
}

_.extend(simple_ajax, {
    jsonRpc: jsonRpc,
    rpc: rpc,
});

return simple_ajax;


});
