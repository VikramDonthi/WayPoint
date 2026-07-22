import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { collection, onSnapshot, query, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Rider } from './types';

import { Navbar } from './components/Navbar';
import { LiveMap } from './components/LiveMap';
import { RiderList } from './components/RiderList';
import { FleetSidebar } from './components/FleetSidebar';
import { AddRiderModal } from './components/AddRiderModal';
import { ConfigModal } from './components/ConfigModal';
import { RiderDetailModal } from './components/RiderDetailModal';
import { LoginView } from './components/LoginView';
import { RiderMobileApp } from './components/RiderMobileApp';

export function App() {
  // Check if URL has ?mode=rider
  const isRiderMode = new URLSearchParams(window.location.search).get('mode') === 'rider';

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<'map' | 'riders'>('map');
  const [riders, setRiders] = useState<Rider[]>([]);
  
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  // Listen to Auth State safely
  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      return;
    }

    // DEV mode: sign in anonymously so Firestore security rules get a real token.
    // The Firestore rules allow anonymous users to read all data (dev convenience).
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dev') === 'true') {
      signInAnonymously(auth).catch((err) => {
        console.warn('Anonymous sign-in failed:', err);
      });
      // Fall through – onAuthStateChanged below will pick up the anon user
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore Riders collection real-time updates when logged in
  useEffect(() => {
    if (isRiderMode || !currentUser || !db) {
      setRiders([]);
      return;
    }

    try {
      const ridersRef = collection(db, 'riders');
      const q = query(ridersRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Rider[] = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data()
        })) as Rider[];
        setRiders(list);
      }, (error) => {
        console.error('Firestore riders listener error:', error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error('Failed to setup riders listener:', e);
    }
  }, [currentUser, isRiderMode]);

  const handleDeleteRider = async (riderToDelete: Rider) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'riders', riderToDelete.id));
    } catch (err) {
      console.error('Failed to delete rider from Firestore:', err);
    }
  };

  // If rider mode query parameter is present, render Mobile Rider App directly
  if (isRiderMode) {
    return <RiderMobileApp />;
  }

  if (authChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0284c7',
        fontWeight: '700'
      }}>
        Initializing Waypoint Command Center...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView onOpenConfig={() => setIsConfigOpen(true)} />
        <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
      </>
    );
  }

  const onlineCount = riders.filter((r) =>
    r.status === 'traveling' || r.status === 'delivering' || r.status === 'resting'
  ).length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddRider={() => setIsAddRiderOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        riderCount={riders.length}
        onlineCount={onlineCount}
        currentUser={currentUser}
      />

      <main style={{ padding: '1rem 1.25rem', maxWidth: '1700px', margin: '0 auto' }}>
        {activeTab === 'map' ? (
          /* Map view: side-by-side map + fleet sidebar */
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <LiveMap
                riders={riders}
                onSelectRider={(rider) => setSelectedRider(rider)}
              />
            </div>
            <FleetSidebar
              riders={riders}
              onSelectRider={(rider) => setSelectedRider(rider)}
            />
          </div>
        ) : (
          <RiderList
            riders={riders}
            onSelectRider={(rider) => setSelectedRider(rider)}
            onOpenAddRider={() => setIsAddRiderOpen(true)}
            onDeleteRider={handleDeleteRider}
          />
        )}
      </main>

      {/* Modals */}
      <AddRiderModal
        isOpen={isAddRiderOpen}
        onClose={() => setIsAddRiderOpen(false)}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <RiderDetailModal
        rider={selectedRider}
        onClose={() => setSelectedRider(null)}
      />
    </div>
  );
}

export default App;
