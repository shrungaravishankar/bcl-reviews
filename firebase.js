import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-wITpH9WdFrvMoJEwIhHyoedJbyRRiEw",
  authDomain: "reviews-facbe.firebaseapp.com",
  projectId: "reviews-facbe",
  storageBucket: "reviews-facbe.firebasestorage.app",
  messagingSenderId: "193461666604",
  appId: "1:193461666604:web:8ae52307d1003da88ba289",
  measurementId: "G-TVDD2MVCXN"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const analytics = getAnalytics(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
