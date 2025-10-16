import admin from "firebase-admin";
import { getApps, initializeApp, ServiceAccount } from "firebase-admin/app";

// Only initialize Firebase during runtime, not build time
const shouldInitializeFirebase = () => {
  // Skip initialization during build time
  if (process.env.NODE_ENV === "production" && !process.env.FIREBASE_CLIENT_EMAIL) {
    return false;
  }
  return true;
};

const serviceAccount: ServiceAccount = {
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "",
};

if (shouldInitializeFirebase() && !getApps().length) {
  try {
    initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.warn("Firebase Admin initialization skipped:", error);
  }
}

let adminAuth: admin.auth.Auth | null = null;

if (shouldInitializeFirebase()) {
  try {
    adminAuth = admin.auth();
  } catch (error) {
    console.warn("Firebase Admin Auth initialization failed:", error);
  }
}

export { adminAuth };
