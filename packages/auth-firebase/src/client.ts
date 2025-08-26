import { getAuth, signInWithEmailLink as firebaseSignInWithEmailLink, isSignInWithEmailLink as firebaseIsSignInWithEmailLink, UserCredential } from 'firebase/auth';

export const sendSignInLink = async (email: string, actionCodeSettings: any) => {
  const auth = getAuth();
  await firebaseSignInWithEmailLink(auth, email, actionCodeSettings);
};

export const isSignInLink = (url: string): boolean => {
  return firebaseIsSignInWithEmailLink(getAuth(), url);
};

export const completeSignIn = async (url: string): Promise<string | null> => {
  const auth = getAuth();
  const email = window.localStorage.getItem('emailForSignIn');
  if (!email) {
    // This can happen if the user clears their local storage or opens the link in a different browser.
    // We can ask the user for their email again.
    // For now, we'll just log an error.
    console.error('Email not found in local storage to complete sign-in.');
    return null;
  }
  const userCredential: UserCredential = await firebaseSignInWithEmailLink(auth, email, url);
  window.localStorage.removeItem('emailForSignIn');
  if (userCredential.user) {
    return userCredential.user.getIdToken();
  }
  return null;
};