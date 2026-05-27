import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAprvr3Yw1ad72zciteDyE8q_4FQMOA7yg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "healthplatform-58704.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healthplatform-58704",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://healthplatform-58704-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "healthplatform-58704.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "508626933664",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:508626933664:web:646dc15f9077c33f4c36c5",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SPP8SETNDW",
};

const dataApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const dataDb = getFirestore(dataApp);
