/*global describe, it, before, beforeEach */
'use strict';

var should = require('should'),
    es = require('event-stream'),
    through2 = require('through2'),
    EE = require('events').EventEmitter,
    gulp = require('gulp'),
    fancyLog = require('fancy-log');

var plumber = require('../');

var errorMessage = 'Bang!';
var fixturesGlob = ['./test/fixtures/index.js', './test/fixtures/test.js'];
var delay = 20;

describe('errorHandler', function () {

    beforeEach(function () {
        this.failingEmitStream = new es.through(function (file) {
            this.emit('data', file);
            this.emit('error', new Error('Bang!'));
        });
        var i = 0;
        this.failingQueueStream = new es.through(function (file) {
            this.queue(file);
            i ++;
            if (i === 2) {
                this.emit('error', new Error('Bang!'));
            }
        });
    });

    before(function (done) {
        gulp.src(fixturesGlob)
            .pipe(es.writeArray(function (err, array) {
                this.expected = array;
                done();
            }.bind(this)));
    });

    it('should attach custom error handler', function (done) {
        gulp.src(fixturesGlob)
            .pipe(plumber({ errorHandler: function (error) {
                error.toString().should.containEql(errorMessage);
                done();
            }}))
            .pipe(this.failingQueueStream);
    });

    it('should attach custom error handler with function argument', function (done) {
        gulp.src(fixturesGlob)
            .pipe(plumber(function (error) {
                error.toString().should.containEql(errorMessage);
                done();
            }))
            .pipe(this.failingQueueStream);
    });

    it('should attach default error handler', function (done) {
        var mario = plumber();
        mario.errorHandler = function (error) {
            error.toString().should.containEql(errorMessage);
            done();
        };
        gulp.src(fixturesGlob)
            .pipe(mario)
            .pipe(this.failingQueueStream);
    });

    it('default error handler should work', function (done) {
        var mario = plumber();
        var _ = fancyLog;
        fancyLog = done.bind(null, null);
        gulp.src(fixturesGlob)
            .pipe(mario)
            .pipe(this.failingQueueStream)
            .on('end', function () {
                fancyLog = _;
                done();
            });
    });

    describe('should attach error handler', function () {
        it('in non-flowing mode', function (done) {
            var delayed = through2.obj();
            setTimeout(delayed.write.bind(delayed, 'data'), delay);
            setTimeout(delayed.write.bind(delayed, 'data'), delay);
            delayed
                .pipe(plumber({ errorHandler: done.bind(null, null) }))
                .pipe(this.failingQueueStream);
        });

        // it.only('in flowing mode', function (done) {
        //     var delayed = through2.obj();
        //     setTimeout(delayed.write.bind(delayed, 'data'), delay);
        //     setTimeout(delayed.write.bind(delayed, 'data'), delay);
        //     delayed
        //         .pipe(plumber({ errorHandler: done.bind(null, null) }))
        // // You cant do on('data') and pipe simultaniously.
        //         .on('data', function () { })
        //         .pipe(this.failingQueueStream);
        // });
    });

    describe('should not attach error handler', function () {
        it('in non-flowing mode', function (done) {
            (function () {
                gulp.src(fixturesGlob)
                    .pipe(plumber({ errorHandler: false }))
                    .pipe(this.failingQueueStream)
                    .on('end', done);
            }).should.throw();
            done();
        });

        // it('in flowing mode', function (done) {
        //     (function () {
        //         gulp.src(fixturesGlob)
        //             .pipe(plumber({ errorHandler: false }))
        // // You cant do on('data') and pipe simultaniously.
        //             .on('data', function () { })
        //             .pipe(this.failingQueueStream)
        //             .on('end', done);
        //     }).should.throw();
        //     done();
        // });
    });

    describe('throw', function () {
        it('on piping to undefined', function () {
            plumber().pipe.should.throw(/Can't pipe to undefined/);
        });

        it('after cleanup', function (done) {
            var mario = plumber({ errorHandler: false });
            var stream = mario.pipe(through2.obj());

            (function () {
                stream.emit('error', new Error(errorMessage));
            }).should.throw();

            EE.listenerCount(mario, 'data').should.eql(0);
            EE.listenerCount(mario, 'drain').should.eql(0);
            EE.listenerCount(mario, 'error').should.eql(0);
            EE.listenerCount(mario, 'close').should.eql(0);

            EE.listenerCount(stream, 'data').should.eql(0);
            EE.listenerCount(stream, 'drain').should.eql(0);
            EE.listenerCount(stream, 'error').should.eql(0);
            EE.listenerCount(stream, 'close').should.eql(0);

            done();
        });

    });

});
