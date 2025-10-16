import { getAuth } from "@firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";

// Only initialize Firebase during runtime, not build time
const shouldInitializeFirebase = () => {
  // Skip initialization during build time when API key is not available
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_FB_API_KEY) {
    return false;
  }
  return true;
};

let app: any = null;
let firebaseAuth: any = null;

if (shouldInitializeFirebase()) {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FB_APP_ID,
  };

  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    firebaseAuth = getAuth(app);
  } catch (error) {
    console.warn("Firebase client initialization failed:", error);
  }
}

export const getFirebaseAuth = () => {
  if (!firebaseAuth) {
    throw new Error("Firebase Auth is not initialized. Make sure NEXT_PUBLIC_FB_API_KEY is set.");
  }
  return firebaseAuth;
};

const firebaseErrorRecord: Record<string, string> = {
  "auth/user-not-found": "No user associated with email",
  "auth/wrong-password": "Provided password is not valid",
};

// For backward compatibility, export app and firebaseAuth directly (will be null during build)
export { app, firebaseAuth, firebaseErrorRecord };
