const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

const mongoose = require('mongoose');
const {boardSchema} = require('../routes/api');
const boardModel = mongoose.model('boardModel', boardSchema);
const api = require('../routes/api');

suite('Functional Tests', function() {
    var brd

    this.beforeAll(async function () {
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        collections
            .map((collection) => collection.name)
            .forEach(async (collectionName) => {
                db.dropCollection(collectionName);
            });
    });

    this.beforeEach(async function () {
        
        brd = await boardModel.collection.findOne({name: 'general'});
    });

    test('Test POST /api/threads/{board}', function(done){
        chai
        .request(server)
        .post('/api/threads/general/')
        .send ({
            "text": "Functional test 1",
            "delete_password": "1234"
        })
        .end(function (err, res) {
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            boardModel.collection.findOne({name: 'general'}).then(board => {
                assert.isNotNull(board, 'board not found');
                assert.isArray(board.threads, 'threads must be an array');
                assert.isObject(board.threads[0], 'must be object');
                assert.equal(board.threads[0].text, "Functional test 1", 'database must be correctly updated')
                done();
            });
        });
    });

    test('Test GET /api/threads/{board}', function(done){
        chai.request(server)
        .get('/api/threads/general')
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.isArray(res.body, 'response must be an array');
            assert.typeOf(res.body[0], 'object', 'response elements must be object');
            assert.isBelow(res.body.length, 11, 'threads array must be 10 or less');
            assert.isBelow(res.body[0].replies.length, 4, 'replies array must be 3 or less');
            done();
        });
    });

    test('Test DELETE /api/threads/{board} with the incorrect password', function(done){
        chai.request(server)
        .delete('/api/threads/general')
        .send ({
            "thread_id": brd.threads[0]._id, 
            "delete_password": '3'
        })
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.typeOf(res.text, 'string', 'response must be a string');
            assert.equal(res.text, 'incorrect password', 'response must be correct text');
            done();
        });
    });

    test('Test DELETE /api/threads/{board} with the correct password', function(done){
        const deleted = brd.threads[brd.threads.length - 1];
        chai.request(server)
        .delete('/api/threads/general')
        .send ({
            "thread_id": deleted._id, 
            "delete_password": '1234'
        })
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.typeOf(res.text, 'string', 'response must be a string');
            assert.equal(res.text, 'success', 'response must be correct text');
            assert.isEmpty(deleted.replies, 'database must be updated')
            done();
        });
    });

    test('Test PUT /api/threads/{board}', function(done){
        const thread = brd.threads[brd.threads.length - 1];
        chai.request(server)
        .put(`/api/threads/general/?thread_id=${thread._id}`)
        .send ({
            "report_id": thread._id
        })
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.typeOf(res.text, 'string', 'response must be a string');
            assert.equal(res.text, 'reported', 'response must be correct text');
            boardModel.collection.findOne({name: 'general'}).then(board => {
                assert.isTrue(board.threads[board.threads.length - 1].reported, 'must be updated in database');
                done();
            })
            
        });
    });

    test('Test POST /api/replies/{board}', function(done){
        const thread = brd.threads[brd.threads.length - 1];
        chai
        .request(server)
        .post(`/api/replies/general/?thread_id=${thread._id}`)
        .send ({
            "thread_id": thread._id,
            "text": "reply test 1",
            "delete_password": "1234"
        })
        .end(function (err, res) {
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.isNotNull(thread, 'thread not found');
            boardModel.collection.findOne({name: 'general'}).then(board => {
                trd = board.threads[board.threads.length - 1];
                assert.isArray(trd.replies, 'replies must be an array');
                assert.typeOf(trd.replies[0], 'object', 'reply elements must be objects');
                assert.equal(trd.replies[trd.replies.length - 1].text, "reply test 1", 'database must be updated correctly')
                done();
            })

        });
    });

    test('Test GET /api/replies/{board}/{thread_id}', function(done){
        const thread = brd.threads[brd.threads.length - 1];
        chai
        .request(server)
        .get(`/api/replies/general/?thread_id=${thread._id}`)
        .end(function (err, res) {
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.typeOf(res.body, 'object', 'response elements must be object');
            assert.isArray(res.body.replies, 'replies must be an array');
            assert.typeOf(res.body.replies[0], 'object', 'reply elements must be objects');
            done();
        });
    });

    test('Test DELETE /api/replies/{board} with the incorrect password', function(done){
        const thread = brd.threads[brd.threads.length - 1];
        const reply = thread.replies[thread.replies.length - 1];
        chai.request(server)
        .delete(`/api/replies/general/?thread_id=${thread._id}`)
        .send ({
            "thread_id": thread._id,
            "reply_id": reply._id,
            "delete_password": '3'
        })
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.typeOf(res.text, 'string', 'response must be a string');
            assert.equal(res.text, 'incorrect password', 'response must be correct text');
            done();
        });
    });

    test('Test DELETE /api/replies/{board} with the correct password', function(done){
        const thread = brd.threads[brd.threads.length - 1];
        const reply = thread.replies[thread.replies.length - 1];
        chai.request(server)
        .delete(`/api/replies/general/?thread_id=${thread._id}`)
        .send ({
            "thread_id": thread._id,
            "reply_id": reply._id,
            "delete_password": '1234'
        })
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.typeOf(res.text, 'string', 'response must be a string');
            assert.equal(res.text, 'success', 'response must be correct text');
            boardModel.collection.findOne({name: 'general'}).then(board => {
                trd = board.threads[board.threads.length - 1];
                rep = trd.replies[trd.replies.length - 1];
                assert.equal(rep.text, '[deleted]', 'database must be updated');
                done();
            });
        });
    });

    test('Test PUT /api/replies/{board}', function(done){
        const thread = brd.threads[brd.threads.length - 1];
        const reported = thread.replies[thread.replies.length - 1];
        chai.request(server)
        .put(`/api/replies/general/?thread_id=${thread._id}`)
        .send ({
            "thread_id": thread._id,
            "reply_id": reported._id
        })
        .end(function(err, res){
            assert.equal(err, null, 'should be no errors');
            assert.equal(res.status, 200);
            assert.equal(res.text, 'reported', 'response must be correct text');
            boardModel.collection.findOne({name: 'general'}).then(board => {
                trd = board.threads[board.threads.length - 1];
                rep = trd.replies[trd.replies.length - 1];
                assert.typeOf(rep.text, 'string', 'response must be a string');
                assert.isTrue(rep.reported, 'must be updated in database');
                done();
            });
        });
    });
});
