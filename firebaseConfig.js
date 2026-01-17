// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAM6oQYQrO1DP1nVQ8shzj58o-MUqtJHmM",
  authDomain: "encontrados-156c7.firebaseapp.com",
  projectId: "encontrados-156c7",
  storageBucket: "encontrados-156c7.firebasestorage.app",
  messagingSenderId: "989938386656",
  appId: "1:989938386656:web:aea01e2cd28745641f3285",
  measurementId: "G-74DHPZMGH8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);