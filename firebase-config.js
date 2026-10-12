/* firebase-config.js — اتصال Firebase برای لیدربرد زنده */
const firebaseConfig = {
  apiKey: "AIzaSyDGwKZ0rpW2a_3D7bnJ0ZfYoDoo5S7joGU",
  authDomain: "math-game-live-6b991.firebaseapp.com",
  databaseURL: "https://math-game-live-6b991-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "math-game-live-6b991",
  storageBucket: "math-game-live-6b991.firebasestorage.app",
  messagingSenderId: "577612394099",
  appId: "1:577612394099:web:79fa9610b3eb6fc611c406"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  window.fbDB = firebase.database();
  console.log('✅ Firebase آماده است');
} else {
  console.warn('⚠️ Firebase SDK لود نشده');
}
