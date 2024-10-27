'use strict';

const bcrypt      = require('bcrypt');
const saltRounds = 12;
const mongoose = require('mongoose');


// mongoose setup
mongoose.connect(process.env.MONGO_URI);
const Schema = mongoose.Schema;
// Schema setup
const replySchema = new Schema({
  text: {type: String, required: true},
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false },
  created_on: { type: Date, default: Date.now }
});
const threadSchema = new Schema({
  text: {type: String, required: true},
  delete_password: { type: String, required: true },
  reported: { type: Boolean, default: false },
  created_on: { type: Date, default: Date.now },
  bumped_on: { type: Date, default: Date.now },
  replies: { type: [replySchema]}
});
const boardSchema = new Schema({
  name: { type: String, required: true },
  threads: { type: [threadSchema] }
});
// Model setup
const replyModel = mongoose.model('replyModel', replySchema);
const threadModel = mongoose.model('threadModel', threadSchema);
const boardModel = mongoose.model('boardModel', boardSchema);
module.exports = boardSchema;


module.exports = function (app) {

  app.route('/api/threads/:board')
    .get(function(req, res) {
      const board = req.params.board;
      boardModel.findOne({name: board}).slice('threads', 10).then(brd => {
          if (brd) {
            if (brd.threads) {
              res.json(brd.threads.toReversed().map(thread => {
                var {_id, text, created_on, bumped_on, replies } = thread;
                if (replies.length > 3) {
                  var replies = replies.slice(-3).map(rep => ({
                    _id: rep._id,
                    text: rep.text,
                    created_on: rep.created_on
                  }));
                }
                else {
                  var replies = replies.map(rep => ({
                    _id: rep._id,
                    text: rep.text,
                    created_on: rep.created_on
                  }));}
                var replyCount = replies.length;
                return { _id, text, created_on, bumped_on, replies, replycount: replyCount };
                })
              );
            }
          }
          else res.json({ error: "board not found" });
      });
    })
    .post(async function(req, res) {
      const { text, delete_password } = req.body;
      const board = req.params.board;
      const password = bcrypt.hashSync(delete_password, saltRounds);

      const newThread = new threadModel({
        text: text,
        delete_password: password
      });
      await newThread.save();

      boardModel.findOne({name: board}).then(async brd => {
        if (brd) {
          brd.threads.push(newThread);
          await brd.save();
        }
        else {
          const newBoard = new boardModel({
            name: board,
            threads: [newThread]
          });
          await newBoard.save();
        }
      });
      while (!( await boardModel.exists({name: board}))) {
        await delay(250);
      }
      res.redirect(`/b/${board}/${newThread._id}`);
    })
    .put(function(req, res) {
      var thread_id = req.body.thread_id;
      if (!thread_id) {
        thread_id = req.query.thread_id;
      }
      const board = req.params.board;
      boardModel.findOne({ name: board }).then(async brd => {
        if (brd) {
          var thread = brd.threads.id(thread_id);
          if (thread) {
            thread.reported = true;
            thread.bumped_on = Date.now();
            await brd.save();
            res.send('reported');
          }
          else res.json({ error: "Thread not found" });
        }
        else res.json({ error: "Board not found" });
      });
    })
    .delete(function(req, res) {
      const { thread_id, delete_password } = req.body;
      const board = req.params.board;
      boardModel.findOne({ name: board }).then(async brd => {
        if (brd) {
          var thread = brd.threads.id(thread_id);
          if (bcrypt.compareSync(delete_password, thread.delete_password)) {
            thread.bumped_on = Date.now();
            thread.replies.forEach(el => el.deleteOne());
            thread.replies = [];
            await brd.save();
            res.send('success');
          }
          else {
            res.send("incorrect password")
          }
        }
        else res.json({ error: "Thread not found" });
      });
    });
    
  app.route('/api/replies/:board')
  .get(function(req, res) {
    const thread_id = req.query.thread_id;
    const board = req.params.board;
    boardModel.findOne({ name: board }).then(async brd => {
      if (brd) {
        const thread = brd.threads.id(thread_id);
        if (thread) {
          res.json({
            _id: thread._id,
            text: thread.text,
            created_on: thread.created_on,
            bumped_on: thread.bumped_on,
            replies: thread.replies.map(reply => {
              return {
                _id: reply._id,
                text: reply.text,
                created_on: reply.created_on,
              }})
            });
          }
          else res.json({ error: "Thread not found" });
        }
      else res.json({ error: "Board not found" });
      });
    
  })
  .post(async function(req, res) {
    const { thread_id, text, delete_password } = req.body;
    const board = req.params.board;
    const password = bcrypt.hashSync(delete_password, saltRounds);

    const newReply = new replyModel({
      text: text,
      delete_password: password
    });
    await newReply.save();

    boardModel.findOne({ name: board }).then(async brd => {
      if (brd) {
        var thread = brd.threads.id(thread_id);
        if (thread) {
          thread.bumped_on = newReply.created_on;
          thread.replies.push(newReply);
          await brd.save();
          res.redirect(`/b/${board}/${thread_id}`);
        }
        else {
          res.json({ error: "Thread not found" });
        }
      }
      else {
        res.json({ error: "Board not found" });
      }
      
    });
  })
  .put(function(req, res) {
    const { thread_id, reply_id } = req.body;
    const board = req.params.board;
    boardModel.findOne({name: board}).then(async brd => {
      if (brd) {
        var thread = brd.threads.id(thread_id);
        var reply = thread.replies.id(reply_id);
        reply.reported = true;
        thread.bumped_on = Date.now();
        await brd.save();
        res.send("reported");
      }
      else {
        res.json({ error: "Board not found" });
      }
    });
  })
  .delete(function(req, res) {
    const { thread_id, reply_id, delete_password } = req.body;
    const board = req.params.board;
    boardModel.findOne({name: board}).then(async brd => {
      if (brd) {
        var thread = brd.threads.id(thread_id);
        var reply = thread.replies.id(reply_id);
        if (bcrypt.compareSync(delete_password, reply.delete_password)) {
          thread.bumped_on = Date.now();
          reply.text = '[deleted]';
          await brd.save();
          res.send("success");
        } else {
          res.send("incorrect password");
        }
      }
    });
  });

};

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}
