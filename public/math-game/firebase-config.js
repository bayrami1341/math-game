/* firebase-config.js — اتصال Firebase برای لیدربرد زنده */
const firebaseConfig = {
  apiKey: "AIzaSyAxW1bXDRKZ0b-4-HQXx_2z8qMsU-yRoII",
  authDomain: "class-board-2752e.firebaseapp.com",
  databaseURL: "https://class-board-2752e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "class-board-2752e",
  storageBucket: "class-board-2752e.firebasestorage.app",
  messagingSenderId: "429685206281",
  appId: "1:429685206281:web:b74665d121ab87d9d237d8"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  window.fbDB = firebase.database();
  console.log('✅ Firebase آماده است');
} else {
  console.warn('⚠️ Firebase SDK لود نشده');
}
