import { db, auth } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function testFirestore() {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('Not signed in');
    }

    // Try to write a test document
    const testDocRef = doc(db, 'users', uid, 'test', 'connection-test');
    await setDoc(testDocRef, {
      timestamp: new Date().toISOString(),
      testId: 'firestore-connection-test'
    });

    // Try to read it back
    const testDoc = await getDoc(testDocRef);
    if (!testDoc.exists()) {
      throw new Error('Test document not found after writing');
    }

    console.log('Firestore connection test successful!', testDoc.data());
    return { success: true };
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}