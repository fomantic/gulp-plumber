'use strict';

var Through = require('through');
var EE = require('events').EventEmitter;
var gutil = require('gulp-util');

function trim(str) { return str.replace(/^\s+|\s+$/g, ''); }

function removeDefaultHandler(stream, event) {
    var found = false;
    stream.listeners(event).forEach(function (item) {
        if (item.name === 'on' + event) {
            found = item;
            this.removeListener(event, item);
        }
    }, stream);
    return found;
}

function defaultErrorHandler(error) {
    // onerror2 and this handler
    if (EE.listenerCount(this, 'error') < 3) {
        gutil.log(
            gutil.colors.cyan('Plumber') + ' found unhandled error:',
            gutil.colors.red(trim(error.toString())));
    }
}

function plumber(opts) {
    opts = opts || {};

    var through = new Through(function (file) { this.queue(file); });
    through._plumber = true;

    if (opts.errorHandler !== false) {
        through.errorHandler = (typeof opts.errorHandler === 'function') ?
            opts.errorHandler :
            defaultErrorHandler;
    }

    function patchPipe(stream) {
        if (stream.pipe2) {
            stream._pipe = stream._pipe || stream.pipe;
            stream.pipe = stream.pipe2;
            stream.once('readable', patchPipe.bind(null, stream));
            stream._plumbed = true;
        }
    }

    through.pipe2 = function pipe2(dest) {

        if (!dest) { throw new Error('Can\'t pipe to undefined'); }

        this._pipe.apply(this, arguments);

        if (dest._plumber) { return dest; }

        dest.pipe2 = pipe2;

        // Patching pipe method
        if (opts.inherit !== false) {
            patchPipe(dest);
        }

        // Wrapping panic onerror handler
        var oldHandler = removeDefaultHandler(dest, 'error');
        if (oldHandler) {
            dest.on('error', function onerror2(er) {
                if (EE.listenerCount(dest, 'error') === 1) {
                    this.removeListener('error', onerror2);
                    oldHandler.call(dest, er);
                }
            });
        }

        // Placing custom on error handler
        if (this.errorHandler) {
            dest.errorHandler = this.errorHandler;
            dest.on('error', this.errorHandler.bind(dest));
        }

        dest._plumbed = true;

        return dest;
    };

    patchPipe(through);

    return through;
}

module.exports = plumber;
