export interface Location {
  lat: number;
  lng: number;
  timestamp: any;
}

export interface Rider {
  id: string; // uid
  name: string;
  phone: string;
  status: 'traveling' | 'delivering' | 'resting' | 'offline';
  lastLocation?: Location | null;
  currentShiftId?: string | null;
  totalDistanceKm?: number;
  createdAt?: any;
}

export interface Shift {
  id: string;
  riderId: string;
  startTime: any;
  endTime?: any | null;
  totalDistanceKm?: number;
}

export interface PingPoint {
  id: string;
  riderId: string;
  lat: number;
  lng: number;
  timestamp: any;
  speed: number; // m/s
  movementType: 'traveling' | 'delivering' | 'resting';
}

export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
