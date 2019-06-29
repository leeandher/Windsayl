const firebase = require("firebase");
const admin = require("firebase-admin");
const db = admin.firestore();

const { isEmpty, isEmail } = require("../util/validators");
const { catchErrors } = require("../utils");

exports.signUp = catchErrors(
  async (req, res) => {
    const newUser = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      handle: req.body.handle
    };

    // Validation
    const errors = {};

    if (isEmpty(newUser.email)) errors.email = "Must not be empty";
    else if (!isEmail(newUser.email)) errors.email = "Must be a valid email";

    if (isEmpty(newUser.password)) errors.password = "Must not be empty";
    if (newUser.password !== newUser.confirmPassword) {
      errors.confirmPassword = "Passwords must match";
    }

    if (isEmpty(newUser.handle)) errors.handle = "Must not be empty";

    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    // Check for handle
    let userToken, userId;
    const doc = await db.doc(`/users/${newUser.handle}`).get();
    if (doc.exists) {
      return res.status(400).json({ handle: "This handle is already taken." });
    }

    // Create the Firebase User Auth
    const { user } = await firebase
      .auth()
      .createUserWithEmailAndPassword(newUser.email, newUser.password);

    // Get their IdToken and save them to the DB
    userId = user.uid;
    userToken = await user.getIdToken();
    const newUserCredentials = {
      handle: newUser.handle,
      email: newUser.email,
      createdAt: new Date().toISOString(),
      userId
    };
    await db.doc(`/users/${newUser.handle}`).set(newUserCredentials);

    // Return the IdToken
    return res.status(201).json({
      userToken
    });
  },
  (err, req, res) => {
    if (err.code === "auth/email-already-in-use") {
      return res.status(400).json({
        email: "Email is already in use"
      });
    }
    console.error(err);
    return res
      .status(500)
      .json({ error: `(${err.code}) Could not create new user` });
  }
);

exports.login = catchErrors(
  async (req, res) => {
    const user = {
      email: req.body.email,
      password: req.body.password
    };

    // Validation
    const errors = {};

    if (isEmpty(user.email)) errors.email = "Must not be empty";
    if (isEmpty(user.password)) errors.password = "Must not be empty";

    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    const data = await firebase
      .auth()
      .signInWithEmailAndPassword(user.email, user.password);
    console.log(JSON.stringify(data.getIdToken));
    const token = await data.user.getIdToken();
    return res.json({ token });
  },
  (err, req, res) => {
    if (err.code === "auth/wrong-password") {
      return res.status(403).json({
        general: "Incorrect password, please try again"
      });
    }
    console.error(err);
    return res.status(500).json({ error: `(${err.code}) Could not login` });
  }
);
