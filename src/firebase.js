import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "***REMOVED_API_KEY***",
  authDomain: "crate-tracker-38b6e.firebaseapp.com",
  projectId: "crate-tracker-38b6e",
  storageBucket: "crate-tracker-38b6e.firebasestorage.app",
  messagingSenderId: "737369389543",
  appId: "1:737369389543:web:68bbf2447e415aa9786542"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
