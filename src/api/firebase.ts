// Firebase integration for Boundaries Logbook data
// Uses lazy initialization to avoid crashes if Firebase is unavailable
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Firestore,
} from 'firebase/firestore';

// Firebase configuration (Boundaries Logbook)
const firebaseConfig = {
  apiKey: 'AIzaSyDbOuTQGRW2LtQUpRFHmcXj782Zp4tEKvQ',
  authDomain: 'boundaries-logbook-app.firebaseapp.com',
  projectId: 'boundaries-logbook-app',
  storageBucket: 'boundaries-logbook-app.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};

// Lazy initialization
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let initError: Error | null = null;

function getDb(): Firestore | null {
  if (initError) return null;
  if (db) return db;

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    return db;
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    initError = error instanceof Error ? error : new Error('Firebase init failed');
    return null;
  }
}

const ORG_ID = 'org-boundaries';

// Types
export interface ChecklistSubmission {
  id: string;
  userId: string;
  storeId: string;
  templateId: string;
  date: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  taskResults: TaskResult[];
  toastSnapshot?: ToastSnapshot;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface TaskResult {
  taskId: string;
  completed: boolean;
  value?: string | number;
  photoUrl?: string;
  notes?: string;
}

export interface ToastSnapshot {
  sales?: number;
  laborPercent?: number;
  guestCount?: number;
  avgCheck?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'TRAINEE' | 'TRAINER' | 'MANAGER' | 'ADMIN';
  storeId: string;
  toastEmployeeGuid?: string;
}

export interface TrainingProgress {
  lessonId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
  score?: number;
}

// Helper to get collection path
function getOrgCollection(collectionName: string) {
  const database = getDb();
  if (!database) return null;
  return collection(database, `organizations/${ORG_ID}/data/${collectionName}`);
}

// Fetch recent checklist submissions
export async function getRecentSubmissions(
  storeId?: string,
  limitCount = 10
): Promise<ChecklistSubmission[]> {
  try {
    const submissionsRef = getOrgCollection('submissions');
    if (!submissionsRef) return [];

    let q = query(submissionsRef, orderBy('submittedAt', 'desc'), limit(limitCount));

    if (storeId) {
      q = query(
        submissionsRef,
        where('storeId', '==', storeId),
        orderBy('submittedAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChecklistSubmission[];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
}

// Fetch submissions for a date range
export async function getSubmissionsByDateRange(
  startDate: string,
  endDate: string,
  storeId?: string
): Promise<ChecklistSubmission[]> {
  try {
    const submissionsRef = getOrgCollection('submissions');
    if (!submissionsRef) return [];

    let q = query(
      submissionsRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    let results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChecklistSubmission[];

    if (storeId) {
      results = results.filter((s) => s.storeId === storeId);
    }

    return results;
  } catch (error) {
    console.error('Error fetching submissions by date:', error);
    return [];
  }
}

// Fetch users
export async function getUsers(storeId?: string): Promise<User[]> {
  try {
    const usersRef = getOrgCollection('users');
    if (!usersRef) return [];

    const snapshot = await getDocs(usersRef);

    let users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as User[];

    if (storeId) {
      users = users.filter((u) => u.storeId === storeId);
    }

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

// Fetch training progress for a user
export async function getUserTrainingProgress(userId: string): Promise<TrainingProgress[]> {
  try {
    const progressRef = getOrgCollection('progress');
    if (!progressRef) return [];

    const database = getDb();
    if (!database) return [];

    const progressDoc = await getDoc(doc(progressRef, userId));

    if (progressDoc.exists()) {
      const data = progressDoc.data();
      return data.lessons || [];
    }

    return [];
  } catch (error) {
    console.error('Error fetching training progress:', error);
    return [];
  }
}

// Fetch cash deposits
export async function getCashDeposits(
  startDate: string,
  endDate: string,
  storeId?: string
): Promise<any[]> {
  try {
    const depositsRef = getOrgCollection('deposits');
    if (!depositsRef) return [];

    const q = query(
      depositsRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    let results = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (storeId) {
      results = results.filter((d: any) => d.storeId === storeId);
    }

    return results;
  } catch (error) {
    console.error('Error fetching deposits:', error);
    return [];
  }
}

// Fetch Google reviews data
export async function getGoogleReviews(): Promise<any> {
  try {
    const reviewsRef = getOrgCollection('googleReviews');
    if (!reviewsRef) return null;

    const snapshot = await getDocs(reviewsRef);

    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }

    return null;
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return null;
  }
}

// Calculate checklist completion rate
export async function getChecklistCompletionRate(
  startDate: string,
  endDate: string,
  storeId?: string
): Promise<{ completed: number; total: number; rate: number }> {
  const submissions = await getSubmissionsByDateRange(startDate, endDate, storeId);

  const completed = submissions.filter((s) => s.status === 'APPROVED').length;
  const total = submissions.length;
  const rate = total > 0 ? (completed / total) * 100 : 0;

  return { completed, total, rate: Math.round(rate * 10) / 10 };
}
