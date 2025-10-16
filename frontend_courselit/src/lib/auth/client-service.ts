"use client";

import {
  User as FirebaseUser,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  UserCredential,
  updateProfile,
} from "firebase/auth";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { getFirebaseAuth } from "./firebase";

export class AuthClientService {
  private static googleProvider = new GoogleAuthProvider();

  /**
   * Sign in with Google using popup
   */
  static async signInWithGoogle(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result: UserCredential = await signInWithPopup(
        getFirebaseAuth(),
        this.googleProvider,
      );

      const idToken = await result.user.getIdToken();

      // Use NextAuth to create session with Firebase token
      const response = await nextAuthSignIn("credentials", {
        idToken,
        redirect: false,
      });

      if (response?.error) {
        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to sign in with Google",
      };
    }
  }

  /**
   * Sign in with Google using redirect (for mobile)
   */
  static async signInWithGoogleRedirect(): Promise<void> {
    try {
      await signInWithRedirect(getFirebaseAuth(), this.googleProvider);
    } catch (error) {
      console.error("Error initiating Google redirect:", error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  static async signInWithEmail(
    email: string,
    password: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result: UserCredential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      );

      const idToken = await result.user.getIdToken();
      const response = await nextAuthSignIn("credentials", {
        idToken,
        redirect: false,
      });

      if (response?.error) {
        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to sign in with email",
      };
    }
  }

  /**
   * Sign up with email and password
   */
  static async signUpWithEmail(
    email: string,
    password: string,
    name?: string,
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result: UserCredential = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      );

      // Update display name if provided
      if (name && result.user) {
        await updateProfile(
          result.user,
          {
            displayName: name,
          },
        );
      }

      const idToken = await result.user.getIdToken();
      const response = await nextAuthSignIn("credentials", {
        idToken,
        redirect: false,
      });

      if (response?.error) {
        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to sign up with email",
      };
    }
  }

  /**
   * Handle redirect result after coming back from Google OAuth
   */
  static async handleRedirectResult(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await getRedirectResult(getFirebaseAuth());

      if (!result) {
        return { success: false, error: "No redirect result found" };
      }

      const idToken = await result.user.getIdToken();

      // Use NextAuth to create session with Firebase token
      const response = await nextAuthSignIn("credentials", {
        idToken,
        redirect: false,
      });

      if (response?.error) {
        return { success: false, error: response.error };
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to handle redirect result",
      };
    }
  }

  /**
   * Sign out user
   */
  static async signOut(): Promise<void> {
    try {
      await getFirebaseAuth().signOut();
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  /**
   * Get current Firebase user
   */
  static getCurrentUser(): FirebaseUser | null {
    return getFirebaseAuth().currentUser;
  }

  /**
   * Get current user's Firebase profile picture
   */
  static getCurrentUserPhoto(): string | null {
    const user = getFirebaseAuth().currentUser;
    return user?.photoURL || null;
  }

  /**
   * Get current user's Firebase profile data
   */
  static getCurrentUserProfile(): {
    photoURL: string | null;
    displayName: string | null;
    email: string | null;
  } | null {
    const user = getFirebaseAuth().currentUser;
    if (!user) return null;

    return {
      photoURL: user.photoURL,
      displayName: user.displayName,
      email: user.email,
    };
  }
}
