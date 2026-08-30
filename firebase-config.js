// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_rprbnmVikQ-bSMFt38YMq5bggOKpBfg",
  authDomain: "fichas-rpg---a-realidade.firebaseapp.com",
  databaseURL: "https://fichas-rpg---a-realidade-default-rtdb.firebaseio.com",
  projectId: "fichas-rpg---a-realidade",
  storageBucket: "fichas-rpg---a-realidade.firebasestorage.app",
  messagingSenderId: "214918993835",
  appId: "1:214918993835:web:2ca4d01808e82260a0e4ee",
  measurementId: "G-3HDVK52YY2"
};

if(!firebase.apps.length){
    firebase.initializeApp(firebaseConfig);
}

window.auth = firebase.auth();
window.db = firebase.firestore();