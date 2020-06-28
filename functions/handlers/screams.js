const { db } = require("../Tools/admin");

exports.getAllScreams = (req, res) => {
  db.collection(`screams`)
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let screams = [];
      data.forEach((doc) => {
        screams.push({
          screamId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage,
        });
      });
      return res.json(screams);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.postOneScream = (req, res) => {
  if (req.body.body.trim() === "") {
    return res.status(400).json({ body: "Body must not empty" });
  }
  const newScream = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };
  db.collection(`screams`)
    .add(newScream)
    // eslint-disable-next-line promise/always-return
    .then((doc) => {
      const resScream = newScream;
      resScream.screamId = doc.id;
      res.json(resScream);
    })
    .catch((err) => {
      res.status(500).json({ error: `something went wron` });
      console.error(err);
    });
};
// fetch one scream
exports.getScream = (req, res) => {
  let screamData = {};
  db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "scream not found" });
      }
      screamData = doc.data();
      screamData.screamId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("screamId", "==", req.params.screamId)
        .get();
    })
    .then((data) => {
      screamData.comments = [];
      data.forEach((doc) => {
        screamData.comments.push(doc.data());
      });
      return res.json(screamData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// comment on a comment

exports.commentOneScream = (req, res) => {
  if (req.body.body.trim() === ``)
    return res.status(400).json({ comment: "Must not be empty" });
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    screamId: req.params.screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
  };

  db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "scream not found" });
      }

      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    // eslint-disable-next-line promise/always-return
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Somethings wrong" });
    });
};

//like scream
exports.likeScream = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);
  const screamDocument = db.doc(`/screams/${req.params.screamId}`);
  let screamData;

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "scream not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        // eslint-disable-next-line promise/no-nesting
        return db
          .collection("likes")
          .add({
            screamId: req.params.screamId,
            userHandle: req.user.handle,
          })
          .then(() => {
            screamData.likeCount++;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return res.json(screamData);
          });
      } else {
        return res.status(400).json({ error: "scream already liked" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// dislike scream
exports.unlikeScream = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);
  const screamDocument = db.doc(`/screams/${req.params.screamId}`);
  let screamData;

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "scream not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "scream not liked" });
      } else {
        // eslint-disable-next-line promise/no-nesting
        return (
          // eslint-disable-next-line promise/no-nesting
          db
            .doc(`/likes/${data.docs[0].id}`)
            .delete()
            .then(() => {
              screamData.likeCount--;
              return screamDocument.update({ likeCount: screamData.likeCount });
            })
            // eslint-disable-next-line promise/always-return
            .then(() => {
              res.json(screamData);
            })
        );
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// delete scream
exports.deleteScream = (req, res) => {
  const document = db.doc(`/screams/${req.params.screamId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    // eslint-disable-next-line promise/always-return
    .then(() => {
      res.json({ message: "Scream deleted successufly" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
