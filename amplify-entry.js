export { Amplify } from 'aws-amplify';
export {
  signIn, signOut, confirmSignIn, fetchAuthSession, getCurrentUser,
  resetPassword, confirmResetPassword, fetchUserAttributes
} from 'aws-amplify/auth';
export { generateClient } from 'aws-amplify/data';
export { uploadData, getUrl, remove } from 'aws-amplify/storage';
