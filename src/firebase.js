import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBSyz-FVl4_9BxsKEDOLPpzYfpMpVUeSvI",
  authDomain: "kudeja-invoices.firebaseapp.com",
  projectId: "kudeja-invoices",
  storageBucket: "kudeja-invoices.firebasestorage.app",
  messagingSenderId: "236849522678",
  appId: "1:236849522678:web:670bde2136da6d7c5149d7",
  measurementId: "G-TE3ECBJ54D"
};

// Simple check to see if Firebase is configured
export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const HISTORY_COLLECTION = "invoice_history";

export const saveHistoryOnline = async (item) => {
  if (!isFirebaseConfigured) return null;
  try {
    const docRef = await addDoc(collection(db, HISTORY_COLLECTION), {
      ...item,
      serverTimestamp: new Date().toISOString()
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    return null;
  }
};

export const updateHistoryOnline = async (id, data) => {
  if (!isFirebaseConfigured) return false;
  try {
    const docRef = doc(db, HISTORY_COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (e) {
    console.error("Error updating document: ", e);
    return false;
  }
};

export const fetchHistoryOnline = async () => {
  if (!isFirebaseConfigured) return [];
  try {
    const q = query(collection(db, HISTORY_COLLECTION), orderBy("timestamp", "desc"), limit(100));
    const querySnapshot = await getDocs(q);
    const history = [];
    querySnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });
    return history;
  } catch (e) {
    console.error("Error getting documents: ", e);
    return [];
  }
};

export const deleteHistoryOnline = async (id) => {
  if (!isFirebaseConfigured) return false;
  try {
    await deleteDoc(doc(db, HISTORY_COLLECTION, id));
    return true;
  } catch (e) {
    console.error("Error deleting document: ", e);
    return false;
  }
};

export default db;
